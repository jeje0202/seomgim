# 읽지 않은 글 수 기능 테스트 가이드

## 📋 수정 내용

### 1. 프론트엔드 수정 (2025-01-11)

#### `components/PostDetailModal.tsx`
- 게시글 로드 후 onUpdate 호출 지연: **1.5초 → 2초**
- 디버깅 로그 강화 (이모지 추가로 가독성 향상)
  - 📖 게시글 로드 시작
  - ✅ 게시글 로드 완료
  - ⏰ onUpdate 호출 예정
  - 📢 onUpdate 호출
  - ❌ 오류 발생

#### `components/BoardSection.tsx`
- handlePostUpdate 함수 수정
  - PostDetailModal에서 이미 2초 지연했으므로 **즉시 갱신**
  - 디버깅 로그 강화
    - 🔄 카테고리 갱신 시작
    - ✅ 카테고리 갱신 완료 (카테고리별 상세 정보 포함)
    - ❌ 오류 발생

### 2. 백엔드 로직 (변경 없음 - 이미 올바름)

#### 조회 기록 저장 (`server/routes/board.js`)
```javascript
// GET /api/board/posts/:id
// 로그인 사용자: user_id + ip_address 모두 저장
// 비로그인 사용자: user_id=NULL + ip_address 저장
INSERT INTO post_views (post_id, user_id, ip_address) VALUES (?, ?, ?)
```

#### 읽지 않은 글 계산 (`server/routes/board.js`)
```javascript
// GET /api/board/categories
// 로그인 사용자: user_id로만 조회 (IP 무관)
LEFT JOIN post_views pv ON p.post_id = pv.post_id AND pv.user_id = ?

// 비로그인 사용자: IP로만 조회 (user_id IS NULL 조건 포함)
LEFT JOIN post_views pv ON p.post_id = pv.post_id AND pv.ip_address = ? AND pv.user_id IS NULL
```

## 🧪 테스트 방법

### 준비
1. 브라우저 개발자 도구(F12) 열기
2. Console 탭 열기
3. `seomgim.foryou.me`에 로그인

### 테스트 절차

#### 1단계: 초기 상태 확인
1. 게시판 페이지로 이동
2. 콘솔에서 다음 로그 확인:
   ```
   [BoardSection] ✅ 카테고리 정보 갱신 완료:
   ```
3. 각 카테고리의 `unread_count` 확인
4. UI에서 빨간색 풍선 숫자가 콘솔의 `unread_count`와 일치하는지 확인

#### 2단계: 게시글 읽기
1. 읽지 않은 글이 있는 카테고리 선택 (빨간 풍선이 표시된 카테고리)
2. 읽지 않은 게시글 하나 클릭
3. 콘솔에서 다음 로그 순서 확인:
   ```
   [PostDetailModal] 📖 게시글 로드 시작 - postId: XX
   [PostDetailModal] ✅ 게시글 로드 완료 - postId: XX title: ...
   [PostDetailModal] ⏰ 2초 후 onUpdate 호출 예정 - postId: XX
   ```
4. 2초 후:
   ```
   [PostDetailModal] 📢 onUpdate 호출 - postId: XX
   [BoardSection] ⏰ 즉시 카테고리 갱신 시작...
   [BoardSection] 🔄 카테고리 정보 갱신 시작... (게시글 읽은 후)
   [BoardSection] ✅ 카테고리 정보 갱신 완료: [...]
   ```
5. 마지막 로그에서 해당 카테고리의 `unread_count`가 **1 감소**했는지 확인

#### 3단계: UI 업데이트 확인
1. 모달을 닫지 말고 그대로 대기 (또는 닫아도 됨)
2. 빨간 풍선 숫자가 **1 감소**했는지 확인
3. 같은 게시글을 다시 클릭해도 숫자가 변하지 않는지 확인 (중복 조회 방지)

#### 4단계: 다른 게시글로 반복
1. 같은 카테고리의 다른 읽지 않은 게시글 클릭
2. 2-3단계 반복
3. 읽지 않은 글을 모두 읽으면 풍선이 사라지는지 확인

### 예상 결과

**✅ 정상 동작:**
- 게시글 읽은 후 2초 이내에 카테고리 갱신
- 콘솔에 `unread_count` 감소 로그 출력
- UI의 빨간 풍선 숫자 실시간 감소
- 같은 글 재조회 시 숫자 불변 (중복 조회 방지)

**❌ 비정상 동작:**
- 게시글을 읽었는데 풍선 숫자가 그대로
- 콘솔에 에러 로그 출력
- 카테고리 갱신 로그는 나오는데 `unread_count`가 변하지 않음

## 🔍 문제 해결

### 문제 1: 풍선 숫자가 변하지 않음

**증상:** 게시글을 읽었는데 풍선 숫자가 그대로

**진단:**
1. 콘솔에서 로그 확인:
   - `[PostDetailModal] 📢 onUpdate 호출` 로그가 나오는가?
   - `[BoardSection] ✅ 카테고리 정보 갱신 완료` 로그가 나오는가?
   - 갱신 완료 로그의 `unread_count` 값이 감소했는가?

2. 네트워크 탭 확인:
   - `GET /api/board/posts/:id` 요청이 성공했는가? (200 OK)
   - 2초 후 `GET /api/board/categories` 요청이 발생했는가?
   - `categories` 응답의 `unread_count` 값을 확인

