/**
 * [파일 용도] 슈퍼관리자 전용 CMS 섹션 내용 관리 및 SQLite 이력/복구 API 서비스
 * Nginx 및 Vite 프록시 호환 /api/cms 엔드포인트 연동
 */

import { getToken } from './authApi';

// CMS 데이터 인터페이스
export interface CmsSectionItem {
  section_key: string;
  title: string;
  content: any;
  current_version: number;
  updated_at: string;
  updated_by?: string;
}

export interface CmsHistoryItem {
  history_id: number;
  section_key: string;
  version: number;
  content: any;
  change_memo?: string;
  created_at: string;
  created_by?: string;
}

const API_BASE_URL = '/api/cms';

// 헬퍼: 인증 헤더 생성
const getAuthHeaders = () => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

/**
 * 전체 CMS 영역 목록 조회 (누구나 접근 가능)
 */
export async function getAllCmsSections(): Promise<Record<string, CmsSectionItem>> {
  try {
    const res = await fetch(`${API_BASE_URL}/sections`);
    const data = await res.json();
    if (data.success) {
      return data.data || {};
    }
    throw new Error(data.message || 'CMS 전체 목록을 불러오지 못했습니다.');
  } catch (error) {
    console.error('getAllCmsSections Error:', error);
    return {};
  }
}

/**
 * 특정 CMS 영역 단일 조회
 */
export async function getCmsSection(key: string): Promise<CmsSectionItem | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/sections/${key}`);
    const data = await res.json();
    if (data.success) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.error(`getCmsSection (${key}) Error:`, error);
    return null;
  }
}

/**
 * 특정 CMS 영역 내용 수정 (슈퍼관리자 권한 필요)
 */
export async function updateCmsSection(
  key: string,
  title: string,
  content: any,
  changeMemo: string
): Promise<CmsSectionItem> {
  const res = await fetch(`${API_BASE_URL}/sections/${key}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      title,
      content,
      change_memo: changeMemo
    })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'CMS 섹션 저장 중 오류가 발생했습니다.');
  }

  return data.data;
}

/**
 * 특정 CMS 영역 변경 이력 목록 조회 (슈퍼관리자 권한 필요)
 */
export async function getCmsHistory(key: string): Promise<CmsHistoryItem[]> {
  const res = await fetch(`${API_BASE_URL}/sections/${key}/history`, {
    headers: getAuthHeaders()
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'CMS 이력 목록을 불러오지 못했습니다.');
  }

  return data.data || [];
}

/**
 * 과거 특정 버전 내용으로 복구 (슈퍼관리자 권한 필요)
 */
export async function restoreCmsVersion(key: string, historyId: number): Promise<CmsSectionItem> {
  const res = await fetch(`${API_BASE_URL}/sections/${key}/restore/${historyId}`, {
    method: 'POST',
    headers: getAuthHeaders()
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || '이력 복구 처리 중 오류가 발생했습니다.');
  }

  return data.data;
}
