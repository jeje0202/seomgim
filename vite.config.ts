import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const buildVersion = Date.now().toString(); // 빌드 시 타임스탬프 생성
    
    return {
      server: {
        port: 4435, // localhost:4435로 접속하기 위해 포트 변경
        host: '0.0.0.0',
        // Nginx 프록시를 통한 도메인 접속 허용
        allowedHosts: [
          'seomgim.foryou.me',
          'www.seomgim.foryou.me',
          'localhost',
          '.foryou.me' // 모든 foryou.me 서브도메인 허용
        ],
        // 개발 환경에서 API 프록시 설정
        proxy: {
          '/api': {
            target: 'http://localhost:5000', // 백엔드 서버 포트
            changeOrigin: true,
            secure: false,
            // WebSocket 지원 (필요한 경우)
            ws: false,
            // 프록시 요청 헤더 설정
            configure: (proxy, _options) => {
              proxy.on('error', (err, _req, _res) => {
                console.log('프록시 오류:', err);
              });
              proxy.on('proxyReq', (proxyReq, req, _res) => {
                console.log('프록시 요청:', req.method, req.url);
              });
              proxy.on('proxyRes', (proxyRes, req, _res) => {
                console.log('프록시 응답:', proxyRes.statusCode, req.url);
              });
            }
          }
        }
      },
      // 프리뷰 모드 설정 (빌드 후 미리보기)
      preview: {
        port: 4435,
        host: '0.0.0.0',
        // 프리뷰 모드에서도 API 프록시 설정
        proxy: {
          '/api': {
            target: 'http://localhost:5000', // 백엔드 서버 포트
            changeOrigin: true,
            secure: false,
            ws: false,
            // 프록시 요청 헤더 설정
            configure: (proxy, _options) => {
              proxy.on('error', (err, _req, _res) => {
                console.log('프록시 오류:', err);
              });
              proxy.on('proxyReq', (proxyReq, req, _res) => {
                console.log('프록시 요청:', req.method, req.url);
              });
              proxy.on('proxyRes', (proxyRes, req, _res) => {
                console.log('프록시 응답:', proxyRes.statusCode, req.url);
              });
            }
          }
        }
      },
      plugins: [
        react(),
        // HTML에 빌드 버전 주입
        {
          name: 'html-transform',
          transformIndexHtml(html) {
            return html.replace('__BUILD_VERSION__', buildVersion);
          }
        }
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
