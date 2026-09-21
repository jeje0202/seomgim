// [한글 코멘트] 로그인 세션 유지(1달 / 30d) 및 토큰 자동 갱신(Sliding Session) 관리 유틸리티
// 파일 용도: JWT 토큰 상태 분석, 토큰 만료 여부 판별, 서버와의 슬라이딩 세션 자동 연장, 사용자 수동 로그아웃 처리

import { getToken, setToken, removeToken, setUserInfo, getUserInfo, User } from '../services/authApi';

// JWT 페이로드 인터페이스
interface JwtPayload {
  user_id: number;
  username: string;
  role: string;
  name?: string;
  nickname?: string;
  session_id?: number;
  exp?: number;
  iat?: number;
}

/**
 * [한글 코멘트] JWT 토큰을 Base64 디코딩하여 페이로드 추출
 */
export const parseJwt = (token: string): JwtPayload | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('JWT 파싱 오류:', error);
    return null;
  }
};

/**
 * [한글 코멘트] JWT 토큰이 현재 만료되었는지 확인
 * 만료시간(exp)이 없거나 파싱 실패 시 안전을 위해 유효한 것으로 간주하고 서버 검증에 위임
 */
export const isTokenExpired = (token: string): boolean => {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return false;
  // 한국 시간 기준 현재 타임스탬프 (초)
  const currentTimestamp = Math.floor(Date.now() / 1000);
  return currentTimestamp >= payload.exp;
};

/**
 * [한글 코멘트] JWT 토큰의 남은 유효시간(초) 반환
 */
export const getTokenRemainingSeconds = (token: string): number => {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return 0;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  return Math.max(0, payload.exp - currentTimestamp);
};

// 중복 갱신 요청 방지용 프로미스 캐시
let refreshPromise: Promise<boolean> | null = null;

/**
 * [한글 코멘트] 백엔드와 통신하여 30일 세션을 자동 연장하고 최신 사용자 정보를 동기화 (Sliding Session)
 * @param force 즉시 강제 갱신 여부
 */
export const refreshSession = async (force: boolean = false): Promise<boolean> => {
  const token = getToken();
  if (!token) return false;

  // 이미 갱신 중인 요청이 있으면 동일 프로미스 반환
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // 서버에서 401(계정 비활성화 또는 완전 만료) 응답 시
        if (response.status === 401) {
          const errData = await response.json().catch(() => ({}));
          console.warn('세션 검증 실패:', errData.message || response.statusText);
          // 계정이 비활성화되었거나 명백히 유효하지 않은 경우에만 로컬 정리
          if (errData.code === 'INVALID_USER' || errData.code === 'USER_INACTIVE') {
            removeToken();
            window.dispatchEvent(new CustomEvent('auth:logout'));
            return false;
          }
        }
        return false;
      }

      const result = await response.json();
      if (result.success && result.data) {
        // [한글 코멘트] 갱신된 새 30일 토큰이 있으면 로컬스토리지에 저장
        if (result.data.token) {
          setToken(result.data.token);
        }

        // [한글 코멘트] 최신 사용자 정보(is_member 성도 여부, role 등)를 저장
        const updatedUser: User = {
          user_id: result.data.user_id,
          username: result.data.username,
          nickname: result.data.nickname,
          name: result.data.name,
          role: result.data.role,
          is_active: true,
          is_member: result.data.is_member === true || result.data.is_member === 1
        };
        setUserInfo(updatedUser);

        // 변경 사항 알림 이벤트 발송
        window.dispatchEvent(new CustomEvent('auth:user-changed', { detail: updatedUser }));
        return true;
      }

      return false;
    } catch (error) {
      console.error('세션 자동 갱신 통신 오류:', error);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * [한글 코멘트] 사용자가 직접 '로그아웃' 버튼을 클릭했을 때만 호출되는 수동 로그아웃 함수
 */
export const performManualLogout = async (): Promise<void> => {
  try {
    // 백엔드에 로그아웃 기록
    const { logLogout } = await import('../services/activityApi');
    await logLogout().catch(() => {});
  } catch (error) {
    // 로그아웃 로깅 실패는 무시
  }

  // 로컬 저장소 토큰 및 유저 정보 삭제
  removeToken();

  // 로그아웃 이벤트 디스패치 (헤더 및 모든 컴포넌트 실시간 반응)
  window.dispatchEvent(new CustomEvent('auth:logout'));
};
