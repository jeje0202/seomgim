// 태그 관리 모달 컴포넌트
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Edit2, Trash2, GripVertical } from 'lucide-react';
import { getTags, createTag, updateTag, deleteTag, Tag } from '../services/boardApi';
import { hasRole, getUserInfo } from '../services/authApi';
import { useModalBackButton } from '../hooks/useModalBackButton';
import AlertModal from './AlertModal';

interface TagManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

// 색상 팔레트 (중복 방지를 위한 다양한 색상)
const COLOR_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#a855f7', // purple
  '#eab308', // yellow
  '#22c55e', // green
  '#f43f5e', // rose
  '#0ea5e9', // sky
  '#d946ef', // fuchsia
  '#64748b', // slate
];

// 문자열을 해시하여 일관된 색상 생성
const generateColorFromText = (text: string, existingColors: string[]): string => {
  if (!text || !text.trim()) {
    return COLOR_PALETTE[0];
  }

  // 문자열 해시 생성
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit 정수로 변환
  }

  // 해시를 양수로 변환하고 팔레트 인덱스로 사용
  const index = Math.abs(hash) % COLOR_PALETTE.length;
  let selectedColor = COLOR_PALETTE[index];

  // 기존 색상과 중복되는지 확인
  const usedColors = new Set(existingColors);
  if (!usedColors.has(selectedColor)) {
    return selectedColor;
  }

  // 중복되면 사용되지 않은 색상 찾기
  for (const color of COLOR_PALETTE) {
    if (!usedColors.has(color)) {
      return color;
    }
  }

  // 모두 사용 중이면 해시 기반 색상으로 생성
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
};

