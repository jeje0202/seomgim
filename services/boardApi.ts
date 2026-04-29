// 게시판 API 서비스
// Nginx가 /api 경로를 프록시하므로 상대 경로 사용 (개발/프로덕션 모두 동일)
import { getToken } from './authApi';

const API_BASE_URL = '/api/board';

// 게시판 카테고리 타입
export interface BoardCategory {
  category_id: number;
  category_name: string;
  category_code: string;
  description: string;
  is_private: boolean;
  display_order: number;
  is_active: boolean;
  post_count?: number; // 총 글 수
  unread_count?: number; // 읽지 않은 글 수
}

// 게시글 타입
export interface Post {
  post_id: number;
  category_id: number;
  title: string;
  author_name: string;
  view_count: number;
  created_at: string;
  comment_count: number;
  is_notice: boolean;
  image_url?: string;
  category_name?: string;
  category_code?: string;
  reactions?: PostReactions;
  tags?: string[]; // 태그 배열 (기관게시판)
}

// 이모티콘 반응 타입
export interface PostReactions {
  like: number;
  love: number;
  haha: number;
  wow: number;
  sad: number;
}

export type ReactionType = 'like' | 'love' | 'haha' | 'wow' | 'sad';

// 게시글 상세 타입
export interface PostDetail extends Post {
  content: string;
  image_url?: string;
  comments: Comment[];
  reactions?: PostReactions;
  userReaction?: ReactionType | null;
  tags?: string[]; // 태그 배열 (기관게시판)
}

// 댓글 타입
export interface Comment {
  comment_id: number;
  post_id: number;
  content: string;
  author_name: string;
  created_at: string;
}

// API 응답 타입
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: any[];
}

// 게시판 카테고리 조회 (글 수 및 읽지 않은 글 수 포함)
export const getCategories = async (): Promise<BoardCategory[]> => {
  try {
    const token = getToken();
    const headers: HeadersInit = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const url = `${API_BASE_URL}/categories`;
    console.log('게시판 카테고리 API 호출:', { url, fullUrl: window.location.origin + url, hasToken: !!token });
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    });
    
    // Content-Type 확인 - HTML이 반환되면 프록시 문제
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text().catch(() => '');
      console.error('게시판 카테고리 API 오류: JSON이 아닌 응답 수신', { 
        status: response.status, 
        contentType,
        responsePreview: text.substring(0, 200)
      });
      throw new Error(`프록시 오류: API 서버에 연결할 수 없습니다. 백엔드 서버(포트 5000)가 실행 중인지 확인하세요.`);
    }
    
    const result: ApiResponse<BoardCategory[]> = await response.json();
    
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.message || '카테고리 조회 실패');
  } catch (error) {
    console.error('카테고리 조회 오류:', error);
    throw error;
  }
};

// 게시글 목록 조회
export const getPosts = async (
  categoryId?: number,
  page: number = 1,
  limit: number = 20,
  tags?: string[] // 태그 필터링 파라미터 (배열)
): Promise<{ posts: Post[]; pagination: any }> => {
  try {
    const params = new URLSearchParams();
    if (categoryId) params.append('category_id', categoryId.toString());
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    // 여러 태그를 쉼표로 구분하여 전달
    if (tags && tags.length > 0) {
      params.append('tag', tags.join(','));
    }
    
    const token = getToken();
    const headers: HeadersInit = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/posts?${params}`, {
      headers
    });
    const result: ApiResponse<{ posts: Post[]; pagination: any }> = await response.json();
    
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.message || '게시글 조회 실패');
  } catch (error) {
    console.error('게시글 조회 오류:', error);
    throw error;
  }
};

// 게시글 상세 조회
export const getPostDetail = async (postId: number): Promise<PostDetail> => {
  try {
    const token = getToken();
    const headers: HeadersInit = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
      headers
    });
    const result: ApiResponse<{ post: PostDetail; comments: Comment[]; reactions: PostReactions; userReaction: ReactionType | null }> = await response.json();
    
    if (result.success && result.data) {
      return {
        ...result.data.post,
        comments: result.data.comments,
        reactions: result.data.reactions,
        userReaction: result.data.userReaction,
        tags: result.data.tags || []
      };
    }
    throw new Error(result.message || '게시글 조회 실패');
  } catch (error) {
    console.error('게시글 상세 조회 오류:', error);
    throw error;
  }
};

// 게시글 이모티콘 반응 추가/제거
export const toggleReaction = async (postId: number, reactionType: ReactionType): Promise<{ action: string }> => {
  try {
    const token = getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/reactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reaction_type: reactionType })
    });
    
    const result: ApiResponse<{ action: string }> = await response.json();
    
    if (result.success) {
      return { action: result.data?.action || 'added' };
    }
    throw new Error(result.message || '반응 추가/제거 실패');
  } catch (error) {
    console.error('이모티콘 반응 오류:', error);
    throw error;
  }
};

// 이미지 업로드
export const uploadImage = async (file: File, categoryCode?: string): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('image', file);
    
    // 카테고리 코드가 있으면 쿼리 파라미터로 전달
    const UPLOAD_API_URL = categoryCode 
      ? `/api/upload/image?category_code=${categoryCode}`
      : '/api/upload/image';

    const response = await fetch(UPLOAD_API_URL, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
      throw new Error(errorData.message || `이미지 업로드 실패: ${response.status}`);
    }

    const result: ApiResponse<{ url: string; filename: string }> = await response.json();
    
    if (result.success && result.data) {
      return result.data.url;
    }
    throw new Error(result.message || '이미지 업로드 실패');
  } catch (error: any) {
    console.error('이미지 업로드 오류:', error);
    if (error instanceof TypeError) {
      throw new Error('네트워크 오류가 발생했습니다. 서버에 연결할 수 없습니다.');
    }
    throw error;
  }
};

// 게시글 작성
export const createPost = async (postData: {
  category_id: number;
  title: string;
  content: string;
  author_name: string;
  author_password: string;
  is_notice?: boolean;
  image_url?: string;
  tags?: string[]; // 태그 배열 (기관게시판)
}): Promise<number> => {
  try {
    const token = getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/posts`, {
      method: 'POST',
      headers,
      body: JSON.stringify(postData),
    });
    
    const result: ApiResponse<{ post_id: number }> = await response.json();
    
    if (result.success && result.data) {
      return result.data.post_id;
    }
    throw new Error(result.message || '게시글 작성 실패');
  } catch (error) {
    console.error('게시글 작성 오류:', error);
    throw error;
  }
};

