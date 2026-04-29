// 텍스트 처리 유틸리티 함수
import React from 'react';

/**
 * 텍스트 내의 URL을 자동으로 클릭 가능한 링크로 변환하는 함수
 * @param text 원본 텍스트
 * @returns URL이 링크로 변환된 React 요소 배열
 */
export const linkifyText = (text: string): (string | JSX.Element)[] => {
  // URL 정규식 패턴 (http://, https://, www.로 시작하는 URL 포함)
  // 도메인 부분은 여러 레벨을 지원 (예: seomgim.foryou.me, subdomain.example.co.uk)
  const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?)/g;

  // URL을 찾아서 배열로 분리
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlPattern.exec(text)) !== null) {
    // URL 이전의 텍스트 추가
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // URL 추출
    let url = match[0];

    // www.로 시작하는 경우 http:// 추가
    if (url.startsWith('www.')) {
      url = 'https://' + url;
    }

    // 링크 요소 생성
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-teal-600 hover:text-teal-700 underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {match[0]}
      </a>
    );

    lastIndex = urlPattern.lastIndex;
  }

  // 마지막 텍스트 추가
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  // URL이 없으면 원본 텍스트 반환
  if (parts.length === 0) {
    return [text];
  }

  return parts;
};

/**
 * HTML 문자열 내의 텍스트 노드에서 URL을 링크로 변환하는 함수
 * @param html HTML 문자열
 * @returns URL이 링크로 변환된 HTML 문자열
 */
export const linkifyHTML = (html: string): string => {
  // URL 정규식 패턴 (이미 링크로 감싸진 URL은 제외)
  // < 문자를 제외하여 태그(플레이스홀더)가 URL에 포함되지 않도록 함
  const urlPattern = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s<>"']*)?)/g;

  // 1. 이미 존재하는 <a> 태그 전체를 임시 보호 (중복 링크 방지)
  const linkPlaceholders: { [key: string]: string } = {};
  let linkIndex = 0;
  // <a> 태그와 그 내용을 통째로 보호
  let processedHtml = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (match) => {
    const placeholder = `<__LINK_PLACEHOLDER_${linkIndex}__>`;
    linkPlaceholders[placeholder] = match;
    linkIndex++;
    return placeholder;
  });

  // 2. 나머지 HTML 태그를 임시 보호 (URL 매칭 오작동 방지)
  const tagPlaceholders: { [key: string]: string } = {};
  let tagIndex = 0;
  processedHtml = processedHtml.replace(/<[^>]+>/g, (match) => {
    // 이미 보호된 링크 플레이스홀더도 태그 형식(<...>)이므로 여기서 다시 매칭되어 보호됨
    // 복원 시 역순으로 진행하면 문제 없음
    const placeholder = `<__TAG_PLACEHOLDER_${tagIndex}__>`;
    tagPlaceholders[placeholder] = match;
    tagIndex++;
    return placeholder;
  });

  // 3. 텍스트에서 URL을 링크로 변환
  processedHtml = processedHtml.replace(urlPattern, (url) => {
    let linkUrl = url;
    if (url.startsWith('www.')) {
      linkUrl = 'https://' + url;
    }
    return `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="text-teal-600 hover:text-teal-700 underline break-all" onclick="event.stopPropagation();">${url}</a>`;
  });

  // 4. 태그 복원 (특수문자 처리를 위해 콜백 함수 사용)
  Object.keys(tagPlaceholders).forEach((placeholder) => {
    processedHtml = processedHtml.replace(placeholder, () => tagPlaceholders[placeholder]);
  });

  // 5. 링크 복원
  Object.keys(linkPlaceholders).forEach((placeholder) => {
    processedHtml = processedHtml.replace(placeholder, () => linkPlaceholders[placeholder]);
  });

  return processedHtml;
};

