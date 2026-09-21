// 인증 API 서비스
// Nginx가 /api 경로를 프록시하므로 상대 경로 사용 (개발/프로덕션 모두 동일)
const API_BASE_URL = '/api/auth';

// 사용자 타입
export interface User {
  user_id: number;
  username: string;
  nickname?: string;
  name: string;
  role: 'super-admin' | 'admin' | 'manager' | 'user';
  is_active: boolean;
  is_member?: boolean;
  is_approved?: boolean;
  last_login?: string;
  created_at?: string;
}

// 로그인 응답 타입
export interface AuthResponse {
  success: boolean;
  data?: {
    user_id: number;
    username: string;
    nickname?: string;
    name: string;
    role: string;
    token: string;
    is_approved?: boolean;
  };
  message?: string;
}

// 로컬 스토리지에서 토큰 가져오기
export const getToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

// 토큰 저장
export const setToken = (token: string): void => {
  localStorage.setItem('auth_token', token);
};

// 토큰 삭제
export const removeToken = (): void => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_info');
};

// 사용자 정보 저장
export const setUserInfo = (user: User): void => {
  localStorage.setItem('user_info', JSON.stringify(user));
};

// 사용자 정보 가져오기
export const getUserInfo = (): User | null => {
  const userStr = localStorage.getItem('user_info');
  return userStr ? JSON.parse(userStr) : null;
};

// 캐시 무효화 및 강제 새로고침 함수
const clearCacheAndReload = (): void => {
  try {
    // 현재 빌드 버전 가져오기 (HTML의 meta 태그 또는 빌드 타임스탬프)
    const buildVersion = document.querySelector('meta[name="build-version"]')?.getAttribute('content') || Date.now().toString();
    const storedVersion = localStorage.getItem('app_build_version');
    
    // 캐시 스토리지 클리어 (localStorage는 유지)
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    
    // 빌드 버전 저장
    localStorage.setItem('app_build_version', buildVersion);
    
    // 로그인 시 항상 강제 새로고침 (옛날 자료 방지)
    // URL에 타임스탬프 추가하여 캐시 우회
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString());
    
    // 약간의 지연 후 새로고침 (토큰 저장 완료 대기)
    setTimeout(() => {
      window.location.href = url.toString();
    }, 100);
  } catch (error) {
    console.error('캐시 클리어 오류:', error);
    // 오류 발생 시에도 강제 새로고침
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }
};

// 로그인
export const login = async (username: string, password: string): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const result: AuthResponse = await response.json();

    if (result.success && result.data) {
      setToken(result.data.token);
      setUserInfo({
        user_id: result.data.user_id,
        username: result.data.username,
        nickname: result.data.nickname, // nickname 추가
        email: result.data.email,
        name: result.data.name,
        role: result.data.role as any,
        is_active: true,
        is_member: result.data.is_member || false
      });
      
      // 로그인 성공 시 캐시 무효화 및 강제 새로고침
      clearCacheAndReload();
    }

    return result;
  } catch (error) {
    console.error('로그인 오류:', error);
    throw error;
  }
};

// 아이디 중복 확인
export const checkUsername = async (username: string): Promise<{ available: boolean; message?: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/check-username?username=${encodeURIComponent(username)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    return {
      available: result.success && result.data?.available === true,
      message: result.message
    };
  } catch (error) {
    console.error('아이디 중복 확인 오류:', error);
    return { available: false, message: '중복 확인 중 오류가 발생했습니다.' };
  }
};

// 닉네임 중복 확인
export const checkNickname = async (nickname: string): Promise<{ available: boolean; message?: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/check-nickname?nickname=${encodeURIComponent(nickname)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    return {
      available: result.success && result.data?.available === true,
      message: result.message
    };
  } catch (error) {
    console.error('닉네임 중복 확인 오류:', error);
    return { available: false, message: '중복 확인 중 오류가 발생했습니다.' };
  }
};

