// 사진첩 섹션 컴포넌트
import React, { useState, useEffect } from 'react';
import { Camera, PlusCircle, Trash2, Edit2, Eye, Calendar, User, X, RotateCw } from 'lucide-react';
import { getAlbums, getAlbumDetail, deleteAlbum, createAlbum, updateAlbum, uploadPhotos, Album, AlbumDetail } from '../services/albumApi';
import { getUserInfo, hasRole, User as UserType } from '../services/authApi';
import AlertModal from './AlertModal';
import ImageViewerModal from './ImageViewerModal';
import { createPortal } from 'react-dom';

const AlbumSection: React.FC = () => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumDetail | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [editingAlbum, setEditingAlbum] = useState<AlbumDetail | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [imageViewerImages, setImageViewerImages] = useState<string[]>([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  useEffect(() => {
    loadAlbums();
    const userInfo = getUserInfo();
    setUser(userInfo);
  }, [currentPage]);

  const loadAlbums = async () => {
    setLoading(true);
    try {
      console.log('앨범 목록 로드 시작...', { page: currentPage });
      const data = await getAlbums({ page: currentPage, limit: 12 });
      console.log('앨범 목록 로드 성공:', {
        albumsCount: data.albums.length,
        totalPages: data.pagination.totalPages,
        albums: data.albums.map(a => ({ id: a.album_id, title: a.title, thumbnail: a.thumbnail }))
      });
      setAlbums(data.albums);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('앨범 목록 로드 오류:', error);
      console.error('에러 상세:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      setAlbums([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAlbumClick = async (albumId: number) => {
    try {
      const album = await getAlbumDetail(albumId);
      setSelectedAlbum(album);
      setShowDetailModal(true);
    } catch (error) {
      console.error('앨범 상세 조회 오류:', error);
    }
  };

  /* 1. handleImageClick 수정: 상세 보기에서는 원본 화질(photo_url) 우선 사용 */
  const handleImageClick = (index: number, photos: Array<{ photo_url: string; thumbnail_url?: string }>) => {
    // 마이그레이션 완료 후 photo_url 경로가 정상화되었으므로 원본 화질 우선 사용
    // (이전에는 반복 오류 해결을 위해 썸네일을 우선 사용했었음)
    const imageUrls = photos.map(p => p.photo_url || p.thumbnail_url);
    setImageViewerImages(imageUrls);
    setImageViewerIndex(index);
    setShowImageViewer(true);
  };

  const handleEditClick = async (albumId: number) => {
    try {
      const album = await getAlbumDetail(albumId);
      setEditingAlbum(album);
      setShowEditModal(true);
    } catch (error: any) {
      console.error('앨범 조회 오류:', error);
    }
  };

  const handleDeleteClick = (albumId: number) => {
    setSelectedAlbumId(albumId);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAlbumId) return;

    try {
      await deleteAlbum(selectedAlbumId);
      setShowDeleteModal(false);
      setSelectedAlbumId(null);
      loadAlbums();
    } catch (error: any) {
      console.error('앨범 삭제 오류:', error);
      alert(error.message || '앨범 삭제에 실패했습니다.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Seoul' // 한국 시간대 적용
    });
  };

  return (
    <div className="bg-slate-50 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center p-3 mb-4 bg-rose-50 rounded-full text-rose-500 shadow-sm">
            <Camera size={28} />
          </div>
          <h2 className="text-4xl font-serif font-bold text-slate-800 mb-4">은혜의 순간들</h2>
          <p className="text-slate-600 text-lg">창원섬김의교회의 소중한 추억과 은혜의 순간들을 담은 사진첩입니다</p>

          {/* 로그인한 사용자만 작성 버튼 표시 */}
          {user && (
            <div className="mt-6">
              <button
                onClick={() => setShowWriteModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-rose-500 text-white rounded-full font-semibold hover:bg-rose-600 transition-all shadow-md hover:shadow-lg"
              >
                <PlusCircle size={20} />
                앨범 작성
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mb-4"></div>
            <p className="text-slate-500">앨범을 불러오는 중...</p>
          </div>
        ) : albums.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Camera size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg">아직 등록된 앨범이 없습니다</p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {albums.map((album) => (
                <div
                  key={album.album_id}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md hover:border-rose-100 transition-all duration-300 cursor-pointer group"
                  onClick={() => handleAlbumClick(album.album_id)}
                >
                  {/* 썸네일 이미지 */}
                  <div className="relative aspect-video bg-slate-200 overflow-hidden">
                    {album.thumbnail ? (
                      <img
                        src={album.thumbnail}
                        alt={album.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/church_rainbow.jpg';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-50 to-pink-50">
                        <Camera size={48} className="text-rose-300" />
                      </div>
                    )}
                    {/* 편집/삭제 버튼 (관리자 이상 또는 작성자만) */}
                    {user && (hasRole(user, 'admin', 'super-admin') || (album.author_id && user.user_id === album.author_id)) && (
                      <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(album.album_id);
                          }}
                          className="p-2 bg-black/50 hover:bg-blue-500 text-white rounded-full transition-colors"
                          title="앨범 편집"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(album.album_id);
                          }}
                          className="p-2 bg-black/50 hover:bg-rose-500 text-white rounded-full transition-colors"
                          title="앨범 삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 앨범 정보 */}
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-2 line-clamp-2 group-hover:text-rose-500 transition-colors">
                      {album.title}
                    </h3>
                    {album.description && (
                      <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                        {album.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <User size={14} />
                        <span>{album.author_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* 이미지 개수 표시 */}
                        {album.photo_count !== undefined && album.photo_count > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-teal-50 text-teal-700 rounded-full">
                            <Camera size={12} />
                            <span className="font-semibold">{album.photo_count}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Eye size={14} />
                          <span>{album.view_count}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                      <Calendar size={12} />
                      <span>{formatDate(album.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="mt-12 flex justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  이전
                </button>
                <span className="px-4 py-2 text-slate-600">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 앨범 상세 모달 */}
      {selectedAlbum && (
        <AlbumDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedAlbum(null);
            loadAlbums(); // 조회수 반영을 위해 목록 갱신
          }}
          album={selectedAlbum}
          onImageClick={handleImageClick}
        />
      )}

      {/* 앨범 작성 모달 */}
      {user && (
        <AlbumWriteModal
          isOpen={showWriteModal}
          onClose={() => setShowWriteModal(false)}
          onSuccess={() => {
            loadAlbums();
            setShowWriteModal(false);
          }}
        />
      )}

      {/* 앨범 편집 모달 */}
      {editingAlbum && (
        <AlbumEditModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingAlbum(null);
          }}
          onSuccess={() => {
            loadAlbums();
            setShowEditModal(false);
            setEditingAlbum(null);
          }}
          album={editingAlbum}
        />
      )}

      {/* 삭제 확인 모달 */}
      <AlertModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedAlbumId(null);
        }}
        message="정말로 이 앨범을 삭제하시겠습니까?"
        type="warning"
        confirmText="삭제"
        onConfirm={handleDeleteConfirm}
        cancelText="취소"
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedAlbumId(null);
        }}
      />

      {/* 이미지 뷰어 모달 */}
      {showImageViewer && (
        <ImageViewerModal
          isOpen={showImageViewer}
          onClose={() => setShowImageViewer(false)}
          images={imageViewerImages}
          initialIndex={imageViewerIndex}
        />
      )}
    </div>
  );
};

