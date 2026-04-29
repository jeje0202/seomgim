// 게시판 API 라우터
const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const bcrypt = require('bcrypt');
const { body, validationResult, param, query } = require('express-validator');
const { optionalAuth } = require('../middleware/auth');
const fs = require('fs');
const { getThumbnailFilePathFromUrl, getBoardFilePathFromUrl } = require('../utils/filePathHelper');

// 카테고리별 권한 체크 미들웨어
const checkCategoryPermission = async (req, res, next) => {
  try {
    const pool = getPool();
    const categoryId = req.body.category_id || req.query.category_id || req.params.category_id;
    
    if (!categoryId) {
      return next(); // category_id가 없으면 다음으로
    }

    // 카테고리 정보 조회
    const [categories] = await pool.query(
      'SELECT category_code, is_private FROM board_categories WHERE category_id = ?',
      [categoryId]
    );

    if (categories.length === 0) {
      return res.status(404).json({ success: false, message: '카테고리를 찾을 수 없습니다.' });
    }

    const category = categories[0];
    req.category = category;

    // 공지사항 게시판 체크 (읽기는 누구나 가능, 작성/수정/삭제는 관리자 이상만 가능)
    if (category.category_code === 'notice') {
      // GET 요청(읽기)은 허용, POST/PUT/DELETE만 권한 체크
      if (req.method !== 'GET') {
        if (!req.user) {
          return res.status(401).json({ 
            success: false, 
            message: '공지사항 게시판은 관리자 권한 이상이 필요합니다.' 
          });
        }
        const roleHierarchy = {
          'user': 1,
          'manager': 2,
          'admin': 3,
          'super-admin': 4
        };
        const userRoleLevel = roleHierarchy[req.user.role] || 0;
        const requiredLevel = roleHierarchy['admin'] || 0;
        if (userRoleLevel < requiredLevel) {
          return res.status(403).json({ 
            success: false, 
            message: '공지사항 게시판은 관리자 권한 이상이 필요합니다.' 
          });
        }
      }
    }

    // 주보게시판 체크 (읽기는 누구나 가능, 작성/수정/삭제는 담당자 이상만 가능)
    if (category.category_code === 'bulletin') {
      // GET 요청(읽기)은 허용, POST/PUT/DELETE만 권한 체크
      if (req.method !== 'GET') {
        if (!req.user) {
          return res.status(401).json({ 
            success: false, 
            message: '주보게시판은 담당자 권한 이상이 필요합니다.' 
          });
        }
        const roleHierarchy = {
          'user': 1,
          'manager': 2,
          'admin': 3,
          'super-admin': 4,
          'super_admin': 4  // 하이픈 없는 형태도 지원
        };
        
        // role 값을 정규화 (대소문자 구분 없이, 하이픈/언더스코어 통일)
        const userRole = (req.user.role || '').toLowerCase().replace(/_/g, '-');
        const userRoleLevel = roleHierarchy[userRole] || 0;
        const requiredLevel = roleHierarchy['manager'] || 0;
        
        // 디버깅 로그
        console.log('주보게시판 권한 체크:', {
          originalRole: req.user.role,
          normalizedRole: userRole,
          userRoleLevel: userRoleLevel,
          requiredLevel: requiredLevel,
          userId: req.user.user_id,
          username: req.user.username,
          hasPermission: userRoleLevel >= requiredLevel
        });
        
        if (userRoleLevel < requiredLevel) {
          return res.status(403).json({ 
            success: false, 
            message: `주보게시판은 담당자 권한 이상이 필요합니다. (현재 권한: ${req.user.role || '없음'})` 
          });
        }
      }
    }

    // 성도전용 게시판 체크 (관리자 이상 또는 교인 등록 사용자만 접근 가능)
    if (category.is_private && category.category_code !== 'notice') {
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: '성도전용 게시판입니다. 로그인이 필요합니다.' 
        });
      }
      
      // 권한 계층 구조
      const roleHierarchy = {
        'user': 1,
        'manager': 2,
        'admin': 3,
        'super-admin': 4
      };
      const userRoleLevel = roleHierarchy[req.user.role] || 0;
      const isAdmin = userRoleLevel >= 3; // admin 또는 super-admin
      const isMember = req.user.is_member === true || req.user.is_member === 1; // 교인 등록 여부
      
      // 관리자 이상이거나 교인으로 등록된 사용자만 접근 가능
      if (!isAdmin && !isMember) {
        return res.status(403).json({ 
          success: false, 
          message: '성도전용 게시판입니다. 관리자 권한 이상이거나 교인으로 등록된 사용자만 이용할 수 있습니다.' 
        });
      }
    }

    next();
  } catch (error) {
    console.error('카테고리 권한 체크 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 공지사항 작성 권한 체크 (관리자 이상)
const checkNoticePermission = (req, res, next) => {
  if (req.body.is_notice === true || req.body.is_notice === 1) {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: '공지사항 작성은 로그인이 필요합니다.' 
      });
    }

    const roleHierarchy = {
      'user': 1,
      'manager': 2,
      'admin': 3,
      'super-admin': 4
    };

    const userRoleLevel = roleHierarchy[req.user.role] || 0;
    const requiredLevel = roleHierarchy['admin'] || 0;

    if (userRoleLevel < requiredLevel) {
      return res.status(403).json({ 
        success: false, 
        message: '공지사항 작성은 관리자 권한 이상이 필요합니다.' 
      });
    }
  }
  next();
};

