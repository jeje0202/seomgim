// 카카오톡 스타일 이미지 뷰어 모달 컴포넌트
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Download, FileText } from 'lucide-react';
import { useModalBackButton } from '../hooks/useModalBackButton';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[]; // 이미지 URL 배열
  initialIndex?: number; // 초기 표시할 이미지 인덱스
  title?: string; // 카카오톡 스타일 헤더 제목 (선택)
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  title = '주보 및 이미지 크게보기'
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1); // 확대/축소 배율
  const [position, setPosition] = useState({ x: 0, y: 0 }); // 이미지 위치 (드래그용)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 모바일 터치 스와이프를 위한 상태
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [lastTap, setLastTap] = useState<number>(0);
  
  // 모바일 환경 감지 (768px 미만)
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  // 이미지 변경 시 스케일과 위치 초기화
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // [한글 코멘트] 카카오톡 스타일 더블클릭/더블터치 2.5배 확대 토글 함수
  const handleDoubleClick = () => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2.5);
    }
  };

  // [한글 코멘트] 이미지 다운로드 처리 함수
  const handleDownload = async () => {
    if (!images[currentIndex]) return;
    const imgUrl = images[currentIndex];
    try {
      const response = await fetch(imgUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const ext = imgUrl.split('.').pop()?.split('?')[0] || 'jpg';
      a.download = `주보_이미지_${currentIndex + 1}면.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(imgUrl, '_blank');
    }
  };

  // 마우스 휠로 확대/축소
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    const newScale = Math.max(0.5, Math.min(5, scale + delta));
    setScale(newScale);
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
    setScale(prev => Math.min(5, prev + 0.25));
  };

  // 축소
  const handleZoomOut = () => {
    setScale(prev => {
      const newScale = Math.max(0.5, prev - 0.25);
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
    if (isMobile && currentIndex === 0) {
      onClose();
      return;
    }
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
  };

  // 다음 이미지
  const handleNext = () => {
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  };

  // 모바일 터치 시작 (더블터치 감지 포함)
  const handleTouchStart = (e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTap < 300) {
      handleDoubleClick();
      setLastTap(0);
      return;
    }
    setLastTap(now);

    if (scale <= 1) {
      const touch = e.touches[0];
      setTouchStart({ x: touch.clientX, y: touch.clientY });
      setTouchEnd(null);
    }
  };

  // 모바일 터치 이동
  const handleTouchMove = (e: React.TouchEvent) => {
    if (scale <= 1) {
      const touch = e.touches[0];
      setTouchEnd({ x: touch.clientX, y: touch.clientY });
    }
  };

  // 모바일 터치 종료 - 스와이프 감지
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || scale > 1) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const minSwipeDistance = 50;

    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0) {
        handleNext();
      } else {
        if (isMobile && currentIndex === 0) {
          onClose();
        } else {
          handlePrev();
        }
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
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
  }, [isOpen, images.length]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];

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
      {/* [한글 코멘트] 카카오톡 스타일 상단 헤더 바 (제목, 페이지 카운터, 다운로드, 닫기 버튼) */}
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
              {currentIndex + 1} / {images.length} 면 (더블클릭/더블터치 시 2.5배 확대)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* 카카오톡 스타일 원본 다운로드 버튼 */}
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
        className="relative flex-1 w-full flex items-center justify-center p-2 sm:p-4 overflow-hidden"
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
        {images.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-3 sm:left-6 z-[10002] w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-teal-600 text-white flex items-center justify-center transition-all shadow-xl backdrop-blur-md cursor-pointer border border-white/20"
            aria-label="이전 면"
          >
            <ChevronLeft size={28} />
          </button>
        )}

        {/* 이미지 (더블클릭/더블터치 시 확대) */}
        <div
          onDoubleClick={handleDoubleClick}
          className="relative max-w-full max-h-full flex items-center justify-center"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0, 0.2, 1)',
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
          }}
        >
          <img
            ref={imageRef}
            src={currentImage}
            alt={`주보 ${currentIndex + 1}면`}
            className="max-w-full max-h-[80vh] sm:max-h-[83vh] object-contain rounded-md shadow-2xl"
            draggable={false}
          />
        </div>

        {/* 다음 버튼 */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-3 sm:right-6 z-[10002] w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-teal-600 text-white flex items-center justify-center transition-all shadow-xl backdrop-blur-md cursor-pointer border border-white/20"
            aria-label="다음 면"
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>

      {/* [한글 코멘트] 하단 카카오톡 스타일 주보 페이지 썸네일 바 & 조율 컨트롤 */}
      <div className="w-full bg-slate-900/90 backdrop-blur-md px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 z-[10003] border-t border-slate-800 shrink-0">
        {/* 주보 면 썸네일 바 (다중 이미지인 경우) */}
        {images.length > 1 ? (
          <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1 scrollbar-thin">
            {images.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`relative w-12 h-14 sm:w-14 sm:h-16 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                  currentIndex === idx
                    ? 'border-teal-400 ring-2 ring-teal-400/50 scale-105 opacity-100'
                    : 'border-slate-700 opacity-50 hover:opacity-100'
                }`}
              >
                <img src={img} alt={`미니 ${idx + 1}`} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[10px] text-white font-bold text-center py-0.5">
                  {idx + 1}면
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-400 font-medium">
            마우스 휠/더블클릭 또는 손가락으로 자유롭게 확대/축소하실 수 있습니다.
          </div>
        )}

        {/* 우측 확대/축소/리셋 컨트롤 바 */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-1.5 rounded-full border border-slate-700 shrink-0">
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

