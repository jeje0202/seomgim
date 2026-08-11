/**
 * [파일 용도] MariaDB 및 SQLite 데이터베이스에 저장된 모든 이미지 URL(/uploads/...)을
 * Cloudflare R2 클라우드 URL(https://media.foryou.me/seomgim/data/...)로 일괄 전환하는 데이터 마이그레이션 스크립트
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { getPool, initializeDatabase } = require('../db');

const updateDatabaseUrlsToR2 = async () => {
  console.log('🔄 DB 내 저장된 이미지 URL -> Cloudflare R2 URL (https://media.foryou.me/seomgim/data/) 일괄 업데이트 시작...');

  await initializeDatabase();
  const pool = getPool();

  const R2_BASE_URL = 'https://media.foryou.me/seomgim/data/';

  // 1. MariaDB board_posts (image_url & content)
  try {
    const [resBoardImg] = await pool.query(`
      UPDATE board_posts 
      SET image_url = REPLACE(image_url, '/uploads/', ?)
      WHERE image_url LIKE '%/uploads/%'
    `, [R2_BASE_URL]);
    console.log(`✅ MariaDB board_posts image_url 업데이트 완료: ${resBoardImg.affectedRows}건`);

    const [resBoardContent] = await pool.query(`
      UPDATE board_posts 
      SET content = REPLACE(content, '/uploads/', ?)
      WHERE content LIKE '%/uploads/%'
    `, [R2_BASE_URL]);
    console.log(`✅ MariaDB board_posts content 업데이트 완료: ${resBoardContent.affectedRows}건`);
  } catch (err) {
    console.error('❌ MariaDB board_posts 업데이트 에러:', err.message);
  }

  // 2. MariaDB album_photos (photo_url & thumbnail_url)
  try {
    const [resAlbumPhoto] = await pool.query(`
      UPDATE album_photos 
      SET photo_url = REPLACE(photo_url, '/uploads/', ?)
      WHERE photo_url LIKE '%/uploads/%'
    `, [R2_BASE_URL]);
    console.log(`✅ MariaDB album_photos photo_url 업데이트 완료: ${resAlbumPhoto.affectedRows}건`);

    const [resAlbumThumb] = await pool.query(`
      UPDATE album_photos 
      SET thumbnail_url = REPLACE(thumbnail_url, '/uploads/', ?)
      WHERE thumbnail_url LIKE '%/uploads/%'
    `, [R2_BASE_URL]);
    console.log(`✅ MariaDB album_photos thumbnail_url 업데이트 완료: ${resAlbumThumb.affectedRows}건`);
  } catch (err) {
    console.error('❌ MariaDB album_photos 업데이트 에러:', err.message);
  }

  // 3. MariaDB news (image_url & content)
  try {
    const [resNewsImg] = await pool.query(`
      UPDATE news 
      SET image_url = REPLACE(image_url, '/uploads/', ?)
      WHERE image_url LIKE '%/uploads/%'
    `, [R2_BASE_URL]);
    console.log(`✅ MariaDB news image_url 업데이트 완료: ${resNewsImg.affectedRows}건`);

    const [resNewsContent] = await pool.query(`
      UPDATE news 
      SET content = REPLACE(content, '/uploads/', ?)
      WHERE content LIKE '%/uploads/%'
    `, [R2_BASE_URL]);
    console.log(`✅ MariaDB news content 업데이트 완료: ${resNewsContent.affectedRows}건`);
  } catch (err) {
    // news 테이블 없을 시 무시
  }

  // 4. SQLite cms_content.db (cms_sections & cms_section_history)
  const sqliteDbPath = path.resolve(__dirname, '../data/cms_content.db');
  if (fs.existsSync(sqliteDbPath)) {
    const db = new sqlite3.Database(sqliteDbPath);

    await new Promise((resolve) => {
      db.run(`
        UPDATE cms_sections 
        SET content_json = REPLACE(content_json, '/uploads/', '${R2_BASE_URL}')
        WHERE content_json LIKE '%/uploads/%'
      `, function(err) {
        console.log(`✅ SQLite cms_sections content_json 업데이트 완료: ${this ? this.changes : 0}건`);
        resolve();
      });
    });

    await new Promise((resolve) => {
      db.run(`
        UPDATE cms_section_history 
        SET content_json = REPLACE(content_json, '/uploads/', '${R2_BASE_URL}')
        WHERE content_json LIKE '%/uploads/%'
      `, function(err) {
        console.log(`✅ SQLite cms_section_history content_json 업데이트 완료: ${this ? this.changes : 0}건`);
        resolve();
      });
    });
  }

  console.log('==================================================');
  console.log('🎉 모든 데이터베이스 이미지 URL이 Cloudflare R2(https://media.foryou.me/seomgim/data/)로 100% 직결 전환 완료되었습니다!');
  console.log('==================================================');
};

updateDatabaseUrlsToR2()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ DB 업데이트 처리 실패:', err);
    process.exit(1);
  });
