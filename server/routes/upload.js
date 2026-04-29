// 이미지 업로드 API 라우터
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 파일 저장 유틸리티 import
const { getThumbnailStoragePath, getThumbnailUrl } = require('../utils/fileStorage');

// data 디렉토리 생성 (없는 경우)
// 프로젝트 루트의 data 폴더에 저장
const uploadsDir = path.join(__dirname, '../../data');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 썸네일 기본 디렉토리 생성 (없는 경우)
const thumbnailBaseDir = path.join(__dirname, '../../data/thumbnail');
if (!fs.existsSync(thumbnailBaseDir)) {
  fs.mkdirSync(thumbnailBaseDir, { recursive: true });
}

// 게시판별 이미지 저장 경로 설정
const getBoardImagePath = (categoryCode) => {
  // 교회소식은 별도 경로 사용
  if (categoryCode === 'news') {
    const newsDir = path.join(__dirname, '../../data/news');
    if (!fs.existsSync(newsDir)) {
      fs.mkdirSync(newsDir, { recursive: true });
    }
    return newsDir;
  }

  const boardBaseDir = path.join(__dirname, '../../data/board');

  // 게시판별 하위 디렉토리 매핑
  const boardPathMap = {
    'bulletin': 'jubo',      // 주보게시판
    'member': 'normal',      // 성도게시판
    'organization': 'part',  // 기관게시판
    'notice': 'notice'       // 공지사항 게시판
  };

  // 카테고리 코드에 따라 경로 결정 (기본값: bulletin)
  const subDir = boardPathMap[categoryCode] || 'jubo';
  const boardDir = path.join(boardBaseDir, subDir);

  // 디렉토리가 없으면 생성
  if (!fs.existsSync(boardDir)) {
    fs.mkdirSync(boardDir, { recursive: true });
  }

  return boardDir;
};

// multer 설정 (필드명과 카테고리에 따라 다른 저장 경로 사용)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 필드명에 따라 다른 저장 경로 결정
    if (file.fieldname === 'thumbnail') {
      // 썸네일: 년월별 폴더
      const storagePath = getThumbnailStoragePath();
      if (!req.thumbnailStoragePath) req.thumbnailStoragePath = storagePath;
      cb(null, storagePath);
    } else {
      // 원본 이미지: 게시판별 경로
      // 요청에서 카테고리 코드 가져오기 (쿼리 파라미터 또는 body에서)
      const categoryCode = req.query.category_code || req.body.category_code || 'bulletin';
      const boardDir = getBoardImagePath(categoryCode);
      cb(null, boardDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);

    if (file.fieldname === 'thumbnail') {
      cb(null, `thumb-${uniqueSuffix}${ext}`);
    } else {
      // 게시판별 파일명 접두사
      const categoryCode = req.query.category_code || req.body.category_code || 'bulletin';
      const prefixMap = {
        'bulletin': 'jubo',
        'member': 'normal',
        'organization': 'part',
        'notice': 'notice',
        'news': 'news'
      };
      const prefix = prefixMap[categoryCode] || 'jubo';
      cb(null, `${prefix}-${uniqueSuffix}${ext}`);
    }
  }
});

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

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  },
  fileFilter: fileFilter
});

// 이미지 업로드 (원본 이미지와 썸네일 모두 받기)
router.post('/image',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  (req, res) => {
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

      // 게시판별 URL 경로 설정
      let imageUrl;
      if (categoryCode === 'news') {
        // 교회소식은 별도 경로
        imageUrl = `/uploads/news/${imageFile.filename}`;
      } else {
        const boardPathMap = {
          'bulletin': 'jubo',
          'member': 'normal',
          'organization': 'part',
          'notice': 'notice'
        };
        const boardSubPath = boardPathMap[categoryCode] || 'jubo';
        imageUrl = `/uploads/board/${boardSubPath}/${imageFile.filename}`;
      }

      // 썸네일 URL 생성 (있는 경우)
      const thumbnailStoragePath = req.thumbnailStoragePath || getThumbnailStoragePath();
      const thumbnailUrl = thumbnailFile ? getThumbnailUrl(thumbnailFile.filename, thumbnailStoragePath) : null;

      res.json({
        success: true,
        data: {
          url: imageUrl,
          filename: imageFile.filename,
          thumbnailUrl: thumbnailUrl,
          thumbnailFilename: thumbnailFile ? thumbnailFile.filename : null
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

