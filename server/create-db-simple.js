// 간단한 데이터베이스 생성 스크립트
// MySQL 클라이언트 명령어로 실행하기 위한 SQL 출력

console.log(`
-- 다음 SQL을 MariaDB 클라이언트에서 실행하세요:
-- mysql -u root -p@park7616@ < create-db.sql

CREATE DATABASE IF NOT EXISTS seomgim DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE seomgim;

CREATE TABLE IF NOT EXISTS board_categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(50) NOT NULL UNIQUE,
  category_code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS board_posts (
  post_id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  author_name VARCHAR(50) NOT NULL,
  author_password VARCHAR(255) NOT NULL,
  is_notice BOOLEAN DEFAULT FALSE,
  view_count INT DEFAULT 0,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES board_categories(category_id) ON DELETE CASCADE,
  INDEX idx_category (category_id),
  INDEX idx_created (created_at DESC),
  INDEX idx_notice (is_notice, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS board_comments (
  comment_id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  content TEXT NOT NULL,
  author_name VARCHAR(50) NOT NULL,
  author_password VARCHAR(255) NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES board_posts(post_id) ON DELETE CASCADE,
  INDEX idx_post (post_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO board_categories (category_name, category_code, description, is_private, display_order) VALUES
('공지사항', 'notice', '교회 공지사항 게시판', FALSE, 1),
('성도전용게시판', 'member', '성도들을 위한 게시판', TRUE, 2),
('기도요청', 'prayer', '기도 제목을 나누는 게시판', FALSE, 3),
('자유게시판', 'free', '자유롭게 소통하는 게시판', FALSE, 4)
ON DUPLICATE KEY UPDATE category_name=category_name;

SELECT '데이터베이스 생성 완료!' as result;
`);

