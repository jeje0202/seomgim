// 사진첩 섹션 컴포넌트
// [한글 코멘트] React 훅(useState, useEffect) 및 페이징 네비게이션 아이콘 모듈 불러오기
import React, { useState, useEffect } from 'react';
import { Camera, PlusCircle, Trash2, Edit2, Eye, Calendar, User, X, RotateCw, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Search } from 'lucide-react';
import { getAlbums, getAlbumDetail, deleteAlbum, createAlbum, updateAlbum, uploadPhotos, Album, AlbumDetail } from '../services/albumApi';
import { getUserInfo, hasRole, User as UserType } from '../services/authApi';
import AlertModal from './AlertModal';
import ImageViewerModal from './ImageViewerModal';
import { createPortal } from 'react-dom';
import { useModalBackButton } from '../hooks/useModalBackButton';

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
  const [searchQuery, setSearchQuery] = useState('');
  // [한글 코멘트] 사용자 요청: 앨범 실시간 디바운스(300ms) 검색을 위한 상태
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [showImageViewer, setShowImageViewer] = useState(false);
  const [imageViewerImages, setImageViewerImages] = useState<string[]>([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  // [한글 코멘트] 사용자 요청: 페이지네이션 클릭 시 앨범 목록 상단 자동 스크롤을 위한 Ref
  const sectionTopRef = React.useRef<HTMLDivElement>(null);
  const isFirstRender = React.useRef(true);

  useEffect(() => {
    loadAlbums();
    const userInfo = getUserInfo();
    setUser(userInfo);

    // [한글 코멘트] 페이징 버튼 클릭으로 페이지 전환 시 앨범 목록 상단으로 부드럽게 스크롤 이동
    if (isFirstRender.current) {
      isFirstRender.current = false;
    } else {
      if (sectionTopRef.current) {
        sectionTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [currentPage, debouncedSearch]);

  const loadAlbums = async () => {
    setLoading(true);
    try {
      console.log('앨범 목록 로드 시작...', { page: currentPage, search: debouncedSearch });
      const data = await getAlbums({ page: currentPage, limit: 12, search: debouncedSearch });
      console.log('앨범 목록 로드 성공:', {
        albumsCount: data.albums.length,
        totalPages: data.pagination.totalPages
      });
      setAlbums(data.albums);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('앨범 목록 로드 오류:', error);
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
    <div id="album-section-top" ref={sectionTopRef} className="bg-slate-50 py-24 scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center p-3 mb-4 bg-rose-50 rounded-full text-rose-500 shadow-sm">
            <Camera size={28} />
          </div>
          <h2 className="text-4xl font-serif font-bold text-slate-800 mb-4">은혜의 순간들</h2>
          <p className="text-slate-600 text-lg">창원섬김의교회의 소중한 추억과 은혜의 순간들을 담은 사진첩입니다</p>

          {/* [한글 코멘트] 사용자 요청: 앨범 실시간 검색 입력창 & X 지우기 버튼 */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-xl mx-auto">
            <div className="relative w-full max-w-md">
              <input
                type="text"
                placeholder="앨범 제목 또는 설명 검색..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-9 py-2.5 bg-white text-slate-800 placeholder-slate-400 rounded-full text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent shadow-sm transition-all"
              />
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setDebouncedSearch('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                  title="검색어 지우기"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* 로그인한 사용자만 작성 버튼 표시 */}
            {user && (
              <button
                onClick={() => setShowWriteModal(true)}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-rose-500 text-white rounded-full font-semibold hover:bg-rose-600 transition-all shadow-md hover:shadow-lg shrink-0"
              >
                <PlusCircle size={18} />
                앨범 작성
              </button>
            )}
          </div>
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

            {/* [한글 코멘트] 사용자 요청: << (최신 1페이지), < (이전), 숫자 번호, > (다음), >> (처음/마지막페이지) 페이징 UI */}
            {totalPages > 1 && (
              <div className="mt-12 flex justify-center items-center gap-1.5">
                {/* << 최신 페이지 (1페이지) 이동 */}
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  title="가장 최신 페이지 (1페이지)"
                  className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronsLeft size={18} />
                </button>

                {/* < 이전 페이지 이동 */}
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  title="이전 페이지"
                  className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors mr-1"
                >
                  <ChevronLeft size={18} />
                </button>

                {/* 숫자 번호 버튼 목록 */}
                {(() => {
                  const pages = [];
                  const maxVisible = 5;
                  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                  let end = Math.min(totalPages, start + maxVisible - 1);

                  if (end - start + 1 < maxVisible) {
                    start = Math.max(1, end - maxVisible + 1);
                  }

                  for (let i = start; i <= end; i++) {
                    pages.push(i);
                  }

                  return (
                    <div className="flex items-center gap-1.5">
                      {start > 1 && (
                        <>
                          <button
                            onClick={() => setCurrentPage(1)}
                            className="w-9 h-9 rounded-lg font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            1
                          </button>
                          {start > 2 && <span className="px-1 text-slate-400">...</span>}
                        </>
                      )}

                      {pages.map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-9 h-9 rounded-lg font-semibold transition-all ${
                            currentPage === page
                              ? 'bg-rose-500 text-white shadow-md scale-105'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {page}
                        </button>
                      ))}

                      {end < totalPages && (
                        <>
                          {end < totalPages - 1 && <span className="px-1 text-slate-400">...</span>}
                          <button
                            onClick={() => setCurrentPage(totalPages)}
                            className="w-9 h-9 rounded-lg font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* > 다음 페이지 이동 */}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  title="다음 페이지"
                  className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ml-1"
                >
                  <ChevronRight size={18} />
                </button>

                {/* >> 가장 처음/오래된 페이지 이동 */}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  title={`가장 처음 페이지 (${totalPages}페이지)`}
                  className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronsRight size={18} />
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

      {/* [한글 코멘트] 사용자 요청: 이미지 뷰어에 앨범 제목 및 단위('장') 전달 */}
      {showImageViewer && (
        <ImageViewerModal
          isOpen={showImageViewer}
          onClose={() => setShowImageViewer(false)}
          images={imageViewerImages}
          initialIndex={imageViewerIndex}
          title={selectedAlbum ? selectedAlbum.title : '은혜의 순간들'}
          unit="장"
        />
      )}
    </div>
  );
};

// [한글 코멘트] 앨범 상세 모달 컴포넌트 (PC/모바일 전체화면 풀스크린 뷰어 적용)
interface AlbumDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: AlbumDetail;
  onImageClick: (index: number, photos: Array<{ photo_url: string; thumbnail_url?: string }>) => void;
}

const AlbumDetailModal: React.FC<AlbumDetailModalProps> = ({
  isOpen,
  onClose,
  album,
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
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 mb-2 sm:mb-3 truncate">{album.title}</h2>
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
            <span>총 {album.photos.length}장의 사진</span>
          </div>
        </div>
      </div>

      {/* 스크롤 가능한 본문 영역 (사진 그리드 - 화면 가득 채움) */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-12 py-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          {/* 사진 그리드 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
            {album.photos.map((photo, index) => (
              <div
                key={photo.photo_id}
                className="relative aspect-square bg-slate-200 rounded-xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
                onClick={() => onImageClick(index, album.photos)}
              >
                <img
                  src={photo.thumbnail_url || photo.photo_url}
                  alt={photo.description || `사진 ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
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
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// [한글 코멘트] 앨범 편집 모달 컴포넌트 (PC/모바일 전체화면 풀스크린 적용)
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
  // [한글 코멘트] 모바일 뒤로 가기 버튼으로 모달 닫기 지원
  useModalBackButton({ isOpen, onClose });

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // [한글 코멘트] 앨범 수정 사진 파일 처리 공통 함수
  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    if (photos.length + files.length > 50) {
      setError('최대 50장까지 업로드할 수 있습니다.');
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

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
  };

  // [한글 코멘트] 사용자 요청: 앨범 수정 모달 클립보드 이미지 붙여넣기(Ctrl+V) 처리
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        const items = e.clipboardData?.items;
        let hasImage = false;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
              hasImage = true;
              break;
            }
          }
        }
        if (!hasImage) return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            const ext = item.type.split('/')[1] || 'png';
            const file = new File([blob], `pasted-image-${Date.now()}-${i}.${ext}`, { type: item.type });
            pastedFiles.push(file);
          }
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        await processFiles(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isOpen, photos]);

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

      {/* 헤더 영역 - 고정 */}
      <div className="flex-shrink-0 px-4 sm:px-8 md:px-12 pt-6 md:pt-8 pb-4 border-b border-slate-200 relative bg-white pr-16 md:pr-24 shadow-sm">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800">앨범 편집</h2>
      </div>

      {/* 스크롤 가능한 본문 영역 */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-12 py-6 bg-slate-50">
        <div className="max-w-5xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/80">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
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
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm md:text-base"
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
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none text-sm md:text-base"
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

              {/* 사진 미리보기 - 드래그 가능 그리드 */}
              {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
                  {photos.map((photo, index) => (
                    <div
                      key={index}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className="relative group cursor-move bg-slate-100 rounded-xl p-1.5 border border-slate-200"
                    >
                      <img
                        src={photo.preview}
                        alt={`사진 ${index + 1}`}
                        className="w-full aspect-square object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute top-2.5 right-2.5 p-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md cursor-pointer"
                        title="삭제"
                      >
                        <X size={14} />
                      </button>
                      <input
                        type="text"
                        placeholder="사진 설명"
                        value={photo.description}
                        onChange={(e) => handlePhotoDescriptionChange(index, e.target.value)}
                        className="mt-1.5 w-full px-2 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-rose-500"
                      />
                      <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 사진 추가 버튼 (드래그 앤 드롭 지원) */}
              <div
                className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all ${isDragging
                  ? 'border-rose-500 bg-rose-50 scale-[1.01]'
                  : 'border-slate-300 hover:border-rose-500 bg-slate-50/50'
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
                  className="cursor-pointer flex flex-col items-center gap-2.5"
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-rose-200' : 'bg-rose-100'
                    }`}>
                    <Camera size={26} className="text-rose-600" />
                  </div>
                  <span className={`text-sm sm:text-base transition-colors ${isDragging ? 'text-rose-600 font-semibold' : 'text-slate-700 font-medium'
                    }`}>
                    {isDragging ? '여기에 사진을 놓으세요' : '사진을 선택하거나 드래그, 또는 복사한 사진을 붙여넣기(Ctrl+V)하세요'}
                  </span>
                  {/* [한글 코멘트] 앨범 수정 안내 텍스트: 최대 50장, 개별 5MB 및 초과시 자동 리사이징/압축 표기 */}
                  <span className="text-xs text-slate-500">최대 50장, 파일당 5MB 한도 (5MB 초과 원본은 5MB 이하로 자동 압축)</span>
                  <span className="text-xs text-slate-400">여러 파일을 동시에 선택, 드래그, 또는 Ctrl+V로 붙여넣을 수 있습니다</span>
                </label>
              </div>
              {uploading && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-rose-600 font-medium">
                  <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>사진 업로드 중...</span>
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading || uploading}
                className="flex-1 px-6 py-3 bg-rose-500 text-white rounded-xl font-semibold hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md"
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

// [한글 코멘트] 앨범 작성 모달 컴포넌트 (PC/모바일 전체화면 풀스크린 적용)
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
  // [한글 코멘트] 모바일 뒤로 가기 버튼으로 모달 닫기 지원
  useModalBackButton({ isOpen, onClose });

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

    // [한글 코멘트] 사용자 요청: 앨범 신규 작성 시 최대 50장까지 사진 첨부 허용
    const currentCount = photos.length;
    const newCount = files.length;
    if (currentCount + newCount > 50) {
      setError(`최대 50장까지 업로드 가능합니다. (현재 ${currentCount}장, 추가 ${newCount}장)`);
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

  // [한글 코멘트] 사용자 요청: 앨범 신규 작성 모달 클립보드 이미지 붙여넣기(Ctrl+V) 처리
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        const items = e.clipboardData?.items;
        let hasImage = false;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
              hasImage = true;
              break;
            }
          }
        }
        if (!hasImage) return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            const ext = item.type.split('/')[1] || 'png';
            const file = new File([blob], `pasted-image-${Date.now()}-${i}.${ext}`, { type: item.type });
            pastedFiles.push(file);
          }
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        await processFiles(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isOpen, photos]);

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

      {/* 헤더 영역 - 고정 */}
      <div className="flex-shrink-0 px-4 sm:px-8 md:px-12 pt-6 md:pt-8 pb-4 border-b border-slate-200 relative bg-white pr-16 md:pr-24 shadow-sm">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800">앨범 작성</h2>
      </div>

      {/* 스크롤 가능한 본문 영역 */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-12 py-6 bg-slate-50">
        <div className="max-w-5xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/80">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
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
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm md:text-base"
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
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none text-sm md:text-base"
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

              {/* 사진 미리보기 - 드래그 가능 그리드 */}
              {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
                  {photos.map((photo, index) => (
                    <div
                      key={index}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className="relative group cursor-move bg-slate-100 rounded-xl p-1.5 border border-slate-200"
                    >
                      <img
                        src={photo.preview}
                        alt={`사진 ${index + 1}`}
                        className="w-full aspect-square object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute top-2.5 right-2.5 p-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md cursor-pointer"
                        title="삭제"
                      >
                        <X size={14} />
                      </button>
                      {/* 회전 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleRotatePhoto(index)}
                        disabled={rotatingIndex === index}
                        className="absolute top-2.5 left-2.5 p-1 bg-blue-500 hover:bg-blue-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer"
                        title="90도 회전"
                      >
                        {rotatingIndex === index ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <RotateCw size={13} />
                        )}
                      </button>
                      <input
                        type="text"
                        placeholder="사진 설명"
                        value={photo.description}
                        onChange={(e) => handlePhotoDescriptionChange(index, e.target.value)}
                        className="mt-1.5 w-full px-2 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-rose-500"
                      />
                      <div className="absolute bottom-10 left-2.5 bg-black/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 사진 추가 버튼 (드래그 앤 드롭 지원) */}
              <div
                className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all ${isDragging
                  ? 'border-rose-500 bg-rose-50 scale-[1.01]'
                  : 'border-slate-300 hover:border-rose-500 bg-slate-50/50'
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
                  className="cursor-pointer flex flex-col items-center gap-2.5"
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-rose-200' : 'bg-rose-100'
                    }`}>
                    <Camera size={26} className="text-rose-600" />
                  </div>
                  <span className={`text-sm sm:text-base transition-colors ${isDragging ? 'text-rose-600 font-semibold' : 'text-slate-700 font-medium'
                    }`}>
                    {isDragging ? '여기에 사진을 놓으세요' : '사진을 선택하거나 드래그, 또는 복사한 사진을 붙여넣기(Ctrl+V)하세요'}
                  </span>
                  {/* [한글 코멘트] 앨범 작성 안내 텍스트: 최대 50장, 개별 5MB 및 초과시 자동 리사이징/압축 표기 */}
                  <span className="text-xs text-slate-500">최대 50장, 파일당 5MB 한도 (5MB 초과 원본은 5MB 이하로 자동 압축)</span>
                  <span className="text-xs text-slate-400">여러 파일을 동시에 선택, 드래그, 또는 Ctrl+V로 붙여넣을 수 있습니다</span>
                </label>
              </div>
              {uploading && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-rose-600 font-medium">
                  <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>사진 업로드 중...</span>
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading || uploading}
                className="flex-1 px-6 py-3 bg-rose-500 text-white rounded-xl font-semibold hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md"
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

