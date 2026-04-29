-- post_views 테이블의 UNIQUE KEY 제약 조건 제거
-- 중복 조회 기록을 허용하여 분석 용도로 사용하기 위함

-- UNIQUE KEY 제약 조건 제거
ALTER TABLE post_views DROP INDEX unique_post_user_ip;

-- ip_address를 NULL 허용으로 변경 (비로그인 사용자도 기록 가능)
ALTER TABLE post_views MODIFY ip_address VARCHAR(45) NULL COMMENT 'IP 주소 (NULL 허용)';

