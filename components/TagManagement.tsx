// 태그 관리 컴포넌트 (기관게시판용)
import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2 } from 'lucide-react';
import { getTags, createTag, updateTag, deleteTag, Tag } from '../services/boardApi';
import { hasRole, getUserInfo } from '../services/authApi';

interface TagManagementProps {
  onUpdate?: () => void;
}

const TagManagement: React.FC<TagManagementProps> = ({ onUpdate }) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingTag, setEditingTag] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ tag_name: '', tag_color: '#3b82f6' });
  const [newTagForm, setNewTagForm] = useState({ tag_name: '', tag_color: '#3b82f6' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [user, setUser] = useState(getUserInfo());

  // 권한 체크 (manager 이상)
  const canManageTags = user && hasRole(user, 'manager', 'admin', 'super-admin');

  useEffect(() => {
    if (canManageTags) {
      loadTags();
    }
    // 사용자 정보 변경 감지
    const handleStorageChange = () => {
      const userInfo = getUserInfo();
      setUser(userInfo);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [canManageTags]);

  const loadTags = async () => {
    setLoading(true);
    setError('');
    try {
      const tagList = await getTags();
      setTags(tagList);
    } catch (err: any) {
      setError(err.message || '태그 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagForm.tag_name.trim()) {
      setError('태그 이름을 입력해주세요.');
      return;
    }

    setError('');
    try {
      await createTag({
        tag_name: newTagForm.tag_name.trim(),
        tag_color: newTagForm.tag_color
      });
      setNewTagForm({ tag_name: '', tag_color: '#3b82f6' });
      setShowAddForm(false);
      await loadTags();
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
      await loadTags();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.message || '태그 수정에 실패했습니다.');
    }
  };

  const handleDeleteTag = async (tagId: number) => {
    if (!window.confirm('태그를 삭제하시겠습니까? 기존 게시글의 태그는 유지됩니다.')) {
      return;
    }

    setError('');
    try {
      await deleteTag(tagId);
      await loadTags();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.message || '태그 삭제에 실패했습니다.');
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

  if (!canManageTags) {
    return null; // 권한이 없으면 표시하지 않음
  }

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">태그 관리</h3>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-teal-500 text-white rounded hover:bg-teal-600 transition-colors"
          >
            <Plus size={14} />
            추가
          </button>
        )}
      </div>

      {error && (
        <div className="mb-2 p-2 bg-rose-50 border border-rose-200 rounded text-rose-600 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-2 text-xs text-slate-400">로딩 중...</div>
      ) : (
        <div className="space-y-2">
          {/* 태그 추가 폼 */}
          {showAddForm && (
            <form onSubmit={handleCreateTag} className="bg-white p-2 rounded border border-slate-300">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={newTagForm.tag_name}
                  onChange={(e) => setNewTagForm(prev => ({ ...prev, tag_name: e.target.value }))}
                  placeholder="태그 이름"
                  className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                  maxLength={50}
                  autoFocus
                />
                <input
                  type="color"
                  value={newTagForm.tag_color}
                  onChange={(e) => setNewTagForm(prev => ({ ...prev, tag_color: e.target.value }))}
                  className="w-8 h-7 border border-slate-300 rounded cursor-pointer"
                  title="태그 색상"
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="submit"
                  className="flex-1 px-2 py-1 text-xs bg-teal-500 text-white rounded hover:bg-teal-600 transition-colors"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewTagForm({ tag_name: '', tag_color: '#3b82f6' });
                  }}
                  className="px-2 py-1 text-xs bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition-colors"
                >
                  취소
                </button>
              </div>
            </form>
          )}

          {/* 태그 목록 */}
          {tags.length === 0 ? (
            <div className="text-center py-2 text-xs text-slate-400">등록된 태그가 없습니다</div>
          ) : (
            tags.map((tag) => (
              <div key={tag.tag_id} className="bg-white p-2 rounded border border-slate-300">
                {editingTag === tag.tag_id ? (
                  // 수정 모드
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={editForm.tag_name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, tag_name: e.target.value }))}
                        className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                        maxLength={50}
                        autoFocus
                      />
                      <input
                        type="color"
                        value={editForm.tag_color}
                        onChange={(e) => setEditForm(prev => ({ ...prev, tag_color: e.target.value }))}
                        className="w-8 h-7 border border-slate-300 rounded cursor-pointer"
                        title="태그 색상"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleUpdateTag(tag.tag_id)}
                        className="flex-1 px-2 py-1 text-xs bg-teal-500 text-white rounded hover:bg-teal-600 transition-colors"
                      >
                        저장
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-2 py-1 text-xs bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </>
                ) : (
                  // 표시 모드
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: tag.tag_color }}
                      />
                      <span className="text-xs text-slate-700">{tag.tag_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(tag)}
                        className="p-1 text-slate-400 hover:text-teal-600 transition-colors"
                        title="수정"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tag.tag_id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TagManagement;















