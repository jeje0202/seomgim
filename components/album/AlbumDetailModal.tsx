// 사진첩 앨범 상세 전체화면 뷰어 모달 컴포넌트 (고속 오픈 스켈레톤 및 원본 사진 선제 프리로딩 지원)
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Calendar, Eye, User, X } from 'lucide-react';
import { AlbumDetail } from '../../services/albumApi';
import { useModalBackButton } from '../../hooks/useModalBackButton';
import ShareButton from '../ShareButton';
import { buildShareUrl } from '../../utils/deepLink';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { preloadImage } from '../../utils/imagePreloader';

// [한글 코멘트] 앨범 상세 모달 Props 정의 (사진 목록 비동기 로딩 상태 포함)
export interface AlbumDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: AlbumDetail;
  isLoadingPhotos?: boolean;
  onImageClick: (index: number, photos: Array<{ photo_url: string; thumbnail_url?: string }>) => void;
}

const AlbumDetailModal: React.FC<AlbumDetailModalProps> = ({
  isOpen,
  onClose,
  album,
  isLoadingPhotos = false,
  onImageClick
}) => {
  // [한글 코멘트] 모바일 뒤로 가기 버튼으로 모달 닫기 지원
  useModalBackButton({ isOpen, onClose });

  // [한글 코멘트] 모달 열릴 때 body 스크롤 방지 및 ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // [한글 코멘트] 앨범 상세 진입 직후 첫 번째·두 번째 원본 사진을 백그라운드에서 선제 프리로드
  useEffect(() => {
    if (!isOpen || !album.photos || album.photos.length === 0) return;
    album.photos.slice(0, 2).forEach((photo) => {
      if (photo.photo_url) {
        preloadImage(photo.photo_url);
      }
    });
  }, [isOpen, album.album_id, album.photos]);

  if (!isOpen) return null;

  // [한글 코멘트] 한국 시간대(Asia/Seoul) 기준 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Seoul'
    });
  };

  const displayPhotoCount = album.photos.length > 0 ? album.photos.length : (album.photo_count || 0);
  const skeletonCount = Math.min(Math.max(album.photo_count || 8, 4), 18);

  return createPortal(
    <div
      className="fixed inset-0 bg-white z-[9999] flex flex-col w-full h-full overflow-hidden"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh'
      }}
    >
      {/* 닫기 버튼 - 우측 상단 고정 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 md:top-6 md:right-8 w-10 h-10 md:w-12 md:h-12 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-all z-20 shadow-lg text-white cursor-pointer hover:scale-105 active:scale-95"
        aria-label="닫기"
        title="닫기 (ESC)"
      >
        <X size={22} className="text-white" />
      </button>

      {/* 헤더 영역 - 고정 (전체 화면 너비 활용) */}
      <div className="flex-shrink-0 px-4 sm:px-8 md:px-12 pt-6 md:pt-8 pb-4 border-b border-slate-200 relative bg-white pr-16 md:pr-24 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2 sm:mb-3">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 truncate">{album.title}</h2>
          {/* [한글 코멘트] 사진첩 상세 모달 공유하기 버튼 배치 */}
          <ShareButton
            title={album.title}
            description={album.description || `총 ${displayPhotoCount}장의 은혜로운 사진이 담긴 앨범입니다.`}
            shareUrl={buildShareUrl({ section: 'album', album: album.album_id })}
            categoryLabel="은혜의 순간들 사진첩"
            variant="compact"
          />
        </div>
        {album.description && (
          <p className="text-xs sm:text-sm md:text-base text-slate-600 mb-3 whitespace-pre-wrap">{album.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-500">
          <div className="flex items-center gap-1.5">
            <User size={15} className="text-slate-400" />
            <span>{album.author_name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={15} className="text-slate-400" />
            <span>{formatDate(album.created_at)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Eye size={15} className="text-slate-400" />
            <span>조회 {album.view_count}</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-500 font-medium bg-rose-50 px-2.5 py-0.5 rounded-full text-xs">
            <Camera size={13} />
            <span>총 {displayPhotoCount}장의 사진</span>
          </div>
        </div>
      </div>

      {/* 스크롤 가능한 본문 영역 (사진 그리드 - 화면 가득 채움) */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-12 py-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          {isLoadingPhotos && album.photos.length === 0 ? (
            /* [한글 코멘트] 모달 즉시 오픈 시 사진 목록 응답 대기 중 스켈레톤 그리드 표시 */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
              {Array.from({ length: skeletonCount }).map((_, idx) => (
                <div
                  key={idx}
                  className="aspect-square bg-slate-200/80 rounded-xl animate-pulse relative overflow-hidden"
                >
                  <div className="absolute top-2 left-2 bg-slate-300 text-transparent text-[11px] px-2 py-0.5 rounded">
                    {idx + 1}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* 사진 그리드 - 경량 썸네일 즉시 표시 및 마우스 호버/터치 시 고화질 원본 선제 프리로드 */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
              {album.photos.map((photo, index) => {
                const gridSrc = resolveMediaUrl(photo.thumbnail_url || photo.photo_url);
                const fullSrc = resolveMediaUrl(photo.photo_url || photo.thumbnail_url);

                return (
                  <div
                    key={photo.photo_id}
                    className="relative aspect-square bg-slate-200 rounded-xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
                    onMouseEnter={() => preloadImage(fullSrc)}
                    onTouchStart={() => preloadImage(fullSrc)}
                    onClick={() => onImageClick(index, album.photos)}
                  >
                    <img
                      src={gridSrc}
                      alt={photo.description || `사진 ${index + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading={index < 12 ? 'eager' : 'lazy'}
                      decoding="async"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/church_rainbow.jpg';
                      }}
                    />
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[11px] px-2 py-0.5 rounded font-medium shadow">
                      {index + 1}
                    </div>
                    {photo.description && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-xs p-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {photo.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AlbumDetailModal;
