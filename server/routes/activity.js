// 사용자 활동 로그 API 라우터
const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { body, validationResult, param, query } = require('express-validator');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');

// ========== 활동 추적 API ==========

// 사용자 활동 기록 (메뉴 클릭, 페이지 이동 등)
// 비로그인 사용자의 IP 접속도 수집하기 위해 optionalAuth 사용
router.post('/track',
  [
    body('activity_type').trim().isLength({ min: 1, max: 50 }),
    body('activity_name').trim().isLength({ min: 1, max: 200 }),
    body('activity_data').optional()
  ],
  optionalAuth,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { activity_type, activity_name, activity_data } = req.body;
      const user = req.user; // 로그인한 경우에만 존재
      
      // IP 주소 가져오기 (Nginx 프록시를 통한 경우)
      let clientIp = req.ip || 
                     (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) ||
                     req.headers['x-real-ip'] ||
                     req.connection?.remoteAddress ||
                     req.socket?.remoteAddress ||
                     'unknown';
      
      // IPv6 맵핑된 IPv4 주소 처리 (::ffff:192.168.0.1 -> 192.168.0.1)
      if (clientIp && clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.substring(7);
      }
      
      // JWT에서 세션 ID 가져오기 (로그인한 경우에만)
      const token = req.headers.authorization?.replace('Bearer ', '');
      let sessionId = null;
      let userId = null;
      
      if (user && token) {
        userId = user.user_id;
        try {
          const jwt = require('jsonwebtoken');
          const JWT_SECRET = process.env.JWT_SECRET || 'seomgim-church-secret-key-change-in-production';
          const decoded = jwt.verify(token, JWT_SECRET);
          sessionId = decoded.session_id || null;
        } catch (e) {
          // 토큰 파싱 실패 시 무시
        }
      }

      const pool = getPool();
      // 로그인한 사용자는 user_id와 session_id 저장, 비로그인 사용자는 ip_address만 저장
      await pool.query(`
        INSERT INTO user_activities (session_id, user_id, ip_address, activity_type, activity_name, activity_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        sessionId, 
        userId, 
        userId ? null : clientIp, // 로그인한 사용자는 IP를 NULL로, 비로그인 사용자는 IP 저장
        activity_type, 
        activity_name, 
        activity_data ? JSON.stringify(activity_data) : null
      ]);

      res.json({ success: true, message: '활동이 기록되었습니다.' });
    } catch (error) {
      console.error('활동 기록 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 로그아웃 시 세션 종료 시간 업데이트
router.post('/logout',
  authenticate,
  async (req, res) => {
    try {
      const user = req.user;
      const token = req.headers.authorization?.replace('Bearer ', '');
      let sessionId = null;
      
      if (token) {
        try {
          const jwt = require('jsonwebtoken');
          const JWT_SECRET = process.env.JWT_SECRET || 'seomgim-church-secret-key-change-in-production';
          const decoded = jwt.verify(token, JWT_SECRET);
          sessionId = decoded.session_id || null;
        } catch (e) {
          // 토큰 파싱 실패 시 무시
        }
      }

      if (sessionId) {
        const pool = getPool();
        // 세션 종료 시간 및 이용시간 계산
        await pool.query(`
          UPDATE user_sessions 
          SET logout_time = NOW(),
              session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW())
          WHERE session_id = ? AND user_id = ? AND logout_time IS NULL
        `, [sessionId, user.user_id]);
      }

      res.json({ success: true, message: '로그아웃이 기록되었습니다.' });
    } catch (error) {
      console.error('로그아웃 기록 오류:', error);
      // 오류가 발생해도 로그아웃은 성공으로 처리
      res.json({ success: true, message: '로그아웃이 완료되었습니다.' });
    }
  }
);

// ========== 최고관리자용 조회 API ==========

// 사용자 세션 목록 조회 (최고관리자만)
router.get('/sessions',
  [
    query('user_id').optional().isInt(),
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  authenticate,
  authorize('super-admin'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { user_id, start_date, end_date, page = 1, limit = 50 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let query = `
        SELECT 
          s.session_id,
          s.user_id,
          u.username,
          u.nickname,
          u.name,
          s.login_time,
          s.logout_time,
          s.session_duration,
          s.ip_address,
          s.user_agent,
          s.created_at
        FROM user_sessions s
        JOIN users u ON s.user_id = u.user_id
        WHERE 1=1
      `;
      const params = [];

      if (user_id) {
        query += ' AND s.user_id = ?';
        params.push(parseInt(user_id));
      }

      if (start_date) {
        query += ' AND s.login_time >= ?';
        params.push(start_date);
      }

      if (end_date) {
        query += ' AND s.login_time <= ?';
        params.push(end_date);
      }

      query += ' ORDER BY s.login_time DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      const pool = getPool();
      const [sessions] = await pool.query(query, params);

      // 전체 개수 조회
      let countQuery = 'SELECT COUNT(*) as total FROM user_sessions s WHERE 1=1';
      const countParams = [];
      if (user_id) {
        countQuery += ' AND s.user_id = ?';
        countParams.push(parseInt(user_id));
      }
      if (start_date) {
        countQuery += ' AND s.login_time >= ?';
        countParams.push(start_date);
      }
      if (end_date) {
        countQuery += ' AND s.login_time <= ?';
        countParams.push(end_date);
      }
      const [countResult] = await pool.query(countQuery, countParams);
      const total = countResult[0].total;

      res.json({
        success: true,
        data: {
          sessions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      console.error('세션 목록 조회 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 사용자 활동 목록 조회 (최고관리자만)
router.get('/activities',
  [
    query('user_id').optional().isInt(),
    query('session_id').optional().isInt(),
    query('activity_type').optional().isString(),
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  authenticate,
  authorize('super-admin'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { user_id, session_id, activity_type, start_date, end_date, page = 1, limit = 100 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let query = `
        SELECT 
          a.activity_id,
          a.session_id,
          a.user_id,
          a.ip_address,
          u.username,
          u.nickname,
          u.name,
          a.activity_type,
          a.activity_name,
          a.activity_data,
          a.created_at
        FROM user_activities a
        LEFT JOIN users u ON a.user_id = u.user_id
        WHERE 1=1
      `;
      const params = [];

      if (user_id) {
        query += ' AND a.user_id = ?';
        params.push(parseInt(user_id));
      }

      if (session_id) {
        query += ' AND a.session_id = ?';
        params.push(parseInt(session_id));
      }

      if (activity_type) {
        query += ' AND a.activity_type = ?';
        params.push(activity_type);
      }

      if (start_date) {
        query += ' AND a.created_at >= ?';
        params.push(start_date);
      }

      if (end_date) {
        query += ' AND a.created_at <= ?';
        params.push(end_date);
      }

      query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      const pool = getPool();
      const [activities] = await pool.query(query, params);

      // 전체 개수 조회
      let countQuery = 'SELECT COUNT(*) as total FROM user_activities a WHERE 1=1';
      const countParams = [];
      if (user_id) {
        countQuery += ' AND a.user_id = ?';
        countParams.push(parseInt(user_id));
      }
      if (session_id) {
        countQuery += ' AND a.session_id = ?';
        countParams.push(parseInt(session_id));
      }
      if (activity_type) {
        countQuery += ' AND a.activity_type = ?';
        countParams.push(activity_type);
      }
      if (start_date) {
        countQuery += ' AND a.created_at >= ?';
        countParams.push(start_date);
      }
      if (end_date) {
        countQuery += ' AND a.created_at <= ?';
        countParams.push(end_date);
      }
      const [countResult] = await pool.query(countQuery, countParams);
      const total = countResult[0].total;

      res.json({
        success: true,
        data: {
          activities,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      console.error('활동 목록 조회 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// IP 주소별 통계 조회 (최고관리자만)
router.get('/ip-statistics',
  [
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601()
  ],
  authenticate,
  authorize('super-admin'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { start_date, end_date } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (start_date) {
        whereClause += ' AND s.login_time >= ?';
        params.push(start_date);
      }

      if (end_date) {
        whereClause += ' AND s.login_time <= ?';
        params.push(end_date);
      }

      const pool = getPool();
      
      // IP 주소별 통합 통계 (로그인/비로그인 사용자 모두 포함)
      // user_activities 테이블에서 IP 주소를 직접 가져오거나, session을 통해 가져옴
      let activityWhereClause = 'WHERE 1=1';
      const activityParams = [];
      if (start_date) {
        activityWhereClause += ' AND a.created_at >= ?';
        activityParams.push(start_date);
      }
      if (end_date) {
        activityWhereClause += ' AND a.created_at <= ?';
        activityParams.push(end_date);
      }

      // IP별 활동 통계 (로그인/비로그인 사용자 모두 포함)
      // user_activities에서 IP 주소를 직접 가져오거나, session을 통해 가져옴
      const [ipActivityStats] = await pool.query(`
        SELECT 
          COALESCE(a.ip_address, s.ip_address) as ip_address,
          COUNT(DISTINCT CASE WHEN a.user_id IS NOT NULL THEN a.user_id END) as unique_users,
          COUNT(a.activity_id) as total_activities,
          COUNT(DISTINCT a.activity_type) as activity_types,
          MIN(a.created_at) as first_access,
          MAX(a.created_at) as last_access,
          GROUP_CONCAT(DISTINCT CASE WHEN u.name IS NOT NULL THEN u.name END ORDER BY u.name SEPARATOR ', ') as user_names
        FROM user_activities a
        LEFT JOIN user_sessions s ON a.session_id = s.session_id
        LEFT JOIN users u ON a.user_id = u.user_id
        ${activityWhereClause}
        GROUP BY COALESCE(a.ip_address, s.ip_address)
        HAVING ip_address IS NOT NULL
        ORDER BY total_activities DESC
        LIMIT 100
      `, activityParams);

      // IP 주소별 세션 통계 (로그인한 사용자의 세션만)
      let sessionWhereClause = 'WHERE 1=1';
      const sessionParams = [];
      if (start_date) {
        sessionWhereClause += ' AND s.login_time >= ?';
        sessionParams.push(start_date);
      }
      if (end_date) {
        sessionWhereClause += ' AND s.login_time <= ?';
        sessionParams.push(end_date);
      }
      
      const [ipStats] = await pool.query(`
        SELECT 
          s.ip_address,
          COUNT(DISTINCT s.user_id) as unique_users,
          COUNT(s.session_id) as total_sessions,
          SUM(s.session_duration) as total_duration,
          AVG(s.session_duration) as avg_duration,
          MIN(s.login_time) as first_access,
          MAX(s.login_time) as last_access,
          GROUP_CONCAT(DISTINCT u.name ORDER BY u.name SEPARATOR ', ') as user_names
        FROM user_sessions s
        JOIN users u ON s.user_id = u.user_id
        ${sessionWhereClause}
        GROUP BY s.ip_address
        ORDER BY total_sessions DESC
        LIMIT 100
      `, sessionParams);

      // IP 주소 목록 추출
      const allIPs = [...new Set([
        ...ipStats.map(stat => stat.ip_address),
        ...ipActivityStats.map(stat => stat.ip_address)
      ])];

      // 지역 정보 조회
      const { getLocationsFromIPs } = require('../utils/ipGeoLocation');
      const locationMap = await getLocationsFromIPs(allIPs);

      // IP 통계에 지역 정보 추가
      const ipStatsWithLocation = ipStats.map(stat => ({
        ...stat,
        location: locationMap.get(stat.ip_address) || {
          country: '알 수 없음',
          countryCode: '',
          region: '알 수 없음',
          regionCode: '',
          city: '알 수 없음',
          zip: '',
          latitude: null,
          longitude: null,
          isp: '알 수 없음',
          org: '',
          as: '',
          asname: '',
          timezone: '알 수 없음',
          locationDetail: '알 수 없음'
        }
      }));

      // IP별 활동 통계에 지역 정보 추가
      const ipActivityStatsWithLocation = ipActivityStats.map(stat => ({
        ...stat,
        location: locationMap.get(stat.ip_address) || {
          country: '알 수 없음',
          countryCode: '',
          region: '알 수 없음',
          regionCode: '',
          city: '알 수 없음',
          zip: '',
          latitude: null,
          longitude: null,
          isp: '알 수 없음',
          org: '',
          as: '',
          asname: '',
          timezone: '알 수 없음',
          locationDetail: '알 수 없음'
        }
      }));

      res.json({
        success: true,
        data: {
          ip_statistics: ipStatsWithLocation,
          ip_activity_statistics: ipActivityStatsWithLocation
        }
      });
    } catch (error) {
      console.error('IP 통계 조회 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 사용자별 통계 조회 (최고관리자만)
router.get('/statistics',
  [
    query('user_id').optional().isInt(),
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601()
  ],
  authenticate,
  authorize('super-admin'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { user_id, start_date, end_date } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (user_id) {
        whereClause += ' AND s.user_id = ?';
        params.push(parseInt(user_id));
      }

      if (start_date) {
        whereClause += ' AND s.login_time >= ?';
        params.push(start_date);
      }

      if (end_date) {
        whereClause += ' AND s.login_time <= ?';
        params.push(end_date);
      }

      const pool = getPool();
      
      // 사용자별 세션 통계
      const [sessionStats] = await pool.query(`
        SELECT 
          u.user_id,
          u.username,
          u.nickname,
          u.name,
          COUNT(s.session_id) as total_sessions,
          SUM(s.session_duration) as total_duration,
          AVG(s.session_duration) as avg_duration,
          MIN(s.login_time) as first_login,
          MAX(s.login_time) as last_login
        FROM users u
        LEFT JOIN user_sessions s ON u.user_id = s.user_id ${whereClause.replace('WHERE 1=1', '')}
        GROUP BY u.user_id, u.username, u.nickname, u.name
        ORDER BY total_sessions DESC
      `, params);

      // 활동 유형별 통계
      let activityWhereClause = 'WHERE 1=1';
      const activityParams = [];
      if (user_id) {
        activityWhereClause += ' AND a.user_id = ?';
        activityParams.push(parseInt(user_id));
      }
      if (start_date) {
        activityWhereClause += ' AND a.created_at >= ?';
        activityParams.push(start_date);
      }
      if (end_date) {
        activityWhereClause += ' AND a.created_at <= ?';
        activityParams.push(end_date);
      }

      const [activityStats] = await pool.query(`
        SELECT 
          a.activity_type,
          a.activity_name,
          COUNT(*) as count
        FROM user_activities a
        ${activityWhereClause}
        GROUP BY a.activity_type, a.activity_name
        ORDER BY count DESC
        LIMIT 20
      `, activityParams);

      res.json({
        success: true,
        data: {
          session_statistics: sessionStats,
          activity_statistics: activityStats
        }
      });
    } catch (error) {
      console.error('통계 조회 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

module.exports = router;

