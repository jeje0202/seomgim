/**
 * [파일 용도] SQLite 데이터베이스 연결 및 CMS 데이터 관리 헬퍼 모듈
 * 슈퍼관리자가 웹사이트 화면 영역별 내용을 로컬 SQLite DB에 저장하고 버전 이력을 관리하도록 함
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 저장 디렉터리 경로 설정 (server/data)
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'cms_content.db');

// SQLite 데이터베이스 객체 생성
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ SQLite DB 연결 실패:', err.message);
  } else {
    console.log('✅ SQLite CMS 데이터베이스 연결 완료:', dbPath);
  }
});

/**
 * 테이블 초기화 및 초기 시드 데이터 등록
 */
function initDb() {
  db.serialize(() => {
    // 1. 영역별 현재 최신 상태 테이블 생성
    db.run(`
      CREATE TABLE IF NOT EXISTS cms_sections (
        section_key TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content_json TEXT NOT NULL,
        current_version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        updated_by TEXT
      )
    `);

    // 2. 영역별 버전 변경 이력 테이블 생성
    db.run(`
      CREATE TABLE IF NOT EXISTS cms_section_history (
        history_id INTEGER PRIMARY KEY AUTOINCREMENT,
        section_key TEXT NOT NULL,
        version INTEGER NOT NULL,
        content_json TEXT NOT NULL,
        change_memo TEXT,
        created_at TEXT NOT NULL,
        created_by TEXT,
        FOREIGN KEY (section_key) REFERENCES cms_sections(section_key) ON DELETE CASCADE
      )
    `);

    // 3. 초기 시드 데이터 (데이터가 비어있는 경우에만 덤프 등록)
    const seedSections = [
      {
        section_key: 'church_purpose',
        title: '교회 설립 목적',
        content_json: JSON.stringify({
          subtitle: '우리 교회의 설립목적은 상담치유를 위한 들꽃 목회입니다.',
          description: '힘들고 지친 이들이 들녘에 있는 이름 없는 야생화와의 만남을 통해 인생의 새로운 의미를 찾아 위로와 소망을 갖게 하며, 새로운 인생에 도전하게 하는 들꽃을 의미합니다.'
        })
      },
      {
        section_key: 'church_vision',
        title: '창원 섬김의 교회 비전',
        content_json: JSON.stringify({
          description: '이 시대의 힘들어하는 국내 가정, 소외계층, 청소년, 그리고 해외 가난한 민족과 어린 영혼들에게 희망을 주는 비전을 가지고 있습니다.',
          items: [
            '지역사회 지원센터 및 상담실 운영',
            '섬김과 나눔의 집 (무료급식)',
            '평생교육 실천'
          ],
          slogan: '"예수님의 사랑 이야기가 가득한 교회"'
        })
      },
      {
        section_key: 'serving_members',
        title: '섬기는 분들',
        content_json: JSON.stringify({
          pastors: '전병학, 유보배, 정동호(선교), 박승현(중고등부)',
          elders: '박주현, (은퇴) 성재효, 성창규',
          missionaries: '최성은(호주), 전용득(필리핀), 김바울(북방)'
        })
      },
      {
        section_key: 'partner_orgs',
        title: '부설 기관 및 협력기관',
        content_json: JSON.stringify({
          attached: '창원섬김 부설 나눔상담연구소',
          partners: '국내외 미자립교회 및 선교단체'
        })
      },
      // [한글 코멘트] 첨부 신규 3개 영역 시드 데이터 추가 (담임목사 인사말, 예배 안내, 온라인 헌금 안내)
      {
        section_key: 'pastor_greeting',
        title: '담임목사 인사말',
        content_json: JSON.stringify({
          pastor_name: '박신철 목사',
          pastor_role: 'Senior Pastor',
          slogan: '이웃을 섬기며 성장하는 열린 교회',
          greeting_title: '할렐루야! 주님의 이름으로 환영합니다.',
          greeting_body: '창원섬김의교회는 상처 입은 영혼들이 예수님의 사랑 안에서 치유받고 회복되어, 세상 속에서 향기로운 들꽃처럼 피어나기를 소망하는 믿음의 공동체입니다.\n\n말씀이 살아 숨 쉬고 따뜻한 섬김이 있는 이곳에서, 여러분과 함께 아름다운 천국 가족을 이루어가길 기도합니다.'
        })
      },
      {
        section_key: 'worship_schedule',
        title: '예배 안내',
        content_json: JSON.stringify({
          title: '예배 안내',
          subtitle: '하나님과 만나는 감격스러운 시간으로 여러분을 초대합니다.',
          services: [
            { name: '주일 오전예배', time: '오전 11:00', location: '본당' },
            { name: '주일 찬양예배', time: '오후 2:00', location: '본당' },
            { name: '주일학교', time: '주일 오전 9:00', location: '교육관' },
            { name: '중·고등부', time: '주일 오후 1:00', location: '교육관' },
            { name: '청년대학부', time: '토요일 오후 6:00', location: '교육관' },
            { name: '새신자반', time: '주일 오후 1:30', location: '본당' },
            { name: '수요 밤 예배', time: '수요일 오후 7:30', location: '본당' },
            { name: '금요 연합구역예배(치유)', time: '금요일 오후 7:30', location: '본당' },
            { name: '새벽 기도회', time: '월~금 새벽 5:30', location: '본당' }
          ]
        })
      },
      {
        section_key: 'online_offering',
        title: '온라인 헌금 안내',
        content_json: JSON.stringify({
          title: '온라인 헌금 안내',
          accounts: [
            { name: '교회 헌금', account: '2060-0054-8337', bank: '수협', holder: '대한예수교장로회창원섬김' },
            { name: '섬김과 나눔의 집 (무료급식)', account: '351-1227-6333-03', bank: '농협', holder: '대한예수교장로회창원섬김' }
          ]
        })
      }
    ];

    // [한글 코멘트] 사용자 요청: 모든 7개 영역의 초기 디폴트 원본 데이터를 DB(cms_sections 및 cms_section_history v1)에 보장하여 언제든지 복원 가능하도록 처리
    const now = new Date().toISOString();
    seedSections.forEach((sec) => {
      // 1. cms_sections에 존재하지 않는 경우 디폴트 등록
      db.get('SELECT COUNT(*) as count FROM cms_sections WHERE section_key = ?', [sec.section_key], (err, row) => {
        if (!err && row && row.count === 0) {
          db.run(
            `INSERT INTO cms_sections (section_key, title, content_json, current_version, updated_at, updated_by) VALUES (?, ?, ?, 1, ?, '시스템')`,
            [sec.section_key, sec.title, sec.content_json, now]
          );
        }
      });

      // 2. cms_section_history에 버전 1 이력이 없는 경우 초기 디폴트 이력 생성
      db.get('SELECT COUNT(*) as count FROM cms_section_history WHERE section_key = ? AND version = 1', [sec.section_key], (err, row) => {
        if (!err && row && row.count === 0) {
          db.run(
            `INSERT INTO cms_section_history (section_key, version, content_json, change_memo, created_at, created_by) VALUES (?, 1, ?, '🌱 초기 디폴트 원본 데이터 (언제든지 복원 가능)', ?, '시스템')`,
            [sec.section_key, sec.content_json, now]
          );
        }
      });
    });
    console.log('✅ SQLite CMS 7개 영역 초기 디폴트 데이터(v1) 및 복원 이력 검증/보장 완료');
  });
}

