// 설문조사 API 라우터
const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { body, validationResult, param, query } = require('express-validator');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');

// ========== 설문조사 목록 조회 ==========
router.get('/',
  optionalAuth,
  async (req, res) => {
    try {
      const { page = 1, limit = 10, status = 'all' } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const pool = getPool();

      let whereClause = 'WHERE 1=1';
      const params = [];

      // 상태 필터 (all, active, ended)
      // active 상태는 나중에 애플리케이션 로직에서 판단 (종료 조건이 복잡하므로)
      if (status === 'ended') {
        whereClause += ' AND s.is_active = FALSE';
      }

      // 설문조사 목록 조회
      const [surveys] = await pool.query(`
        SELECT 
          s.survey_id,
          s.title,
          s.description,
          s.author_name,
          s.is_active,
          s.is_anonymous,
          s.target_type,
          s.start_date,
          s.end_date,
          s.end_condition_type,
          s.end_count,
          s.end_percentage,
          s.created_at,
          COUNT(DISTINCT sr.response_id) as response_count
        FROM surveys s
        LEFT JOIN survey_responses sr ON s.survey_id = sr.survey_id
        ${whereClause}
        GROUP BY s.survey_id
        ORDER BY s.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), offset]);

      // active 상태 필터링 (애플리케이션 로직에서 판단)
      let filteredSurveys = surveys;
      if (status === 'active') {
        filteredSurveys = await Promise.all(surveys.map(async (survey) => {
          // 활성화 여부 확인
          if (!survey.is_active) return null;

          // 종료 조건별 확인
          if (survey.end_condition_type === 'date') {
            // 기간 기반
            const now = new Date();
            if (survey.start_date && new Date(survey.start_date) > now) return null;
            if (survey.end_date && new Date(survey.end_date) < now) return null;
          } else if (survey.end_condition_type === 'count') {
            // 인원수 기반
            if (survey.response_count >= survey.end_count) return null;
          } else if (survey.end_condition_type === 'percentage') {
            // 비율 기반
            const [totalUsers] = await pool.query(`
              SELECT COUNT(*) as total FROM users WHERE is_active = TRUE
            `);
            const totalUserCount = totalUsers[0].total;
            const requiredCount = Math.ceil(totalUserCount * (survey.end_percentage / 100));
            if (survey.response_count >= requiredCount) return null;
          }

          return survey;
        }));
        filteredSurveys = filteredSurveys.filter(s => s !== null);
      }

      // 전체 개수 조회
      let countQuery = `SELECT COUNT(*) as total FROM surveys s ${whereClause}`;
      const [countResult] = await pool.query(countQuery, params);
      const total = countResult[0].total;

      res.json({
        success: true,
        data: {
          surveys: filteredSurveys,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: status === 'active' ? filteredSurveys.length : total,
            totalPages: status === 'active' 
              ? Math.ceil(filteredSurveys.length / parseInt(limit))
              : Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      console.error('설문조사 목록 조회 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ========== 설문조사 상세 조회 ==========
router.get('/:id',
  optionalAuth,
  async (req, res) => {
    try {
      const { id } = req.params;
      const pool = getPool();

      // 설문조사 정보 조회
      const [surveys] = await pool.query(`
        SELECT 
          s.*,
          COUNT(DISTINCT sr.response_id) as response_count
        FROM surveys s
        LEFT JOIN survey_responses sr ON s.survey_id = sr.survey_id
        WHERE s.survey_id = ?
        GROUP BY s.survey_id
      `, [id]);

      if (surveys.length === 0) {
        return res.status(404).json({ success: false, message: '설문조사를 찾을 수 없습니다.' });
      }

      const survey = surveys[0];

      // 질문 목록 조회
      const [questions] = await pool.query(`
        SELECT 
          question_id,
          question_text,
          question_type,
          question_order,
          is_required,
          options
        FROM survey_questions
        WHERE survey_id = ?
        ORDER BY question_order ASC
      `, [id]);

      // options JSON 파싱
      const parsedQuestions = questions.map((q) => {
        if (q.options && typeof q.options === 'string') {
          try {
            q.options = JSON.parse(q.options);
          } catch (e) {
            console.error('옵션 파싱 오류:', e);
            q.options = [];
          }
        }
        return q;
      });

      // 사용자가 이미 응답했는지 확인
      let hasResponded = false;
      if (req.user) {
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        const [responses] = await pool.query(`
          SELECT COUNT(*) as count 
          FROM survey_responses 
          WHERE survey_id = ? AND (user_id = ? OR ip_address = ?)
        `, [id, req.user.user_id, clientIp]);
        hasResponded = responses[0].count > 0;
      } else {
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        const [responses] = await pool.query(`
          SELECT COUNT(*) as count 
          FROM survey_responses 
          WHERE survey_id = ? AND ip_address = ?
        `, [id, clientIp]);
        hasResponded = responses[0].count > 0;
      }

      res.json({
        success: true,
        data: {
          ...survey,
          questions: parsedQuestions,
          hasResponded
        }
      });
    } catch (error) {
      console.error('설문조사 상세 조회 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ========== 설문조사 작성 (관리자 이상) ==========
router.post('/',
  [
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('description').optional(),
    body('is_anonymous').optional().isBoolean(),
    body('target_type').optional().isIn(['anyone', 'authenticated', 'authenticated_anonymous']),
    body('start_date').optional().isISO8601(),
    body('end_date').optional().isISO8601(),
    body('end_condition_type').optional().isIn(['date', 'count', 'percentage']),
    body('end_count').optional().isInt({ min: 1 }),
    body('end_percentage').optional().isFloat({ min: 0, max: 100 }),
    body('questions').isArray().isLength({ min: 1 })
  ],
  authenticate,
  authorize('admin', 'super-admin'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { 
        title, 
        description, 
        is_anonymous, 
        target_type,
        start_date, 
        end_date,
        end_condition_type,
        end_count,
        end_percentage,
        questions 
      } = req.body;
      const pool = getPool();
      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        // 종료 조건 검증
        if (end_condition_type === 'count' && (!end_count || end_count < 1)) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ success: false, message: '인원수 기반 종료를 선택한 경우 종료 인원수를 입력해주세요.' });
        }
        if (end_condition_type === 'percentage' && (!end_percentage || end_percentage <= 0 || end_percentage > 100)) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ success: false, message: '비율 기반 종료를 선택한 경우 종료 비율을 입력해주세요. (0-100%)' });
        }
        if (end_condition_type === 'date' && (!start_date || !end_date)) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ success: false, message: '기간 기반 종료를 선택한 경우 시작일과 종료일을 입력해주세요.' });
        }

        // 설문조사 생성
        const [result] = await connection.query(`
          INSERT INTO surveys (
            title, description, author_id, author_name, is_anonymous, 
            target_type, start_date, end_date, 
            end_condition_type, end_count, end_percentage
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          title,
          description || null,
          req.user.user_id,
          req.user.name,
          is_anonymous || false,
          target_type || 'anyone',
          start_date || null,
          end_date || null,
          end_condition_type || 'date',
          end_count || null,
          end_percentage || null
        ]);

        const surveyId = result.insertId;

        // 질문 저장
        if (questions && questions.length > 0) {
          const questionValues = questions.map((q, index) => [
            surveyId,
            q.question_text,
            q.question_type,
            index,
            q.is_required !== false,
            q.options ? JSON.stringify(q.options) : null
          ]);

          await connection.query(`
            INSERT INTO survey_questions (survey_id, question_text, question_type, question_order, is_required, options)
            VALUES ?
          `, [questionValues]);
        }

        await connection.commit();
        connection.release();

        res.status(201).json({
          success: true,
          data: { survey_id: surveyId },
          message: '설문조사가 생성되었습니다.'
        });
      } catch (error) {
        await connection.rollback();
        connection.release();
        throw error;
      }
    } catch (error) {
      console.error('설문조사 작성 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ========== 설문조사 수정 (관리자 이상) ==========
router.put('/:id',
  [
    param('id').isInt(),
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('description').optional(),
    body('is_active').optional().isBoolean(),
    body('is_anonymous').optional().isBoolean(),
    body('target_type').optional().isIn(['anyone', 'authenticated', 'authenticated_anonymous']),
    body('start_date').optional().isISO8601(),
    body('end_date').optional().isISO8601(),
    body('end_condition_type').optional().isIn(['date', 'count', 'percentage']),
    body('end_count').optional().isInt({ min: 1 }),
    body('end_percentage').optional().isFloat({ min: 0, max: 100 })
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
      const { 
        title, 
        description, 
        is_active, 
        is_anonymous, 
        target_type,
        start_date, 
        end_date,
        end_condition_type,
        end_count,
        end_percentage
      } = req.body;
      const pool = getPool();

      // 설문조사 존재 확인
      const [surveys] = await pool.query('SELECT author_id FROM surveys WHERE survey_id = ?', [id]);
      if (surveys.length === 0) {
        return res.status(404).json({ success: false, message: '설문조사를 찾을 수 없습니다.' });
      }

      // 작성자 또는 관리자 확인
      const isAuthor = surveys[0].author_id === req.user.user_id;
      const isAdmin = req.user.role === 'admin' || req.user.role === 'super-admin';
      if (!isAuthor && !isAdmin) {
        return res.status(403).json({ success: false, message: '수정 권한이 없습니다.' });
      }

      // 종료 조건 검증
      if (end_condition_type === 'count' && (!end_count || end_count < 1)) {
        return res.status(400).json({ success: false, message: '인원수 기반 종료를 선택한 경우 종료 인원수를 입력해주세요.' });
      }
      if (end_condition_type === 'percentage' && (!end_percentage || end_percentage <= 0 || end_percentage > 100)) {
        return res.status(400).json({ success: false, message: '비율 기반 종료를 선택한 경우 종료 비율을 입력해주세요. (0-100%)' });
      }
      if (end_condition_type === 'date' && (!start_date || !end_date)) {
        return res.status(400).json({ success: false, message: '기간 기반 종료를 선택한 경우 시작일과 종료일을 입력해주세요.' });
      }

      await pool.query(`
        UPDATE surveys 
        SET title = ?, description = ?, is_active = ?, is_anonymous = ?, 
            target_type = ?, start_date = ?, end_date = ?, 
            end_condition_type = ?, end_count = ?, end_percentage = ?
        WHERE survey_id = ?
      `, [
        title, 
        description || null, 
        is_active !== undefined ? is_active : true, 
        is_anonymous || false,
        target_type || 'anyone',
        start_date || null, 
        end_date || null,
        end_condition_type || 'date',
        end_count || null,
        end_percentage || null,
        id
      ]);

      res.json({ success: true, message: '설문조사가 수정되었습니다.' });
    } catch (error) {
      console.error('설문조사 수정 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ========== 설문조사 취소 (관리자 이상) ==========
router.patch('/:id/cancel',
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

      // 설문조사 존재 확인
      const [surveys] = await pool.query('SELECT is_active FROM surveys WHERE survey_id = ?', [id]);
      if (surveys.length === 0) {
        return res.status(404).json({ success: false, message: '설문조사를 찾을 수 없습니다.' });
      }

      // 이미 취소된 설문조사인지 확인
      if (!surveys[0].is_active) {
        return res.status(400).json({ success: false, message: '이미 취소된 설문조사입니다.' });
      }

      // 설문조사 취소 (is_active를 FALSE로 변경)
      await pool.query('UPDATE surveys SET is_active = FALSE WHERE survey_id = ?', [id]);

      res.json({ success: true, message: '설문조사가 취소되었습니다.' });
    } catch (error) {
      console.error('설문조사 취소 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ========== 설문조사 삭제 (관리자 이상, 취소된 설문조사만 삭제 가능) ==========
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

      // 설문조사 존재 확인
      const [surveys] = await pool.query('SELECT author_id, is_active FROM surveys WHERE survey_id = ?', [id]);
      if (surveys.length === 0) {
        return res.status(404).json({ success: false, message: '설문조사를 찾을 수 없습니다.' });
      }

      // 취소된 설문조사만 삭제 가능
      if (surveys[0].is_active) {
        return res.status(400).json({ 
          success: false, 
          message: '활성화된 설문조사는 삭제할 수 없습니다. 먼저 취소해주세요.' 
        });
      }

      // 작성자 또는 관리자 확인
      const isAuthor = surveys[0].author_id === req.user.user_id;
      const isAdmin = req.user.role === 'admin' || req.user.role === 'super-admin';
      if (!isAuthor && !isAdmin) {
        return res.status(403).json({ success: false, message: '삭제 권한이 없습니다.' });
      }

      await pool.query('DELETE FROM surveys WHERE survey_id = ?', [id]);

      res.json({ success: true, message: '설문조사가 삭제되었습니다.' });
    } catch (error) {
      console.error('설문조사 삭제 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ========== 설문조사 응답 제출 ==========
router.post('/:id/responses',
  [
    param('id').isInt(),
    body('answers').isArray()
  ],
  optionalAuth,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const { answers } = req.body;
      const pool = getPool();
      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        // 설문조사 확인 (모든 필드 포함)
        const [surveys] = await connection.query(`
          SELECT 
            is_active, is_anonymous, target_type,
            start_date, end_date, 
            end_condition_type, end_count, end_percentage
          FROM surveys 
          WHERE survey_id = ?
        `, [id]);

        if (surveys.length === 0) {
          await connection.rollback();
          connection.release();
          return res.status(404).json({ success: false, message: '설문조사를 찾을 수 없습니다.' });
        }

        const survey = surveys[0];

        // 대상 타입별 권한 체크
        if (survey.target_type === 'authenticated' || survey.target_type === 'authenticated_anonymous') {
          if (!req.user) {
            await connection.rollback();
            connection.release();
            return res.status(401).json({ success: false, message: '로그인이 필요한 설문조사입니다.' });
          }
        }

        // 활성화 확인
        if (!survey.is_active) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ success: false, message: '비활성화된 설문조사입니다.' });
        }

        // 종료 조건 확인
        const now = new Date();
        let isEnded = false;

        if (survey.end_condition_type === 'date') {
          // 기간 기반 종료
          if (survey.start_date && new Date(survey.start_date) > now) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ success: false, message: '아직 시작되지 않은 설문조사입니다.' });
          }
          if (survey.end_date && new Date(survey.end_date) < now) {
            isEnded = true;
          }
        } else if (survey.end_condition_type === 'count') {
          // 인원수 기반 종료
          const [responseCount] = await connection.query(`
            SELECT COUNT(*) as count 
            FROM survey_responses 
            WHERE survey_id = ?
          `, [id]);
          
          if (responseCount[0].count >= survey.end_count) {
            isEnded = true;
            // 설문조사 비활성화
            await connection.query(`
              UPDATE surveys SET is_active = FALSE WHERE survey_id = ?
            `, [id]);
          }
        } else if (survey.end_condition_type === 'percentage') {
          // 비율 기반 종료
          // 전체 가입자 수 조회
          const [totalUsers] = await connection.query(`
            SELECT COUNT(*) as total FROM users WHERE is_active = TRUE
          `);
          const totalUserCount = totalUsers[0].total;
          
          // 현재 응답 수 조회
          const [responseCount] = await connection.query(`
            SELECT COUNT(*) as count 
            FROM survey_responses 
            WHERE survey_id = ?
          `, [id]);
          
          const currentResponseCount = responseCount[0].count;
          const requiredCount = Math.ceil(totalUserCount * (survey.end_percentage / 100));
          
          if (currentResponseCount >= requiredCount) {
            isEnded = true;
            // 설문조사 비활성화
            await connection.query(`
              UPDATE surveys SET is_active = FALSE WHERE survey_id = ?
            `, [id]);
          }
        }

        if (isEnded) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ success: false, message: '이미 종료된 설문조사입니다.' });
        }

        // 중복 응답 확인
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        let userId = null;
        
        if (survey.target_type === 'authenticated' || survey.target_type === 'authenticated_anonymous') {
          // 인증된 사용자만 가능하므로 user_id로 확인
          userId = req.user.user_id;
        } else {
          // 누구나 가능한 경우
          userId = survey.is_anonymous ? null : (req.user ? req.user.user_id : null);
        }

        // 중복 체크 쿼리
        let duplicateCheckQuery = '';
        let duplicateCheckParams = [];
        
        if (userId) {
          // 로그인 사용자: user_id로 확인
          duplicateCheckQuery = `
            SELECT COUNT(*) as count 
            FROM survey_responses 
            WHERE survey_id = ? AND user_id = ?
          `;
          duplicateCheckParams = [id, userId];
        } else {
          // 비로그인 사용자: IP로 확인
          duplicateCheckQuery = `
            SELECT COUNT(*) as count 
            FROM survey_responses 
            WHERE survey_id = ? AND user_id IS NULL AND ip_address = ?
          `;
          duplicateCheckParams = [id, clientIp];
        }

        const [existingResponses] = await connection.query(duplicateCheckQuery, duplicateCheckParams);

        if (existingResponses[0].count > 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ success: false, message: '이미 응답한 설문조사입니다.' });
        }

        // 응답 저장 (익명 설문 처리)
        const responseUserId = (survey.target_type === 'authenticated_anonymous' || survey.is_anonymous) 
          ? null 
          : userId;
        
        const [responseResult] = await connection.query(`
          INSERT INTO survey_responses (survey_id, user_id, ip_address)
          VALUES (?, ?, ?)
        `, [id, responseUserId, clientIp]);

        const responseId = responseResult.insertId;

        // 답변 저장
        if (answers && answers.length > 0) {
          const answerValues = answers.map(answer => [
            responseId,
            answer.question_id,
            answer.answer_text || null,
            answer.answer_options ? JSON.stringify(answer.answer_options) : null,
            answer.rating_value || null
          ]);

          await connection.query(`
            INSERT INTO survey_answers (response_id, question_id, answer_text, answer_options, rating_value)
            VALUES ?
          `, [answerValues]);
        }

        await connection.commit();
        connection.release();

        // 응답 제출 후 종료 조건 재확인 (인원수/비율 기반)
        if (survey.end_condition_type === 'count' || survey.end_condition_type === 'percentage') {
          const checkConnection = await pool.getConnection();
          try {
            let shouldEnd = false;
            
            if (survey.end_condition_type === 'count') {
              const [responseCount] = await checkConnection.query(`
                SELECT COUNT(*) as count 
                FROM survey_responses 
                WHERE survey_id = ?
              `, [id]);
              
              if (responseCount[0].count >= survey.end_count) {
                shouldEnd = true;
              }
            } else if (survey.end_condition_type === 'percentage') {
              const [totalUsers] = await checkConnection.query(`
                SELECT COUNT(*) as total FROM users WHERE is_active = TRUE
              `);
              const totalUserCount = totalUsers[0].total;
              
              const [responseCount] = await checkConnection.query(`
                SELECT COUNT(*) as count 
                FROM survey_responses 
                WHERE survey_id = ?
              `, [id]);
              
              const currentResponseCount = responseCount[0].count;
              const requiredCount = Math.ceil(totalUserCount * (survey.end_percentage / 100));
              
              if (currentResponseCount >= requiredCount) {
                shouldEnd = true;
              }
            }
            
            if (shouldEnd) {
              await checkConnection.query(`
                UPDATE surveys SET is_active = FALSE WHERE survey_id = ?
              `, [id]);
            }
          } finally {
            checkConnection.release();
          }
        }

        res.status(201).json({
          success: true,
          message: '설문조사 응답이 제출되었습니다.'
        });
      } catch (error) {
        await connection.rollback();
        connection.release();
        throw error;
      }
    } catch (error) {
      console.error('설문조사 응답 제출 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ========== 설문조사 통계 조회 (관리자 이상) ==========
router.get('/:id/statistics',
  [param('id').isInt()],
  authenticate,
  authorize('admin', 'super-admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const pool = getPool();

      // 설문조사 정보
      const [surveys] = await pool.query('SELECT * FROM surveys WHERE survey_id = ?', [id]);
      if (surveys.length === 0) {
        return res.status(404).json({ success: false, message: '설문조사를 찾을 수 없습니다.' });
      }

      // 질문 목록
      const [questions] = await pool.query(`
        SELECT * FROM survey_questions 
        WHERE survey_id = ? 
        ORDER BY question_order ASC
      `, [id]);

      // 총 응답 수
      const [responseCount] = await pool.query(`
        SELECT COUNT(*) as total FROM survey_responses WHERE survey_id = ?
      `, [id]);

      // 질문별 통계
      const questionStats = await Promise.all(questions.map(async (question) => {
        if (question.question_type === 'single' || question.question_type === 'multiple') {
          // 선택형 질문 통계
          const [optionStats] = await pool.query(`
            SELECT 
              answer_text,
              COUNT(*) as count
            FROM survey_answers
            WHERE question_id = ? AND answer_text IS NOT NULL
            GROUP BY answer_text
            ORDER BY count DESC
          `, [question.question_id]);

          // 다중선택의 경우
          if (question.question_type === 'multiple') {
            const [multipleStats] = await pool.query(`
              SELECT 
                JSON_EXTRACT(answer_options, '$[*]') as options,
                COUNT(*) as count
              FROM survey_answers
              WHERE question_id = ? AND answer_options IS NOT NULL
            `, [question.question_id]);
            // 다중선택 통계 처리 (복잡하므로 간단히 처리)
          }

          return {
            question_id: question.question_id,
            question_text: question.question_text,
            question_type: question.question_type,
            option_statistics: optionStats
          };
        } else if (question.question_type === 'rating') {
          // 평점 통계
          const [ratingStats] = await pool.query(`
            SELECT 
              rating_value,
              COUNT(*) as count
            FROM survey_answers
            WHERE question_id = ? AND rating_value IS NOT NULL
            GROUP BY rating_value
            ORDER BY rating_value ASC
          `, [question.question_id]);

          const [avgRating] = await pool.query(`
            SELECT AVG(rating_value) as avg_rating
            FROM survey_answers
            WHERE question_id = ? AND rating_value IS NOT NULL
          `, [question.question_id]);

          return {
            question_id: question.question_id,
            question_text: question.question_text,
            question_type: question.question_type,
            rating_statistics: ratingStats,
            average_rating: avgRating[0].avg_rating || 0
          };
        } else {
          // 텍스트 답변 (전체 조회)
          const [textAnswers] = await pool.query(`
            SELECT answer_text
            FROM survey_answers
            WHERE question_id = ? AND answer_text IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 100
          `, [question.question_id]);

          return {
            question_id: question.question_id,
            question_text: question.question_text,
            question_type: question.question_type,
            text_answers: textAnswers
          };
        }
      }));

      res.json({
        success: true,
        data: {
          survey: surveys[0],
          total_responses: responseCount[0].total,
          question_statistics: questionStats
        }
      });
    } catch (error) {
      console.error('설문조사 통계 조회 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

module.exports = router;

