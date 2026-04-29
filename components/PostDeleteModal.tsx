// 게시글 삭제 확인 모달 컴포넌트
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { deletePost, PostDetail } from '../services/boardApi';
import { useModalBackButton } from '../hooks/useModalBackButton';

interface PostDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: PostDetail;
  onSuccess: () => void;
}

const PostDeleteModal: React.FC<PostDeleteModalProps> = ({
  isOpen,
  onClose,
  post,
  onSuccess
}) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
    }
  }, [isOpen]);

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

  // 모바일 뒤로 가기 버튼으로 모달 닫기
  useModalBackButton({ isOpen, onClose });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!password.trim() || password.length < 4) {
        setError('비밀번호를 입력해주세요. (4자 이상)');
        setLoading(false);
        return;
      }

      await deletePost(post.post_id, password);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || '게시글 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
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
        className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl relative"
        style={{
          position: 'relative',
          margin: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 - 모달 우측 상단 끝 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors z-[10001] shadow-lg"
          aria-label="닫기"
        >
          <X size={20} className="text-white" />
        </button>

        <div className="pr-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center">
              <AlertTriangle size={24} className="text-rose-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">게시글 삭제</h2>
          </div>

          <p className="text-slate-600 mb-6">
            정말로 이 게시글을 삭제하시겠습니까?
            <br />
            <span className="font-semibold text-slate-800">"{post.title}"</span>
            <br />
            삭제된 게시글은 복구할 수 없습니다.
            <br />
            <span className="text-sm text-rose-600 font-semibold mt-2 block">
              작성자 본인이 로그인한 상태에서 비밀번호가 일치해야 삭제할 수 있습니다.
            </span>
          </p>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                비밀번호 확인 <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="게시글 작성 시 입력한 비밀번호"
                minLength={4}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-rose-500 text-white rounded-xl font-semibold hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '삭제 중...' : '삭제하기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default PostDeleteModal;

