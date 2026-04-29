// 창원섬김의교회 게시판 백엔드 서버
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
// YouTube API는 더 이상 사용하지 않음
// const youtubeRoutes = require('./routes/youtube');
require('dotenv').config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
// 요청 본문 크기 제한 증가 (앨범 사진 여러 장 업로드 지원: 20장 * 10MB = 200MB)
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// Nginx 프록시를 통한 IP 주소 정확히 가져오기
app.set('trust proxy', true);

// 정적 파일 서빙 (업로드된 이미지)  
const path = require('path');
const fs = require('fs');

// 절대 경로로 설정 (Windows 호환성 보장)
const projectRoot = path.resolve(__dirname, '..');
const albumDir = path.join(projectRoot, 'data', 'album');
const dataDir = path.join(projectRoot, 'data');
const boardDir = path.join(projectRoot, 'data', 'board');

console.log('=== 정적 파일 서빙 설정 ===');
console.log(`프로젝트 루트: ${projectRoot}`);
console.log(`앨범 디렉토리: ${albumDir}`);
console.log(`데이터 디렉토리: ${dataDir}`);

// 앨범 이미지 서빙 (data/album 폴더 및 하위 폴더들) - 더 구체적인 경로를 먼저 설정
if (fs.existsSync(albumDir)) {
  // 기본 앨범 폴더 서빙
  app.use('/uploads/album', express.static(albumDir));
  console.log(`✅ 앨범 이미지 서빙 설정 완료: ${albumDir}`);
  
  // 하위 폴더들 (album1, album2...) 서빙
  try {
    const files = fs.readdirSync(albumDir);
    const subDirs = files.filter(file => {
      const filePath = path.join(albumDir, file);
      return fs.statSync(filePath).isDirectory() && file.startsWith('album');
    });
    
    subDirs.forEach(subDir => {
      const subDirPath = path.join(albumDir, subDir);
      app.use(`/uploads/album/${subDir}`, express.static(subDirPath));
      console.log(`✅ 앨범 하위 폴더 서빙 설정: ${subDirPath}`);
    });
    
    const fileCount = files.filter(file => {
      const filePath = path.join(albumDir, file);
      return fs.statSync(filePath).isFile();
    }).length;
    console.log(`   기본 폴더 파일 수: ${fileCount}개`);
  } catch (err) {
    console.error(`❌ 앨범 폴더 확인 오류:`, err);
  }
} else {
  console.error(`❌ 앨범 디렉토리가 없습니다: ${albumDir}`);
  // 디렉토리 생성 시도
  try {
    fs.mkdirSync(albumDir, { recursive: true });
    console.log(`✅ 앨범 디렉토리 생성됨: ${albumDir}`);
    app.use('/uploads/album', express.static(albumDir));
  } catch (err) {
    console.error(`❌ 앨범 디렉토리 생성 실패:`, err);
  }
}

// 썸네일 이미지 서빙 (data/thumbnail 폴더 및 하위 폴더들)
const thumbnailBaseDir = path.join(projectRoot, 'data', 'thumbnail');
if (fs.existsSync(thumbnailBaseDir)) {
  // 기본 썸네일 폴더 서빙
  app.use('/uploads/thumbnail', express.static(thumbnailBaseDir));
  console.log(`✅ 썸네일 이미지 서빙 설정 완료: ${thumbnailBaseDir}`);
  
  // 하위 폴더들 (년월별) 서빙
  try {
    const files = fs.readdirSync(thumbnailBaseDir);
    const subDirs = files.filter(file => {
      const filePath = path.join(thumbnailBaseDir, file);
      return fs.statSync(filePath).isDirectory();
    });
    
    subDirs.forEach(subDir => {
      const subDirPath = path.join(thumbnailBaseDir, subDir);
      app.use(`/uploads/thumbnail/${subDir}`, express.static(subDirPath));
      console.log(`✅ 썸네일 하위 폴더 서빙 설정: ${subDirPath}`);
    });
  } catch (err) {
    console.error(`❌ 썸네일 폴더 확인 오류:`, err);
  }
} else {
  console.log(`ℹ️ 썸네일 디렉토리가 없습니다. 필요시 자동 생성됩니다: ${thumbnailBaseDir}`);
}

// 게시판별 이미지 서빙 (data/board 폴더 및 하위 폴더들)
if (fs.existsSync(boardDir)) {
  // 게시판별 하위 폴더 서빙
  const boardSubDirs = ['jubo', 'normal', 'part', 'notice'];
  boardSubDirs.forEach(subDir => {
    const subDirPath = path.join(boardDir, subDir);
    if (fs.existsSync(subDirPath)) {
      app.use(`/uploads/board/${subDir}`, express.static(subDirPath));
      console.log(`✅ 게시판 이미지 서빙 설정: ${subDirPath} -> /uploads/board/${subDir}`);
    } else {
      // 디렉토리가 없으면 생성
      try {
        fs.mkdirSync(subDirPath, { recursive: true });
        app.use(`/uploads/board/${subDir}`, express.static(subDirPath));
        console.log(`✅ 게시판 디렉토리 생성 및 서빙 설정: ${subDirPath}`);
      } catch (err) {
        console.error(`❌ 게시판 디렉토리 생성 실패 (${subDir}):`, err);
      }
    }
  });
} else {
  console.error(`❌ 게시판 디렉토리가 없습니다: ${boardDir}`);
  // 디렉토리 생성 시도
  try {
    fs.mkdirSync(boardDir, { recursive: true });
    console.log(`✅ 게시판 디렉토리 생성됨: ${boardDir}`);
    // 하위 폴더들도 생성
    const boardSubDirs = ['jubo', 'normal', 'part', 'notice'];
    boardSubDirs.forEach(subDir => {
      const subDirPath = path.join(boardDir, subDir);
      fs.mkdirSync(subDirPath, { recursive: true });
      app.use(`/uploads/board/${subDir}`, express.static(subDirPath));
      console.log(`✅ 게시판 하위 디렉토리 생성 및 서빙 설정: ${subDirPath}`);
    });
  } catch (err) {
    console.error(`❌ 게시판 디렉토리 생성 실패:`, err);
  }
}

// 교회소식 이미지 서빙 (data/news 폴더)
const newsDir = path.join(projectRoot, 'data', 'news');
if (fs.existsSync(newsDir)) {
  app.use('/uploads/news', express.static(newsDir));
  console.log(`✅ 교회소식 이미지 서빙 설정: ${newsDir} -> /uploads/news`);
} else {
  try {
    fs.mkdirSync(newsDir, { recursive: true });
    app.use('/uploads/news', express.static(newsDir));
    console.log(`✅ 교회소식 디렉토리 생성 및 서빙 설정: ${newsDir}`);
  } catch (err) {
    console.error(`❌ 교회소식 디렉토리 생성 실패:`, err);
  }
}

// 기타 업로드 파일 서빙
if (fs.existsSync(dataDir)) {
  app.use('/uploads', express.static(dataDir));
  console.log(`✅ 업로드 파일 서빙 설정 완료: ${dataDir}`);
} else {
  console.error(`❌ 데이터 디렉토리가 없습니다: ${dataDir}`);
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`✅ 데이터 디렉토리 생성됨: ${dataDir}`);
    app.use('/uploads', express.static(dataDir));
  } catch (err) {
    console.error(`❌ 데이터 디렉토리 생성 실패:`, err);
  }
}

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

