// 기존 썸네일 파일을 년월별 폴더로 이동하는 스크립트
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const albumDir = path.join(projectRoot, 'data', 'album');
const thumbnailBaseDir = path.join(projectRoot, 'data', 'thumbnail');

console.log('=== 썸네일 파일 이동 스크립트 시작 ===');
console.log(`프로젝트 루트: ${projectRoot}`);
console.log(`앨범 디렉토리: ${albumDir}`);
console.log(`썸네일 기본 디렉토리: ${thumbnailBaseDir}`);

// 썸네일 기본 디렉토리 생성
if (!fs.existsSync(thumbnailBaseDir)) {
  fs.mkdirSync(thumbnailBaseDir, { recursive: true });
  console.log(`✅ 썸네일 기본 디렉토리 생성: ${thumbnailBaseDir}`);
}

/**
 * 파일의 생성 시간을 기반으로 년월 폴더명 반환
 * @param {string} filePath 파일 경로
 * @returns {string} 년월 폴더명 (예: 202512)
 */
function getYearMonthFolder(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const date = stats.birthtime || stats.mtime; // 생성 시간 또는 수정 시간
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}${month}`;
  } catch (error) {
    // 오류 발생 시 현재 날짜 사용
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}${month}`;
  }
}

/**
 * 앨범 폴더에서 썸네일 파일 찾기 및 이동
 */
function migrateThumbnailsFromAlbum() {
  if (!fs.existsSync(albumDir)) {
    console.log(`⚠️ 앨범 디렉토리가 없습니다: ${albumDir}`);
    return;
  }

  console.log('\n=== 앨범 폴더에서 썸네일 파일 찾기 ===');
  
  try {
    const files = fs.readdirSync(albumDir);
    const thumbnailFiles = files.filter(file => {
      // thumb-로 시작하는 파일만 썸네일로 간주
      return file.startsWith('thumb-') && fs.statSync(path.join(albumDir, file)).isFile();
    });

    console.log(`썸네일 파일 개수: ${thumbnailFiles.length}개`);

    let movedCount = 0;
    let errorCount = 0;

    thumbnailFiles.forEach(file => {
      try {
        const sourcePath = path.join(albumDir, file);
        const yearMonth = getYearMonthFolder(sourcePath);
        const targetDir = path.join(thumbnailBaseDir, yearMonth);
        const targetPath = path.join(targetDir, file);

        // 대상 폴더 생성
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
          console.log(`✅ 폴더 생성: ${targetDir}`);
        }

        // 파일 이동
        fs.renameSync(sourcePath, targetPath);
        movedCount++;
        console.log(`✅ 이동: ${file} -> ${yearMonth}/${file}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ 이동 실패: ${file}`, error.message);
      }
    });

    console.log(`\n썸네일 이동 완료: ${movedCount}개 성공, ${errorCount}개 실패`);
  } catch (error) {
    console.error('❌ 앨범 폴더 읽기 오류:', error);
  }
}

/**
 * data 폴더에서 썸네일 파일 찾기 및 이동 (게시판 이미지 썸네일)
 */
function migrateThumbnailsFromData() {
  const dataDir = path.join(projectRoot, 'data');
  
  if (!fs.existsSync(dataDir)) {
    console.log(`⚠️ 데이터 디렉토리가 없습니다: ${dataDir}`);
    return;
  }

  console.log('\n=== data 폴더에서 썸네일 파일 찾기 ===');
  
  try {
    const files = fs.readdirSync(dataDir);
    const thumbnailFiles = files.filter(file => {
      // thumb-로 시작하는 파일만 썸네일로 간주
      const filePath = path.join(dataDir, file);
      return file.startsWith('thumb-') && fs.statSync(filePath).isFile();
    });

    console.log(`썸네일 파일 개수: ${thumbnailFiles.length}개`);

    let movedCount = 0;
    let errorCount = 0;

    thumbnailFiles.forEach(file => {
      try {
        const sourcePath = path.join(dataDir, file);
        const yearMonth = getYearMonthFolder(sourcePath);
        const targetDir = path.join(thumbnailBaseDir, yearMonth);
        const targetPath = path.join(targetDir, file);

        // 대상 폴더 생성
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
          console.log(`✅ 폴더 생성: ${targetDir}`);
        }

        // 파일 이동
        fs.renameSync(sourcePath, targetPath);
        movedCount++;
        console.log(`✅ 이동: ${file} -> ${yearMonth}/${file}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ 이동 실패: ${file}`, error.message);
      }
    });

    console.log(`\n썸네일 이동 완료: ${movedCount}개 성공, ${errorCount}개 실패`);
  } catch (error) {
    console.error('❌ data 폴더 읽기 오류:', error);
  }
}

// 실행
try {
  migrateThumbnailsFromAlbum();
  migrateThumbnailsFromData();
  console.log('\n=== 썸네일 파일 이동 완료 ===');
} catch (error) {
  console.error('❌ 스크립트 실행 오류:', error);
  process.exit(1);
}

