// 교회소식 API 서비스
// Nginx가 /api 경로를 프록시하므로 상대 경로 사용 (개발/프로덕션 모두 동일)
import { getToken } from './authApi';
import { fetchWithRetry } from './apiClient';

const API_BASE_URL = '/api/news';

// 교회소식 타입
export interface NewsItem {
  news_id: number;
  title: string;
  content: string;
  summary: string;
  tag: string;
  author_name: string;
  image_url?: string | null;
  view_count: number;
  is_pinned: boolean;
  pin_order: number;
  created_at: string;
}

// API 응답 타입
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: any[];
}

// 교회소식 목록 조회
export const getNews = async (limit: number = 10, tag?: string): Promise<NewsItem[]> => {
  try {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (tag) params.append('tag', tag);

    const response = await fetchWithRetry(`${API_BASE_URL}?${params}`);

    // Content-Type 확인 - HTML이 반환되면 프록시 문제
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text().catch(() => '');
      console.error('교회소식 API 오류: JSON이 아닌 응답 수신', {
        status: response.status,
        contentType,
        responsePreview: text.substring(0, 200)
      });
      throw new Error(`프록시 오류: API 서버에 연결할 수 없습니다. 백엔드 서버(포트 5000)가 실행 중인지 확인하세요.`);
    }

    const result: ApiResponse<NewsItem[]> = await response.json();

    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.message || '교회소식 조회 실패');
  } catch (error) {
    console.error('교회소식 조회 오류:', error);
    throw error;
  }
};

// 교회소식 상세 조회
export const getNewsDetail = async (newsId: number): Promise<NewsItem> => {
  try {
    // 로그인한 사용자의 경우 토큰을 포함하여 요청 (조회수 증가를 위해 user_id 필요)
    const token = getToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetchWithRetry(`${API_BASE_URL}/${newsId}`, {
      headers
    });
    const result: ApiResponse<NewsItem> = await response.json();

    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.message || '교회소식 조회 실패');
  } catch (error) {
    console.error('교회소식 상세 조회 오류:', error);
    throw error;
  }
};

// 태그별 색상 매핑
export const getTagColor = (tag: string): string => {
  const colorMap: { [key: string]: string } = {
    '공지': 'bg-rose-100 text-rose-600',
    '행사': 'bg-teal-100 text-teal-600',
    '모집': 'bg-blue-100 text-blue-600',
    '소식': 'bg-purple-100 text-purple-600',
    '안내': 'bg-yellow-100 text-yellow-600',
  };
  return colorMap[tag] || 'bg-slate-100 text-slate-600';
};

// 교회소식 작성
export const createNews = async (newsData: {
  title: string;
  content: string;
  summary?: string;
  tag: string;
  author_name: string;
  is_pinned?: boolean;
  pin_order?: number;
  image_url?: string;
}): Promise<number> => {
  try {
    const token = getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetchWithRetry(`${API_BASE_URL}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newsData),
    });

    const result: ApiResponse<{ news_id: number }> = await response.json();

    if (result.success && result.data) {
      return result.data.news_id;
    }
    throw new Error(result.message || '교회소식 작성 실패');
  } catch (error: any) {
    console.error('교회소식 작성 오류:', error);
    throw error;
  }
};

// 교회소식 수정
export const updateNews = async (
  newsId: number,
  newsData: {
    title: string;
    content: string;
    summary?: string;
    tag: string;
    is_pinned?: boolean;
    pin_order?: number;
    image_url?: string;
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

    const response = await fetchWithRetry(`${API_BASE_URL}/${newsId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(newsData),
    });

    const result: ApiResponse<null> = await response.json();

    if (!result.success) {
      throw new Error(result.message || '교회소식 수정 실패');
    }
  } catch (error: any) {
    console.error('교회소식 수정 오류:', error);
    throw error;
  }
};

// 교회소식 삭제
export const deleteNews = async (newsId: number): Promise<void> => {
  try {
    const token = getToken();
    const headers: HeadersInit = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetchWithRetry(`${API_BASE_URL}/${newsId}`, {
      method: 'DELETE',
      headers,
    });

    const result: ApiResponse<null> = await response.json();

    if (!result.success) {
      throw new Error(result.message || '교회소식 삭제 실패');
    }
  } catch (error: any) {
    console.error('교회소식 삭제 오류:', error);
    throw error;
  }
};

// 날짜 포맷팅 (한국 시간대 적용)
export const formatNewsDate = (dateString: string): string => {
  const date = new Date(dateString);
  // 한국 시간대 기준으로 날짜 포맷팅
  const koreaDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const year = koreaDate.getFullYear();
  const month = String(koreaDate.getMonth() + 1).padStart(2, '0');
  const day = String(koreaDate.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
};

