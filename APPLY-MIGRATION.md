# 데이터베이스 마이그레이션 적용 가이드

## 변경 사항

`post_views` 테이블을 분석 용도로 사용하기 위해 다음과 같이 변경되었습니다:

1. **UNIQUE KEY 제약 조건 제거**: 중복 조회 기록 허용
2. **ip_address NULL 허용**: 비로그인 사용자도 기록 가능
3. **항상 기록 저장**: 게시글을 읽을 때마다 사용자 ID와 IP 주소 저장

---

## 마이그레이션 실행 방법

### 방법 1: Node.js 스크립트 실행 (권장)

```powershell
cd server
node migrations/apply-post-views-migration.js
```

### 방법 2: SQL 직접 실행

데이터베이스 클라이언트(HeidiSQL, MySQL Workbench 등)에서 다음 SQL 실행:

```sql
-- UNIQUE KEY 제약 조건 제거
ALTER TABLE post_views DROP INDEX unique_post_user_ip;

-- ip_address를 NULL 허용으로 변경
ALTER TABLE post_views MODIFY ip_address VARCHAR(45) NULL COMMENT 'IP 주소 (NULL 허용)';
```

---

## 확인 방법

마이그레이션 후 다음 SQL로 확인:

```sql
-- 테이블 구조 확인
DESCRIBE post_views;

-- 인덱스 확인 (unique_post_user_ip가 없어야 함)
SHOW INDEXES FROM post_views;
```

---

## 주의사항

- 마이그레이션 실행 전 데이터베이스 백업 권장
- 기존 중복 데이터가 있어도 문제없음 (이제 중복 허용)
- 마이그레이션 후 서버 재시작 필요

---

## 변경된 기능

### 이전
- 중복 조회 방지 (UNIQUE KEY)
- 로그인 사용자만 조회 기록 저장
- 읽지 않은 글 수 계산 및 말풍선 표시

### 현재
- 중복 조회 허용 (분석 용도)
- 로그인/비로그인 사용자 모두 조회 기록 저장
- 사용자 ID와 IP 주소 모두 수집
- 말풍선 기능 제거

