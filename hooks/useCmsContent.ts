/**
 * [파일 용도] SQLite 기반 CMS 섹션 데이터 상태 관리 커스텀 훅
 * 웹사이트 주요 영역의 내용 로드, 리프레시, 섹션 데이터 접근을 손쉽게 연결함
 */

import { useState, useEffect, useCallback } from 'react';
import { getAllCmsSections, CmsSectionItem } from '../services/cmsApi';

export function useCmsContent() {
  const [sections, setSections] = useState<Record<string, CmsSectionItem>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 전체 CMS 데이터를 불러오는 함수
  const fetchCmsData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllCmsSections();
      setSections(data);
      setError(null);
    } catch (err: any) {
      console.error('CMS 데이터 로딩 중 에러:', err);
      setError(err.message || 'CMS 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCmsData();
  }, [fetchCmsData]);

  // 특정 섹션 데이터 또는 기본값(Fallback)을 리턴하는 헬퍼 함수
  const getSectionContent = <T>(key: string, fallback: T): T => {
    if (sections[key] && sections[key].content) {
      return sections[key].content as T;
    }
    return fallback;
  };

  // 특정 섹션 업데이트 후 전체 상태 갱신 함수
  const updateSectionState = (updatedSection: CmsSectionItem) => {
    setSections((prev) => ({
      ...prev,
      [updatedSection.section_key]: updatedSection
    }));
  };

  return {
    sections,
    loading,
    error,
    getSectionContent,
    refreshCms: fetchCmsData,
    updateSectionState
  };
}
