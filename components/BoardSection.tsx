// 게시판 섹션 컴포넌트
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Plus, Search, Calendar, Eye, User, PlusCircle, Trash2, X, Settings } from 'lucide-react';
import { getCategories, getPosts, BoardCategory, Post, deletePostAsAdmin, getTags, Tag } from '../services/boardApi';
import PostWriteModal from './PostWriteModal';
import PostDetailModal from './PostDetailModal';
import SurveySection from './SurveySection';
import { getUserInfo, hasRole, User as UserType } from '../services/authApi';
import AlertModal from './AlertModal';
import TagManagementModal from './TagManagementModal';

const BoardSection: React.FC = () => {
  const [categories, setCategories] = useState<BoardCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [memberBoardSubTab, setMemberBoardSubTab] = useState<'member' | 'organization' | 'survey'>('member');
  const [posts, setPosts] = useState<Post[]>([]);
  const postsRef = useRef<Post[]>([]); // 백그라운드 갱신 시 최신 posts 참조용
  const isFetchingRef = useRef(false); // 백그라운드 갱신 중복 방지용 (느린 인터넷 대응)
  const [loading, setLoading] = useState(false);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<UserType | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]); // 선택된 태그 배열
  const [availableTags, setAvailableTags] = useState<Tag[]>([]); // 사용 가능한 태그 목록
  const [showTagManagementModal, setShowTagManagementModal] = useState(false); // 태그 관리 모달 표시 여부
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    postId: number | null;
    postTitle: string;
  }>({
    isOpen: false,
    postId: null,
    postTitle: ''
  });
  const [deleting, setDeleting] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    message: string;
  }>({
    isOpen: false,
    message: ''
  });

  // 사용자 정보 로드 및 로그인 상태 변경 감지
  useEffect(() => {
    const userInfo = getUserInfo();
    setUser(userInfo);

    // 로그인 상태 변경 감지를 위한 이벤트 리스너 (다른 탭에서 변경)
    const handleStorageChange = () => {
      const updatedUserInfo = getUserInfo();
      if (updatedUserInfo !== userInfo) {
        setUser(updatedUserInfo);
        // 권한이 없어지면 태그관리 모달 닫기
        const stillCanManage = updatedUserInfo && hasRole(updatedUserInfo, 'admin', 'super-admin');
        if (!stillCanManage && showTagManagementModal) {
          setShowTagManagementModal(false);
        }
        // 로그인 상태가 변경되면 카테고리 정보 갱신
        const refreshCategories = async () => {
          try {
            const data = await getCategories();
            setCategories(data);
          } catch (error) {
            console.error('카테고리 갱신 오류:', error);
          }
        };
        refreshCategories();
      }
    };

    // storage 이벤트 리스너 (다른 탭에서 로그인/로그아웃 시)
    window.addEventListener('storage', handleStorageChange);

    // 로그아웃 이벤트 감지 (같은 탭에서 로그아웃)
    const handleLogout = () => {
      setUser(null);
      if (showTagManagementModal) {
        setShowTagManagementModal(false);
      }
      // 로그인 상태가 변경되면 카테고리 정보 갱신
      const refreshCategories = async () => {
        try {
          const data = await getCategories();
          setCategories(data);
        } catch (error) {
          console.error('카테고리 갱신 오류:', error);
        }
      };
      refreshCategories();
    };
    window.addEventListener('auth:logout', handleLogout);

    // 주기적으로 사용자 정보 확인 (같은 탭에서 로그인/로그아웃 시)
    const userCheckInterval = setInterval(() => {
      const currentUserInfo = getUserInfo();
      const currentUserStr = JSON.stringify(currentUserInfo);
      const previousUserStr = JSON.stringify(userInfo);

      // 사용자 정보가 실제로 변경된 경우에만 업데이트
      if (currentUserStr !== previousUserStr) {
        setUser(currentUserInfo);
        // 권한이 없어지면 태그관리 모달 닫기
        const stillCanManage = currentUserInfo && hasRole(currentUserInfo, 'admin', 'super-admin');
        if (!stillCanManage && showTagManagementModal) {
          setShowTagManagementModal(false);
        }
        // 로그인 상태가 변경되면 카테고리 정보 갱신 (사용자 정보가 변경된 경우에만)
        // 백그라운드에서 확인하고 변경사항이 있을 때만 업데이트
        const refreshCategories = async () => {
          try {
            const data = await getCategories();
            // 카테고리 정보가 실제로 변경된 경우에만 업데이트 (글 개수 및 카테고리 자체 비교)
            setCategories(prevCategories => {
              // 카테고리 개수나 ID가 변경되었는지 확인
              if (prevCategories.length !== data.length) {
                return data;
              }

              // 각 카테고리의 글 개수 비교
              const prevCounts = prevCategories.map(c => ({ id: c.category_id, count: c.post_count || 0 })).sort((a, b) => a.id - b.id);
              const newCounts = data.map(c => ({ id: c.category_id, count: c.post_count || 0 })).sort((a, b) => a.id - b.id);
              const countsChanged = JSON.stringify(prevCounts) !== JSON.stringify(newCounts);

              // 변경사항이 있을 때만 업데이트 (깜박임 방지)
              return countsChanged ? data : prevCategories;
            });

          } catch (error) {
            console.error('카테고리 갱신 오류:', error);
            // 에러 발생 시에도 화면은 변경하지 않음
          }
        };
        refreshCategories();
      }
    }, 30000); // 30초마다 사용자 정보 확인

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth:logout', handleLogout);
      clearInterval(userCheckInterval);
    };
  }, [showTagManagementModal]);

  // 카테고리 로드
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(data);
        if (data.length > 0 && !selectedCategory) {
          setSelectedCategory(data[0].category_id);
        }
      } catch (error) {
        console.error('카테고리 로드 오류:', error);
      }
    };

    // 초기 로드
    loadCategories();
  }, [user]); // user가 변경되면 다시 로드 (로그인/로그아웃 시)

  // 게시글 로드 (categories는 의존성에서 제거하여 카테고리 갱신 시 글 목록이 다시 로드되지 않도록 함)
  useEffect(() => {
    if (selectedCategory) {
      loadPosts();
    }
  }, [selectedCategory, currentPage, memberBoardSubTab, selectedTags]); // selectedTags 의존성 추가

  // 백그라운드에서 글 목록 주기적 갱신 (30초마다, 변경사항이 있을 때만 화면 업데이트)
  useEffect(() => {
    // 게시글 작성/수정, 상세 보기, 태그 관리, 삭제 모달이 열려있거나 카테고리가 없으면 갱신 중단
    // 사용자가 글을 작성하거나 수정하는 동안 화면이 갱신되어 작업이 방해받는 것을 방지
    if (!selectedCategory || showWriteModal || showDetailModal || showTagManagementModal || deleteModal.isOpen) return;

    const refreshInterval = setInterval(async () => {
      // 이미 갱신 중이면 스킵 (느린 인터넷 환경 대응)
      // 네트워크 속도가 느려 이전 요청이 끝나지 않았는데 새로운 요청이 쌓이는 것을 방지
      if (isFetchingRef.current) return;

      isFetchingRef.current = true;
      try {
        // 최신 categories를 가져오기 위해 함수 내부에서 참조
        const latestCategories = categories;

        // 성도전용게시판 내부 탭에 따라 카테고리 필터링
        let categoryIdToLoad = selectedCategory;
        const currentCategory = latestCategories.find(c => c.category_id === selectedCategory);
        if (currentCategory?.category_code === 'member' && memberBoardSubTab === 'organization') {
          const orgCategory = latestCategories.find(c => c.category_code === 'organization');
          if (orgCategory) {
            categoryIdToLoad = orgCategory.category_id;
          }
        }

        // 백그라운드에서 최신 글 목록 가져오기 (loading 상태 변경 없음)
        const result = await getPosts(categoryIdToLoad || selectedCategory || undefined, currentPage, 20, selectedTags.length > 0 ? selectedTags : undefined);

        // 현재 글 목록과 비교하여 변경사항 확인 (ref를 사용하여 최신 값 참조)
        const currentPosts = postsRef.current;

        // JSON 문자열 비교를 통해 데이터가 완전히 동일한지 확인
        // 이는 데이터가 변경되지 않았을 때 불필요한 setPosts 호출을 막아 불필요한 리렌더링(깜빢임)을 방지합니다.
        // 기존의 필드별 비교보다 더 정확하고 효율적입니다.
        const isDataChanged = JSON.stringify(currentPosts) !== JSON.stringify(result.posts);

        if (isDataChanged) {
          // 변경사항이 있을 때만 업데이트
          postsRef.current = result.posts;
          setPosts(result.posts);
          setTotalPages(result.pagination.totalPages);
        }
      } catch (error) {
        console.error('백그라운드 글 목록 갱신 오류:', error);
        // 에러 발생 시에도 화면은 변경하지 않음
      } finally {
        isFetchingRef.current = false;
      }
    }, 30000); // 30초마다 갱신

    return () => {
      clearInterval(refreshInterval);
    };
  }, [selectedCategory, currentPage, memberBoardSubTab, selectedTags, categories, showWriteModal, showDetailModal, showTagManagementModal, deleteModal.isOpen]);

  // 태그 목록 로드 함수 (재사용 가능하도록 분리)
  const loadTagsForBoard = useCallback(async () => {
    try {
      const currentCategory = categories.find(c => c.category_id === selectedCategory);

      // 기관게시판 또는 성도게시판이 선택된 경우 태그 로드
      const isOrgBoard = (currentCategory?.category_code === 'organization') ||
        (currentCategory?.category_code === 'member' && memberBoardSubTab === 'organization');
      const isMemberBoard = (currentCategory?.category_code === 'member' && memberBoardSubTab === 'member');

      if (isOrgBoard || isMemberBoard) {
        // 각 게시판별로 태그를 독립적으로 로드
        const categoryCode = isOrgBoard ? 'organization' : 'member';
        const tags = await getTags(categoryCode);

        // 태그 정렬: 항상 display_order 순서로만 정렬 (태그관리 순서)
        // display_order는 1부터 시작 (0 사용 금지)
        const sortedTags = [...tags].sort((a, b) => {
          const orderA = parseInt(String(a.display_order)) || 0;
          const orderB = parseInt(String(b.display_order)) || 0;
          // 0 이하의 값은 999999로 처리하여 맨 뒤로 배치
          const finalOrderA = orderA < 1 ? 999999 : orderA;
          const finalOrderB = orderB < 1 ? 999999 : orderB;
          return finalOrderA - finalOrderB; // 오름차순 정렬
        });

        setAvailableTags(sortedTags);
      } else {
        setAvailableTags([]);
        setSelectedTags([]); // 태그 지원 게시판이 아니면 태그 필터 초기화
      }
    } catch (error) {
      console.error('태그 목록 로드 오류:', error);
      setAvailableTags([]);
    }
  }, [selectedCategory, memberBoardSubTab, categories]);

  // 기관게시판 및 성도게시판일 때 태그 목록 로드 (각 게시판별로 독립적으로)
  useEffect(() => {
    if (selectedCategory && categories.length > 0) {
      loadTagsForBoard();
    }
  }, [selectedCategory, memberBoardSubTab, categories, loadTagsForBoard]);

  // 게시글 읽은 후 게시글 목록 갱신 (PostDetailModal의 onUpdate 콜백)
  const handlePostUpdate = async () => {
    // 게시글 목록 갱신 (조회수 업데이트 반영)
    loadPosts();
    // 카테고리 정보 갱신 (글 개수 업데이트 - 삭제 시 반영)
    try {
      const updatedCategories = await getCategories();
      setCategories(updatedCategories);
    } catch (error) {
      console.error('카테고리 갱신 오류:', error);
    }
    // 태그 정렬은 display_order 순서로 고정이므로 갱신 불필요
  };

  const loadPosts = async (skipLoading = false) => {
    if (!skipLoading) {
      setLoading(true);
    }
    try {
      // 성도전용게시판 내부 탭에 따라 카테고리 필터링
      let categoryIdToLoad = selectedCategory;
      if (selectedCategory) {
        const currentCategory = categories.find(c => c.category_id === selectedCategory);
        if (currentCategory?.category_code === 'member' && memberBoardSubTab === 'organization') {
          // 기관 게시판 탭 선택 시 기관 게시판 카테고리로 변경
          const orgCategory = categories.find(c => c.category_code === 'organization');
          if (orgCategory) {
            categoryIdToLoad = orgCategory.category_id;
          }
        } else if (currentCategory?.category_code === 'member' && memberBoardSubTab === 'member') {
          // 성도 게시판 탭 선택 시 성도전용게시판 카테고리 유지
          categoryIdToLoad = selectedCategory;
        }
      }

      const result = await getPosts(categoryIdToLoad || selectedCategory || undefined, currentPage, 20, selectedTags.length > 0 ? selectedTags : undefined);
      setPosts(result.posts);
      postsRef.current = result.posts; // ref도 업데이트
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      console.error('게시글 로드 오류:', error);
      setPosts([]);
    } finally {
      if (!skipLoading) {
        setLoading(false);
      }
    }
  };

  // 날짜 포맷팅 함수
  const formatDate = (dateString: string) => {
    // 한국 시간대(Asia/Seoul) 기준으로 날짜 생성
    const date = new Date(dateString);
    const today = new Date();

    // 한국 시간대 기준으로 날짜만 추출 (시간 제외)
    const koreaTimeZone = 'Asia/Seoul';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: koreaTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    // 날짜 문자열을 YYYY-MM-DD 형식으로 변환하여 비교
    const formatDateOnly = (d: Date) => {
      const parts = formatter.formatToParts(d);
      const year = parts.find(p => p.type === 'year')?.value || '';
      const month = parts.find(p => p.type === 'month')?.value || '';
      const day = parts.find(p => p.type === 'day')?.value || '';
      return `${year}-${month}-${day}`;
    };

    const dateOnly = formatDateOnly(date);
    const todayOnly = formatDateOnly(today);

    // 날짜 차이 계산 (밀리초 단위로 변환하여 계산)
    const dateObj = new Date(dateOnly + 'T00:00:00+09:00');
    const todayObj = new Date(todayOnly + 'T00:00:00+09:00');
    const diffTime = todayObj.getTime() - dateObj.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Seoul'
      });
    } else if (diffDays === 1) {
      return '어제';
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else {
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Seoul'
      });
    }
  };

  // 삭제 버튼 클릭 핸들러
  const handleDeleteClick = (e: React.MouseEvent, post: Post) => {
    e.stopPropagation(); // 게시글 클릭 이벤트 방지
    setDeleteModal({
      isOpen: true,
      postId: post.post_id,
      postTitle: post.title
    });
  };

  // 삭제 확인 핸들러
  const handleDeleteConfirm = async () => {
    if (!deleteModal.postId) return;

    setDeleting(true);
    try {
      await deletePostAsAdmin(deleteModal.postId);
      setDeleteModal({ isOpen: false, postId: null, postTitle: '' });
      // 게시글 목록 갱신
      loadPosts();
      // 카테고리 정보 갱신 (글 개수 업데이트)
      try {
        const updatedCategories = await getCategories();
        setCategories(updatedCategories);
      } catch (error) {
        console.error('카테고리 갱신 오류:', error);
      }
      // 태그 정렬은 display_order 순서로 고정이므로 갱신 불필요
    } catch (error: any) {
      setDeleteModal({ isOpen: false, postId: null, postTitle: '' });
      setErrorModal({
        isOpen: true,
        message: error.message || '게시글 삭제에 실패했습니다.'
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="py-24 bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* 섹션 헤더 */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 mb-4 bg-teal-50 rounded-full text-teal-600 shadow-sm">
            <MessageSquare size={28} />
          </div>
          <h2 className="text-4xl font-serif font-bold text-slate-800 mb-4">게시판</h2>
          <p className="text-slate-600">교회 소식과 성도들의 이야기를 나누는 공간입니다</p>
        </div>

        {/* 카테고리 탭 */}
        <div className="flex flex-wrap gap-3 mb-8 justify-center">
          {categories.map((category) => {
            // 기관 게시판은 메인 탭에서 숨김 (성도전용게시판 내부 탭으로만 접근)
            if (category.category_code === 'organization') {
              return null;
            }

            // 성도 전용 게시판 접근 권한 체크
            const isPrivate = category.is_private === true || category.is_private === 1;
            const isAdmin = user && hasRole(user, 'admin', 'super-admin');
            const isMember = user && (user.is_member === true || user.is_member === 1); // null 체크 후 is_member 확인
            const canAccessPrivate = isAdmin || isMember; // 관리자 이상이거나 교인 등록 사용자
            const isDisabled = isPrivate && !canAccessPrivate; // 성도 전용이고 접근 권한이 없으면 비활성화
            const isMemberBoard = category.category_code === 'member';

            // 성도전용게시판인 경우 성도게시판과 기관게시판의 글 개수 합계 계산
            let displayPostCount = category.post_count;
            if (isMemberBoard) {
              const orgCategory = categories.find(c => c.category_code === 'organization');
              const memberPostCount = category.post_count || 0;
              const orgPostCount = orgCategory?.post_count || 0;
              displayPostCount = memberPostCount + orgPostCount;
            }

            return (
              <div key={category.category_id} className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    if (!isDisabled) {
                      setSelectedCategory(category.category_id);
                      setCurrentPage(1);
                      // 성도전용게시판 선택 시 기본 탭 설정 및 태그 선택 초기화
                      if (isMemberBoard) {
                        setMemberBoardSubTab('member');
                        setSelectedTags([]);
                      }
                    }
                  }}
                  disabled={isDisabled}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 relative ${isDisabled
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                    : selectedCategory === category.category_id || (isMemberBoard && (selectedCategory === categories.find(c => c.category_code === 'organization')?.category_id))
                      ? 'bg-teal-500 text-white shadow-lg scale-105'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-teal-300 hover:bg-teal-50'
                    }`}
                  title={isDisabled ? '성도전용 게시판입니다. 관리자 권한 이상이거나 교인으로 등록된 사용자만 이용할 수 있습니다.' : undefined}
                >
                  <span className="flex items-center gap-2 relative">
                    {category.category_name}
                    {/* 글 수 표시 */}
                    {displayPostCount !== undefined && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${selectedCategory === category.category_id || (isMemberBoard && (selectedCategory === categories.find(c => c.category_code === 'organization')?.category_id))
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-600'
                        }`}>
                        {displayPostCount}
                      </span>
                    )}
                    {/* 열쇠 아이콘 (텍스트 뒤) */}
                    {(category.is_private === true || category.is_private === 1) && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isDisabled
                        ? 'bg-slate-200 text-slate-500'
                        : selectedCategory === category.category_id || (isMemberBoard && (selectedCategory === categories.find(c => c.category_code === 'organization')?.category_id))
                          ? 'bg-white/20 text-white'
                          : 'bg-rose-100 text-rose-600'
                        }`}>
                        🔒
                      </span>
                    )}
                  </span>
                </button>

                {/* 성도전용게시판 내부 탭 (성도전용게시판이 선택되었거나 기관게시판이 선택되었을 때 표시) */}
                {isMemberBoard && !isDisabled && (() => {
                  const orgCategory = categories.find(c => c.category_code === 'organization');
                  const isMemberSelected = selectedCategory === category.category_id;
                  const isOrgSelected = orgCategory && selectedCategory === orgCategory.category_id;
                  return (isMemberSelected || isOrgSelected) && (
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => {
                          setMemberBoardSubTab('member');
                          setCurrentPage(1);
                          setSelectedTags([]); // 태그 선택 초기화
                          // 성도전용게시판 카테고리 선택 유지
                          setSelectedCategory(category.category_id);
                          // 태그 목록 갱신 (다음 틱에서 실행)
                          setTimeout(() => {
                            loadTagsForBoard();
                          }, 0);
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${memberBoardSubTab === 'member'
                          ? 'bg-teal-400 text-white shadow-md'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        성도 게시판
                      </button>
                      <button
                        onClick={() => {
                          setMemberBoardSubTab('organization');
                          setCurrentPage(1);
                          setSelectedTags([]); // 태그 선택 초기화
                          // 기관 게시판 카테고리로 변경
                          if (orgCategory) {
                            setSelectedCategory(orgCategory.category_id);
                          }
                          // 태그 목록 갱신 (다음 틱에서 실행)
                          setTimeout(() => {
                            loadTagsForBoard();
                          }, 0);
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${memberBoardSubTab === 'organization'
                          ? 'bg-teal-400 text-white shadow-md'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        기관 게시판
                      </button>
                      <button
                        onClick={() => {
                          setMemberBoardSubTab('survey');
                          setCurrentPage(1);
                          // 설문조사 탭 선택 시 성도전용게시판 카테고리 유지
                          setSelectedCategory(category.category_id);
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${memberBoardSubTab === 'survey'
                          ? 'bg-teal-400 text-white shadow-md'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        설문조사
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* 설문조사 탭일 때 SurveySection 표시 */}
        {(() => {
          const currentCategory = categories.find(c => c.category_id === selectedCategory);
          if (currentCategory?.category_code === 'member' && memberBoardSubTab === 'survey') {
            return <SurveySection />;
          }
          return null;
        })()}

        {/* 게시판 컨테이너 (설문조사 탭이 아닐 때만 표시) */}
        {(() => {
          const currentCategory = categories.find(c => c.category_id === selectedCategory);
          if (currentCategory?.category_code === 'member' && memberBoardSubTab === 'survey') {
            return null;
          }
          return (
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">

              {/* 게시판 헤더 */}
              <div className="bg-gradient-to-r from-teal-500 to-blue-500 p-4 md:p-6">
                {/* 모바일: 세로 배치, 데스크톱: 가로 배치 */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-4">
                  {/* 첫 번째 줄: 제목, 총 개수, 글쓰기 버튼 (모바일에서 모든 게시판) */}
                  <div className="flex flex-wrap items-center gap-2 md:gap-3 text-white">
                    <div className="flex items-center gap-2 md:gap-3">
                      <MessageSquare size={20} className="md:w-6 md:h-6" />
                      <h3 className="text-lg md:text-xl font-bold">
                        {categories.find(c => c.category_id === selectedCategory)?.category_name}
                      </h3>
                      <span className="px-2 md:px-3 py-1 bg-white/20 rounded-full text-xs md:text-sm whitespace-nowrap">
                        총 {posts.length}개
                      </span>
                    </div>

                    {/* 모바일에서 글쓰기 버튼 (모든 게시판 제목 줄 마지막에 표시) */}
                    {(() => {
                      const currentCategory = categories.find(c => c.category_id === selectedCategory);
                      const isOrgBoard = (currentCategory?.category_code === 'organization') ||
                        (currentCategory?.category_code === 'member' && memberBoardSubTab === 'organization');
                      const isMemberBoard = (currentCategory?.category_code === 'member' && memberBoardSubTab === 'member');

                      // 공지사항 게시판은 관리자 이상만 작성 가능
                      if (currentCategory?.category_code === 'notice') {
                        if (!user || !hasRole(user, 'admin', 'super-admin')) {
                          return (
                            <button
                              disabled
                              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-white/50 text-slate-400 rounded-xl text-sm font-semibold cursor-not-allowed whitespace-nowrap ml-auto"
                              title="공지사항 게시판은 관리자 권한 이상이 필요합니다."
                            >
                              <PlusCircle size={16} />
                              <span className="hidden xs:inline">글쓰기</span>
                            </button>
                          );
                        }
                        // 공지사항 게시판이고 권한이 있으면 글쓰기 버튼 표시
                        return (
                          <button
                            onClick={() => setShowWriteModal(true)}
                            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-white text-teal-600 rounded-xl text-sm font-semibold hover:bg-teal-50 transition-all shadow-md whitespace-nowrap ml-auto"
                          >
                            <PlusCircle size={16} />
                            <span className="hidden xs:inline">글쓰기</span>
                          </button>
                        );
                      }

                      // 주보게시판은 담당자 이상만 작성 가능
                      if (currentCategory?.category_code === 'bulletin') {
                        if (!user || !hasRole(user, 'manager', 'admin', 'super-admin')) {
                          return (
                            <button
                              disabled
                              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-white/50 text-slate-400 rounded-xl text-sm font-semibold cursor-not-allowed whitespace-nowrap ml-auto"
                              title="주보게시판은 담당자 권한 이상이 필요합니다."
                            >
                              <PlusCircle size={16} />
                              <span className="hidden xs:inline">글쓰기</span>
                            </button>
                          );
                        }
                        // 주보게시판이고 권한이 있으면 글쓰기 버튼 표시
                        return (
                          <button
                            onClick={() => setShowWriteModal(true)}
                            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-white text-teal-600 rounded-xl text-sm font-semibold hover:bg-teal-50 transition-all shadow-md whitespace-nowrap ml-auto"
                          >
                            <PlusCircle size={16} />
                            <span className="hidden xs:inline">글쓰기</span>
                          </button>
                        );
                      }

                      // 성도게시판/기관게시판
                      if (isOrgBoard || isMemberBoard) {
                        return (
                          <button
                            onClick={() => setShowWriteModal(true)}
                            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-white text-teal-600 rounded-xl text-sm font-semibold hover:bg-teal-50 transition-all shadow-md whitespace-nowrap ml-auto"
                          >
                            <PlusCircle size={16} />
                            <span className="hidden xs:inline">글쓰기</span>
                          </button>
                        );
                      }

                      // 자유게시판, 기도요청 등 기타 게시판
                      const canWrite = currentCategory && (
                        currentCategory.category_code === 'free' || // 자유게시판은 로그인 없이 가능
                        (user && (
                          !currentCategory.is_private || // 성도전용이 아니거나
                          hasRole(user, 'manager', 'admin', 'super-admin') // manager 이상 권한
                        ))
                      );

                      if (!canWrite && currentCategory?.is_private) {
                        return (
                          <button
                            disabled
                            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-white/50 text-slate-400 rounded-xl text-sm font-semibold cursor-not-allowed whitespace-nowrap ml-auto"
                            title="성도전용 게시판입니다. 로그인이 필요합니다."
                          >
                            <PlusCircle size={16} />
                            <span className="hidden xs:inline">글쓰기</span>
                          </button>
                        );
                      }

                      return (
                        <button
                          onClick={() => setShowWriteModal(true)}
                          className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-white text-teal-600 rounded-xl text-sm font-semibold hover:bg-teal-50 transition-all shadow-md whitespace-nowrap ml-auto"
                        >
                          <PlusCircle size={16} />
                          <span className="hidden xs:inline">글쓰기</span>
                        </button>
                      );
                    })()}
                  </div>

                  {/* 태그 목록 (기관게시판 및 성도게시판일 때 표시) - 모바일: 타이틀 밑에, 데스크톱: 중간 영역 */}
                  {(() => {
                    const currentCategory = categories.find(c => c.category_id === selectedCategory);
                    const orgCategory = categories.find(c => c.category_code === 'organization');
                    const isOrgBoard = (currentCategory?.category_code === 'organization') ||
                      (currentCategory?.category_code === 'member' && memberBoardSubTab === 'organization');
                    const isMemberBoard = (currentCategory?.category_code === 'member' && memberBoardSubTab === 'member');
                    const canManageTags = user && hasRole(user, 'admin', 'super-admin');

                    if ((isOrgBoard || isMemberBoard) && (availableTags.length > 0 || canManageTags)) {
                      return (
                        <div className="w-full md:flex-1 md:flex md:flex-wrap gap-1.5 md:justify-center md:items-center min-w-0 md:px-4 overflow-x-auto md:overflow-x-visible">
                          <div className="flex gap-1.5 md:flex-wrap md:justify-center items-center min-w-max md:min-w-0">
                            {/* 태그관리 버튼 (모바일: 태그 목록 앞, 데스크톱: 태그 목록 앞) */}
                            {canManageTags && (
                              <button
                                onClick={() => setShowTagManagementModal(true)}
                                className="px-2 md:px-3 py-1 md:py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-xs md:text-sm font-semibold transition-colors shadow-md flex items-center gap-1 md:gap-1.5 whitespace-nowrap flex-shrink-0"
                                title="태그 관리"
                              >
                                <Settings size={12} className="md:w-3.5 md:h-3.5" />
                                <span className="hidden sm:inline">태그관리</span>
                              </button>
                            )}
                            {availableTags.map((tag) => {
                              const isSelected = selectedTags.includes(tag.tag_name);
                              return (
                                <button
                                  key={tag.tag_id}
                                  onClick={() => {
                                    if (isSelected) {
                                      // 이미 선택된 태그면 제거
                                      setSelectedTags(prev => prev.filter(t => t !== tag.tag_name));
                                    } else {
                                      // 선택되지 않은 태그면 추가
                                      setSelectedTags(prev => [...prev, tag.tag_name]);
                                    }
                                    setCurrentPage(1);
                                  }}
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all shadow-sm hover:shadow-md whitespace-nowrap flex-shrink-0 ${isSelected
                                    ? 'ring-2 ring-white ring-offset-1 ring-offset-teal-500 scale-105'
                                    : 'opacity-90 hover:opacity-100'
                                    }`}
                                  style={{
                                    backgroundColor: isSelected ? tag.tag_color : `${tag.tag_color}cc`,
                                    color: '#ffffff',
                                    border: isSelected ? '2px solid white' : '1px solid rgba(255,255,255,0.3)'
                                  }}
                                >
                                  {tag.tag_name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* 오른쪽 영역: 글쓰기 버튼 (데스크톱만 표시) */}
                  <div className="hidden md:block flex-shrink-0">
                    {(() => {
                      const currentCategory = categories.find(c => c.category_id === selectedCategory);

                      // 공지사항 게시판은 관리자 이상만 작성 가능
                      if (currentCategory?.category_code === 'notice') {
                        if (!user || !hasRole(user, 'admin', 'super-admin')) {
                          return (
                            <button
                              disabled
                              className="flex items-center gap-2 px-5 py-2.5 bg-white/50 text-slate-400 rounded-xl font-semibold cursor-not-allowed"
                              title="공지사항 게시판은 관리자 권한 이상이 필요합니다."
                            >
                              <PlusCircle size={20} />
                              글쓰기
                            </button>
                          );
                        }
                        // 공지사항 게시판이고 권한이 있으면 글쓰기 버튼 표시
                        return (
                          <button
                            onClick={() => setShowWriteModal(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white text-teal-600 rounded-xl font-semibold hover:bg-teal-50 transition-all shadow-md hover:shadow-lg"
                          >
                            <PlusCircle size={20} />
                            글쓰기
                          </button>
                        );
                      }

                      // 주보게시판은 담당자 이상만 작성 가능
                      if (currentCategory?.category_code === 'bulletin') {
                        if (!user || !hasRole(user, 'manager', 'admin', 'super-admin')) {
                          return (
                            <button
                              disabled
                              className="flex items-center gap-2 px-5 py-2.5 bg-white/50 text-slate-400 rounded-xl font-semibold cursor-not-allowed"
                              title="주보게시판은 담당자 권한 이상이 필요합니다."
                            >
                              <PlusCircle size={20} />
                              글쓰기
                            </button>
                          );
                        }
                        // 주보게시판이고 권한이 있으면 글쓰기 버튼 표시
                        return (
                          <button
                            onClick={() => setShowWriteModal(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white text-teal-600 rounded-xl font-semibold hover:bg-teal-50 transition-all shadow-md hover:shadow-lg"
                          >
                            <PlusCircle size={20} />
                            글쓰기
                          </button>
                        );
                      }

                      const canWrite = currentCategory && (
                        currentCategory.category_code === 'free' || // 자유게시판은 로그인 없이 가능
                        (user && (
                          !currentCategory.is_private || // 성도전용이 아니거나
                          hasRole(user, 'manager', 'admin', 'super-admin') // manager 이상 권한
                        ))
                      );

                      if (!canWrite && currentCategory?.is_private) {
                        return (
                          <button
                            disabled
                            className="flex items-center gap-2 px-5 py-2.5 bg-white/50 text-slate-400 rounded-xl font-semibold cursor-not-allowed"
                            title="성도전용 게시판입니다. 로그인이 필요합니다."
                          >
                            <PlusCircle size={20} />
                            글쓰기
                          </button>
                        );
                      }

                      return (
                        <button
                          onClick={() => setShowWriteModal(true)}
                          className="flex items-center gap-2 px-5 py-2.5 bg-white text-teal-600 rounded-xl font-semibold hover:bg-teal-50 transition-all shadow-md hover:shadow-lg"
                        >
                          <PlusCircle size={20} />
                          글쓰기
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* 검색 바 */}
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="flex gap-2 max-w-md mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      type="text"
                      placeholder="제목, 내용으로 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          loadPosts();
                        }
                      }}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={loadPosts}
                    className="px-5 py-2.5 bg-teal-500 text-white rounded-lg font-semibold hover:bg-teal-600 transition-colors"
                  >
                    검색
                  </button>
                </div>
              </div>

              {/* 게시글 목록 */}
              <div className="divide-y divide-slate-100">
                {loading ? (
                  <div className="p-16 text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mb-4"></div>
                    <p className="text-slate-500">게시글을 불러오는 중...</p>
                  </div>
                ) : posts.length === 0 ? (
                  <div className="p-16 text-center text-slate-400">
                    <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-lg">아직 게시글이 없습니다</p>
                    <p className="text-sm mt-2">첫 번째 게시글을 작성해보세요!</p>
                  </div>
                ) : (
                  posts.map((post) => (
                    <div
                      key={post.post_id}
                      onClick={() => {
                        setSelectedPostId(post.post_id);
                        setShowDetailModal(true);
                      }}
                      className="p-5 hover:bg-slate-50 transition-colors cursor-pointer group relative"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {post.is_notice && (
                              <span className="px-2 py-0.5 bg-rose-500 text-white text-xs font-bold rounded">
                                공지
                              </span>
                            )}
                            <h4 className="text-lg font-bold text-slate-800 group-hover:text-teal-600 transition-colors truncate">
                              {post.title}
                            </h4>
                            {(post.comment_count > 0 || (post as any).comment_count > 0) && (
                              <span className="text-teal-500 font-semibold text-sm">
                                [{(post.comment_count || (post as any).comment_count)}]
                              </span>
                            )}
                          </div>
                          {/* 태그 표시 (기관게시판 및 성도게시판) */}
                          {(post.category_code === 'organization' || post.category_code === 'member') && post.tags && post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {post.tags.map((tagName: string, index: number) => (
                                <span
                                  key={index}
                                  className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-medium"
                                >
                                  {tagName}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-sm text-slate-500">
                            <div className="flex items-center gap-1">
                              <User size={14} />
                              <span>{post.author_name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar size={14} />
                              <span>{formatDate(post.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Eye size={14} />
                              <span>{post.view_count}</span>
                            </div>
                            {/* 이모티콘 반응 표시 */}
                            {post.reactions && (() => {
                              const emojiMap: Record<string, string> = {
                                like: '👍',
                                love: '❤️',
                                haha: '😂',
                                wow: '😮',
                                sad: '😢'
                              };

                              // 반응이 있는 이모티콘만 필터링하고 개수 순으로 정렬
                              const reactionsWithCount = Object.entries(post.reactions as Record<string, number>)
                                .filter(([_, count]) => (count as number) > 0)
                                .sort(([_, a], [__, b]) => (b as number) - (a as number))
                                .slice(0, 3); // 최대 3개만 표시

                              if (reactionsWithCount.length > 0) {
                                return (
                                  <div className="flex items-center gap-1">
                                    <span className="flex items-center gap-1">
                                      {reactionsWithCount.map(([type, count]) => (
                                        <span key={type} className="flex items-center gap-0.5" title={`${emojiMap[type]} ${count}개`}>
                                          <span className="text-base">{emojiMap[type]}</span>
                                          <span className="text-xs">{count}</span>
                                        </span>
                                      ))}
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                        {/* 관리자 권한 이상일 때 삭제 버튼 표시 */}
                        {user && hasRole(user, 'admin', 'super-admin') && (
                          <button
                            onClick={(e) => handleDeleteClick(e, post)}
                            className="opacity-0 group-hover:opacity-100 p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                            title="게시글 삭제"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="p-6 bg-slate-50 flex justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-4 py-2 rounded-lg font-semibold transition-colors ${currentPage === page
                        ? 'bg-teal-500 text-white'
                        : 'bg-white border border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* 글쓰기 모달 */}
        <PostWriteModal
          isOpen={showWriteModal}
          onClose={() => setShowWriteModal(false)}
          categories={categories}
          selectedCategoryId={selectedCategory || categories[0]?.category_id || 1}
          initialSelectedTags={selectedTags} // 게시판에서 선택된 태그 전달
          onSuccess={async () => {
            // 게시글 목록 갱신
            loadPosts();
            setCurrentPage(1);
            // 카테고리 정보 갱신 (글 개수 업데이트)
            try {
              const updatedCategories = await getCategories();
              setCategories(updatedCategories);
            } catch (error) {
              console.error('카테고리 갱신 오류:', error);
            }
            // 태그 정렬은 display_order 순서로 고정이므로 갱신 불필요
          }}
        />

        {/* 게시글 상세 보기 모달 */}
        {selectedPostId && (
          <PostDetailModal
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedPostId(null);
            }}
            postId={selectedPostId}
            onUpdate={handlePostUpdate}
          />
        )}

        {/* 삭제 확인 모달 */}
        <AlertModal
          isOpen={deleteModal.isOpen}
          onClose={() => !deleting && setDeleteModal({ isOpen: false, postId: null, postTitle: '' })}
          title="게시글 삭제"
          message={`정말로 "${deleteModal.postTitle}" 게시글을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`}
          type="warning"
          confirmText={deleting ? "삭제 중..." : "삭제"}
          showCancel={!deleting}
          cancelText="취소"
          onConfirm={handleDeleteConfirm}
        />

        {/* 에러 모달 */}
        <AlertModal
          isOpen={errorModal.isOpen}
          onClose={() => setErrorModal({ isOpen: false, message: '' })}
          title="삭제 실패"
          message={errorModal.message}
          type="error"
          confirmText="확인"
        />

        {/* 태그 관리 모달 */}
        <TagManagementModal
          isOpen={showTagManagementModal}
          onClose={() => setShowTagManagementModal(false)}
          onUpdate={async () => {
            // 태그 목록 다시 로드 및 정렬 (삭제 시 즉시 반영)
            await loadTagsForBoard();
          }}
        />
      </div>
    </section>
  );
};

export default BoardSection;

