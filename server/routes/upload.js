/**
 * [파일 용도] 게시판·교회소식 이미지 업로드(Cloudflare R2 직결) 및 원본 다운로드 프록시 API 라우터
 * 보안 보완: 비인증 업로드 차단(authenticate) 및 카테고리별 작성 권한 검증, 화이트리스트 확장자/MIME 검증 적용
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// 인증 미들웨어 및 R2 스토리지 모듈 불러오기
const { authenticate } = require('../middleware/auth');
const { getThumbnailStoragePath, getThumbnailUrl } = require('../utils/fileStorage');
const { uploadToR2, getObjectFromR2, getMimeType, normalizeR2Key } = require('../utils/r2Storage');

// [한글 코멘트] 로컬 디스크 저장 대신 multer.memoryStorage()를 사용하여 메모리 버퍼로 수신
const storage = multer.memoryStorage();

// [한글 코멘트] 허용된 이미지 MIME 타입 및 표준 확장자 매핑
const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp'
};

// 파일 필터 (허용된 이미지 MIME 및 확장자만 통과)
const fileFilter = (req, file, cb) => {
  const allowedExt = /^\.(jpeg|jpg|png|gif|webp)$/i;
  const extOk = allowedExt.test(path.extname(file.originalname || '').toLowerCase());
  const mimeOk = Boolean(MIME_TO_EXT[(file.mimetype || '').toLowerCase()]);

  if (mimeOk && extOk) {
    return cb(null, true);
  }
  cb(new Error('이미지 파일만 업로드 가능합니다. (jpg, png, gif, webp)'));
};

// [한글 코멘트] 이미지 개별 파일 최대 상한 5MB 설정
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB 제한
    files: 2
  },
  fileFilter: fileFilter
});

// [한글 코멘트] 보안 보완: 업로드 카테고리 코드 화이트리스트 및 사용자 권한 검증 헬퍼
const ALLOWED_CATEGORY_CODES = new Set(['bulletin', 'member', 'organization', 'notice', 'news']);

const checkUploadCategoryPermission = (user, categoryCode) => {
  if (!user) {
    return { allowed: false, status: 401, message: '로그인이 필요합니다.' };
  }

  const roleHierarchy = {
    'user': 1,
    'manager': 2,
    'admin': 3,
    'super-admin': 4,
    'super_admin': 4
  };
  const normalizedRole = String(user.role || '').toLowerCase().replace(/_/g, '-');
  const level = roleHierarchy[normalizedRole] || 0;
  const isMember = user.is_member === true || user.is_member === 1;

  // 공지사항 및 교회소식: 관리자(admin) 이상만 허용
  if (categoryCode === 'notice' || categoryCode === 'news') {
    if (level < 3) {
      return { allowed: false, status: 403, message: '관리자 권한 이상만 이미지를 업로드할 수 있습니다.' };
    }
    return { allowed: true };
  }

  // 주보게시판: 담당자(manager) 이상만 허용
  if (categoryCode === 'bulletin') {
    if (level < 2) {
      return { allowed: false, status: 403, message: '주보게시판은 담당자 권한 이상이 필요합니다.' };
    }
    return { allowed: true };
  }

  // 성도전용 / 기관게시판: 관리자 이상 또는 교인 등록 사용자만 허용
  if (categoryCode === 'member' || categoryCode === 'organization') {
    if (level < 3 && !isMember) {
      return { allowed: false, status: 403, message: '성도전용 게시판은 교인 등록 사용자 또는 관리자만 이용할 수 있습니다.' };
    }
    return { allowed: true };
  }

  return { allowed: false, status: 400, message: '허용되지 않은 업로드 카테고리입니다.' };
};

// [한글 코멘트] 이미지 업로드 엔드포인트 (보안 보완: authenticate 필수 적용 및 R2 공개 CDN URL 직접 반환)
router.post('/image',
  authenticate,
  (req, res, next) => {
    upload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 }
    ])(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, message: '파일 크기가 너무 큽니다. (최대 5MB)' });
        }
        return res.status(400).json({ success: false, message: err.message || '파일 업로드 검증에 실패했습니다.' });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const imageFile = req.files && req.files['image'] ? req.files['image'][0] : null;
      const thumbnailFile = req.files && req.files['thumbnail'] ? req.files['thumbnail'][0] : null;

      if (!imageFile) {
        return res.status(400).json({
          success: false,
          message: '이미지 파일을 선택해주세요.'
        });
      }

      // 카테고리 코드 화이트리스트 검증
      const rawCategory = String(req.query.category_code || req.body.category_code || 'bulletin').trim();
      const categoryCode = ALLOWED_CATEGORY_CODES.has(rawCategory) ? rawCategory : null;
      if (!categoryCode) {
        return res.status(400).json({
          success: false,
          message: '유효하지 않은 게시판 카테고리 코드입니다.'
        });
      }

      // 카테고리별 업로드 권한 검증
      const perm = checkUploadCategoryPermission(req.user, categoryCode);
      if (!perm.allowed) {
        return res.status(perm.status).json({
          success: false,
          message: perm.message
        });
      }

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

      // 게시판별 파일명 접두사 설정
      const prefixMap = {
        'bulletin': 'jubo',
        'member': 'normal',
        'organization': 'part',
        'notice': 'notice',
        'news': 'news'
      };
      const prefix = prefixMap[categoryCode] || 'jubo';
      // [한글 코멘트] 실제 MIME 타입에 맞는 확장자를 부여하여 확장자-콘텐츠 불일치 방지
      const ext = MIME_TO_EXT[(imageFile.mimetype || '').toLowerCase()] || path.extname(imageFile.originalname).toLowerCase() || '.jpg';
      const imageFilename = `${prefix}-${uniqueSuffix}${ext}`;

      // 게시판별 논리 경로 설정
      let relativeUploadPath;
      if (categoryCode === 'news') {
        relativeUploadPath = `/uploads/news/${imageFilename}`;
      } else {
        const boardPathMap = {
          'bulletin': 'jubo',
          'member': 'normal',
          'organization': 'part',
          'notice': 'notice'
        };
        const boardSubPath = boardPathMap[categoryCode] || 'jubo';
        relativeUploadPath = `/uploads/board/${boardSubPath}/${imageFilename}`;
      }

      // [한글 코멘트] R2 클라우드 스토리지로 원본 이미지 직접 업로드 후 공개 CDN URL 획득
      const imageUploadResult = await uploadToR2(imageFile.buffer, relativeUploadPath, imageFile.mimetype);

      // 썸네일 업로드 및 공개 CDN URL 생성 (있는 경우)
      let thumbnailPublicUrl = null;
      let thumbFilename = null;

      if (thumbnailFile) {
        const thumbExt = MIME_TO_EXT[(thumbnailFile.mimetype || '').toLowerCase()] || path.extname(thumbnailFile.originalname).toLowerCase() || '.jpg';
        thumbFilename = `thumb-${uniqueSuffix}${thumbExt}`;
        const thumbnailStoragePath = getThumbnailStoragePath();
        const relativeThumbUrl = getThumbnailUrl(thumbFilename, thumbnailStoragePath);

        const thumbUploadResult = await uploadToR2(thumbnailFile.buffer, relativeThumbUrl, thumbnailFile.mimetype);
        thumbnailPublicUrl = thumbUploadResult.url;
      }

      console.log(`[이미지 업로드] Cloudflare R2 직접 업로드 완료: ${imageUploadResult.url}`);

      res.json({
        success: true,
        data: {
          url: imageUploadResult.url,
          filename: imageFilename,
          thumbnailUrl: thumbnailPublicUrl,
          thumbnailFilename: thumbFilename
        },
        message: '이미지가 업로드되었습니다.'
      });
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      res.status(500).json({
        success: false,
        message: error.message || '이미지 업로드에 실패했습니다.'
      });
    }
  }
);

// [한글 코멘트] 뷰어 원본 다운로드 전용 안전한 프록시 엔드포인트 (R2 도메인 CORS 제약 우회 및 seomgim/data 버킷 객체만 허용하여 SSRF 방지)
router.get('/download', async (req, res) => {
  try {
    const rawUrl = String(req.query.url || '').trim();
    const customName = String(req.query.filename || '').trim();

    const cleanKey = normalizeR2Key(rawUrl);
    if (!cleanKey) {
      return res.status(400).json({ success: false, message: '유효하지 않은 파일 경로입니다.' });
    }

    const buffer = await getObjectFromR2(cleanKey);
    if (!buffer) {
      return res.status(404).json({ success: false, message: '파일을 찾을 수 없습니다.' });
    }

    const mimeType = getMimeType(cleanKey);
    const defaultExt = path.extname(cleanKey) || '.jpg';
    const safeFilename = (customName || path.basename(cleanKey) || `image${defaultExt}`).replace(/[\r\n"\\]/g, '_');

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (error) {
    console.error('파일 다운로드 처리 오류:', error);
    return res.status(500).json({ success: false, message: '파일 다운로드 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
