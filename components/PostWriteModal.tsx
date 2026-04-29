// 게시글 작성 모달 컴포넌트
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, GripVertical, RotateCw, Camera, Settings } from 'lucide-react';
import { createPost, BoardCategory, uploadImage, getTags, Tag } from '../services/boardApi';
import { getUserInfo, hasRole, getCurrentUser } from '../services/authApi';
import { useModalBackButton } from '../hooks/useModalBackButton';
import TagManagementModal from './TagManagementModal';
import AlertModal from './AlertModal';
import HtmlToolbar from './HtmlToolbar';

interface PostWriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: BoardCategory[];
  selectedCategoryId: number;
  onSuccess: () => void;
  initialSelectedTags?: string[]; // 게시판에서 선택된 태그를 초기값으로 전달
}

const PostWriteModal: React.FC<PostWriteModalProps> = ({
  isOpen,
  onClose,
  categories,
  selectedCategoryId,
  onSuccess,
  initialSelectedTags = []
}) => {
  const [formData, setFormData] = useState({
    category_id: selectedCategoryId,
    title: '',
    content: '',
    author_name: '',
    author_password: '',
    is_notice: false,
    image_url: ''
  });
  // 여러 이미지 관리 (순서 유지)
  interface ImageItem {
    id: string;
    file: File;
    originalFile?: File; // 회전용 원본 파일
    preview: string;
    description: string;
    width?: number; // 이미지 너비 (선택적)
  }

  const [imageFiles, setImageFiles] = useState<ImageItem[]>([]);

  // contentEditable 내에 삽입된 이미지 정보
  interface InlineImageData {
    id: string;
    preview: string;
    width: number;
  }
  const [inlineImages, setInlineImages] = useState<Map<string, InlineImageData>>(new Map());
  const [editingImageId, setEditingImageId] = useState<string | null>(null);

  // contentEditable을 위한 ref
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [rotatingIndex, setRotatingIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]); // 사용 가능한 태그 목록
  const [selectedTags, setSelectedTags] = useState<string[]>([]); // 선택된 태그 이름 배열
  const [loadingTags, setLoadingTags] = useState(false);
  const [showTagManagementModal, setShowTagManagementModal] = useState(false); // 태그 관리 모달 표시 여부
  const [showCloseConfirm, setShowCloseConfirm] = useState(false); // 닫기 확인 모달 표시 여부

  // 작성 중인지 확인하는 함수
  const hasContent = () => {
    return formData.title.trim() !== '' || formData.content.trim() !== '' || imageFiles.length > 0;
  };

  // 닫기 확인 함수
  const handleClose = () => {
    if (hasContent()) {
      setShowCloseConfirm(true);
    } else {
      // 모달 닫을 때 폼 초기화
      const userInfo = getUserInfo();
      setFormData({
        category_id: selectedCategoryId,
        title: '',
        content: '',
        author_name: userInfo?.nickname || userInfo?.name || '',
        author_password: '',
        is_notice: false,
        image_url: ''
      });
      setImageFiles([]);
      setSelectedTags([]);
      setError('');
      onClose();
    }
  };

  // 닫기 확인 모달에서 확인 버튼 클릭 시
  const handleConfirmClose = () => {
    // 모달 닫을 때 폼 초기화
    const userInfo = getUserInfo();
    setFormData({
      category_id: selectedCategoryId,
      title: '',
      content: '',
      author_name: userInfo?.nickname || userInfo?.name || '',
      author_password: '',
      is_notice: false,
      image_url: ''
    });
    setImageFiles([]);
    setSelectedTags([]);
    setError('');
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
  }, [isOpen, formData, imageFiles]);

  // selectedCategoryId가 변경되면 formData 업데이트
  useEffect(() => {
    if (isOpen && selectedCategoryId) {
      const userInfo = getUserInfo();
      setFormData(prev => ({
        ...prev,
        category_id: selectedCategoryId,
        // 로그인한 상태이면 작성자 이름 자동 입력 (닉네임 우선, 없으면 이름)
        author_name: userInfo?.nickname || userInfo?.name || prev.author_name
      }));
    }
  }, [isOpen, selectedCategoryId]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(getUserInfo());

  // 사용자 정보 변경 감지 (로그아웃 시 태그관리 모달 닫기)
  useEffect(() => {
    const handleStorageChange = () => {
      const userInfo = getUserInfo();
      setUser(userInfo);
      // 권한이 없어지면 태그관리 모달 닫기
      const stillCanManage = userInfo && hasRole(userInfo, 'admin', 'super-admin');
      if (!stillCanManage && showTagManagementModal) {
        setShowTagManagementModal(false);
      }
    };

    const handleLogout = () => {
      setUser(null);
      if (showTagManagementModal) {
        setShowTagManagementModal(false);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth:logout', handleLogout);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, [showTagManagementModal]);

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

  // 모달이 열릴 때마다 사용자 정보 갱신 및 작성자 이름 자동 입력
  useEffect(() => {
    if (isOpen) {
      // 서버에서 최신 사용자 정보 가져오기 (nickname 포함)
      const loadUserInfo = async () => {
        try {
          const userInfo = await getCurrentUser();
          if (userInfo) {
            setUser(userInfo);
            // 로그인한 상태이면 작성자 이름 자동 입력 (닉네임 우선, 없으면 이름)
            setFormData(prev => ({
              ...prev,
              author_name: userInfo.nickname || userInfo.name || prev.author_name
            }));
          } else {
            // 서버에서 가져오기 실패 시 로컬 스토리지에서 가져오기
            const localUserInfo = getUserInfo();
            setUser(localUserInfo);
            if (localUserInfo) {
              setFormData(prev => ({
                ...prev,
                author_name: localUserInfo.nickname || localUserInfo.name || prev.author_name
              }));
            }
          }
        } catch (error) {
          // 오류 발생 시 로컬 스토리지에서 가져오기
          const localUserInfo = getUserInfo();
          setUser(localUserInfo);
          if (localUserInfo) {
            setFormData(prev => ({
              ...prev,
              author_name: localUserInfo.nickname || localUserInfo.name || prev.author_name
            }));
          }
        }
      };
      loadUserInfo();

      // 기관게시판 및 성도게시판인 경우 태그 목록 로드
      const currentCategory = categories?.find(c => c.category_id === selectedCategoryId);
      if (currentCategory?.category_code === 'organization' || currentCategory?.category_code === 'member') {
        loadAvailableTags();
        // 게시판에서 선택된 태그를 초기값으로 설정 (항상 초기화)
        setSelectedTags(initialSelectedTags || []);
      } else {
        setAvailableTags([]);
        setSelectedTags([]);
      }

      // contentEditable 초기화 (모달 열릴 때)
      if (contentEditableRef.current) {
        // 이미 내용이 있으면(수정 모드 등) 덮어쓰지 않음, 단 모달이 막 열렸을 때는 초기화
        if (contentEditableRef.current.innerHTML !== formData.content) {
          contentEditableRef.current.innerHTML = formData.content || '';
        }
      }
      setInlineImages(new Map());
      setEditingImageId(null);
    }
  }, [isOpen, initialSelectedTags, selectedCategoryId]); // formData.content 제거

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
          file: file,
          originalFile: file, // 회전용 원본 파일 저장
          preview: reader.result as string,
          description: ''
        };
        setImageFiles(prev => [...prev, imageItem]);
      };
      reader.readAsDataURL(file);
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

  // contentEditable 입력 변경 핸들러
  const handleContentChange = useCallback(() => {
    updateContentFromEditable();
  }, [updateContentFromEditable]);

  // 커서 위치에 이미지 삽입 함수
  const insertImageAtCursor = useCallback((imageId: string, preview: string, width: number = 300) => {
    if (!contentEditableRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // 선택 영역이 없으면 끝에 삽입
      const range = document.createRange();
      range.selectNodeContents(contentEditableRef.current);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();

    // 이미지 요소 생성
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

    // 크기 조절 컨트롤이 포함된 래퍼 div 생성
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
        const newMap = new Map<string, InlineImageData>(prev);
        const existing = newMap.get(imageId);
        if (existing) {
          newMap.set(imageId, {
            id: existing.id,
            preview: existing.preview,
            width: newWidth
          });
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
        const newMap = new Map<string, InlineImageData>(prev);
        const existing = newMap.get(imageId);
        if (existing) {
          newMap.set(imageId, {
            id: existing.id,
            preview: existing.preview,
            width: newWidth
          });
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

    // 이미지 드래그 이벤트 (wrapper 전체를 드래그)
    wrapper.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', imageId);
      wrapper.style.opacity = '0.5';
      wrapper.style.cursor = 'move';
    });

    wrapper.addEventListener('dragend', (e) => {
      wrapper.style.opacity = '1';
      wrapper.style.cursor = 'move';
    });

    range.insertNode(wrapper);
    range.setStartAfter(wrapper);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    // inlineImages 상태 업데이트
    setInlineImages(prev => {
      const newMap = new Map(prev);
      newMap.set(imageId, { id: imageId, preview, width });
      return newMap;
    });
  }, []);

  // 클립보드 붙여넣기 이벤트 핸들러 (커서 위치에 이미지 삽입)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      // 이미지 업로드가 가능한 게시판인지 확인
      const currentCategory = categories?.find(c => c.category_id === formData.category_id);
      const allowedCategories = ['bulletin', 'member', 'organization', 'notice'];
      if (!currentCategory || !allowedCategories.includes(currentCategory.category_code)) {
        return;
      }

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

        // 각 이미지를 커서 위치에 삽입
        for (const file of imageFiles) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const preview = reader.result as string;

            // imageFiles에도 추가 (서버 업로드용)
            const imageItem: ImageItem = {
              id: imageId,
              file: file,
              originalFile: file,
              preview: preview,
              description: '',
              width: 300
            };
            setImageFiles(prev => [...prev, imageItem]);

            // 커서 위치에 이미지 삽입
            insertImageAtCursor(imageId, preview, 300);
          };
          reader.readAsDataURL(file);
        }
      }
    };

    // contentEditable에 붙여넣기 이벤트 리스너 추가
    const contentEditable = contentEditableRef.current;
    if (contentEditable) {
      contentEditable.addEventListener('paste', handlePaste);

      // 드래그앤드롭 이벤트 처리
      const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const imageId = e.dataTransfer?.getData('text/plain');
        if (!imageId || !contentEditable) return;

        // 기존 이미지 요소 찾기
        const existingWrapper = contentEditable.querySelector(`[data-image-id="${imageId}"]`) as HTMLElement;
        if (!existingWrapper) return;

        // 드롭 위치 찾기 (마우스 포인터 위치)
        const x = e.clientX;
        const y = e.clientY;

        // contentEditable 내에서 드롭 위치 찾기
        const range = document.caretRangeFromPoint?.(x, y) ||
          (() => {
            // 폴백: contentEditable의 끝에 삽입
            const r = document.createRange();
            r.selectNodeContents(contentEditable);
            r.collapse(false);
            return r;
          })();

        if (!range) return;

        // 드롭 대상이 다른 이미지 wrapper 안인지 확인
        let dropTarget = range.commonAncestorContainer;
        if (dropTarget.nodeType === Node.TEXT_NODE) {
          dropTarget = dropTarget.parentNode as Node;
        }

        const targetWrapper = (dropTarget as Element).closest?.('[data-image-id]');

        // 다른 이미지 wrapper 안이면 그 앞이나 뒤에 삽입
        if (targetWrapper && targetWrapper !== existingWrapper) {
          const targetId = targetWrapper.getAttribute('data-image-id');
          if (targetId !== imageId) {
            // 드롭 위치에 따라 앞 또는 뒤에 삽입
            const rect = targetWrapper.getBoundingClientRect();
            if (y < rect.top + rect.height / 2) {
              targetWrapper.before(existingWrapper);
            } else {
              targetWrapper.after(existingWrapper);
            }
          }
        } else {
          // 일반 텍스트 영역에 삽입
          // 기존 이미지 제거
          existingWrapper.remove();

          // 새로운 위치에 삽입
          range.insertNode(existingWrapper);

          // 커서를 이미지 뒤로 이동
          range.setStartAfter(existingWrapper);
          range.collapse(true);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }

        // contentEditable 내용 업데이트
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
  }, [isOpen, formData.category_id, categories, insertImageAtCursor, updateContentFromEditable]);

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

  // 모바일 뒤로 가기 버튼으로 모달 닫기
  useModalBackButton({ isOpen, onClose });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 입력 검증
      if (!formData.title.trim()) {
        setError('제목을 입력해주세요.');
        setLoading(false);
        return;
      }
      // contentEditable 내용 업데이트
      updateContentFromEditable();

      // HTML에서 텍스트만 추출하여 검증
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = formData.content;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';

      if (!textContent.trim() && inlineImages.size === 0) {
        setError('내용을 입력해주세요.');
        setLoading(false);
        return;
      }
      if (!formData.author_name.trim()) {
        setError('작성자 이름을 입력해주세요.');
        setLoading(false);
        return;
      }
      if (formData.author_password.length < 4) {
        setError('비밀번호는 4자 이상 입력해주세요.');
        setLoading(false);
        return;
      }

      const currentCategory = categories?.find(c => c.category_id === formData.category_id);

      // contentEditable에서 이미지 추출 및 업로드
      let finalContent = formData.content;
      const allowedCategories = ['bulletin', 'member', 'organization', 'notice'];

      if (currentCategory && allowedCategories.includes(currentCategory.category_code) && contentEditableRef.current) {
        // contentEditable 내의 모든 이미지 요소 찾기 (본문에 삽입된 이미지)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = formData.content;
        const imageElements = tempDiv.querySelectorAll('img[data-image-id]');

        if (imageElements.length > 0) {
          setUploadingImage(true);
          try {
            // 각 이미지를 업로드하고 URL로 교체
            // 본문에 삽입된 이미지는 inlineImages에 저장되며, imageFiles에서 찾아서 업로드
            for (const img of Array.from(imageElements)) {
              const imageId = img.getAttribute('data-image-id');
              if (!imageId) continue;

              // inlineImages에 있으면 본문에 삽입된 이미지
              // imageFiles에서 해당 이미지 찾기 (클립보드에서 붙여넣은 이미지)
              const imageItem = imageFiles.find(item => item.id === imageId);
              if (imageItem && imageItem.file) {
                const imageUrl = await uploadImage(imageItem.file, currentCategory.category_code);
                // data URL을 실제 서버 URL로 교체
                img.setAttribute('src', imageUrl);
                // data-image-id는 유지하되 실제 URL로 변경
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

      // 주보게시판 이미지 필수 체크 (contentEditable 내 이미지 또는 기존 방식 이미지)
      if (currentCategory?.category_code === 'bulletin') {
        const hasInlineImages = contentEditableRef.current?.querySelectorAll('img[data-image-id]').length || 0;
        if (imageFiles.length === 0 && hasInlineImages === 0) {
          setError('주보 이미지를 선택해주세요.');
          setLoading(false);
          return;
        }
      }

      // 여러 이미지 업로드 (주보게시판, 성도게시판, 기관게시판, 공지사항 게시판에서 별도 첨부 이미지가 있는 경우)
      let imageUrls: string[] = [];
      if (currentCategory && allowedCategories.includes(currentCategory.category_code) && imageFiles.length > 0) {
        // contentEditable에 삽입되지 않은 이미지만 업로드 (별도 이미지 첨부 방식)
        // 본문에 삽입된 이미지는 inlineImages에 저장되므로, inlineImages에 없는 이미지만 첨부 이미지로 처리
        setUploadingImage(true);
        try {
          // 선택한 순서대로 업로드
          for (const imageItem of imageFiles) {
            // inlineImages에 있으면 본문에 삽입된 이미지이므로 첨부 이미지에서 제외
            if (inlineImages.has(imageItem.id)) {
              continue;
            }
            // 별도로 첨부한 이미지만 업로드
            const imageUrl = await uploadImage(imageItem.file, currentCategory.category_code);
            imageUrls.push(imageUrl);
          }
        } catch (err: any) {
          setError(err.message || '이미지 업로드에 실패했습니다.');
          setLoading(false);
          setUploadingImage(false);
          return;
        }
        setUploadingImage(false);
      }

      // 기관게시판인 경우 태그 포함
      const postData: any = {
        category_id: formData.category_id,
        title: formData.title,
        content: finalContent, // HTML 콘텐츠 (이미지 포함)
        author_name: formData.author_name,
        author_password: formData.author_password,
        is_notice: formData.is_notice || false,
        image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : (formData.image_url || undefined)
      };

      if (currentCategory?.category_code === 'organization' || currentCategory?.category_code === 'member') {
        postData.tags = selectedTags;
      }

      await createPost(postData);

      // 폼 초기화 (작성자 이름은 로그인 상태면 유지 - 닉네임 우선, 없으면 이름)
      const userInfo = getUserInfo();
      setFormData({
        category_id: selectedCategoryId,
        title: '',
        content: '',
        author_name: userInfo?.nickname || userInfo?.name || '',
        author_password: '',
        is_notice: false,
        image_url: ''
      });
      setImageFiles([]);
      setInlineImages(new Map());
      setEditingImageId(null);
      // 작성 완료 후 태그는 초기화
      setSelectedTags([]);

      // contentEditable 초기화
      if (contentEditableRef.current) {
        contentEditableRef.current.innerHTML = '';
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || '게시글 작성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFiles(files);
    // input 초기화 (같은 파일 다시 선택 가능하도록)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleImageDescriptionChange = (index: number, description: string) => {
    setImageFiles(prev => prev.map((img, i) =>
      i === index ? { ...img, description } : img
    ));
  };

  // 이미지 회전 핸들러
  const handleRotateImage = async (index: number) => {
    const imageItem = imageFiles[index];
    if (!imageItem.originalFile) {
      setError('이미지 회전을 위해 원본 파일이 필요합니다.');
      return;
    }

    setRotatingIndex(index);
    setError('');

    try {
      const { rotateImage90 } = await import('../utils/imageRotation');
      const rotatedFile = await rotateImage90(imageItem.originalFile);

      // 회전된 파일로 미리보기 업데이트
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageFiles(prev => prev.map((img, i) =>
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

    const newImages = [...imageFiles];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);

    setImageFiles(newImages);
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
        <h2 className="text-2xl font-bold text-slate-800 mb-6">게시글 작성</h2>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 게시판 선택 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              게시판
            </label>
            <select
              name="category_id"
              value={formData.category_id}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            >
              {categories.map(cat => (
                <option key={cat.category_id} value={cat.category_id}>
                  {cat.category_name}
                </option>
              ))}
            </select>
          </div>

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
            const currentCategory = categories?.find(c => c.category_id === formData.category_id);
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

          {/* 작성자 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                작성자 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="author_name"
                value={formData.author_name}
                onChange={handleChange}
                placeholder={user?.name || "이름"}
                maxLength={50}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                비밀번호 <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                name="author_password"
                value={formData.author_password}
                onChange={handleChange}
                placeholder="수정/삭제용 비밀번호"
                minLength={4}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
          </div>

          {/* 이미지 업로드 (여러 장) - 주보게시판, 성도게시판, 기관게시판, 공지사항 게시판 */}
          {(() => {
            const currentCategory = categories?.find(c => c.category_id === formData.category_id);
            const allowedCategories = ['bulletin', 'member', 'organization', 'notice'];
            if (currentCategory && allowedCategories.includes(currentCategory.category_code)) {
              return (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {currentCategory?.category_code === 'bulletin' ? (
                      <>주보 이미지 <span className="text-rose-500">*</span></>
                    ) : (
                      <>이미지 첨부</>
                    )}
                    {imageFiles.length > 0 && (
                      <span className="ml-2 text-xs text-slate-500">({imageFiles.length}장 선택됨)</span>
                    )}
                  </label>

                  {/* 이미지 미리보기 - 드래그 가능 (모달 가로의 30% 크기) */}
                  {imageFiles.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-4">
                      {imageFiles.map((imageItem, index) => (
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
                            onClick={() => handleRemoveImage(index)}
                            className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            title="이미지 제거"
                          >
                            <X size={14} />
                          </button>
                          {/* 회전 버튼 */}
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
                      onChange={handleImageChange}
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
                    <div className="mt-2 text-sm text-teal-600">이미지 업로드 중... ({imageFiles.length}장)</div>
                  )}
                </div>
              );
            }
            return null;
          })()}

          {/* 태그 선택 (기관게시판 및 성도게시판) */}
          {(() => {
            const currentCategory = categories?.find(c => c.category_id === formData.category_id);
            if (currentCategory?.category_code === 'organization' || currentCategory?.category_code === 'member') {
              const canManageTags = user && hasRole(user, 'admin', 'super-admin');
              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      태그
                    </label>
                    {canManageTags && (
                      <button
                        type="button"
                        onClick={() => setShowTagManagementModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                        title="태그 관리"
                      >
                        <Settings size={14} />
                        태그 관리
                      </button>
                    )}
                  </div>
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
              {loading ? '작성 중...' : '작성하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // React Portal을 사용하여 body에 직접 렌더링
  if (!isOpen) return null;

  return (
    <>
      {createPortal(modalContent, document.body)}

      {/* 태그 관리 모달 */}
      <TagManagementModal
        isOpen={showTagManagementModal}
        onClose={() => setShowTagManagementModal(false)}
        onUpdate={async () => {
          // 태그 목록 다시 로드 및 정렬
          await loadAvailableTags();
        }}
      />

      {/* 닫기 확인 모달 */}
      <AlertModal
        isOpen={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        title="작성 중인 내용이 있습니다"
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

export default PostWriteModal;

