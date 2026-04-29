// 사용자 관리 API 서비스
// Nginx가 /api 경로를 프록시하므로 상대 경로 사용 (개발/프로덕션 모두 동일)
import { getToken } from './authApi';

const API_BASE_URL = '/api/auth';

// 사용자 타입
export interface User {
  user_id: number;
  username: string;
  nickname: string | null;
  name: string;
  role: 'user' | 'manager' | 'admin' | 'super-admin';
  is_active: boolean;
  is_member?: boolean;
  is_approved?: boolean;
  created_at: string;
  last_login: string | null;
}

// 사용자 목록 조회
export const getUsers = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<{
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search && params.search.trim()) {
      queryParams.append('search', params.search.trim());
    }

    const response = await fetch(`${API_BASE_URL}/users?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || '사용자 목록 조회 실패');
    }
    
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.message || '사용자 목록 조회 실패');
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    throw error;
  }
};

// 사용자 정보 수정
export const updateUser = async (
  userId: number,
  data: {
    name?: string;
    nickname?: string;
    role?: 'user' | 'manager' | 'admin' | 'super-admin';
    is_active?: boolean;
    is_member?: boolean;
  }
): Promise<void> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data),
    });

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      throw new Error(`서버 응답을 파싱할 수 없습니다. (${response.status})`);
    }
    
    if (!response.ok || !result.success) {
      throw new Error(result.message || '사용자 정보 수정 실패');
    }
  } catch (error: any) {
    console.error('사용자 정보 수정 오류:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('네트워크 오류가 발생했습니다. 서버 연결을 확인해주세요.');
    }
    throw error;
  }
};

// 사용자 삭제
export const deleteUser = async (userId: number): Promise<void> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.message || '사용자 삭제 실패');
    }
  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    throw error;
  }
};

// 신규 회원 요청 수 조회
export const getPendingUserCount = async (): Promise<number> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const response = await fetch(`${API_BASE_URL}/users/pending-count`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    
    if (result.success && result.data) {
      return result.data.count || 0;
    }
    throw new Error(result.message || '신규 회원 요청 수 조회 실패');
  } catch (error) {
    console.error('신규 회원 요청 수 조회 오류:', error);
    throw error;
  }
};

// 사용자 비밀번호 초기화
export const resetUserPassword = async (
  userId: number,
  newPassword?: string
): Promise<string> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const response = await fetch(`${API_BASE_URL}/users/${userId}/reset-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ new_password: newPassword }),
    });

    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.message || '비밀번호 초기화 실패');
    }
    
    return result.data?.new_password || '1234';
  } catch (error) {
    console.error('비밀번호 초기화 오류:', error);
    throw error;
  }
};

// 사용자 승인
export const approveUser = async (userId: number): Promise<void> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const response = await fetch(`${API_BASE_URL}/users/${userId}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      throw new Error(`서버 응답을 파싱할 수 없습니다. (${response.status})`);
    }
    
    if (!response.ok || !result.success) {
      throw new Error(result.message || '사용자 승인 실패');
    }
  } catch (error: any) {
    console.error('사용자 승인 오류:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('네트워크 오류가 발생했습니다. 서버 연결을 확인해주세요.');
    }
    throw error;
  }
};

