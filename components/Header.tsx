import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, User, LogOut, Activity } from 'lucide-react';
import { NavSection } from '../types';
import { ChurchLogo } from './ChurchLogo';
import LoginModal from './LoginModal';
import ChangePasswordModal from './ChangePasswordModal';
import UserManagementModal from './UserManagementModal';
import ActivityLogModal from './ActivityLogModal';
import { getUserInfo, logout, hasRole, User as UserType } from '../services/authApi';
import { getPendingUserCount } from '../services/userApi';
import { trackActivity } from '../services/activityApi';
import { usePendingUserEvents } from '../hooks/usePendingUserEvents';

interface HeaderProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
}

const Header: React.FC<HeaderProps> = ({ activeSection, onNavigate }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUserManagementModal, setShowUserManagementModal] = useState(false);
  const [showActivityLogModal, setShowActivityLogModal] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);
  const [pendingUserCount, setPendingUserCount] = useState(0);
  const pendingCountRef = useRef(0); // 백그라운드 갱신 시 최신 값 참조용

  useEffect(() => {
    // 초기 사용자 정보 로드
    const loadUser = () => {
      const userInfo = getUserInfo();
      setUser(userInfo); // null이 될 수도 있으므로 그대로 설정
    };

    loadUser();

    // 로컬 스토리지 변경 감지 (다른 탭에서 로그인/로그아웃 시)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user_info' || e.key === 'auth_token') {
        loadUser();
      }
    };

    // 현재 탭에서의 명시적 로그아웃 감지
    const handleAuthLogout = () => {
      setUser(null);
    };

    // 이벤트 리스너 등록
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth:logout', handleAuthLogout);

    // 클린업
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, []);

  // 신규 회원 요청 수 조회 (관리자 이상만)
  // 변경사항이 있을 때만 state 업데이트하여 깜박임 방지
  const loadPendingCount = async () => {
    const userInfo = getUserInfo();
    if (userInfo && hasRole(userInfo, 'admin', 'super-admin')) {
      try {
        const count = await getPendingUserCount();
        // 현재 값과 비교하여 변경사항이 있을 때만 업데이트
        if (pendingCountRef.current !== count) {
        setPendingUserCount(count);
          pendingCountRef.current = count;
        console.log('승인 대기 사용자 수:', count); // 디버깅용
        }
      } catch (error: any) {
        console.error('신규 회원 요청 수 조회 오류:', error);
        // 에러 발생 시에도 변경사항이 있을 때만 업데이트
        if (pendingCountRef.current !== 0) {
        setPendingUserCount(0);
          pendingCountRef.current = 0;
        }
      }
    } else {
      // 관리자가 아니면 0으로 설정 (변경사항이 있을 때만)
      if (pendingCountRef.current !== 0) {
      setPendingUserCount(0);
        pendingCountRef.current = 0;
      }
    }
  };

  useEffect(() => {
    if (user && hasRole(user, 'admin', 'super-admin')) {
      loadPendingCount();
      // 30초마다 갱신 (폴백으로 유지 - SSE 연결 실패 시 대비)
      const interval = setInterval(loadPendingCount, 30000);
      return () => clearInterval(interval);
    } else {
      // 관리자가 아니면 0으로 설정
      if (pendingCountRef.current !== 0) {
      setPendingUserCount(0);
        pendingCountRef.current = 0;
      }
    }
  }, [user]);

  // 실시간 이벤트 구독 (SSE)
  usePendingUserEvents({
    onCountChanged: loadPendingCount,
    enabled: user !== null && hasRole(user, 'admin', 'super-admin')
  });

  const handleLoginSuccess = (userData: UserType) => {
    setUser(userData);
    setShowLoginModal(false);
  };

  const handleLogout = async () => {
    await logout(); // 로그아웃 기록 포함
    setUser(null);
  };

  const navItems = [
    { id: NavSection.HOME, label: '홈' },
    { id: NavSection.ABOUT, label: '교회소개' },
    { id: NavSection.WORSHIP, label: '예배안내' },
    { id: NavSection.MEDIA, label: '말씀과 찬양' },
    { id: NavSection.NEWS, label: '교회소식' },
    { id: NavSection.BOARD, label: '게시판' },
    { id: NavSection.ALBUM, label: '은혜의 순간들' },
    { id: NavSection.LOCATION, label: '오시는 길' },
  ];

  const handleNavClick = (section: NavSection) => {
    onNavigate(section);
    setIsMenuOpen(false);
    
    // 활동 추적 (메뉴 클릭)
    const sectionNames: { [key: string]: string } = {
      [NavSection.HOME]: '홈',
      [NavSection.ABOUT]: '교회소개',
      [NavSection.WORSHIP]: '예배안내',
      [NavSection.MEDIA]: '말씀과 찬양',
      [NavSection.NEWS]: '교회소식',
      [NavSection.BOARD]: '게시판',
      [NavSection.LOCATION]: '오시는 길'
    };
    
    trackActivity('menu_click', sectionNames[section] || section, {
      section_id: section
    });
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-rose-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20 min-h-[64px]">
          
          {/* Logo - 더 컴팩트하게 */}
          <div 
            className="flex items-center cursor-pointer gap-2 flex-shrink-0" 
            onClick={() => handleNavClick(NavSection.HOME)}
          >
            <ChurchLogo className="w-8 h-10 md:w-10 md:h-12" />
            <div className="flex flex-col">
              <span className="text-[10px] md:text-xs text-slate-500 tracking-wider leading-tight">대한예수교 장로회</span>
              <span className="text-base md:text-xl font-bold text-slate-800 font-serif leading-tight">창원섬김의교회</span>
            </div>
          </div>

          {/* Desktop Navigation - md 이상에서 표시 (모바일 데스크톱 모드 포함) */}
          <nav className="hidden md:flex items-center flex-1 justify-center gap-0.5 md:gap-1 xl:gap-2 min-w-0 overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`px-1.5 md:px-2 xl:px-3 py-1.5 xl:py-2 rounded-md text-[10px] md:text-xs xl:text-sm font-medium transition-colors duration-200 whitespace-nowrap flex-shrink-0
                  ${activeSection === item.id 
                    ? 'text-rose-600 bg-rose-50' 
                    : 'text-slate-600 hover:text-rose-500 hover:bg-rose-50/50'
                  }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
            
          {/* 로그인/사용자 메뉴 - md 이상에서 표시 */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0 ml-2">
            {user ? (
              <>
                <div 
                  className="flex items-center gap-1.5 px-2 py-1.5 bg-teal-50 rounded-lg cursor-pointer hover:bg-teal-100 transition-colors"
                  onClick={() => setShowPasswordModal(true)}
                  title="비밀번호 변경"
                >
                  <User size={14} className="text-teal-600 flex-shrink-0" />
                  <div className="flex flex-col leading-tight">
                    <span className="text-xs font-semibold text-teal-700 whitespace-nowrap">{user.name}</span>
                    <span className="text-[10px] text-teal-500 whitespace-nowrap">{user.role}</span>
                  </div>
                </div>
                {/* 관리자 권한일 때 사용자 관리 버튼 (아이콘만) */}
                {hasRole(user, 'admin', 'super-admin') && (
                  <button
                    onClick={() => setShowUserManagementModal(true)}
                    className="w-8 h-8 text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors flex items-center justify-center relative"
                    title="사용자 관리"
                  >
                    <User size={18} />
                    {pendingUserCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center min-w-[20px] shadow-lg z-10 border-2 border-white">
                        {pendingUserCount > 9 ? '9+' : pendingUserCount}
                      </span>
                    )}
                  </button>
                )}
                {/* 최고관리자만 활동 로그 버튼 (아이콘만) */}
                {hasRole(user, 'super-admin') && (
                  <button
                    onClick={() => {
                      setShowActivityLogModal(true);
                      trackActivity('menu_click', '활동 로그', { menu: 'activity_log' });
                    }}
                    className="w-8 h-8 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors flex items-center justify-center"
                    title="활동 로그"
                  >
                    <Activity size={18} />
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="w-8 h-8 text-slate-600 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors flex items-center justify-center"
                  title="로그아웃"
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-3 py-1.5 bg-teal-500 text-white rounded-lg text-xs font-semibold hover:bg-teal-600 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <User size={14} />
                로그인
              </button>
            )}
          </div>

          {/* 모바일 전용 로그인/로그아웃 버튼 (폰에서만 표시) */}
          <div className="md:hidden flex items-center gap-2">
            {user ? (
              <button
                onClick={handleLogout}
                className="p-2 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-colors flex items-center justify-center"
                title="로그아웃"
              >
                <LogOut size={20} />
              </button>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="p-2 rounded-full bg-teal-50 text-teal-600 hover:bg-teal-100 hover:text-teal-700 transition-colors flex items-center justify-center"
                title="로그인"
              >
                <User size={20} />
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-md text-slate-600 hover:text-rose-600 focus:outline-none"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-b border-rose-100 absolute w-full">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`block w-full text-left px-3 py-4 rounded-md text-base font-medium
                  ${activeSection === item.id 
                    ? 'text-rose-600 bg-rose-50' 
                    : 'text-slate-600 hover:text-rose-500 hover:bg-rose-50'
                  }`}
              >
                {item.label}
              </button>
            ))}
            
            {/* 모바일 로그인/사용자 메뉴 */}
            {user ? (
              <>
                <div className="px-3 py-4 border-t border-rose-100 mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <User size={18} className="text-teal-600" />
                    <div>
                      <div className="font-semibold text-slate-800">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.role}</div>
                    </div>
                  </div>
                  {hasRole(user, 'admin', 'super-admin') && (
                    <button
                      onClick={() => {
                        setShowUserManagementModal(true);
                        setIsMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-md text-sm font-medium transition-colors flex items-center gap-2 justify-between mb-2"
                    >
                      <div className="flex items-center gap-2">
                        <User size={16} />
                        사용자관리
                      </div>
                      {pendingUserCount > 0 && (
                        <span className="bg-rose-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {pendingUserCount > 9 ? '9+' : pendingUserCount}
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowPasswordModal(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-md text-sm font-medium transition-colors flex items-center gap-2 mb-2"
                  >
                    비밀번호 변경
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full px-3 py-2 text-slate-600 hover:text-rose-500 hover:bg-rose-50 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <LogOut size={16} />
                    로그아웃
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => {
                  setShowLoginModal(true);
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-4 rounded-md text-base font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 flex items-center gap-2"
              >
                <User size={18} />
                로그인
              </button>
            )}
          </div>
        </div>
      )}

      {/* 로그인 모달 */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* 비밀번호 변경 모달 */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={() => {
          // 비밀번호 변경 성공 시 처리 (선택사항)
        }}
      />

      {/* 사용자 관리 모달 */}
      <UserManagementModal
        isOpen={showUserManagementModal}
        onClose={() => {
          setShowUserManagementModal(false);
          // 모달 닫을 때 카운트 갱신
          loadPendingCount();
        }}
        onUserUpdated={loadPendingCount}
      />
      {/* 활동 로그 모달 (최고관리자만) */}
      <ActivityLogModal
        isOpen={showActivityLogModal}
        onClose={() => setShowActivityLogModal(false)}
      />
    </header>
  );
};

export default Header;