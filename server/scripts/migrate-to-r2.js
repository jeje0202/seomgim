/**
 * [파일 용도] 로컬 data/ 디렉토리의 모든 기존 이미지를 Cloudflare R2 클라우드 스토리지로 10개 병렬 초고속 일괄 이관하는 마이그레이션 스크립트
 */

const fs = require('fs');
const path = require('path');
const { uploadToR2 } = require('../utils/r2Storage');

// 로컬 data/ 디렉토리 절대 경로
const projectRoot = path.resolve(__dirname, '../..');
const dataDir = path.join(projectRoot, 'data');

// [한글 코멘트] 폴더 내 모든 파일 탐색 (재귀 함수)
const getAllFiles = (dirPath, arrayOfFiles = []) => {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;

  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      // 이미지 파일만 대상
      const ext = path.extname(file).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'].includes(ext)) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
};

// [한글 코멘트] 병렬 마이그레이션 실행 함수 (동시 10개 배치 처리)
const migrateAllImagesToR2 = async () => {
  console.log('🚀 [Cloudflare R2] 로컬 이미지 -> 클라우드 10개 병렬 이관 시작...');
  console.log(`📂 탐색 대상 디렉토리: ${dataDir}`);

  const allFiles = getAllFiles(dataDir);
  const totalFiles = allFiles.length;

  if (totalFiles === 0) {
    console.log('ℹ️ 이관할 이미지 파일이 data/ 디렉토리에 없습니다.');
    return;
  }

  console.log(`📦 총 ${totalFiles}개의 로컬 이미지 파일을 발견하였습니다.`);
  console.log('--------------------------------------------------');

  let successCount = 0;
  let failCount = 0;
  let totalBytesTransferred = 0;
  const CONCURRENCY = 10; // 동시 업로드 개수

  for (let i = 0; i < totalFiles; i += CONCURRENCY) {
    const batch = allFiles.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (filePath, batchIdx) => {
        const index = i + batchIdx + 1;
        const relativePath = path.relative(dataDir, filePath).replace(/\\/g, '/');
        // [한글 코멘트] 사용자 요청: media.foryou.me/seomgim/data/ 하위 폴더 구조에 맞춰 R2 Key 설정
        const r2Key = `seomgim/data/${relativePath}`;

        try {
          const stats = fs.statSync(filePath);
          const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

          await uploadToR2(filePath, r2Key);

          successCount++;
          totalBytesTransferred += stats.size;

          const progress = ((index / totalFiles) * 100).toFixed(1);
          console.log(`[${index}/${totalFiles}] (${progress}%) ✅ 성공: ${relativePath} (${fileSizeMB}MB) -> R2 URL: https://media.foryou.me/${r2Key}`);
        } catch (err) {
          failCount++;
          console.error(`[${index}/${totalFiles}] ❌ 실패: ${relativePath} -> 오류: ${err.message}`);
        }
      })
    );
  }

  const totalMBTransferred = (totalBytesTransferred / 1024 / 1024).toFixed(2);

  console.log('==================================================');
  console.log('🎉 [Cloudflare R2] 로컬 이미지 클라우드 이관 완전 완료!');
  console.log(`✅ 성공 파일 수: ${successCount}개 / ${totalFiles}개`);
  console.log(`❌ 실패 파일 수: ${failCount}개`);
  console.log(`📊 이관 전송 총 용량: ${totalMBTransferred} MB`);
  console.log('==================================================');
};

// 스크립트 전역 실행
migrateAllImagesToR2()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ 마이그레이션 예외 발생:', err);
    process.exit(1);
  });
