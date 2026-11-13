/**
 * [파일 용도] Cloudflare R2 공개 CDN 미디어 URL 정규화 및 안전한 다운로드 URL 생성 유틸리티
 * 상대 경로(/uploads/...)로 저장된 레거시 URL도 R2 CDN 직결 URL로 변환하여 백엔드 중계 없이 고속 로딩되도록 지원함
 */

const R2_PUBLIC_BASE = 'https://media.foryou.me/seomgim/data';

/**
 * [한글 코멘트] 이미지 URL을 Cloudflare R2 공개 CDN 직결 URL로 변환하는 함수
 */
export const resolveMediaUrl = (url?: string | null): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // data: 또는 blob: 미리보기 URL은 그대로 유지
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // 이미 전체 http(s) URL인 경우 그대로 반환
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // /uploads/... 또는 uploads/... 상대 경로를 R2 공개 CDN URL로 즉시 변환
  if (trimmed.startsWith('/uploads/')) {
    return `${R2_PUBLIC_BASE}/${trimmed.replace(/^\/uploads\//, '')}`;
  }
  if (trimmed.startsWith('uploads/')) {
    return `${R2_PUBLIC_BASE}/${trimmed.replace(/^uploads\//, '')}`;
  }

  return trimmed;
};

/**
 * [한글 코멘트] 이미지 뷰어에서 CORS 제약 없이 원본 파일을 즉시 저장할 수 있도록 백엔드 다운로드 엔드포인트 URL을 생성하는 함수
 */
export const buildMediaDownloadUrl = (imageUrl: string, filename: string): string => {
  const params = new URLSearchParams({
    url: imageUrl,
    filename
  });
  return `/api/upload/download?${params.toString()}`;
};
