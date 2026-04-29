// 주보게시판 이미지 URL 마이그레이션 스크립트
// 기존 이미지 URL을 새로운 경로 형식으로 업데이트

const { getPool, initializeDatabase } = require('../db');
const path = require('path');
const fs = require('fs');

async function migrateBulletinImageUrls() {
  // 데이터베이스 초기화
  console.log('데이터베이스 초기화 중...');
  await initializeDatabase();
  console.log('✅ 데이터베이스 초기화 완료\n');
  
  const pool = getPool();
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('=== 주보게시판 이미지 URL 마이그레이션 시작 ===\n');
    
    // 주보게시판 카테고리 ID 조회
    const [categories] = await connection.query(
      'SELECT category_id FROM board_categories WHERE category_code = ?',
      ['bulletin']
    );
    
    if (categories.length === 0) {
      console.log('⚠️ 주보게시판 카테고리를 찾을 수 없습니다.');
      await connection.rollback();
      return;
    }
    
    const bulletinCategoryId = categories[0].category_id;
    console.log(`✅ 주보게시판 카테고리 ID: ${bulletinCategoryId}\n`);
    
    // 주보게시판의 모든 게시글 조회
    const [posts] = await connection.query(
      'SELECT post_id, image_url FROM board_posts WHERE category_id = ? AND image_url IS NOT NULL AND image_url != "" AND is_deleted = FALSE',
      [bulletinCategoryId]
    );
    
    console.log(`📋 총 ${posts.length}개의 게시글에서 이미지 URL 확인 중...\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const post of posts) {
      try {
        let imageUrls = [];
        let needsUpdate = false;
        
        // image_url이 JSON 배열인지 확인
        try {
          const parsed = JSON.parse(post.image_url);
          if (Array.isArray(parsed)) {
            imageUrls = parsed;
          } else if (typeof parsed === 'string') {
            imageUrls = [parsed];
          }
        } catch (e) {
          // JSON이 아니면 단일 이미지 URL로 처리
          imageUrls = [post.image_url];
        }
        
        // 각 이미지 URL 확인 및 업데이트
        const updatedUrls = imageUrls.map((url) => {
          if (!url) return url;
          
          // 이미 새로운 경로 형식인 경우 스킵
          if (url.startsWith('/uploads/board/jubo/')) {
            return url;
          }
          
          // 기존 경로 형식인 경우 새 경로로 변환
          if (url.startsWith('/uploads/')) {
            needsUpdate = true;
            // 파일명 추출
            const filename = url.replace('/uploads/', '').split('/').pop();
            // 새 경로 형식으로 변환
            return `/uploads/board/jubo/${filename}`;
          }
          
          // 기타 형식은 그대로 유지
          return url;
        });
        
        if (needsUpdate) {
          // JSON 배열로 저장
          const newImageUrl = imageUrls.length > 1 
            ? JSON.stringify(updatedUrls)
            : updatedUrls[0];
          
          await connection.query(
            'UPDATE board_posts SET image_url = ? WHERE post_id = ?',
            [newImageUrl, post.post_id]
          );
          
          console.log(`✅ [post_id: ${post.post_id}] 이미지 URL 업데이트 완료`);
          console.log(`   기존: ${post.image_url.substring(0, 50)}...`);
          console.log(`   신규: ${newImageUrl.substring(0, 50)}...\n`);
          updatedCount++;
        } else {
          console.log(`⏭️  [post_id: ${post.post_id}] 이미지 URL 변경 불필요 (이미 새 형식)\n`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ [post_id: ${post.post_id}] 오류 발생:`, error.message);
        errorCount++;
      }
    }
    
    await connection.commit();
    
    console.log('\n=== 마이그레이션 완료 ===');
    console.log(`✅ 업데이트된 게시글: ${updatedCount}개`);
    console.log(`⏭️  변경 불필요한 게시글: ${skippedCount}개`);
    console.log(`❌ 오류 발생 게시글: ${errorCount}개`);
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ 마이그레이션 중 오류 발생:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  migrateBulletinImageUrls()
    .then(() => {
      console.log('\n✅ 마이그레이션 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 마이그레이션 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

module.exports = { migrateBulletinImageUrls };