// ========== 게시판 카테고리 API ==========

// 모든 게시판 카테고리 조회 (글 수만 포함, 읽지 않은 글 수는 제거됨)
router.get('/categories',
  optionalAuth,
  async (req, res) => {
    try {
      const pool = getPool();
      
      // 각 게시판의 총 글 수 조회
      const [categories] = await pool.query(
        `SELECT 
          c.*,
          COUNT(DISTINCT p.post_id) as post_count
        FROM board_categories c
        LEFT JOIN board_posts p ON c.category_id = p.category_id AND p.is_deleted = FALSE
        WHERE c.is_active = TRUE
        GROUP BY c.category_id
        ORDER BY c.display_order`
      );
      
      // 읽지 않은 글 수 계산 제거 (말풍선 기능 제거됨)
      const result = categories.map((cat) => {
        return {
          ...cat,
          post_count: parseInt(cat.post_count) || 0
        };
      });
      
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('카테고리 조회 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ========== 게시글 API ==========

// 게시글 목록 조회 (페이징) - 자유게시판은 로그인 없이 가능
router.get('/posts',
  [
    query('category_id').optional().isInt(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('tag').optional().isString() // 태그 필터링 파라미터 추가
  ],
  optionalAuth,
  checkCategoryPermission,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { category_id, page = 1, limit = 20, tag } = req.query;
      const offset = (page - 1) * limit;

      // 태그 필터링: 배열 또는 쉼표로 구분된 문자열 처리
      let tags = [];
      if (tag) {
        if (Array.isArray(tag)) {
          tags = tag;
        } else if (typeof tag === 'string') {
          tags = tag.split(',').map(t => t.trim()).filter(t => t.length > 0);
        }
      }

      let query = `
        SELECT DISTINCT
          p.post_id, p.category_id, p.title, p.author_name, 
          p.view_count, p.is_notice, p.created_at, p.image_url,
          c.category_name, c.category_code, c.is_private,
          (SELECT COUNT(*) FROM board_comments WHERE post_id = p.post_id AND is_deleted = FALSE) as comment_count,
          (SELECT COUNT(*) FROM post_reactions WHERE post_id = p.post_id) as reaction_count
        FROM board_posts p
        JOIN board_categories c ON p.category_id = c.category_id
      `;
      
      // 태그 필터링이 있는 경우 post_tags 테이블과 JOIN
      if (tags.length > 0) {
        query += ` INNER JOIN post_tags pt ON p.post_id = pt.post_id AND pt.tag_name IN (${tags.map(() => '?').join(',')})`;
      }
      
      query += ` WHERE p.is_deleted = FALSE`;
      const params = [];

      // 태그 파라미터 추가
      if (tags.length > 0) {
        params.push(...tags);
      }

      // 성도전용 게시판 필터링 (로그인하지 않은 사용자는 볼 수 없음)
      if (!req.user) {
        query += ' AND c.is_private = FALSE';
      }

      if (category_id) {
        query += ' AND p.category_id = ?';
        params.push(category_id);
      }

      query += ' ORDER BY p.is_notice DESC, p.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const pool = getPool();
      const [posts] = await pool.query(query, params);

      // 각 게시글의 이모티콘 반응 정보 및 태그 조회
      const postsWithReactions = await Promise.all(posts.map(async (post) => {
        // 타입별 반응 개수 조회
        const [reactionCounts] = await pool.query(`
          SELECT 
            reaction_type,
            COUNT(*) as count
          FROM post_reactions
          WHERE post_id = ?
          GROUP BY reaction_type
        `, [post.post_id]);

        // 반응 개수를 객체로 변환
        const reactions = {
          like: 0,
          love: 0,
          haha: 0,
          wow: 0,
          sad: 0
        };
        reactionCounts.forEach(row => {
          reactions[row.reaction_type] = parseInt(row.count);
        });
        
        // 태그 조회 (기관게시판 및 성도게시판인 경우)
        let tags = [];
        if (post.category_code === 'organization' || post.category_code === 'member') {
          const [postTags] = await pool.query(`
            SELECT tag_name
            FROM post_tags
            WHERE post_id = ?
            ORDER BY created_at ASC
          `, [post.post_id]);
          tags = postTags.map(t => t.tag_name);
        }

        return {
          ...post,
          reactions,
          tags
        };
      }));

      // 전체 게시글 수 조회
      let countQuery = `
        SELECT COUNT(DISTINCT p.post_id) as total 
        FROM board_posts p
        JOIN board_categories c ON p.category_id = c.category_id
      `;
      
      // 태그 필터링이 있는 경우 post_tags 테이블과 JOIN
      if (tags.length > 0) {
        countQuery += ` INNER JOIN post_tags pt ON p.post_id = pt.post_id AND pt.tag_name IN (${tags.map(() => '?').join(',')})`;
      }
      
      countQuery += ` WHERE p.is_deleted = FALSE`;
      const countParams = [];
      
      // 태그 파라미터 추가
      if (tags.length > 0) {
        countParams.push(...tags);
      }
      
      // 성도전용 게시판 필터링
      if (!req.user) {
        countQuery += ' AND c.is_private = FALSE';
      }
      
      if (category_id) {
        countQuery += ' AND p.category_id = ?';
        countParams.push(category_id);
      }
      const [countResult] = await pool.query(countQuery, countParams);

      res.json({
        success: true,
        data: {
          posts: postsWithReactions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult[0].total,
            totalPages: Math.ceil(countResult[0].total / limit)
          }
        }
      });
    } catch (error) {
      console.error('게시글 목록 조회 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 게시글 상세 조회
router.get('/posts/:id',
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
      
      // 사용자 ID (로그인한 경우)
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
      console.log(`[게시글 조회] post_id: ${id}, user_id: ${userId || 'NULL'}, ip: ${clientIp}`);
      
      // 조회 기록 확인 (중복 조회 방지)
      // 같은 IP에서 다른 사용자가 로그인했을 때도 조회수가 증가하도록 user_id를 기준으로만 체크
      let existingViews;
      if (userId) {
        // 로그인 사용자: user_id만으로 중복 체크 (같은 사용자가 같은 게시글을 여러 번 조회하는 것만 방지)
        // 같은 IP에서 다른 사용자가 로그인했을 때는 조회수가 증가해야 함
        // user_id가 다르면 다른 사용자로 간주하여 조회수 증가
        [existingViews] = await pool.query(
          'SELECT view_id FROM post_views WHERE post_id = ? AND user_id = ?',
          [id, userId]
        );
        console.log(`[게시글 조회] 로그인 사용자 중복 체크 - post_id: ${id}, user_id: ${userId}, 기존 조회 기록: ${existingViews.length}개`);
      } else {
        // 비로그인 사용자: ip_address만으로 중복 체크
        [existingViews] = await pool.query(
          'SELECT view_id FROM post_views WHERE post_id = ? AND user_id IS NULL AND ip_address = ?',
          [id, clientIp]
        );
        console.log(`[게시글 조회] 비로그인 사용자 중복 체크 - post_id: ${id}, ip: ${clientIp}, 기존 조회 기록: ${existingViews.length}개`);
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
              'UPDATE board_posts SET view_count = view_count + 1 WHERE post_id = ? AND is_deleted = FALSE',
              [id]
            );
            
            // 조회 기록 저장
            await connection.query(
              'INSERT INTO post_views (post_id, user_id, ip_address) VALUES (?, ?, ?)',
              [id, userId, clientIp]
            );
            
            await connection.commit();
            console.log(`[게시글 조회] ✅ 조회수 증가 및 기록 저장 성공 - post_id: ${id}, user_id: ${userId || 'NULL'}, ip: ${clientIp}`);
          } catch (insertError) {
            await connection.rollback();
            // UNIQUE KEY 제약 조건 위반 시 (동시 요청 등으로 인한 중복) 조용히 무시
            if (insertError.code === 'ER_DUP_ENTRY') {
              console.log(`[게시글 조회] 중복 조회 기록 무시 (동시 요청) - post_id: ${id}, user_id: ${userId || 'NULL'}, ip: ${clientIp}`);
            } else {
              console.error('[게시글 조회] 조회 기록 저장 오류:', insertError);
              throw insertError;
            }
          } finally {
            connection.release();
          }
        } catch (error) {
          console.error('[게시글 조회] 조회수 증가 오류:', error);
          // 조회수 증가 실패해도 게시글은 조회 가능하도록 계속 진행
        }
      } else {
        console.log(`[게시글 조회] 중복 조회로 인한 조회수 증가 건너뜀 - post_id: ${id}, user_id: ${userId || 'NULL'}, ip: ${clientIp}`);
      }

      // 게시글 조회
      const [posts] = await pool.query(`
        SELECT 
          p.*, c.category_name, c.category_code, c.is_private
        FROM board_posts p
        JOIN board_categories c ON p.category_id = c.category_id
        WHERE p.post_id = ? AND p.is_deleted = FALSE
      `, [id]);

      if (posts.length === 0) {
        return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
      }

      // 댓글 조회
      const [comments] = await pool.query(`
        SELECT comment_id, content, author_name, created_at
        FROM board_comments
        WHERE post_id = ? AND is_deleted = FALSE
        ORDER BY created_at ASC
      `, [id]);
      
      // 태그 조회 (기관게시판 및 성도게시판인 경우)
      const [tags] = await pool.query(`
        SELECT tag_name
        FROM post_tags
        WHERE post_id = ?
        ORDER BY created_at ASC
      `, [id]);

      // 이모티콘 반응 조회 (타입별 개수 및 사용자가 누른 반응)
      // 타입별 반응 개수 조회
      const [reactionCounts] = await pool.query(`
        SELECT 
          reaction_type,
          COUNT(*) as count
        FROM post_reactions
        WHERE post_id = ?
        GROUP BY reaction_type
      `, [id]);

      // 사용자가 누른 반응 조회
      let userReaction = null;
      if (userId) {
        const [userReactions] = await pool.query(`
          SELECT reaction_type
          FROM post_reactions
          WHERE post_id = ? AND user_id = ?
          LIMIT 1
        `, [id, userId]);
        if (userReactions.length > 0) {
          userReaction = userReactions[0].reaction_type;
        }
      } else {
        const [ipReactions] = await pool.query(`
          SELECT reaction_type
          FROM post_reactions
          WHERE post_id = ? AND ip_address = ? AND user_id IS NULL
          LIMIT 1
        `, [id, clientIp]);
        if (ipReactions.length > 0) {
          userReaction = ipReactions[0].reaction_type;
        }
      }

      // 반응 개수를 객체로 변환
      const reactions = {
        like: 0,
        love: 0,
        haha: 0,
        wow: 0,
        sad: 0
      };
      reactionCounts.forEach(row => {
        reactions[row.reaction_type] = parseInt(row.count);
      });

      res.json({
        success: true,
        data: {
          post: posts[0],
          comments,
          reactions,
          userReaction, // 사용자가 누른 반응 (없으면 null)
          tags: tags.map(t => t.tag_name) // 태그 배열
        }
      });
    } catch (error) {
      console.error('게시글 상세 조회 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 게시글 작성 - 권한 체크 필요
router.post('/posts',
  [
    body('category_id').isInt(),
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('content').trim().isLength({ min: 1 }),
    body('author_name').trim().isLength({ min: 1, max: 50 }),
    body('author_password').isLength({ min: 4 }),
    body('is_notice').optional().isBoolean()
  ],
  optionalAuth,
  checkCategoryPermission,
  checkNoticePermission,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { category_id, title, content, author_name, author_password, is_notice = false, image_url, tags } = req.body;

      // 비밀번호 해시화
      const hashedPassword = await bcrypt.hash(author_password, 10);

      const pool = getPool();
      
      // 트랜잭션 시작
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        // 게시글 작성
        const [result] = await connection.query(`
          INSERT INTO board_posts (category_id, title, content, author_name, author_password, is_notice, image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [category_id, title, content, author_name, hashedPassword, is_notice, image_url || null]);
        
        const postId = result.insertId;
        
        // 기관게시판 및 성도게시판인 경우 태그 저장
        const [categoryInfo] = await connection.query(
          'SELECT category_code FROM board_categories WHERE category_id = ?',
          [category_id]
        );
        
        // 기관게시판 및 성도게시판인 경우 태그 처리
        if (categoryInfo.length > 0 && (categoryInfo[0].category_code === 'organization' || categoryInfo[0].category_code === 'member') && tags !== undefined) {
          // 기존 태그 삭제
          await connection.query('DELETE FROM post_tags WHERE post_id = ?', [postId]);
          
          // 새 태그 추가 (태그 배열이 있고 길이가 0보다 큰 경우만)
          if (Array.isArray(tags) && tags.length > 0) {
          for (const tagName of tags) {
            if (tagName && tagName.trim()) {
              try {
                await connection.query(
                  'INSERT INTO post_tags (post_id, tag_name) VALUES (?, ?)',
                  [postId, tagName.trim()]
                );
              } catch (tagError) {
                // 중복 태그는 무시
                if (tagError.code !== 'ER_DUP_ENTRY') {
                  throw tagError;
                  }
                }
              }
            }
          }
        }
        
        await connection.commit();
        
        res.status(201).json({
          success: true,
          data: { post_id: postId },
          message: '게시글이 작성되었습니다.'
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('게시글 작성 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 게시글 수정 - 권한 체크 필요
router.put('/posts/:id',
  [
    param('id').isInt(),
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('content').trim().isLength({ min: 1 }),
    body('author_password').isLength({ min: 4 })
  ],
  optionalAuth,
  checkNoticePermission,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const { title, content, author_password, is_notice, image_url, tags } = req.body;

      const pool = getPool();
      
      // 트랜잭션 시작
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        // 게시글 조회 (카테고리 정보 포함)
        const [posts] = await connection.query(`
          SELECT p.author_password, c.category_code
          FROM board_posts p
          JOIN board_categories c ON p.category_id = c.category_id
          WHERE p.post_id = ? AND p.is_deleted = FALSE
        `, [id]);

        if (posts.length === 0) {
          await connection.rollback();
          return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
        }

        // 비밀번호 확인
        const isPasswordValid = await bcrypt.compare(author_password, posts[0].author_password);
        if (!isPasswordValid) {
          await connection.rollback();
          return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
        }

        // 게시글 수정 (image_url과 is_notice도 업데이트)
        const updateFields = ['title = ?', 'content = ?'];
        const updateValues = [title, content];
        
        if (image_url !== undefined) {
          updateFields.push('image_url = ?');
          updateValues.push(image_url || null);
        }
        
        if (is_notice !== undefined) {
          updateFields.push('is_notice = ?');
          updateValues.push(is_notice);
        }
        
        updateValues.push(id);
        
        await connection.query(
          `UPDATE board_posts SET ${updateFields.join(', ')} WHERE post_id = ?`,
          updateValues
        );
        
        // 기관게시판 및 성도게시판인 경우 태그 업데이트
        if ((posts[0].category_code === 'organization' || posts[0].category_code === 'member') && tags !== undefined) {
          // 기존 태그 삭제
          await connection.query('DELETE FROM post_tags WHERE post_id = ?', [id]);
          
          // 새 태그 추가 (태그 배열이 있는 경우만)
          if (Array.isArray(tags) && tags.length > 0) {
            for (const tagName of tags) {
              if (tagName && tagName.trim()) {
                try {
                  await connection.query(
                    'INSERT INTO post_tags (post_id, tag_name) VALUES (?, ?)',
                    [id, tagName.trim()]
                  );
                } catch (tagError) {
                  // 중복 태그는 무시
                  if (tagError.code !== 'ER_DUP_ENTRY') {
                    throw tagError;
                  }
                }
              }
            }
          }
        }
        
        await connection.commit();
        res.json({ success: true, message: '게시글이 수정되었습니다.' });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('게시글 수정 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 게시글 삭제 (soft delete)
router.delete('/posts/:id',
  [
    param('id').isInt(),
    body('author_password').optional().isLength({ min: 4 }) // 관리자일 때는 선택사항
  ],
  optionalAuth, // 인증 정보 확인 (관리자 체크용)
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const { author_password } = req.body;

      const pool = getPool();
      // 게시글 조회 (작성자 이름, 이미지 URL 포함)
      const [posts] = await pool.query(
        'SELECT author_name, author_password, image_url FROM board_posts WHERE post_id = ? AND is_deleted = FALSE',
        [id]
      );

      if (posts.length === 0) {
        return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
      }

      // 관리자 권한 체크 (admin 또는 super-admin)
      const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super-admin');
      
      // 관리자가 아니면 작성자 본인 확인 및 비밀번호 확인 필요
      if (!isAdmin) {
        // 로그인 확인
        if (!req.user) {
          return res.status(401).json({ 
            success: false, 
            message: '게시글 삭제를 위해서는 로그인이 필요합니다.' 
          });
        }

        // 작성자 본인 확인 (로그인한 사용자의 이름과 게시글 작성자 이름 비교)
        if (req.user.name !== posts[0].author_name) {
          return res.status(403).json({ 
            success: false, 
            message: '본인이 작성한 게시글만 삭제할 수 있습니다.' 
          });
        }

        // 비밀번호 필수
        if (!author_password) {
          return res.status(400).json({ success: false, message: '비밀번호를 입력해주세요.' });
        }
        
        // 비밀번호 확인
        const isPasswordValid = await bcrypt.compare(author_password, posts[0].author_password);
        if (!isPasswordValid) {
          return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
        }
      }
      // 관리자는 비밀번호 없이 삭제 가능

      // 첨부된 이미지 파일 삭제
      const post = posts[0];
      if (post.image_url) {
        try {
          let imageUrls = [];
          
          // image_url이 JSON 배열인지 확인
          try {
            const parsed = JSON.parse(post.image_url);
            if (Array.isArray(parsed)) {
              imageUrls = parsed;
            } else if (typeof parsed === 'string') {
              imageUrls = [parsed];
            }
          } catch (e) {
            // JSON이 아니면 단일 이미지 URL로 처리
            imageUrls = [post.image_url];
          }
          
          // 각 이미지 파일 삭제
          imageUrls.forEach((imageUrl) => {
            if (!imageUrl) return;
            
            try {
              let filePath = null;
              
              // 게시판 이미지 경로인지 확인
              if (imageUrl.startsWith('/uploads/board/')) {
                filePath = getBoardFilePathFromUrl(imageUrl);
              } else if (imageUrl.startsWith('/uploads/thumbnail/')) {
                // 썸네일 경로
                filePath = getThumbnailFilePathFromUrl(imageUrl);
              } else if (imageUrl.startsWith('/uploads/')) {
                // 기존 경로 형식 (하위 호환성)
                filePath = getBoardFilePathFromUrl(imageUrl);
              }
              
              if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`[게시글 삭제] ✅ 이미지 파일 삭제 성공: ${filePath}`);
              } else if (filePath) {
                console.warn(`[게시글 삭제] ⚠️ 이미지 파일을 찾을 수 없습니다: ${filePath}`);
              }
            } catch (fileError) {
              console.error(`[게시글 삭제] ❌ 이미지 파일 삭제 실패: ${imageUrl}`, fileError);
              // 파일 삭제 실패해도 게시글 삭제는 계속 진행
            }
          });
        } catch (error) {
          console.error('[게시글 삭제] 이미지 파일 삭제 중 오류:', error);
          // 이미지 삭제 실패해도 게시글 삭제는 계속 진행
        }
      }

      // 게시글 삭제 (soft delete)
      await pool.query('UPDATE board_posts SET is_deleted = TRUE WHERE post_id = ?', [id]);

      res.json({ success: true, message: '게시글이 삭제되었습니다.' });
    } catch (error) {
      console.error('게시글 삭제 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ========== 댓글 API ==========

// 댓글 작성 - 권한 체크 필요
router.post('/comments',
  [
    body('post_id').isInt(),
    body('content').trim().isLength({ min: 1 }),
    body('author_name').trim().isLength({ min: 1, max: 50 }),
    body('author_password').isLength({ min: 4 })
  ],
  optionalAuth,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { post_id, content, author_name, author_password } = req.body;

      const pool = getPool();
      
      // 게시글의 카테고리 확인 (성도전용 게시판 체크)
      const [posts] = await pool.query(`
        SELECT c.is_private 
        FROM board_posts p
        JOIN board_categories c ON p.category_id = c.category_id
        WHERE p.post_id = ? AND p.is_deleted = FALSE
      `, [post_id]);

      if (posts.length === 0) {
        return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
      }

      // 성도전용 게시판 체크
      if (posts[0].is_private && (!req.user || req.user.role === 'user')) {
        return res.status(403).json({ 
          success: false, 
          message: '성도전용 게시판입니다. 로그인이 필요합니다.' 
        });
      }

      // 비밀번호 해시화
      const hashedPassword = await bcrypt.hash(author_password, 10);

      const [result] = await pool.query(`
        INSERT INTO board_comments (post_id, content, author_name, author_password)
        VALUES (?, ?, ?, ?)
      `, [post_id, content, author_name, hashedPassword]);

      res.status(201).json({
        success: true,
        data: { comment_id: result.insertId },
        message: '댓글이 작성되었습니다.'
      });
    } catch (error) {
      console.error('댓글 작성 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 댓글 삭제
router.delete('/comments/:id',
  [
    param('id').isInt(),
    body('author_password').isLength({ min: 4 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const { author_password } = req.body;

      const pool = getPool();
      // 댓글 조회
      const [comments] = await pool.query(
        'SELECT author_password FROM board_comments WHERE comment_id = ? AND is_deleted = FALSE',
        [id]
      );

      if (comments.length === 0) {
        return res.status(404).json({ success: false, message: '댓글을 찾을 수 없습니다.' });
      }

      // 비밀번호 확인
      const isPasswordValid = await bcrypt.compare(author_password, comments[0].author_password);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
      }

      // 댓글 삭제 (soft delete)
      await pool.query('UPDATE board_comments SET is_deleted = TRUE WHERE comment_id = ?', [id]);

      res.json({ success: true, message: '댓글이 삭제되었습니다.' });
    } catch (error) {
      console.error('댓글 삭제 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ========== 게시글 이모티콘 반응 API ==========

// 게시글 이모티콘 반응 추가/제거 (토글)
router.post('/posts/:id/reactions',
  [
    param('id').isInt(),
    body('reaction_type').isIn(['like', 'love', 'haha', 'wow', 'sad'])
  ],
  optionalAuth,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const { reaction_type } = req.body;
      const userId = req.user ? req.user.user_id : null;
      
      // IP 주소 가져오기
      let clientIp = req.ip || 
                     (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) ||
                     req.headers['x-real-ip'] ||
                     req.connection?.remoteAddress ||
                     req.socket?.remoteAddress ||
                     'unknown';
      
      if (clientIp && clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.substring(7);
      }

      const pool = getPool();
      
      // 게시글 존재 확인
      const [posts] = await pool.query(
        'SELECT post_id FROM board_posts WHERE post_id = ? AND is_deleted = FALSE',
        [id]
      );

      if (posts.length === 0) {
        return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
      }

      // 기존 반응 확인
      // 로그인 사용자는 user_id만으로 체크 (같은 IP에서 다른 사용자가 같은 이모티콘을 누를 수 있도록)
      // 비로그인 사용자는 ip_address로 체크
      let existingReaction = null;
      if (userId) {
        // 로그인 사용자: user_id만으로 중복 체크 (같은 IP에서 다른 사용자가 같은 이모티콘을 누를 수 있도록)
        const [existing] = await pool.query(
          'SELECT reaction_id, reaction_type FROM post_reactions WHERE post_id = ? AND user_id = ?',
          [id, userId]
        );
        if (existing.length > 0) {
          existingReaction = existing[0];
        }
      } else {
        // 비로그인 사용자: ip_address만으로 중복 체크
        const [existing] = await pool.query(
          'SELECT reaction_id, reaction_type FROM post_reactions WHERE post_id = ? AND ip_address = ? AND user_id IS NULL',
          [id, clientIp]
        );
        if (existing.length > 0) {
          existingReaction = existing[0];
        }
      }

      // 트랜잭션 시작
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        if (existingReaction) {
          // 기존 반응이 있는 경우
          if (existingReaction.reaction_type === reaction_type) {
            // 같은 반응을 다시 누르면 제거 (토글)
            await connection.query(
              'DELETE FROM post_reactions WHERE reaction_id = ?',
              [existingReaction.reaction_id]
            );
            await connection.commit();
            console.log(`[이모티콘 반응] 제거 - post_id: ${id}, user_id: ${userId || 'NULL'}, reaction_type: ${reaction_type}`);
            return res.json({
              success: true,
              action: 'removed',
              message: '반응이 제거되었습니다.'
            });
          } else {
            // 다른 반응으로 변경
            await connection.query(
              'UPDATE post_reactions SET reaction_type = ? WHERE reaction_id = ?',
              [reaction_type, existingReaction.reaction_id]
            );
            await connection.commit();
            console.log(`[이모티콘 반응] 변경 - post_id: ${id}, user_id: ${userId || 'NULL'}, reaction_type: ${reaction_type}`);
            return res.json({
              success: true,
              action: 'changed',
              message: '반응이 변경되었습니다.'
            });
          }
        } else {
          // 새로운 반응 추가
          // 로그인 사용자의 경우 ip_address를 NULL로 설정하여 unique_post_ip_reaction 제약 조건 회피
          // (같은 IP에서 다른 사용자가 같은 이모티콘을 누를 수 있도록)
          const insertIpAddress = userId ? null : clientIp;
          await connection.query(
            'INSERT INTO post_reactions (post_id, user_id, ip_address, reaction_type) VALUES (?, ?, ?, ?)',
            [id, userId, insertIpAddress, reaction_type]
          );
          await connection.commit();
          console.log(`[이모티콘 반응] 추가 - post_id: ${id}, user_id: ${userId || 'NULL'}, ip: ${insertIpAddress || 'NULL'}, reaction_type: ${reaction_type}`);
          return res.json({
            success: true,
            action: 'added',
            message: '반응이 추가되었습니다.'
          });
        }
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('이모티콘 반응 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ========== 태그 관리 API (기관게시판용) ==========

// 태그 목록 조회
router.get('/tags', optionalAuth, async (req, res) => {
  try {
    const pool = getPool();
    const { category_code } = req.query; // 게시판 코드 (member 또는 organization)
    
    // 게시판별 태그 개수를 계산하기 위한 조건 추가
    let categoryCondition = '';
    if (category_code === 'member' || category_code === 'organization') {
      categoryCondition = `AND p.category_id = (SELECT category_id FROM board_categories WHERE category_code = ? AND is_active = TRUE LIMIT 1)`;
    }
    
      // 태그 목록과 각 태그를 사용한 게시글 개수를 함께 조회
      // 정렬은 프론트엔드에서 처리하므로 서버에서는 정렬하지 않음
      const query = `
        SELECT 
          ot.tag_id, 
          ot.tag_name, 
          ot.tag_color, 
          ot.display_order, 
          ot.created_at, 
          ot.updated_at,
          COUNT(DISTINCT pt.post_id) as post_count
        FROM organization_tags ot
        LEFT JOIN post_tags pt ON ot.tag_name = pt.tag_name
        LEFT JOIN board_posts p ON pt.post_id = p.post_id AND p.is_deleted = FALSE ${categoryCondition || ''}
        GROUP BY ot.tag_id, ot.tag_name, ot.tag_color, ot.display_order, ot.created_at, ot.updated_at
      `;
    
    const params = category_code === 'member' || category_code === 'organization' ? [category_code] : [];
    const [tags] = await pool.query(query, params);
    
    // post_count를 숫자로 변환
    const tagsWithCount = tags.map(tag => ({
      ...tag,
      post_count: parseInt(tag.post_count) || 0
    }));
    
    res.json({
      success: true,
      data: tagsWithCount
    });
  } catch (error) {
    console.error('태그 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 태그 생성 (관리자 이상 권한 필요)
router.post('/tags',
  [
    body('tag_name').trim().isLength({ min: 1, max: 50 }),
    body('tag_color').optional().isLength({ max: 20 })
  ],
  optionalAuth,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      
      // 권한 체크 (admin 이상)
      if (!req.user || !['admin', 'super-admin'].includes(req.user.role)) {
        return res.status(403).json({ 
          success: false, 
          message: '태그 관리는 관리자 권한 이상이 필요합니다.' 
        });
      }
      
      const { tag_name, tag_color = '#3b82f6', display_order = 0 } = req.body;
      
      const pool = getPool();
      const [result] = await pool.query(`
        INSERT INTO organization_tags (tag_name, tag_color, display_order)
        VALUES (?, ?, ?)
      `, [tag_name.trim(), tag_color, display_order]);
      
      res.status(201).json({
        success: true,
        data: { tag_id: result.insertId },
        message: '태그가 생성되었습니다.'
      });
    } catch (error) {
      console.error('태그 생성 오류:', error);
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(400).json({ success: false, message: '이미 존재하는 태그 이름입니다.' });
      } else {
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
      }
    }
  }
);

// 태그 수정 (관리자 이상 권한 필요)
router.put('/tags/:id',
  [
    param('id').isInt(),
    body('tag_name').optional().trim().isLength({ min: 1, max: 50 }),
    body('tag_color').optional().isLength({ max: 20 }),
    body('display_order').optional().isInt()
  ],
  optionalAuth,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      
      // 권한 체크 (admin 이상)
      if (!req.user || !['admin', 'super-admin'].includes(req.user.role)) {
        return res.status(403).json({ 
          success: false, 
          message: '태그 관리는 관리자 권한 이상이 필요합니다.' 
        });
      }
      
      const { id } = req.params;
      const { tag_name, tag_color, display_order } = req.body;
      
      const pool = getPool();
      
      // 업데이트 필드 구성
      const updateFields = [];
      const updateValues = [];
      
      if (tag_name !== undefined) {
        updateFields.push('tag_name = ?');
        updateValues.push(tag_name.trim());
      }
      if (tag_color !== undefined) {
        updateFields.push('tag_color = ?');
        updateValues.push(tag_color);
      }
      if (display_order !== undefined) {
        updateFields.push('display_order = ?');
        updateValues.push(display_order);
      }
      
      if (updateFields.length === 0) {
        return res.status(400).json({ success: false, message: '수정할 내용이 없습니다.' });
      }
      
      updateValues.push(id);
      
      await pool.query(
        `UPDATE organization_tags SET ${updateFields.join(', ')} WHERE tag_id = ?`,
        updateValues
      );
      
      res.json({ success: true, message: '태그가 수정되었습니다.' });
    } catch (error) {
      console.error('태그 수정 오류:', error);
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(400).json({ success: false, message: '이미 존재하는 태그 이름입니다.' });
      } else {
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
      }
    }
  }
);

// 태그 삭제 (관리자 이상 권한 필요)
router.delete('/tags/:id',
  [param('id').isInt()],
  optionalAuth,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      
      // 권한 체크 (admin 이상)
      if (!req.user || !['admin', 'super-admin'].includes(req.user.role)) {
        return res.status(403).json({ 
          success: false, 
          message: '태그 관리는 관리자 권한 이상이 필요합니다.' 
        });
      }
      
      const { id } = req.params;
      
      const pool = getPool();
      await pool.query('DELETE FROM organization_tags WHERE tag_id = ?', [id]);
      
      res.json({ success: true, message: '태그가 삭제되었습니다.' });
    } catch (error) {
      console.error('태그 삭제 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

module.exports = router;

