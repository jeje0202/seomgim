// 사진첩 앨범 API 서비스
import { getToken } from './authApi';

const API_BASE_URL = '/api/albums';

// 앨범 타입
export interface Album {
  album_id: number;
  title: string;
  description?: string;
  author_id?: number; // 작성자 ID 추가
  author_name: string;
  view_count: number;
  created_at: string;
  thumbnail?: string;
  photo_count?: number; // 이미지 개수
}

// 앨범 상세 타입
export interface AlbumDetail extends Album {
  author_id: number;
  photos: AlbumPhoto[];
}

// 앨범 사진 타입
export interface AlbumPhoto {
  photo_id: number;
  album_id: number;
  photo_url: string; // 1080p 이미지 URL
  thumbnail_url?: string; // 썸네일 URL
  photo_order: number;
  description?: string;
  created_at: string;
}

// API 응답 타입
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: any[];
}

// 앨범 목록 조회
export const getAlbums = async (params?: {
  page?: number;
  limit?: number;
}): Promise<{
  albums: Album[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const url = `${API_BASE_URL}?${queryParams.toString()}`;
    console.log('앨범 API 호출:', { url, API_BASE_URL, params, fullUrl: window.location.origin + url });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('앨범 API 응답:', { 
      status: response.status, 
      statusText: response.statusText,
      ok: response.ok,
      url: response.url,
      contentType: response.headers.get('content-type')
    });

    // Content-Type 확인 - HTML이 반환되면 프록시 문제
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text().catch(() => '');
      console.error('앨범 API 오류: JSON이 아닌 응답 수신', { 
        status: response.status, 
        contentType,
        responsePreview: text.substring(0, 200)
      });
      throw new Error(`프록시 오류: API 서버에 연결할 수 없습니다. 백엔드 서버(포트 5000)가 실행 중인지 확인하세요.`);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('앨범 API 오류 응답:', { status: response.status, errorText });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: ApiResponse<{
      albums: Album[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }> = await response.json();

    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.message || '앨범 목록 조회 실패');
  } catch (error) {
    console.error('앨범 목록 조회 오류:', error);
    throw error;
  }
};

// 앨범 상세 조회
export const getAlbumDetail = async (albumId: number): Promise<AlbumDetail> => {
  try {
    // 로그인한 사용자의 경우 토큰을 포함하여 요청 (조회수 증가를 위해 user_id 필요)
    const token = getToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/${albumId}`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: ApiResponse<{
      album: AlbumDetail;
      photos: AlbumPhoto[];
    }> = await response.json();

    if (result.success && result.data) {
      return {
        ...result.data.album,
        photos: result.data.photos
      };
    }
    throw new Error(result.message || '앨범 상세 조회 실패');
  } catch (error) {
    console.error('앨범 상세 조회 오류:', error);
    throw error;
  }
};

// 앨범 생성
export const createAlbum = async (albumData: {
  title: string;
  description?: string;
  photos: Array<{ url: string; description?: string }>;
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
      body: JSON.stringify(albumData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
      throw new Error(errorData.message || `앨범 생성 실패: ${response.status}`);
    }

    const result: ApiResponse<{ album_id: number }> = await response.json();

    if (result.success && result.data) {
      return result.data.album_id;
    }
    throw new Error(result.message || '앨범 생성 실패');
  } catch (error) {
    console.error('앨범 생성 오류:', error);
    throw error;
  }
};

// 앨범 수정
export const updateAlbum = async (albumId: number, albumData: {
  title: string;
  description?: string;
  photos: Array<{ url: string; thumbnailUrl?: string; description?: string }>;
}): Promise<void> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const response = await fetch(`${API_BASE_URL}/${albumId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(albumData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
      throw new Error(errorData.message || `앨범 수정 실패: ${response.status}`);
    }

    const result: ApiResponse<any> = await response.json();

    if (!result.success) {
      throw new Error(result.message || '앨범 수정 실패');
    }
  } catch (error) {
    console.error('앨범 수정 오류:', error);
    throw error;
  }
};

// 앨범 삭제
export const deleteAlbum = async (albumId: number): Promise<void> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const response = await fetch(`${API_BASE_URL}/${albumId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
      throw new Error(errorData.message || `앨범 삭제 실패: ${response.status}`);
    }

    const result: ApiResponse<any> = await response.json();

    if (!result.success) {
      throw new Error(result.message || '앨범 삭제 실패');
    }
  } catch (error) {
    console.error('앨범 삭제 오류:', error);
    throw error;
  }
};

// 사진 업로드 (1080p 이미지와 썸네일 모두 업로드)
export const uploadPhotos = async (files: File[]): Promise<Array<{ url: string; thumbnailUrl: string; filename: string; thumbnailFilename: string }>> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    // 이미지 압축 및 썸네일 생성
    let compressedResults;
    try {
      const { compressImagesWithThumbnails } = await import('../utils/imageCompression');
      console.log('[사진 업로드] 이미지 압축 시작...', files.length, '개');
      compressedResults = await compressImagesWithThumbnails(files);
      console.log('[사진 업로드] 이미지 압축 완료');
    } catch (compressionError: any) {
      console.error('[사진 업로드] 이미지 압축 오류:', compressionError);
      throw new Error(`이미지 압축 실패: ${compressionError.message || '알 수 없는 오류'}`);
    }

    // FormData에 1080p 이미지와 썸네일 모두 추가
    const formData = new FormData();
    compressedResults.forEach(result => {
      formData.append('fullImages', result.fullImage);
      formData.append('thumbnails', result.thumbnail);
    });
    
    console.log('[사진 업로드] FormData 생성 완료:', {
      fullImages: compressedResults.length,
      thumbnails: compressedResults.length
    });

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
      throw new Error(errorData.message || `사진 업로드 실패: ${response.status}`);
    }

    const result: ApiResponse<{
      photos: Array<{ url: string; thumbnailUrl: string; filename: string; thumbnailFilename: string }>;
    }> = await response.json();

    if (result.success && result.data) {
      return result.data.photos;
    }
    throw new Error(result.message || '사진 업로드 실패');
  } catch (error) {
    console.error('사진 업로드 오류:', error);
    throw error;
  }
};

