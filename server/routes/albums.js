// 사진첩 앨범 API 라우터
const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { body, validationResult, query, param } = require('express-validator');
const { authenticate, optionalAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 파일 저장 유틸리티 import
const { getAlbumStoragePath, getThumbnailStoragePath, getAlbumImageUrl, getThumbnailUrl } = require('../utils/fileStorage');
const { getAlbumFilePathFromUrl, getThumbnailFilePathFromUrl } = require('../utils/filePathHelper');

// data/album 디렉토리 생성 (없는 경우)
const albumDir = path.join(__dirname, '../../data/album');
if (!fs.existsSync(albumDir)) {
  fs.mkdirSync(albumDir, { recursive: true });
}

// 썸네일 디렉토리 생성 (없는 경우)
const thumbnailBaseDir = path.join(__dirname, '../../data/thumbnail');
if (!fs.existsSync(thumbnailBaseDir)) {
  fs.mkdirSync(thumbnailBaseDir, { recursive: true });
}

// multer 설정 (필드명에 따라 다른 저장 경로 사용)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 필드명에 따라 다른 저장 경로 결정
    if (file.fieldname === 'fullImages') {
      // 앨범 이미지: 500개마다 폴더 분리
      const storagePath = getAlbumStoragePath();
      // 저장 경로를 req에 저장 (나중에 URL 생성 시 사용)
      if (!req.albumStoragePath) req.albumStoragePath = storagePath;
      cb(null, storagePath);
    } else if (file.fieldname === 'thumbnails') {
      // 썸네일: 년월별 폴더
      const storagePath = getThumbnailStoragePath();
      // 저장 경로를 req에 저장
      if (!req.thumbnailStoragePath) req.thumbnailStoragePath = storagePath;
      cb(null, storagePath);
    } else {
      // 기본: 앨범 폴더
      const storagePath = getAlbumStoragePath();
      cb(null, storagePath);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();

    if (file.fieldname === 'thumbnails') {
      cb(null, `thumb-${uniqueSuffix}${ext}`);
    } else {
      cb(null, `album-${uniqueSuffix}${ext}`);
    }
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  // 디버깅: 파일 정보 로그
  console.log('[파일 필터] 파일 정보:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    extname: path.extname(file.originalname).toLowerCase(),
    extnameTest: extname,
    mimetypeTest: mimetype
  });

  // mimetype이 없거나 잘못된 경우 확장자로 판단
  if (extname) {
    return cb(null, true);
  } else if (mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('이미지 파일만 업로드 가능합니다. (jpg, png, gif, webp)'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB 제한 (안전 마진 포함)
    files: 40 // 전체 파일 개수 제한 (fullImages + thumbnails = 최대 40개)
  },
  fileFilter: fileFilter
});

// ========== 앨범 API ==========

// 중요: 특정 경로 라우터를 /:id 라우터보다 먼저 정의해야 함

