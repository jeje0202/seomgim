/**
 * [파일 용도] 앨범 및 썸네일 미디어 파일의 한국 시간대(Asia/Seoul) 기준 연월(YYYYMM) 경로 및 URL 생성 유틸리티
 * Cloudflare R2 전용 업로드 구조에 맞춰 불필요한 로컬 빈 폴더(mkdirSync) 디스크 생성을 제거함
 */

const path = require('path');

// 프로젝트 루트 경로
const projectRoot = path.resolve(__dirname, '../..');

/**
 * [한글 코멘트] 한국 시간대(Asia/Seoul) 기준 현재 연월(YYYYMM) 문자열 반환 함수
 */
function getKstYearMonth() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit'
  });
  // 'YYYY-MM' -> 'YYYYMM'
  return formatter.format(new Date()).replace('-', '');
}

/**
 * 앨범 이미지 논리 저장 경로 반환 (로컬 빈 디렉토리 생성 없이 경로만 계산)
 */
function getAlbumStoragePath() {
  const folderName = getKstYearMonth();
  return path.join(projectRoot, 'data', 'album', folderName);
}

/**
 * 썸네일 논리 저장 경로 반환 (로컬 빈 디렉토리 생성 없이 경로만 계산)
 */
function getThumbnailStoragePath() {
  const folderName = getKstYearMonth();
  return path.join(projectRoot, 'data', 'album', folderName, 'thumbnails');
}

/**
 * 앨범 이미지 상대 URL 생성
 */
function getAlbumImageUrl(filename, storagePath) {
  const baseAlbumDir = path.join(projectRoot, 'data', 'album');

  if (!storagePath || storagePath === baseAlbumDir) {
    return `/uploads/album/${filename}`;
  }

  const relativePath = path.relative(baseAlbumDir, storagePath);
  const urlPath = relativePath.split(path.sep).join('/');

  return `/uploads/album/${urlPath}/${filename}`;
}

/**
 * 썸네일 상대 URL 생성
 */
function getThumbnailUrl(filename, storagePath) {
  if (storagePath) {
    const baseAlbumDir = path.join(projectRoot, 'data', 'album');
    const baseThumbnailDir = path.join(projectRoot, 'data', 'thumbnail');

    if (storagePath.startsWith(baseAlbumDir)) {
      const relativePath = path.relative(baseAlbumDir, storagePath);
      const urlPath = relativePath.split(path.sep).join('/');
      return `/uploads/album/${urlPath}/${filename}`;
    }

    if (storagePath.startsWith(baseThumbnailDir)) {
      const relativePath = path.relative(baseThumbnailDir, storagePath);
      const urlPath = relativePath.split(path.sep).join('/');
      if (!urlPath) return `/uploads/thumbnail/${filename}`;
      return `/uploads/thumbnail/${urlPath}/${filename}`;
    }
  }

  const folderName = getKstYearMonth();
  return `/uploads/thumbnail/${folderName}/${filename}`;
}

module.exports = {
  getKstYearMonth,
  getAlbumStoragePath,
  getThumbnailStoragePath,
  getAlbumImageUrl,
  getThumbnailUrl
};
