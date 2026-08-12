// [파일 용도] 이미지 업로드 API 라우터 (Cloudflare R2 클라우드 스토리지 전용)
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// 파일 저장 유틸리티 및 R2 연동 모듈 import
const { getThumbnailStoragePath, getThumbnailUrl } = require('../utils/fileStorage');
const { uploadToR2 } = require('../utils/r2Storage');

// [한글 코멘트] 로컬 디스크 저장 대신 multer.memoryStorage()를 사용하여 메모리 버퍼로 수신
const storage = multer.memoryStorage();

// 파일 필터 (이미지만 허용)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('이미지 파일만 업로드 가능합니다. (jpg, png, gif, webp)'));
  }
};

// [한글 코멘트] 사용자 요청: 이미지 개별 파일 최대 상한을 5MB로 설정
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB 제한
  },
  fileFilter: fileFilter
});

// 이미지 업로드 (원본 이미지와 썸네일 모두 받기 - R2 클라우드 직접 업로드)
router.post('/image',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
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

      // 카테고리 코드 가져오기 (쿼리 파라미터 또는 body에서)
      const categoryCode = req.query.category_code || req.body.category_code || 'bulletin';
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
      const ext = path.extname(imageFile.originalname).toLowerCase() || '.jpg';
      const imageFilename = `${prefix}-${uniqueSuffix}${ext}`;

      // 게시판별 URL 경로 설정
      let imageUrl;
      if (categoryCode === 'news') {
        imageUrl = `/uploads/news/${imageFilename}`;
      } else {
        const boardPathMap = {
          'bulletin': 'jubo',
          'member': 'normal',
          'organization': 'part',
          'notice': 'notice'
        };
        const boardSubPath = boardPathMap[categoryCode] || 'jubo';
        imageUrl = `/uploads/board/${boardSubPath}/${imageFilename}`;
      }

      // [한글 코멘트] R2 클라우드 스토리지로 원본 이미지 직접 업로드
      const imageR2Key = `uploads/${imageUrl.replace(/^\/uploads\//, '')}`;
      await uploadToR2(imageFile.buffer, imageR2Key, imageFile.mimetype);

      // 썸네일 업로드 및 URL 생성 (있는 경우)
      let thumbnailUrl = null;
      let thumbFilename = null;

      if (thumbnailFile) {
        const thumbExt = path.extname(thumbnailFile.originalname).toLowerCase() || '.jpg';
        thumbFilename = `thumb-${uniqueSuffix}${thumbExt}`;
        const thumbnailStoragePath = getThumbnailStoragePath();
        thumbnailUrl = getThumbnailUrl(thumbFilename, thumbnailStoragePath);

        // [한글 코멘트] R2 클라우드 스토리지로 썸네일 직접 업로드
        const thumbR2Key = `uploads/${thumbnailUrl.replace(/^\/uploads\//, '')}`;
        await uploadToR2(thumbnailFile.buffer, thumbR2Key, thumbnailFile.mimetype);
      }

      console.log(`[이미지 업로드] Cloudflare R2 직접 업로드 완료: ${imageUrl}`);

      res.json({
        success: true,
        data: {
          url: imageUrl,
          filename: imageFilename,
          thumbnailUrl: thumbnailUrl,
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

module.exports = router;