// 사진 업로드 (로그인 필수) - 썸네일과 원본 이미지 모두 받기
// 필드명: 'fullImages' (1080p 이미지), 'thumbnails' (썸네일)
router.post('/upload',
  authenticate,
  (req, res, next) => {
    // multer 에러 핸들러
    upload.fields([
      { name: 'fullImages', maxCount: 20 },
      { name: 'thumbnails', maxCount: 20 }
    ])(req, res, (err) => {
      if (err) {
        console.error('[사진 업로드] Multer 에러:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: '파일 크기가 너무 큽니다. (최대 2MB)'
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: '파일 개수가 너무 많습니다. (최대 20개)'
          });
        }
        return res.status(400).json({
          success: false,
          message: `파일 업로드 오류: ${err.message || '알 수 없는 오류'}`
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      console.log('[사진 업로드] 요청 받음');
      console.log('[사진 업로드] req.files:', JSON.stringify(req.files, null, 2));
      console.log('[사진 업로드] req.files 타입:', typeof req.files);

      // multer의 fields는 객체 형태로 반환: { fullImages: [...], thumbnails: [...] }
      const fullImages = (req.files && req.files['fullImages']) ? req.files['fullImages'] : [];
      const thumbnails = (req.files && req.files['thumbnails']) ? req.files['thumbnails'] : [];

      console.log('[사진 업로드] fullImages 개수:', fullImages.length);
      console.log('[사진 업로드] thumbnails 개수:', thumbnails.length);

      if (fullImages.length === 0) {
        return res.status(400).json({
          success: false,
          message: '사진 파일을 선택해주세요.'
        });
      }

      // 썸네일과 원본 이미지를 매칭
      const uploadedPhotos = fullImages.map((fullFile, index) => {
        const thumbnailFile = thumbnails[index] || null;

        // 앨범 이미지 URL 생성 (저장 경로에 따라)
        // multer가 저장한 실제 경로 사용 (req에 저장된 경로)
        const albumStoragePath = req.albumStoragePath || getAlbumStoragePath();
        const albumImageUrl = getAlbumImageUrl(fullFile.filename, albumStoragePath);

        // 썸네일 URL 생성
        // req에 저장된 썸네일 경로가 없으면 기본 경로 사용
        const thumbnailStoragePath = req.thumbnailStoragePath || getThumbnailStoragePath();
        const thumbnailImageUrl = thumbnailFile ? getThumbnailUrl(thumbnailFile.filename, thumbnailStoragePath) : null;

        console.log(`[사진 업로드] 파일 매칭 - index: ${index}`);
        console.log(`  앨범 이미지: ${fullFile.filename} -> ${albumImageUrl}`);
        console.log(`  썸네일: ${thumbnailFile ? thumbnailFile.filename : '없음'} -> ${thumbnailImageUrl || '없음'}`);

        return {
          url: albumImageUrl, // 1080p 이미지 URL
          thumbnailUrl: thumbnailImageUrl, // 썸네일 URL
          filename: fullFile.filename,
          thumbnailFilename: thumbnailFile ? thumbnailFile.filename : null
        };
      });

      console.log(`[사진 업로드] ${uploadedPhotos.length}개 이미지 업로드 완료 (1080p + 썸네일)`);

      res.json({
        success: true,
        data: {
          photos: uploadedPhotos
        },
        message: '사진이 업로드되었습니다.'
      });
    } catch (error) {
      console.error('[사진 업로드] 오류 상세:', error);
      console.error('[사진 업로드] 오류 스택:', error.stack);
      res.status(500).json({
        success: false,
        message: error.message || '사진 업로드에 실패했습니다.'
      });
    }
  }
);

// 앨범 수정 (로그인 필수, 관리자 이상 또는 작성자만) - /:id GET보다 먼저 정의
router.put('/:id',
  [
    param('id').isInt(),
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('description').optional().trim(),
    body('photos').isArray()
  ],
  authenticate,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const { title, description, photos } = req.body;
      const pool = getPool();
      const userId = req.user.user_id;
      const userRole = req.user.role;

      // 앨범 조회
      const [albums] = await pool.query(
        'SELECT author_id FROM albums WHERE album_id = ? AND is_deleted = FALSE',
        [id]
      );

      if (albums.length === 0) {
        return res.status(404).json({ success: false, message: '앨범을 찾을 수 없습니다.' });
      }

      // 관리자 이상 권한 체크
      const isAdmin = userRole === 'admin' || userRole === 'super-admin';
      const isAuthor = albums[0].author_id === userId;

      // 관리자 이상이거나 작성자인 경우에만 수정 가능
      if (!isAdmin && !isAuthor) {
        return res.status(403).json({ success: false, message: '앨범을 수정할 권한이 없습니다.' });
      }

      // 기존 사진 목록 조회
      const [existingPhotos] = await pool.query(
        'SELECT photo_id, photo_url FROM album_photos WHERE album_id = ?',
        [id]
      );

      // 앨범 정보 업데이트
      await pool.query(
        'UPDATE albums SET title = ?, description = ? WHERE album_id = ?',
        [title, description || null, id]
      );

      // 기존 사진 삭제 (DB만)
      await pool.query('DELETE FROM album_photos WHERE album_id = ?', [id]);

      // 새로운 사진 저장 (순서 포함, 썸네일 URL 포함)
      if (photos && photos.length > 0) {
        const photoValues = photos.map((photo, index) => [
          id,
          photo.url, // 1080p 이미지 URL
          photo.thumbnailUrl || null, // 썸네일 URL
          index,
          photo.description || null
        ]);

        await pool.query(
          'INSERT INTO album_photos (album_id, photo_url, thumbnail_url, photo_order, description) VALUES ?',
          [photoValues]
        );
      }

      // 삭제된 사진 파일 정리 (새 목록에 없는 파일 - 원본과 썸네일 모두)
      const newPhotoUrls = photos.map(p => p.url);
      const deletedPhotos = existingPhotos.filter(ep => !newPhotoUrls.includes(ep.photo_url));

      deletedPhotos.forEach(photo => {
        // 원본 이미지 삭제 (URL에서 실제 경로 추출)
        try {
          const filePath = getAlbumFilePathFromUrl(photo.photo_url);
          if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`원본 파일 삭제 성공: ${filePath}`);
          } else if (filePath) {
            console.warn(`원본 파일을 찾을 수 없습니다: ${filePath}`);
          }
        } catch (fileError) {
          console.error(`원본 파일 삭제 실패: ${photo.photo_url}`, fileError);
        }

        // 썸네일 이미지 삭제 (URL에서 실제 경로 추출)
        if (photo.thumbnail_url) {
          try {
            const thumbnailPath = getThumbnailFilePathFromUrl(photo.thumbnail_url);
            if (thumbnailPath && fs.existsSync(thumbnailPath)) {
              fs.unlinkSync(thumbnailPath);
              console.log(`썸네일 파일 삭제 성공: ${thumbnailPath}`);
            } else if (thumbnailPath) {
              console.warn(`썸네일 파일을 찾을 수 없습니다: ${thumbnailPath}`);
            }
          } catch (fileError) {
            console.error(`썸네일 파일 삭제 실패: ${photo.thumbnail_url}`, fileError);
          }
        }
      });

      res.json({ success: true, message: '앨범이 수정되었습니다.' });
    } catch (error) {
      console.error('앨범 수정 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 앨범 삭제 (로그인 필수, 관리자 이상 또는 작성자만) - /:id GET보다 먼저 정의
router.delete('/:id',
  [param('id').isInt()],
  authenticate,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const pool = getPool();
      const userId = req.user.user_id;
      const userRole = req.user.role;

      // 앨범 조회
      const [albums] = await pool.query(
        'SELECT author_id FROM albums WHERE album_id = ? AND is_deleted = FALSE',
        [id]
      );

      if (albums.length === 0) {
        return res.status(404).json({ success: false, message: '앨범을 찾을 수 없습니다.' });
      }

      // 관리자 이상 권한 체크
      const isAdmin = userRole === 'admin' || userRole === 'super-admin';
      const isAuthor = albums[0].author_id === userId;

      // 관리자 이상이거나 작성자인 경우에만 삭제 가능
      if (!isAdmin && !isAuthor) {
        return res.status(403).json({ success: false, message: '앨범을 삭제할 권한이 없습니다. 관리자 이상의 권한이거나 작성자만 삭제할 수 있습니다.' });
      }

      // 앨범의 사진 목록 조회 (썸네일 URL도 포함)
      const [photos] = await pool.query(
        'SELECT photo_url, thumbnail_url FROM album_photos WHERE album_id = ?',
        [id]
      );

      // 앨범 삭제 (soft delete)
      await pool.query('UPDATE albums SET is_deleted = TRUE WHERE album_id = ?', [id]);

      // 물리적 파일 삭제 (원본과 썸네일 모두)
      if (photos.length > 0) {
        photos.forEach(photo => {
          // 원본 이미지 삭제 (URL에서 실제 경로 추출)
          try {
            const filePath = getAlbumFilePathFromUrl(photo.photo_url);
            if (filePath && fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`원본 파일 삭제 성공: ${filePath}`);
            } else if (filePath) {
              console.warn(`원본 파일을 찾을 수 없습니다: ${filePath}`);
            }
          } catch (fileError) {
            console.error(`원본 파일 삭제 실패: ${photo.photo_url}`, fileError);
          }

          // 썸네일 이미지 삭제 (URL에서 실제 경로 추출)
          if (photo.thumbnail_url) {
            try {
              const thumbnailPath = getThumbnailFilePathFromUrl(photo.thumbnail_url);
              if (thumbnailPath && fs.existsSync(thumbnailPath)) {
                fs.unlinkSync(thumbnailPath);
                console.log(`썸네일 파일 삭제 성공: ${thumbnailPath}`);
              } else if (thumbnailPath) {
                console.warn(`썸네일 파일을 찾을 수 없습니다: ${thumbnailPath}`);
              }
            } catch (fileError) {
              console.error(`썸네일 파일 삭제 실패: ${photo.thumbnail_url}`, fileError);
            }
          }
        });
      }

      res.json({ success: true, message: '앨범이 삭제되었습니다.' });
    } catch (error) {
      console.error('앨범 삭제 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 앨범 목록 조회 (페이징)
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 })
  ],
  optionalAuth,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { page = 1, limit = 12 } = req.query;
      const offset = (page - 1) * limit;

      const pool = getPool();
      // 각 앨범의 첫 번째 사진의 썸네일을 가져오기 (썸네일이 없으면 원본 사용)
      // photo_order가 있으면 그것을 우선하고, 없으면 photo_id로 정렬
      const [albums] = await pool.query(
        `SELECT 
          a.album_id, a.title, a.description, a.author_id, a.author_name, a.view_count, a.created_at,
          (SELECT COALESCE(ap.thumbnail_url, ap.photo_url)
           FROM album_photos ap 
           WHERE ap.album_id = a.album_id 
           ORDER BY 
             COALESCE(ap.photo_order, 999999) ASC,
             ap.photo_id ASC
           LIMIT 1) as thumbnail,
          (SELECT COUNT(*) 
           FROM album_photos ap 
           WHERE ap.album_id = a.album_id) as photo_count
        FROM albums a
        WHERE a.is_deleted = FALSE
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?`,
        [parseInt(limit), parseInt(offset)]
      );

      // 디버깅: 각 앨범의 썸네일 확인
      console.log('[앨범 목록] 썸네일 확인:', albums.map(a => ({
        id: a.album_id,
        title: a.title,
        thumbnail: a.thumbnail
      })));

      // 전체 앨범 수 조회
      const [countResult] = await pool.query(
        'SELECT COUNT(*) as total FROM albums WHERE is_deleted = FALSE'
      );
      const total = countResult[0].total;

      res.json({
        success: true,
        data: {
          albums,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('앨범 목록 조회 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 앨범 상세 조회
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
      console.log(`[앨범 조회] album_id: ${id}, user_id: ${userId || 'NULL'}, ip: ${clientIp}`);

      // 조회 기록 확인 (중복 조회 방지)
      // 같은 IP에서 다른 사용자가 로그인했을 때도 조회수가 증가하도록 user_id를 기준으로만 체크
      let existingViews;
      if (userId) {
        // 로그인 사용자: user_id만으로 중복 체크 (같은 사용자가 같은 앨범을 여러 번 조회하는 것만 방지)
        // 같은 IP에서 다른 사용자가 로그인했을 때는 조회수가 증가해야 함
        // user_id가 다르면 다른 사용자로 간주하여 조회수 증가
        [existingViews] = await pool.query(
          'SELECT view_id FROM album_views WHERE album_id = ? AND user_id = ?',
          [id, userId]
        );
        console.log(`[앨범 조회] 로그인 사용자 중복 체크 - album_id: ${id}, user_id: ${userId}, 기존 조회 기록: ${existingViews.length}개`);
        if (existingViews.length > 0) {
          console.log(`[앨범 조회] 기존 조회 기록 상세:`, existingViews);
        }
      } else {
        // 비로그인 사용자: ip_address만으로 중복 체크
        [existingViews] = await pool.query(
          'SELECT view_id FROM album_views WHERE album_id = ? AND user_id IS NULL AND ip_address = ?',
          [id, clientIp]
        );
        console.log(`[앨범 조회] 비로그인 사용자 중복 체크 - album_id: ${id}, ip: ${clientIp}, 기존 조회 기록: ${existingViews.length}개`);
        if (existingViews.length > 0) {
          console.log(`[앨범 조회] 기존 조회 기록 상세:`, existingViews);
        }
      }

      // 중복 조회가 아닌 경우에만 조회수 증가 및 기록 저장
      if (existingViews.length === 0) {
        try {
          // 트랜잭션 시작하여 조회수 증가와 조회 기록 저장을 원자적으로 처리
          const connection = await pool.getConnection();
          await connection.beginTransaction();

          try {
            // 조회수 증가
            const [updateResult] = await connection.query(
              'UPDATE albums SET view_count = view_count + 1 WHERE album_id = ? AND is_deleted = FALSE',
              [id]
            );
            console.log(`[앨범 조회] 조회수 증가 쿼리 실행 - album_id: ${id}, 영향받은 행: ${updateResult.affectedRows}`);

            // 조회 기록 저장
            await connection.query(
              'INSERT INTO album_views (album_id, user_id, ip_address) VALUES (?, ?, ?)',
              [id, userId, clientIp]
            );
            console.log(`[앨범 조회] 조회 기록 저장 완료 - album_id: ${id}, user_id: ${userId || 'NULL'}, ip: ${clientIp}`);

            await connection.commit();
            console.log(`[앨범 조회] ✅ 조회수 증가 및 기록 저장 성공 - album_id: ${id}, user_id: ${userId || 'NULL'}, ip: ${clientIp}`);
          } catch (insertError) {
            await connection.rollback();
            // UNIQUE KEY 제약 조건 위반 시 (동시 요청 등으로 인한 중복) 조용히 무시
            if (insertError.code === 'ER_DUP_ENTRY') {
              console.log(`[앨범 조회] 중복 조회 기록 무시 (동시 요청) - album_id: ${id}, user_id: ${userId || 'NULL'}, ip: ${clientIp}, 오류: ${insertError.message}`);
            } else {
              console.error('[앨범 조회] 조회 기록 저장 오류:', insertError);
              console.error('[앨범 조회] 오류 상세:', JSON.stringify(insertError, null, 2));
              throw insertError;
            }
          } finally {
            connection.release();
          }
        } catch (error) {
          console.error('[앨범 조회] 조회수 증가 오류:', error);
          console.error('[앨범 조회] 오류 상세:', JSON.stringify(error, null, 2));
          // 조회수 증가 실패해도 앨범은 조회 가능하도록 계속 진행
        }
      } else {
        console.log(`[앨범 조회] 중복 조회로 인한 조회수 증가 건너뜀 - album_id: ${id}, user_id: ${userId || 'NULL'}, ip: ${clientIp}, 기존 조회 기록 ID: ${existingViews[0]?.view_id}`);
      }

      // 앨범 조회
      const [albums] = await pool.query(
        'SELECT * FROM albums WHERE album_id = ? AND is_deleted = FALSE',
        [id]
      );

      if (albums.length === 0) {
        return res.status(404).json({ success: false, message: '앨범을 찾을 수 없습니다.' });
      }

      // 앨범의 사진 목록 조회
      const [photos] = await pool.query(
        'SELECT * FROM album_photos WHERE album_id = ? ORDER BY photo_order ASC',
        [id]
      );

      res.json({
        success: true,
        data: {
          album: albums[0],
          photos
        }
      });
    } catch (error) {
      console.error('앨범 상세 조회 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 앨범 생성 (로그인 필수)
router.post('/',
  authenticate,
  [
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('description').optional().trim(),
    body('photos').isArray().withMessage('사진 배열이 필요합니다.'),
    body('photos.*.url').isString().withMessage('사진 URL이 필요합니다.')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { title, description, photos } = req.body;
      const pool = getPool();
      const userId = req.user.user_id;
      // 닉네임만 사용 (닉네임이 없으면 익명)
      const authorName = req.user.nickname || '익명';

      // 앨범 생성
      const [result] = await pool.query(
        'INSERT INTO albums (title, description, author_id, author_name) VALUES (?, ?, ?, ?)',
        [title, description || null, userId, authorName]
      );

      const albumId = result.insertId;

      // 사진 저장 (썸네일 URL 포함)
      if (photos && photos.length > 0) {
        const photoValues = photos.map((photo, index) => [
          albumId,
          photo.url, // 1080p 이미지 URL
          photo.thumbnailUrl || null, // 썸네일 URL
          index,
          photo.description || null
        ]);

        await pool.query(
          'INSERT INTO album_photos (album_id, photo_url, thumbnail_url, photo_order, description) VALUES ?',
          [photoValues]
        );
      }

      res.status(201).json({
        success: true,
        data: { album_id: albumId },
        message: '앨범이 생성되었습니다.'
      });
    } catch (error) {
      console.error('앨범 생성 오류:', error);
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
);

module.exports = router;

