// 교회소식 수정 모달 컴포넌트
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCw, Camera } from 'lucide-react';
import { updateNews, NewsItem, getNewsDetail } from '../services/newsApi';
import { uploadImage } from '../services/boardApi';
import AlertModal from './AlertModal';
import { useModalBackButton } from '../hooks/useModalBackButton';
import HtmlToolbar from './HtmlToolbar';

interface NewsEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  news: NewsItem | null;
  onSuccess: () => void;
}

const NewsEditModal: React.FC<NewsEditModalProps> = ({
  isOpen,
  onClose,
  news,
  onSuccess
}) => {
  // 여러 이미지 관리 (순서 유지)
  interface ImageItem {
    id: string;
    url: string; // 기존 이미지 URL 또는 새로 업로드된 URL
    file?: File; // 새로 추가할 파일
    originalFile?: File; // 회전용 원본 파일
    preview: string; // 미리보기 URL
    isNew: boolean; // 새로 추가된 이미지인지 여부
    description: string; // 이미지 설명
  }

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    summary: '',
    tag: '소식',
    is_pinned: false,
    pin_order: 0
  });
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [originalData, setOriginalData] = useState<NewsItem | null>(null); // 원본 데이터 저장
  const [showCloseConfirm, setShowCloseConfirm] = useState(false); // 닫기 확인 모달
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [rotatingIndex, setRotatingIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // contentEditable을 위한 ref
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const summaryEditableRef = useRef<HTMLDivElement>(null);

  // 수정 중인지 확인하는 함수
  const hasChanges = () => {
    if (!originalData) return false;
    return (
      formData.title !== originalData.title ||
      formData.content !== originalData.content ||
      formData.summary !== (originalData.summary || '') ||
      formData.tag !== originalData.tag ||
      formData.is_pinned !== (originalData.is_pinned || false) ||
      formData.pin_order !== (originalData.pin_order || 0) ||
      imageItems.some(item => item.isNew || item.file) || // 새로 추가된 이미지가 있는지
      imageItems.length !== (originalData.image_url ? (() => {
        try {
          const urls = JSON.parse(originalData.image_url);
          return Array.isArray(urls) ? urls.length : 1;
        } catch {
          return originalData.image_url ? 1 : 0;
        }
      })() : 0) // 이미지 개수가 변경되었는지
    );
  };

  // 닫기 확인 함수
  const handleClose = () => {
    if (hasChanges()) {
      // 수정사항이 있으면 확인 모달 표시
      setShowCloseConfirm(true);
    } else {
      // 수정사항이 없으면 바로 닫기
      onClose();
    }
  };

  // 닫기 확인 모달에서 확인 클릭
  const handleConfirmClose = () => {
    setShowCloseConfirm(false);
    onClose();
  };

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, formData, imageItems, news]);

  // 이미지 초기화 (교회소식의 이미지 URL 파싱)
  useEffect(() => {
    if (isOpen && news && originalData) {
      const images: ImageItem[] = [];
      if (originalData.image_url) {
        try {
          const imageUrls = JSON.parse(originalData.image_url);
          if (Array.isArray(imageUrls) && imageUrls.length > 0) {
            imageUrls.forEach((url: string, index: number) => {
              images.push({
                id: `existing-${index}`,
                url: url,
                preview: url,
                isNew: false,
                description: ''
              });
            });
          }
        } catch (e) {
          // JSON이 아니면 단일 이미지로 처리
          images.push({
            id: 'existing-0',
            url: originalData.image_url,
            preview: originalData.image_url,
            isNew: false,
            description: ''
          });
        }
      }
      setImageItems(images);
    }
  }, [isOpen, news, originalData]);

  // 모달이 열릴 때 교회소식 상세 정보 로드
  useEffect(() => {
    const loadNewsDetail = async () => {
      if (!isOpen) return;

      // news가 없거나 news_id가 없으면 에러 표시
      if (!news || !news.news_id) {
        console.warn('NewsEditModal - isOpen is true but news is null or news_id is missing');
        setError('교회소식 정보가 없습니다. 모달을 닫고 다시 시도해주세요.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        console.log('NewsEditModal - Loading news detail for ID:', news.news_id);
        // 상세 조회 API를 통해 전체 데이터 가져오기 (content 포함)
        const newsDetail = await getNewsDetail(news.news_id);
        console.log('NewsEditModal - Loaded news detail:', newsDetail);

        const loadedData = {
          title: newsDetail.title || '',
          content: newsDetail.content || '',
          summary: newsDetail.summary || '',
          tag: newsDetail.tag || '소식',
          is_pinned: newsDetail.is_pinned || false,
          pin_order: newsDetail.pin_order || 0
        };

        setFormData(loadedData);
        // 원본 데이터 저장 (비교용)
        setOriginalData(newsDetail);
        console.log('NewsEditModal - Form data set successfully');
        // contentEditable 초기화
        setTimeout(() => {
          if (contentEditableRef.current) {
            contentEditableRef.current.innerHTML = newsDetail.content || '';
          }
          if (summaryEditableRef.current) {
            summaryEditableRef.current.innerHTML = newsDetail.summary || '';
          }
        }, 0);
      } catch (err: any) {
        console.error('NewsEditModal - Failed to load news detail:', err);
        setError(err.message || '교회소식 정보를 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadNewsDetail();
  }, [isOpen, news]);

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

  // 파일 처리 공통 함수 (useCallback으로 감싸서 useEffect에서 안전하게 사용)
  const processFiles = useCallback(async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    // 파일 검증
    for (const file of fileArray) {
      // 파일 크기 체크 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('이미지 파일 크기는 10MB 이하여야 합니다.');
        return;
      }

      // 파일 타입 체크
      if (!file.type.match(/^image\/(jpeg|jpg|png|gif|webp)$/)) {
        setError('이미지 파일만 업로드 가능합니다. (jpg, png, gif, webp)');
        return;
      }
    }

    setError('');

    // 미리보기 생성
    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageItem: ImageItem = {
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          url: '',
          file: file,
          originalFile: file, // 회전용 원본 파일 저장
          preview: reader.result as string,
          isNew: true,
          description: ''
        };
        setImageItems(prev => [...prev, imageItem]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // 클립보드 붙여넣기 이벤트 핸들러
  useEffect(() => {
    if (!isOpen || !news) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // 이미지 타입인지 확인
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            // Blob을 File로 변환
            const file = new File([blob], `clipboard-image-${Date.now()}.png`, {
              type: blob.type || 'image/png',
              lastModified: Date.now()
            });
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        await processFiles(imageFiles);
      }
    };

    // 모달이 열려있을 때만 클립보드 이벤트 리스너 추가
    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isOpen, news, processFiles]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  // contentEditable 내용을 formData.content에 동기화
  const updateContentFromEditable = useCallback(() => {
    if (contentEditableRef.current) {
      const htmlContent = contentEditableRef.current.innerHTML;
      setFormData(prev => ({ ...prev, content: htmlContent }));
    }
  }, []);

  // 요약 contentEditable 내용을 formData.summary에 동기화
  const updateSummaryFromEditable = useCallback(() => {
    if (summaryEditableRef.current) {
      const htmlContent = summaryEditableRef.current.innerHTML;
      setFormData(prev => ({ ...prev, summary: htmlContent }));
    }
  }, []);

  // 이미지 추가 핸들러
  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFiles(files);
    // input 초기화 (같은 파일을 다시 선택할 수 있도록)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 개별 이미지 삭제 핸들러
  const handleImageRemove = (index: number) => {
    setImageItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleImageDescriptionChange = (index: number, description: string) => {
    setImageItems(prev => prev.map((img, i) =>
      i === index ? { ...img, description } : img
    ));
  };

  // 이미지 회전 핸들러
  const handleRotateImage = async (index: number) => {
    const imageItem = imageItems[index];
    if (!imageItem.originalFile && !imageItem.file) {
      setError('이미지 회전을 위해 원본 파일이 필요합니다.');
      return;
    }

    const fileToRotate = imageItem.originalFile || imageItem.file;
    if (!fileToRotate) {
      setError('이미지 회전을 위해 원본 파일이 필요합니다.');
      return;
    }

    setRotatingIndex(index);
    setError('');

    try {
      const { rotateImage90 } = await import('../utils/imageRotation');
      const rotatedFile = await rotateImage90(fileToRotate);

      // 회전된 파일로 미리보기 업데이트
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageItems(prev => prev.map((img, i) =>
          i === index
            ? {
              ...img,
              file: rotatedFile,
              originalFile: rotatedFile, // 회전된 파일을 새로운 원본으로 저장
              preview: reader.result as string
            }
            : img
        ));
        setRotatingIndex(null);
      };
      reader.readAsDataURL(rotatedFile);
    } catch (err: any) {
      setError(err.message || '이미지 회전에 실패했습니다.');
      setRotatingIndex(null);
    }
  };

  // 드래그 앤 드롭으로 이미지 순서 변경 핸들러
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...imageItems];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);

    setImageItems(newImages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // 파일 드래그 앤 드롭 핸들러 (파일 업로드 영역용)
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!news) return;

    setError('');
    setLoading(true);

    try {
      // 입력 검증
      if (!formData.title.trim()) {
        setError('제목을 입력해주세요.');
        setLoading(false);
        return;
      }
      // 내용 동기화
      updateContentFromEditable();
      updateSummaryFromEditable();

      // HTML에서 텍스트만 추출하여 검증
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = formData.content;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';

      if (!textContent.trim()) {
        setError('내용을 입력해주세요.');
        setLoading(false);
        return;
      }
      if (!formData.tag.trim()) {
        setError('태그를 선택해주세요.');
        setLoading(false);
        return;
      }

      // 새로 추가된 이미지 업로드
      let imageUrls: string[] = [];

      // 기존 이미지 URL 수집
      for (const imageItem of imageItems) {
        if (imageItem.isNew && imageItem.file) {
          // 새로 추가된 이미지 업로드
          setUploadingImage(true);
          try {
            const imageUrl = await uploadImage(imageItem.file, 'news');
            imageUrls.push(imageUrl);
          } catch (err: any) {
            setError(err.message || '이미지 업로드에 실패했습니다.');
            setLoading(false);
            setUploadingImage(false);
            return;
          }
        } else if (!imageItem.isNew && imageItem.url) {
          // 기존 이미지 URL 유지
          imageUrls.push(imageItem.url);
        }
      }
      setUploadingImage(false);

      await updateNews(news.news_id, {
        title: formData.title,
        content: formData.content,
        summary: formData.summary || formData.content.substring(0, 500),
        tag: formData.tag,
        is_pinned: formData.is_pinned,
        pin_order: formData.is_pinned ? formData.pin_order : 0,
        image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : undefined
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || '교회소식 수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // news가 없어도 모달은 표시 (로딩 중이거나 에러 상태 표시)
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
      {/* 닫기 버튼 - 모달 외부 우측 상단 고정 */}
      <button
        type="button"
        onClick={handleClose}
        className="fixed top-[5vh] right-[max(calc((100vw-40rem)/2+1rem),2rem)] w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors z-[10001] shadow-lg"
        aria-label="닫기 (ESC)"
        title="닫기 (ESC)"
      >
        <X size={24} className="text-white" />
      </button>

      <div
        className="bg-white rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        style={{
          position: 'relative',
          margin: 'auto',
          maxHeight: '90vh'
        }}
      >
        <h2 className="text-2xl font-bold text-slate-800 mb-6">교회소식 수정</h2>

        {loading && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-600 text-sm text-center">
            교회소식 정보를 불러오는 중...
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
            {error}
          </div>
        )}

        {(!news || !news.news_id) && !loading && (
          <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
            교회소식 정보가 없습니다. 모달을 닫고 다시 시도해주세요.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" style={{ display: (loading || !news || !news.news_id) ? 'none' : 'block' }}>
          {/* 제목 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              제목 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="교회소식 제목"
              maxLength={200}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          {/* 태그 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              태그 <span className="text-rose-500">*</span>
            </label>
            <select
              name="tag"
              value={formData.tag}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            >
              <option value="공지">공지</option>
              <option value="행사">행사</option>
              <option value="모집">모집</option>
              <option value="소식">소식</option>
              <option value="안내">안내</option>
            </select>
          </div>

          {/* 요약 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              요약 (선택사항)
            </label>
            <HtmlToolbar targetRef={summaryEditableRef} onContentChange={updateSummaryFromEditable} />
            <div
              ref={summaryEditableRef}
              contentEditable
              onBlur={updateSummaryFromEditable}
              onInput={updateSummaryFromEditable}
              className="w-full min-h-[80px] px-4 py-2.5 border border-slate-300 rounded-b-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
              data-placeholder="요약 내용 (HTML 형식 작성 가능)"
            />
            <p className="mt-1 text-xs text-slate-400">요약을 입력하지 않으면 내용의 앞부분이 자동으로 요약됩니다.</p>
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              내용 <span className="text-rose-500">*</span>
            </label>
            <HtmlToolbar targetRef={contentEditableRef} onContentChange={updateContentFromEditable} />
            <div
              ref={contentEditableRef}
              contentEditable
              onBlur={updateContentFromEditable}
              onInput={updateContentFromEditable}
              className="w-full min-h-[250px] px-4 py-2.5 border border-slate-300 rounded-b-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
              data-placeholder="교회소식 내용을 입력하세요 (HTML 형식 작성 가능, 이미지는 Ctrl+V로 붙여넣을 수 있습니다)"
            />
            <style>{`
              [contenteditable][data-placeholder]:empty:before {
                content: attr(data-placeholder);
                color: #94a3b8;
                pointer-events: none;
              }
            `}</style>
          </div>

          {/* 이미지 업로드 (여러 장) */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              이미지 첨부
              {imageItems.length > 0 && (
                <span className="ml-2 text-xs text-slate-500">({imageItems.length}장 선택됨)</span>
              )}
            </label>

            {/* 이미지 미리보기 - 드래그 가능 (모달 가로의 30% 크기) */}
            {imageItems.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-4">
                {imageItems.map((imageItem, index) => (
                  <div
                    key={imageItem.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className="relative group cursor-move"
                    style={{ width: 'calc(30% - 8px)', minWidth: '120px' }}
                  >
                    <img
                      src={imageItem.preview}
                      alt={`이미지 ${index + 1}`}
                      className="w-full aspect-square object-cover rounded-lg border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => handleImageRemove(index)}
                      className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title="이미지 제거"
                    >
                      <X size={14} />
                    </button>
                    {/* 회전 버튼 (새로 추가된 이미지만) */}
                    {imageItem.isNew && (
                      <button
                        type="button"
                        onClick={() => handleRotateImage(index)}
                        disabled={rotatingIndex === index}
                        className="absolute top-1 left-1 p-1.5 bg-blue-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        title="90도 회전"
                      >
                        {rotatingIndex === index ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <RotateCw size={14} />
                        )}
                      </button>
                    )}
                    {/* 이미지 설명 입력 */}
                    <input
                      type="text"
                      placeholder="이미지 설명 (선택사항)"
                      value={imageItem.description}
                      onChange={(e) => handleImageDescriptionChange(index, e.target.value)}
                      className="mt-1 w-full px-2 py-1 text-xs border border-slate-300 rounded"
                    />
                    {/* 순서 번호 */}
                    <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 이미지 추가 버튼 (드래그 앤 드롭 지원) */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${isDragging
                ? 'border-rose-500 bg-rose-50 scale-105'
                : 'border-slate-300 hover:border-teal-500'
                }`}
              onDragEnter={handleDragEnter}
              onDragOver={handleFileDragOver}
              onDragLeave={handleFileDragLeave}
              onDrop={handleFileDrop}
            >
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleImageAdd}
                className="hidden"
                id="image-upload"
                multiple
                ref={fileInputRef}
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                  <Camera className="w-6 h-6 text-teal-600" />
                </div>
                <span className="text-sm text-slate-600">이미지를 선택하거나 드래그하여 업로드하세요</span>
                <span className="text-xs text-slate-400">여러 장 선택 가능, 최대 10MB (jpg, png, gif, webp)</span>
              </label>
            </div>

            {uploadingImage && (
              <div className="mt-2 text-sm text-teal-600">이미지 업로드 중... ({imageItems.filter(item => item.isNew && item.file).length}장)</div>
            )}
          </div>

          {/* 상단 고정 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_pinned"
                id="is_pinned_edit"
                checked={formData.is_pinned}
                onChange={handleChange}
                className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
              />
              <label htmlFor="is_pinned_edit" className="ml-2 text-sm text-slate-700">
                상단에 고정하기
              </label>
            </div>
            {formData.is_pinned && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">고정순서:</label>
                <input
                  type="number"
                  name="pin_order"
                  value={formData.pin_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, pin_order: parseInt(e.target.value) || 0 }))}
                  min={0}
                  max={99}
                  className="w-16 px-2 py-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm text-center"
                />
                <span className="text-xs text-slate-400">(숫자가 작을수록 먼저 표시)</span>
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || !hasChanges()}
              className="flex-1 px-6 py-3 bg-teal-500 text-white rounded-xl font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '수정 중...' : '수정하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // React Portal을 사용하여 body에 직접 렌더링
  if (!isOpen) return null;

  return createPortal(
    <>
      {modalContent}
      {/* 닫기 확인 모달 */}
      <AlertModal
        isOpen={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        title="수정 내용 확인"
        message="수정 중인 내용이 있습니다. 정말 닫으시겠습니까?"
        type="warning"
        showCancel={true}
        cancelText="취소"
        confirmText="닫기"
        onConfirm={handleConfirmClose}
      />
    </>,
    document.body
  );
};

export default NewsEditModal;
