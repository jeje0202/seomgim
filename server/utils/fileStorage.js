// 파일 저장 유틸리티 함수
const fs = require('fs');
const path = require('path');

// 프로젝트 루트 경로
const projectRoot = path.resolve(__dirname, '../..');

/**
 * 앨범 이미지 저장 경로 결정 (YYYYMM 폴더)
 * @returns {string} 저장할 폴더 경로
 */
function getAlbumStoragePath() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const folderName = `${year}${month}`; // 예: 202512

  const targetDir = path.join(projectRoot, 'data', 'album', folderName);

  // 폴더가 없으면 생성
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`[앨범 저장 경로] 새 폴더 생성: ${targetDir}`);
  }

  return targetDir;
}

/**
 * 썸네일 저장 경로 결정 (YYYYMM/thumbnails 폴더)
 * @returns {string} 저장할 폴더 경로 (예: data/album/202512/thumbnails)
 */
function getThumbnailStoragePath() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const folderName = `${year}${month}`; // 예: 202512

  const thumbnailDir = path.join(projectRoot, 'data', 'album', folderName, 'thumbnails');

  // 폴더가 없으면 생성
  if (!fs.existsSync(thumbnailDir)) {
    fs.mkdirSync(thumbnailDir, { recursive: true });
    console.log(`[썸네일 저장 경로] 새 폴더 생성: ${thumbnailDir}`);
  }

  return thumbnailDir;
}

/**
 * 앨범 이미지 URL 생성 (저장 경로에 따라)
 * @param {string} filename 파일명
 * @param {string} storagePath 실제 저장 경로
 * @returns {string} 웹 접근 URL
 */
function getAlbumImageUrl(filename, storagePath) {
  const baseAlbumDir = path.join(projectRoot, 'data', 'album');

  // 스토리지 경로가 없으면 기본 경로 가정 (data/album)
  if (!storagePath) return `/uploads/album/${filename}`;

  // 기본 폴더에 저장된 경우
  if (storagePath === baseAlbumDir) {
    return `/uploads/album/${filename}`;
  }

  // 하위 폴더에 저장된 경우 (YYYYMM 등)
  // 예: data/album/202512 -> 202512
  const relativePath = path.relative(baseAlbumDir, storagePath);
  // 윈도우 경로(\)를 URL(/)로 변환
  const urlPath = relativePath.split(path.sep).join('/');

  return `/uploads/album/${urlPath}/${filename}`;
}

/**
 * 썸네일 URL 생성
 * @param {string} filename 파일명
 * @param {string} storagePath 실제 저장 경로 (옵션)
 * @returns {string} 웹 접근 URL
 */
function getThumbnailUrl(filename, storagePath) {
  // 저장 경로가 주어진 경우 해당 경로 기반으로 URL 생성
  if (storagePath) {
    const baseAlbumDir = path.join(projectRoot, 'data', 'album');
    const baseThumbnailDir = path.join(projectRoot, 'data', 'thumbnail');

    // 1. data/album 하위에 저장된 경우 (새로운 방식: data/album/YYYYMM/thumbnails)
    if (storagePath.startsWith(baseAlbumDir)) {
      const relativePath = path.relative(baseAlbumDir, storagePath);
      const urlPath = relativePath.split(path.sep).join('/');
      return `/uploads/album/${urlPath}/${filename}`;
    }

    // 2. data/thumbnail 하위에 저장된 경우 (레거시 방식)
    if (storagePath.startsWith(baseThumbnailDir)) {
      const relativePath = path.relative(baseThumbnailDir, storagePath);
      const urlPath = relativePath.split(path.sep).join('/');
      // data/thumbnail 바로 아래인 경우
      if (!urlPath) return `/uploads/thumbnail/${filename}`;
      return `/uploads/thumbnail/${urlPath}/${filename}`;
    }
  }

  // 저장 경로가 없거나 매칭되지 않는 경우 (기본값: 현재 날짜 기준 레거시 썸네일 경로)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const folderName = `${year}${month}`;

  return `/uploads/thumbnail/${folderName}/${filename}`;
}

module.exports = {
  getAlbumStoragePath,
  getThumbnailStoragePath,
  getAlbumImageUrl,
  getThumbnailUrl
};
