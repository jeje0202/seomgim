/**
 * [파일 용도] 게시글·교회소식·설문조사 본문 HTML의 XSS(크로스 사이트 스크립팅) 공격 차단 및 안전한 링크 변환 유틸리티
 * DOMPurify를 사용하여 스크립트 태그, 인라인 이벤트 핸들러(onerror, onclick 등), javascript: 스킴을 원천 제거함
 */

import DOMPurify from 'dompurify';
import { linkifyHTML } from './textUtils';

// [한글 코멘트] 서식 도구바(HtmlToolbar) 및 본문 이미지 삽입에서 사용하는 안전한 태그 목록
const ALLOWED_TAGS = [
  'p', 'br', 'div', 'span',
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'hr', 'pre', 'code',
  'a', 'img', 'font',
  'table', 'thead', 'tbody', 'tr', 'th', 'td'
];

// [한글 코멘트] 안전한 표시 및 스타일링 속성만 허용 (on* 이벤트 속성 전면 차단)
const ALLOWED_ATTR = [
  'href', 'target', 'rel',
  'src', 'alt', 'title', 'width', 'height', 'loading', 'decoding',
  'style', 'class',
  'color', 'size', 'face', 'align',
  'data-image-id'
];

let hookRegistered = false;

/**
 * [한글 코멘트] 외부로 열리는 링크에 rel="noopener noreferrer" 보안 속성을 강제 부여하는 훅 등록
 */
function ensureDomPurifyHooks() {
  if (hookRegistered || typeof window === 'undefined') return;
  hookRegistered = true;

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const target = node.getAttribute('target');
      if (target === '_blank') {
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
    // style 속성 내 expression() 또는 javascript: URL 악용 차단
    if (node.hasAttribute('style')) {
      const styleVal = node.getAttribute('style') || '';
      if (/expression\s*\(|javascript\s*:|vbscript\s*:/i.test(styleVal)) {
        node.removeAttribute('style');
      }
    }
  });
}

/**
 * [한글 코멘트] 서식 HTML에서 위험 요소를 제거하여 안전한 HTML 문자열로 반환하는 함수
 */
export const sanitizeRichHtml = (dirtyHtml: string | undefined | null): string => {
  if (!dirtyHtml) return '';
  ensureDomPurifyHooks();

  return DOMPurify.sanitize(dirtyHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false
  });
};

/**
 * [한글 코멘트] 텍스트 내 URL을 하이퍼링크로 변환한 뒤 XSS 살균(Sanitize) 처리를 수행하는 통합 함수
 */
export const sanitizeAndLinkifyHtml = (dirtyHtml: string | undefined | null): string => {
  if (!dirtyHtml) return '';
  const linked = linkifyHTML(dirtyHtml);
  return sanitizeRichHtml(linked);
};
