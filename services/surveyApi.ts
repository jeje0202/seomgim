// 설문조사 API 서비스
import { getToken } from './authApi';

const API_BASE_URL = '/api/surveys';

// 설문조사 타입
export interface Survey {
  survey_id: number;
  title: string;
  description: string;
  author_name: string;
  is_active: boolean;
  is_anonymous: boolean;
  target_type?: 'anyone' | 'authenticated' | 'authenticated_anonymous';
  start_date: string | null;
  end_date: string | null;
  end_condition_type?: 'date' | 'count' | 'percentage';
  end_count?: number | null;
  end_percentage?: number | null;
  created_at: string;
  response_count: number;
}

export interface SurveyQuestion {
  question_id: number;
  question_text: string;
  question_type: 'single' | 'multiple' | 'text' | 'rating';
  question_order: number;
  is_required: boolean;
  options?: string[];
}

export interface SurveyDetail extends Survey {
  questions: SurveyQuestion[];
  hasResponded: boolean;
}

export interface SurveyResponse {
  answers: {
    question_id: number;
    answer_text?: string;
    answer_options?: string[];
    rating_value?: number;
  }[];
}

// API 응답 타입
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: any[];
}

// 설문조사 목록 조회
export const getSurveys = async (params?: {
  page?: number;
  limit?: number;
  status?: 'all' | 'active' | 'ended';
}): Promise<{ surveys: Survey[]; pagination: any }> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);

    const response = await fetch(`${API_BASE_URL}?${queryParams}`);
    const result: ApiResponse<{ surveys: Survey[]; pagination: any }> = await response.json();

    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.message || '설문조사 조회 실패');
  } catch (error) {
    console.error('설문조사 목록 조회 오류:', error);
    throw error;
  }
};

// 설문조사 상세 조회
export const getSurveyDetail = async (surveyId: number): Promise<SurveyDetail> => {
  try {
    const response = await fetch(`${API_BASE_URL}/${surveyId}`);
    const result: ApiResponse<SurveyDetail> = await response.json();

    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.message || '설문조사 조회 실패');
  } catch (error) {
    console.error('설문조사 상세 조회 오류:', error);
    throw error;
  }
};

// 설문조사 작성
export const createSurvey = async (surveyData: {
  title: string;
  description?: string;
  is_anonymous?: boolean;
  target_type?: 'anyone' | 'authenticated' | 'authenticated_anonymous';
  start_date?: string;
  end_date?: string;
  end_condition_type?: 'date' | 'count' | 'percentage';
  end_count?: number;
  end_percentage?: number;
  questions: {
    question_text: string;
    question_type: 'single' | 'multiple' | 'text' | 'rating';
    is_required?: boolean;
    options?: string[];
  }[];
}): Promise<number> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const response = await fetch(`${API_BASE_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(surveyData)
    });

    const result: ApiResponse<{ survey_id: number }> = await response.json();

    if (result.success && result.data) {
      return result.data.survey_id;
    }
    throw new Error(result.message || '설문조사 작성 실패');
  } catch (error: any) {
    console.error('설문조사 작성 오류:', error);
    throw error;
  }
};

// 설문조사 수정
export const updateSurvey = async (
  surveyId: number,
  surveyData: {
    title: string;
    description?: string;
    is_active?: boolean;
    is_anonymous?: boolean;
    start_date?: string;
    end_date?: string;
  }
): Promise<void> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const response = await fetch(`${API_BASE_URL}/${surveyId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(surveyData)
    });

    const result: ApiResponse<null> = await response.json();

    if (!result.success) {
      throw new Error(result.message || '설문조사 수정 실패');
    }
  } catch (error: any) {
    console.error('설문조사 수정 오류:', error);
    throw error;
  }
};

// 설문조사 취소 (관리자 이상)
export const cancelSurvey = async (surveyId: number): Promise<void> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const response = await fetch(`${API_BASE_URL}/${surveyId}/cancel`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result: ApiResponse<null> = await response.json();

    if (!result.success) {
      throw new Error(result.message || '설문조사 취소 실패');
    }
  } catch (error: any) {
    console.error('설문조사 취소 오류:', error);
    throw error;
  }
};

// 설문조사 삭제 (관리자 이상, 취소된 설문조사만 삭제 가능)
export const deleteSurvey = async (surveyId: number): Promise<void> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const response = await fetch(`${API_BASE_URL}/${surveyId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result: ApiResponse<null> = await response.json();

    if (!result.success) {
      throw new Error(result.message || '설문조사 삭제 실패');
    }
  } catch (error: any) {
    console.error('설문조사 삭제 오류:', error);
    throw error;
  }
};

// 설문조사 응답 제출
export const submitSurveyResponse = async (
  surveyId: number,
  response: SurveyResponse
): Promise<void> => {
  try {
    const token = getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const apiResponse = await fetch(`${API_BASE_URL}/${surveyId}/responses`, {
      method: 'POST',
      headers,
      body: JSON.stringify(response)
    });

    const result: ApiResponse<null> = await apiResponse.json();

    if (!result.success) {
      throw new Error(result.message || '설문조사 응답 제출 실패');
    }
  } catch (error: any) {
    console.error('설문조사 응답 제출 오류:', error);
    throw error;
  }
};

// 설문조사 통계 조회 (관리자 이상)
export const getSurveyStatistics = async (surveyId: number): Promise<any> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const response = await fetch(`${API_BASE_URL}/${surveyId}/statistics`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result: ApiResponse<any> = await response.json();

    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.message || '설문조사 통계 조회 실패');
  } catch (error: any) {
    console.error('설문조사 통계 조회 오류:', error);
    throw error;
  }
};

