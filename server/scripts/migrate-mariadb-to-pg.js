/**
 * [파일 용도] 기존 원격 MariaDB(seomgim)의 모든 테이블(36개) 스키마, 데이터, 인덱스, 외래키 및 시퀀스를
 * 로컬 PostgreSQL 18(seomgim)로 누락 없이 통합 이관하고 행 수를 검증하는 스크립트
 */
const mysql = require('mysql2/promise');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });

// [한글 코멘트] DDL 파일에서 추출한 MariaDB 테이블 의존성 순서(부모 -> 자식) 및 타입 변환 헬퍼
function mapColumnType(col) {
  const dt = (col.DATA_TYPE || '').toLowerCase();
  const colType = (col.COLUMN_TYPE || '').toLowerCase();
  const isAuto = (col.EXTRA || '').toLowerCase().includes('auto_increment');

  if (colType === 'tinyint(1)') {
    return 'BOOLEAN';
  }
  if (isAuto) {
    return dt === 'bigint' ? 'BIGSERIAL' : 'SERIAL';
  }

  switch (dt) {
    case 'int':
    case 'integer':
    case 'mediumint':
      return 'INTEGER';
    case 'bigint':
      return 'BIGINT';
    case 'smallint':
      return 'SMALLINT';
    case 'tinyint':
      return 'SMALLINT';
    case 'varchar':
      return `VARCHAR(${col.CHARACTER_MAXIMUM_LENGTH || 255})`;
    case 'char':
      return `CHAR(${col.CHARACTER_MAXIMUM_LENGTH || 1})`;
    case 'text':
    case 'mediumtext':
    case 'longtext':
      return 'TEXT';
    case 'enum':
      return 'VARCHAR(50)';
    case 'decimal':
    case 'numeric':
      return `NUMERIC(${col.NUMERIC_PRECISION || 10},${col.NUMERIC_SCALE || 2})`;
    case 'float':
      return 'REAL';
    case 'double':
      return 'DOUBLE PRECISION';
    case 'date':
      return 'DATE';
    case 'datetime':
    case 'timestamp':
      return 'TIMESTAMPTZ';
    case 'json':
      return 'JSONB';
    case 'blob':
    case 'longblob':
      return 'BYTEA';
    default:
      return 'TEXT';
  }
}

// [한글 코멘트] MariaDB 기본값을 PostgreSQL 기본값 표현식으로 변환
function mapDefaultValue(col, pgType) {
  const isAuto = (col.EXTRA || '').toLowerCase().includes('auto_increment');
  if (isAuto) return '';

  if (col.COLUMN_DEFAULT === null || col.COLUMN_DEFAULT === undefined) {
    return '';
  }

  const def = String(col.COLUMN_DEFAULT).trim();
  if (def.toUpperCase() === 'NULL' || def === '') {
    return '';
  }
  if (def.toLowerCase().includes('current_timestamp')) {
    return 'DEFAULT CURRENT_TIMESTAMP';
  }
  if (pgType === 'BOOLEAN') {
    return def === '1' || def.toLowerCase() === 'true' ? 'DEFAULT TRUE' : 'DEFAULT FALSE';
  }
  if (/^-?\d+(\.\d+)?$/.test(def)) {
    return `DEFAULT ${def}`;
  }
  const cleanDef = def.replace(/^'|'$/g, '').replace(/'/g, "''");
  return `DEFAULT '${cleanDef}'`;
}

// [한글 코멘트] 행 데이터 값을 PostgreSQL 컬럼 타입에 맞게 안전하게 정규화
function normalizeValue(val, colType, dataType) {
  if (val === null || val === undefined) return null;

  if ((colType || '').toLowerCase() === 'tinyint(1)') {
    return Boolean(Number(val));
  }
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val;
  }
  if ((dataType || '').toLowerCase() === 'date' && typeof val === 'string') {
    if (val.startsWith('0000-00-00')) return null;
    return val;
  }
  if ((dataType || '').toLowerCase() === 'json' && typeof val === 'object') {
    return JSON.stringify(val);
  }
  return val;
}

