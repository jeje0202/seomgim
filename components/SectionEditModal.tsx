/**
 * [파일 용도] 슈퍼관리자 전용 영역 내용 편집, 이력 조회 및 과거 버전 복구 모달 컴포넌트
 * 영역의 크기 고정 규격 준수, 7개 주요 영역(인사말/설립목적/비전/섬기는분들/협력기관/예배안내/온라인헌금) 통합 전환 편집,
 * SQLite 기반 변경 이력 저장 및 원클릭 복구, 모달 크기/위치 저장을 지원함
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, History, RotateCcw, Plus, Trash2, CheckCircle2, Move, Eye, ArrowUp, ArrowDown, PlusCircle } from 'lucide-react';
import { updateCmsSection, getCmsHistory, restoreCmsVersion, getCmsSection, CmsSectionItem, CmsHistoryItem } from '../services/cmsApi';
import AlertModal, { AlertType } from './AlertModal';

interface SectionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionKey: string;
  sectionTitle: string;
  initialData: any;
  initialTab?: 'edit' | 'history';
  onSaved: (updatedSection: CmsSectionItem) => void;
}

// 7개 주요 영역 메타데이터 정의 (담임목사 인사말, 예배 안내, 온라인 헌금 포함)
const SUB_SECTIONS = [
  { key: 'pastor_greeting', name: '✝️ 담임목사 인사말' },
  { key: 'church_purpose', name: '🌸 교회 설립 목적' },
  { key: 'church_vision', name: '🌐 창원 섬김의 교회 비전' },
  { key: 'serving_members', name: '👥 섬기는 분들' },
  { key: 'partner_orgs', name: '🏢 부설 및 협력기관' },
  { key: 'worship_schedule', name: '⏰ 예배 안내' },
  { key: 'online_offering', name: '💳 온라인 헌금 안내' }
];

const SectionEditModal: React.FC<SectionEditModalProps> = ({
  isOpen,
  onClose,
  sectionKey,
  sectionTitle,
  initialData,
  initialTab = 'edit',
  onSaved
}) => {
  // ── 1. 현재 선택된 서브 섹션 키
  const [currentSubKey, setCurrentSubKey] = useState<string>(sectionKey || 'pastor_greeting');

  // ── 2. 탭 상태 ('edit' | 'history')
  const [activeTab, setActiveTab] = useState<'edit' | 'history'>('edit');

  // ── 3. 편집 폼 상태
  const [content, setContent] = useState<any>({});
  const [changeMemo, setChangeMemo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [loadingSection, setLoadingSection] = useState<boolean>(false);

  // ── 4. 이력 목록 상태
  const [historyList, setHistoryList] = useState<CmsHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // ── 5. 알림 모달 상태 (사용자 규칙 3: alert는 항상 모달창으로 처리)
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: AlertType;
    showCancel?: boolean;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  // ── 6. 모달창 위치 및 크기 기억 (사용자 규칙 7: 위치/크기 변화 감지 및 닫힐 때 다중모니터 고려 저장)
  const [modalBounds, setModalBounds] = useState<{
    width: number;
    height: number;
    left: number;
    top: number;
  }>({
    width: 820,
    height: 680,
    left: 100,
    top: 80
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; left: number; top: number }>({ x: 0, y: 0, left: 0, top: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // 지정된 키의 데이터 및 이력 불러오기
  const loadSubSectionData = async (key: string) => {
    try {
      setLoadingSection(true);
      const data = await getCmsSection(key);
      if (data && data.content) {
        setContent(data.content);
      } else if (key === sectionKey && initialData) {
        setContent(initialData);
      } else {
        setContent({});
      }
    } catch (e) {
      console.error('서브 섹션 데이터 로드 오류:', e);
    } finally {
      setLoadingSection(false);
    }
  };

  // 모달 오픈 시 서브 섹션 데이터 및 위치 로드
  useEffect(() => {
    if (!isOpen) return;

    const targetKey = sectionKey || 'pastor_greeting';
    setCurrentSubKey(targetKey);
    setContent(initialData || {});
    setChangeMemo('');
    setActiveTab(initialTab);

    loadSubSectionData(targetKey);

    if (initialTab === 'history') {
      loadHistory(targetKey);
    }

    // 위치 및 크기 불러오기 (localStorage 저장값 사용)
    const storageKey = `cms_modal_bounds_${targetKey}`;
    const saved = localStorage.getItem(storageKey);

    const screenW = window.innerWidth || 1280;
    const screenH = window.innerHeight || 800;

    let defaultW = Math.min(850, screenW - 40);
    let defaultH = Math.min(720, screenH - 60);
    let defaultL = Math.max(20, (screenW - defaultW) / 2);
    let defaultT = Math.max(20, (screenH - defaultH) / 2);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const validL = Math.min(Math.max(10, parsed.left), screenW - 100);
        const validT = Math.min(Math.max(10, parsed.top), screenH - 100);
        const validW = Math.min(Math.max(450, parsed.width), screenW - 20);
        const validH = Math.min(Math.max(400, parsed.height), screenH - 20);

        setModalBounds({ width: validW, height: validH, left: validL, top: validT });
        return;
      } catch (e) {
        console.error('모달 위치 로드 실패:', e);
      }
    }

    setModalBounds({ width: defaultW, height: defaultH, left: defaultL, top: defaultT });
  }, [isOpen, sectionKey]);

  // 서브 섹션 변경 시 데이터 재로드
  const handleSwitchSubSection = (key: string) => {
    setCurrentSubKey(key);
    setChangeMemo('');
    loadSubSectionData(key);
    if (activeTab === 'history') {
      loadHistory(key);
    }
  };

  // 모달 닫힐 때 위치 저장 (사용자 규칙 7)
  const saveBoundsToStorage = (bounds: typeof modalBounds) => {
    const storageKey = `cms_modal_bounds_${currentSubKey}`;
    localStorage.setItem(storageKey, JSON.stringify(bounds));
  };

  const handleCloseModal = () => {
    saveBoundsToStorage(modalBounds);
    onClose();
  };

  // 모달 타이틀바 드래그 이동
  const handleMouseDownHeader = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('button')) {
      return;
    }
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      left: modalBounds.left,
      top: modalBounds.top
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvent.clientX - dragStartRef.current.x;
      const deltaY = moveEvent.clientY - dragStartRef.current.y;

      const newLeft = dragStartRef.current.left + deltaX;
      const newTop = dragStartRef.current.top + deltaY;

      setModalBounds(prev => ({ ...prev, left: newLeft, top: newTop }));
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        saveBoundsToStorage(modalBounds);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // 이력 데이터 조회
  const loadHistory = async (key = currentSubKey) => {
    try {
      setLoadingHistory(true);
      const data = await getCmsHistory(key);
      setHistoryList(data);
    } catch (err: any) {
      setAlertConfig({
        isOpen: true,
        title: '오류',
        message: err.message || '변경 이력을 불러오지 못했습니다.',
        type: 'error'
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleTabChange = (tab: 'edit' | 'history') => {
    setActiveTab(tab);
    if (tab === 'history') {
      loadHistory(currentSubKey);
    }
  };

  // ── 7. 저장 핸들러
  const handleSave = async () => {
    try {
      setIsSubmitting(true);
      const currentSubMeta = SUB_SECTIONS.find(s => s.key === currentSubKey);
      const title = currentSubMeta ? currentSubMeta.name.replace(/^[^\s]+\s*/, '') : sectionTitle;

      const updated = await updateCmsSection(currentSubKey, title, content, changeMemo);
      onSaved(updated);
      saveBoundsToStorage(modalBounds);

      setAlertConfig({
        isOpen: true,
        title: '저장 완료',
        message: `성공적으로 저장되었습니다! (버전 v${updated.current_version})`,
        type: 'success',
        onConfirm: () => {
          setChangeMemo('');
        }
      });
    } catch (err: any) {
      setAlertConfig({
        isOpen: true,
        title: '저장 실패',
        message: err.message || '저장 중 오류가 발생했습니다.',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 8. 특정 과거 버전 복구 핸들러
  const handleRestore = (item: CmsHistoryItem) => {
    setAlertConfig({
      isOpen: true,
      title: '과거 버전 복구',
      message: `버전 v${item.version} (${new Date(item.created_at).toLocaleString('ko-KR')}) 내용으로 복구하시겠습니까?\n\n현재 내용이 이력으로 기록되고 해당 내용으로 복원됩니다.`,
      type: 'warning',
      showCancel: true,
      onConfirm: async () => {
        try {
          setIsSubmitting(true);
          const restored = await restoreCmsVersion(currentSubKey, item.history_id);
          setContent(restored.content);
          onSaved(restored);

          setAlertConfig({
            isOpen: true,
            title: '복구 완료',
            message: `버전 v${item.version} 내용으로 성공적으로 복구되었습니다.`,
            type: 'success',
            onConfirm: () => {
              setActiveTab('edit');
              loadHistory(currentSubKey);
            }
          });
        } catch (err: any) {
          setAlertConfig({
            isOpen: true,
            title: '복구 실패',
            message: err.message || '복구 중 오류가 발생했습니다.',
            type: 'error'
          });
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  if (!isOpen) return null;

  // [한글 코멘트] 카드 목록 순서 변경 헬퍼 함수 (위로 / 아래로)
  const moveItem = (list: any[], index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return list;
    const updated = [...list];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    return updated;
  };

  // [한글 코멘트] 카드 특정 위치 신규 삽입 헬퍼 함수 (원하는 위치에 새로 추가)
  const insertItemAt = (list: any[], index: number, newItem: any) => {
    const updated = [...list];
    updated.splice(index + 1, 0, newItem);
    return updated;
  };

  // ── 9. 서브 섹션별 입력 폼 렌더링
  const renderFormFields = () => {
    if (loadingSection) {
      return (
        <div className="py-8 text-center text-slate-500 font-medium">
          데이터를 불러오는 중...
        </div>
      );
    }

    // 1. 담임목사 인사말 폼
    if (currentSubKey === 'pastor_greeting') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">직함/라벨</label>
              <input
                type="text"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 text-sm font-semibold"
                value={content.pastor_role || ''}
                onChange={(e) => setContent({ ...content, pastor_role: e.target.value })}
                placeholder="예: Senior Pastor"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">담임목사 성함</label>
              <input
                type="text"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 text-sm font-bold"
                value={content.pastor_name || ''}
                onChange={(e) => setContent({ ...content, pastor_name: e.target.value })}
                placeholder="예: 박신철 목사"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">목회 표어/슬로건</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 text-sm font-bold"
              value={content.slogan || ''}
              onChange={(e) => setContent({ ...content, slogan: e.target.value })}
              placeholder="예: 이웃을 섬기며 성장하는 열린 교회"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">환영 인사 제목</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 text-sm font-bold"
              value={content.greeting_title || ''}
              onChange={(e) => setContent({ ...content, greeting_title: e.target.value })}
              placeholder="예: 할렐루야! 주님의 이름으로 환영합니다."
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">인사말 본문 내용 (줄바꿈 가능)</label>
            <textarea
              rows={5}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 text-sm leading-relaxed"
              value={content.greeting_body || ''}
              onChange={(e) => setContent({ ...content, greeting_body: e.target.value })}
              placeholder="인사말 전체 본문 텍스트"
            />
          </div>
        </div>
      );
    }

    // 2. 교회 설립 목적 폼
    if (currentSubKey === 'church_purpose') {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">설립 목적 핵심 강조 문구</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 text-sm font-semibold"
              value={content.subtitle || ''}
              onChange={(e) => setContent({ ...content, subtitle: e.target.value })}
              placeholder="예: 우리 교회의 설립목적은 상담치유를 위한 들꽃 목회입니다."
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">설립 목적 상세 설명</label>
            <textarea
              rows={4}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 text-sm leading-relaxed"
              value={content.description || ''}
              onChange={(e) => setContent({ ...content, description: e.target.value })}
              placeholder="상세 본문 내용 입력 (줄바꿈 가능)"
            />
          </div>
        </div>
      );
    }

    // 3. 교회 비전 폼
    if (currentSubKey === 'church_vision') {
      const items: string[] = content.items || [];
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">비전 주요 설명</label>
            <textarea
              rows={3}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 text-sm leading-relaxed"
              value={content.description || ''}
              onChange={(e) => setContent({ ...content, description: e.target.value })}
              placeholder="비전 설명 텍스트 입력"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-slate-700">비전 실천 항목 리스트</label>
              <button
                type="button"
                onClick={() => setContent({ ...content, items: [...items, '신규 실천 항목'] })}
                className="flex items-center gap-1 text-xs bg-sky-100 text-sky-700 px-3 py-1.5 rounded-lg font-bold hover:bg-sky-200 cursor-pointer"
              >
                <Plus size={14} /> 항목 추가
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-sm"
                    value={item}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[idx] = e.target.value;
                      setContent({ ...content, items: updated });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = items.filter((_, i) => i !== idx);
                      setContent({ ...content, items: updated });
                    }}
                    className="text-rose-500 hover:text-rose-700 p-2 rounded-lg hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">교회 슬로건 / 표어</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 text-sm font-bold text-center"
              value={content.slogan || ''}
              onChange={(e) => setContent({ ...content, slogan: e.target.value })}
              placeholder="예: &quot;예수님의 사랑 이야기가 가득한 교회&quot;"
            />
          </div>
        </div>
      );
    }

    // 4. 섬기는 분들 폼
    if (currentSubKey === 'serving_members') {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">부목사 / 강도사 목록</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 text-sm"
              value={content.pastors || ''}
              onChange={(e) => setContent({ ...content, pastors: e.target.value })}
              placeholder="예: 전병학, 유보배, 정동호(선교), 박승현(중고등부)"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">장로 목록</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 text-sm"
              value={content.elders || ''}
              onChange={(e) => setContent({ ...content, elders: e.target.value })}
              placeholder="예: 박주현, (은퇴) 성재효, 성창규"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">파송선교사 목록</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 text-sm"
              value={content.missionaries || ''}
              onChange={(e) => setContent({ ...content, missionaries: e.target.value })}
              placeholder="예: 최성은(호주), 전용득(필리핀), 김바울(북방)"
            />
          </div>
        </div>
      );
    }

    // 5. 부설 및 협력기관 폼
    if (currentSubKey === 'partner_orgs') {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">부설 기관</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 text-sm"
              value={content.attached || ''}
              onChange={(e) => setContent({ ...content, attached: e.target.value })}
              placeholder="예: 창원섬김 부설 나눔상담연구소"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">협력 기관</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 text-sm"
              value={content.partners || ''}
              onChange={(e) => setContent({ ...content, partners: e.target.value })}
              placeholder="예: 국내외 미자립교회 및 선교단체"
            />
          </div>
        </div>
      );
    }

    // 6. 예배 안내 폼 (카드 목록 수정, 삭제, 위치 삽입, 순서 변경 완전 지원)
    if (currentSubKey === 'worship_schedule') {
      const services: any[] = content.services || [];
      return (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">예배 안내 부제목</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 text-sm"
              value={content.subtitle || ''}
              onChange={(e) => setContent({ ...content, subtitle: e.target.value })}
              placeholder="예: 하나님과 만나는 감격스러운 시간으로 여러분을 초대합니다."
            />
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
              <div>
                <label className="text-sm font-bold text-slate-800">예배 시간 카드 목록 ({services.length}개)</label>
                <p className="text-xs text-slate-500">각 카드의 내용을 수정, 삭제하거나 원하는 위치에 새로 삽입할 수 있습니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setContent({ ...content, services: [...services, { name: '신규 예배', time: '오후 1:00', location: '본당' }] })}
                className="flex items-center gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm cursor-pointer"
              >
                <Plus size={15} /> 신규 예배 카드 추가
              </button>
            </div>

            <div className="space-y-3">
              {services.map((svc, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm hover:border-teal-300 transition-colors">
                  {/* 카드 헤더 및 제어 버튼 */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="bg-teal-100 text-teal-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                        카드 #{idx + 1}
                      </span>
                      <strong className="text-sm text-slate-800 font-bold">{svc.name || '신규 예배'}</strong>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* 순서 이동: 위로 */}
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => {
                          const updated = moveItem(services, idx, 'up');
                          setContent({ ...content, services: updated });
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg disabled:opacity-30 cursor-pointer"
                        title="위로 이동"
                      >
                        <ArrowUp size={15} />
                      </button>

                      {/* 순서 이동: 아래로 */}
                      <button
                        type="button"
                        disabled={idx === services.length - 1}
                        onClick={() => {
                          const updated = moveItem(services, idx, 'down');
                          setContent({ ...content, services: updated });
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg disabled:opacity-30 cursor-pointer"
                        title="아래로 이동"
                      >
                        <ArrowDown size={15} />
                      </button>

                      {/* 이 카드 뒤에 삽입 */}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = insertItemAt(services, idx, { name: '신규 예배', time: '오후 1:00', location: '본당' });
                          setContent({ ...content, services: updated });
                        }}
                        className="flex items-center gap-1 text-xs bg-sky-100 text-sky-700 hover:bg-sky-200 px-2.5 py-1 rounded-lg font-bold ml-1 cursor-pointer"
                        title="이 위치 다음에 새 카드 삽입"
                      >
                        <PlusCircle size={14} /> 이 위치에 삽입
                      </button>

                      {/* 삭제 */}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = services.filter((_, i) => i !== idx);
                          setContent({ ...content, services: updated });
                        }}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg ml-1 cursor-pointer"
                        title="카드 삭제"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* 카드 정보 수정 필드 */}
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-12 sm:col-span-5">
                      <label className="block text-xs font-bold text-slate-600 mb-1">예배명 (카드 제목)</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500"
                        value={svc.name || ''}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          setContent({ ...content, services: updated });
                        }}
                        placeholder="예: 주일 오전예배"
                      />
                    </div>

                    <div className="col-span-12 sm:col-span-4">
                      <label className="block text-xs font-bold text-slate-600 mb-1">예배 시간</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-rose-600 focus:ring-2 focus:ring-teal-500"
                        value={svc.time || ''}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[idx] = { ...updated[idx], time: e.target.value };
                          setContent({ ...content, services: updated });
                        }}
                        placeholder="예: 오전 11:00"
                      />
                    </div>

                    <div className="col-span-12 sm:col-span-3">
                      <label className="block text-xs font-bold text-slate-600 mb-1">장소</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-teal-500"
                        value={svc.location || ''}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[idx] = { ...updated[idx], location: e.target.value };
                          setContent({ ...content, services: updated });
                        }}
                        placeholder="예: 본당 / 교육관"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // 7. 온라인 헌금 안내 폼 (카드 목록 수정, 삭제, 위치 삽입, 순서 변경 완전 지원)
    if (currentSubKey === 'online_offering') {
      const accounts: any[] = content.accounts || [];
      return (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <label className="text-sm font-bold text-slate-800">헌금 계좌 카드 목록 ({accounts.length}개)</label>
              <p className="text-xs text-slate-500">첨부 이미지의 각 헌금 카드를 수정, 삭제하거나 원하는 위치에 새 카드를 삽입할 수 있습니다.</p>
            </div>
            <button
              type="button"
              onClick={() => setContent({ ...content, accounts: [...accounts, { name: '신규 헌금', account: '000-0000-0000', bank: '은행', holder: '대한예수교장로회창원섬김' }] })}
              className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm cursor-pointer"
            >
              <Plus size={15} /> 신규 계좌 카드 추가
            </button>
          </div>

          <div className="space-y-4">
            {accounts.map((acc, idx) => (
              <div key={idx} className="bg-blue-50/60 border border-blue-200 rounded-2xl p-4 space-y-3 shadow-sm hover:border-blue-300 transition-colors">
                {/* 계좌 카드 헤더 및 제어 버튼 */}
                <div className="flex items-center justify-between border-b border-blue-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                      계좌 카드 #{idx + 1}
                    </span>
                    <strong className="text-sm text-blue-900 font-bold">{acc.name || '신규 헌금 계좌'}</strong>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* 위로 이동 */}
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => {
                        const updated = moveItem(accounts, idx, 'up');
                        setContent({ ...content, accounts: updated });
                      }}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-blue-100 rounded-lg disabled:opacity-30 cursor-pointer"
                      title="위로 이동"
                    >
                      <ArrowUp size={15} />
                    </button>

                    {/* 아래로 이동 */}
                    <button
                      type="button"
                      disabled={idx === accounts.length - 1}
                      onClick={() => {
                        const updated = moveItem(accounts, idx, 'down');
                        setContent({ ...content, accounts: updated });
                      }}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-blue-100 rounded-lg disabled:opacity-30 cursor-pointer"
                      title="아래로 이동"
                    >
                      <ArrowDown size={15} />
                    </button>

                    {/* 이 위치에 삽입 */}
                    <button
                      type="button"
                      onClick={() => {
                        const updated = insertItemAt(accounts, idx, { name: '신규 헌금', account: '000-0000-0000', bank: '은행', holder: '대한예수교장로회창원섬김' });
                        setContent({ ...content, accounts: updated });
                      }}
                      className="flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-2.5 py-1 rounded-lg font-bold ml-1 cursor-pointer"
                      title="이 위치 다음에 새 계좌 카드 삽입"
                    >
                      <PlusCircle size={14} /> 이 위치에 삽입
                    </button>

                    {/* 삭제 */}
                    <button
                      type="button"
                      onClick={() => {
                        const updated = accounts.filter((_, i) => i !== idx);
                        setContent({ ...content, accounts: updated });
                      }}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg ml-1 cursor-pointer"
                      title="카드 삭제"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* 입력 필드 (헌금 항목명, 은행명, 계좌번호, 예금주) */}
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12 sm:col-span-6">
                    <label className="block text-xs font-bold text-slate-600 mb-1">헌금 항목명 (카드 제목)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-blue-800 focus:ring-2 focus:ring-blue-500"
                      value={acc.name || ''}
                      onChange={(e) => {
                        const updated = [...accounts];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setContent({ ...content, accounts: updated });
                      }}
                      placeholder="예: 교회 헌금 / 섬김과 나눔의 집 (무료급식)"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-6">
                    <label className="block text-xs font-bold text-slate-600 mb-1">은행명</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500"
                      value={acc.bank || ''}
                      onChange={(e) => {
                        const updated = [...accounts];
                        updated[idx] = { ...updated[idx], bank: e.target.value };
                        setContent({ ...content, accounts: updated });
                      }}
                      placeholder="예: 수협 / 농협"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-7">
                    <label className="block text-xs font-bold text-slate-600 mb-1">계좌번호</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                      value={acc.account || ''}
                      onChange={(e) => {
                        const updated = [...accounts];
                        updated[idx] = { ...updated[idx], account: e.target.value };
                        setContent({ ...content, accounts: updated });
                      }}
                      placeholder="예: 2060-0054-8337"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-5">
                    <label className="block text-xs font-bold text-slate-600 mb-1">예금주</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-blue-500"
                      value={acc.holder || ''}
                      onChange={(e) => {
                        const updated = [...accounts];
                        updated[idx] = { ...updated[idx], holder: e.target.value };
                        setContent({ ...content, accounts: updated });
                      }}
                      placeholder="예: 대한예수교장로회창원섬김"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[9990]"
        onClick={handleCloseModal}
      />

      <div
        ref={modalRef}
        style={{
          position: 'fixed',
          width: `${modalBounds.width}px`,
          height: `${modalBounds.height}px`,
          left: `${modalBounds.left}px`,
          top: `${modalBounds.top}px`,
          zIndex: 9995
        }}
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
      >
        {/* 모달 헤더 (드래그하여 이동) */}
        <div
          onMouseDown={handleMouseDownHeader}
          className="bg-slate-800 text-white px-5 py-3.5 flex items-center justify-between cursor-move select-none shrink-0"
        >
          <div className="flex items-center gap-2">
            <Move size={18} className="text-rose-400" />
            <h3 className="font-bold text-lg text-white">
              웹사이트 주요 영역 - 통합 실시간 레이아웃 편집기
            </h3>
          </div>
          <button
            onClick={handleCloseModal}
            className="w-8 h-8 rounded-full bg-slate-700 hover:bg-rose-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        {/* 서브 섹션 선택 탭 (7개 주요 영역 탭 전환) */}
        <div className="bg-slate-100 p-2 border-b border-slate-200 flex flex-wrap gap-1.5 shrink-0">
          {SUB_SECTIONS.map((sec) => (
            <button
              key={sec.key}
              type="button"
              onClick={() => handleSwitchSubSection(sec.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentSubKey === sec.key
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {sec.name}
            </button>
          ))}
        </div>

        {/* 모드 탭 (편집 vs 이력) */}
        <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
          <button
            onClick={() => handleTabChange('edit')}
            className={`flex-1 py-2.5 px-4 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'edit'
                ? 'bg-white text-rose-600 border-b-2 border-rose-600'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Save size={16} />
            내용 편집 모드
          </button>

          <button
            onClick={() => handleTabChange('history')}
            className={`flex-1 py-2.5 px-4 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-rose-600 border-b-2 border-rose-600'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History size={16} />
            변경 이력 및 원클릭 복구
          </button>
        </div>

        {/* 모달 바디 */}
        <div className="flex-1 overflow-y-auto p-6 bg-white space-y-6">
          {activeTab === 'edit' ? (
            <div className="space-y-6">
              {/* 입력 필드 영역 */}
              {renderFormFields()}

              {/* 실시간 미리보기 (Live Preview) */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase">
                  <Eye size={14} className="text-teal-600" />
                  <span>실시간 화면 미리보기 (Live Preview)</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                  {currentSubKey === 'pastor_greeting' && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-400 uppercase">{content.pastor_role || 'Senior Pastor'}</span>
                      <h4 className="text-lg font-bold text-slate-800">{content.pastor_name || '박신철 목사'}</h4>
                      <p className="text-teal-700 text-xs font-bold bg-teal-50 px-3 py-1 rounded border-l-2 border-teal-500">{content.slogan || '(목회 슬로건)'}</p>
                      <p className="font-bold text-slate-800 pt-1">{content.greeting_title || '(환영 제목)'}</p>
                      <p className="text-slate-600 text-xs">{content.greeting_body || '(인사말 본문)'}</p>
                    </div>
                  )}

                  {currentSubKey === 'church_purpose' && (
                    <div>
                      <p className="font-bold text-emerald-900 border-b border-emerald-100 pb-2 mb-2">
                        {content.subtitle || '(강조 문구 미리보기)'}
                      </p>
                      <p className="text-slate-600">
                        {content.description || '(상세 설명 미리보기)'}
                      </p>
                    </div>
                  )}

                  {currentSubKey === 'church_vision' && (
                    <div className="space-y-2">
                      <p className="text-slate-700">{content.description || '(비전 설명 미리보기)'}</p>
                      <div className="bg-sky-50 p-2.5 rounded-lg space-y-1 text-xs">
                        {(content.items || []).map((it: string, i: number) => (
                          <div key={i} className="flex items-center gap-1.5 text-sky-800">
                            <span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>
                            <span>{it}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-center font-bold text-sky-900 pt-1">{content.slogan || '(슬로건 미리보기)'}</p>
                    </div>
                  )}

                  {currentSubKey === 'serving_members' && (
                    <div className="space-y-2 text-xs">
                      <div><strong className="text-slate-800">부목사/강도사:</strong> {content.pastors || '(미입력)'}</div>
                      <div><strong className="text-slate-800">장로:</strong> {content.elders || '(미입력)'}</div>
                      <div><strong className="text-slate-800">파송선교사:</strong> {content.missionaries || '(미입력)'}</div>
                    </div>
                  )}

                  {currentSubKey === 'partner_orgs' && (
                    <div className="space-y-2 text-xs">
                      <div><strong className="text-slate-800">부설 기관:</strong> {content.attached || '(미입력)'}</div>
                      <div><strong className="text-slate-800">협력 기관:</strong> {content.partners || '(미입력)'}</div>
                    </div>
                  )}

                  {currentSubKey === 'worship_schedule' && (
                    <div className="space-y-2 text-xs">
                      <p className="font-bold text-slate-800">{content.subtitle || '(예배 안내 서브타이틀)'}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(content.services || []).map((svc: any, i: number) => (
                          <div key={i} className="bg-slate-50 p-2 rounded border border-slate-200">
                            <span className="font-bold text-rose-500 block">{svc.time} ({svc.location})</span>
                            <span className="font-bold text-slate-800">{svc.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentSubKey === 'online_offering' && (
                    <div className="space-y-2 text-xs">
                      <p className="font-bold text-blue-900 text-center">온라인 헌금 안내</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(content.accounts || []).map((acc: any, i: number) => (
                          <div key={i} className="bg-blue-50 p-2 rounded border border-blue-200">
                            <span className="font-bold text-blue-700 block">{acc.name}</span>
                            <span className="font-mono font-bold text-slate-800">{acc.account} {acc.bank}</span>
                            <span className="block text-[10px] text-slate-500">예금주: {acc.holder}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 변경 식별 메모 */}
              <div className="pt-2">
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  변경 사유 / 식별 메모 (선택)
                </label>
                <input
                  type="text"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-rose-500"
                  value={changeMemo}
                  onChange={(e) => setChangeMemo(e.target.value)}
                  placeholder="예: 예배 시간 및 헌금 계좌 수정"
                />
              </div>
            </div>
          ) : (
            <div>
              {loadingHistory ? (
                <div className="py-12 text-center text-slate-500 font-medium">
                  SQLite DB에서 이력 목록을 조회하는 중...
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  아직 저장된 변경 이력이 없습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* [한글 코멘트] 사용자 요청: 초기 원본 디폴트 데이터(v1) 복원 안내 바 추가 */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-700 font-bold text-sm">
                        🌱 초기 디폴트 원본 상태 (v1) 언제든지 원클릭 복원 가능
                      </span>
                    </div>
                    {historyList.find(h => h.version === 1) && (
                      <button
                        type="button"
                        onClick={() => {
                          const defaultV1 = historyList.find(h => h.version === 1);
                          if (defaultV1) handleRestore(defaultV1);
                        }}
                        className="flex items-center gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm transition-all cursor-pointer"
                      >
                        <RotateCcw size={13} />
                        초기 원본 디폴트(v1)로 복원
                      </button>
                    )}
                  </div>

                  {historyList.map((item) => (
                    <div
                      key={item.history_id}
                      className={`border rounded-xl p-4 transition-colors ${
                        item.version === 1
                          ? 'border-emerald-300 bg-emerald-50/40'
                          : 'border-slate-200 bg-slate-50/50 hover:border-rose-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                              item.version === 1
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.version === 1 ? '🌱 초기 원본 디폴트 (v1)' : `v${item.version}`}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(item.created_at).toLocaleString('ko-KR')}
                          </span>
                          <span className="text-xs text-slate-600 font-medium">
                            (작성자: {item.created_by || '관리자'})
                          </span>
                        </div>

                        <button
                          onClick={() => handleRestore(item)}
                          className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                            item.version === 1
                              ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                              : 'bg-slate-800 hover:bg-rose-600 text-white'
                          }`}
                        >
                          <RotateCcw size={12} />
                          {item.version === 1 ? '초기 원본으로 복구' : '이 버전으로 복구'}
                        </button>
                      </div>

                      {item.change_memo && (
                        <p className="text-sm font-semibold text-slate-700 mb-2">
                          📝 {item.change_memo}
                        </p>
                      )}

                      <pre className="text-xs bg-white border border-slate-200 p-2.5 rounded-lg max-h-32 overflow-y-auto text-slate-600 whitespace-pre-wrap font-mono">
                        {JSON.stringify(item.content, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            현재 탭: <strong className="text-rose-600">{SUB_SECTIONS.find(s => s.key === currentSubKey)?.name}</strong>
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-sm transition-colors cursor-pointer"
            >
              닫기
            </button>
            {activeTab === 'edit' && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                {isSubmitting ? '저장 중...' : '최종 내용 저장'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 사용자 규칙 3: alert는 모달창으로 표시 */}
      <AlertModal
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        showCancel={alertConfig.showCancel}
        onConfirm={alertConfig.onConfirm}
      />
    </>,
    document.body
  );
};

export default SectionEditModal;
