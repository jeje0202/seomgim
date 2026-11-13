// 사진첩 앨범 API 서비스
// [한글 코멘트] 고속 앨범 뷰어 오픈을 위한 인메모리 캐시, 호버/터치 프리페칭(prefetch), 이미지 사전 디코딩 연동 추가
import { getToken } from './authApi';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { preloadImage } from '../utils/imagePreloader';

const API_BASE_URL = '/api/albums';

// 앨범 타입
export interface Album {
  album_id: number;
  title: string;
  description?: string;
  author_id?: number;
  author_name: string;
  view_count: number;
  created_at: string;
  thumbnail?: string;
  photo_count?: number;
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

// [한글 코멘트] 앨범 상세 데이터 메모리 캐시 (유효시간 5분) 및 진행 중인 요청 공유 맵
const ALBUM_CACHE_TTL_MS = 5 * 60 * 1000;
const albumDetailCache = new Map<number, { data: AlbumDetail; cachedAt: number }>();
const inFlightDetailMap = new Map<number, Promise<AlbumDetail>>();

/**
 * [한글 코멘트] 동기적으로 캐시된 앨범 상세 데이터가 있는지 확인하여 반환하는 함수 (0ms 즉시 모달 오픈용)
 */
export const getCachedAlbumDetail = (albumId: number): AlbumDetail | null => {
  const hit = albumDetailCache.get(albumId);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > ALBUM_CACHE_TTL_MS) {
    albumDetailCache.delete(albumId);
    return null;
  }
  return hit.data;
};

/**
 * [한글 코멘트] 앨범 생성·수정·삭제 시 상세 캐시를 무효화하는 함수
 */
export const invalidateAlbumCache = (albumId?: number): void => {
  if (typeof albumId === 'number') {
    albumDetailCache.delete(albumId);
    inFlightDetailMap.delete(albumId);
  } else {
    albumDetailCache.clear();
    inFlightDetailMap.clear();
  }
};

// [한글 코멘트] 앨범 목록 조회 (썸네일 URL을 R2 CDN URL로 정규화)
export const getAlbums = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
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
    if (params?.search && params.search.trim() !== '') {
      queryParams.append('search', params.search.trim());
    }

    const url = `${API_BASE_URL}?${queryParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('프록시 오류: API 서버에 연결할 수 없습니다. 백엔드 서버(포트 5000)가 실행 중인지 확인하세요.');
    }

    if (!response.ok) {
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
      const normalizedAlbums = result.data.albums.map((a) => ({
        ...a,
        thumbnail: a.thumbnail ? resolveMediaUrl(a.thumbnail) : a.thumbnail
      }));
      return {
        albums: normalizedAlbums,
        pagination: result.data.pagination
      };
    }
    throw new Error(result.message || '앨범 목록 조회 실패');
  } catch (error) {
    console.error('앨범 목록 조회 오류:', error);
    throw error;
  }
};

// [한글 코멘트] 앨범 상세 조회 (캐시 히트 시 즉시 반환 및 사진 URL R2 CDN 정규화)
export const getAlbumDetail = async (albumId: number, forceRefresh: boolean = false): Promise<AlbumDetail> => {
  if (!forceRefresh) {
    const cached = getCachedAlbumDetail(albumId);
    if (cached) {
      return cached;
    }
    const existingPromise = inFlightDetailMap.get(albumId);
    if (existingPromise) {
      return existingPromise;
    }
  }

  const fetchPromise = (async (): Promise<AlbumDetail> => {
    try {
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
        const normalizedPhotos = (result.data.photos || []).map((p) => ({
          ...p,
          photo_url: resolveMediaUrl(p.photo_url),
          thumbnail_url: p.thumbnail_url ? resolveMediaUrl(p.thumbnail_url) : undefined
        }));

        const detail: AlbumDetail = {
          ...result.data.album,
          photos: normalizedPhotos
        };

        albumDetailCache.set(albumId, { data: detail, cachedAt: Date.now() });
        return detail;
      }
      throw new Error(result.message || '앨범 상세 조회 실패');
    } catch (error) {
      console.error('앨범 상세 조회 오류:', error);
      throw error;
    } finally {
      inFlightDetailMap.delete(albumId);
    }
  })();

  inFlightDetailMap.set(albumId, fetchPromise);
  return fetchPromise;
};

/**
 * [한글 코멘트] 앨범 카드 마우스 호버/터치 시 상세 데이터와 상위 썸네일·첫 장 원본을 백그라운드에서 미리 준비하는 함수
 */
export const prefetchAlbumDetail = (albumId: number): void => {
  if (getCachedAlbumDetail(albumId) || inFlightDetailMap.has(albumId)) {
    return;
  }

  getAlbumDetail(albumId)
    .then((detail) => {
      // 상위 6장 썸네일 및 첫 번째 원본 이미지를 미리 디코딩 캐시에 적재
      detail.photos.slice(0, 6).forEach((p) => {
        if (p.thumbnail_url) preloadImage(p.thumbnail_url);
      });
      if (detail.photos[0]?.photo_url) {
        preloadImage(detail.photos[0].photo_url);
      }
    })
    .catch(() => {
      // 백그라운드 프리페치 실패 시 조용히 무시
    });
};

// 앨범 생성
export const createAlbum = async (albumData: {
  title: string;
  description?: string;
  photos: Array<{ url: string; thumbnailUrl?: string; description?: string }>;
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
      invalidateAlbumCache();
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

    invalidateAlbumCache(albumId);
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

    invalidateAlbumCache(albumId);
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
      compressedResults = await compressImagesWithThumbnails(files);
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
