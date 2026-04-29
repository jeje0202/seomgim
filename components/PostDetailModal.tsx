// 게시글 상세 보기 모달 컴포넌트
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Calendar, Eye, MessageSquare, Edit, Trash2 } from 'lucide-react';
import { getPostDetail, PostDetail, createComment, deleteComment, toggleReaction, ReactionType, PostReactions } from '../services/boardApi';
import { getUserInfo, hasRole, getCurrentUser } from '../services/authApi';
import PostEditModal from './PostEditModal';
import PostDeleteModal from './PostDeleteModal';
import CommentDeleteModal from './CommentDeleteModal';
import ImageViewerModal from './ImageViewerModal';
import { useModalBackButton } from '../hooks/useModalBackButton';
import { linkifyText, linkifyHTML } from '../utils/textUtils';

interface PostDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: number;
  onUpdate: () => void;
}

const PostDetailModal: React.FC<PostDetailModalProps> = ({
  isOpen,
  onClose,
  postId,
  onUpdate
}) => {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [commentForm, setCommentForm] = useState({
    content: '',
    author_name: '',
    author_password: ''
  });
  const [submittingComment, setSubmittingComment] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(getUserInfo());
  const [showCommentDeleteModal, setShowCommentDeleteModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState<{ id: number; author: string } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [imageViewerImages, setImageViewerImages] = useState<string[]>([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  // ESC 키로 모달 닫기 (다른 서브 모달이 열려있지 않을 때만)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showEditModal && !showDeleteModal && !showImageViewer && !showCommentDeleteModal) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, showEditModal, showDeleteModal, showImageViewer, showCommentDeleteModal]);

  useEffect(() => {
    if (isOpen && postId) {
      loadPost();
      // 모달이 열릴 때마다 사용자 정보 갱신 및 작성자 이름 자동 입력
      const fetchUser = async () => {
        const userInfo = await getCurrentUser(); // 서버에서 최신 사용자 정보 가져오기
        setUser(userInfo);
        
        // 로그인한 상태이면 작성자 이름 자동 입력 (닉네임 우선)
        if (userInfo) {
          setCommentForm(prev => ({
            ...prev,
            author_name: userInfo.nickname || userInfo.name || ''
          }));
        } else {
          setCommentForm(prev => ({
            ...prev,
            author_name: ''
          }));
        }
      };
      fetchUser();
    }
  }, [isOpen, postId]);

  // 본문 내 인라인 이미지 클릭 이벤트 처리
  useEffect(() => {
    if (!isOpen || !post) return;

    const handleImageClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' && target.closest('.post-content')) {
        e.preventDefault();
        e.stopPropagation();
        
        // 본문 내 모든 이미지 수집
        const postContentDiv = document.querySelector('.post-content');
        if (!postContentDiv) return;
        
        const allImages = Array.from(postContentDiv.querySelectorAll('img'));
        const imageUrls = allImages.map(img => img.src);
        const clickedIndex = allImages.indexOf(target as HTMLImageElement);
        
        if (imageUrls.length > 0 && clickedIndex >= 0) {
          setImageViewerImages(imageUrls);
          setImageViewerIndex(clickedIndex);
          setShowImageViewer(true);
        }
      }
    };

    // 이벤트 위임을 사용하여 동적으로 추가된 이미지도 처리
    document.addEventListener('click', handleImageClick, true);
    
    return () => {
      document.removeEventListener('click', handleImageClick, true);
    };
  }, [isOpen, post]);

  const loadPost = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('[PostDetailModal] 📖 게시글 로드 시작 - postId:', postId);
      const data = await getPostDetail(postId);
      setPost(data);
      console.log('[PostDetailModal] ✅ 게시글 로드 완료 - postId:', postId, 'title:', data.title);
      
      // 게시글을 읽은 후 부모 컴포넌트에 알림 (게시글 목록 갱신을 위해)
      if (onUpdate) {
        onUpdate();
      }
    } catch (err: any) {
      console.error('[PostDetailModal] ❌ 게시글 로드 오류:', err);
      setError(err.message || '게시글을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post) return;

    setSubmittingComment(true);
    setError('');

    try {
      if (!commentForm.content.trim()) {
        setError('댓글 내용을 입력해주세요.');
        setSubmittingComment(false);
        return;
      }
      if (!commentForm.author_name.trim()) {
        setError('작성자 이름을 입력해주세요.');
        setSubmittingComment(false);
        return;
      }
      if (commentForm.author_password.length < 4) {
        setError('비밀번호는 4자 이상 입력해주세요.');
        setSubmittingComment(false);
        return;
      }

      await createComment({
        post_id: post.post_id,
        ...commentForm
      });

      // 댓글 폼 초기화 (작성자 이름은 로그인 상태면 유지)
      const userInfo = getUserInfo();
      setCommentForm({
        content: '',
        author_name: userInfo?.nickname || userInfo?.name || '',
        author_password: ''
      });

      // 게시글 다시 로드 (댓글 포함)
      await loadPost();
      onUpdate();
    } catch (err: any) {
      setError(err.message || '댓글 작성에 실패했습니다.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCommentDelete = async (password: string) => {
    if (!selectedComment) return;
    
    try {
      await deleteComment(selectedComment.id, password);
      // 게시글 다시 로드
      await loadPost();
      setShowCommentDeleteModal(false);
      setSelectedComment(null);
    } catch (err: any) {
      throw err;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Seoul' // 한국 시간대 적용
    });
  };

  // 모달이 열릴 때 body 스크롤 막기
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow || '';
      const originalPaddingRight = document.body.style.paddingRight || '';
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      
      return () => {
        // 모달이 닫힐 때 스크롤 복원
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    } else {
      // 모달이 닫혔을 때도 스크롤 복원 (안전장치)
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
  }, [isOpen]);

  // 모바일 뒤로 가기 버튼으로 모달 닫기
  useModalBackButton({ isOpen, onClose });

  if (!isOpen) return null;

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
      <div 
        className="bg-white rounded-3xl p-8 max-w-4xl w-full mx-4 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        style={{
          position: 'relative',
          margin: 'auto',
          maxHeight: '90vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 - 모달 외부 우측 상단 고정 */}
        <button
          onClick={onClose}
          className="fixed top-[5vh] right-[max(calc((100vw-56rem)/2+1rem),2rem)] w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors z-[10001] shadow-lg"
          aria-label="닫기 (ESC)"
          title="닫기 (ESC)"
        >
          <X size={24} className="text-white" />
        </button>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mb-4"></div>
            <p className="text-slate-500">게시글을 불러오는 중...</p>
          </div>
        ) : error && !post ? (
          <div className="text-center py-16">
            <p className="text-rose-500 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
            >
              닫기
            </button>
          </div>
        ) : post ? (
          <>
            {/* 게시글 헤더 */}
            <div className="mb-6 pr-16">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {post.is_notice && (
                    <span className="px-2 py-1 bg-rose-500 text-white text-xs font-bold rounded">
                      공지
                    </span>
                  )}
                  <span className="px-3 py-1 bg-teal-100 text-teal-700 text-xs font-bold rounded">
                    {post.category_name}
                  </span>
                </div>
                {/* 수정/삭제 버튼 - 자유게시판은 수정 불가, 공지사항은 관리자만 */}
                <div className="flex items-center gap-2">
                  {/* 자유게시판이 아닌 경우에만 수정 버튼 표시 */}
                  {post.category_code !== 'free' && (
                    <>
                      {/* 공지사항은 관리자 이상만 수정 가능 */}
                      {post.category_code === 'notice' ? (
                        user && hasRole(user, 'admin', 'super-admin') && (
                          <button
                            onClick={() => setShowEditModal(true)}
                            className="p-2 text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                            title="수정"
                          >
                            <Edit size={18} />
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => setShowEditModal(true)}
                          className="p-2 text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="수정"
                        >
                          <Edit size={18} />
                        </button>
                      )}
                    </>
                  )}
                  {/* 삭제 버튼 - 작성자 본인 또는 관리자만 표시 */}
                  {(() => {
                    // 관리자는 항상 삭제 가능
                    const isAdmin = user && hasRole(user, 'admin', 'super-admin');
                    // 작성자 본인 확인 (로그인한 사용자의 이름과 게시글 작성자 이름 비교)
                    const isAuthor = user && user.name === post.author_name;
                    
                    // 공지사항은 관리자만 삭제 가능
                    if (post.category_code === 'notice') {
                      if (isAdmin) {
                        return (
                          <button
                            onClick={() => setShowDeleteModal(true)}
                            className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <Trash2 size={18} />
                          </button>
                        );
                      }
                      return null;
                    }
                    
                    // 일반 게시판은 작성자 본인 또는 관리자만 삭제 가능
                    if (isAuthor || isAdmin) {
                      return (
                        <button
                          onClick={() => setShowDeleteModal(true)}
                          className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title={isAdmin ? "삭제 (관리자)" : "삭제"}
                        >
                          <Trash2 size={18} />
                        </button>
                      );
                    }
                    
                    return null;
                  })()}
                </div>
              </div>
              <h2 className="text-3xl font-bold text-slate-800 mb-4">{post.title}</h2>
              
              {/* 태그 표시 (기관게시판) */}
              {post.category_code === 'organization' && post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {post.tags.map((tagName, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-medium"
                    >
                      {tagName}
                    </span>
                  ))}
                </div>
              )}
              
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <div className="flex items-center gap-1">
                  <User size={16} />
                  <span>{post.author_name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar size={16} />
                  <span>{formatDate(post.created_at)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye size={16} />
                  <span>{post.view_count}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare size={16} />
                  <span>댓글 {post.comments?.length || 0}</span>
                </div>
              </div>
            </div>

            {/* 게시글 내용 */}
            <div className="mb-8 pb-8 border-b border-slate-200">
              {/* 주보게시판 이미지 표시 (여러 장) */}
              {post.image_url && (() => {
                // 이미지 클릭 핸들러
                const handleImageClick = (index: number, allImages: string[]) => {
                  setImageViewerImages(allImages);
                  setImageViewerIndex(index);
                  setShowImageViewer(true);
                };

                try {
                  // JSON 배열인지 확인
                  const imageUrls = JSON.parse(post.image_url);
                  if (Array.isArray(imageUrls) && imageUrls.length > 0) {
                    return (
                      <div className="mb-6 space-y-4">
                        {imageUrls.map((url: string, index: number) => (
                          <div key={index} className="relative cursor-pointer group" onClick={() => handleImageClick(index, imageUrls)}>
                            <img 
                              src={url.startsWith('http') ? url : url}
                              alt={`주보 이미지 ${index + 1}`} 
                              className="w-full rounded-lg shadow-md transition-transform group-hover:scale-[1.02]"
                              loading="lazy"
                              onError={(e) => {
                                console.error('이미지 로드 실패:', url);
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            {imageUrls.length > 1 && (
                              <div className="absolute top-2 left-2 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-semibold">
                                {index + 1} / {imageUrls.length}
                              </div>
                            )}
                            {/* 클릭 가능 표시 오버레이 */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 rounded-lg transition-colors flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-semibold bg-black/50 px-4 py-2 rounded-lg">
                                클릭하여 확대
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                } catch (e) {
                  // JSON이 아니면 단일 이미지로 처리
                }
                // 단일 이미지 처리 (기존 호환성)
                const singleImageUrl = post.image_url;
                return (
                  <div className="mb-6 cursor-pointer group relative" onClick={() => handleImageClick(0, [singleImageUrl])}>
                    <img 
                      src={singleImageUrl.startsWith('http') ? singleImageUrl : singleImageUrl}
                      alt="주보 이미지" 
                      className="w-full rounded-lg shadow-md transition-transform group-hover:scale-[1.02]"
                      loading="lazy"
                      onError={(e) => {
                        console.error('이미지 로드 실패:', singleImageUrl);
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    {/* 클릭 가능 표시 오버레이 */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 rounded-lg transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-semibold bg-black/50 px-4 py-2 rounded-lg">
                        클릭하여 확대
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div className="post-content max-w-none px-2 py-4 bg-white/50 rounded-lg border border-slate-100">
                <div
                  dangerouslySetInnerHTML={{ __html: linkifyHTML(post.content) }}
                  style={{
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}
                />
                <style>{`
                  .post-content img {
                    max-width: 100%;
                    height: auto;
                    display: block;
                    margin: 8px 0;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: transform 0.2s;
                  }
                  .post-content img:hover {
                    transform: scale(1.02);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                  }
                  .post-content .inline-image-wrapper {
                    display: inline-block;
                    margin: 8px 0;
                    vertical-align: middle;
                    border: none !important; /* 뷰어 모드에서는 테두리 숨김 */
                  }
                  .post-content .inline-image-wrapper img {
                    display: block;
                    margin: 0;
                  }
                  .post-content .image-size-control {
                    display: none !important;
                  }
                  .post-content .image-resize-handle {
                    display: none !important; /* 뷰어 모드에서는 리사이즈 핸들 숨김 */
                  }
                `}</style>
              </div>
            </div>

            {/* 이모티콘 반응 섹션 */}
            <div className="mb-8 pb-8 border-b border-slate-200">
              <div className="flex items-center gap-2 flex-wrap">
                {(['like', 'love', 'haha', 'wow', 'sad'] as ReactionType[]).map((reactionType) => {
                  const emojiMap: Record<ReactionType, string> = {
                    like: '👍',
                    love: '❤️',
                    haha: '😂',
                    wow: '😮',
                    sad: '😢'
                  };
                  
                  const labelMap: Record<ReactionType, string> = {
                    like: '좋아요',
                    love: '사랑해요',
                    haha: '웃겨요',
                    wow: '놀라워요',
                    sad: '슬퍼요'
                  };
                  
                  const count = post.reactions?.[reactionType] || 0;
                  const isActive = post.userReaction === reactionType;
                  
                  return (
                    <button
                      key={reactionType}
                      onClick={async () => {
                        try {
                          await toggleReaction(postId, reactionType);
                          // 게시글 다시 로드하여 반응 업데이트
                          await loadPost();
                        } catch (error: any) {
                          console.error('이모티콘 반응 오류:', error);
                          setError(error.message || '반응 추가에 실패했습니다.');
                        }
                      }}
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all
                        ${isActive 
                          ? 'bg-teal-50 border-teal-500 text-teal-700 shadow-md scale-105' 
                          : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300 hover:bg-teal-50'
                        }
                      `}
                      title={labelMap[reactionType]}
                    >
                      <span className="text-xl">{emojiMap[reactionType]}</span>
                      <span className="text-sm font-semibold">{labelMap[reactionType]}</span>
                      {count > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-teal-200 text-teal-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 댓글 섹션 */}
            <div>
              <h3 className="text-xl font-bold text-slate-800 mb-4">
                댓글 ({post.comments?.length || 0})
              </h3>

              {/* 댓글 목록 */}
              <div className="space-y-4 mb-6">
                {post.comments && post.comments.length > 0 ? (
                  post.comments.map(comment => (
                    <div key={comment.comment_id} className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-slate-400" />
                          <span className="font-semibold text-slate-700">{comment.author_name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">
                            {formatDate(comment.created_at)}
                          </span>
                          {/* 댓글 삭제 버튼 */}
                          <button
                            onClick={() => {
                              setSelectedComment({ id: comment.comment_id, author: comment.author_name });
                              setShowCommentDeleteModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="댓글 삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-slate-700 text-base whitespace-pre-wrap leading-relaxed font-normal">
                        {linkifyText(comment.content).map((part, index) => (
                          <React.Fragment key={index}>{part}</React.Fragment>
                        ))}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-center py-8">아직 댓글이 없습니다.</p>
                )}
              </div>

              {/* 댓글 작성 폼 */}
              <div className="bg-teal-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-800 mb-3">댓글 작성</h4>
                {(() => {
                  // 성도전용 게시판 체크
                  const isPrivateCategory = post.category_code === 'member';
                  const canComment = !isPrivateCategory || (user && hasRole(user, 'manager', 'admin', 'super-admin'));
                  
                  if (!canComment) {
                    return (
                      <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm text-center">
                        성도전용 게시판입니다. 로그인 후 댓글을 작성할 수 있습니다.
                      </div>
                    );
                  }
                  
                  return (
                    <>
                      {error && (
                        <div className="mb-3 p-2 bg-rose-50 border border-rose-200 rounded text-rose-600 text-sm">
                          {error}
                        </div>
                      )}
                      <form onSubmit={handleCommentSubmit} className="space-y-3">
                        <textarea
                          value={commentForm.content}
                          onChange={(e) => setCommentForm(prev => ({ ...prev, content: e.target.value }))}
                          placeholder="댓글을 입력하세요"
                          rows={3}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                          required
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={commentForm.author_name}
                            onChange={(e) => setCommentForm(prev => ({ ...prev, author_name: e.target.value }))}
                            placeholder="작성자 이름"
                            maxLength={50}
                            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                            required
                          />
                          <input
                            type="password"
                            value={commentForm.author_password}
                            onChange={(e) => setCommentForm(prev => ({ ...prev, author_password: e.target.value }))}
                            placeholder="비밀번호 (수정/삭제용)"
                            minLength={4}
                            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                            required
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={submittingComment}
                          className="w-full px-4 py-2 bg-teal-500 text-white rounded-lg font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50"
                        >
                          {submittingComment ? '작성 중...' : '댓글 작성'}
                        </button>
                      </form>
                    </>
                  );
                })()}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );

  // React Portal을 사용하여 body에 직접 렌더링
  return (
    <>
      {createPortal(modalContent, document.body)}
      
      {/* 게시글 수정 모달 */}
      {post && (
        <PostEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          post={post}
          onSuccess={() => {
            loadPost();
            onUpdate();
          }}
        />
      )}

      {/* 게시글 삭제 모달 */}
      {post && (
        <PostDeleteModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          post={post}
          onSuccess={() => {
            onUpdate();
            onClose();
          }}
        />
      )}

      {/* 댓글 삭제 모달 */}
      {selectedComment && (
        <CommentDeleteModal
          isOpen={showCommentDeleteModal}
          onClose={() => {
            setShowCommentDeleteModal(false);
            setSelectedComment(null);
          }}
          onConfirm={handleCommentDelete}
          commentAuthor={selectedComment.author}
        />
      )}

      {/* 이미지 뷰어 모달 */}
      <ImageViewerModal
        isOpen={showImageViewer}
        onClose={() => setShowImageViewer(false)}
        images={imageViewerImages}
        initialIndex={imageViewerIndex}
      />
    </>
  );
};

export default PostDetailModal;

