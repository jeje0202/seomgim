// 사이트 설정 파일
// 도메인 및 SEO 관련 설정을 중앙에서 관리

/**
 * 사이트 기본 설정
 * 실제 도메인으로 변경하세요
 */
export const siteConfig = {
  // 사이트 기본 정보
  name: '창원섬김의교회',
  nameEn: 'Seomgim Church',
  description: '대한예수교 장로회 창원섬김의교회 공식 홈페이지입니다. 교회 소개, 예배 안내, 교회 소식, 게시판, 은혜의 순간들을 제공합니다.',
  
  // 도메인 설정 (실제 도메인으로 변경 필요)
  domain: 'https://seomgim.foryou.me', // 또는 실제 도메인
  baseUrl: typeof window !== 'undefined' ? window.location.origin : 'https://seomgim.foryou.me',
  
  // 소셜 미디어 이미지
  ogImage: '/church_rainbow.jpg',
  twitterImage: '/church_rainbow.jpg',
  
  // 주소 정보
  address: {
    locality: '창원',
    region: '경상남도',
    country: 'KR'
  },
  
  // 소셜 미디어 링크 (있는 경우)
  socialLinks: [] as string[]
};

/**
 * 전체 URL 반환
 */
export const getFullUrl = (path: string = ''): string => {
  if (path.startsWith('http')) return path;
  const base = siteConfig.baseUrl || siteConfig.domain;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

/**
 * Open Graph 이미지 URL 반환
 */
export const getOgImageUrl = (): string => {
  return getFullUrl(siteConfig.ogImage);
};

