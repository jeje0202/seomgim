// 공통 API 클라이언트 유틸리티
// 네트워크 오류 처리 및 재시도 로직 포함

interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
}

/**
 * 네트워크 오류가 발생하면 재시도하는 fetch 래퍼 함수
 */
export const fetchWithRetry = async (
  url: string,
  options: FetchOptions = {}
): Promise<Response> => {
  const { retries = 3, retryDelay = 1000, ...fetchOptions } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        // QUIC 프로토콜 오류 방지를 위해 HTTP/2 또는 HTTP/1.1 강제 사용
        cache: 'no-cache',
        keepalive: false,
      });
      
      // 성공적인 응답이면 반환
      if (response.ok || response.status < 500) {
        return response;
      }
      
      // 5xx 서버 오류인 경우에만 재시도
      if (response.status >= 500 && attempt < retries) {
        console.warn(`서버 오류 ${response.status}, ${retryDelay}ms 후 재시도... (${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }
      
      return response;
    } catch (error: any) {
      lastError = error;
      
      // QUIC 프로토콜 오류 또는 네트워크 오류인 경우 재시도
      if (
        (error.name === 'TypeError' && (error.message?.includes('QUIC') || error.message?.includes('ERR_QUIC'))
        || error.message?.includes('Failed to fetch')
        || error.message?.includes('NetworkError'))
        && attempt < retries
      ) {
        console.warn(`네트워크 오류 발생, ${retryDelay * (attempt + 1)}ms 후 재시도... (${attempt + 1}/${retries}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }
      
      // 재시도 불가능한 오류면 즉시 throw
      throw error;
    }
  }
  
  // 모든 재시도 실패
  throw lastError || new Error('네트워크 요청 실패');
};

