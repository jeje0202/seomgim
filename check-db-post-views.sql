-- post_views 테이블 확인 SQL
-- MariaDB에 접속하여 실행: mysql -u root -p seomgim_db < check-db-post-views.sql

-- 1. post_views 테이블 구조 확인
SHOW CREATE TABLE post_views;

-- 2. post_views 테이블 데이터 확인 (최근 20개)
SELECT 
  view_id,
  post_id,
  user_id,
  ip_address,
  viewed_at
FROM post_views
ORDER BY viewed_at DESC
LIMIT 20;

-- 3. 사용자별 조회한 게시글 수
SELECT 
  COALESCE(user_id, 0) as user_id,
  COUNT(*) as view_count
FROM post_views
GROUP BY user_id
ORDER BY view_count DESC;

-- 4. 게시판별 조회 기록 통계
SELECT 
  c.category_name,
  COUNT(DISTINCT pv.post_id) as viewed_posts,
  COUNT(DISTINCT pv.user_id) as unique_users,
  COUNT(*) as total_views
FROM post_views pv
JOIN board_posts p ON pv.post_id = p.post_id
JOIN board_categories c ON p.category_id = c.category_id
WHERE p.is_deleted = FALSE
GROUP BY c.category_id, c.category_name
ORDER BY total_views DESC;

-- 5. 읽지 않은 글 수 계산 (예: user_id = 1)
-- user_id를 실제 사용자 ID로 변경하여 실행
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

