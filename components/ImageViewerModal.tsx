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
  unit?: string; // 단위 ('장', '면' 등 선택, 기본값: '장')
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  title = '이미지 크게보기',
  unit = '장'
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1); // 확대/축소 배율
  const [position, setPosition] = useState({ x: 0, y: 0 }); // 이미지 위치 (드래그/터치 이동용)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // [한글 코멘트] 사용자 요청: 썸네일 선택 위치 및 스크롤 자동 동기화를 위한 Ref 배열
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // [한글 코멘트] 사용자 요청: 모바일 핀치 줌 (Pinch-to-Zoom) 및 터치 이동(Pan)을 위한 상태
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);
  const initialPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
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

  // [한글 코멘트] 사용자 요청: 선택된 썸네일 위치로 자동 스크롤 동기화
  useEffect(() => {
    if (isOpen && thumbnailRefs.current[currentIndex]) {
      thumbnailRefs.current[currentIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [currentIndex, isOpen]);

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
      a.download = `이미지_${currentIndex + 1}${unit}.${ext}`;
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
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
  };

  // 다음 이미지
  const handleNext = () => {
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  };

  // [한글 코멘트] 두 손가락 거리를 계산하는 유틸리티 함수
  const getPinchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  // [한글 코멘트] 사용자 요청: 모바일 터치 시작 (더블터치 감지 및 핀치 줌 / 이동 준비)
  const handleTouchStart = (e: React.TouchEvent) => {
    const now = Date.now();

    // 1. 두 손가락 핀치 줌 준비
    if (e.touches.length === 2) {
      initialPinchDistanceRef.current = getPinchDistance(e.touches);
      initialScaleRef.current = scale;
      return;
    }

    // 2. 한 손가락 더블 탭 감지
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

  // [한글 코멘트] 사용자 요청: 모바일 터치 이동 (핀치 줌 및 확대 상태 사진 이리저리 이동)
  const handleTouchMove = (e: React.TouchEvent) => {
    // 1. 두 손가락 핀치 줌 처리
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

    // 2. 한 손가락 확대된 사진 이리저리 이동 (Pan)
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

  // [한글 코멘트] 사용자 요청: 모바일 터치 종료 (스와이프 또는 터치 이동 마감)
  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false);
    initialPinchDistanceRef.current = null;

    // 축소 상태(scale === 1)에서 좌/우 훔쳐보기(스와이프) 이전/다음 사진 전환
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
              {currentIndex + 1} / {images.length} {unit} (더블클릭/더블터치 시 2.5배 확대)
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

      {/* [한글 코멘트] 사용자 요청: 중앙 이미지 화면 영역 (touch-action: none으로 모바일 핀치 줌 & 터치 이동 간섭 방지) */}
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
        {images.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-3 sm:left-6 z-[10002] w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-teal-600 text-white flex items-center justify-center transition-all shadow-xl backdrop-blur-md cursor-pointer border border-white/20"
            aria-label={`이전 ${unit}`}
          >
            <ChevronLeft size={28} />
          </button>
        )}

        {/* 이미지 (더블클릭/더블터치 및 핀치 줌/터치 이리저리 이동) */}
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
          <img
            ref={imageRef}
            src={currentImage}
            alt={`이미지 ${currentIndex + 1}${unit}`}
            className="max-w-full max-h-[80vh] sm:max-h-[83vh] object-contain rounded-md shadow-2xl pointer-events-auto"
            draggable={false}
          />
        </div>

        {/* 다음 버튼 */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-3 sm:right-6 z-[10002] w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-teal-600 text-white flex items-center justify-center transition-all shadow-xl backdrop-blur-md cursor-pointer border border-white/20"
            aria-label={`다음 ${unit}`}
          >
            <ChevronRight size={28} />
          </button>
        )}

        {/* [한글 코멘트] 사용자 요청: 모바일/데스크톱 줌 인/아웃 및 현재 확대 비율 표시 플로팅 툴바 */}
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

      {/* [한글 코멘트] 하단 썸네일 바 (첫 장부터 잘림 없이 전체 스크롤 및 선택 위치 자동 동기화) & 우측 컨트롤 */}
      <div className="w-full bg-slate-900/90 backdrop-blur-md px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 z-[10003] border-t border-slate-800 shrink-0">
        {/* 좌측 안내 텍스트 (세로 구김 방지 whitespace-nowrap 적용) */}
        <div className="hidden lg:flex items-center text-xs text-slate-400 font-medium whitespace-nowrap w-48 shrink-0">
          {images.length > 1 ? `총 ${images.length}${unit}의 사진이 있습니다.` : ''}
        </div>

        {/* [한글 코멘트] 썸네일 탐색 목록 (아이템이 많아도 1번부터 N번까지 잘림 없이 스크롤 가능) */}
        <div className="flex-1 flex justify-start sm:justify-center max-w-full overflow-hidden">
          {images.length > 1 ? (
            <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1 px-2 scrollbar-thin scroll-smooth">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  ref={el => (thumbnailRefs.current[idx] = el)}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`relative w-12 h-14 sm:w-14 sm:h-16 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                    currentIndex === idx
                      ? 'border-teal-400 ring-2 ring-teal-400/50 scale-105 opacity-100 shadow-lg'
                      : 'border-slate-700 opacity-50 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`미니 ${idx + 1}`} className="w-full h-full object-cover" />
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

