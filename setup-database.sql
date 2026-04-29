-- 창원섬김의교회 게시판 데이터베이스 설정
-- MariaDB/MySQL 스크립트

-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS seomgim 
  DEFAULT CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE seomgim;

-- 게시판 카테고리 테이블
CREATE TABLE IF NOT EXISTS board_categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(50) NOT NULL UNIQUE COMMENT '게시판 이름',
  category_code VARCHAR(20) NOT NULL UNIQUE COMMENT '게시판 코드',
  description TEXT COMMENT '설명',
  is_private BOOLEAN DEFAULT FALSE COMMENT '성도전용 여부',
  display_order INT DEFAULT 0 COMMENT '표시 순서',
  is_active BOOLEAN DEFAULT TRUE COMMENT '활성화 여부',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='게시판 카테고리';

-- 게시글 테이블
CREATE TABLE IF NOT EXISTS board_posts (
  post_id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL COMMENT '게시판 카테고리 ID',
  title VARCHAR(200) NOT NULL COMMENT '제목',
  content TEXT NOT NULL COMMENT '내용',
  author_name VARCHAR(50) NOT NULL COMMENT '작성자 이름',
  author_password VARCHAR(255) NOT NULL COMMENT '비밀번호 (해시)',
  is_notice BOOLEAN DEFAULT FALSE COMMENT '공지사항 여부',
  view_count INT DEFAULT 0 COMMENT '조회수',
  is_deleted BOOLEAN DEFAULT FALSE COMMENT '삭제 여부',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '작성일',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  FOREIGN KEY (category_id) REFERENCES board_categories(category_id) ON DELETE CASCADE,
  INDEX idx_category (category_id),
  INDEX idx_created (created_at DESC),
  INDEX idx_notice (is_notice, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='게시글';

-- 댓글 테이블
CREATE TABLE IF NOT EXISTS board_comments (
  comment_id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL COMMENT '게시글 ID',
  content TEXT NOT NULL COMMENT '댓글 내용',
  author_name VARCHAR(50) NOT NULL COMMENT '작성자 이름',
  author_password VARCHAR(255) NOT NULL COMMENT '비밀번호 (해시)',
  is_deleted BOOLEAN DEFAULT FALSE COMMENT '삭제 여부',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '작성일',
  FOREIGN KEY (post_id) REFERENCES board_posts(post_id) ON DELETE CASCADE,
  INDEX idx_post (post_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='댓글';

-- 기본 게시판 카테고리 추가
INSERT INTO board_categories (category_name, category_code, description, is_private, display_order) VALUES
('공지사항', 'notice', '교회 공지사항 게시판', FALSE, 1),
('성도전용게시판', 'member', '성도들을 위한 게시판', TRUE, 2),
('기도요청', 'prayer', '기도 제목을 나누는 게시판', FALSE, 3),
('자유게시판', 'free', '자유롭게 소통하는 게시판', FALSE, 4);

-- 샘플 게시글 추가 (공지사항)
INSERT INTO board_posts (category_id, title, content, author_name, author_password, is_notice) VALUES
(1, '창원섬김의교회 홈페이지를 찾아주셔서 감사합니다', 
'할렐루야! 창원섬김의교회 홈페이지에 오신 것을 환영합니다.\n\n이곳에서 교회의 다양한 소식과 일정을 확인하실 수 있습니다.\n주님의 은혜가 함께 하시길 기도합니다.', 
'관리자', '$2b$10$abcdefghijklmnopqrstuv', TRUE);

SELECT '데이터베이스 및 테이블 생성 완료!' as result;

