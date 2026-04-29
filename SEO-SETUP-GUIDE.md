# SEO 설정 가이드

이 문서는 창원섬김의교회 웹사이트의 SEO 최적화를 위한 설정 가이드입니다.

## ✅ 완료된 작업

### 1. 기본 SEO 메타 태그
- ✅ Meta Description 추가
- ✅ Meta Keywords 추가
- ✅ Open Graph 태그 (페이스북, 카카오톡 공유용)
- ✅ Twitter Card 태그
- ✅ JSON-LD 구조화된 데이터
- ✅ Canonical URL 설정

### 2. 검색 엔진 파일
- ✅ `public/robots.txt` 생성
- ✅ `public/sitemap.xml` 생성

### 3. 성능 최적화
- ✅ 중요 이미지 preload
- ✅ 폰트 preconnect
- ✅ 이미지 lazy loading 적용

### 4. 도메인 설정
- ✅ `config/site.config.ts` 생성 (중앙 관리)

## 📋 추가 설정 필요 사항

### 1. Google Search Console 등록

#### 1.1 Google Search Console 접속
1. [Google Search Console](https://search.google.com/search-console) 접속
2. Google 계정으로 로그인

#### 1.2 속성 추가
1. "속성 추가" 클릭
2. "URL 접두어" 방식 선택
3. 사이트 URL 입력: `https://seomgim.foryou.me`
4. "계속" 클릭

#### 1.3 소유권 확인
다음 중 하나의 방법으로 소유권 확인:

**방법 1: HTML 태그 (권장)**
1. Google에서 제공하는 메타 태그 복사
2. `index.html`의 `<head>` 섹션에 추가
3. "확인" 클릭

**방법 2: HTML 파일 업로드**
1. Google에서 제공하는 HTML 파일 다운로드
2. `public/` 폴더에 업로드
3. "확인" 클릭

#### 1.4 사이트맵 제출
1. 왼쪽 메뉴에서 "Sitemaps" 클릭
2. "새 사이트맵 추가" 클릭
3. `sitemap.xml` 입력
4. "제출" 클릭

#### 1.5 URL 검사
1. "URL 검사" 도구 사용
2. 주요 페이지들이 인덱싱되었는지 확인

### 2. 네이버 웹마스터 도구 등록

#### 2.1 네이버 서치어드바이저 접속
1. [네이버 서치어드바이저](https://searchadvisor.naver.com/) 접속
2. 네이버 계정으로 로그인

#### 2.2 사이트 등록
1. "웹마스터 도구" 메뉴 클릭
2. "사이트 추가" 클릭
3. 사이트 URL 입력: `https://seomgim.foryou.me`
4. "확인" 클릭

#### 2.3 소유권 확인
다음 중 하나의 방법으로 소유권 확인:

**방법 1: HTML 메타 태그 (권장)**
1. 네이버에서 제공하는 메타 태그 복사
2. `index.html`의 `<head>` 섹션에 추가
3. "확인" 클릭

**방법 2: HTML 파일 업로드**
1. 네이버에서 제공하는 HTML 파일 다운로드
2. `public/` 폴더에 업로드
3. "확인" 클릭

**방법 3: robots.txt 파일**
1. `public/robots.txt` 파일에 네이버에서 제공하는 코드 추가
2. "확인" 클릭

#### 2.4 사이트맵 제출
1. "요청" > "사이트맵 제출" 메뉴 클릭
2. `https://seomgim.foryou.me/sitemap.xml` 입력
3. "확인" 클릭

### 3. 추가 최적화 권장 사항

#### 3.1 이미지 최적화
- ✅ 이미지 alt 텍스트 추가 완료
- 🔄 이미지 WebP 형식 변환 (선택사항)
- 🔄 이미지 압축 (선택사항)

#### 3.2 성능 최적화
- ✅ 중요 리소스 preload 완료
- ✅ 이미지 lazy loading 완료
- 🔄 코드 스플리팅 (선택사항)
- 🔄 서비스 워커 추가 (선택사항)

#### 3.3 구조화된 데이터 확장
현재 기본 구조화된 데이터가 추가되어 있습니다. 필요시 다음을 추가할 수 있습니다:
- BreadcrumbList (페이지 경로)
- Article (게시글)
- ImageObject (이미지)

#### 3.4 소셜 미디어 링크
`config/site.config.ts`의 `socialLinks` 배열에 소셜 미디어 링크를 추가하면 구조화된 데이터에 반영됩니다.

## 🔧 설정 파일 수정

### 도메인 변경 시
`config/site.config.ts` 파일에서 도메인을 수정하면 모든 SEO 관련 URL이 자동으로 업데이트됩니다:

```typescript
export const siteConfig = {
  domain: 'https://your-new-domain.com',
  // ...
};
```

그 후 다음 파일들도 수동으로 업데이트해야 합니다:
- `index.html` (og:url, canonical 등)
- `public/robots.txt` (Sitemap URL)
- `public/sitemap.xml` (모든 URL)

## 📊 모니터링

### Google Search Console
- 인덱싱 상태 확인
- 검색 성능 모니터링
- 모바일 사용성 확인
- Core Web Vitals 확인

### 네이버 서치어드바이저
- 색인 현황 확인
- 검색 노출 현황 확인
- 모바일 최적화 확인

## 📝 참고 자료

- [Google Search Console 도움말](https://support.google.com/webmasters)
- [네이버 서치어드바이저 도움말](https://searchadvisor.naver.com/help)
- [Schema.org 문서](https://schema.org/)
- [Open Graph 프로토콜](https://ogp.me/)

## ⚠️ 주의사항

1. **도메인 변경 시**: 모든 SEO 관련 파일의 URL을 업데이트해야 합니다.
2. **사이트맵 업데이트**: 새로운 페이지가 추가되면 `sitemap.xml`을 업데이트하세요.
3. **메타 태그**: 페이지별로 다른 메타 태그가 필요한 경우 `utils/seo.ts`의 `updateMetaTags` 함수를 사용하세요.

## 🎯 다음 단계

1. Google Search Console 등록 및 소유권 확인
2. 네이버 웹마스터 도구 등록 및 소유권 확인
3. 사이트맵 제출
4. 검색 결과 모니터링 시작
5. 필요시 추가 최적화 진행

