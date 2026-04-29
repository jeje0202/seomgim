// 교회소식 API 라우터
const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { body, validationResult, param, query } = require('express-validator');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');

// ========== 교회소식 API ==========

// 교회소식 목록 조회
router.get('/',
  [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('tag').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { limit = 10, tag } = req.query;

      let query = `
        SELECT 
          news_id, title, summary, tag, author_name, 
          view_count, is_pinned, pin_order, created_at
        FROM church_news
        WHERE is_deleted = FALSE
      `;
      const params = [];

      if (tag) {
        query += ' AND tag = ?';
        params.push(tag);
      }

      query += ' ORDER BY is_pinned DESC, pin_order ASC, created_at DESC LIMIT ?';
      params.push(parseInt(limit));

      const pool = getPool();
      const [news] = await pool.query(query, params);

      res.json({
        success: true,
        data: news
      });
    } catch (error) {
      console.error('교회소식 목록 조회 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 교회소식 상세 조회
router.get('/:id',
  [param('id').isInt()],
  optionalAuth,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;

      const pool = getPool();

      // 사용자 ID (로그인한 경우 - optionalAuth 미들웨어에서 req.user에 설정됨)
      const userId = req.user ? req.user.user_id : null;

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

      // 디버깅 로그
      console.log(`[교회소식 조회] news_id: ${id}, user_id: ${userId || 'NULL'}, ip: ${clientIp}`);

      // 조회 기록 확인 (중복 조회 방지)
      // 같은 IP에서 다른 사용자가 로그인했을 때도 조회수가 증가하도록 user_id를 기준으로만 체크
      let existingViews;
      if (userId) {
        // 로그인 사용자: user_id만으로 중복 체크 (같은 사용자가 같은 교회소식을 여러 번 조회하는 것만 방지)
        // 같은 IP에서 다른 사용자가 로그인했을 때는 조회수가 증가해야 함
        // user_id가 다르면 다른 사용자로 간주하여 조회수 증가
        [existingViews] = await pool.query(
          'SELECT view_id FROM news_views WHERE news_id = ? AND user_id = ?',
          [id, userId]
        );
        console.log(`[교회소식 조회] 로그인 사용자 중복 체크 - news_id: ${id}, user_id: ${userId}, 기존 조회 기록: ${existingViews.length}개`);
      } else {
        // 비로그인 사용자: ip_address만으로 중복 체크
        [existingViews] = await pool.query(
          'SELECT view_id FROM news_views WHERE news_id = ? AND user_id IS NULL AND ip_address = ?',
          [id, clientIp]
        );
        console.log(`[교회소식 조회] 비로그인 사용자 중복 체크 - news_id: ${id}, ip: ${clientIp}, 기존 조회 기록: ${existingViews.length}개`);
      }

      // 중복 조회가 아닌 경우에만 조회수 증가 및 기록 저장
      if (existingViews.length === 0) {
        try {
          // 트랜잭션 시작하여 조회수 증가와 조회 기록 저장을 원자적으로 처리
          const connection = await pool.getConnection();
          await connection.beginTransaction();

          try {
            // 조회수 증가
            await connection.query(
              'UPDATE church_news SET view_count = view_count + 1 WHERE news_id = ? AND is_deleted = FALSE',
              [id]
            );

            // 조회 기록 저장
            await connection.query(
              'INSERT INTO news_views (news_id, user_id, ip_address) VALUES (?, ?, ?)',
              [id, userId, clientIp]
            );

            await connection.commit();
            console.log(`[교회소식 조회] ✅ 조회수 증가 및 기록 저장 성공 - news_id: ${id}, user_id: ${userId || 'NULL'}, ip: ${clientIp}`);
          } catch (insertError) {
            await connection.rollback();
            // UNIQUE KEY 제약 조건 위반 시 (동시 요청 등으로 인한 중복) 조용히 무시
            if (insertError.code === 'ER_DUP_ENTRY') {
              console.log(`[교회소식 조회] 중복 조회 기록 무시 (동시 요청) - news_id: ${id}, user_id: ${userId || 'NULL'}, ip: ${clientIp}`);
            } else {
              console.error('[교회소식 조회] 조회 기록 저장 오류:', insertError);
              throw insertError;
            }
          } finally {
            connection.release();
          }
        } catch (error) {
          console.error('[교회소식 조회] 조회수 증가 오류:', error);
          // 조회수 증가 실패해도 교회소식은 조회 가능하도록 계속 진행
        }
      } else {
        console.log(`[교회소식 조회] 중복 조회로 인한 조회수 증가 건너뜀 - news_id: ${id}, user_id: ${userId || 'NULL'}, ip: ${clientIp}`);
      }

      // 교회소식 조회
      const [news] = await pool.query(
        'SELECT * FROM church_news WHERE news_id = ? AND is_deleted = FALSE',
        [id]
      );

      if (news.length === 0) {
        return res.status(404).json({ success: false, message: '교회소식을 찾을 수 없습니다.' });
      }

      res.json({
        success: true,
        data: news[0]
      });
    } catch (error) {
      console.error('교회소식 상세 조회 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 교회소식 작성 (관리자 이상만 가능)
router.post('/',
  [
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('content').trim().isLength({ min: 1 }),
    body('summary').optional().trim().isLength({ max: 500 }),
    body('tag').trim().isLength({ min: 1, max: 20 }),
    body('author_name').trim().isLength({ min: 1, max: 50 }),
    body('is_pinned').optional().isBoolean(),
    body('pin_order').optional().isInt({ min: 0 })
  ],
  authenticate,
  authorize('admin', 'super-admin'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { title, content, summary, tag, author_name, is_pinned = false, pin_order = 0, image_url } = req.body;

      const pool = getPool();
      const [result] = await pool.query(`
        INSERT INTO church_news (title, content, summary, tag, author_name, is_pinned, pin_order, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [title, content, summary || content.substring(0, 500), tag, author_name, is_pinned, pin_order, image_url || null]);

      res.status(201).json({
        success: true,
        data: { news_id: result.insertId },
        message: '교회소식이 작성되었습니다.'
      });
    } catch (error) {
      console.error('교회소식 작성 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 교회소식 수정 (관리자 이상만 가능)
router.put('/:id',
  [
    param('id').isInt(),
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('content').trim().isLength({ min: 1 }),
    body('summary').optional().trim().isLength({ max: 500 }),
    body('tag').trim().isLength({ min: 1, max: 20 }),
    body('is_pinned').optional().isBoolean(),
    body('pin_order').optional().isInt({ min: 0 })
  ],
  authenticate,
  authorize('admin', 'super-admin'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const { title, content, summary, tag, is_pinned, pin_order, image_url } = req.body;

      const pool = getPool();

      // 교회소식 존재 확인
      const [news] = await pool.query(
        'SELECT news_id FROM church_news WHERE news_id = ? AND is_deleted = FALSE',
        [id]
      );

      if (news.length === 0) {
        return res.status(404).json({ success: false, message: '교회소식을 찾을 수 없습니다.' });
      }

      // 교회소식 수정
      await pool.query(
        'UPDATE church_news SET title = ?, content = ?, summary = ?, tag = ?, is_pinned = ?, pin_order = ?, image_url = ? WHERE news_id = ?',
        [title, content, summary || content.substring(0, 500), tag, is_pinned || false, pin_order || 0, image_url || null, id]
      );

      res.json({ success: true, message: '교회소식이 수정되었습니다.' });
    } catch (error) {
      console.error('교회소식 수정 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 교회소식 삭제 (관리자 이상만 가능, soft delete)
router.delete('/:id',
  [param('id').isInt()],
  authenticate,
  authorize('admin', 'super-admin'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;

      const pool = getPool();

      // 교회소식 존재 확인
      const [news] = await pool.query(
        'SELECT news_id FROM church_news WHERE news_id = ? AND is_deleted = FALSE',
        [id]
      );

      if (news.length === 0) {
        return res.status(404).json({ success: false, message: '교회소식을 찾을 수 없습니다.' });
      }

      // 교회소식 삭제 (soft delete)
      await pool.query('UPDATE church_news SET is_deleted = TRUE WHERE news_id = ?', [id]);

      res.json({ success: true, message: '교회소식이 삭제되었습니다.' });
    } catch (error) {
      console.error('교회소식 삭제 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

module.exports = router;

