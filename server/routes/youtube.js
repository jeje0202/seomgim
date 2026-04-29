// YouTube API 라우터
const express = require('express');
const router = express.Router();
const axios = require('axios');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_HANDLE = '창원섬김의교회'; // @ 없이 핸들만

// 채널 ID 가져오기 (핸들로)
const getChannelId = async () => {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API 키가 설정되지 않았습니다.');
  }

  try {
    // 먼저 핸들로 직접 조회 시도 (YouTube Data API v3)
    const handleResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: {
        part: 'id',
        forHandle: CHANNEL_HANDLE,
        key: YOUTUBE_API_KEY
      }
    });

    if (handleResponse.data.items && handleResponse.data.items.length > 0) {
      return handleResponse.data.items[0].id;
    }

    // 핸들로 찾지 못하면 검색으로 시도
    const searchResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: `@${CHANNEL_HANDLE}`,
        type: 'channel',
        key: YOUTUBE_API_KEY,
        maxResults: 1
      }
    });

    if (searchResponse.data.items && searchResponse.data.items.length > 0) {
      return searchResponse.data.items[0].id.channelId;
    }

    throw new Error('채널을 찾을 수 없습니다.');
  } catch (error) {
    const errorData = error.response?.data || {};
    const errorMessage = errorData.error?.message || error.message;
    const errorCode = errorData.error?.code || error.response?.status;
    
    console.error('채널 ID 조회 오류:', {
      status: error.response?.status,
      code: errorCode,
      message: errorMessage,
      errors: errorData.error?.errors
    });
    
    // 403 오류인 경우 더 자세한 메시지
    if (error.response?.status === 403) {
      if (errorMessage?.includes('quota') || errorMessage?.includes('quotaExceeded')) {
        throw new Error('YouTube API 할당량이 초과되었습니다. 나중에 다시 시도해주세요.');
      } else if (errorMessage?.includes('API key')) {
        throw new Error('YouTube API 키가 유효하지 않거나 권한이 없습니다.');
      } else if (errorMessage?.includes('not enabled')) {
        throw new Error('YouTube Data API v3가 활성화되지 않았습니다.');
      } else {
        throw new Error(`YouTube API 접근 거부: ${errorMessage || '권한이 없습니다.'}`);
      }
    }
    
    throw error;
  }
};

