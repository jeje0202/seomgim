// MariaDB 데이터베이스 연결 설정
const mysql = require('mysql2/promise');
require('dotenv').config({ path: './config.env' });

// 데이터베이스 연결 풀
let pool = null;

// pool getter 함수 (초기화 확인)
function getPool() {
  if (!pool) {
    throw new Error('데이터베이스가 아직 초기화되지 않았습니다. initializeDatabase()를 먼저 호출하세요.');
  }
  return pool;
}

// 연결을 가져올 때마다 한국 시간대 설정하는 헬퍼 함수
async function getConnectionWithTimezone() {
  const pool = getPool();
  const connection = await pool.getConnection();
  // 한국 시간대(Asia/Seoul, UTC+9) 설정
  try {
    await connection.query("SET time_zone = '+09:00'");
  } catch (error) {
    // 시간대 설정 실패해도 연결은 사용 가능
    console.log('⚠️ 연결 시간대 설정 실패:', error.message);
  }
  return connection;
}

// 데이터베이스 초기화 (테이블 생성)
async function initializeDatabase() {
  try {
    // 데이터베이스가 이미 존재한다고 가정하고 바로 풀 연결 사용
    // (데이터베이스는 수동으로 생성되어 있어야 함)
    console.log('✅ seomgim 데이터베이스 사용 (이미 존재한다고 가정)');

    // 데이터베이스를 지정해서 연결 풀 생성
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: 'seomgim',
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
      timezone: '+09:00', // 한국 시간대(Asia/Seoul, UTC+9) 설정
      authPlugins: {
        mysql_native_password: () => require('mysql2/lib/auth_plugins/mysql_native_password')
      }
    });

    const connection = await pool.getConnection();

    // 한국 시간대(Asia/Seoul, UTC+9) 설정 (추가 확인)
    try {
      await connection.query("SET time_zone = '+09:00'");
      console.log('✅ 데이터베이스 시간대를 한국 시간대(Asia/Seoul, UTC+9)로 설정 완료');
    } catch (error) {
      console.log('⚠️ 데이터베이스 시간대 설정 실패 (기본 시간대 사용):', error.message);
    }

    console.log('✅ MariaDB seomgim 데이터베이스 연결 성공');

    // 게시판 카테고리 테이블
    await connection.query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 게시글 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS board_posts (
        post_id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT NOT NULL COMMENT '게시판 카테고리 ID',
        title VARCHAR(200) NOT NULL COMMENT '제목',
        content TEXT NOT NULL COMMENT '내용',
        author_name VARCHAR(50) NOT NULL COMMENT '작성자 이름',
        author_password VARCHAR(255) NOT NULL COMMENT '비밀번호 (해시)',
        image_url VARCHAR(500) COMMENT '이미지 URL (주보게시판용)',
        is_notice BOOLEAN DEFAULT FALSE COMMENT '공지사항 여부',
        view_count INT DEFAULT 0 COMMENT '조회수',
        is_deleted BOOLEAN DEFAULT FALSE COMMENT '삭제 여부',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '작성일',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
        FOREIGN KEY (category_id) REFERENCES board_categories(category_id) ON DELETE CASCADE,
        INDEX idx_category (category_id),
        INDEX idx_created (created_at DESC),
        INDEX idx_notice (is_notice, created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 기존 테이블에 image_url 컬럼 추가 (없는 경우)
    try {
      await connection.query(`
        ALTER TABLE board_posts 
        ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) COMMENT '이미지 URL (주보게시판용)'
      `);
    } catch (error) {
      // 컬럼이 이미 존재하는 경우 무시
      if (!error.message.includes('Duplicate column name')) {
        console.log('이미지 URL 컬럼 추가 확인:', error.message);
      }
    }

    // 댓글 테이블
    await connection.query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 사용자 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE COMMENT '사용자명',
        nickname VARCHAR(50) NOT NULL UNIQUE COMMENT '닉네임(별명)',
        password VARCHAR(255) NOT NULL COMMENT '비밀번호 (해시)',
        name VARCHAR(50) NOT NULL COMMENT '이름',
        role ENUM('super-admin', 'admin', 'manager', 'user') DEFAULT 'user' COMMENT '권한',
        is_active BOOLEAN DEFAULT TRUE COMMENT '활성화 여부',
        is_member BOOLEAN DEFAULT FALSE COMMENT '성도여부',
        is_approved BOOLEAN DEFAULT FALSE COMMENT '승인여부 (모든 신규가입자는 관리자 승인 필요)',
        last_login TIMESTAMP NULL COMMENT '마지막 로그인',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '가입일',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
        INDEX idx_username (username),
        INDEX idx_nickname (nickname),
        INDEX idx_role (role),
        INDEX idx_member (is_member, is_approved)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 기존 테이블에 필드 추가/변경 (이미 존재하는 경우 무시)
    try {
      await connection.query('ALTER TABLE users ADD COLUMN is_member BOOLEAN DEFAULT FALSE COMMENT "성도여부"');
    } catch (e) {
      // 컬럼이 이미 존재하면 무시
    }
    try {
      await connection.query('ALTER TABLE users ADD COLUMN is_approved BOOLEAN DEFAULT FALSE COMMENT "승인여부"');
    } catch (e) {
      // 컬럼이 이미 존재하면 무시
    }
    // email 컬럼이 있으면 nickname으로 변경
    try {
      const [columns] = await connection.query("SHOW COLUMNS FROM users LIKE 'email'");
      if (columns.length > 0) {
        // email 컬럼이 있으면 nickname으로 변경
        await connection.query('ALTER TABLE users CHANGE COLUMN email nickname VARCHAR(50) NOT NULL UNIQUE COMMENT "닉네임(별명)"');
      }
    } catch (e) {
      // 이미 nickname이 있거나 변경 실패 시
      try {
        await connection.query('ALTER TABLE users ADD COLUMN nickname VARCHAR(50) NOT NULL UNIQUE COMMENT "닉네임(별명)"');
      } catch (e2) {
        // 컬럼이 이미 존재하면 무시
      }
    }

    // 교회소식 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS church_news (
        news_id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL COMMENT '제목',
        content TEXT NOT NULL COMMENT '내용',
        summary VARCHAR(500) COMMENT '요약',
        tag VARCHAR(20) NOT NULL COMMENT '태그 (공지, 행사, 모집 등)',
        author_name VARCHAR(50) NOT NULL COMMENT '작성자',
        image_url VARCHAR(500) COMMENT '이미지 URL (JSON 배열)',
        view_count INT DEFAULT 0 COMMENT '조회수',
        is_pinned BOOLEAN DEFAULT FALSE COMMENT '상단 고정',
        pin_order INT DEFAULT 0 COMMENT '고정 순서 (숫자가 작을수록 먼저 표시)',
        is_deleted BOOLEAN DEFAULT FALSE COMMENT '삭제 여부',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '작성일',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
        INDEX idx_created (created_at DESC),
        INDEX idx_pinned (is_pinned, pin_order ASC, created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 기관게시판 태그 관리 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS organization_tags (
        tag_id INT AUTO_INCREMENT PRIMARY KEY,
        tag_name VARCHAR(50) NOT NULL UNIQUE COMMENT '태그 이름',
        tag_color VARCHAR(20) DEFAULT '#3b82f6' COMMENT '태그 색상',
        display_order INT DEFAULT 0 COMMENT '표시 순서',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
        INDEX idx_order (display_order, tag_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='기관게시판 태그 관리'
    `);

    // 게시글-태그 연결 테이블 (태그 이름을 직접 저장하여 관리 태그 삭제 후에도 게시글 태그 유지)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS post_tags (
        post_tag_id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL COMMENT '게시글 ID',
        tag_name VARCHAR(50) NOT NULL COMMENT '태그 이름 (직접 저장)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
        FOREIGN KEY (post_id) REFERENCES board_posts(post_id) ON DELETE CASCADE,
        INDEX idx_post (post_id),
        INDEX idx_tag (tag_name),
        UNIQUE KEY unique_post_tag (post_id, tag_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='게시글-태그 연결'
    `);

    // 기존 테이블에 image_url 컬럼 추가 (없는 경우)
    try {
      await connection.query(`
        ALTER TABLE church_news 
        ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) COMMENT '이미지 URL (JSON 배열)'
      `);
    } catch (error) {
      // 컬럼이 이미 존재하는 경우 무시
      if (!error.message.includes('Duplicate column name')) {
        console.log('교회소식 이미지 URL 컬럼 추가 확인:', error.message);
      }
    }

    // 기존 church_news 테이블에 pin_order 컬럼 추가 (없는 경우)
    try {
      await connection.query(`
        ALTER TABLE church_news 
        ADD COLUMN IF NOT EXISTS pin_order INT DEFAULT 0 COMMENT '고정 순서 (숫자가 작을수록 먼저 표시)'
      `);
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('교회소식 pin_order 컬럼 추가 확인:', error.message);
      }
    }

    // 기본 카테고리 데이터 확인 및 추가
    const [categories] = await connection.query('SELECT COUNT(*) as count FROM board_categories');
    if (categories[0].count === 0) {
      await connection.query(`
        INSERT INTO board_categories (category_name, category_code, description, is_private, display_order) VALUES
        ('공지사항', 'notice', '교회 공지사항 게시판', FALSE, 1),
        ('주보게시판', 'bulletin', '주보 사진을 올리는 게시판', FALSE, 2),
        ('성도전용게시판', 'member', '성도들을 위한 게시판', TRUE, 3),
        ('기도요청', 'prayer', '기도 제목을 나누는 게시판', FALSE, 4),
        ('자유게시판', 'free', '자유롭게 소통하는 게시판', FALSE, 5)
      `);
      console.log('✅ 기본 게시판 카테고리 생성 완료');
    } else {
      // 주보게시판이 없으면 추가
      const [bulletinCheck] = await connection.query(
        'SELECT COUNT(*) as count FROM board_categories WHERE category_code = ?',
        ['bulletin']
      );
      if (bulletinCheck[0].count === 0) {
        // display_order를 조정하기 위해 기존 카테고리 확인
        const [existingCategories] = await connection.query(
          'SELECT MAX(display_order) as max_order FROM board_categories'
        );
        const newOrder = (existingCategories[0].max_order || 0) + 1;

        await connection.query(`
          INSERT INTO board_categories (category_name, category_code, description, is_private, display_order) VALUES
          ('주보게시판', 'bulletin', '주보 사진을 올리는 게시판', FALSE, ?)
        `, [newOrder]);
        console.log('✅ 주보게시판 카테고리 추가 완료');
      }

      // 기관 게시판이 없으면 추가 (성도전용게시판 내부 탭)
      const [orgCheck] = await connection.query(
        'SELECT COUNT(*) as count FROM board_categories WHERE category_code = ?',
        ['organization']
      );
      if (orgCheck[0].count === 0) {
        const [existingCategories] = await connection.query(
          'SELECT MAX(display_order) as max_order FROM board_categories'
        );
        const newOrder = (existingCategories[0].max_order || 0) + 1;

        await connection.query(`
          INSERT INTO board_categories (category_name, category_code, description, is_private, display_order) VALUES
          ('기관 게시판', 'organization', '교회 기관별 소통 게시판', TRUE, ?)
        `, [newOrder]);
        console.log('✅ 기관 게시판 카테고리 추가 완료');
      }
    }

    // 첫 사용자 확인 및 최고관리자 생성
    const [userCount] = await connection.query('SELECT COUNT(*) as count FROM users');
    if (userCount[0].count === 0) {
      // 첫 사용자는 최고관리자로 자동 등록
      const bcrypt = require('bcrypt');
      const defaultPassword = await bcrypt.hash('admin1234', 10);
      await connection.query(`
        INSERT INTO users (username, nickname, password, name, role, is_approved) VALUES
        ('admin', '관리자', ?, '최고관리자', 'super-admin', TRUE)
      `, [defaultPassword]);
      console.log('✅ 첫 사용자(최고관리자) 생성 완료 - 아이디: admin, 비밀번호: admin1234');
    }

    // 기본 교회소식 데이터 확인 및 추가
    const [newsCount] = await connection.query('SELECT COUNT(*) as count FROM church_news');
    if (newsCount[0].count === 0) {
      await connection.query(`
        INSERT INTO church_news (title, content, summary, tag, author_name, is_pinned) VALUES
        ('2025년 봄맞이 대심방 안내', 
         '새봄을 맞아 각 가정에 하나님의 은혜가 깃들기를 기도하며 대심방을 진행합니다. 구역장님을 통해 일정을 확인해주세요.',
         '새봄을 맞아 각 가정에 하나님의 은혜가 깃들기를 기도하며 대심방을 진행합니다. 구역장님을 통해 일정을 확인해주세요.',
         '공지', '관리자', TRUE),
        ('전교인 체육대회 및 야외예배',
         '화창한 봄날, 온 성도가 함께 모여 기쁨을 나누는 시간을 갖습니다. 장소는 추후 공지 예정입니다.',
         '화창한 봄날, 온 성도가 함께 모여 기쁨을 나누는 시간을 갖습니다. 장소는 추후 공지 예정입니다.',
         '행사', '관리자', FALSE),
        ('주일학교 교사 모집',
         '다음 세대를 말씀과 사랑으로 양육할 선생님을 모십니다. 사랑의 마음만 있다면 누구나 환영합니다.',
         '다음 세대를 말씀과 사랑으로 양육할 선생님을 모십니다. 사랑의 마음만 있다면 누구나 환영합니다.',
         '모집', '교육부', FALSE)
      `);
      console.log('✅ 기본 교회소식 데이터 생성 완료');
    }

    // 사용자 세션 로그 테이블 (로그인/로그아웃 기록)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        session_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL COMMENT '사용자 ID',
        login_time DATETIME NOT NULL COMMENT '로그인 시작시간',
        logout_time DATETIME NULL COMMENT '로그아웃 종료시간',
        session_duration INT NULL COMMENT '이용시간(초)',
        ip_address VARCHAR(45) NULL COMMENT 'IP 주소',
        user_agent TEXT NULL COMMENT '사용자 에이전트',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
        INDEX idx_user (user_id),
        INDEX idx_login_time (login_time),
        INDEX idx_logout_time (logout_time),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 사용자 활동 로그 테이블 (메뉴 클릭, 페이지 이동 등)
    // 비로그인 사용자의 IP 접속도 수집하기 위해 user_id와 ip_address를 NULL 허용으로 변경
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_activities (
        activity_id INT AUTO_INCREMENT PRIMARY KEY,
        session_id INT NULL COMMENT '세션 ID',
        user_id INT NULL COMMENT '사용자 ID (로그인하지 않은 경우 NULL)',
        ip_address VARCHAR(45) NULL COMMENT 'IP 주소 (비로그인 사용자 추적용)',
        activity_type VARCHAR(50) NOT NULL COMMENT '활동 유형 (menu_click, page_view, etc)',
        activity_name VARCHAR(200) NOT NULL COMMENT '활동 이름 (메뉴명, 페이지명 등)',
        activity_data JSON NULL COMMENT '추가 활동 데이터',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '활동 시간',
        INDEX idx_user (user_id),
        INDEX idx_session (session_id),
        INDEX idx_ip (ip_address),
        INDEX idx_activity_type (activity_type),
        INDEX idx_created (created_at),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES user_sessions(session_id) ON DELETE SET NULL,
        CHECK (user_id IS NOT NULL OR ip_address IS NOT NULL) -- user_id 또는 ip_address 중 하나는 반드시 있어야 함
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 기존 테이블에 ip_address 컬럼 추가 (이미 존재하는 경우 무시)
    try {
      await connection.query(`
        ALTER TABLE user_activities 
        ADD COLUMN ip_address VARCHAR(45) NULL COMMENT 'IP 주소 (비로그인 사용자 추적용)' AFTER user_id
      `);
      console.log('✅ user_activities 테이블에 ip_address 컬럼 추가 완료');
    } catch (error) {
      // 컬럼이 이미 존재하는 경우 무시
      if (!error.message.includes('Duplicate column name')) {
        console.log('ip_address 컬럼 추가 확인:', error.message);
      }
    }

    // user_id를 NULL 허용으로 변경 (이미 NULL 허용인 경우 무시)
    try {
      await connection.query(`
        ALTER TABLE user_activities 
        MODIFY COLUMN user_id INT NULL COMMENT '사용자 ID (로그인하지 않은 경우 NULL)'
      `);
      console.log('✅ user_activities 테이블의 user_id를 NULL 허용으로 변경 완료');
    } catch (error) {
      // 이미 NULL 허용인 경우 무시
      console.log('user_id NULL 허용 변경 확인:', error.message);
    }

    // ip_address 인덱스 추가 (이미 존재하는 경우 무시)
    try {
      await connection.query(`
        ALTER TABLE user_activities 
        ADD INDEX idx_ip (ip_address)
      `);
      console.log('✅ user_activities 테이블에 ip_address 인덱스 추가 완료');
    } catch (error) {
      // 인덱스가 이미 존재하는 경우 무시
      if (!error.message.includes('Duplicate key name')) {
        console.log('ip_address 인덱스 추가 확인:', error.message);
      }
    }

    console.log('✅ 사용자 활동 로그 테이블 생성 완료');

    // 게시글 조회 기록 테이블 (IP + 사용자별 중복 방지)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS post_views (
        view_id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL COMMENT '게시글 ID',
        user_id INT NULL COMMENT '사용자 ID (로그인하지 않은 경우 NULL)',
        ip_address VARCHAR(45) NOT NULL COMMENT 'IP 주소',
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '조회 시간',
        UNIQUE KEY unique_post_user_ip (post_id, user_id, ip_address),
        INDEX idx_post (post_id),
        INDEX idx_user (user_id),
        INDEX idx_ip (ip_address),
        FOREIGN KEY (post_id) REFERENCES board_posts(post_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 게시글 이모티콘 반응 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS post_reactions (
        reaction_id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL COMMENT '게시글 ID',
        user_id INT NULL COMMENT '사용자 ID (로그인하지 않은 경우 NULL)',
        ip_address VARCHAR(45) NULL COMMENT 'IP 주소 (비로그인 사용자 추적용)',
        reaction_type VARCHAR(10) NOT NULL COMMENT '이모티콘 타입 (like, love, haha, wow, sad)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '반응 시간',
        UNIQUE KEY unique_post_user_reaction (post_id, user_id, reaction_type),
        UNIQUE KEY unique_post_ip_reaction (post_id, ip_address, reaction_type),
        INDEX idx_post (post_id),
        INDEX idx_user (user_id),
        INDEX idx_reaction_type (reaction_type),
        FOREIGN KEY (post_id) REFERENCES board_posts(post_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 교회소식 조회 기록 테이블 (IP + 사용자별 중복 방지)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS news_views (
        view_id INT AUTO_INCREMENT PRIMARY KEY,
        news_id INT NOT NULL COMMENT '교회소식 ID',
        user_id INT NULL COMMENT '사용자 ID (로그인하지 않은 경우 NULL)',
        ip_address VARCHAR(45) NOT NULL COMMENT 'IP 주소',
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '조회 시간',
        UNIQUE KEY unique_news_user_ip (news_id, user_id, ip_address),
        INDEX idx_news (news_id),
        INDEX idx_user (user_id),
        INDEX idx_ip (ip_address),
        FOREIGN KEY (news_id) REFERENCES church_news(news_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 앨범 조회 기록 테이블 (IP + 사용자별 중복 방지)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS album_views (
        view_id INT AUTO_INCREMENT PRIMARY KEY,
        album_id INT NOT NULL COMMENT '앨범 ID',
        user_id INT NULL COMMENT '사용자 ID (로그인하지 않은 경우 NULL)',
        ip_address VARCHAR(45) NOT NULL COMMENT 'IP 주소',
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '조회 시간',
        UNIQUE KEY unique_album_user_ip (album_id, user_id, ip_address),
        INDEX idx_album (album_id),
        INDEX idx_user (user_id),
        INDEX idx_ip (ip_address),
        FOREIGN KEY (album_id) REFERENCES albums(album_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ 조회 기록 테이블 생성 완료');

    // 설문조사 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS surveys (
        survey_id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL COMMENT '설문 제목',
        description TEXT COMMENT '설문 설명',
        author_id INT NOT NULL COMMENT '작성자 ID',
        author_name VARCHAR(50) NOT NULL COMMENT '작성자 이름',
        is_active BOOLEAN DEFAULT TRUE COMMENT '활성화 여부',
        is_anonymous BOOLEAN DEFAULT FALSE COMMENT '익명 설문 여부',
        target_type ENUM('anyone', 'authenticated', 'authenticated_anonymous') DEFAULT 'anyone' COMMENT '설문 대상 타입 (누구나/인증된사용자만/인증된사용자익명)',
        start_date DATETIME NULL COMMENT '시작일시',
        end_date DATETIME NULL COMMENT '종료일시',
        end_condition_type ENUM('date', 'count', 'percentage') DEFAULT 'date' COMMENT '종료 조건 타입 (기간/인원수/비율)',
        end_count INT NULL COMMENT '종료 인원수',
        end_percentage DECIMAL(5,2) NULL COMMENT '종료 비율 (%)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
        INDEX idx_author (author_id),
        INDEX idx_active (is_active, created_at DESC),
        INDEX idx_dates (start_date, end_date),
        FOREIGN KEY (author_id) REFERENCES users(user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 기존 테이블에 새 필드 추가 (이미 존재하는 경우 무시)
    try {
      await connection.query('ALTER TABLE surveys ADD COLUMN target_type ENUM(\'anyone\', \'authenticated\', \'authenticated_anonymous\') DEFAULT \'anyone\' COMMENT "설문 대상 타입"');
    } catch (e) {
      // 컬럼이 이미 존재하면 무시
    }
    try {
      await connection.query('ALTER TABLE surveys ADD COLUMN end_condition_type ENUM(\'date\', \'count\', \'percentage\') DEFAULT \'date\' COMMENT "종료 조건 타입"');
    } catch (e) {
      // 컬럼이 이미 존재하면 무시
    }
    try {
      await connection.query('ALTER TABLE surveys ADD COLUMN end_count INT NULL COMMENT "종료 인원수"');
    } catch (e) {
      // 컬럼이 이미 존재하면 무시
    }
    try {
      await connection.query('ALTER TABLE surveys ADD COLUMN end_percentage DECIMAL(5,2) NULL COMMENT "종료 비율 (%)"');
    } catch (e) {
      // 컬럼이 이미 존재하면 무시
    }

    // 설문조사 질문 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS survey_questions (
        question_id INT AUTO_INCREMENT PRIMARY KEY,
        survey_id INT NOT NULL COMMENT '설문 ID',
        question_text TEXT NOT NULL COMMENT '질문 내용',
        question_type ENUM('single', 'multiple', 'text', 'rating') NOT NULL COMMENT '질문 유형 (단일선택, 다중선택, 텍스트, 평점)',
        question_order INT DEFAULT 0 COMMENT '질문 순서',
        is_required BOOLEAN DEFAULT TRUE COMMENT '필수 여부',
        options JSON NULL COMMENT '선택지 (JSON 배열)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
        INDEX idx_survey (survey_id, question_order),
        FOREIGN KEY (survey_id) REFERENCES surveys(survey_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 설문조사 응답 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS survey_responses (
        response_id INT AUTO_INCREMENT PRIMARY KEY,
        survey_id INT NOT NULL COMMENT '설문 ID',
        user_id INT NULL COMMENT '사용자 ID (익명 설문인 경우 NULL)',
        ip_address VARCHAR(45) NOT NULL COMMENT 'IP 주소',
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '제출일시',
        INDEX idx_survey (survey_id),
        INDEX idx_user (user_id),
        INDEX idx_ip (ip_address),
        INDEX idx_survey_user_ip (survey_id, user_id, ip_address),
        FOREIGN KEY (survey_id) REFERENCES surveys(survey_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 설문조사 답변 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS survey_answers (
        answer_id INT AUTO_INCREMENT PRIMARY KEY,
        response_id INT NOT NULL COMMENT '응답 ID',
        question_id INT NOT NULL COMMENT '질문 ID',
        answer_text TEXT NULL COMMENT '답변 내용 (텍스트, 단일선택)',
        answer_options JSON NULL COMMENT '답변 선택지 (다중선택)',
        rating_value INT NULL COMMENT '평점 값 (1-5)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
        INDEX idx_response (response_id),
        INDEX idx_question (question_id),
        FOREIGN KEY (response_id) REFERENCES survey_responses(response_id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES survey_questions(question_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ 설문조사 테이블 생성 완료');

    // 사진첩 앨범 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS albums (
        album_id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL COMMENT '앨범 제목',
        description TEXT COMMENT '앨범 설명',
        author_id INT NOT NULL COMMENT '작성자 ID',
        author_name VARCHAR(50) NOT NULL COMMENT '작성자 이름',
        view_count INT DEFAULT 0 COMMENT '조회수',
        is_deleted BOOLEAN DEFAULT FALSE COMMENT '삭제 여부',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
        INDEX idx_author (author_id),
        INDEX idx_created (created_at DESC),
        FOREIGN KEY (author_id) REFERENCES users(user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 사진첩 사진 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS album_photos (
        photo_id INT AUTO_INCREMENT PRIMARY KEY,
        album_id INT NOT NULL COMMENT '앨범 ID',
        photo_url VARCHAR(500) NOT NULL COMMENT '사진 URL (1080p)',
        thumbnail_url VARCHAR(500) NULL COMMENT '썸네일 URL',
        photo_order INT DEFAULT 0 COMMENT '사진 순서',
        description TEXT COMMENT '사진 설명',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
        INDEX idx_album (album_id),
        INDEX idx_order (album_id, photo_order),
        FOREIGN KEY (album_id) REFERENCES albums(album_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 기존 테이블에 thumbnail_url 컬럼 추가 (없는 경우)
    try {
      await connection.query(`
        ALTER TABLE album_photos 
        ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(500) NULL COMMENT '썸네일 URL'
      `);
    } catch (error) {
      // 컬럼이 이미 존재하는 경우 무시
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.error('thumbnail_url 컬럼 추가 오류:', error);
      }
    }

    console.log('✅ 사진첩 테이블 생성 완료');

    connection.release();
    console.log('✅ 데이터베이스 초기화 완료');

  } catch (error) {
    console.error('❌ 데이터베이스 초기화 오류:', error);
    throw error;
  }
}

module.exports = { getPool, pool, initializeDatabase, getConnectionWithTimezone };

