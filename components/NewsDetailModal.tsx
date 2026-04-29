// 교회소식 상세 보기 모달 컴포넌트
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Calendar, Eye, Megaphone } from 'lucide-react';
import { getNewsDetail, NewsItem, getTagColor, formatNewsDate } from '../services/newsApi';
import ImageViewerModal from './ImageViewerModal';
import { useModalBackButton } from '../hooks/useModalBackButton';
import { linkifyText } from '../utils/textUtils';

interface NewsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  newsId: number;
  onUpdate?: () => void;
}

const NewsDetailModal: React.FC<NewsDetailModalProps> = ({
  isOpen,
  onClose,
  newsId,
  onUpdate
}) => {
  const [news, setNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [imageViewerImages, setImageViewerImages] = useState<string[]>([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && newsId) {
      loadNews();
    }
  }, [isOpen, newsId]);

  const loadNews = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getNewsDetail(newsId);
      setNews(data);
    } catch (err: any) {
      setError(err.message || '교회소식을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

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
        className="bg-white rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        style={{
          position: 'relative',
          margin: 'auto',
          maxHeight: '90vh'
        }}
      >
        {/* 닫기 버튼 - 모달 우측 상단 고정 (스크롤과 무관하게 항상 표시) */}
        <button
          type="button"
          onClick={onClose}
          className="sticky top-0 float-right -mr-6 -mt-6 mb-4 w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors z-[10001] shadow-lg"
          aria-label="닫기 (ESC)"
          title="닫기 (ESC)"
        >
          <X size={24} className="text-white" />
        </button>

        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mb-4"></div>
            <p className="text-slate-500">교회소식을 불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Megaphone size={32} className="text-rose-500" />
            </div>
            <p className="text-rose-600 text-lg font-semibold mb-2">오류가 발생했습니다</p>
            <p className="text-slate-500">{error}</p>
          </div>
        ) : news ? (
          <>
            {/* 교회소식 헤더 */}
            <div className="mb-6 pb-6 border-b border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${getTagColor(news.tag)}`}>
                  {news.tag}
                </span>
                {news.is_pinned && (
                  <span className="px-2 py-1 bg-rose-500 text-white text-xs font-bold rounded">
                    고정
                  </span>
                )}
              </div>

              <h2 className="text-3xl font-bold text-slate-800 mb-4">{news.title}</h2>

              <div className="flex items-center gap-4 text-sm text-slate-500">
                <div className="flex items-center gap-1">
                  <User size={16} />
                  <span>{news.author_name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar size={16} />
                  <span>{formatNewsDate(news.created_at)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye size={16} />
                  <span>조회 {news.view_count}</span>
                </div>
              </div>
            </div>

            {/* 교회소식 내용 */}
            <div className="mb-8 pb-8 border-b border-slate-200">
              {/* 이미지 표시 (여러 장) */}
              {news.image_url && (() => {
                // 이미지 클릭 핸들러
                const handleImageClick = (index: number, allImages: string[]) => {
                  setImageViewerImages(allImages);
                  setImageViewerIndex(index);
                  setShowImageViewer(true);
                };

                try {
                  // JSON 배열인지 확인
                  const imageUrls = JSON.parse(news.image_url);
                  if (Array.isArray(imageUrls) && imageUrls.length > 0) {
                    return (
                      <div className="mb-6 space-y-4">
                        {imageUrls.map((url: string, index: number) => (
                          <div key={index} className="relative cursor-pointer group" onClick={() => handleImageClick(index, imageUrls)}>
                            <img
                              src={url.startsWith('http') ? url : url}
                              alt={`공지사항 이미지 ${index + 1}`}
                              className="w-full rounded-lg shadow-md transition-transform group-hover:scale-[1.02]"
                              loading="lazy"
                              onError={(e) => {
                                console.error('이미지 로드 실패:', url);
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            {imageUrls.length > 1 && (
                              <div className="absolute top-2 left-2 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-semibold">
                                {index + 1} / {imageUrls.length}
                              </div>
                            )}
                            {/* 클릭 가능 표시 오버레이 */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 rounded-lg transition-colors flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-semibold bg-black/50 px-4 py-2 rounded-lg">
                                클릭하여 확대
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                } catch (e) {
                  // JSON이 아니면 단일 이미지로 처리
                }
                // 단일 이미지 처리 (기존 호환성)
                const singleImageUrl = news.image_url;
                return (
                  <div className="mb-6 cursor-pointer group relative" onClick={() => handleImageClick(0, [singleImageUrl])}>
                    <img
                      src={singleImageUrl.startsWith('http') ? singleImageUrl : singleImageUrl}
                      alt="공지사항 이미지"
                      className="w-full rounded-lg shadow-md transition-transform group-hover:scale-[1.02]"
                      loading="lazy"
                      onError={(e) => {
                        console.error('이미지 로드 실패:', singleImageUrl);
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    {/* 클릭 가능 표시 오버레이 */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 rounded-lg transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-semibold bg-black/50 px-4 py-2 rounded-lg">
                        클릭하여 확대
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* 콘텐츠를 HTML로 렌더링 */}
              <div
                className="post-content max-w-none px-2 py-4 bg-white/50 rounded-lg border border-slate-100 prose prose-slate"
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                dangerouslySetInnerHTML={{ __html: news.content }}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );

  return createPortal(
    <>
      {modalContent}
      {/* 이미지 뷰어 모달 */}
      <ImageViewerModal
        isOpen={showImageViewer}
        onClose={() => setShowImageViewer(false)}
        images={imageViewerImages}
        initialIndex={imageViewerIndex}
      />
    </>,
    document.body
  );
};

export default NewsDetailModal;