const TagManagementModal: React.FC<TagManagementModalProps> = ({ isOpen, onClose, onUpdate }) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingTag, setEditingTag] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ tag_name: '', tag_color: '#3b82f6' });
  const [newTagForm, setNewTagForm] = useState({ tag_name: '', tag_color: '#3b82f6', isAutoColor: true });
  const [showAddForm, setShowAddForm] = useState(false);
  const [user, setUser] = useState(getUserInfo());
  const [draggedTagId, setDraggedTagId] = useState<number | null>(null);
  const [dragOverTagId, setDragOverTagId] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // 삭제 확인 모달 표시 여부
  const [tagToDelete, setTagToDelete] = useState<number | null>(null); // 삭제할 태그 ID
  const [initialTagsOrder, setInitialTagsOrder] = useState<number[]>([]); // 초기 태그 순서 (태그 ID 배열)

  // 권한 체크 (manager 이상)
  const canManageTags = user && hasRole(user, 'manager', 'admin', 'super-admin');

  // 모달이 열릴 때 body 스크롤 막기
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [isOpen]);

  // 모달이 처음 열릴 때만 태그 목록 로드 (useRef로 추적)
  const hasLoadedRef = useRef(false);

  const loadTags = async () => {
    setLoading(true);
    setError('');
    try {
      const tagList = await getTags();
      
      // 태그관리 모달에서는 항상 display_order 순서로 정렬
      // display_order는 1부터 시작 (0 사용 금지)
      const sortedTags = [...tagList].sort((a, b) => {
        const orderA = parseInt(String(a.display_order)) || 0;
        const orderB = parseInt(String(b.display_order)) || 0;
        // 0 이하의 값은 999999로 처리하여 맨 뒤로 배치
        const finalOrderA = orderA < 1 ? 999999 : orderA;
        const finalOrderB = orderB < 1 ? 999999 : orderB;
        return finalOrderA - finalOrderB; // 오름차순 정렬
      });
      
      setTags(sortedTags);
      // 초기 태그 순서 저장 (태그 ID 배열)
      setInitialTagsOrder(sortedTags.map(t => t.tag_id));
      
      // 새 태그 폼의 자동 색상 업데이트
      if (newTagForm.isAutoColor && newTagForm.tag_name.trim()) {
        const existingColors = sortedTags.map(t => t.tag_color);
        const autoColor = generateColorFromText(newTagForm.tag_name, existingColors);
        setNewTagForm(prev => ({ ...prev, tag_color: autoColor }));
      }
    } catch (err: any) {
      setError(err.message || '태그 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 모달이 닫힐 때 변경된 순서를 서버에 저장
  const handleCloseWithSave = useCallback(async () => {
    // 현재 태그 순서와 초기 순서 비교
    const currentOrder = tags.map(t => t.tag_id);
    const hasOrderChanged = JSON.stringify(currentOrder) !== JSON.stringify(initialTagsOrder);
    
    if (hasOrderChanged) {
      try {
        setError('');
        // 모든 태그의 display_order를 업데이트 (1부터 시작, 0 사용 금지)
        const updatePromises = tags.map((tag, index) => 
          updateTag(tag.tag_id, { display_order: index + 1 })
        );
        await Promise.all(updatePromises);
        
        // onUpdate 콜백 호출 (게시판 헤더의 태그 목록 갱신용)
        if (onUpdate) {
          await onUpdate();
        }
      } catch (err: any) {
        setError(err.message || '태그 순서 저장에 실패했습니다.');
        // 에러가 발생해도 모달은 닫지 않음 (사용자가 확인할 수 있도록)
        return;
      }
    }
    
    // 순서가 변경되지 않았거나 저장이 성공하면 모달 닫기
    onClose();
  }, [tags, initialTagsOrder, onUpdate, onClose]);

  // 모바일 뒤로 가기 버튼으로 모달 닫기
  useModalBackButton({ isOpen, onClose: handleCloseWithSave });

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleCloseWithSave();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, handleCloseWithSave]);
  
  useEffect(() => {
    // 모달이 처음 열릴 때만 태그 목록 로드
    if (isOpen && canManageTags && !hasLoadedRef.current) {
      loadTags();
      hasLoadedRef.current = true;
    }
    
    // 모달이 닫히면 플래그 초기화
    if (!isOpen) {
      hasLoadedRef.current = false;
    }
    
    // 사용자 정보 변경 감지 (storage 이벤트: 다른 탭에서 변경)
    const handleStorageChange = () => {
      const userInfo = getUserInfo();
      setUser(userInfo);
      // 권한이 없어지면 모달 닫기
      const stillCanManage = userInfo && hasRole(userInfo, 'admin', 'super-admin');
      if (!stillCanManage && isOpen) {
        handleCloseWithSave();
      }
    };
    
    // 로그아웃 이벤트 감지 (같은 탭에서 로그아웃)
    const handleLogout = () => {
      setUser(null);
      if (isOpen) {
        handleCloseWithSave();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth:logout', handleLogout);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, [isOpen, canManageTags, handleCloseWithSave]);

  // 태그 이름 변경 시 자동 색상 업데이트
  const handleNewTagNameChange = (tagName: string) => {
    if (newTagForm.isAutoColor) {
      const existingColors = tags.map(t => t.tag_color);
      const autoColor = generateColorFromText(tagName, existingColors);
      setNewTagForm(prev => ({ ...prev, tag_name: tagName, tag_color: autoColor }));
    } else {
      setNewTagForm(prev => ({ ...prev, tag_name: tagName }));
    }
  };

  // 색상 수동 변경 시 자동 색상 모드 해제
  const handleNewTagColorChange = (color: string) => {
    setNewTagForm(prev => ({ ...prev, tag_color: color, isAutoColor: false }));
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagForm.tag_name.trim()) {
      setError('태그 이름을 입력해주세요.');
      return;
    }

    setError('');
    try {
      // 마지막 순서로 추가하기 위해 현재 태그 중 최대 display_order + 1 계산
      // display_order는 1부터 시작 (0 사용 금지)
      const maxDisplayOrder = tags.length > 0 
        ? Math.max(...tags.map(t => {
            const order = parseInt(String(t.display_order)) || 0;
            return order < 1 ? 0 : order; // 1 미만이면 0으로 처리
          }))
        : 0; // 태그가 없으면 0부터 시작 (다음에 +1하면 1)
      
      const newDisplayOrder = maxDisplayOrder + 1; // 1부터 시작
      const tagId = await createTag({
        tag_name: newTagForm.tag_name.trim(),
        tag_color: newTagForm.tag_color,
        display_order: newDisplayOrder
      });
      
      // 새 태그를 로컬 상태에 추가 (서버에서 다시 불러오지 않음)
      const newTag: Tag = {
        tag_id: tagId,
        tag_name: newTagForm.tag_name.trim(),
        tag_color: newTagForm.tag_color,
        display_order: newDisplayOrder,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        post_count: 0
      };
      
      setTags(prev => {
        const updated = [...prev, newTag];
        // 초기 순서도 업데이트 (새 태그 추가 시)
        setInitialTagsOrder(updated.map(t => t.tag_id));
        return updated;
      });
      setNewTagForm({ tag_name: '', tag_color: '#3b82f6', isAutoColor: true });
      setShowAddForm(false);
      
      // 태그 추가는 즉시 반영 (onUpdate 콜백 호출)
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.message || '태그 생성에 실패했습니다.');
    }
  };

  const handleUpdateTag = async (tagId: number) => {
    if (!editForm.tag_name.trim()) {
      setError('태그 이름을 입력해주세요.');
      return;
    }

    setError('');
    try {
      await updateTag(tagId, {
        tag_name: editForm.tag_name.trim(),
        tag_color: editForm.tag_color
      });
      setEditingTag(null);
      setEditForm({ tag_name: '', tag_color: '#3b82f6' });
      // 태그 수정 후 목록 다시 로드 (초기 순서도 업데이트)
      await loadTags();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.message || '태그 수정에 실패했습니다.');
    }
  };

  const handleDeleteTag = async (tagId: number) => {
    setTagToDelete(tagId);
    setShowDeleteConfirm(true);
  };

  // 삭제 확인 모달에서 확인 버튼 클릭 시
  const handleConfirmDelete = async () => {
    if (!tagToDelete) return;
    
    setError('');
    try {
      await deleteTag(tagToDelete);
      // 태그 삭제 후 목록 다시 로드 (초기 순서도 업데이트)
      await loadTags();
      if (onUpdate) onUpdate();
      setShowDeleteConfirm(false);
      setTagToDelete(null);
    } catch (err: any) {
      setError(err.message || '태그 삭제에 실패했습니다.');
      setShowDeleteConfirm(false);
      setTagToDelete(null);
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingTag(tag.tag_id);
    setEditForm({ tag_name: tag.tag_name, tag_color: tag.tag_color });
  };

  const cancelEdit = () => {
    setEditingTag(null);
    setEditForm({ tag_name: '', tag_color: '#3b82f6' });
  };

  // 드래그 시작 (마우스 및 터치)
  const handleDragStart = (e: React.DragEvent | React.TouchEvent, tagId: number) => {
    setDraggedTagId(tagId);
    setIsReordering(true);
    
    if (e.type === 'dragstart' && 'dataTransfer' in e) {
      e.dataTransfer.effectAllowed = 'move';
    }
    
    // 드래그 중인 요소가 반투명하게 보이도록
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  // 드래그 핸들 터치 시작 (모바일)
  const handleGripTouchStart = (e: React.TouchEvent, tagId: number) => {
    e.stopPropagation(); // 이벤트 전파 중지
    const touch = e.touches[0];
    
    // 태그 아이템 요소 찾기
    const tagElement = e.currentTarget.closest('[data-tag-id]') as HTMLElement;
    if (!tagElement) return;
    
    setDraggedTagId(tagId);
    setIsReordering(true);
    tagElement.style.opacity = '0.5';
    
    // 터치 시작 위치 저장
    (tagElement as any)._touchStartY = touch.clientY;
    (tagElement as any)._touchStartId = tagId;
  };

  // 터치 이동 (모바일) - 전역으로 처리
  useEffect(() => {
    if (draggedTagId === null) return;

    const handleTouchMoveGlobal = (e: TouchEvent) => {
      if (draggedTagId === null) return;
      
      e.preventDefault(); // 스크롤 방지
      const touch = e.touches[0];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      
      // 드래그 중인 태그 요소 찾기
      if (element) {
        const tagElement = element.closest('[data-tag-id]');
        if (tagElement) {
          const targetTagId = parseInt(tagElement.getAttribute('data-tag-id') || '0');
          if (targetTagId && targetTagId !== draggedTagId) {
            setDragOverTagId(targetTagId);
          }
        }
      }
    };

    const handleTouchEndGlobal = (e: TouchEvent) => {
      const currentDraggedId = draggedTagId;
      if (currentDraggedId === null) return;

      const touch = e.changedTouches[0];
      const dropElement = document.elementFromPoint(touch.clientX, touch.clientY);
      
      // 드래그 중인 태그 요소 찾기
      const draggedElement = document.querySelector(`[data-tag-id="${currentDraggedId}"]`) as HTMLElement;
      
      if (dropElement) {
        const targetTagElement = dropElement.closest('[data-tag-id]');
        if (targetTagElement) {
          const targetTagId = parseInt(targetTagElement.getAttribute('data-tag-id') || '0');
          if (targetTagId && targetTagId !== currentDraggedId) {
            // 태그 순서 변경 처리
            const draggedIndex = tags.findIndex(t => t.tag_id === currentDraggedId);
            const targetIndex = tags.findIndex(t => t.tag_id === targetTagId);
            
            if (draggedIndex !== -1 && targetIndex !== -1) {
              // 태그 배열 순서 변경
              const newTags = [...tags];
              const [draggedTag] = newTags.splice(draggedIndex, 1);
              newTags.splice(targetIndex, 0, draggedTag);

              // display_order 업데이트 (로컬 상태만 변경, 서버 저장은 모달 닫을 때)
              // display_order는 1부터 시작 (0 사용 금지)
              const updatedTags = newTags.map((tag, index) => ({
                ...tag,
                display_order: index + 1
              }));

              setTags(updatedTags);
            }
          }
        }
      }
      
      if (draggedElement) {
        draggedElement.style.opacity = '1';
      }
      
      setDraggedTagId(null);
      setDragOverTagId(null);
      setIsReordering(false);
    };

    document.addEventListener('touchmove', handleTouchMoveGlobal, { passive: false });
    document.addEventListener('touchend', handleTouchEndGlobal);
    document.addEventListener('touchcancel', handleTouchEndGlobal);

    return () => {
      document.removeEventListener('touchmove', handleTouchMoveGlobal);
      document.removeEventListener('touchend', handleTouchEndGlobal);
      document.removeEventListener('touchcancel', handleTouchEndGlobal);
    };
  }, [draggedTagId, tags]);

  // 드래그 종료 (마우스)
  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDraggedTagId(null);
    setDragOverTagId(null);
    setIsReordering(false);
  };

  // 드래그 오버 (마우스)
  const handleDragOver = (e: React.DragEvent, tagId: number) => {
    e.preventDefault();
    if ('dataTransfer' in e) {
      e.dataTransfer.dropEffect = 'move';
    }
    if (draggedTagId !== null && draggedTagId !== tagId) {
      setDragOverTagId(tagId);
    }
  };

  // 드래그 리브
  const handleDragLeave = () => {
    setDragOverTagId(null);
  };

  // 드롭 처리 (마우스)
  const handleDrop = (e: React.DragEvent, targetTagId: number) => {
    e.preventDefault();
    setDragOverTagId(null);
    
    if (draggedTagId === null || draggedTagId === targetTagId) {
      return;
    }

    handleTagReorder(draggedTagId, targetTagId);
    setDraggedTagId(null);
    setIsReordering(false);
  };

  // 태그 순서 변경 공통 함수 (로컬 상태만 변경, 서버 저장은 모달 닫을 때)
  const handleTagReorder = (draggedTagId: number, targetTagId: number) => {
    const draggedIndex = tags.findIndex(t => t.tag_id === draggedTagId);
    const targetIndex = tags.findIndex(t => t.tag_id === targetTagId);
    
    if (draggedIndex === -1 || targetIndex === -1) {
      return;
    }

    // 태그 배열 순서 변경
    const newTags = [...tags];
    const [draggedTag] = newTags.splice(draggedIndex, 1);
    newTags.splice(targetIndex, 0, draggedTag);

    // display_order 업데이트 (로컬 상태만 변경)
    // display_order는 1부터 시작 (0 사용 금지)
    const updatedTags = newTags.map((tag, index) => ({
      ...tag,
      display_order: index + 1
    }));

    setTags(updatedTags);
  };

  if (!isOpen) return null;

  // 권한이 없으면 모달 표시 안 함
  if (!canManageTags) {
    return null;
  }

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        zIndex: 9999
      }}
    >
      <div 
        className="bg-white rounded-3xl p-8 max-w-4xl w-full mx-4 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        style={{
          position: 'relative',
          margin: 'auto',
          maxHeight: '90vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 - sticky로 상단에 고정 */}
        <div className="sticky top-0 bg-white z-10 mb-6 pb-4 border-b border-slate-200">
          {/* 닫기 버튼 - 모달 우측 상단에 고정 */}
          <button
            onClick={handleCloseWithSave}
            className="absolute top-0 right-0 w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors shadow-lg"
            aria-label="닫기 (ESC)"
            title="닫기 (ESC)"
          >
            <X size={20} className="text-white" />
          </button>
          <div className="pr-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">태그 관리</h2>
            <p className="text-slate-600">기관게시판에서 사용할 태그를 관리합니다</p>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
            {error}
          </div>
        )}

        {/* 태그 추가 버튼 */}
        {!showAddForm && (
          <div className="mb-4">
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors font-semibold"
            >
              <Plus size={18} />
              태그 추가
            </button>
          </div>
        )}

        {/* 태그 추가 폼 */}
        {showAddForm && (
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-700 mb-4">새 태그 추가</h3>
            <form onSubmit={handleCreateTag} className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newTagForm.tag_name}
                  onChange={(e) => handleNewTagNameChange(e.target.value)}
                  placeholder="태그 이름"
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  maxLength={50}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newTagForm.tag_color}
                    onChange={(e) => handleNewTagColorChange(e.target.value)}
                    className="w-16 h-12 border border-slate-300 rounded-lg cursor-pointer"
                    title="태그 색상 (클릭하여 수동 선택)"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const existingColors = tags.map(t => t.tag_color);
                      const autoColor = generateColorFromText(newTagForm.tag_name || '태그', existingColors);
                      setNewTagForm(prev => ({ ...prev, tag_color: autoColor, isAutoColor: true }));
                    }}
                    className="px-3 py-2 text-xs bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition-colors font-medium"
                    title="자동 색상 할당"
                  >
                    자동
                  </button>
                </div>
              </div>
              {newTagForm.isAutoColor && newTagForm.tag_name.trim() && (
                <p className="text-xs text-slate-500">색상이 태그 이름에 따라 자동으로 할당됩니다. 색상 선택기를 클릭하여 수동으로 변경할 수 있습니다.</p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors font-semibold"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewTagForm({ tag_name: '', tag_color: '#3b82f6', isAutoColor: true });
                  }}
                  className="px-6 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-semibold"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 태그 목록 */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mb-4"></div>
            <p className="text-slate-500">태그 목록을 불러오는 중...</p>
          </div>
        ) : tags.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-lg">등록된 태그가 없습니다</p>
            <p className="text-sm mt-2">태그를 추가하여 게시글을 분류할 수 있습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {tags.map((tag) => (
              <div 
                key={tag.tag_id}
                data-tag-id={tag.tag_id}
                className={`bg-slate-50 rounded-lg p-4 border border-slate-200 transition-all ${
                  dragOverTagId === tag.tag_id ? 'border-teal-500 border-2 shadow-lg' : ''
                } ${draggedTagId === tag.tag_id ? 'opacity-50' : ''} ${
                  !showAddForm && editingTag !== tag.tag_id ? 'cursor-move' : ''
                }`}
                draggable={!showAddForm && editingTag !== tag.tag_id && typeof window !== 'undefined' && !('ontouchstart' in window)}
                onDragStart={(e) => handleDragStart(e, tag.tag_id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, tag.tag_id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, tag.tag_id)}
              >
                {editingTag === tag.tag_id ? (
                  // 수정 모드
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={editForm.tag_name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, tag_name: e.target.value }))}
                        className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        maxLength={50}
                        autoFocus
                      />
                      <input
                        type="color"
                        value={editForm.tag_color}
                        onChange={(e) => setEditForm(prev => ({ ...prev, tag_color: e.target.value }))}
                        className="w-16 h-12 border border-slate-300 rounded-lg cursor-pointer"
                        title="태그 색상"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateTag(tag.tag_id)}
                        className="px-6 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors font-semibold"
                      >
                        저장
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-6 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-semibold"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  // 표시 모드
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {!showAddForm && (
                        <GripVertical 
                          size={18} 
                          className="text-slate-400 cursor-move flex-shrink-0 touch-none select-none"
                          title="드래그하여 순서 변경"
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            handleGripTouchStart(e, tag.tag_id);
                          }}
                          style={{
                            touchAction: 'none',
                            userSelect: 'none'
                          }}
                        />
                      )}
                      <div
                        className="w-5 h-5 rounded border border-slate-300 flex-shrink-0"
                        style={{ backgroundColor: tag.tag_color }}
                      />
                      <span className="text-base font-medium text-slate-700">{tag.tag_name}</span>
                      {tag.post_count !== undefined && tag.post_count > 0 && (
                        <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                          {tag.post_count}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(tag)}
                        className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                        title="수정"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tag.tag_id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // React Portal을 사용하여 body에 직접 렌더링
  return (
    <>
      {createPortal(modalContent, document.body)}
      
      {/* 삭제 확인 모달 */}
      <AlertModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setTagToDelete(null);
        }}
        title="태그 삭제"
        message="태그를 삭제하시겠습니까? 기존 게시글의 태그는 유지됩니다."
        type="warning"
        confirmText="삭제"
        showCancel={true}
        cancelText="취소"
        onConfirm={handleConfirmDelete}
        isDanger={true}
      />
    </>
  );
};

export default TagManagementModal;
