// 이미지 뷰어 모달 컴포넌트
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { useModalBackButton } from '../hooks/useModalBackButton';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[]; // 이미지 URL 배열
  initialIndex?: number; // 초기 표시할 이미지 인덱스
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0
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

  // 마우스 휠로 확대/축소
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
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
    // 모바일 환경에서 첫 번째 이미지일 때는 모달 닫기
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

  // 모바일 터치 시작
  const handleTouchStart = (e: React.TouchEvent) => {
    // 확대 상태가 아닐 때만 스와이프 감지
    if (scale <= 1) {
      const touch = e.touches[0];
      setTouchStart({ x: touch.clientX, y: touch.clientY });
      setTouchEnd(null);
    }
  };

  // 모바일 터치 이동
  const handleTouchMove = (e: React.TouchEvent) => {
    // 확대 상태가 아닐 때만 스와이프 감지
    if (scale <= 1) {
      const touch = e.touches[0];
      setTouchEnd({ x: touch.clientX, y: touch.clientY });
    }
  };

  // 모바일 터치 종료 - 스와이프 감지 및 이미지 변경
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || scale > 1) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const minSwipeDistance = 50; // 최소 스와이프 거리 (50px)

    // 좌우 스와이프만 감지 (상하 스와이프는 무시)
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0) {
        // 왼쪽으로 스와이프 (다음 이미지)
        handleNext();
      } else {
        // 오른쪽으로 스와이프 (이전 이미지)
        // 모바일에서 첫 번째 이미지일 때는 모달 닫기
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
      className="fixed inset-0 bg-black/95 flex items-center justify-center z-[10001]"
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
      onClick={(e) => {
        // 배경 클릭 시 닫기 (이미지 클릭은 제외)
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* 닫기 버튼 - 빨간색 배경으로 시인성 개선 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[10002] w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors shadow-lg"
        aria-label="닫기"
      >
        <X size={24} className="text-white" />
      </button>

      {/* 이미지 컨테이너 */}
      <div
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center p-4"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 이전 버튼 (이미지가 2개 이상일 때) - 모바일에서 숨김 */}
        {images.length > 1 && (
          <button
            onClick={handlePrev}
            className="hidden md:flex absolute left-4 z-[10002] w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center transition-colors backdrop-blur-sm"
            aria-label="이전 이미지"
          >
            <ChevronLeft size={24} className="text-white" />
          </button>
        )}

        {/* 이미지 */}
        <div
          className="relative max-w-full max-h-full overflow-hidden"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
          }}
        >
          <img
            ref={imageRef}
            src={currentImage.startsWith('http') ? currentImage : currentImage}
            alt={`이미지 ${currentIndex + 1}`}
            className="max-w-full max-h-[90vh] object-contain"
            draggable={false}
            onError={(e) => {
              console.error('이미지 로드 실패:', currentImage);
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        {/* 다음 버튼 (이미지가 2개 이상일 때) - 모바일에서 숨김 */}
        {images.length > 1 && (
          <button
            onClick={handleNext}
            className="hidden md:flex absolute right-4 z-[10002] w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center transition-colors backdrop-blur-sm"
            aria-label="다음 이미지"
          >
            <ChevronRight size={24} className="text-white" />
          </button>
        )}
      </div>

      {/* 하단 컨트롤 바 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[10002] flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
        {/* 이미지 카운터 */}
        {images.length > 1 && (
          <span className="text-white text-sm font-medium px-2">
            {currentIndex + 1} / {images.length}
          </span>
        )}

        {/* 확대 버튼 */}
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          aria-label="확대"
          disabled={scale >= 5}
        >
          <ZoomIn size={16} className="text-white" />
        </button>

        {/* 축소 버튼 */}
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          aria-label="축소"
          disabled={scale <= 0.5}
        >
          <ZoomOut size={16} className="text-white" />
        </button>

        {/* 리셋 버튼 */}
        <button
          onClick={handleReset}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          aria-label="리셋"
          disabled={scale === 1 && position.x === 0 && position.y === 0}
        >
          <RotateCw size={16} className="text-white" />
        </button>

        {/* 확대 배율 표시 */}
        <span className="text-white text-sm font-medium px-2">
          {Math.round(scale * 100)}%
        </span>
      </div>

      {/* 키보드 단축키 안내 (처음 3초만 표시) */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[10002] bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-xs opacity-70">
        <div className="flex items-center gap-4">
          <span>← → : 이전/다음</span>
          <span>+ - : 확대/축소</span>
          <span>0 : 리셋</span>
          <span>ESC : 닫기</span>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ImageViewerModal;

