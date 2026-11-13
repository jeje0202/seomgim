// 카카오톡 스타일 고속 이미지 뷰어 모달 컴포넌트
// [한글 코멘트] 뷰어 로딩 속도 대폭 개선:
// 1) 하단 미니 탐색 바에서 대용량 원본 대신 경량 썸네일(thumbnails) + 지연 로딩(lazy)을 사용하여 메인 사진 대역폭 독점 현상 제거
// 2) 이미 브라우저에 캐시된 썸네일을 0ms 즉시 표시(Progressive Preview)한 뒤 고화질 원본 완료 시 무깜박임 교체
// 3) 현재 사진 기준 인접 사진(다음 2장, 이전 1장)을 백그라운드 프리로드하여 넘김 지연 제거
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Download, FileText } from 'lucide-react';
import { useModalBackButton } from '../hooks/useModalBackButton';
import { resolveMediaUrl, buildMediaDownloadUrl } from '../utils/mediaUrl';
import { preloadAdjacentImages } from '../utils/imagePreloader';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[]; // 고화질 원본 이미지 URL 배열
  thumbnails?: (string | undefined)[]; // [한글 코멘트] 즉시 프리뷰 및 하단 미니 바 전용 경량 썸네일 URL 배열 (선택)
  initialIndex?: number; // 초기 표시할 이미지 인덱스
  title?: string; // 카카오톡 스타일 헤더 제목 (선택)
  unit?: string; // 단위 ('장', '면' 등 선택, 기본값: '장')
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  images,
  thumbnails,
  initialIndex = 0,
  title = '이미지 크게보기',
  unit = '장'
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1); // 확대/축소 배율
  const [position, setPosition] = useState({ x: 0, y: 0 }); // 이미지 위치 (드래그/터치 이동용)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  // [한글 코멘트] 고화질 원본 로드 완료 여부 상태 (캐시된 썸네일 선표시 -> 고화질 전환 제어)
  const [isFullLoaded, setIsFullLoaded] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // [한글 코멘트] 이미 로드 완료된 원본 URL 기억 집합 (재방문 시 0ms 즉시 고화질 표시)
  const loadedFullSetRef = useRef<Set<string>>(new Set());

  // [한글 코멘트] 썸네일 선택 위치 및 스크롤 자동 동기화를 위한 Ref 배열
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // [한글 코멘트] 모바일 핀치 줌 (Pinch-to-Zoom) 및 터치 이동(Pan)을 위한 상태
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);
  const initialPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [lastTap, setLastTap] = useState<number>(0);

  // [한글 코멘트] 모든 원본 및 썸네일 URL을 Cloudflare R2 CDN 직결 URL로 정규화
  const resolvedImages = useMemo(
    () => images.map((u) => resolveMediaUrl(u)),
    [images]
  );
  const resolvedThumbnails = useMemo(
    () => resolvedImages.map((fullUrl, idx) => {
      const thumbCandidate = thumbnails?.[idx];
      return thumbCandidate ? resolveMediaUrl(thumbCandidate) : fullUrl;
    }),
    [resolvedImages, thumbnails]
  );

  // 모바일 뒤로 가기 버튼으로 모달 닫기
  useModalBackButton({ isOpen, onClose });

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, initialIndex]);

  // [한글 코멘트] 사진 전환 시 스케일 초기화, 캐시 로드 여부 즉시 판별 및 인접 사진 백그라운드 프리로드
  useEffect(() => {
    if (!isOpen || resolvedImages.length === 0) return;

    setScale(1);
    setPosition({ x: 0, y: 0 });

    const targetUrl = resolvedImages[currentIndex];
    if (loadedFullSetRef.current.has(targetUrl)) {
      setIsFullLoaded(true);
    } else {
      setIsFullLoaded(false);
    }

    // 다음 2장 및 이전 1장 고화질 이미지 선제 프리로드
    preloadAdjacentImages(resolvedImages, currentIndex);
  }, [currentIndex, isOpen, resolvedImages]);

  // [한글 코멘트] 브라우저 이미지 캐시에 이미 완료 상태로 적재된 경우 즉시 완료 처리
  useEffect(() => {
    if (isOpen && imageRef.current && imageRef.current.complete && imageRef.current.naturalWidth > 0) {
      const targetUrl = resolvedImages[currentIndex];
      if (targetUrl) {
        loadedFullSetRef.current.add(targetUrl);
      }
      setIsFullLoaded(true);
    }
  }, [currentIndex, isOpen, resolvedImages]);

  // [한글 코멘트] 선택된 썸네일 위치로 자동 스크롤 동기화
  useEffect(() => {
    if (isOpen && thumbnailRefs.current[currentIndex]) {
      thumbnailRefs.current[currentIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [currentIndex, isOpen]);

  // [한글 코멘트] 카카오톡 스타일 더블클릭/더블터치 2.5배 확대 토글 함수
  const handleDoubleClick = () => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2.5);
    }
  };

  // [한글 코멘트] 이미지 다운로드 처리 함수 (백엔드 다운로드 엔드포인트 연동으로 R2 CORS 제약 없이 즉시 저장)
  const handleDownload = () => {
    const imgUrl = resolvedImages[currentIndex];
    if (!imgUrl) return;

    const ext = imgUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const safeTitle = (title || '이미지').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
    const filename = `${safeTitle}_${currentIndex + 1}${unit}.${ext}`;

    const downloadHref = buildMediaDownloadUrl(imgUrl, filename);
    const a = document.createElement('a');
    a.href = downloadHref;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 마우스 휠로 확대/축소
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    const newScale = Math.max(0.8, Math.min(5, scale + delta));
    setScale(newScale);
    if (newScale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  // 마우스 드래그 시작
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  // 마우스 드래그 중
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  // 마우스 드래그 종료
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 확대
  const handleZoomIn = () => {
    setScale(prev => Math.min(5, prev + 0.3));
  };

  // 축소
  const handleZoomOut = () => {
    setScale(prev => {
      const newScale = Math.max(0.8, prev - 0.3);
      if (newScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  };

  // 리셋
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // 이전 이미지
  const handlePrev = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : resolvedImages.length - 1));
  };

  // 다음 이미지
  const handleNext = () => {
    setCurrentIndex(prev => (prev < resolvedImages.length - 1 ? prev + 1 : 0));
  };

  // [한글 코멘트] 두 손가락 거리를 계산하는 유틸리티 함수
  const getPinchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  // [한글 코멘트] 모바일 터치 시작 (더블터치 감지 및 핀치 줌 / 이동 준비)
  const handleTouchStart = (e: React.TouchEvent) => {
    const now = Date.now();

    if (e.touches.length === 2) {
      initialPinchDistanceRef.current = getPinchDistance(e.touches);
      initialScaleRef.current = scale;
      return;
    }

    if (e.touches.length === 1) {
      if (now - lastTap < 300) {
        handleDoubleClick();
        setLastTap(0);
        return;
      }
      setLastTap(now);

      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      initialPosRef.current = { ...position };
      if (scale > 1) {
        setIsDragging(true);
      }
    }
  };

  // [한글 코멘트] 모바일 터치 이동 (핀치 줌 및 확대 상태 사진 이동)
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistanceRef.current !== null) {
      const currentDistance = getPinchDistance(e.touches);
      const ratio = currentDistance / initialPinchDistanceRef.current;
      const newScale = Math.max(0.8, Math.min(5.0, initialScaleRef.current * ratio));
      setScale(newScale);
      if (newScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return;
    }

    if (e.touches.length === 1 && scale > 1) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      setPosition({
        x: initialPosRef.current.x + deltaX,
        y: initialPosRef.current.y + deltaY
      });
    }
  };

  // [한글 코멘트] 모바일 터치 종료 (스와이프 또는 터치 이동 마감)
  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false);
    initialPinchDistanceRef.current = null;

    if (scale <= 1 && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) {
          handlePrev();
        } else {
          handleNext();
        }
      }
    }
  };

  // 키보드 이벤트
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, resolvedImages.length]);

  if (!isOpen || resolvedImages.length === 0) return null;

  const currentImage = resolvedImages[currentIndex];
  const currentThumb = resolvedThumbnails[currentIndex];
  const hasDistinctThumb = Boolean(currentThumb && currentThumb !== currentImage);

  return createPortal(
    <div
      className="fixed inset-0 bg-black/95 flex flex-col justify-between z-[10001] select-none"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        margin: 0,
        padding: 0,
        overflow: 'hidden'
      }}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 상단 헤더 바 */}
      <div className="w-full bg-slate-900/90 backdrop-blur-md text-white px-4 py-3 flex items-center justify-between z-[10003] border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-rose-600 hover:bg-rose-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="닫기 (ESC)"
          >
            <X size={20} className="text-white" />
          </button>
          <div className="min-w-0">
            <h3 className="font-bold text-sm sm:text-base text-white truncate flex items-center gap-1.5">
              <FileText size={16} className="text-teal-400 shrink-0" />
              <span>{title}</span>
            </h3>
            <p className="text-xs text-slate-400">
              {currentIndex + 1} / {resolvedImages.length} {unit} (더블클릭/더블터치 시 2.5배 확대)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* 원본 다운로드 버튼 */}
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-md cursor-pointer"
            title="원본 파일 다운로드"
          >
            <Download size={14} />
            <span className="hidden sm:inline">다운로드</span>
          </button>

          {/* 닫기 텍스트 버튼 */}
          <button
            type="button"
            onClick={onClose}
            className="hidden sm:flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full text-xs font-medium transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>

      {/* 중앙 이미지 화면 영역 */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full flex items-center justify-center p-2 sm:p-4 overflow-hidden touch-none"
        style={{ touchAction: 'none' }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        {/* 이전 버튼 */}
        {resolvedImages.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-3 sm:left-6 z-[10002] w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-teal-600 text-white flex items-center justify-center transition-all shadow-xl backdrop-blur-md cursor-pointer border border-white/20"
            aria-label={`이전 ${unit}`}
          >
            <ChevronLeft size={28} />
          </button>
        )}

        {/* [한글 코멘트] 점진적 이미지 렌더링: 캐시된 썸네일을 0ms 즉시 표시하고 고화질 원본 로드 완료 시 매끄럽게 전환 */}
        <div
          onDoubleClick={handleDoubleClick}
          className="relative max-w-full max-h-full flex items-center justify-center touch-none"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0, 0.2, 1)',
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
            touchAction: 'none'
          }}
        >
          {/* 1) 고화질 원본 로드 전 즉시 표시되는 캐시된 썸네일 레이어 */}
          {!isFullLoaded && hasDistinctThumb && (
            <img
              src={currentThumb}
              alt=""
              aria-hidden="true"
              className="max-w-full max-h-[80vh] sm:max-h-[83vh] object-contain rounded-md shadow-2xl pointer-events-none select-none"
              draggable={false}
            />
          )}

          {/* 2) 별도 썸네일이 없고 원본도 아직 도착 전일 때만 표시되는 로딩 스피너 */}
          {!isFullLoaded && !hasDistinctThumb && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 px-8 pointer-events-none">
              <div className="w-10 h-10 border-3 border-teal-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-300 font-medium">사진 불러오는 중...</span>
            </div>
          )}

          {/* 3) 최우선 순위(fetchPriority="high")로 로드되는 1080p 고화질 메인 이미지 */}
          <img
            key={currentImage}
            ref={imageRef}
            src={currentImage}
            alt={`이미지 ${currentIndex + 1}${unit}`}
            decoding="async"
            fetchPriority="high"
            onLoad={() => {
              loadedFullSetRef.current.add(currentImage);
              setIsFullLoaded(true);
            }}
            onError={() => {
              setIsFullLoaded(true);
            }}
            className={`max-w-full max-h-[80vh] sm:max-h-[83vh] object-contain rounded-md shadow-2xl pointer-events-auto transition-opacity duration-150 ${
              isFullLoaded
                ? 'opacity-100 relative'
                : hasDistinctThumb
                  ? 'opacity-0 absolute inset-0 m-auto'
                  : 'opacity-0 w-0 h-0 overflow-hidden'
            }`}
            draggable={false}
          />
        </div>

        {/* 고화질 전환 중 미세 상태 배지 (썸네일 프리뷰가 즉시 떠 있는 상태에서 조용히 안내) */}
        {!isFullLoaded && hasDistinctThumb && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[10002] flex items-center gap-2 bg-slate-900/75 backdrop-blur-md text-slate-200 text-xs px-3 py-1.5 rounded-full border border-slate-700/70 pointer-events-none">
            <span className="w-3 h-3 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
            <span>선명한 원본 불러오는 중...</span>
          </div>
        )}

        {/* 다음 버튼 */}
        {resolvedImages.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-3 sm:right-6 z-[10002] w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-teal-600 text-white flex items-center justify-center transition-all shadow-xl backdrop-blur-md cursor-pointer border border-white/20"
            aria-label={`다음 ${unit}`}
          >
            <ChevronRight size={28} />
          </button>
        )}

        {/* 플로팅 줌 툴바 */}
        <div className="absolute top-4 right-4 z-[10002] flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-full border border-slate-700/60 shadow-lg">
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="축소"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-bold text-teal-300 px-2 min-w-[48px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="확대"
          >
            <ZoomIn size={16} />
          </button>
          {scale !== 1 && (
            <button
              type="button"
              onClick={handleReset}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-400 flex items-center justify-center transition-colors cursor-pointer"
              title="100% 원본 크기 리셋"
            >
              <RotateCw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 하단 썸네일 바 (경량 썸네일 URL + lazy 로딩 적용으로 네트워크 병목 완전 해소) */}
      <div className="w-full bg-slate-900/90 backdrop-blur-md px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 z-[10003] border-b border-t border-slate-800 shrink-0">
        <div className="hidden lg:flex items-center text-xs text-slate-400 font-medium whitespace-nowrap w-48 shrink-0">
          {resolvedImages.length > 1 ? `총 ${resolvedImages.length}${unit}의 사진이 있습니다.` : ''}
        </div>

        <div className="flex-1 flex justify-start sm:justify-center max-w-full overflow-hidden">
          {resolvedImages.length > 1 ? (
            <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1 px-2 scrollbar-thin scroll-smooth">
              {resolvedThumbnails.map((thumbSrc, idx) => (
                <button
                  key={idx}
                  ref={el => (thumbnailRefs.current[idx] = el)}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`relative w-12 h-14 sm:w-14 sm:h-16 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer bg-slate-800 ${
                    currentIndex === idx
                      ? 'border-teal-400 ring-2 ring-teal-400/50 scale-105 opacity-100 shadow-lg'
                      : 'border-slate-700 opacity-50 hover:opacity-100'
                  }`}
                >
                  <img
                    src={thumbSrc}
                    alt={`미니 ${idx + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[10px] text-white font-bold text-center py-0.5">
                    {idx + 1}{unit}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-400 font-medium text-center">
              마우스 휠/더블클릭 또는 손가락으로 자유롭게 확대/축소하실 수 있습니다.
            </div>
          )}
        </div>

        {/* 우측 확대/축소/리셋 컨트롤 바 */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-1.5 rounded-full border border-slate-700 shrink-0 sm:w-48 sm:justify-end">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 rounded-full hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            title="확대 (+)"
            disabled={scale >= 5}
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 rounded-full hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            title="축소 (-)"
            disabled={scale <= 0.5}
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 rounded-full hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            title="원본 크기 리셋 (0)"
          >
            <RotateCw size={16} />
          </button>
          <span className="text-xs font-bold text-teal-400 ml-1 min-w-[42px] text-right">
            {Math.round(scale * 100)}%
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ImageViewerModal;