// DB 초기화 실행
initDb();

/**
 * Promisified SQLite Query Helpers
 */

// 전체 섹션 목록 조회
function getAllSections() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM cms_sections', [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// 특정 섹션 조회
function getSection(key) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM cms_sections WHERE section_key = ?', [key], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// 섹션 수정 및 이력 누적
function updateSection(key, title, contentJson, updatedBy, changeMemo = '') {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get('SELECT * FROM cms_sections WHERE section_key = ?', [key], (err, row) => {
        if (err) return reject(err);

        const newVersion = row ? row.current_version + 1 : 1;
        const now = new Date().toISOString();

        // 1. cms_sections 업데이트 또는 추가
        db.run(`
          INSERT INTO cms_sections (section_key, title, content_json, current_version, updated_at, updated_by)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(section_key) DO UPDATE SET
            title = excluded.title,
            content_json = excluded.content_json,
            current_version = excluded.current_version,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by
        `, [key, title, contentJson, newVersion, now, updatedBy], function(err) {
          if (err) return reject(err);

          // 2. 이력 테이블(cms_section_history)에 기록 추가
          db.run(`
            INSERT INTO cms_section_history (section_key, version, content_json, change_memo, created_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [key, newVersion, contentJson, changeMemo || `버전 ${newVersion} 업데이트`, now, updatedBy], function(err) {
            if (err) return reject(err);

            resolve({
              section_key: key,
              title,
              content_json: contentJson,
              current_version: newVersion,
              updated_at: now,
              updated_by: updatedBy
            });
          });
        });
      });
    });
  });
}

// 특정 섹션의 변경 이력 목록 조회
function getSectionHistory(key) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT history_id, section_key, version, content_json, change_memo, created_at, created_by
      FROM cms_section_history
      WHERE section_key = ?
      ORDER BY version DESC
    `, [key], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// 과거 특정 버전으로 복구 (Restore)
function restoreSectionVersion(key, historyId, restoredBy) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM cms_section_history
      WHERE section_key = ? AND history_id = ?
    `, [key, historyId], async (err, targetHistory) => {
      if (err) return reject(err);
      if (!targetHistory) {
        return reject(new Error('복구할 이력 데이터를 찾을 수 없습니다.'));
      }

      try {
        const sec = await getSection(key);
        const title = sec ? sec.title : key;
        const memo = `버전 ${targetHistory.version} 내용으로 복구됨 (복구 실행자: ${restoredBy})`;
        
        // 과거 버전 내용을 신규 최신 버전으로 업데이트 및 이력 저장
        const updated = await updateSection(key, title, targetHistory.content_json, restoredBy, memo);
        resolve(updated);
      } catch (error) {
        reject(error);
      }
    });
  });
}

module.exports = {
  db,
  getAllSections,
  getSection,
  updateSection,
  getSectionHistory,
  restoreSectionVersion
};
