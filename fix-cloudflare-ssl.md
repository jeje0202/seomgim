# Cloudflare SSL 경고 해결 방법

## 🔍 문제 원인

브라우저에서 "주의 요함" 경고가 나타나는 이유는:

1. **Cloudflare SSL 모드가 Flexible로 설정됨**
   - Cloudflare ↔ 브라우저: HTTPS ✅
   - Cloudflare ↔ 서버: HTTP ❌
   - 브라우저는 HTTPS로 접속하지만, 서버는 HTTP만 제공하여 경고 발생

2. **또는 Cloudflare가 프록시하지 않음**
   - DNS 설정에서 프록시 모드(주황색 구름)가 아닌 DNS 전용 모드(회색 구름)로 설정됨

## ✅ 해결 방법

### 방법 1: Cloudflare SSL 모드를 Full로 변경 (권장)

1. **Cloudflare 대시보드 접속**
   - https://dash.cloudflare.com
   - `seomgim.foryou.me` 도메인 선택

2. **SSL/TLS 설정 변경**
   - 왼쪽 메뉴: **SSL/TLS** 클릭
   - **Overview** 탭
   - 현재 모드 확인:
     - **Flexible** → **Full** 또는 **Full (strict)**로 변경
     - **Full** 또는 **Full (strict)** → 이미 올바른 설정

3. **변경 후 대기**
   - 설정 변경 후 1-2분 대기
   - 브라우저 캐시 삭제: `Ctrl + Shift + R`

### 방법 2: DNS 프록시 모드 확인

1. **Cloudflare 대시보드**
   - **DNS** 메뉴 클릭
   - `seomgim.foryou.me` 레코드 확인
   - **프록시 상태** 확인:
     - 🟠 **주황색 구름 (프록시됨)** → 정상 ✅
     - ⚪ **회색 구름 (DNS 전용)** → 주황색으로 변경 필요

2. **프록시 모드로 변경**
   - 회색 구름 클릭 → 주황색 구름으로 변경
   - 몇 분 대기 후 다시 테스트

### 방법 3: Nginx에서 HTTPS만 제공 (Full 모드용)

현재 Nginx 설정은 이미 HTTPS를 제공하도록 설정되어 있습니다.

**확인 사항:**
- ✅ 포트 443 리스닝 설정됨
- ✅ SSL 인증서 경로 설정됨
- ✅ 인증서 파일 존재함

**추가 확인:**
```powershell
# Nginx가 포트 443을 리스닝하는지 확인
netstat -an | findstr :443
```

## 🔧 즉시 해결 (Cloudflare Flexible 모드 사용 시)

만약 Cloudflare SSL 모드를 Flexible로 유지하고 싶다면:

1. **Nginx에서 HTTPS 블록 제거** (HTTP만 제공)
2. **Cloudflare가 HTTPS를 처리**하도록 설정

하지만 이 방법은 보안상 권장되지 않습니다. **Full 모드를 사용하는 것이 좋습니다.**

## 📋 체크리스트

- [ ] Cloudflare SSL 모드: **Full** 또는 **Full (strict)**
- [ ] DNS 레코드: **프록시 모드 (주황색 구름)**
- [ ] Nginx가 포트 443 리스닝 중
- [ ] SSL 인증서 파일 존재 (`cert.pem`, `key.pem`)
- [ ] Nginx 설정 테스트 통과
- [ ] 브라우저 캐시 삭제 후 재접속

## 🎯 가장 가능성 높은 해결책

**Cloudflare SSL 모드를 Flexible에서 Full로 변경하세요!**

1. Cloudflare 대시보드 → SSL/TLS → Overview
2. **Full** 또는 **Full (strict)** 선택
3. 1-2분 대기
4. 브라우저에서 `Ctrl + Shift + R` (하드 리프레시)
5. `https://seomgim.foryou.me` 접속 확인

이렇게 하면 경고가 사라지고 정상적인 HTTPS 연결이 됩니다!

