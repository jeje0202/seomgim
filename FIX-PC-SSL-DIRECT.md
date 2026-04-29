# PC SSL 경고 해결 (Cloudflare 우회 문제)

## 🔍 문제 원인

**Cloudflare Origin Certificate는 Cloudflare를 통해서만 유효합니다.**

PC에서 직접 서버 IP로 접속하면 인증서 경고가 나타납니다.

---

## ✅ 확인 방법

### 1단계: DNS 조회 확인

**명령 프롬프트(CMD) 또는 PowerShell에서:**

```cmd
nslookup seomgim.foryou.me
```

**정상 결과 (Cloudflare를 통함):**
```
서버:  ...
주소:  ...

이름:    seomgim.foryou.me
주소:    103.21.244.x 또는 104.16.x.x (Cloudflare IP)
```

**문제 결과 (직접 서버 IP):**
```
주소:    192.168.x.x 또는 공인 IP (서버 직접 IP)
```

---

### 2단계: hosts 파일 확인

**PowerShell 관리자 권한으로 실행:**

```powershell
notepad C:\Windows\System32\drivers\etc\hosts
```

**확인 사항:**
- `seomgim.foryou.me` 관련 줄이 있는지 확인
- 있다면 **삭제** (Cloudflare 우회 방지)

**예시 (문제가 있는 경우):**
```
192.168.0.100    seomgim.foryou.me    # 이 줄을 삭제해야 함
```

---

### 3단계: 브라우저 개발자 도구 확인

1. **브라우저에서 F12 눌러서 개발자 도구 열기**
2. **Network 탭 선택**
3. **페이지 새로고침** (`Ctrl + R`)
4. **`seomgim.foryou.me` 요청 클릭**
5. **Headers 탭에서 확인:**
   - **Request URL**: `https://seomgim.foryou.me` (도메인) ✅
   - **Request URL**: `https://192.168.x.x` (IP 주소) ❌

---

## 🔧 해결 방법

### 방법 1: hosts 파일 수정 (가장 가능성 높음)

1. **PowerShell 관리자 권한으로 실행**

2. **hosts 파일 열기**
   ```powershell
   notepad C:\Windows\System32\drivers\etc\hosts
   ```

3. **seomgim.foryou.me 관련 줄 찾기**
   - 예: `192.168.0.100    seomgim.foryou.me`

4. **해당 줄 삭제 또는 주석 처리**
   - 줄 앞에 `#` 추가: `#192.168.0.100    seomgim.foryou.me`
   - 또는 줄 전체 삭제

5. **파일 저장**

6. **DNS 캐시 플러시**
   ```powershell
   ipconfig /flushdns
   ```

7. **브라우저 재시작**

---

### 방법 2: DNS 서버 변경

**Cloudflare DNS 사용 (권장):**

1. **네트워크 설정 열기**
   - 설정 → 네트워크 및 인터넷 → 어댑터 옵션 변경
   - 사용 중인 네트워크 어댑터 우클릭 → 속성

2. **IPv4 속성**
   - 인터넷 프로토콜 버전 4(TCP/IPv4) 선택 → 속성

3. **DNS 서버 설정**
   - 다음 DNS 서버 주소 사용:
     - 기본 설정 DNS 서버: `1.1.1.1`
     - 대체 DNS 서버: `1.0.0.1`

4. **확인 클릭**

5. **DNS 캐시 플러시**
   ```powershell
   ipconfig /flushdns
   ```

---

### 방법 3: 브라우저에서 직접 도메인 입력

**북마크나 자동 완성 사용하지 말고:**

1. **주소창에 직접 입력**
   ```
   https://seomgim.foryou.me
   ```
   - ❌ `http://` 아님
   - ❌ IP 주소 아님
   - ✅ `https://seomgim.foryou.me` 정확히 입력

2. **Enter 키 누르기**

---

### 방법 4: 브라우저 캐시 완전 삭제

1. **`Ctrl + Shift + Del`**
2. **전체 기간 선택**
3. **모든 항목 선택**
4. **데이터 삭제**
5. **브라우저 재시작**

---

## 📋 단계별 해결 순서

### 1단계: hosts 파일 확인 및 수정
```powershell
# 관리자 PowerShell
notepad C:\Windows\System32\drivers\etc\hosts
# → seomgim.foryou.me 관련 줄 삭제
ipconfig /flushdns
```

### 2단계: DNS 조회 확인
```cmd
nslookup seomgim.foryou.me
# → Cloudflare IP(103.x.x.x 또는 104.x.x.x)로 해석되는지 확인
```

### 3단계: 브라우저 개발자 도구 확인
```
F12 → Network 탭 → seomgim.foryou.me 요청 → Request URL 확인
```

### 4단계: 브라우저 캐시 삭제
```
Ctrl + Shift + Del → 전체 기간 → 모든 항목 삭제
```

### 5단계: HTTPS로 직접 접속
```
주소창에 https://seomgim.foryou.me 직접 입력
```

---

## 🎯 가장 가능성 높은 해결책

**hosts 파일에 직접 IP 매핑이 있을 가능성이 높습니다!**

1. **hosts 파일 확인**
   ```powershell
   notepad C:\Windows\System32\drivers\etc\hosts
   ```

2. **seomgim.foryou.me 관련 줄 삭제**

3. **DNS 캐시 플러시**
   ```powershell
   ipconfig /flushdns
   ```

4. **브라우저 재시작**

이렇게 하면 Cloudflare를 통해 접속하게 되어 SSL 경고가 사라집니다!

---

## 🔍 추가 진단

**자동 진단 스크립트 실행:**

```powershell
# 관리자 PowerShell
cd C:\My\Seomgim-church
.\check-pc-connection.ps1
```

이 스크립트가 자동으로 다음을 확인합니다:
- DNS 조회 결과
- hosts 파일 내용
- HTTPS 연결 상태

