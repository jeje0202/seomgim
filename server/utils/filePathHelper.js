// 파일 경로 헬퍼 함수
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '../..');

/**
 * URL에서 실제 파일 경로 추출 (앨범 이미지)
 * @param {string} url 웹 URL (예: /uploads/album/album-123.jpg 또는 /uploads/album/album1/album-123.jpg)
 * @returns {string} 실제 파일 경로
 */
/**
 * URL에서 실제 파일 경로 추출 (앨범 이미지)
 * @param {string} url 웹 URL (예: /uploads/album/album-123.jpg, /uploads/album/202512/album-123.jpg)
 * @returns {string} 실제 파일 경로
 */
function getAlbumFilePathFromUrl(url) {
  if (!url) return null;

  const baseAlbumDir = path.join(projectRoot, 'data', 'album');

  // /uploads/album/ 제거
  if (url.startsWith('/uploads/album/')) {
    const relativePath = url.replace('/uploads/album/', '');
    // URL 경로 구분자(/)를 OS 경로 구분자(\ 또는 /)로 변환
    const osPath = relativePath.split('/').join(path.sep);
    return path.join(baseAlbumDir, osPath);
  }

  return null;
}

/**
 * URL에서 실제 파일 경로 추출 (썸네일)
 * @param {string} url 웹 URL 
 * 예1(레거시): /uploads/thumbnail/202512/thumb-123.jpg
 * 예2(신규): /uploads/album/202512/thumbnails/thumb-123.jpg
 * @returns {string} 실제 파일 경로
 */
function getThumbnailFilePathFromUrl(url) {
  if (!url) return null;

  // 1. 신규 방식: 앨범 폴더 내의 thumbnails 폴더 확인 (/uploads/album/.../thumbnails/...)
  // 이 경우 getAlbumFilePathFromUrl 로직과 동일하게 처리 가능 (경로만 맞으면 됨)
  if (url.startsWith('/uploads/album/') && url.includes('/thumbnails/')) {
    const baseAlbumDir = path.join(projectRoot, 'data', 'album');
    const relativePath = url.replace('/uploads/album/', '');
    const osPath = relativePath.split('/').join(path.sep);
    return path.join(baseAlbumDir, osPath);
  }

  // 2. 레거시 방식: /uploads/thumbnail/ 확인
  if (url.startsWith('/uploads/thumbnail/')) {
    const baseThumbnailDir = path.join(projectRoot, 'data', 'thumbnail');
    const relativePath = url.replace('/uploads/thumbnail/', '');
    const osPath = relativePath.split('/').join(path.sep);
    return path.join(baseThumbnailDir, osPath);
  }

  return null;
}

/**
 * URL에서 실제 파일 경로 추출 (게시판 이미지)
 * @param {string} url 웹 URL
 * @returns {string} 실제 파일 경로
 */
function getBoardFilePathFromUrl(url) {
  if (!url) return null;

  // 게시판 이미지 URL인지 확인
  if (url.startsWith('/uploads/board/')) {
    // URL에서 sub path 전체 추출 (jubo/file.jpg)
    const relativePath = url.replace('/uploads/board/', '');
    const osPath = relativePath.split('/').join(path.sep);
    return path.join(projectRoot, 'data', 'board', osPath);
  }

  // 기존 경로 형식 (하위 호환성)
  // /uploads/로 시작하고 다른 접두사가 없는 경우 data 폴더 루트에서 찾기
  if (url.startsWith('/uploads/')) {
    // album, thumbnail, news 등이 아닌 경우에만
    if (!url.startsWith('/uploads/album/') &&
      !url.startsWith('/uploads/thumbnail/') &&
      !url.startsWith('/uploads/news/')) {
      const filename = url.replace('/uploads/', '');
      return path.join(projectRoot, 'data', filename);
    }
  }

  return null;
}

module.exports = {
  getAlbumFilePathFromUrl,
  getThumbnailFilePathFromUrl,
  getBoardFilePathFromUrl
};

