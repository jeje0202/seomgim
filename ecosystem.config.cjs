// PM2 프로세스 관리 설정 파일
// 사용법: pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'seomgim-church-backend',   // 백엔드 서버 앱 이름
      script: 'index.js',                // 실행할 스크립트
      cwd: 'C:/My/Seomgim-church/server', // 작업 디렉토리
      instances: 1,                      // 실행할 인스턴스 개수
      autorestart: true,                 // 크래시 시 자동 재시작
      watch: false,                      // 파일 변경 감지 (프로덕션에서는 false)
      max_memory_restart: '500M',        // 메모리 초과 시 재시작
      env: {
        NODE_ENV: 'production',          // 환경 변수
        PORT: 5000
      },
      error_file: 'C:/My/Seomgim-church/logs/backend-error.log',     // 에러 로그 파일
      out_file: 'C:/My/Seomgim-church/logs/backend-out.log',         // 출력 로그 파일
      log_date_format: 'YYYY-MM-DD HH:mm:ss',   // 로그 날짜 형식
      merge_logs: true,                          // 로그 병합
      time: true                                 // 로그에 타임스탬프 추가
    },
    {
      name: 'seomgim-church-frontend',   // 프론트엔드 프리뷰 서버 앱 이름
      script: 'npx',                     // 실행할 명령어
      args: 'vite preview --port 4435 --host',  // 인자 (4435 포트에서 프리뷰 서버 실행)
      cwd: 'C:/My/Seomgim-church',      // 작업 디렉토리
      instances: 1,                      // 실행할 인스턴스 개수
      autorestart: true,                 // 크래시 시 자동 재시작
      watch: false,                      // 파일 변경 감지 (프로덕션에서는 false)
      max_memory_restart: '500M',        // 메모리 초과 시 재시작
      env: {
        NODE_ENV: 'production',          // 환경 변수
        PORT: 4435
      },
      error_file: 'C:/My/Seomgim-church/logs/frontend-error.log',     // 에러 로그 파일
      out_file: 'C:/My/Seomgim-church/logs/frontend-out.log',         // 출력 로그 파일
      log_date_format: 'YYYY-MM-DD HH:mm:ss',   // 로그 날짜 형식
      merge_logs: true,                          // 로그 병합
      time: true                                 // 로그에 타임스탬프 추가
    }
  ]
};