**해결:**
- 로그가 나오지 않으면: 프론트엔드 빌드 재실행 (`npm run build`)
- 로그는 나오는데 `unread_count`가 안 변하면: 백엔드 문제 (아래 참고)

### 문제 2: 서버 로그 확인 필요

**PowerShell 관리자 권한으로 실행:**

```powershell
# pm2 상태 확인
pm2 list

# 서버 로그 실시간 확인
pm2 logs seomgim

# 또는 특정 패턴만 필터링
pm2 logs seomgim --lines 50 | Select-String -Pattern "카테고리 조회|게시글 조회|조회수 증가"
```

**확인할 로그:**
```
[게시글 조회] ✅ 조회수 증가 및 기록 저장 성공 - post_id: XX, user_id: YY, ip: ZZ
[카테고리 조회] 로그인 사용자 - category_id: AA, user_id: YY, unread_count: BB
```

### 문제 3: 데이터베이스 직접 확인

**MariaDB 접속:**
```sql
-- post_views 테이블 확인
SELECT * FROM post_views ORDER BY viewed_at DESC LIMIT 20;

-- 특정 사용자의 조회 기록
SELECT pv.*, p.title 
FROM post_views pv
JOIN board_posts p ON pv.post_id = p.post_id
WHERE pv.user_id = 1  -- 본인의 user_id로 변경
ORDER BY pv.viewed_at DESC;

-- 읽지 않은 글 수 직접 계산 (user_id = 1)
SELECT 
  c.category_name,
  COUNT(DISTINCT p.post_id) as unread_count
FROM board_posts p
JOIN board_categories c ON p.category_id = c.category_id
LEFT JOIN post_views pv ON p.post_id = pv.post_id AND pv.user_id = 1
WHERE p.is_deleted = FALSE
AND pv.view_id IS NULL
GROUP BY c.category_id, c.category_name
ORDER BY c.display_order;
```

## 📊 테스트 체크리스트

- [ ] 프로덕션 빌드 완료 (`npm run build`)
- [ ] 브라우저에서 `seomgim.foryou.me` 접속
- [ ] 로그인 완료
- [ ] 개발자 도구(F12) Console 탭 열기
- [ ] 게시판 페이지 이동 (초기 `unread_count` 확인)
- [ ] 읽지 않은 게시글 클릭
- [ ] 2초 후 콘솔 로그 확인 (📢 onUpdate 호출, 🔄 카테고리 갱신)
- [ ] `unread_count` 감소 확인 (콘솔 로그)
- [ ] UI 풍선 숫자 감소 확인
- [ ] 같은 게시글 재조회 시 숫자 불변 확인
- [ ] 다른 게시글로 반복 테스트

## 💡 추가 팁

### 강제 새로고침
- Windows: `Ctrl + Shift + R`
- 브라우저 캐시가 문제일 경우 사용

### 개발자 도구 네트워크 탭
- "Preserve log" 체크: 페이지 이동 시에도 로그 유지
- "Disable cache" 체크: 캐시 비활성화

### pm2 로그 실시간 모니터링
```powershell
# 관리자 PowerShell에서
pm2 logs seomgim --lines 100
```

### 디버깅 스크립트
```powershell
# 프로젝트 루트에서
.\debug-unread-count.ps1
```

## 📝 기술 세부사항

### 타이밍 다이어그램

```
사용자 행동          프론트엔드                백엔드                   데이터베이스
----------          ----------                ------                   ------------
게시글 클릭
  |
  |─────────────► loadPost()
  |                  |
  |                  |──────────────► GET /posts/:id
  |                  |                    |
  |                  |                    |──────────► SELECT post
  |                  |                    |──────────► INSERT post_views
  |                  |                    |──────────► UPDATE view_count
  |                  |◄────────────────── (200 OK)
  |                  |
  |                  |─(2초 지연)──►
  |                  |
  |                  |──────────────► onUpdate()
  |                  |                  |
  |                  |                  |──► handlePostUpdate()
  |                  |                       |
  |                  |                       |──────► getCategories()
  |                  |                              |
  |                  |                              |──────► GET /categories
  |                  |                                   |
  |                  |                                   |──────► SELECT ... LEFT JOIN post_views
  |                  |                              ◄─────────── (unread_count 감소)
  |                  |                       ◄──────────
  |                  |                       |
  |                  |                       |──► setCategories()
  |                  |
  |◄──────────────── (UI 업데이트: 풍선 숫자 감소)
```

### 주요 변경 사항 요약

1. **지연 시간 증가**: 1.5초 → 2초
   - 서버 트랜잭션 완료 시간 충분히 확보
   
2. **로그 강화**: 이모지 추가
   - 📖 로드 시작
   - ✅ 성공
   - ⏰ 대기
   - 📢 이벤트
   - 🔄 갱신
   - ❌ 오류
   
3. **갱신 로직 단순화**:
   - PostDetailModal: 2초 지연 후 onUpdate() 호출
   - BoardSection: onUpdate() 받으면 즉시 갱신

## 🎯 성공 기준

- ✅ 게시글 읽은 후 2초 이내에 풍선 숫자 감소
- ✅ 콘솔 로그에 정확한 `unread_count` 표시
- ✅ 중복 조회 시 숫자 불변
- ✅ 모든 게시글 읽으면 풍선 사라짐
- ✅ 로그인/로그아웃 시 즉시 반영
- ✅ 30초마다 자동 갱신 (백그라운드)

