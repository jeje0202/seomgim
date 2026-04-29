# Nginx HTTPS 설정 가이드 (창원섬김의교회)

## 방법 1: Let's Encrypt 무료 SSL 인증서 (권장)

### 1단계: Certbot 설치 (Windows)
```bash
# Chocolatey로 설치
choco install certbot

# 또는 다운로드
https://github.com/certbot/certbot/releases
```

### 2단계: SSL 인증서 발급
```bash
certbot certonly --webroot -w C:\My\Seomgim-church\dist -d seomgim.foryou.me -d www.seomgim.foryou.me
```

### 3단계: Nginx 설정 수정 (C:\nginx\conf\foryou_apps.conf)
```nginx
# Seomgim 홈페이지 - HTTP에서 HTTPS로 리디렉션
server {
    listen 80;
    server_name seomgim.foryou.me www.seomgim.foryou.me;
    return 301 https://$server_name$request_uri;
}

# Seomgim 홈페이지 - HTTPS
server {
    listen 443 ssl http2;
    server_name seomgim.foryou.me www.seomgim.foryou.me;

    # SSL 인증서 경로
    ssl_certificate C:/Certbot/live/seomgim.foryou.me/fullchain.pem;
    ssl_certificate_key C:/Certbot/live/seomgim.foryou.me/privkey.pem;

    # SSL 설정
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 빌드된 정적 파일 경로
    root C:/My/Seomgim-church/dist;
    index index.html;

    # favicon.ico 없을 때 에러 무시
    location = /favicon.ico {
        log_not_found off;
        access_log off;
        try_files $uri =204;
    }

    # SPA 라우팅 지원
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 정적 파일 캐싱
    location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot|map)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # assets 폴더
    location /assets/ {
        try_files $uri =404;
        expires 1y;
    }
}
```

### 4단계: Nginx 재시작
```bash
cd C:\nginx
nginx -t
Stop-Process -Name nginx -Force
.\nginx.exe
```

---

## 방법 2: Cloudflare Flexible SSL (가장 간단) ⭐

**Cloudflare 대시보드에서:**
1. SSL/TLS → Overview
2. "Flexible" 선택
3. 완료!

**장점:**
- 무료
- 설정 간단
- 자동 갱신
- CDN 보너스

**단점:**
- Cloudflare ↔ 서버 구간은 HTTP (내부망이면 괜찮음)

---

## 현재 권장 방법: Cloudflare Flexible SSL ✅

가장 빠르고 간단한 방법입니다!

