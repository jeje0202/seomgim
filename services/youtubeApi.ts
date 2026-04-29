// YouTube API 서비스
const API_BASE_URL = '/api/youtube';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  channelTitle: string;
}

export interface YouTubeVideoResponse {
  videos: YouTubeVideo[];
  pagination: {
    page: number;
    limit: number;
    nextPageToken?: string;
    prevPageToken?: string;
    totalResults: number;
  };
}

// 영상 목록 조회
export const getYouTubeVideos = async (
  type: 'streams' | 'videos' = 'videos',
  pageToken?: string,
  limit: number = 10
): Promise<YouTubeVideoResponse> => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('type', type);
    queryParams.append('limit', limit.toString());
    if (pageToken) {
      queryParams.append('pageToken', pageToken);
    }

    const response = await fetch(`${API_BASE_URL}/videos?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.message || '영상 목록을 불러올 수 없습니다.');
    }
    
    return result.data;
  } catch (error) {
    console.error('YouTube 영상 목록 조회 오류:', error);
    throw error;
  }
};

