/**
 * [파일 용도] 앨범 및 이미지 뷰어 고속 전환을 위한 이미지 백그라운드 프리로딩 및 디코딩 캐시 유틸리티
 * 브라우저 메모리 내 Image 참조를 일정 개수 유지하여 페이지 넘김 시 디코딩 지연 없이 즉시 표시되도록 함
 */

import { resolveMediaUrl } from './mediaUrl';

// [한글 코멘트] 이미 프리로드 요청된 URL 집합 및 가비지 컬렉션 방지용 LRU 버퍼
const preloadedUrlSet = new Set<string>();
const decodedImageCache: HTMLImageElement[] = [];
const MAX_DECODED_CACHE = 40;

/**
 * [한글 코멘트] 단일 이미지 URL을 백그라운드에서 미리 다운로드 및 디코딩하는 함수
 */
export const preloadImage = (rawUrl?: string | null): void => {
  if (typeof window === 'undefined' || !rawUrl) return;
  const url = resolveMediaUrl(rawUrl);
  if (!url || preloadedUrlSet.has(url)) return;

  preloadedUrlSet.add(url);

  const img = new Image();
  img.decoding = 'async';
  img.src = url;

  if (typeof img.decode === 'function') {
    img.decode().catch(() => {
      // 디코딩 실패 시 무시 (화면 렌더링에는 영향 없음)
    });
  }

  decodedImageCache.push(img);
  if (decodedImageCache.length > MAX_DECODED_CACHE) {
    decodedImageCache.shift();
  }
};

/**
 * [한글 코멘트] 현재 보고 있는 인덱스 주변(다음 2장, 이전 1장)의 고화질 이미지를 우선순위대로 프리로드하는 함수
 */
export const preloadAdjacentImages = (images: string[], currentIndex: number): void => {
  if (!images || images.length <= 1) return;

  const total = images.length;
  const targetOffsets = [1, -1, 2]; // 다음 사진 최우선 -> 이전 사진 -> 다다음 사진 순서

  targetOffsets.forEach((offset) => {
    const targetIdx = (currentIndex + offset + total) % total;
    if (targetIdx !== currentIndex && images[targetIdx]) {
      preloadImage(images[targetIdx]);
    }
  });
};
