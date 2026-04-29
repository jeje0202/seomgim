# Cloudflare HTTPS 설정 가이드

## 방법 1: Cloudflare Origin Certificate (권장) ⭐

### 1단계: Cloudflare Origin Certificate 생성

1. **Cloudflare 대시보드 접속**
   - https://dash.cloudflare.com 접속
   - `seomgim.foryou.me` 도메인 선택

2. **SSL/TLS 설정**
   - 왼쪽 메뉴에서 **SSL/TLS** 클릭
   - **Origin Server** 탭 클릭
   - **Create Certificate** 버튼 클릭

3. **인증서 생성 옵션**
   - **Private key type**: RSA (2048)
   - **Hostnames**: 
     - `seomgim.foryou.me`
     - `*.seomgim.foryou.me` (선택사항)
   - **Certificate Validity**: 15년 (최대)
   - **Create** 클릭

4. **인증서 다운로드**
   - **Origin Certificate** (공개키) 복사
   - **Private Key** (개인키) 복사
   - ⚠️ **중요**: 이 키들은 다시 볼 수 없으므로 안전하게 저장하세요!

### 2단계: 인증서 파일 저장

**PowerShell 관리자 권한으로 실행:**

```powershell
# SSL 폴더 생성
New-Item -ItemType Directory -Path "C:\nginx\conf\ssl" -Force

# 인증서 파일 저장
# Origin Certificate를 cert.pem으로 저장
# Private Key를 key.pem으로 저장

# 예시:
# 1. Cloudflare에서 복사한 Origin Certificate 내용을 cert.pem에 저장
# 2. Cloudflare에서 복사한 Private Key 내용을 key.pem에 저장
```

**파일 구조:**
```
C:\nginx\conf\ssl\
  ├── cert.pem      (Origin Certificate)
  └── key.pem       (Private Key)
```

### 3단계: Nginx 설정 업데이트

`C:\nginx\conf\foryou_apps.conf` 파일에 HTTPS 블록이 추가됩니다.

### 4단계: Cloudflare SSL 모드 설정

1. **Cloudflare 대시보드**
   - SSL/TLS → Overview
   - **Full** 또는 **Full (strict)** 모드 선택
   - ⚠️ **Flexible 모드가 아닌 Full 모드여야 합니다!**

### 5단계: Nginx 재시작

```powershell
# 관리자 PowerShell
cd C:\nginx
nginx -t                    # 설정 테스트
Stop-Process -Name nginx -Force
.\nginx.exe                 # Nginx 시작
```

---

## 방법 2: Let's Encrypt (무료, 자동 갱신)

### 1단계: Certbot 설치

```powershell
# Chocolatey로 설치 (관리자 PowerShell)
choco install certbot

# 또는 수동 다운로드
# https://github.com/certbot/certbot/releases
```

### 2단계: SSL 인증서 발급

```powershell
# 관리자 PowerShell
certbot certonly --standalone -d seomgim.foryou.me -d www.seomgim.foryou.me
```

### 3단계: 인증서 위치 확인

일반적으로 다음 위치에 저장됩니다:
```
C:\Certbot\live\seomgim.foryou.me\
  ├── fullchain.pem
  └── privkey.pem
```

### 4단계: Nginx 설정 업데이트

인증서 경로를 Nginx 설정에 추가합니다.

### 5단계: 자동 갱신 설정

```powershell
# 작업 스케줄러에 자동 갱신 작업 추가
certbot renew --quiet
```

---

## 현재 권장: Cloudflare Origin Certificate ✅

**장점:**
- ✅ 무료
- ✅ 15년 유효기간
- ✅ Cloudflare와 완벽 호환
- ✅ 와일드카드 인증서 지원
- ✅ 자동 갱신 불필요

**단점:**
- ⚠️ Cloudflare를 통해서만 유효 (직접 접속 시 경고)

---

## 테스트 방법

설정 완료 후:

1. **HTTPS 접속 테스트**
   ```
   https://seomgim.foryou.me
   ```

2. **SSL Labs 테스트**
   ```
   https://www.ssllabs.com/ssltest/analyze.html?d=seomgim.foryou.me
   ```

3. **브라우저에서 확인**
   - 주소창에 자물쇠 아이콘 표시 확인
   - "연결이 안전합니다" 메시지 확인

---

## 문제 해결

### "NET::ERR_CERT_AUTHORITY_INVALID" 오류

**원인**: Cloudflare SSL 모드가 Flexible로 설정됨

**해결**:
1. Cloudflare 대시보드 → SSL/TLS → Overview
2. **Full** 또는 **Full (strict)** 모드로 변경

### "연결이 거부되었습니다"

**원인**: Nginx가 포트 443을 리스닝하지 않음

**해결**:
1. Nginx 설정에 `listen 443 ssl;` 확인
2. 방화벽에서 포트 443 허용 확인
3. Nginx 재시작

### 인증서 경로 오류

**원인**: 인증서 파일 경로가 잘못됨

**해결**:
1. 파일 경로 확인 (절대 경로 사용)
2. 파일 권한 확인 (읽기 가능)
3. `nginx -t` 명령으로 설정 테스트

