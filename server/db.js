/**
 * [파일 용도] PostgreSQL 18 데이터베이스 연결 풀 관리 및 쿼리 호환 어댑터, 초기 테이블 보장 모듈
 */
const { Pool, types } = require('pg');
require('dotenv').config({ path: './config.env' });

// [한글 코멘트] PostgreSQL BIGINT(COUNT, SUM 등) 및 NUMERIC 반환값을 JavaScript 숫자로 자동 파싱
types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

// [한글 코멘트] INSERT 시 insertId 자동 반환을 위한 테이블별 기본키(PK) 매핑
const TABLE_PK_MAP = {
  users: 'user_id',
  user_sessions: 'session_id',
  user_activities: 'activity_id',
  board_categories: 'category_id',
  board_posts: 'post_id',
  board_comments: 'comment_id',
  post_reactions: 'reaction_id',
  post_tags: 'post_tag_id',
  post_views: 'view_id',
  organization_tags: 'tag_id',
  church_news: 'news_id',
  news_views: 'view_id',
  surveys: 'survey_id',
  survey_questions: 'question_id',
  survey_responses: 'response_id',
  survey_answers: 'answer_id',
  albums: 'album_id',
  album_photos: 'photo_id',
  album_views: 'view_id',
  church_intro: 'id',
  accounts: 'id',
  budgets: 'id',
  transactions: 'id',
  core_account: 'id',
  core_budget: 'id',
  core_transaction: 'id'
};

let rawPool = null;
let compatPool = null;

/**
 * [한글 코멘트] 문자열 리터럴('...') 내부를 제외한 '?' 플레이스홀더를 PostgreSQL '$1, $2...' 형식으로 안전하게 변환
 */
function convertPlaceholders(sql) {
  if (!sql.includes('?')) return sql;

  let index = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let result = '';

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "'" && !inDoubleQuote) {
      if (inSingleQuote && next === "'") {
        result += "''";
        i++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      result += ch;
    } else if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      result += ch;
    } else if (ch === '?' && !inSingleQuote && !inDoubleQuote) {
      index++;
      result += `$${index}`;
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * [한글 코멘트] INSERT 쿼리에 RETURNING 절이 없는 경우 테이블 PK를 기준으로 자동 추가하여 insertId 지원
 */
function appendReturningIfNeeded(sql) {
  const trimmed = sql.trim().replace(/;+\s*$/, '');
  const insertMatch = trimmed.match(/^INSERT\s+INTO\s+"?([a-zA-Z0-9_]+)"?/i);
  if (!insertMatch) {
    return { sql: trimmed, isInsert: false, pkCol: null };
  }

  const tableName = insertMatch[1].toLowerCase();
  const pkCol = TABLE_PK_MAP[tableName] || null;
  if (pkCol && !/\bRETURNING\b/i.test(trimmed)) {
    return { sql: `${trimmed} RETURNING "${pkCol}"`, isInsert: true, pkCol };
  }
  return { sql: trimmed, isInsert: true, pkCol };
}

/**
 * [한글 코멘트] pg 실행 결과를 [rows/meta, rawResult] 튜플 형태로 정규화
 */
async function executeCompatQuery(runner, sql, params = []) {
  const convertedSql = convertPlaceholders(sql);
  const { sql: finalSql, isInsert, pkCol } = appendReturningIfNeeded(convertedSql);
  const res = await runner.query(finalSql, params);

  const command = (res.command || '').toUpperCase();
  if (command === 'SELECT' || command === 'SHOW' || command === 'WITH') {
    return [res.rows, res];
  }

  const insertId =
    isInsert && pkCol && res.rows && res.rows[0] ? res.rows[0][pkCol] : undefined;
  const meta = Object.assign([], res.rows || [], {
    insertId,
    affectedRows: res.rowCount || 0
  });
  return [meta, res];
}

/**
 * [한글 코멘트] 트랜잭션 및 세션 시간대 제어를 지원하는 커넥션 래퍼 생성
 */
function wrapClient(client) {
  return {
    query: (sql, params = []) => executeCompatQuery(client, sql, params),
    execute: (sql, params = []) => executeCompatQuery(client, sql, params),
    beginTransaction: () => client.query('BEGIN'),
    commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK'),
    release: () => client.release()
  };
}

function getPool() {
  if (!compatPool) {
    throw new Error('데이터베이스가 아직 초기화되지 않았습니다. initializeDatabase()를 먼저 호출하세요.');
  }
  return compatPool;
}

// [한글 코멘트] 커넥션을 가져올 때마다 한국 시간대(Asia/Seoul, UTC+9)가 적용된 클라이언트 반환
async function getConnectionWithTimezone() {
  if (!rawPool) {
    throw new Error('데이터베이스가 아직 초기화되지 않았습니다. initializeDatabase()를 먼저 호출하세요.');
  }
  const client = await rawPool.connect();
  try {
    await client.query("SET TIME ZONE 'Asia/Seoul'");
  } catch (error) {
    console.log('⚠️ 연결 시간대 설정 실패:', error.message);
  }
  return wrapClient(client);
}

// [한글 코멘트] PostgreSQL 18 연결 풀 초기화 및 필수 테이블/시간대 검증
async function initializeDatabase() {
  try {
    const dbName = process.env.DB_NAME || 'seomgim';
    console.log(`✅ PostgreSQL 18 (${dbName}) 데이터베이스 연결 초기화 중...`);

    rawPool = new Pool({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: dbName,
      port: Number(process.env.DB_PORT || 5432),
      max: 15,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      // [한글 코멘트] PostgreSQL 세션 생성 시점에 한국 시간대(Asia/Seoul) 기본 적용
      options: '-c TimeZone=Asia/Seoul'
    });

    compatPool = {
      query: (sql, params = []) => executeCompatQuery(rawPool, sql, params),
      execute: (sql, params = []) => executeCompatQuery(rawPool, sql, params),
      getConnection: () => getConnectionWithTimezone()
    };

    const connection = await getConnectionWithTimezone();

    // 연결 테스트 및 시간대 확인
    const [tzRows] = await connection.query("SHOW TIMEZONE");
    console.log(`✅ PostgreSQL ${dbName} 연결 성공 (TIMEZONE: ${tzRows[0]?.TimeZone || 'Asia/Seoul'})`);

    // updated_at 자동 갱신 트리거 함수 보장
    await rawPool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 기본 게시판 카테고리 보장 (없는 경우에만 삽입)
    await rawPool.query(`
      INSERT INTO board_categories (category_name, category_code, description, is_private, display_order)
      VALUES
        ('공지사항', 'notice', '교회 공지사항 및 알림 게시판', FALSE, 1),
        ('주보', 'bulletin', '매주 주일 예배 주보', FALSE, 2),
        ('자유게시판', 'free', '성도들이 자유롭게 소통하는 공간', FALSE, 3),
        ('성도게시판', 'member', '등록 성도 전용 게시판', TRUE, 4),
        ('기관게시판', 'organization', '각 기관별 소식 및 나눔', FALSE, 5),
        ('기도제목', 'prayer', '함께 기도하는 중보기도 게시판', FALSE, 6)
      ON CONFLICT (category_code) DO NOTHING
    `);

    connection.release();
    console.log('✅ PostgreSQL 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 오류:', error);
    throw error;
  }
}

module.exports = {
  getPool,
  get pool() {
    return compatPool;
  },
  initializeDatabase,
  getConnectionWithTimezone
};
