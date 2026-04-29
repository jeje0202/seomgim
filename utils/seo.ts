// SEO 메타 태그 동적 관리 유틸리티
// 페이지별로 메타 태그를 업데이트할 수 있는 함수들

import { getFullUrl, getOgImageUrl } from '../config/site.config';

/**
 * 페이지의 메타 태그를 업데이트하는 함수
 * @param title 페이지 제목
 * @param description 페이지 설명
 * @param image 이미지 URL (선택사항)
 * @param url 페이지 URL (선택사항)
 */
export const updateMetaTags = (
  title: string,
  description: string,
  image?: string,
  url?: string
) => {
  // 기본 도메인
  const baseUrl = window.location.origin;
  const fullTitle = `${title} - 창원섬김의교회`;
  
  // 페이지 제목 업데이트
  document.title = fullTitle;
  
  // Meta description 업데이트 또는 생성
  let metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
  if (!metaDescription) {
    metaDescription = document.createElement('meta');
    metaDescription.setAttribute('name', 'description');
    document.head.appendChild(metaDescription);
  }
  metaDescription.setAttribute('content', description);
  
  // Open Graph 태그 업데이트 헬퍼 함수
  const updateOGTag = (property: string, content: string) => {
    let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('property', property);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  };
  
  // Open Graph 태그 업데이트
  updateOGTag('og:title', fullTitle);
  updateOGTag('og:description', description);
  if (image) {
    updateOGTag('og:image', image.startsWith('http') ? image : `${baseUrl}${image}`);
  }
  if (url) {
    updateOGTag('og:url', url.startsWith('http') ? url : `${baseUrl}${url}`);
  }
  
  // Twitter Card 태그 업데이트 헬퍼 함수
  const updateTwitterTag = (name: string, content: string) => {
    let tag = document.querySelector(`meta[name="twitter:${name}"]`) as HTMLMetaElement;
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', `twitter:${name}`);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  };
  
  // Twitter Card 태그 업데이트
  updateTwitterTag('title', fullTitle);
  updateTwitterTag('description', description);
  if (image) {
    updateTwitterTag('image', image.startsWith('http') ? image : `${baseUrl}${image}`);
  }
  
  // Canonical URL 업데이트
  let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', url ? (url.startsWith('http') ? url : `${baseUrl}${url}`) : baseUrl);
};

/**
 * 기본 메타 태그로 리셋하는 함수
 */
export const resetMetaTags = () => {
  updateMetaTags(
    '창원섬김의교회 - Seomgim Church',
    '대한예수교 장로회 창원섬김의교회 공식 홈페이지입니다. 교회 소개, 예배 안내, 교회 소식, 게시판, 은혜의 순간들을 제공합니다.',
    getOgImageUrl(),
    window.location.origin
  );
};

