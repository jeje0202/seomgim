// 교회소식 삭제 모달 컴포넌트
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { deleteNews, NewsItem } from '../services/newsApi';
import { useModalBackButton } from '../hooks/useModalBackButton';

interface NewsDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  news: NewsItem | null;
  onSuccess: () => void;
}

const NewsDeleteModal: React.FC<NewsDeleteModalProps> = ({
  isOpen,
  onClose,
  news,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
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

  const handleDelete = async () => {
    if (!news) return;

    setError('');
    setLoading(true);

    try {
      await deleteNews(news.news_id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || '교회소식 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!news) return null;

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

        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-100 rounded-full mb-4">
            <AlertTriangle size={32} className="text-rose-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-4">교회소식 삭제</h2>
          
          <p className="text-slate-600 mb-2">
            정말로 이 교회소식을 삭제하시겠습니까?
          </p>
          
          <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-semibold text-slate-800 mb-1">{news.title}</p>
            <p className="text-xs text-slate-500">작성일: {new Date(news.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-rose-500 text-white rounded-xl font-semibold hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '삭제 중...' : '삭제하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // React Portal을 사용하여 body에 직접 렌더링
  if (!isOpen) return null;
  
  return createPortal(modalContent, document.body);
};

export default NewsDeleteModal;

