// 사용자 활동 추적 API 서비스
import { getToken } from './authApi';

const API_BASE_URL = '/api/activity';

// 활동 추적
// 비로그인 사용자의 IP 접속도 수집하기 위해 토큰이 없어도 호출 가능
export const trackActivity = async (
  activityType: string,
  activityName: string,
  activityData?: any
): Promise<void> => {
  try {
    const token = getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    // 로그인한 경우에만 토큰 포함
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    await fetch(`${API_BASE_URL}/track`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        activity_type: activityType,
        activity_name: activityName,
        activity_data: activityData || null
      })
    });
  } catch (error) {
    // 활동 추적 실패는 조용히 무시 (사용자 경험에 영향 없음)
    console.error('활동 추적 오류:', error);
  }
};

// 로그아웃 기록
export const logLogout = async (): Promise<void> => {
  try {
    const token = getToken();
    if (!token) return;

    await fetch(`${API_BASE_URL}/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (error) {
    // 로그아웃 기록 실패는 조용히 무시
    console.error('로그아웃 기록 오류:', error);
  }
};

// 사용자 세션 목록 조회 (최고관리자만)
export interface UserSession {
  session_id: number;
  user_id: number;
  username: string;
  nickname: string;
  name: string;
  login_time: string;
  logout_time: string | null;
  session_duration: number | null;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export interface SessionListResponse {
  success: boolean;
  data?: {
    sessions: UserSession[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  message?: string;
}

export const getSessions = async (params?: {
  user_id?: number;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}): Promise<SessionListResponse> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const queryParams = new URLSearchParams();
    if (params?.user_id) queryParams.append('user_id', params.user_id.toString());
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const response = await fetch(`${API_BASE_URL}/sessions?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result: SessionListResponse = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || '세션 목록 조회 실패');
    }

    return result;
  } catch (error: any) {
    console.error('세션 목록 조회 오류:', error);
    throw error;
  }
};

// 사용자 활동 목록 조회 (최고관리자만)
export interface UserActivity {
  activity_id: number;
  session_id: number | null;
  user_id: number | null;
  ip_address: string | null;
  username: string | null;
  nickname: string | null;
  name: string | null;
  activity_type: string;
  activity_name: string;
  activity_data: any;
  created_at: string;
}

export interface ActivityListResponse {
  success: boolean;
  data?: {
    activities: UserActivity[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  message?: string;
}

export const getActivities = async (params?: {
  user_id?: number;
  session_id?: number;
  activity_type?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}): Promise<ActivityListResponse> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const queryParams = new URLSearchParams();
    if (params?.user_id) queryParams.append('user_id', params.user_id.toString());
    if (params?.session_id) queryParams.append('session_id', params.session_id.toString());
    if (params?.activity_type) queryParams.append('activity_type', params.activity_type);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const response = await fetch(`${API_BASE_URL}/activities?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result: ActivityListResponse = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || '활동 목록 조회 실패');
    }

    return result;
  } catch (error: any) {
    console.error('활동 목록 조회 오류:', error);
    throw error;
  }
};

// 통계 조회 (최고관리자만)
export interface StatisticsResponse {
  success: boolean;
  data?: {
    session_statistics: Array<{
      user_id: number;
      username: string;
      nickname: string;
      name: string;
      total_sessions: number;
      total_duration: number;
      avg_duration: number;
      first_login: string;
      last_login: string;
    }>;
    activity_statistics: Array<{
      activity_type: string;
      activity_name: string;
      count: number;
    }>;
  };
  message?: string;
}

export const getStatistics = async (params?: {
  user_id?: number;
  start_date?: string;
  end_date?: string;
}): Promise<StatisticsResponse> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const queryParams = new URLSearchParams();
    if (params?.user_id) queryParams.append('user_id', params.user_id.toString());
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);

    const response = await fetch(`${API_BASE_URL}/statistics?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result: StatisticsResponse = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || '통계 조회 실패');
    }

    return result;
  } catch (error: any) {
    console.error('통계 조회 오류:', error);
    throw error;
  }
};

// IP 주소별 통계 조회 (최고관리자만)
export interface IPStatistics {
  ip_address: string;
  unique_users: number;
  total_sessions: number;
  total_duration: number;
  avg_duration: number;
  first_access: string;
  last_access: string;
  user_names: string;
  location: {
    country: string;
    countryCode: string;
    region: string;
    regionCode: string;
    city: string;
    zip: string;
    latitude: number | null;
    longitude: number | null;
    isp: string;
    org: string;
    as: string;
    asname: string;
    timezone: string;
    locationDetail: string;
  };
}

export interface IPActivityStatistics {
  ip_address: string;
  unique_users: number;
  total_activities: number;
  activity_types: number;
  first_access: string;
  last_access: string;
  user_names: string | null;
  location: {
    country: string;
    countryCode: string;
    region: string;
    regionCode: string;
    city: string;
    zip: string;
    latitude: number | null;
    longitude: number | null;
    isp: string;
    org: string;
    as: string;
    asname: string;
    timezone: string;
    locationDetail: string;
  };
}

export interface IPStatisticsResponse {
  success: boolean;
  data?: {
    ip_statistics: IPStatistics[];
    ip_activity_statistics: IPActivityStatistics[];
  };
  message?: string;
}

export const getIPStatistics = async (params?: {
  start_date?: string;
  end_date?: string;
}): Promise<IPStatisticsResponse> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const queryParams = new URLSearchParams();
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);

    const response = await fetch(`${API_BASE_URL}/ip-statistics?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result: IPStatisticsResponse = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'IP 통계 조회 실패');
    }

    return result;
  } catch (error: any) {
    console.error('IP 통계 조회 오류:', error);
    throw error;
  }
};