// 게시글 수정
export const updatePost = async (
  postId: number,
  postData: {
    title: string;
    content: string;
    author_password: string;
    is_notice?: boolean;
    image_url?: string;
    tags?: string[]; // 태그 배열 (기관게시판)
  }
): Promise<void> => {
  try {
    const token = getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(postData),
    });
    
    const result: ApiResponse<any> = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || '게시글 수정 실패');
    }
  } catch (error) {
    console.error('게시글 수정 오류:', error);
    throw error;
  }
};

// 게시글 삭제 (일반 사용자용 - 비밀번호 필요)
export const deletePost = async (
  postId: number,
  author_password: string
): Promise<void> => {
  try {
    const token = getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ author_password }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const result: ApiResponse<any> = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || '게시글 삭제 실패');
    }
  } catch (error: any) {
    console.error('게시글 삭제 오류:', error);
    if (error instanceof TypeError) {
      throw new Error('네트워크 오류가 발생했습니다. 서버에 연결할 수 없습니다.');
    }
    throw error;
  }
};

// 게시글 삭제 (관리자용 - 비밀번호 불필요)
export const deletePostAsAdmin = async (postId: number): Promise<void> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({}) // 비밀번호 없이 빈 객체 전송
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const result: ApiResponse<any> = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || '게시글 삭제 실패');
    }
  } catch (error: any) {
    console.error('게시글 삭제 오류:', error);
    if (error instanceof TypeError) {
      throw new Error('네트워크 오류가 발생했습니다. 서버에 연결할 수 없습니다.');
    }
    throw error;
  }
};

// 댓글 작성
export const createComment = async (commentData: {
  post_id: number;
  content: string;
  author_name: string;
  author_password: string;
}): Promise<number> => {
  try {
    const token = getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(commentData),
    });
    
    const result: ApiResponse<{ comment_id: number }> = await response.json();
    
    if (result.success && result.data) {
      return result.data.comment_id;
    }
    throw new Error(result.message || '댓글 작성 실패');
  } catch (error) {
    console.error('댓글 작성 오류:', error);
    throw error;
  }
};

// 댓글 삭제
export const deleteComment = async (
  commentId: number,
  author_password: string
): Promise<void> => {
  try {
    const token = getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ author_password }),
    });
    
    const result: ApiResponse<any> = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || '댓글 삭제 실패');
    }
  } catch (error) {
    console.error('댓글 삭제 오류:', error);
    throw error;
  }
};

// 태그 타입
export interface Tag {
  tag_id: number;
  tag_name: string;
  tag_color: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  post_count?: number; // 태그를 사용한 게시글 개수 (정렬용)
}

// 태그 목록 조회 (게시판별 태그 개수 조회 가능)
export const getTags = async (categoryCode?: 'member' | 'organization'): Promise<Tag[]> => {
  try {
    const token = getToken();
    const headers: HeadersInit = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // 게시판 코드가 있으면 쿼리 파라미터로 전달
    const url = categoryCode 
      ? `${API_BASE_URL}/tags?category_code=${categoryCode}`
      : `${API_BASE_URL}/tags`;
    
    const response = await fetch(url, {
      headers
    });
    const result: ApiResponse<Tag[]> = await response.json();
    
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.message || '태그 조회 실패');
  } catch (error) {
    console.error('태그 조회 오류:', error);
    throw error;
  }
};

// 태그 생성
export const createTag = async (tagData: {
  tag_name: string;
  tag_color?: string;
  display_order?: number;
}): Promise<number> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(`${API_BASE_URL}/tags`, {
      method: 'POST',
      headers,
      body: JSON.stringify(tagData),
    });
    
    const result: ApiResponse<{ tag_id: number }> = await response.json();
    
    if (result.success && result.data) {
      return result.data.tag_id;
    }
    throw new Error(result.message || '태그 생성 실패');
  } catch (error) {
    console.error('태그 생성 오류:', error);
    throw error;
  }
};

// 태그 수정
export const updateTag = async (
  tagId: number,
  tagData: {
    tag_name?: string;
    tag_color?: string;
    display_order?: number;
  }
): Promise<void> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(`${API_BASE_URL}/tags/${tagId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(tagData),
    });
    
    const result: ApiResponse<any> = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || '태그 수정 실패');
    }
  } catch (error) {
    console.error('태그 수정 오류:', error);
    throw error;
  }
};

// 태그 삭제
export const deleteTag = async (tagId: number): Promise<void> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(`${API_BASE_URL}/tags/${tagId}`, {
      method: 'DELETE',
      headers,
    });
    
    const result: ApiResponse<any> = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || '태그 삭제 실패');
    }
  } catch (error) {
    console.error('태그 삭제 오류:', error);
    throw error;
  }
};