// 회원가입
export const register = async (userData: {
  username: string;
  nickname: string;
  password: string;
  name: string;
  is_member?: boolean;
}): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const result: AuthResponse = await response.json();

    if (result.success && result.data) {
      setToken(result.data.token);
      // 승인된 경우에만 사용자 정보 저장 및 로그인 처리
      if (result.data.is_approved && result.data.token) {
        setUserInfo({
          user_id: result.data.user_id,
          username: result.data.username,
          nickname: result.data.nickname,
          name: result.data.name,
          role: result.data.role as any,
          is_active: true,
          is_approved: true
        });
        
        // 회원가입 성공 시 캐시 무효화 및 강제 새로고침
        clearCacheAndReload();
      }
    }

    return result;
  } catch (error) {
    console.error('회원가입 오류:', error);
    throw error;
  }
};

// 로그아웃
export const logout = async (): Promise<void> => {
  // 로그아웃 기록 (비동기로 처리, 실패해도 로그아웃은 진행)
  try {
    const { logLogout } = await import('./activityApi');
    await logLogout();
  } catch (error) {
    // 로그아웃 기록 실패는 무시
  }
  removeToken();
  // 로그아웃 이벤트 발생 (다른 컴포넌트에서 즉시 감지할 수 있도록)
  window.dispatchEvent(new CustomEvent('auth:logout'));
};

// [한글 코멘트] 토큰 검증 및 30일 슬라이딩 세션 자동 연장
export const verifyToken = async (): Promise<boolean> => {
  try {
    const token = getToken();
    if (!token) return false;

    const response = await fetch(`${API_BASE_URL}/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    if (result.success && result.data) {
      // 새 30일 토큰이 오면 갱신
      if (result.data.token) {
        setToken(result.data.token);
      }
      // 최신 사용자 정보(is_member 성도 여부 포함) 갱신
      setUserInfo({
        user_id: result.data.user_id,
        username: result.data.username,
        nickname: result.data.nickname,
        name: result.data.name,
        role: result.data.role as any,
        is_active: true,
        is_member: result.data.is_member === true || result.data.is_member === 1
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('토큰 검증 오류:', error);
    return false;
  }
};

// [한글 코멘트] 세션 및 권한 실시간 동기화 함수 (앱 시작 시, 포커스 시, 게시판 진입 시 호출)
export const syncSession = async (): Promise<User | null> => {
  try {
    const token = getToken();
    if (!token) return null;

    const isValid = await verifyToken();
    if (isValid) {
      return getUserInfo();
    }
    return null;
  } catch (error) {
    console.error('세션 동기화 오류:', error);
    return getUserInfo();
  }
};

// 현재 사용자 정보 가져오기
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const token = getToken();
    if (!token) return null;

    const response = await fetch(`${API_BASE_URL}/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    if (result.success && result.data) {
      const updatedUser: User = {
        ...result.data,
        is_member: result.data.is_member === true || result.data.is_member === 1
      };
      setUserInfo(updatedUser);
      return updatedUser;
    }
    return null;
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    return null;
  }
};

// 비밀번호 변경
export const changePassword = async (currentPassword: string, newPassword: string, confirmPassword: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    if (newPassword !== confirmPassword) {
      return { success: false, message: '새 비밀번호가 일치하지 않습니다.' };
    }

    const response = await fetch(`${API_BASE_URL}/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      })
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    throw error;
  }
};

// 권한 체크 헬퍼 함수
export const hasRole = (user: User | null, ...roles: string[]): boolean => {
  if (!user) return false;
  
  const roleHierarchy: { [key: string]: number } = {
    'user': 1,
    'manager': 2,
    'admin': 3,
    'super-admin': 4
  };

  const userRoleLevel = roleHierarchy[user.role] || 0;
  return roles.some(role => {
    const requiredLevel = roleHierarchy[role] || 0;
    return userRoleLevel >= requiredLevel;
  });
};

