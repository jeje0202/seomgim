# HTTPS 설정 완료 가이드

## ✅ 완료된 작업

1. **Nginx 설정 업데이트**
   - HTTP(80) → HTTPS(443) 리디렉션 추가
   - HTTPS(443) 서버 블록 추가
   - SSL 인증서 경로 설정
   - 보안 헤더 추가

2. **백엔드 CORS 설정 업데이트**
   - HTTPS 도메인 추가 (`https://seomgim.foryou.me`)

## 📋 다음 단계 (필수)

### 1단계: Cloudflare Origin Certificate 생성

1. **Cloudflare 대시보드 접속**
   - https://dash.cloudflare.com
   - `seomgim.foryou.me` 도메인 선택

2. **Origin Certificate 생성**
   - 왼쪽 메뉴: **SSL/TLS** 클릭
   - **Origin Server** 탭 클릭
   - **Create Certificate** 버튼 클릭
   - 설정:
     - **Private key type**: RSA (2048)
     - **Hostnames**: 
       - `seomgim.foryou.me`
       - `*.seomgim.foryou.me` (선택사항)
     - **Certificate Validity**: 15년
   - **Create** 클릭

3. **인증서 복사**
   - **Origin Certificate** (공개키) 전체 복사
   - **Private Key** (개인키) 전체 복사
   - ⚠️ **중요**: 이 키들은 다시 볼 수 없으므로 안전하게 저장하세요!

### 2단계: 인증서 파일 저장

**PowerShell 관리자 권한으로 실행:**

```powershell
# SSL 폴더 생성 (이미 있으면 생략)
New-Item -ItemType Directory -Path "C:\nginx\conf\ssl" -Force

# 인증서 파일 생성
# 방법 1: 메모장으로 수동 생성
notepad C:\nginx\conf\ssl\cert.pem
# → Origin Certificate 내용 붙여넣기 → 저장

notepad C:\nginx\conf\ssl\key.pem
# → Private Key 내용 붙여넣기 → 저장

# 방법 2: PowerShell로 직접 생성
# Origin Certificate를 cert.pem에 저장
@"
[여기에 Origin Certificate 내용 붙여넣기]
"@ | Out-File -FilePath "C:\nginx\conf\ssl\cert.pem" -Encoding utf8 -NoNewline

# Private Key를 key.pem에 저장
@"
[여기에 Private Key 내용 붙여넣기]
"@ | Out-File -FilePath "C:\nginx\conf\ssl\key.pem" -Encoding utf8 -NoNewline
```

**파일 구조 확인:**
```
C:\nginx\conf\ssl\
  ├── cert.pem      (Origin Certificate - 공개키)
  └── key.pem       (Private Key - 개인키)
```

### 3단계: Cloudflare SSL 모드 설정

1. **Cloudflare 대시보드**
   - SSL/TLS → Overview
   - **Full** 또는 **Full (strict)** 모드 선택
   - ⚠️ **Flexible 모드가 아닌 Full 모드여야 합니다!**

### 4단계: Nginx 설정 테스트 및 재시작

**PowerShell 관리자 권한으로 실행:**

```powershell
cd C:\nginx

# 설정 파일 테스트
.\nginx.exe -t

# 오류가 없으면 Nginx 재시작
Stop-Process -Name nginx -Force
.\nginx.exe

# 백엔드 서버 재시작 (CORS 설정 적용)
cd C:\My\Seomgim-church\server
pm2 restart seomgim
```

### 5단계: HTTPS 테스트

1. **브라우저에서 접속**
   ```
   https://seomgim.foryou.me
   ```

2. **확인 사항**
   - 주소창에 자물쇠 아이콘 표시 ✅
   - "연결이 안전합니다" 메시지 ✅
   - HTTP 접속 시 자동으로 HTTPS로 리디렉션 ✅

3. **SSL Labs 테스트 (선택사항)**
   ```
   https://www.ssllabs.com/ssltest/analyze.html?d=seomgim.foryou.me
   ```

## 🔧 자동화 스크립트 사용

**PowerShell 관리자 권한으로 실행:**

```powershell
cd C:\My\Seomgim-church
.\setup-https.ps1
```

이 스크립트는:
- SSL 폴더 생성 확인
- 인증서 파일 존재 확인
- Nginx 설정 테스트
- 다음 단계 안내

## ❌ 문제 해결

### "NET::ERR_CERT_AUTHORITY_INVALID" 오류

**원인**: Cloudflare SSL 모드가 Flexible로 설정됨

**해결**:
1. Cloudflare 대시보드 → SSL/TLS → Overview
2. **Full** 또는 **Full (strict)** 모드로 변경
3. 몇 분 대기 후 다시 시도

### "연결이 거부되었습니다"

**원인**: Nginx가 포트 443을 리스닝하지 않음

**해결**:
1. 인증서 파일이 올바른 위치에 있는지 확인
   ```
   C:\nginx\conf\ssl\cert.pem
   C:\nginx\conf\ssl\key.pem
   ```
2. Nginx 설정 테스트: `nginx -t`
3. 방화벽에서 포트 443 허용 확인
4. Nginx 재시작

### "nginx: [emerg] SSL_CTX_use_certificate_file() failed"

**원인**: 인증서 파일 경로가 잘못되었거나 파일이 없음

**해결**:
1. 인증서 파일 존재 확인
2. 파일 경로 확인 (절대 경로 사용)
3. 파일 권한 확인 (읽기 가능)
4. 파일 내용 확인 (올바른 PEM 형식인지)

### "CORS 오류"

**원인**: 백엔드 CORS 설정에 HTTPS가 포함되지 않음

**해결**:
1. `server/config.env` 파일 확인
2. `CORS_ORIGIN`에 `https://seomgim.foryou.me` 포함 확인
3. 백엔드 서버 재시작: `pm2 restart seomgim`

## 📝 참고 사항

- **Cloudflare Origin Certificate**는 Cloudflare를 통해서만 유효합니다
- 직접 서버에 접속할 때는 인증서 경고가 나타날 수 있습니다 (정상)
- Cloudflare를 통한 접속은 정상적으로 작동합니다
- 인증서는 15년간 유효하며 자동 갱신 불필요

## ✅ 완료 체크리스트

- [ ] Cloudflare Origin Certificate 생성
- [ ] 인증서 파일 저장 (`cert.pem`, `key.pem`)
- [ ] Cloudflare SSL 모드: Full 또는 Full (strict)
- [ ] Nginx 설정 테스트 통과
- [ ] Nginx 재시작
- [ ] 백엔드 서버 재시작
- [ ] HTTPS 접속 테스트 성공
- [ ] HTTP → HTTPS 리디렉션 확인

