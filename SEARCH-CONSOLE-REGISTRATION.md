# 검색 엔진 등록 가이드

## Google Search Console 등록

### 1단계: 속성 추가
1. https://search.google.com/search-console 접속
2. "속성 추가" 클릭
3. "URL 접두어" 선택
4. `https://seomgim.foryou.me` 입력
5. "계속" 클릭

### 2단계: 소유권 확인

#### 방법 1: HTML 메타 태그 (권장)
1. Google이 제공하는 메타 태그를 복사합니다.
   - 예: `<meta name="google-site-verification" content="ABC123XYZ...">`
2. `index.html` 파일의 `<head>` 섹션에 추가합니다.
3. 파일을 저장하고 서버에 배포합니다.
4. Google Search Console에서 "확인" 버튼을 클릭합니다.

#### 방법 2: HTML 파일 업로드
1. Google이 제공하는 HTML 파일을 다운로드합니다.
2. 파일명을 확인합니다 (예: `google1234567890abcdef.html`)
3. `public/` 폴더에 업로드합니다.
4. Google Search Console에서 "확인" 버튼을 클릭합니다.

### 3단계: 사이트맵 제출
1. 왼쪽 메뉴에서 "Sitemaps" 클릭
2. "새 사이트맵 추가" 클릭
3. `sitemap.xml` 입력
4. "제출" 클릭

---

## 네이버 웹마스터 도구 등록

### 1단계: 사이트 등록
1. https://searchadvisor.naver.com/ 접속
2. "웹마스터 도구" 메뉴 클릭
3. "사이트 추가" 클릭
4. 사이트 URL 입력: `https://seomgim.foryou.me`
5. "확인" 클릭

### 2단계: 소유권 확인

#### 방법 1: HTML 메타 태그 (권장)
1. 네이버가 제공하는 메타 태그를 복사합니다.
   - 예: `<meta name="naver-site-verification" content="ABC123XYZ...">`
2. `index.html` 파일의 `<head>` 섹션에 추가합니다.
3. 파일을 저장하고 서버에 배포합니다.
4. 네이버 웹마스터 도구에서 "확인" 버튼을 클릭합니다.

#### 방법 2: HTML 파일 업로드
1. 네이버가 제공하는 HTML 파일을 다운로드합니다.
2. 파일명을 확인합니다 (예: `naver1234567890abcdef.html`)
3. `public/` 폴더에 업로드합니다.
4. 네이버 웹마스터 도구에서 "확인" 버튼을 클릭합니다.

### 3단계: 사이트맵 제출
1. "요청" > "사이트맵 제출" 메뉴 클릭
2. `https://seomgim.foryou.me/sitemap.xml` 입력
3. "확인" 클릭

---

## 중요 사항

1. **메타 태그 추가 위치**: `index.html`의 `<head>` 섹션 내부, 다른 메타 태그들과 함께 추가
2. **파일 배포**: 메타 태그를 추가한 후 반드시 서버에 배포해야 확인이 가능합니다
3. **확인 시간**: 소유권 확인은 보통 몇 분 내에 완료되지만, 최대 24시간이 걸릴 수 있습니다
4. **사이트맵**: 사이트맵 제출 후 인덱싱에는 며칠이 걸릴 수 있습니다

---

## 현재 상태

- ✅ `sitemap.xml` 파일 생성 완료
- ✅ `robots.txt` 파일 생성 완료
- ⏳ Google Search Console 소유권 확인 대기 중
- ⏳ 네이버 웹마스터 도구 소유권 확인 대기 중

