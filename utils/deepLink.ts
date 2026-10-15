/**
 * [파일 용도] 딥링크(개별 콘텐츠 고유 URL) 생성, URL 쿼리 파라미터 파싱 및 브라우저 주소창 동기화 유틸리티
 * 교회소식(?news=), 게시글/주보(?post=), 게시판 카테고리(?board=), 사진첩(?album=), 섹션(?section=) 직접 접근 및 공유를 지원함
 */

// [한글 코멘트] 딥링크 파라미터 타입 정의
export interface DeepLinkParams {
  section?: string | null;
  news?: number | string | null;
  post?: number | string | null;
  board?: string | null;
  album?: number | string | null;
}

/**
 * [한글 코멘트] 현재 브라우저 주소창의 딥링크 쿼리 파라미터를 파싱하여 반환하는 함수
 */
export const getDeepLinkParams = () => {
  if (typeof window === 'undefined') {
    return {
      section: null,
      newsId: null,
      postId: null,
      boardCode: null,
      albumId: null
    };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const hashSection = window.location.hash ? window.location.hash.replace('#', '') : null;

  const section = searchParams.get('section') || hashSection || null;
  const newsRaw = searchParams.get('news');
  const postRaw = searchParams.get('post');
  const boardCode = searchParams.get('board') || null;
  const albumRaw = searchParams.get('album');

  const newsId = newsRaw && !isNaN(Number(newsRaw)) ? Number(newsRaw) : null;
  const postId = postRaw && !isNaN(Number(postRaw)) ? Number(postRaw) : null;
  const albumId = albumRaw && !isNaN(Number(albumRaw)) ? Number(albumRaw) : null;

  return {
    section,
    newsId,
    postId,
    boardCode,
    albumId
  };
};

/**
 * [한글 코멘트] 공유용 전체 딥링크 URL을 생성하는 함수
 */
export const buildShareUrl = (params: DeepLinkParams): string => {
  if (typeof window === 'undefined') {
    return 'https://seomgim.foryou.me';
  }

  const url = new URL(window.location.origin + window.location.pathname);

  if (params.section) {
    url.searchParams.set('section', String(params.section));
  }
  if (params.board) {
    url.searchParams.set('board', String(params.board));
  }
  if (params.news !== undefined && params.news !== null) {
    url.searchParams.set('news', String(params.news));
  }
  if (params.post !== undefined && params.post !== null) {
    url.searchParams.set('post', String(params.post));
  }
  if (params.album !== undefined && params.album !== null) {
    url.searchParams.set('album', String(params.album));
  }

  return url.toString();
};

/**
 * [한글 코멘트] 페이지 새로고침 없이 브라우저 주소창의 딥링크 쿼리 파라미터를 업데이트하는 함수
 */
export const setDeepLinkParams = (
  params: Record<string, string | number | null | undefined>,
  replace: boolean = true
): void => {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, String(value));
    }
  });

  const nextUrl = url.pathname + (url.search ? url.search : '') + (url.hash ? url.hash : '');
  if (replace) {
    window.history.replaceState(window.history.state, '', nextUrl);
  } else {
    window.history.pushState(window.history.state, '', nextUrl);
  }
};

/**
 * [한글 코멘트] 특정 딥링크 쿼리 파라미터들을 주소창에서 제거하는 함수 (모달 닫기 시 호출)
 */
export const clearDeepLinkParams = (keys: string[]): void => {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  let modified = false;

  keys.forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      modified = true;
    }
  });

  if (modified) {
    const nextUrl = url.pathname + (url.search ? url.search : '') + (url.hash ? url.hash : '');
    window.history.replaceState(window.history.state, '', nextUrl);
  }
};

/**
 * [한글 코멘트] HTML 문자열에서 태그를 제거하고 순수 텍스트 요약본을 추출하는 헬퍼 함수
 */
export const extractPlainText = (htmlOrText: string, maxLength: number = 120): string => {
  if (!htmlOrText) return '';
  const cleaned = htmlOrText
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxLength)}...`;
};