// 앨범 상세 모달 컴포넌트
interface AlbumDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: AlbumDetail;
  onImageClick: (index: number, photos: Array<{ photo_url: string; thumbnail_url?: string }>) => void; // 타입 수정
}

const AlbumDetailModal: React.FC<AlbumDetailModalProps> = ({
  isOpen,
  onClose,
  album,
  onImageClick
}) => {
  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Seoul' // 한국 시간대 적용
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl relative w-[80vw] h-[80vh] flex flex-col overflow-hidden"
      >
        {/* 닫기 버튼 - 고정 위치 (모달 외부) */}
        <button
          onClick={onClose}
          className="fixed top-[10vh] right-[10vw] w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors z-[10002] shadow-lg"
          aria-label="닫기"
        >
          <X size={24} className="text-white" />
        </button>

        {/* 헤더 영역 - 고정 */}
        <div className="flex-shrink-0 px-8 pt-8 pb-4 border-b border-slate-200 relative">
          <h2 className="text-3xl font-bold text-slate-800 mb-4 pr-12">{album.title}</h2>
          {album.description && (
            <p className="text-slate-600 mb-4 pr-12">{album.description}</p>
          )}

          <div className="flex items-center gap-4 text-sm text-slate-500 mb-2 pr-12">
            <div className="flex items-center gap-2">
              <User size={16} />
              <span>{album.author_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              <span>{formatDate(album.created_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye size={16} />
              <span>조회 {album.view_count}</span>
            </div>
          </div>
        </div>

        {/* 스크롤 가능한 본문 영역 */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* 사진 그리드 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {album.photos.map((photo, index) => (
              <div
                key={photo.photo_id}
                className="relative aspect-square bg-slate-200 rounded-lg overflow-hidden cursor-pointer group"
                onClick={() => onImageClick(index, album.photos)}
              >
                {/* 2. AlbumDetailModal 수정: thumbnail_url 우선 사용 */}
                <img
                  src={photo.thumbnail_url || photo.photo_url}
                  alt={photo.description || `사진 ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/church_rainbow.jpg';
                  }}
                />
                {photo.description && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {photo.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// 앨범 편집 모달 컴포넌트
interface AlbumEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  album: AlbumDetail;
}

const AlbumEditModal: React.FC<AlbumEditModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  album
}) => {
  const [formData, setFormData] = useState({ title: album.title, description: album.description || '' });
  const [photos, setPhotos] = useState<Array<{ url: string; thumbnailUrl?: string; preview: string; description: string }>>(
    album.photos.map(p => ({
      url: p.photo_url,
      thumbnailUrl: p.thumbnail_url,
      preview: p.thumbnail_url || p.photo_url, // 썸네일이 있으면 썸네일 사용
      description: p.description || ''
    }))
  );
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 파일 개수 제한 체크
    if (photos.length + files.length > 20) {
      setError('최대 20장까지 업로드할 수 있습니다.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const uploadedPhotos = await uploadPhotos(Array.from(files));
      const newPhotos = uploadedPhotos.map(photo => ({
        url: photo.url, // 1080p 이미지 URL
        thumbnailUrl: photo.thumbnailUrl, // 썸네일 URL
        preview: photo.thumbnailUrl || photo.url, // 미리보기는 썸네일 사용
        description: ''
      }));
      setPhotos(prev => [...prev, ...newPhotos]);
    } catch (err: any) {
      setError(err.message || '사진 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }

    // 파일 입력 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newPhotos = [...photos];
    const draggedPhoto = newPhotos[draggedIndex];
    newPhotos.splice(draggedIndex, 1);
    newPhotos.splice(index, 0, draggedPhoto);

    setPhotos(newPhotos);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // 파일 드래그 앤 드롭
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return;

    if (photos.length + files.length > 20) {
      setError('최대 20장까지 업로드할 수 있습니다.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const uploadedPhotos = await uploadPhotos(files);
      const newPhotos = uploadedPhotos.map(photo => ({
        url: photo.url, // 1080p 이미지 URL
        thumbnailUrl: photo.thumbnailUrl, // 썸네일 URL
        preview: photo.thumbnailUrl || photo.url, // 미리보기는 썸네일 사용
        description: ''
      }));
      setPhotos(prev => [...prev, ...newPhotos]);
    } catch (err: any) {
      setError(err.message || '사진 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handlePhotoDescriptionChange = (index: number, description: string) => {
    setPhotos(prev => prev.map((photo, i) =>
      i === index ? { ...photo, description } : photo
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }

    if (photos.length === 0) {
      setError('최소 1장의 사진을 업로드해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await updateAlbum(album.album_id, {
        title: formData.title,
        description: formData.description || undefined,
        photos: photos.map(p => ({
          url: p.url, // 1080p 이미지 URL
          thumbnailUrl: (p as any).thumbnailUrl || undefined, // 썸네일 URL
          description: p.description || undefined
        }))
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || '앨범 수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // 사진 개수에 따른 그리드 열 수 계산
  const getGridCols = (count: number) => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 9) return 'grid-cols-3';
    if (count <= 16) return 'grid-cols-4';
    return 'grid-cols-5';
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl relative w-[80vw] h-[80vh] flex flex-col overflow-hidden"
      >
        {/* 닫기 버튼 - 고정 위치 (모달 외부) */}
        <button
          onClick={onClose}
          className="fixed top-[10vh] right-[10vw] w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors z-[10002] shadow-lg"
          aria-label="닫기"
        >
          <X size={24} className="text-white" />
        </button>

        {/* 헤더 영역 - 고정 */}
        <div className="flex-shrink-0 px-8 pt-8 pb-4 border-b border-slate-200 relative">
          <h2 className="text-2xl font-bold text-slate-800">앨범 편집</h2>
        </div>

        {/* 스크롤 가능한 본문 영역 */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
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
                placeholder="앨범 제목을 입력하세요"
                maxLength={200}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            {/* 설명 */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                설명
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="앨범 설명을 입력하세요 (선택사항)"
                rows={3}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
              />
            </div>

            {/* 사진 업로드 */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                사진 <span className="text-rose-500">*</span>
                {photos.length > 0 && (
                  <span className="ml-2 text-xs text-slate-500">({photos.length}장) - 드래그하여 순서 변경</span>
                )}
              </label>

              {/* 사진 미리보기 - 드래그 가능 (모달 가로의 30% 크기) */}
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-4">
                  {photos.map((photo, index) => (
                    <div
                      key={index}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className="relative group cursor-move"
                      style={{ width: 'calc(30% - 8px)', minWidth: '120px' }}
                    >
                      <img
                        src={photo.preview}
                        alt={`사진 ${index + 1}`}
                        className="w-full aspect-square object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={14} />
                      </button>
                      <input
                        type="text"
                        placeholder="사진 설명"
                        value={photo.description}
                        onChange={(e) => handlePhotoDescriptionChange(index, e.target.value)}
                        className="mt-1 w-full px-2 py-1 text-xs border border-slate-300 rounded"
                      />
                      <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 사진 추가 버튼 (드래그 앤 드롭 지원) */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${isDragging
                  ? 'border-rose-500 bg-rose-50 scale-105'
                  : 'border-slate-300 hover:border-rose-500'
                  }`}
                onDragEnter={handleDragEnter}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  multiple
                  onChange={handlePhotoChange}
                  className="hidden"
                  id="edit-photo-upload"
                  ref={fileInputRef}
                />
                <label
                  htmlFor="edit-photo-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-rose-200' : 'bg-rose-100'
                    }`}>
                    <Camera size={24} className="text-rose-600" />
                  </div>
                  <span className={`text-sm transition-colors ${isDragging ? 'text-rose-600 font-semibold' : 'text-slate-600'
                    }`}>
                    {isDragging ? '여기에 사진을 놓으세요' : '사진을 선택하거나 드래그하여 추가하세요'}
                  </span>
                  <span className="text-xs text-slate-400">최대 20장, 각 10MB (jpg, png, gif, webp)</span>
                  <span className="text-xs text-slate-400">여러 파일을 동시에 선택하거나 드래그할 수 있습니다</span>
                </label>
              </div>
              {uploading && (
                <div className="mt-2 text-sm text-rose-600">사진 업로드 중...</div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading || uploading}
                className="flex-1 px-6 py-3 bg-rose-500 text-white rounded-xl font-semibold hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '수정 중...' : '수정하기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

// 앨범 작성 모달 컴포넌트
interface AlbumWriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AlbumWriteModal: React.FC<AlbumWriteModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });
  const [photos, setPhotos] = useState<Array<{ url: string; description: string; file?: File; preview: string; originalFile?: File }>>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [rotatingIndex, setRotatingIndex] = useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({ title: '', description: '' });
      setPhotos([]);
      setError('');
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  // 파일 처리 공통 함수
  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    // 최대 20장 제한 체크
    const currentCount = photos.length;
    const newCount = files.length;
    if (currentCount + newCount > 20) {
      setError(`최대 20장까지 업로드 가능합니다. (현재 ${currentCount}장, 추가 ${newCount}장)`);
      return;
    }

    setUploading(true);
    setError('');

    try {
      const fileArray = Array.from(files);

      // 원본 파일 저장 (회전용)
      const fileMap = new Map<number, File>();
      fileArray.forEach((file, idx) => {
        fileMap.set(idx, file);
      });

      const uploadedPhotos = await uploadPhotos(fileArray);

      const newPhotos = uploadedPhotos.map((photo, idx) => ({
        url: photo.url, // 1080p 이미지 URL
        thumbnailUrl: photo.thumbnailUrl, // 썸네일 URL
        description: '',
        preview: photo.thumbnailUrl || photo.url, // 미리보기는 썸네일 사용
        originalFile: fileMap.get(idx) // 원본 파일 저장 (회전용)
      }));

      setPhotos(prev => [...prev, ...newPhotos]);
    } catch (err: any) {
      setError(err.message || '사진 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    await processFiles(files);
    e.target.value = ''; // 같은 파일 다시 선택 가능하도록 초기화
  };

  // 드래그 앤 드롭 핸들러
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // 파일 드래그 앤 드롭 핸들러 (파일 업로드 영역용)
  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handlePhotoDescriptionChange = (index: number, description: string) => {
    setPhotos(prev => prev.map((photo, i) =>
      i === index ? { ...photo, description } : photo
    ));
  };

  // 드래그 앤 드롭으로 사진 순서 변경 핸들러
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newPhotos = [...photos];
    const draggedPhoto = newPhotos[draggedIndex];
    newPhotos.splice(draggedIndex, 1);
    newPhotos.splice(index, 0, draggedPhoto);

    setPhotos(newPhotos);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // 이미지 회전 핸들러
  const handleRotatePhoto = async (index: number) => {
    const photo = photos[index];
    if (!photo.originalFile) {
      // 원본 파일이 없으면 현재 파일 사용 (이미 업로드된 경우)
      setError('이미지 회전을 위해 원본 파일이 필요합니다.');
      return;
    }

    setRotatingIndex(index);
    setError('');

    try {
      const { rotateImage90 } = await import('../utils/imageRotation');
      const rotatedFile = await rotateImage90(photo.originalFile);

      // 회전된 이미지를 다시 압축하여 업로드
      const uploadedPhotos = await uploadPhotos([rotatedFile]);
      const uploadedPhoto = uploadedPhotos[0];

      // 사진 목록 업데이트
      setPhotos(prev => prev.map((p, i) =>
        i === index ? {
          ...p,
          url: uploadedPhoto.url,
          thumbnailUrl: uploadedPhoto.thumbnailUrl,
          preview: uploadedPhoto.thumbnailUrl || uploadedPhoto.url,
          originalFile: rotatedFile // 회전된 파일을 새로운 원본으로 저장
        } : p
      ));
    } catch (err: any) {
      setError(err.message || '이미지 회전에 실패했습니다.');
    } finally {
      setRotatingIndex(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }

    if (photos.length === 0) {
      setError('최소 1장의 사진을 업로드해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createAlbum({
        title: formData.title,
        description: formData.description || undefined,
        photos: photos.map(p => ({
          url: p.url, // 1080p 이미지 URL
          thumbnailUrl: (p as any).thumbnailUrl || undefined, // 썸네일 URL
          description: p.description || undefined
        }))
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || '앨범 작성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // 사진 개수에 따른 그리드 열 수 계산
  const getGridCols = (count: number) => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 9) return 'grid-cols-3';
    if (count <= 16) return 'grid-cols-4';
    return 'grid-cols-5';
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl relative w-[80vw] h-[80vh] flex flex-col overflow-hidden"
      >
        {/* 닫기 버튼 - 고정 위치 (모달 외부) */}
        <button
          onClick={onClose}
          className="fixed top-[10vh] right-[10vw] w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors z-[10002] shadow-lg"
          aria-label="닫기"
        >
          <X size={24} className="text-white" />
        </button>

        {/* 헤더 영역 - 고정 */}
        <div className="flex-shrink-0 px-8 pt-8 pb-4 border-b border-slate-200 relative">
          <h2 className="text-2xl font-bold text-slate-800">앨범 작성</h2>
        </div>

        {/* 스크롤 가능한 본문 영역 */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
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
                placeholder="앨범 제목을 입력하세요"
                maxLength={200}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            {/* 설명 */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                설명
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="앨범 설명을 입력하세요 (선택사항)"
                rows={3}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
              />
            </div>

            {/* 사진 업로드 */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                사진 <span className="text-rose-500">*</span>
                {photos.length > 0 && (
                  <span className="ml-2 text-xs text-slate-500">({photos.length}장) - 드래그하여 순서 변경</span>
                )}
              </label>

              {/* 사진 미리보기 - 드래그 가능 (모달 가로의 30% 크기) */}
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-4">
                  {photos.map((photo, index) => (
                    <div
                      key={index}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className="relative group cursor-move"
                      style={{ width: 'calc(30% - 8px)', minWidth: '120px' }}
                    >
                      <img
                        src={photo.preview}
                        alt={`사진 ${index + 1}`}
                        className="w-full aspect-square object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={14} />
                      </button>
                      {/* 회전 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleRotatePhoto(index)}
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
                      <input
                        type="text"
                        placeholder="사진 설명"
                        value={photo.description}
                        onChange={(e) => handlePhotoDescriptionChange(index, e.target.value)}
                        className="mt-1 w-full px-2 py-1 text-xs border border-slate-300 rounded"
                      />
                      <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 사진 추가 버튼 (드래그 앤 드롭 지원) */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${isDragging
                  ? 'border-rose-500 bg-rose-50 scale-105'
                  : 'border-slate-300 hover:border-rose-500'
                  }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleFileDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handlePhotoChange}
                  className="hidden"
                  id="photo-upload"
                  multiple
                  ref={fileInputRef}
                />
                <label
                  htmlFor="photo-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-rose-200' : 'bg-rose-100'
                    }`}>
                    <Camera size={24} className="text-rose-600" />
                  </div>
                  <span className={`text-sm transition-colors ${isDragging ? 'text-rose-600 font-semibold' : 'text-slate-600'
                    }`}>
                    {isDragging ? '여기에 사진을 놓으세요' : '사진을 선택하거나 드래그하여 추가하세요'}
                  </span>
                  <span className="text-xs text-slate-400">최대 20장, 각 10MB (jpg, png, gif, webp)</span>
                  <span className="text-xs text-slate-400">여러 파일을 동시에 선택하거나 드래그할 수 있습니다</span>
                </label>
              </div>
              {uploading && (
                <div className="mt-2 text-sm text-rose-600">사진 업로드 중...</div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading || uploading}
                className="flex-1 px-6 py-3 bg-rose-500 text-white rounded-xl font-semibold hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '작성 중...' : '작성하기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AlbumSection;

