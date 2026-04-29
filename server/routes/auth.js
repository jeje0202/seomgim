// 인증 API 라우터
const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult, param, query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');

// JWT 시크릿 키 (환경 변수 또는 기본값)
const JWT_SECRET = process.env.JWT_SECRET || 'seomgim-church-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ========== 회원가입 ==========
router.post('/register',
  [
    body('username').trim().isLength({ min: 3, max: 50 }).matches(/^[a-zA-Z0-9_]+$/),
    body('nickname').trim().isLength({ min: 1, max: 50 }),
    body('password').isLength({ min: 4 }),
    body('name').trim().isLength({ min: 1, max: 50 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { username, nickname, password, name, is_member = false } = req.body;
      const pool = getPool();

      // 사용자 수 확인 (첫 사용자인지)
      const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users');
      const isFirstUser = userCount[0].count === 0;

      // 아이디 중복 확인
      const [existingUsername] = await pool.query(
        'SELECT user_id FROM users WHERE username = ?',
        [username]
      );

      if (existingUsername.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: '이미 사용 중인 아이디입니다.' 
        });
      }

      // 닉네임 중복 확인
      const [existingNickname] = await pool.query(
        'SELECT user_id FROM users WHERE nickname = ?',
        [nickname]
      );

      if (existingNickname.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: '이미 사용 중인 닉네임입니다.' 
        });
      }

      // 비밀번호 해시화
      const hashedPassword = await bcrypt.hash(password, 10);

      // 첫 사용자는 super-admin, 나머지는 user
      const role = isFirstUser ? 'super-admin' : 'user';
      
      // 모든 신규가입자는 관리자 승인 필요 (첫 사용자는 자동 승인)
      const is_approved = isFirstUser ? true : false;

      // 사용자 생성
      const [result] = await pool.query(`
        INSERT INTO users (username, nickname, password, name, role, is_member, is_approved)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [username, nickname, hashedPassword, name, role, is_member || false, is_approved]);

      // 첫 사용자는 자동 로그인, 나머지는 승인 대기
      let token = null;
      if (is_approved) {
        token = jwt.sign(
          { 
            user_id: result.insertId, 
            username, 
            role,
            name 
          },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );
      }

      // 첫 사용자가 아닌 경우(승인 대기 상태) 관리자에게 실시간 알림
      if (!is_approved) {
        try {
          const { broadcastPendingUserCount } = require('./events');
          broadcastPendingUserCount();
          console.log('[회원가입] 승인 대기 사용자 생성 - 관리자에게 실시간 알림 전송');
        } catch (error) {
          console.error('[회원가입] 실시간 알림 전송 오류:', error);
          // 알림 실패해도 회원가입은 성공 처리
        }
      }

      res.status(201).json({
        success: true,
        data: {
          user_id: result.insertId,
          username,
          nickname,
          name,
          role,
          token,
          is_member: is_member || false,
          is_approved: is_approved
        },
        message: isFirstUser 
          ? '최고관리자 계정이 생성되었습니다.' 
          : '회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.'
      });
    } catch (error) {
      console.error('회원가입 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ========== 로그인 ==========
router.post('/login',
  [
    body('username').trim().isLength({ min: 1 }),
    body('password').isLength({ min: 1 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { username, password } = req.body;
      const pool = getPool();

      // 사용자 조회
      const [users] = await pool.query(
        'SELECT user_id, username, nickname, password, name, role, is_active, is_approved, is_member FROM users WHERE username = ?',
        [username]
      );

      if (users.length === 0) {
        return res.status(401).json({ 
          success: false, 
          message: '아이디 또는 비밀번호가 일치하지 않습니다.' 
        });
      }

      const user = users[0];

      // 비활성화 사용자 체크
      if (!user.is_active) {
        return res.status(403).json({ 
          success: false, 
          message: '비활성화된 계정입니다.' 
        });
      }

      // 관리자 승인 체크 (모든 신규가입자는 승인 필요)
      if (!user.is_approved) {
        return res.status(403).json({ 
          success: false, 
          message: '관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.' 
        });
      }

      // 비밀번호 확인
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ 
          success: false, 
          message: '아이디 또는 비밀번호가 일치하지 않습니다.' 
        });
      }

      // 마지막 로그인 시간 업데이트
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?',
        [user.user_id]
      );

      // 사용자 세션 로그 생성 (로그인 시작시간 기록)
      const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      const [sessionResult] = await pool.query(`
        INSERT INTO user_sessions (user_id, login_time, ip_address, user_agent)
        VALUES (?, NOW(), ?, ?)
      `, [user.user_id, ipAddress, userAgent]);
      const sessionId = sessionResult.insertId;

      // JWT 토큰 생성 (세션 ID 및 nickname 포함)
      const token = jwt.sign(
        { 
          user_id: user.user_id, 
          username: user.username, 
          role: user.role,
          name: user.name,
          nickname: user.nickname, // nickname 추가
          session_id: sessionId
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.json({
        success: true,
        data: {
          user_id: user.user_id,
          username: user.username,
          nickname: user.nickname,
          name: user.name,
          role: user.role,
          is_member: user.is_member || false,
          session_id: sessionId,
          token
        },
        message: '로그인 성공'
      });
    } catch (error) {
      console.error('로그인 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ========== 토큰 검증 ==========
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const pool = getPool();

    // 사용자 정보 조회
    const [users] = await pool.query(
      'SELECT user_id, username, nickname, name, role, is_active, is_member FROM users WHERE user_id = ?',
      [decoded.user_id]
    );

    if (users.length === 0 || !users[0].is_active) {
      return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
    }

    res.json({
      success: true,
      data: {
        user_id: users[0].user_id,
        username: users[0].username,
        nickname: users[0].nickname,
        name: users[0].name,
        role: users[0].role,
        is_member: users[0].is_member || false
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
    }
    console.error('토큰 검증 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// ========== 아이디 중복 확인 ==========
router.get('/check-username',
  [
    query('username').trim().isLength({ min: 3, max: 50 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { username } = req.query;
      const pool = getPool();

      const [users] = await pool.query(
        'SELECT user_id FROM users WHERE username = ?',
        [username]
      );

      res.json({
        success: true,
        data: {
          available: users.length === 0
        },
        message: users.length === 0 ? '사용 가능한 아이디입니다.' : '이미 사용 중인 아이디입니다.'
      });
    } catch (error) {
      console.error('아이디 중복 확인 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ========== 닉네임 중복 확인 ==========
router.get('/check-nickname',
  [
    query('nickname').trim().isLength({ min: 1, max: 50 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { nickname } = req.query;
      const pool = getPool();

      const [users] = await pool.query(
        'SELECT user_id FROM users WHERE nickname = ?',
        [nickname]
      );

      res.json({
        success: true,
        data: {
          available: users.length === 0
        },
        message: users.length === 0 ? '사용 가능한 닉네임입니다.' : '이미 사용 중인 닉네임입니다.'
      });
    } catch (error) {
      console.error('닉네임 중복 확인 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ========== 현재 사용자 정보 ==========
// 사용자 정보 조회 (현재 로그인한 사용자)
router.get('/me',
  authenticate,
  async (req, res) => {
    try {
      const pool = getPool();

      const [users] = await pool.query(
        'SELECT user_id, username, nickname, name, role, is_active, is_member, last_login, created_at FROM users WHERE user_id = ?',
        [req.user.user_id]
      );

      if (users.length === 0) {
        return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      }

      res.json({
        success: true,
        data: users[0]
      });
    } catch (error) {
      console.error('사용자 정보 조회 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ========== 비밀번호 변경 ==========
router.put('/change-password',
  [
    body('current_password').isLength({ min: 1 }),
    body('new_password').isLength({ min: 4 }),
    body('confirm_password').isLength({ min: 4 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const { current_password, new_password, confirm_password } = req.body;

      // 새 비밀번호 확인
      if (new_password !== confirm_password) {
        return res.status(400).json({ 
          success: false, 
          message: '새 비밀번호가 일치하지 않습니다.' 
        });
      }

      const pool = getPool();

      // 사용자 정보 조회
      const [users] = await pool.query(
        'SELECT user_id, password FROM users WHERE user_id = ?',
        [decoded.user_id]
      );

      if (users.length === 0) {
        return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      }

      // 현재 비밀번호 확인
      const isPasswordValid = await bcrypt.compare(current_password, users[0].password);
      if (!isPasswordValid) {
        return res.status(401).json({ 
          success: false, 
          message: '현재 비밀번호가 일치하지 않습니다.' 
        });
      }

      // 새 비밀번호 해시화
      const hashedNewPassword = await bcrypt.hash(new_password, 10);

      // 비밀번호 변경
      await pool.query(
        'UPDATE users SET password = ? WHERE user_id = ?',
        [hashedNewPassword, decoded.user_id]
      );

      res.json({ 
        success: true, 
        message: '비밀번호가 변경되었습니다.' 
      });
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
      }
      console.error('비밀번호 변경 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ========== 사용자 관리 (관리자 전용) ==========

// 모든 사용자 목록 조회 (관리자 이상)
router.get('/users',
  authenticate,
  authorize('admin', 'super-admin'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { page = 1, limit = 20, search = '' } = req.query;
      const offset = (page - 1) * limit;

      const pool = getPool();
      let query = `
        SELECT user_id, username, nickname, name, role, is_active, is_member, is_approved, created_at, last_login
        FROM users
        WHERE 1=1
      `;
      const params = [];

      if (search) {
        query += ' AND (username LIKE ? OR name LIKE ? OR nickname LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const [users] = await pool.query(query, params);

      // 전체 사용자 수 조회
      let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
      const countParams = [];
      if (search) {
        countQuery += ' AND (username LIKE ? OR name LIKE ? OR nickname LIKE ?)';
        const searchPattern = `%${search}%`;
        countParams.push(searchPattern, searchPattern, searchPattern);
      }
      const [countResult] = await pool.query(countQuery, countParams);
      const total = countResult[0].total;

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('사용자 목록 조회 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 신규 회원 요청 수 조회 (관리자 이상)
router.get('/users/pending-count',
  authenticate,
  authorize('admin', 'super-admin'),
  async (req, res) => {
    try {
      const pool = getPool();
      // 승인 대기 중인 모든 사용자 카운트 (is_member 조건 제거)
      const [result] = await pool.query(
        'SELECT COUNT(*) as count FROM users WHERE is_approved = FALSE AND is_active = TRUE'
      );
      
      res.json({
        success: true,
        data: { count: result[0].count || 0 }
      });
    } catch (error) {
      console.error('신규 회원 요청 수 조회 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 사용자 정보 수정 (관리자 이상)
router.put('/users/:id',
  authenticate,
  authorize('admin', 'super-admin'),
  [
    param('id').isInt(),
    body('name').optional().trim().isLength({ min: 1, max: 50 }),
    body('nickname').optional().trim().isLength({ min: 1, max: 50 }),
    body('role').optional().isIn(['user', 'manager', 'admin', 'super-admin']),
    body('is_active').optional().isBoolean(),
    body('is_member').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const { name, nickname, email, role, is_active, is_member } = req.body;

      const pool = getPool();

      // 사용자 존재 확인
      const [users] = await pool.query('SELECT user_id, role FROM users WHERE user_id = ?', [id]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      }

      // super-admin 권한 변경 제한 (super-admin만 다른 super-admin 권한 변경 가능)
      if (role && role === 'super-admin' && req.user.role !== 'super-admin') {
        return res.status(403).json({ 
          success: false, 
          message: '최고관리자 권한은 최고관리자만 변경할 수 있습니다.' 
        });
      }

      // 최고관리자의 권한을 다른 것으로 변경 시 최소 1명은 남아있어야 함
      if (role && users[0].role === 'super-admin' && role !== 'super-admin') {
        const [superAdminCount] = await pool.query(
          'SELECT COUNT(*) as count FROM users WHERE role = ?',
          ['super-admin']
        );
        const count = superAdminCount[0].count || 0;
        
        if (count <= 1) {
          return res.status(403).json({ 
            success: false, 
            message: '최소 1명의 최고관리자가 필요합니다. 마지막 최고관리자의 권한은 변경할 수 없습니다.' 
          });
        }
      }

      // 자신의 권한을 낮추는 것 방지
      if (role && parseInt(id) === req.user.user_id) {
        const roleHierarchy = {
          'user': 1,
          'manager': 2,
          'admin': 3,
          'super-admin': 4
        };
        const currentLevel = roleHierarchy[users[0].role] || 0;
        const newLevel = roleHierarchy[role] || 0;
        if (newLevel < currentLevel) {
          return res.status(403).json({ 
            success: false, 
            message: '자신의 권한을 낮출 수 없습니다.' 
          });
        }
      }

      // 업데이트할 필드 구성
      const updateFields = [];
      const updateParams = [];

      if (name !== undefined) {
        updateFields.push('name = ?');
        updateParams.push(name);
      }
      if (nickname !== undefined) {
        // 닉네임 중복 확인
        const [existingNickname] = await pool.query(
          'SELECT user_id FROM users WHERE nickname = ? AND user_id != ?',
          [nickname, id]
        );
        if (existingNickname.length > 0) {
          return res.status(400).json({ 
            success: false, 
            message: '이미 사용 중인 닉네임입니다.' 
          });
        }
        updateFields.push('nickname = ?');
        updateParams.push(nickname);
      }
      if (role !== undefined) {
        updateFields.push('role = ?');
        updateParams.push(role);
      }
      if (is_active !== undefined) {
        updateFields.push('is_active = ?');
        updateParams.push(is_active);
      }

      if (is_member !== undefined) {
        updateFields.push('is_member = ?');
        updateParams.push(is_member);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ success: false, message: '수정할 정보가 없습니다.' });
      }

      updateParams.push(id);

      await pool.query(
        `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = ?`,
        updateParams
      );

      res.json({ success: true, message: '사용자 정보가 수정되었습니다.' });
    } catch (error) {
      console.error('사용자 정보 수정 오류:', error);
      const errorMessage = error.message || '서버 오류가 발생했습니다.';
      res.status(500).json({ 
        success: false, 
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// 사용자 삭제 (관리자 이상, super-admin만 다른 super-admin 삭제 가능)
router.delete('/users/:id',
  authenticate,
  authorize('admin', 'super-admin'),
  [param('id').isInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;

      // 자신을 삭제하는 것 방지
      if (parseInt(id) === req.user.user_id) {
        return res.status(403).json({ success: false, message: '자신을 삭제할 수 없습니다.' });
      }

      const pool = getPool();

      // 사용자 존재 확인
      const [users] = await pool.query('SELECT user_id, role FROM users WHERE user_id = ?', [id]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      }

      // super-admin 삭제 제한 (super-admin만 삭제 가능)
      if (users[0].role === 'super-admin' && req.user.role !== 'super-admin') {
        return res.status(403).json({ 
          success: false, 
          message: '최고관리자는 최고관리자만 삭제할 수 있습니다.' 
        });
      }

      // 최고관리자 삭제 시 최소 1명은 남아있어야 함
      if (users[0].role === 'super-admin') {
        const [superAdminCount] = await pool.query(
          'SELECT COUNT(*) as count FROM users WHERE role = ?',
          ['super-admin']
        );
        const count = superAdminCount[0].count || 0;
        
        if (count <= 1) {
          return res.status(403).json({ 
            success: false, 
            message: '최소 1명의 최고관리자가 필요합니다. 마지막 최고관리자는 삭제할 수 없습니다.' 
          });
        }
      }

      await pool.query('DELETE FROM users WHERE user_id = ?', [id]);

      res.json({ success: true, message: '사용자가 삭제되었습니다.' });
    } catch (error) {
      console.error('사용자 삭제 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 사용자 비밀번호 초기화 (관리자 이상)
router.put('/users/:id/reset-password',
  authenticate,
  authorize('admin', 'super-admin'),
  [
    param('id').isInt(),
    body('new_password').optional().isLength({ min: 4 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const { new_password } = req.body;
      
      const pool = getPool();

      // 사용자 존재 확인
      const [users] = await pool.query('SELECT user_id FROM users WHERE user_id = ?', [id]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      }

      // 새 비밀번호 생성 (제공되지 않으면 기본값)
      const password = new_password || '1234';
      const hashedPassword = await bcrypt.hash(password, 10);

      await pool.query(
        'UPDATE users SET password = ? WHERE user_id = ?',
        [hashedPassword, id]
      );

      res.json({ 
        success: true, 
        message: `비밀번호가 초기화되었습니다. (새 비밀번호: ${password})`,
        data: { new_password: password }
      });
    } catch (error) {
      console.error('비밀번호 초기화 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 사용자 승인 (관리자 이상)
router.put('/users/:id/approve',
  authenticate,
  authorize('admin', 'super-admin'),
  [param('id').isInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const pool = getPool();

      // 사용자 존재 확인
      const [users] = await pool.query('SELECT user_id, is_member, is_approved FROM users WHERE user_id = ?', [id]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      }

      // 승인 처리
      await pool.query(
        'UPDATE users SET is_approved = TRUE WHERE user_id = ?',
        [id]
      );

      res.json({ 
        success: true, 
        message: '사용자가 승인되었습니다.' 
      });
    } catch (error) {
      console.error('사용자 승인 오류:', error);
      const errorMessage = error.message || '서버 오류가 발생했습니다.';
      res.status(500).json({ 
        success: false, 
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

module.exports = router;

