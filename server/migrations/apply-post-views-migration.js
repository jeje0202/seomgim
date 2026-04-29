// post_views 테이블 마이그레이션 스크립트
// UNIQUE KEY 제약 조건 제거 및 ip_address NULL 허용

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 환경 변수 로드
require('dotenv').config({ path: path.join(__dirname, '../config.env') });

async function runMigration() {
  let connection;
  
  try {
    // 데이터베이스 연결
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'seomgim_church',
      multipleStatements: true
    });

    console.log('✅ 데이터베이스 연결 성공');
    console.log('');

    // 1. UNIQUE KEY 제약 조건 제거 시도
    try {
      await connection.query('ALTER TABLE post_views DROP INDEX unique_post_user_ip');
      console.log('✅ UNIQUE KEY 제약 조건 제거 완료');
    } catch (error) {
      if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('⚠️  UNIQUE KEY가 이미 제거되었거나 존재하지 않습니다.');
      } else {
        throw error;
      }
    }

    // 2. ip_address를 NULL 허용으로 변경 시도
    try {
      await connection.query(`
        ALTER TABLE post_views 
        MODIFY ip_address VARCHAR(45) NULL COMMENT 'IP 주소 (NULL 허용)'
      `);
      console.log('✅ ip_address를 NULL 허용으로 변경 완료');
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.log('⚠️  ip_address 필드가 이미 NULL 허용입니다.');
      } else {
        throw error;
      }
    }

    console.log('');
    console.log('✅ 마이그레이션 완료!');
    console.log('');
    console.log('이제 post_views 테이블에 중복 조회 기록이 저장됩니다.');
    console.log('분석 용도로 사용자 ID와 IP 주소가 계속 수집됩니다.');

  } catch (error) {
    console.error('❌ 마이그레이션 오류:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 스크립트 실행
runMigration();