// 영상 목록 가져오기
router.get('/videos', async (req, res) => {
  try {
    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'YouTube API 키가 설정되지 않았습니다. 서버 관리자에게 문의하세요.'
      });
    }

    const { type = 'videos', page = 1, limit = 10 } = req.query;
    const channelId = await getChannelId();

    // 라이브 스트림 또는 일반 동영상 조회
    const isLive = type === 'streams';
    
    let videos = [];
    let nextPageToken = null;
    let prevPageToken = null;
    let totalResults = 0;

    if (isLive) {
      // 예배영상: 완료된 라이브 스트림 조회 (과거 라이브 포함)
      const params = {
        part: 'snippet',
        channelId: channelId,
        type: 'video',
        order: 'date',
        maxResults: parseInt(limit),
        eventType: 'completed', // 완료된 라이브 스트림
        key: YOUTUBE_API_KEY
      };

      if (req.query.pageToken) {
        params.pageToken = req.query.pageToken;
      }

      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params
      });

      videos = response.data.items.map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        publishedAt: item.snippet.publishedAt,
        channelTitle: item.snippet.channelTitle
      }));

      nextPageToken = response.data.nextPageToken;
      prevPageToken = response.data.prevPageToken;
      totalResults = response.data.pageInfo?.totalResults || 0;
    } else {
      // 찬양영상: 일반 동영상만 조회 (라이브 제외)
      // 요청한 개수만큼 확보할 때까지 반복 조회
      const requestedLimit = parseInt(limit);
      let allVideoIds = [];
      let currentPageToken = req.query.pageToken || null;
      let hasMore = true;
      let searchNextPageToken = null;
      let searchPrevPageToken = null;
      let searchTotalResults = 0;

      // 요청한 개수만큼 일반 동영상을 확보할 때까지 반복
      while (allVideoIds.length < requestedLimit * 3 && hasMore) {
        const searchParams = {
          part: 'snippet',
          channelId: channelId,
          type: 'video',
          order: 'date',
          maxResults: 50, // 최대 개수로 가져오기
          key: YOUTUBE_API_KEY
        };

        if (currentPageToken) {
          searchParams.pageToken = currentPageToken;
        }

        let searchResponse;
        try {
          searchResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: searchParams
          });
        } catch (searchError) {
          const searchErrorData = searchError.response?.data || {};
          const searchErrorMessage = searchErrorData.error?.message || searchError.message;
          
          if (searchError.response?.status === 403) {
            if (searchErrorMessage?.includes('quota') || searchErrorMessage?.includes('quotaExceeded')) {
              throw new Error('YouTube API 할당량이 초과되었습니다. 나중에 다시 시도해주세요.');
            } else if (searchErrorMessage?.includes('API key')) {
              throw new Error('YouTube API 키가 유효하지 않거나 권한이 없습니다.');
            } else {
              throw new Error(`YouTube API 접근 거부: ${searchErrorMessage || '권한이 없습니다.'}`);
            }
          }
          throw searchError;
        }

        // 첫 번째 요청에서만 페이지네이션 정보 저장
        if (!req.query.pageToken && allVideoIds.length === 0) {
          searchNextPageToken = searchResponse.data.nextPageToken;
          searchPrevPageToken = searchResponse.data.prevPageToken;
          searchTotalResults = searchResponse.data.pageInfo?.totalResults || 0;
        }

        const batchVideoIds = searchResponse.data.items.map(item => item.id.videoId);
        allVideoIds = allVideoIds.concat(batchVideoIds);

        // 다음 페이지가 없으면 중단
        if (!searchResponse.data.nextPageToken) {
          hasMore = false;
        } else {
          currentPageToken = searchResponse.data.nextPageToken;
        }

        // 충분한 개수를 확보했으면 중단
        if (allVideoIds.length >= requestedLimit * 3) {
          searchNextPageToken = searchResponse.data.nextPageToken;
          break;
        }
      }

      if (allVideoIds.length > 0) {
        // 각 영상의 상세 정보 조회 (라이브 여부 확인)
        // YouTube API는 한 번에 최대 50개까지만 조회 가능하므로 배치로 처리
        let allNonLiveVideos = [];
        
        for (let i = 0; i < allVideoIds.length; i += 50) {
          const batchIds = allVideoIds.slice(i, i + 50);
          
          let videosResponse;
          try {
            videosResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
              params: {
                part: 'snippet,liveStreamingDetails',
                id: batchIds.join(','),
                key: YOUTUBE_API_KEY
              }
            });
          } catch (videosError) {
            const videosErrorData = videosError.response?.data || {};
            const videosErrorMessage = videosErrorData.error?.message || videosError.message;
            
            if (videosError.response?.status === 403) {
              if (videosErrorMessage?.includes('quota') || videosErrorMessage?.includes('quotaExceeded')) {
                throw new Error('YouTube API 할당량이 초과되었습니다. 나중에 다시 시도해주세요.');
              } else if (videosErrorMessage?.includes('API key')) {
                throw new Error('YouTube API 키가 유효하지 않거나 권한이 없습니다.');
              } else {
                throw new Error(`YouTube API 접근 거부: ${videosErrorMessage || '권한이 없습니다.'}`);
              }
            }
            throw videosError;
          }

          // 라이브 스트림이 아닌 영상만 필터링
          const nonLiveVideos = videosResponse.data.items
            .filter(video => !video.liveStreamingDetails);

          allNonLiveVideos = allNonLiveVideos.concat(nonLiveVideos);

          // 요청한 개수만큼 확보했으면 중단
          if (allNonLiveVideos.length >= requestedLimit) {
            break;
          }
        }

        // 요청한 개수만큼만 반환
        videos = allNonLiveVideos
          .slice(0, requestedLimit)
          .map(video => ({
            videoId: video.id,
            title: video.snippet.title,
            description: video.snippet.description,
            thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
            publishedAt: video.snippet.publishedAt,
            channelTitle: video.snippet.channelTitle
          }));
      }

      nextPageToken = searchNextPageToken;
      prevPageToken = searchPrevPageToken;
      totalResults = searchTotalResults;
    }

    res.json({
      success: true,
      data: {
        videos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          nextPageToken: nextPageToken,
          prevPageToken: prevPageToken,
          totalResults: totalResults
        }
      }
    });
  } catch (error) {
    const errorData = error.response?.data || {};
    const errorMessage = errorData.error?.message || error.message;
    const statusCode = error.response?.status || 500;
    
    console.error('YouTube 영상 목록 조회 오류:', {
      status: error.response?.status,
      message: errorMessage,
      errors: errorData.error?.errors,
      fullError: error.response?.data
    });
    
    // 403 오류인 경우 더 자세한 메시지
    if (statusCode === 403) {
      let userMessage = 'YouTube API 접근이 거부되었습니다.';
      
      if (errorMessage?.includes('quota') || errorMessage?.includes('quotaExceeded')) {
        userMessage = 'YouTube API 할당량이 초과되었습니다. 나중에 다시 시도해주세요.';
      } else if (errorMessage?.includes('API key')) {
        userMessage = 'YouTube API 키가 유효하지 않거나 권한이 없습니다. 서버 관리자에게 문의하세요.';
      } else if (errorMessage?.includes('not enabled')) {
        userMessage = 'YouTube Data API v3가 활성화되지 않았습니다. 서버 관리자에게 문의하세요.';
      } else if (errorMessage) {
        userMessage = `YouTube API 오류: ${errorMessage}`;
      }
      
      return res.status(403).json({
        success: false,
        message: userMessage
      });
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage || '영상 목록을 불러올 수 없습니다.'
    });
  }
});

module.exports = router;

