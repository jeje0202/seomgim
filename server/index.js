// [한글 코멘트] 시스템 기본 경로 및 파일 처리를 위한 path, fs 모듈 불러오기
const path = require('path');
const fs = require('fs');

const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./db');
const boardRoutes = require('./routes/board');
const newsRoutes = require('./routes/news');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const activityRoutes = require('./routes/activity');
const albumRoutes = require('./routes/albums');
const eventsRoutes = require('./routes/events');
const surveyRoutes = require('./routes/surveys');
// [한글 코멘트] 슈퍼관리자 CMS 영역 편집 및 SQLite 이력/복구 API 라우터 모듈 불러오기
const cmsRoutes = require('./routes/cms');
// YouTube API는 더 이상 사용하지 않음
// const youtubeRoutes = require('./routes/youtube');
require('dotenv').config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정 (seomgim.foryou.me 도메인 포함 CORS 안전 허용)
const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true
}));
// 요청 본문 크기 제한 증가 (앨범 사진 여러 장 업로드 지원: 20장 * 10MB = 200MB)
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// Nginx 프록시를 통한 IP 주소 정확히 가져오기
app.set('trust proxy', true);

// 정적 파일 서빙 (업로드된 이미지)  
// 절대 경로로 설정 (Windows 호환성 보장)
const projectRoot = path.resolve(__dirname, '..');

const albumDir = path.join(projectRoot, 'data', 'album');
const boardDir = path.join(projectRoot, 'data', 'board');
const dataDir = path.join(projectRoot, 'data');
const thumbnailBaseDir = path.join(projectRoot, 'data', 'thumbnail');
const newsDir = path.join(projectRoot, 'data', 'news');

// [한글 코멘트] Cloudflare R2 클라우드 스토리지 전용 업로드 모드 설정 및 기존 로컬 캐시 서빙 지원
console.log('=== 스토리지 서빙 설정 (Cloudflare R2 클라우드 직접 연동 모드) ===');
console.log(`프로젝트 루트: ${projectRoot}`);

// 기존 로컬 파일이 디스크에 남아있는 경우에 대한 백업 정적 서빙 설정
if (fs.existsSync(albumDir)) {
  app.use('/uploads/album', express.static(albumDir));
}
if (fs.existsSync(thumbnailBaseDir)) {
  app.use('/uploads/thumbnail', express.static(thumbnailBaseDir));
}
if (fs.existsSync(boardDir)) {
  const boardSubDirs = ['jubo', 'normal', 'part', 'notice', 'pasted'];
  boardSubDirs.forEach(subDir => {
    const subDirPath = path.join(boardDir, subDir);
    if (fs.existsSync(subDirPath)) {
      app.use(`/uploads/board/${subDir}`, express.static(subDirPath));
    }
  });
}
if (fs.existsSync(newsDir)) {
  app.use('/uploads/news', express.static(newsDir));
}
if (fs.existsSync(dataDir)) {
  app.use('/uploads', express.static(dataDir));
}
console.log('✅ Cloudflare R2 스토리지 활성화 (신규 업로드 파일 디스크 저장 전면 차단 완료)');

// [한글 코멘트] R2 클라우드 폴백 미들웨어: 로컬 디스크에 파일이 없거나 향후 로컬 파일 삭제 후에도 Cloudflare R2에서 즉시 내려 받아 서빙
const { getObjectFromR2, getMimeType } = require('./utils/r2Storage');
app.use('/uploads/*', async (req, res, next) => {
  try {
    const relativePath = req.params[0];
    if (relativePath) {
      const r2Key = `uploads/${relativePath}`;
      const buffer = await getObjectFromR2(r2Key);
      if (buffer) {
        const mimeType = getMimeType(relativePath);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.send(buffer);
      }
    }
  } catch (err) {
    console.error('R2 클라우드 미들웨어 서빙 예외:', err.message);
  }
  next();
});

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 라우터 설정
app.use('/api/auth', authRoutes);
app.use('/api/board', boardRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/events', eventsRoutes.router);
app.use('/api/surveys', surveyRoutes);
// [한글 코멘트] 슈퍼관리자 CMS 영역 편집 및 SQLite 기반 이력/복구 API 엔드포인트 마운트
app.use('/api/cms', cmsRoutes);
// YouTube API는 더 이상 사용하지 않음
// app.use('/api/youtube', youtubeRoutes);

// 헬스 체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: '창원섬김의교회 게시판 API'
  });
});

// 루트 경로
app.get('/', (req, res) => {
  res.json({
    message: '창원섬김의교회 게시판 API 서버',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: {
        register: '/api/auth/register',
        login: '/api/auth/login',
        verify: '/api/auth/verify',
        me: '/api/auth/me'
      },
      board: {
        categories: '/api/board/categories',
        posts: '/api/board/posts',
        comments: '/api/board/comments'
      },
      news: '/api/news'
    }
  });
});

// 404 에러 핸들러 (정적 파일 요청은 제외)
app.use((req, res) => {
  // 정적 파일 요청이 아닌 경우에만 JSON 응답
  if (!req.url.startsWith('/uploads')) {
    res.status(404).json({ success: false, message: '요청하신 리소스를 찾을 수 없습니다.' });
  } else {
    // 정적 파일 요청인데 찾지 못한 경우
    res.status(404).send('File not found');
  }
});

// 전역 에러 핸들러
app.use((err, req, res, next) => {
  console.error('서버 오류:', err);
  res.status(500).json({ 
    success: false, 
    message: '서버 내부 오류가 발생했습니다.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 서버 시작
async function startServer() {
  try {
    // 데이터베이스 초기화
    await initializeDatabase();
    
    // 서버 시작
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     창원섬김의교회 게시판 API 서버 시작됨            ║
║                                                       ║
║     포트: ${PORT}                                       ║
║     환경: ${process.env.NODE_ENV || 'development'}                                   ║
║     시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}  ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error);
    process.exit(1);
  }
}

// 프로세스 종료 시 정리
process.on('SIGTERM', () => {
  console.log('SIGTERM 신호 받음. 서버를 종료합니다...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT 신호 받음. 서버를 종료합니다...');
  process.exit(0);
});

// 서버 시작
startServer();