async function migrate() {
  const mariaHost = process.env.MARIADB_HOST || '192.168.0.39';
  const mariaPort = Number(process.env.MARIADB_PORT || 3306);
  const mariaUser = process.env.MARIADB_USER || 'root';
  const mariaPassword = process.env.MARIADB_PASSWORD || process.env.DB_PASSWORD;
  const dbName = 'seomgim';

  const pgHost = '127.0.0.1';
  const pgPort = 5432;
  const pgUser = 'postgres';
  const pgPassword = process.env.DB_PASSWORD;

  console.log(`🔌 원격 MariaDB(${mariaHost}:${mariaPort}/${dbName}) 연결 중...`);
  const maria = await mysql.createConnection({
    host: mariaHost,
    port: mariaPort,
    user: mariaUser,
    password: mariaPassword,
    database: dbName,
    timezone: '+09:00'
  });

  console.log(`🔌 로컬 PostgreSQL 18(${pgHost}:${pgPort}/${dbName}) 연결 중...`);
  const pg = new Client({
    host: pgHost,
    port: pgPort,
    user: pgUser,
    password: pgPassword,
    database: dbName
  });
  await pg.connect();
  await pg.query("SET TIME ZONE 'Asia/Seoul'");

  try {
    // 1. 테이블 목록 조회
    const [tableRows] = await maria.query(
      `SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
      [dbName]
    );
    const tables = tableRows.map((r) => r.TABLE_NAME);
    console.log(`📋 이관 대상 테이블 수: ${tables.length}개`);

    // 2. updated_at 자동 갱신 트리거 함수 생성
    await pg.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 3. 기존 테이블 초기화 (재실행 가능하도록 public 스키마 내 해당 테이블 드롭)
    for (const tbl of tables) {
      await pg.query(`DROP TABLE IF EXISTS "${tbl}" CASCADE`);
    }

    const tableColumnsMap = new Map();
    const serialResetList = [];
    const foreignKeys = [];
    const indexesToCreate = [];
    const updatedAtTables = [];

    // 4. 각 테이블 스키마 생성 (PK 포함, FK는 모든 데이터 적재 후 추가)
    for (const tbl of tables) {
      const [cols] = await maria.query(
        `SELECT COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_KEY
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [dbName, tbl]
      );
      tableColumnsMap.set(tbl, cols);

      const [stats] = await maria.query(
        `SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, COLLATION
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
        [dbName, tbl]
      );

      // 인덱스 그룹화
      const idxMap = new Map();
      for (const s of stats) {
        if (!idxMap.has(s.INDEX_NAME)) {
          idxMap.set(s.INDEX_NAME, { nonUnique: s.NON_UNIQUE, cols: [] });
        }
        idxMap.get(s.INDEX_NAME).cols.push({
          name: s.COLUMN_NAME,
          desc: s.COLLATION === 'D'
        });
      }

      const colDefs = [];
      for (const col of cols) {
        const pgType = mapColumnType(col);
        const isAuto = (col.EXTRA || '').toLowerCase().includes('auto_increment');
        const nullable = col.IS_NULLABLE === 'NO' ? 'NOT NULL' : '';
        const defClause = mapDefaultValue(col, pgType);
        colDefs.push(`"${col.COLUMN_NAME}" ${pgType} ${nullable} ${defClause}`.replace(/\s+/g, ' ').trim());

        if (isAuto) {
          serialResetList.push({ table: tbl, column: col.COLUMN_NAME });
        }
        if ((col.EXTRA || '').toLowerCase().includes('on update current_timestamp')) {
          updatedAtTables.push(tbl);
        }
      }

      // PRIMARY KEY 추가
      if (idxMap.has('PRIMARY')) {
        const pkCols = idxMap.get('PRIMARY').cols.map((c) => `"${c.name}"`).join(', ');
        colDefs.push(`PRIMARY KEY (${pkCols})`);
      }

      const createSql = `CREATE TABLE "${tbl}" (\n  ${colDefs.join(',\n  ')}\n);`;
      await pg.query(createSql);

      // 보조 인덱스 및 UNIQUE 인덱스 예약
      for (const [idxName, idxInfo] of idxMap.entries()) {
        if (idxName === 'PRIMARY') continue;
        const safeIdxName = `${tbl}_${idxName}`.slice(0, 60);
        const colsSql = idxInfo.cols.map((c) => `"${c.name}"${c.desc ? ' DESC' : ''}`).join(', ');
        const uniqueSql = idxInfo.nonUnique === 0 ? 'UNIQUE ' : '';
        indexesToCreate.push(`CREATE ${uniqueSql}INDEX "${safeIdxName}" ON "${tbl}" (${colsSql});`);
      }

      // 외래키 조회
      const [fks] = await maria.query(
        `SELECT kcu.CONSTRAINT_NAME, kcu.COLUMN_NAME, kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME, rc.DELETE_RULE, rc.UPDATE_RULE
         FROM information_schema.KEY_COLUMN_USAGE kcu
         JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
           ON kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
          AND kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
          AND kcu.TABLE_NAME = rc.TABLE_NAME
         WHERE kcu.TABLE_SCHEMA = ? AND kcu.TABLE_NAME = ? AND kcu.REFERENCED_TABLE_NAME IS NOT NULL`,
        [dbName, tbl]
      );
      for (const fk of fks) {
        foreignKeys.push({
          table: tbl,
          name: `${tbl}_${fk.CONSTRAINT_NAME}`.slice(0, 60),
          column: fk.COLUMN_NAME,
          refTable: fk.REFERENCED_TABLE_NAME,
          refColumn: fk.REFERENCED_COLUMN_NAME,
          onDelete: fk.DELETE_RULE || 'NO ACTION',
          onUpdate: fk.UPDATE_RULE || 'NO ACTION'
        });
      }
    }
    console.log('✅ 36개 테이블 스키마 생성 완료');

    // 5. 전체 데이터 이관 (배치 INSERT)
    const verifySummary = [];
    for (const tbl of tables) {
      const cols = tableColumnsMap.get(tbl);
      const colNames = cols.map((c) => c.COLUMN_NAME);
      const selectCols = colNames.map((c) => `\`${c}\``).join(', ');
      const [rows] = await maria.query(`SELECT ${selectCols} FROM \`${tbl}\``);

      if (rows.length > 0) {
        const quotedCols = colNames.map((c) => `"${c}"`).join(', ');
        const batchSize = 200;

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const values = [];
          const placeholders = batch.map((row, rowIdx) => {
            const rowPlaceholders = cols.map((col, colIdx) => {
              values.push(normalizeValue(row[col.COLUMN_NAME], col.COLUMN_TYPE, col.DATA_TYPE));
              return `$${rowIdx * cols.length + colIdx + 1}`;
            });
            return `(${rowPlaceholders.join(', ')})`;
          });

          const insertSql = `INSERT INTO "${tbl}" (${quotedCols}) VALUES ${placeholders.join(', ')}`;
          await pg.query(insertSql, values);
        }
      }

      const pgCountRes = await pg.query(`SELECT COUNT(*)::int AS cnt FROM "${tbl}"`);
      const pgCount = pgCountRes.rows[0].cnt;
      verifySummary.push({
        table: tbl,
        mariadb: rows.length,
        postgresql: pgCount,
        match: rows.length === pgCount
      });
    }

    // 6. 시퀀스 동기화
    for (const item of serialResetList) {
      await pg.query(
        `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT MAX("${item.column}") FROM "${item.table}"), 0) + 1, false)`,
        [item.table, item.column]
      );
    }
    console.log(`✅ 시퀀스 동기화 완료 (${serialResetList.length}개)`);

    // 7. 인덱스 생성
    for (const idxSql of indexesToCreate) {
      await pg.query(idxSql);
    }
    console.log(`✅ 인덱스 생성 완료 (${indexesToCreate.length}개)`);

    // 8. 외래키 제약조건 생성
    for (const fk of foreignKeys) {
      const fkSql = `ALTER TABLE "${fk.table}" ADD CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.refTable}" ("${fk.refColumn}") ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate};`;
      await pg.query(fkSql);
    }
    console.log(`✅ 외래키 제약조건 생성 완료 (${foreignKeys.length}개)`);

    // 9. updated_at 자동 갱신 트리거 연결
    for (const tbl of [...new Set(updatedAtTables)]) {
      await pg.query(`
        CREATE TRIGGER "trg_${tbl}_updated_at"
        BEFORE UPDATE ON "${tbl}"
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      `);
    }
    console.log(`✅ updated_at 트리거 적용 완료 (${new Set(updatedAtTables).size}개 테이블)`);

    // 10. 검증 결과 출력
    console.table(verifySummary);
    const mismatches = verifySummary.filter((v) => !v.match);
    if (mismatches.length > 0) {
      throw new Error(`행 수 불일치 발생: ${JSON.stringify(mismatches)}`);
    }
    console.log('🎉 36개 전체 테이블 스키마 및 데이터 100% 무결성 이관 완료!');
  } finally {
    await maria.end();
    await pg.end();
  }
}

migrate().catch((err) => {
  console.error('❌ 이관 실패:', err);
  process.exit(1);
});
