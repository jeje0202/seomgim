// 게시글 수정 모달 컴포넌트
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCw, Camera, Settings } from 'lucide-react';
import { getCategories } from '../services/boardApi';
import { updatePost, PostDetail, uploadImage, getTags, Tag } from '../services/boardApi';
import { getUserInfo, hasRole } from '../services/authApi';
import { useModalBackButton } from '../hooks/useModalBackButton';
import AlertModal from './AlertModal';
import HtmlToolbar from './HtmlToolbar';

interface PostEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: PostDetail;
  onSuccess: () => void;
}

const PostEditModal: React.FC<PostEditModalProps> = ({
  isOpen,
  onClose,
  post,
  onSuccess
}) => {
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(data);
      } catch (error) {
        console.error('카테고리 로드 오류:', error);
      }
    };
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

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
    title: post.title,
    content: post.content,
    author_password: '',
    is_notice: post.is_notice || false,
    image_url: post.image_url || ''
  });
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user] = useState(getUserInfo());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [rotatingIndex, setRotatingIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // contentEditable을 위한 ref
  const contentEditableRef = useRef<HTMLDivElement>(null);
  // contentEditable 내에 삽입된 이미지 정보
  interface InlineImageData {
    id: string;
    preview: string;
    width: number;
  }
  const [inlineImages, setInlineImages] = useState<Map<string, InlineImageData>>(new Map());
  const [editingImageId, setEditingImageId] = useState<string | null>(null); // 크기 조절 중인 이미지 ID
  const [availableTags, setAvailableTags] = useState<Tag[]>([]); // 사용 가능한 태그 목록
  const [selectedTags, setSelectedTags] = useState<string[]>([]); // 선택된 태그 이름 배열
  const [loadingTags, setLoadingTags] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false); // 닫기 확인 모달 표시 여부

  // 수정 중인지 확인하는 함수
  const hasChanges = () => {
    if (!post) return false;
    return (
      formData.title !== post.title ||
      formData.content !== post.content ||
      imageItems.some(item => item.file !== null) // 새로 추가된 이미지가 있는지
    );
  };

  // 닫기 확인 함수
  const handleClose = () => {
    if (hasChanges()) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  // 닫기 확인 모달에서 확인 버튼 클릭 시
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
  }, [isOpen, formData, imageItems, post]);

  // 태그 목록 로드 및 기존 태그 설정
  useEffect(() => {
    if (isOpen && post) {
      const currentCategory = categories.find(c => c.category_code === post.category_code);
      if (currentCategory?.category_code === 'organization' || currentCategory?.category_code === 'member') {
        loadAvailableTags();
        // 기존 태그 설정
        if (post.tags && Array.isArray(post.tags)) {
          setSelectedTags(post.tags);
        }
      } else {
        setAvailableTags([]);
        setSelectedTags([]);
      }
    }
  }, [isOpen, post, categories]);

  // 태그 목록 로드
  const loadAvailableTags = async () => {
    setLoadingTags(true);
    try {
      const tags = await getTags();
      setAvailableTags(tags);
    } catch (err) {
      console.error('태그 목록 로드 오류:', err);
    } finally {
      setLoadingTags(false);
    }
  };

  // 태그 선택/해제
  const toggleTag = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  // 이미지 초기화 (게시글의 이미지 URL 파싱)
  useEffect(() => {
    if (isOpen && post) {
      setFormData({
        title: post.title,
        content: post.content,
        author_password: '',
        is_notice: post.is_notice || false,
        image_url: post.image_url || ''
      });
      setError('');

      // 이미지 URL 파싱 (JSON 배열 또는 단일 문자열)
      const images: ImageItem[] = [];
      if (post.image_url) {
        try {
          const imageUrls = JSON.parse(post.image_url);
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
            url: post.image_url,
            preview: post.image_url,
            isNew: false,
            description: ''
          });
        }
      }
      setImageItems(images);

      // contentEditable 초기화 및 기존 이미지 복원
      // 내용 설정 함수 (재시도 로직 포함)
      const setContent = (retryCount = 0) => {
        if (!contentEditableRef.current) {
          // DOM이 아직 준비되지 않았으면 재시도 (최대 20번, 약 400ms)
          if (retryCount < 20) {
            setTimeout(() => setContent(retryCount + 1), 20);
          }
          return;
        }

        const currentContent = post.content || '';
        // 내용이 다를 때만 설정 (무한 루프 방지)
        if (contentEditableRef.current.innerHTML !== currentContent) {
          contentEditableRef.current.innerHTML = currentContent;
        }

        // 이미지 처리는 다음 틱에서 실행
        requestAnimationFrame(() => {
          processImages();
        });
      };

      // 이미지 처리 함수
      const processImages = () => {
        if (!contentEditableRef.current) return;

        // 기존 이미지에 드래그 및 크기 조절 기능 추가
        const existingImages = contentEditableRef.current.querySelectorAll('img');
        existingImages.forEach((img) => {
          // 이미 wrapper가 있으면 기존 wrapper 사용
          let wrapper = img.closest('.inline-image-wrapper') as HTMLElement;
          let imgContainer: HTMLElement;

          if (wrapper) {
            // 기존 wrapper 사용 - 리사이즈 핸들이 없으면 추가
            // imgContainer 찾기: wrapper 안의 div[style*="position: relative"] 또는 wrapper 자체
            imgContainer = wrapper.querySelector('div[style*="position: relative"]') as HTMLElement;
            if (!imgContainer) {
              // imgContainer가 없으면 생성
              imgContainer = document.createElement('div');
              imgContainer.style.position = 'relative';
              imgContainer.style.display = 'inline-block';
              // img가 wrapper의 직접 자식이면 imgContainer로 이동
              if (img.parentNode === wrapper) {
                wrapper.removeChild(img);
                imgContainer.appendChild(img);
                wrapper.appendChild(imgContainer);
              } else {
                // img가 다른 요소 안에 있으면 그 요소를 imgContainer로 사용
                imgContainer = img.parentElement as HTMLElement;
              }
            }

            if (!wrapper.querySelector('.image-resize-handle')) {
              const existingImageId = wrapper.getAttribute('data-image-id') || `existing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              wrapper.setAttribute('data-image-id', existingImageId);
              const currentWidth = parseInt(img.style.width) || img.offsetWidth || 300;

              const resizeHandle = document.createElement('div');
              resizeHandle.className = 'image-resize-handle';
              resizeHandle.style.position = 'absolute';
              resizeHandle.style.right = '0';
              resizeHandle.style.bottom = '0';
              resizeHandle.style.width = '16px';
              resizeHandle.style.height = '16px';
              resizeHandle.style.backgroundColor = '#ef4444';
              resizeHandle.style.border = '2px solid white';
              resizeHandle.style.borderRadius = '0 0 8px 0';
              resizeHandle.style.cursor = 'nwse-resize';
              resizeHandle.style.display = 'none';
              resizeHandle.style.zIndex = '10';
              resizeHandle.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

              // 이미지 클릭 이벤트
              img.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();

                const allWrappers = contentEditableRef.current?.querySelectorAll('.inline-image-wrapper');
                allWrappers?.forEach((w) => {
                  const wImg = w.querySelector('img');
                  if (wImg && wImg !== img) {
                    (w as HTMLElement).style.border = 'none';
                    const handle = w.querySelector('.image-resize-handle') as HTMLElement;
                    if (handle) handle.style.display = 'none';
                  }
                });

                const isSelected = wrapper.style.border && wrapper.style.border !== 'none';
                if (isSelected) {
                  wrapper.style.border = 'none';
                  resizeHandle.style.display = 'none';
                  setEditingImageId(null);
                } else {
                  wrapper.style.border = '3px solid #ef4444';
                  wrapper.style.borderRadius = '4px';
                  resizeHandle.style.display = 'block';
                  setEditingImageId(existingImageId);
                }
              });

              // 리사이즈 핸들 드래그 이벤트
              let isResizing = false;
              let startX = 0;
              let startY = 0;
              let startWidth = 0;
              let startHeight = 0;

              resizeHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = img.offsetWidth;
                startHeight = img.offsetHeight;
                document.addEventListener('mousemove', handleResize);
                document.addEventListener('mouseup', stopResize);
              });

              resizeHandle.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                e.preventDefault();
                isResizing = true;
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                startWidth = img.offsetWidth;
                startHeight = img.offsetHeight;
                document.addEventListener('touchmove', handleResizeTouch);
                document.addEventListener('touchend', stopResize);
              });

              const handleResize = (e: MouseEvent) => {
                if (!isResizing) return;
                e.preventDefault();
                const diffX = e.clientX - startX;
                const aspectRatio = startHeight / startWidth;
                const newWidth = Math.max(100, Math.min(800, startWidth + diffX));
                const newHeight = newWidth * aspectRatio;
                img.style.width = `${newWidth}px`;
                img.style.height = `${newHeight}px`;

                setInlineImages(prev => {
                  const newMap = new Map(prev);
                  const existing = newMap.get(existingImageId);
                  if (existing) {
                    newMap.set(existingImageId, { ...existing, width: newWidth });
                  } else {
                    newMap.set(existingImageId, { id: existingImageId, preview: img.src, width: newWidth });
                  }
                  return newMap;
                });
              };

              const handleResizeTouch = (e: TouchEvent) => {
                if (!isResizing) return;
                e.preventDefault();
                const touch = e.touches[0];
                const diffX = touch.clientX - startX;
                const aspectRatio = startHeight / startWidth;
                const newWidth = Math.max(100, Math.min(800, startWidth + diffX));
                const newHeight = newWidth * aspectRatio;
                img.style.width = `${newWidth}px`;
                img.style.height = `${newHeight}px`;

                setInlineImages(prev => {
                  const newMap = new Map(prev);
                  const existing = newMap.get(existingImageId);
                  if (existing) {
                    newMap.set(existingImageId, { ...existing, width: newWidth });
                  } else {
                    newMap.set(existingImageId, { id: existingImageId, preview: img.src, width: newWidth });
                  }
                  return newMap;
                });
              };

              const stopResize = () => {
                isResizing = false;
                document.removeEventListener('mousemove', handleResize);
                document.removeEventListener('mouseup', stopResize);
                document.removeEventListener('touchmove', handleResizeTouch);
              };

              imgContainer.appendChild(resizeHandle);

              setInlineImages(prev => {
                const newMap = new Map(prev);
                newMap.set(existingImageId, { id: existingImageId, preview: img.src, width: currentWidth });
                return newMap;
              });
            }
          } else {
            // wrapper가 없으면 새로 생성
            const imageId = `existing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            img.setAttribute('data-image-id', imageId);
            img.setAttribute('contenteditable', 'false');
            img.style.cursor = 'move';
            img.draggable = true;
            img.className = 'inline-editable-image';

            wrapper = document.createElement('div');
            wrapper.className = 'inline-image-wrapper relative inline-block my-2';
            wrapper.setAttribute('data-image-id', imageId);
            wrapper.draggable = true;
            wrapper.style.position = 'relative';
            wrapper.style.display = 'inline-block';
            wrapper.style.maxWidth = '100%';
            wrapper.style.cursor = 'move';

            imgContainer = document.createElement('div');
            imgContainer.style.position = 'relative';
            imgContainer.style.display = 'inline-block';

            img.parentNode?.insertBefore(wrapper, img);
            imgContainer.appendChild(img);
            wrapper.appendChild(imgContainer);

            const currentWidth = parseInt(img.style.width) || 300;

            // 리사이즈 핸들 (우측 하단 코너)
            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'image-resize-handle';
            resizeHandle.style.position = 'absolute';
            resizeHandle.style.right = '0';
            resizeHandle.style.bottom = '0';
            resizeHandle.style.width = '16px';
            resizeHandle.style.height = '16px';
            resizeHandle.style.backgroundColor = '#ef4444';
            resizeHandle.style.border = '2px solid white';
            resizeHandle.style.borderRadius = '0 0 8px 0';
            resizeHandle.style.cursor = 'nwse-resize';
            resizeHandle.style.display = 'none';
            resizeHandle.style.zIndex = '10';
            resizeHandle.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

            img.addEventListener('click', (e) => {
              e.stopPropagation();
              e.preventDefault();

              // 다른 이미지의 선택 해제
              const allWrappers = contentEditableRef.current?.querySelectorAll('.inline-image-wrapper');
              allWrappers?.forEach((w) => {
                const wImg = w.querySelector('img');
                if (wImg && wImg !== img) {
                  (w as HTMLElement).style.border = 'none';
                  const handle = w.querySelector('.image-resize-handle') as HTMLElement;
                  if (handle) handle.style.display = 'none';
                }
              });

              // 현재 이미지 선택/해제 토글
              const isSelected = wrapper.style.border && wrapper.style.border !== 'none';
              if (isSelected) {
                wrapper.style.border = 'none';
                resizeHandle.style.display = 'none';
                setEditingImageId(null);
              } else {
                wrapper.style.border = '3px solid #ef4444';
                wrapper.style.borderRadius = '4px';
                resizeHandle.style.display = 'block';
                setEditingImageId(imageId);
              }
            });

            // 리사이즈 핸들 드래그 이벤트
            let isResizing = false;
            let startX = 0;
            let startY = 0;
            let startWidth = 0;
            let startHeight = 0;

            resizeHandle.addEventListener('mousedown', (e) => {
              e.stopPropagation();
              e.preventDefault();
              isResizing = true;
              startX = e.clientX;
              startY = e.clientY;
              startWidth = img.offsetWidth;
              startHeight = img.offsetHeight;
              document.addEventListener('mousemove', handleResize);
              document.addEventListener('mouseup', stopResize);
            });

            resizeHandle.addEventListener('touchstart', (e) => {
              e.stopPropagation();
              e.preventDefault();
              isResizing = true;
              const touch = e.touches[0];
              startX = touch.clientX;
              startY = touch.clientY;
              startWidth = img.offsetWidth;
              startHeight = img.offsetHeight;
              document.addEventListener('touchmove', handleResizeTouch);
              document.addEventListener('touchend', stopResize);
            });

            const handleResize = (e: MouseEvent) => {
              if (!isResizing) return;
              e.preventDefault();
              const diffX = e.clientX - startX;
              const aspectRatio = startHeight / startWidth;
              const newWidth = Math.max(100, Math.min(800, startWidth + diffX));
              const newHeight = newWidth * aspectRatio;
              img.style.width = `${newWidth}px`;
              img.style.height = `${newHeight}px`;

              setInlineImages(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(imageId);
                if (existing) {
                  newMap.set(imageId, { ...existing, width: newWidth });
                } else {
                  newMap.set(imageId, { id: imageId, preview: img.src, width: newWidth });
                }
                return newMap;
              });
            };

            const handleResizeTouch = (e: TouchEvent) => {
              if (!isResizing) return;
              e.preventDefault();
              const touch = e.touches[0];
              const diffX = touch.clientX - startX;
              const aspectRatio = startHeight / startWidth;
              const newWidth = Math.max(100, Math.min(800, startWidth + diffX));
              const newHeight = newWidth * aspectRatio;
              img.style.width = `${newWidth}px`;
              img.style.height = `${newHeight}px`;

              setInlineImages(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(imageId);
                if (existing) {
                  newMap.set(imageId, { ...existing, width: newWidth });
                } else {
                  newMap.set(imageId, { id: imageId, preview: img.src, width: newWidth });
                }
                return newMap;
              });
            };

            const stopResize = () => {
              isResizing = false;
              document.removeEventListener('mousemove', handleResize);
              document.removeEventListener('mouseup', stopResize);
              document.removeEventListener('touchmove', handleResizeTouch);
            };

            imgContainer.appendChild(resizeHandle);

            wrapper.addEventListener('dragstart', (e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', imageId);
              wrapper.style.opacity = '0.5';
            });

            wrapper.addEventListener('dragend', (e) => {
              wrapper.style.opacity = '1';
            });

            setInlineImages(prev => {
              const newMap = new Map(prev);
              newMap.set(imageId, { id: imageId, preview: img.src, width: currentWidth });
              return newMap;
            });
          }
        });
      };

      // 초기화 시작 (즉시 실행)
      setContent();

      // 인라인 이미지 정보 초기화는 나중에 (이미지 처리 후)
      setTimeout(() => {
        setInlineImages(new Map());
        setEditingImageId(null);
      }, 200);
    }
  }, [isOpen, post]);

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

  // 커서 위치에 이미지 삽입 함수 (PostWriteModal과 동일)
  const insertImageAtCursor = useCallback((imageId: string, preview: string, width: number = 300) => {
    if (!contentEditableRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      const range = document.createRange();
      range.selectNodeContents(contentEditableRef.current);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const img = document.createElement('img');
    img.src = preview;
    img.setAttribute('data-image-id', imageId);
    img.setAttribute('contenteditable', 'false');
    img.style.width = `${width}px`;
    img.style.height = 'auto';
    img.style.display = 'block';
    img.style.margin = '8px 0';
    img.style.borderRadius = '8px';
    img.style.cursor = 'move';
    img.draggable = true;
    img.className = 'inline-editable-image';

    const wrapper = document.createElement('div');
    wrapper.className = 'inline-image-wrapper relative inline-block my-2';
    wrapper.setAttribute('data-image-id', imageId);
    wrapper.draggable = true;
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.maxWidth = '100%';
    wrapper.style.cursor = 'move';

    const imgContainer = document.createElement('div');
    imgContainer.style.position = 'relative';
    imgContainer.style.display = 'inline-block';
    imgContainer.appendChild(img);

    // 리사이즈 핸들 (우측 하단 코너)
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'image-resize-handle';
    resizeHandle.style.position = 'absolute';
    resizeHandle.style.right = '0';
    resizeHandle.style.bottom = '0';
    resizeHandle.style.width = '16px';
    resizeHandle.style.height = '16px';
    resizeHandle.style.backgroundColor = '#ef4444';
    resizeHandle.style.border = '2px solid white';
    resizeHandle.style.borderRadius = '0 0 8px 0';
    resizeHandle.style.cursor = 'nwse-resize';
    resizeHandle.style.display = 'none';
    resizeHandle.style.zIndex = '10';
    resizeHandle.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

    // 이미지 클릭 시 선택 상태 토글
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      // 다른 이미지의 선택 해제
      const allWrappers = contentEditableRef.current?.querySelectorAll('.inline-image-wrapper');
      allWrappers?.forEach((w) => {
        const wImg = w.querySelector('img');
        if (wImg && wImg !== img) {
          (w as HTMLElement).style.border = 'none';
          const handle = w.querySelector('.image-resize-handle') as HTMLElement;
          if (handle) handle.style.display = 'none';
        }
      });

      // 현재 이미지 선택/해제 토글
      const isSelected = wrapper.style.border && wrapper.style.border !== 'none';
      if (isSelected) {
        wrapper.style.border = 'none';
        resizeHandle.style.display = 'none';
        setEditingImageId(null);
      } else {
        wrapper.style.border = '3px solid #ef4444';
        wrapper.style.borderRadius = '4px';
        resizeHandle.style.display = 'block';
        setEditingImageId(imageId);
      }
    });

    // 리사이즈 핸들 드래그 이벤트
    let isResizing = false;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = img.offsetWidth;
      startHeight = img.offsetHeight;
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', stopResize);
    });

    resizeHandle.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      e.preventDefault();
      isResizing = true;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startWidth = img.offsetWidth;
      startHeight = img.offsetHeight;
      document.addEventListener('touchmove', handleResizeTouch);
      document.addEventListener('touchend', stopResize);
    });

    const handleResize = (e: MouseEvent) => {
      if (!isResizing) return;
      e.preventDefault();
      const diffX = e.clientX - startX;
      const diffY = e.clientY - startY;
      const aspectRatio = startHeight / startWidth;
      const newWidth = Math.max(100, Math.min(800, startWidth + diffX));
      const newHeight = newWidth * aspectRatio;
      img.style.width = `${newWidth}px`;
      img.style.height = `${newHeight}px`;

      setInlineImages(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(imageId);
        if (existing) {
          newMap.set(imageId, { ...existing, width: newWidth });
        }
        return newMap;
      });
    };

    const handleResizeTouch = (e: TouchEvent) => {
      if (!isResizing) return;
      e.preventDefault();
      const touch = e.touches[0];
      const diffX = touch.clientX - startX;
      const diffY = touch.clientY - startY;
      const aspectRatio = startHeight / startWidth;
      const newWidth = Math.max(100, Math.min(800, startWidth + diffX));
      const newHeight = newWidth * aspectRatio;
      img.style.width = `${newWidth}px`;
      img.style.height = `${newHeight}px`;

      setInlineImages(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(imageId);
        if (existing) {
          newMap.set(imageId, { ...existing, width: newWidth });
        }
        return newMap;
      });
    };

    const stopResize = () => {
      isResizing = false;
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', stopResize);
      document.removeEventListener('touchmove', handleResizeTouch);
    };

    imgContainer.appendChild(resizeHandle);
    wrapper.appendChild(imgContainer);

    wrapper.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', imageId);
      wrapper.style.opacity = '0.5';
    });

    wrapper.addEventListener('dragend', (e) => {
      wrapper.style.opacity = '1';
    });

    range.insertNode(wrapper);
    range.setStartAfter(wrapper);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    setInlineImages(prev => {
      const newMap = new Map(prev);
      newMap.set(imageId, { id: imageId, preview, width });
      return newMap;
    });
  }, []);

  // contentEditable 내용을 formData.content에 동기화
  const updateContentFromEditable = useCallback(() => {
    if (contentEditableRef.current) {
      // 이미지가 삭제된 경우 빈 wrapper 제거
      const emptyWrappers = contentEditableRef.current.querySelectorAll('.inline-image-wrapper');
      emptyWrappers.forEach((wrapper) => {
        const img = wrapper.querySelector('img');
        if (!img) {
          // 이미지가 없는 wrapper는 제거
          wrapper.remove();
        }
      });

      const htmlContent = contentEditableRef.current.innerHTML;
      setFormData(prev => ({ ...prev, content: htmlContent }));
    }
  }, []);

  // 클립보드 붙여넣기 이벤트 핸들러 (커서 위치에 이미지 삽입)
  useEffect(() => {
    if (!isOpen || !post) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const currentCategory = categories?.find((c: any) => c.category_id === post.category_id);
      const allowedCategories = ['bulletin', 'member', 'organization', 'notice'];
      if (!currentCategory || !allowedCategories.includes(currentCategory.category_code)) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
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

        for (const file of imageFiles) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const preview = reader.result as string;

            const imageItem: ImageItem = {
              id: imageId,
              url: '',
              file: file,
              originalFile: file,
              preview: preview,
              isNew: true,
              description: ''
            };
            setImageItems(prev => [...prev, imageItem]);
            insertImageAtCursor(imageId, preview, 300);
          };
          reader.readAsDataURL(file);
        }
      }
    };

    const contentEditable = contentEditableRef.current;
    if (contentEditable) {
      contentEditable.addEventListener('paste', handlePaste);

      const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const imageId = e.dataTransfer?.getData('text/plain');
        if (!imageId || !contentEditable) return;

        const existingWrapper = contentEditable.querySelector(`[data-image-id="${imageId}"]`) as HTMLElement;
        if (!existingWrapper) return;

        const x = e.clientX;
        const y = e.clientY;

        const range = document.caretRangeFromPoint?.(x, y) || (() => {
          const r = document.createRange();
          r.selectNodeContents(contentEditable);
          r.collapse(false);
          return r;
        })();

        if (!range) return;

        let dropTarget = range.commonAncestorContainer;
        if (dropTarget.nodeType === Node.TEXT_NODE) {
          dropTarget = dropTarget.parentNode as Node;
        }

        const targetWrapper = (dropTarget as Element).closest?.('[data-image-id]');

        if (targetWrapper && targetWrapper !== existingWrapper) {
          const targetId = targetWrapper.getAttribute('data-image-id');
          if (targetId !== imageId) {
            const rect = targetWrapper.getBoundingClientRect();
            if (y < rect.top + rect.height / 2) {
              targetWrapper.before(existingWrapper);
            } else {
              targetWrapper.after(existingWrapper);
            }
          }
        } else {
          existingWrapper.remove();
          range.insertNode(existingWrapper);
          range.setStartAfter(existingWrapper);
          range.collapse(true);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }

        updateContentFromEditable();
      };

      const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
      };

      contentEditable.addEventListener('drop', handleDrop);
      contentEditable.addEventListener('dragover', handleDragOver);

      return () => {
        contentEditable.removeEventListener('paste', handlePaste);
        contentEditable.removeEventListener('drop', handleDrop);
        contentEditable.removeEventListener('dragover', handleDragOver);
      };
    }
  }, [isOpen, post, categories, insertImageAtCursor, updateContentFromEditable]);

  // 외부 클릭 시 이미지 선택 해제
  useEffect(() => {
    if (!isOpen || !editingImageId) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`[data-image-id="${editingImageId}"]`)) {
        // 선택 해제
        const selectedWrapper = contentEditableRef.current?.querySelector(`[data-image-id="${editingImageId}"]`) as HTMLElement;
        if (selectedWrapper) {
          selectedWrapper.style.border = 'none';
          const handle = selectedWrapper.querySelector('.image-resize-handle') as HTMLElement;
          if (handle) handle.style.display = 'none';
        }
        setEditingImageId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen, editingImageId]);

  // 폼 입력 변경 핸들러
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
    setError('');
  }, []);

  if (!isOpen) return null;

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
              preview: reader.result as string,
              isNew: true // 회전된 이미지는 새 이미지로 처리
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
    setError('');
    setLoading(true);

    try {
      if (!formData.title.trim()) {
        setError('제목을 입력해주세요.');
        setLoading(false);
        return;
      }
      if (!formData.content.trim()) {
        // HTML에서 텍스트만 추출하여 검증
        const tempCheckDiv = document.createElement('div');
        tempCheckDiv.innerHTML = formData.content;
        const textOnly = tempCheckDiv.textContent || tempCheckDiv.innerText || '';
        if (!textOnly.trim()) {
          setError('내용을 입력해주세요.');
          setLoading(false);
          return;
        }
      }
      if (!formData.author_password.trim() || formData.author_password.length < 4) {
        setError('비밀번호를 입력해주세요. (4자 이상)');
        setLoading(false);
        return;
      }

      // 이미지 처리 (주보게시판, 성도게시판, 기관게시판, 공지사항 게시판)
      const currentCategory = categories.find((c: any) => c.category_id === post.category_id);
      let imageUrl = formData.image_url;
      const allowedCategories = ['bulletin', 'member', 'organization', 'notice'];

      // contentEditable에서 이미지 추출 및 업로드
      let finalContent = formData.content;

      if (currentCategory && allowedCategories.includes(currentCategory.category_code)) {
        // contentEditable에서 이미지 추출 및 업로드
        if (contentEditableRef.current) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = formData.content;
          const imageElements = tempDiv.querySelectorAll('img[data-image-id]');

          if (imageElements.length > 0) {
            setUploadingImage(true);
            try {
              for (const img of Array.from(imageElements)) {
                const imageId = img.getAttribute('data-image-id');
                if (!imageId) continue;

                // 본문에 삽입된 이미지는 inlineImages에 저장됨
                // inlineImages에 있으면 본문에 삽입된 이미지
                // imageItems에서 새로 추가된 이미지 찾기 (본문에 삽입된 이미지)
                if (inlineImages.has(imageId)) {
                  const imageItem = imageItems.find(item => item.id === imageId && item.isNew && item.file);
                  if (imageItem && imageItem.file) {
                    const imageUrl = await uploadImage(imageItem.file, currentCategory.category_code);
                    img.setAttribute('src', imageUrl);
                  }
                }
              }
              finalContent = tempDiv.innerHTML;
            } catch (err: any) {
              setError(err.message || '이미지 업로드에 실패했습니다.');
              setLoading(false);
              setUploadingImage(false);
              return;
            }
            setUploadingImage(false);
          }
        }

        // 새로 추가된 이미지 업로드 (기존 방식)
        setUploadingImage(true);
        const imageUrls: string[] = [];

        try {
          for (const imageItem of imageItems) {
            if (imageItem.isNew && imageItem.file) {
              // inlineImages에 있으면 본문에 삽입된 이미지이므로 첨부 이미지에서 제외
              if (inlineImages.has(imageItem.id)) {
                continue;
              }
              // 별도로 첨부한 이미지만 업로드
              const categoryCode = currentCategory?.category_code || 'bulletin';
              const uploadedUrl = await uploadImage(imageItem.file, categoryCode);
              imageUrls.push(uploadedUrl);
            } else {
              // 기존 이미지 URL 유지 (본문에 삽입되지 않은 기존 첨부 이미지만)
              // inlineImages에 없으면 별도 첨부 이미지
              if (!inlineImages.has(imageItem.id)) {
                imageUrls.push(imageItem.url);
              }
            }
          }

          // 이미지가 있으면 JSON 배열로 저장, 없으면 null
          imageUrl = imageUrls.length > 0 ? JSON.stringify(imageUrls) : '';
        } catch (err: any) {
          setError(err.message || '이미지 업로드에 실패했습니다.');
          setLoading(false);
          setUploadingImage(false);
          return;
        }
        setUploadingImage(false);
      }

      // 기관게시판 및 성도게시판인 경우 태그 포함
      const updateData: any = {
        title: formData.title,
        content: finalContent, // HTML 콘텐츠 (이미지 포함)
        author_password: formData.author_password,
        is_notice: formData.is_notice,
        image_url: imageUrl || undefined
      };

      if (currentCategory?.category_code === 'organization' || currentCategory?.category_code === 'member') {
        updateData.tags = selectedTags;
      }

      await updatePost(post.post_id, updateData);

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || '게시글 수정에 실패했습니다.');
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
        className="bg-white rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        style={{
          position: 'relative',
          margin: 'auto',
          maxHeight: '90vh'
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

        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-6">게시글 수정</h2>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="제목을 입력하세요"
                maxLength={200}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            {/* 내용 - contentEditable (이미지 인라인 삽입 가능) */}
            {(() => {
              const currentCategory = categories?.find((c: any) => c.category_code === post.category_code);
              const allowedCategories = ['bulletin', 'member', 'organization', 'notice'];
              const isImageEnabled = currentCategory && allowedCategories.includes(currentCategory.category_code);

              if (isImageEnabled) {
                // 이미지 삽입 가능한 게시판: contentEditable 사용
                return (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      내용 <span className="text-rose-500">*</span>
                    </label>
                    <HtmlToolbar targetRef={contentEditableRef} onContentChange={updateContentFromEditable} />
                    <div
                      ref={contentEditableRef}
                      contentEditable
                      onBlur={updateContentFromEditable}
                      onInput={() => {
                        // 실시간으로 빈 wrapper 제거
                        if (contentEditableRef.current) {
                          const emptyWrappers = contentEditableRef.current.querySelectorAll('.inline-image-wrapper');
                          emptyWrappers.forEach((wrapper) => {
                            const img = wrapper.querySelector('img');
                            if (!img) {
                              wrapper.remove();
                            }
                          });
                        }
                        updateContentFromEditable();
                      }}
                      className="w-full min-h-[250px] px-4 py-2.5 border border-slate-300 rounded-b-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                      data-placeholder="내용을 입력하세요 (이미지는 Ctrl+V로 붙여넣을 수 있습니다)"
                    />
                    <style>{`
                      [contenteditable][data-placeholder]:empty:before {
                        content: attr(data-placeholder);
                        color: #94a3b8;
                        pointer-events: none;
                      }
                      .inline-image-wrapper {
                        margin: 8px 0;
                        vertical-align: middle;
                      }
                      .inline-editable-image {
                        max-width: 100%;
                        height: auto;
                        border-radius: 8px;
                        cursor: move;
                        user-select: none;
                      }
                      .image-resize-handle {
                        user-select: none;
                      }
                      .image-resize-handle:hover {
                        background-color: #dc2626 !important;
                        transform: scale(1.2);
                      }
                    `}</style>
                  </div>
                );
              } else {
                // 이미지 삽입 불가능한 게시판: 일반 textarea 사용
                return (
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
                      data-placeholder="내용을 입력하세요"
                    />
                    <style>{`
                [contenteditable][data-placeholder]:empty:before {
                  content: attr(data-placeholder);
                  color: #94a3b8;
                  pointer-events: none;
                }
              `}</style>
                  </div>
                );
              }
            })()}

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                비밀번호 확인 <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                name="author_password"
                value={formData.author_password}
                onChange={handleChange}
                placeholder="게시글 작성 시 입력한 비밀번호"
                minLength={4}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            {/* 태그 선택 (기관게시판 및 성도게시판) */}
            {(() => {
              const currentCategory = categories.find((c: any) => c.category_code === post.category_code);
              if (currentCategory?.category_code === 'organization' || currentCategory?.category_code === 'member') {
                return (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      태그
                    </label>
                    {loadingTags ? (
                      <div className="text-sm text-slate-400">태그 목록을 불러오는 중...</div>
                    ) : availableTags.length === 0 ? (
                      <div className="text-sm text-slate-400">등록된 태그가 없습니다.</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {availableTags.map((tag) => (
                          <button
                            key={tag.tag_id}
                            type="button"
                            onClick={() => toggleTag(tag.tag_name)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${selectedTags.includes(tag.tag_name)
                                ? 'text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            style={selectedTags.includes(tag.tag_name) ? { backgroundColor: tag.tag_color } : {}}
                          >
                            {tag.tag_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })()}

            {/* 이미지 업로드 (주보게시판, 성도게시판, 기관게시판, 공지사항 게시판) */}
            {(() => {
              const currentCategory = categories.find((c: any) => c.category_id === post.category_id);
              const allowedCategories = ['bulletin', 'member', 'organization', 'notice'];
              if (currentCategory && allowedCategories.includes(currentCategory.category_code)) {
                return (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      {currentCategory?.category_code === 'bulletin' ? '주보 이미지' : '이미지 첨부'}
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
                            {/* 회전 버튼 (새 이미지인 경우만 표시) */}
                            {imageItem.isNew && (imageItem.originalFile || imageItem.file) && (
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
                            {/* 순서 번호 및 상태 표시 */}
                            <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                              <span>{index + 1}</span>
                              {imageItem.isNew && (
                                <span className="text-teal-300">(신규)</span>
                              )}
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
                        id="image-upload-edit"
                        multiple
                        ref={fileInputRef}
                      />
                      <label
                        htmlFor="image-upload-edit"
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
                      <div className="mt-2 text-sm text-teal-600">이미지 업로드 중...</div>
                    )}
                  </div>
                );
              }
              return null;
            })()}

            {/* 공지사항 체크박스 - 관리자 권한 이상만 표시 */}
            {user && hasRole(user, 'admin', 'super-admin') && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="is_notice"
                  id="is_notice"
                  checked={formData.is_notice}
                  onChange={handleChange}
                  className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                />
                <label htmlFor="is_notice" className="ml-2 text-sm text-slate-700">
                  공지사항으로 등록
                </label>
              </div>
            )}

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
                disabled={loading}
                className="flex-1 px-6 py-3 bg-teal-500 text-white rounded-xl font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '수정 중...' : '수정하기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(modalContent, document.body)}

      {/* 닫기 확인 모달 */}
      <AlertModal
        isOpen={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        title="수정 중인 내용이 있습니다"
        message="정말 닫으시겠습니까?"
        type="warning"
        confirmText="닫기"
        showCancel={true}
        cancelText="취소"
        onConfirm={handleConfirmClose}
      />
    </>
  );
};

export default PostEditModal;

