import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import NewsSection from './components/NewsSection';
import VideoSection from './components/VideoSection';
import BoardSection from './components/BoardSection';
import AlbumSection from './components/AlbumSection';
import { ChurchLogo } from './components/ChurchLogo';
import AlertModal from './components/AlertModal';
import { NavSection, ServiceTime } from './types';
import { MapPin, Phone, Clock, Mail, Globe, Users, HandHeart, Flower2, PhoneCall } from 'lucide-react';
import { getUserInfo, logout, User } from './services/authApi';
import { trackActivity } from './services/activityApi';
// [한글 코멘트] 슈퍼관리자 전용 SQLite CMS 연동 커스텀 훅 및 편집 래퍼/모달 컴포넌트 임포트
import { useCmsContent } from './hooks/useCmsContent';
import EditableSection from './components/EditableSection';
import SectionEditModal from './components/SectionEditModal';
import { CmsSectionItem } from './services/cmsApi';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<NavSection>(NavSection.HOME);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    message: '',
    type: 'info'
  });

  // [한글 코멘트] 현재 로그인 사용자 및 SQLite CMS 데이터 상태 관리 훅 연결
  const [currentUser, setCurrentUser] = useState<User | null>(getUserInfo());
  const { getSectionContent, updateSectionState } = useCmsContent();

  // [한글 코멘트] 슈퍼관리자 CMS 영역 편집 모달 상태
  const [cmsEditModal, setCmsEditModal] = useState<{
    isOpen: boolean;
    sectionKey: string;
    sectionTitle: string;
    initialData: any;
    initialTab?: 'edit' | 'history';
  }>({
    isOpen: false,
    sectionKey: '',
    sectionTitle: '',
    initialData: null,
    initialTab: 'edit'
  });

  // [한글 코멘트] 로그인 사용자 정보 갱신 감지
  useEffect(() => {
    const handleUserChange = () => {
      setCurrentUser(getUserInfo());
    };
    window.addEventListener('storage', handleUserChange);
    return () => window.removeEventListener('storage', handleUserChange);
  }, []);

  // [한글 코멘트] CMS 영역 편집 모달 열기 핸들러 (initialTab 파라미터 추가)
  const handleOpenCmsEditModal = (
    key: string,
    title: string,
    defaultData: any,
    initialTab: 'edit' | 'history' = 'edit'
  ) => {
    const contentData = getSectionContent(key, defaultData);
    setCmsEditModal({
      isOpen: true,
      sectionKey: key,
      sectionTitle: title,
      initialData: contentData,
      initialTab
    });
  };

  // 세션 타임아웃 시간 (30분 = 1800000ms)
  const SESSION_TIMEOUT = 30 * 60 * 1000;

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      if (Object.values(NavSection).includes(id as NavSection)) {
        setActiveSection(id as NavSection);
      }
    }
  };

  const handleNavNavigate = (section: NavSection) => {
    setActiveSection(section);
    scrollToSection(section);

    // 활동 추적 (메뉴 클릭)
    const sectionNames: { [key: string]: string } = {
      [NavSection.HOME]: '홈',
      [NavSection.ABOUT]: '교회소개',
      [NavSection.WORSHIP]: '예배안내',
      [NavSection.MEDIA]: '말씀과 찬양',
      [NavSection.NEWS]: '교회소식',
      [NavSection.BOARD]: '게시판',
      [NavSection.ALBUM]: '은혜의 순간들',
      [NavSection.LOCATION]: '오시는 길'
    };

    trackActivity('menu_click', sectionNames[section] || section, {
      section_id: section
    });
  };

  // 활동 감지 및 세션 타임아웃 처리
  useEffect(() => {
    const user = getUserInfo();

    // 로그인한 사용자가 없으면 세션 타임아웃 체크 불필요
    if (!user) {
      return;
    }

    // 활동 감지 이벤트 리스너
    const updateActivity = () => {
      lastActivityTimeRef.current = Date.now();
      resetTimeout();
    };

    // 세션 타임아웃 타이머 리셋
    const resetTimeout = () => {
      // 기존 타이머 제거
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }

      // 새로운 타이머 설정
      timeoutIdRef.current = setTimeout(() => {
        const timeSinceLastActivity = Date.now() - lastActivityTimeRef.current;

        // 30분 이상 활동이 없으면 로그아웃
        if (timeSinceLastActivity >= SESSION_TIMEOUT) {
          logout().then(() => {
            setAlertModal({
              isOpen: true,
              message: '30분간 활동이 없어 자동으로 로그아웃되었습니다.',
              type: 'info',
              onConfirm: () => {
                window.location.reload();
              }
            });
          });
        }
      }, SESSION_TIMEOUT);
    };

    // 활동 감지 이벤트 등록
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    // 초기 타이머 설정
    resetTimeout();

    // 주기적으로 활동 시간 체크 (1분마다)
    const checkInterval = setInterval(() => {
      const currentUser = getUserInfo();
      if (!currentUser) {
        clearInterval(checkInterval);
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
        }
        return;
      }

      const timeSinceLastActivity = Date.now() - lastActivityTimeRef.current;

      // 30분 이상 활동이 없으면 로그아웃
      if (timeSinceLastActivity >= SESSION_TIMEOUT) {
        clearInterval(checkInterval);
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
        }
        logout();
        setAlertModal({
          isOpen: true,
          message: '30분간 활동이 없어 자동으로 로그아웃되었습니다.',
          type: 'info',
          onConfirm: () => {
            window.location.reload();
          }
        });
      }
    }, 60000); // 1분마다 체크

    // 클린업
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true);
      });
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      clearInterval(checkInterval);
    };
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  const serviceTimes: ServiceTime[] = [
    { name: '주일 오전예배', time: '오전 11:00', location: '본당' },
    { name: '주일 찬양예배', time: '오후 2:00', location: '본당' },
    { name: '주일학교', time: '주일 오전 9:00', location: '교육관' },
    { name: '중·고등부', time: '주일 오후 1:00', location: '교육관' },
    { name: '청년대학부', time: '토요일 오후 6:00', location: '교육관' },
    { name: '새신자반', time: '주일 오후 1:30', location: '본당' },
    { name: '수요 밤 예배', time: '수요일 오후 7:30', location: '본당' },
    { name: '금요 연합구역예배(치유)', time: '금요일 오후 7:30', location: '본당' },
    { name: '새벽 기도회', time: '월~금 새벽 5:30', location: '본당' },
  ];

  const organizations = [
    { name: "사)한국희망나눔경남연합회", contact: "055-288-8155, 010-3208-8159" },
    { name: "로뎀가족상담힐링센터", contact: "055-288-8155, 010-3208-8159" },
    { name: "부산칼빈신학교창원캠퍼스", contact: "055-288-8159" },
    { name: "문화예술선교원", contact: "055-237-8159" },
    { name: "창원기독교연합회", contact: "" },
    { name: "창원목회자협의회", contact: "" },
    { name: "섬김과나눔의집(무료급식)", contact: "" },
    { name: "주남요양센터", contact: "" },
    { name: "사랑샘공동체", contact: "" },
    { name: "경남성시화운동본부", contact: "" },
    { name: "크리스천경남신문", contact: "" },
    { name: "방송선교 협력", contact: "극동방송, CTS, CBS" },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800">
      <Header activeSection={activeSection} onNavigate={handleNavNavigate} />

      <main className="flex-grow">
        {/* Home Section (Hero) */}
        <section id={NavSection.HOME}>
          <Hero
            onCtaClick={() => handleNavNavigate(NavSection.WORSHIP)}
            onLocationClick={() => handleNavNavigate(NavSection.LOCATION)}
          />
        </section>

        {/* About Section */}
        <section id={NavSection.ABOUT} className="py-24 bg-white relative overflow-hidden">
          {/* Background Deco */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-[800px] h-[800px] bg-gradient-to-br from-teal-50/50 to-blue-50/50 rounded-full blur-3xl -z-10"></div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* [한글 코멘트] 사용자 요청: 상단 제어 바 위치를 전체 섹션 최상단(교회 전경 및 소개 영역 위)으로 이동 */}
            {currentUser?.role === 'super-admin' && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl sm:rounded-full px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm mb-8">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-teal-400 rounded-full inline-block shrink-0"></span>
                  <span className="text-sm font-bold text-slate-700">
                    관리자 전용 웹사이트 주요 영역 편집 제어
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenCmsEditModal('pastor_greeting', '웹사이트 주요 영역', {
                      pastor_name: '박신철 목사',
                      pastor_role: 'Senior Pastor',
                      slogan: '이웃을 섬기며 성장하는 열린 교회',
                      greeting_title: '할렐루야! 주님의 이름으로 환영합니다.',
                      greeting_body: '창원섬김의교회는 상처 입은 영혼들이 예수님의 사랑 안에서 치유받고 회복되어, 세상 속에서 향기로운 들꽃처럼 피어나기를 소망하는 믿음의 공동체입니다.\n\n말씀이 살아 숨 쉬고 따뜻한 섬김이 있는 이곳에서, 여러분과 함께 아름다운 천국 가족을 이루어가길 기도합니다.'
                    }, 'edit')}
                    className="px-4 py-1.5 bg-[#009688] hover:bg-[#00796b] text-white rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    실시간 레이아웃 편집
                  </button>

                  <button
                    onClick={() => handleOpenCmsEditModal('pastor_greeting', '웹사이트 주요 영역', {
                      pastor_name: '박신철 목사',
                      pastor_role: 'Senior Pastor',
                      slogan: '이웃을 섬기며 성장하는 열린 교회',
                      greeting_title: '할렐루야! 주님의 이름으로 환영합니다.',
                      greeting_body: '창원섬김의교회는 상처 입은 영혼들이 예수님의 사랑 안에서 치유받고 회복되어, 세상 속에서 향기로운 들꽃처럼 피어나기를 소망하는 믿음의 공동체입니다.\n\n말씀이 살아 숨 쉬고 따뜻한 섬김이 있는 이곳에서, 여러분과 함께 아름다운 천국 가족을 이루어가길 기도합니다.'
                    }, 'history')}
                    className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    편집 이력 복구
                  </button>
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start mb-16">

              {/* Left Column: Image & Pastor Greeting */}
              <div className="space-y-6">
                {/* Church Image - 실제 교회 사진 사용 */}
                <div className="relative rounded-3xl overflow-hidden shadow-xl border-4 border-white aspect-video lg:aspect-auto lg:h-[320px]">
                  <img
                    src="/church_rainbow.jpg"
                    alt="창원섬김의교회 전경"
                    className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                </div>

                {/* [한글 코멘트] 첨부 1: 담임목사 인사말 영역 (EditableSection 감싸기 및 CMS 연동) */}
                <EditableSection
                  sectionKey="pastor_greeting"
                  sectionTitle="담임목사 인사말"
                  user={currentUser}
                  onEditClick={(key) => handleOpenCmsEditModal(key, '담임목사 인사말', {
                    pastor_name: '박신철 목사',
                    pastor_role: 'Senior Pastor',
                    slogan: '이웃을 섬기며 성장하는 열린 교회',
                    greeting_title: '할렐루야! 주님의 이름으로 환영합니다.',
                    greeting_body: '창원섬김의교회는 상처 입은 영혼들이 예수님의 사랑 안에서 치유받고 회복되어, 세상 속에서 향기로운 들꽃처럼 피어나기를 소망하는 믿음의 공동체입니다.\n\n말씀이 살아 숨 쉬고 따뜻한 섬김이 있는 이곳에서, 여러분과 함께 아름다운 천국 가족을 이루어가길 기도합니다.'
                  })}
                >
                  {(() => {
                    const pastorContent = getSectionContent('pastor_greeting', {
                      pastor_name: '박신철 목사',
                      pastor_role: 'Senior Pastor',
                      slogan: '이웃을 섬기며 성장하는 열린 교회',
                      greeting_title: '할렐루야! 주님의 이름으로 환영합니다.',
                      greeting_body: '창원섬김의교회는 상처 입은 영혼들이 예수님의 사랑 안에서 치유받고 회복되어, 세상 속에서 향기로운 들꽃처럼 피어나기를 소망하는 믿음의 공동체입니다.\n\n말씀이 살아 숨 쉬고 따뜻한 섬김이 있는 이곳에서, 여러분과 함께 아름다운 천국 가족을 이루어가길 기도합니다.'
                    });
                    return (
                      <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 relative group hover:border-rose-100 transition-colors min-h-[300px]">
                        <div className="mb-6">
                          <span className="text-sm font-bold text-slate-400 uppercase tracking-wide">{pastorContent.pastor_role}</span>
                          <h3 className="text-3xl font-serif font-bold text-slate-800 mt-1">{pastorContent.pastor_name}</h3>
                          <p className="text-teal-700 text-lg mt-2 font-bold tracking-wide bg-gradient-to-r from-teal-50 to-blue-50 px-4 py-2 rounded-lg border-l-4 border-teal-500 shadow-sm whitespace-pre-line">
                            {pastorContent.slogan}
                          </p>
                        </div>

                        <div className="relative">
                          <span className="absolute -top-2 -left-2 text-4xl text-slate-200 font-serif">"</span>
                          <div className="text-slate-600 leading-relaxed font-light pl-4 border-l-2 border-rose-200 whitespace-pre-line">
                            <p className="mb-3">
                              <strong className="text-slate-800 font-medium">{pastorContent.greeting_title}</strong>
                            </p>
                            <p className="whitespace-pre-line">
                              {pastorContent.greeting_body}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </EditableSection>
              </div>

              {/* Right Column: Introduction & Vision */}
              <div className="space-y-6">
                <div>
                  <span className="inline-block px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-xs font-bold mb-3 shadow-sm">
                    대한예수교 장로회
                  </span>
                  <h2 className="text-4xl font-serif font-bold text-slate-800">
                    교회 소개 및 비전
                  </h2>
                </div>

                {/* [한글 코멘트] 1. 설립 목적 영역 (고정 크기 래퍼 및 슈퍼관리자 편집 연결) */}
                <EditableSection
                  sectionKey="church_purpose"
                  sectionTitle="교회 설립 목적"
                  user={currentUser}
                  onEditClick={(key) => handleOpenCmsEditModal(key, '교회 설립 목적', {
                    subtitle: '우리 교회의 설립목적은 상담치유를 위한 들꽃 목회입니다.',
                    description: '힘들고 지친 이들이 들녘에 있는 이름 없는 야생화와의 만남을 통해 인생의 새로운 의미를 찾아 위로와 소망을 갖게 하며, 새로운 인생에 도전하게 하는 들꽃을 의미합니다.'
                  })}
                >
                  {(() => {
                    const purposeContent = getSectionContent('church_purpose', {
                      subtitle: '우리 교회의 설립목적은 상담치유를 위한 들꽃 목회입니다.',
                      description: '힘들고 지친 이들이 들녘에 있는 이름 없는 야생화와의 만남을 통해 인생의 새로운 의미를 찾아 위로와 소망을 갖게 하며, 새로운 인생에 도전하게 하는 들꽃을 의미합니다.'
                    });
                    return (
                      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-white p-8 rounded-3xl shadow-sm border border-emerald-100/60 group hover:shadow-md transition-all min-h-[220px]">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Flower2 size={100} className="text-emerald-600" />
                        </div>

                        <h3 className="relative z-10 text-xl font-bold text-emerald-800 mb-4 flex items-center gap-2">
                          <Flower2 className="text-emerald-500" size={24} />
                          교회 설립 목적
                        </h3>

                        <div className="relative z-10 text-slate-700 leading-relaxed">
                          <p className="text-lg font-bold text-emerald-900 mb-3 border-b border-emerald-100 pb-3 whitespace-pre-line">
                            {purposeContent.subtitle}
                          </p>
                          <p className="text-sm sm:text-base font-medium text-slate-600 whitespace-pre-line">
                            {purposeContent.description}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </EditableSection>

                {/* [한글 코멘트] 2. 교회 비전 영역 (고정 크기 래퍼 및 슈퍼관리자 편집 연결) */}
                <EditableSection
                  sectionKey="church_vision"
                  sectionTitle="창원 섬김의 교회 비전"
                  user={currentUser}
                  onEditClick={(key) => handleOpenCmsEditModal(key, '창원 섬김의 교회 비전', {
                    description: '이 시대의 힘들어하는 국내 가정, 소외계층, 청소년, 그리고 해외 가난한 민족과 어린 영혼들에게 희망을 주는 비전을 가지고 있습니다.',
                    items: [
                      '지역사회 지원센터 및 상담실 운영',
                      '섬김과 나눔의 집 (무료급식)',
                      '평생교육 실천'
                    ],
                    slogan: '"예수님의 사랑 이야기가 가득한 교회"'
                  })}
                >
                  {(() => {
                    const visionContent = getSectionContent('church_vision', {
                      description: '이 시대의 힘들어하는 국내 가정, 소외계층, 청소년, 그리고 해외 가난한 민족과 어린 영혼들에게 희망을 주는 비전을 가지고 있습니다.',
                      items: [
                        '지역사회 지원센터 및 상담실 운영',
                        '섬김과 나눔의 집 (무료급식)',
                        '평생교육 실천'
                      ],
                      slogan: '"예수님의 사랑 이야기가 가득한 교회"'
                    });
                    return (
                      <div className="relative overflow-hidden bg-gradient-to-br from-sky-50 to-white p-8 rounded-3xl shadow-sm border border-sky-100/60 group hover:shadow-md transition-all min-h-[260px]">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Globe size={100} className="text-sky-600" />
                        </div>

                        <h3 className="relative z-10 text-xl font-bold text-sky-800 mb-4 flex items-center gap-2">
                          <Globe className="text-sky-500" size={24} />
                          창원 섬김의 교회 비전
                        </h3>

                        <div className="relative z-10 space-y-4">
                          <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                            {visionContent.description}
                          </p>

                          <div className="bg-white/80 rounded-xl p-4 border border-sky-100 text-sm font-medium space-y-2 text-slate-600 shadow-sm">
                            {(visionContent.items || []).map((item: string, idx: number) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-sky-400 rounded-full"></span>
                                <span className="whitespace-pre-line">{item}</span>
                              </div>
                            ))}
                          </div>

                          <p className="font-serif font-bold text-sky-900 text-center pt-2 text-lg whitespace-pre-line">
                            {visionContent.slogan}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </EditableSection>
              </div>
            </div>

            {/* [한글 코멘트] 3 & 4. 섬기는 분들 및 부설/협력기관 영역 (고정 크기 래퍼 및 슈퍼관리자 편집 연결) */}
            <div className="border-t border-slate-100 pt-16">
              <div className="grid md:grid-cols-2 gap-12">
                {/* Staff List */}
                <EditableSection
                  sectionKey="serving_members"
                  sectionTitle="섬기는 분들"
                  user={currentUser}
                  onEditClick={(key) => handleOpenCmsEditModal(key, '섬기는 분들', {
                    pastors: '전병학, 유보배, 정동호(선교), 박승현(중고등부)',
                    elders: '박주현, (은퇴) 성재효, 성창규',
                    missionaries: '최성은(호주), 전용득(필리핀), 김바울(북방)'
                  })}
                >
                  {(() => {
                    const servingContent = getSectionContent('serving_members', {
                      pastors: '전병학, 유보배, 정동호(선교), 박승현(중고등부)',
                      elders: '박주현, (은퇴) 성재효, 성창규',
                      missionaries: '최성은(호주), 전용득(필리핀), 김바울(북방)'
                    });
                    return (
                      <div>
                        <h3 className="flex items-center gap-2 text-xl font-bold text-slate-800 mb-6">
                          <Users size={20} className="text-teal-600" />
                          섬기는 분들
                        </h3>
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4 min-h-[220px]">
                          <div className="flex flex-col sm:flex-row gap-2 pb-3 border-b border-slate-200 last:border-0 last:pb-0">
                            <strong className="text-slate-800 min-w-[100px] shrink-0 font-serif">부목사/강도사</strong>
                            <span className="text-slate-600 text-sm sm:text-base">{servingContent.pastors}</span>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 pb-3 border-b border-slate-200 last:border-0 last:pb-0">
                            <strong className="text-slate-800 min-w-[100px] shrink-0 font-serif">장로</strong>
                            <span className="text-slate-600 text-sm sm:text-base">{servingContent.elders}</span>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <strong className="text-slate-800 min-w-[100px] shrink-0 font-serif">파송선교사</strong>
                            <span className="text-slate-600 text-sm sm:text-base">{servingContent.missionaries}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </EditableSection>

                {/* Organizations List */}
                <EditableSection
                  sectionKey="partner_orgs"
                  sectionTitle="부설 기관 및 협력기관"
                  user={currentUser}
                  onEditClick={(key) => handleOpenCmsEditModal(key, '부설 기관 및 협력기관', {
                    attached: '창원섬김 부설 나눔상담연구소',
                    partners: '국내외 미자립교회 및 선교단체'
                  })}
                >
                  {(() => {
                    const orgContent = getSectionContent('partner_orgs', {
                      attached: '창원섬김 부설 나눔상담연구소',
                      partners: '국내외 미자립교회 및 선교단체'
                    });
                    return (
                      <div>
                        <h3 className="flex items-center gap-2 text-xl font-bold text-slate-800 mb-6">
                          <HandHeart size={20} className="text-rose-600" />
                          부설 기관 및 협력기관
                        </h3>
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4 min-h-[220px]">
                          <div className="flex flex-col sm:flex-row gap-2 pb-3 border-b border-slate-200">
                            <strong className="text-slate-800 min-w-[100px] shrink-0 font-serif">부설 기관</strong>
                            <span className="text-slate-600 text-sm sm:text-base">{orgContent.attached}</span>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <strong className="text-slate-800 min-w-[100px] shrink-0 font-serif">협력 기관</strong>
                            <span className="text-slate-600 text-sm sm:text-base">{orgContent.partners}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </EditableSection>
              </div>
            </div>

          </div>
        </section>

        {/* [한글 코멘트] 첨부 2: 예배 안내 및 첨부 3: 온라인 헌금 안내 영역 (EditableSection 감싸기 및 CMS 연동) */}
        <section id={NavSection.WORSHIP} className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            {/* 예배 안내 영역 */}
            <EditableSection
              sectionKey="worship_schedule"
              sectionTitle="예배 안내"
              user={currentUser}
              onEditClick={(key) => handleOpenCmsEditModal(key, '예배 안내', {
                title: '예배 안내',
                subtitle: '하나님과 만나는 감격스러운 시간으로 여러분을 초대합니다.',
                services: serviceTimes
              })}
            >
              {(() => {
                const worshipContent = getSectionContent('worship_schedule', {
                  title: '예배 안내',
                  subtitle: '하나님과 만나는 감격스러운 시간으로 여러분을 초대합니다.',
                  services: serviceTimes
                });
                const servicesList = worshipContent.services || serviceTimes;
                return (
                  <div>
                    <div className="text-center mb-12">
                      <h2 className="text-3xl font-serif font-bold text-slate-800">{worshipContent.title || '예배 안내'}</h2>
                      <p className="mt-4 text-slate-500 whitespace-pre-line">{worshipContent.subtitle}</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                      {servicesList.map((service: any, index: number) => (
                        <div key={index} className="group bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md hover:border-teal-200 transition-all duration-300">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-teal-50 text-teal-600 rounded-full group-hover:bg-teal-100 transition-colors">
                                <Clock size={16} />
                              </div>
                              <p className="text-sm font-serif text-rose-500 font-semibold">{service.time}</p>
                            </div>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full group-hover:bg-teal-50 group-hover:text-teal-700">
                              {service.location}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-slate-800">{service.name}</h3>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </EditableSection>

            {/* 온라인 헌금 안내 영역 */}
            <EditableSection
              sectionKey="online_offering"
              sectionTitle="온라인 헌금 안내"
              user={currentUser}
              onEditClick={(key) => handleOpenCmsEditModal(key, '온라인 헌금 안내', {
                title: '온라인 헌금 안내',
                accounts: [
                  { name: '교회 헌금', account: '2060-0054-8337', bank: '수협', holder: '대한예수교장로회창원섬김' },
                  { name: '섬김과 나눔의 집 (무료급식)', account: '351-1227-6333-03', bank: '농협', holder: '대한예수교장로회창원섬김' }
                ]
              })}
            >
              {(() => {
                const offeringContent = getSectionContent('online_offering', {
                  title: '온라인 헌금 안내',
                  accounts: [
                    { name: '교회 헌금', account: '2060-0054-8337', bank: '수협', holder: '대한예수교장로회창원섬김' },
                    { name: '섬김과 나눔의 집 (무료급식)', account: '351-1227-6333-03', bank: '농협', holder: '대한예수교장로회창원섬김' }
                  ]
                });
                const accountsList = offeringContent.accounts || [];
                return (
                  <div className="p-8 bg-blue-50 rounded-3xl text-center border border-blue-100 min-h-[220px]">
                    <div className="inline-flex p-4 bg-white rounded-full text-blue-500 mb-4 shadow-sm">
                      <HandHeart size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-blue-900 mb-6">{offeringContent.title || '온라인 헌금 안내'}</h3>

                    <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
                      {accountsList.map((acc: any, idx: number) => (
                        <div key={idx} className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                          <p className="text-blue-600 font-bold mb-1">{acc.name}</p>
                          <p className="text-lg font-bold text-slate-800">{acc.account} <span className="text-sm font-normal text-slate-500 ml-1">{acc.bank}</span></p>
                          <p className="text-xs text-slate-400 mt-1">예금주: {acc.holder}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </EditableSection>
          </div>
        </section>

        {/* Video & Praise Section */}
        <section id={NavSection.MEDIA}>
          <VideoSection />
        </section>

        {/* News Section */}
        <section id={NavSection.NEWS}>
          <NewsSection />
        </section>

        {/* Board Section */}
        <section id={NavSection.BOARD}>
          <BoardSection />
        </section>

        {/* Album Section */}
        <section id={NavSection.ALBUM}>
          <AlbumSection />
        </section>

        {/* Location Section */}
        <section id={NavSection.LOCATION} className="py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8 bg-white rounded-3xl shadow-lg overflow-hidden border border-slate-100">
              <div className="p-8 sm:p-12 flex flex-col justify-center bg-rose-50">
                <h2 className="text-3xl font-serif font-bold text-slate-800 mb-8">오시는 길</h2>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 p-2 bg-white rounded-full text-rose-500 shadow-sm">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">주소</p>
                      <p className="text-slate-600">창원시 의창구 도계두리길 116-1</p>
                      <p className="text-sm text-slate-400 mt-1">(우) 51163</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="mt-1 p-2 bg-white rounded-full text-rose-500 shadow-sm">
                      <Phone size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">전화번호</p>
                      <p className="text-slate-600 font-bold">055-273-8159</p>
                      <p className="text-slate-500 text-sm">055-288-8159 (행정실)</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="mt-1 p-2 bg-white rounded-full text-rose-500 shadow-sm">
                      <Mail size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">이메일</p>
                      <p className="text-slate-600">seomgim@foryou.me</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="mt-1 p-2 bg-white rounded-full text-rose-500 shadow-sm">
                      <Globe size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">홈페이지</p>
                      <p className="text-slate-600">seomgim.foryou.me</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-rose-100">
                  <p className="text-sm text-slate-500">
                    * 교회 주차장이 협소하오니 대중교통 이용을 권장합니다.
                  </p>
                </div>
              </div>

              <div className="bg-slate-200 h-96 md:h-auto min-h-[400px] relative">
                {/* Map Iframe */}
                <iframe
                  title="Church Location"
                  src="https://maps.google.com/maps?q=%EC%B0%BD%EC%9B%90%EC%8B%9C%20%EC%9D%98%EC%B0%BD%EA%B5%AC%20%EB%8F%84%EA%B3%84%EB%91%90%EB%A6%AC%EA%B8%B8%20116-1&t=m&z=17&output=embed&iwloc=near"
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />

                {/* External Map Buttons Overlay */}
                <div className="absolute bottom-4 left-4 right-4 flex gap-2 justify-center z-10">
                  <a
                    href="https://map.naver.com/p/search/%EC%B0%BD%EC%9B%90%EC%8B%9C%20%EC%9D%98%EC%B0%BD%EA%B5%AC%20%EB%8F%84%EA%B3%84%EB%91%90%EB%A6%AC%EA%B8%B8%20116-1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#03C75A] text-white rounded-lg shadow-lg text-sm font-bold hover:bg-[#02b351] transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
                  >
                    네이버 지도
                  </a>
                  <a
                    href="https://map.kakao.com/link/search/창원시 의창구 도계두리길 116-1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#FAE100] text-[#3c1e1e] rounded-lg shadow-lg text-sm font-bold hover:bg-[#eacb00] transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
                  >
                    카카오 맵
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4 text-white">
                <ChurchLogo className="w-10 h-10 bg-white rounded-full p-0.5" />
                <span className="font-serif font-bold text-xl">창원섬김의교회</span>
              </div>
              <p className="text-sm text-slate-400">
                대한예수교 장로회<br />
                담임목사: 박신철
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">주요 예배</h3>
              <ul className="text-sm space-y-2 text-slate-400">
                <li>주일 오전예배: 11:00</li>
                <li>주일 찬양예배: 14:00</li>
                <li>수요 밤 예배: 19:30</li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">연락처</h3>
              <ul className="text-sm space-y-2 text-slate-400">
                <li>창원시 의창구 도계두리길 116-1</li>
                <li>Tel: 055-273-8159</li>
                <li>Email: seomgim@foryou.me</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-700 pt-8 text-center text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Changwon Seomgim Church. All rights reserved.
          </div>
        </div>
      </footer>

      {/* [한글 코멘트] 슈퍼관리자 전용 CMS 영역 내용 편집 및 이력/복구 모달창 */}
      <SectionEditModal
        isOpen={cmsEditModal.isOpen}
        onClose={() => setCmsEditModal(prev => ({ ...prev, isOpen: false }))}
        sectionKey={cmsEditModal.sectionKey}
        sectionTitle={cmsEditModal.sectionTitle}
        initialData={cmsEditModal.initialData}
        initialTab={cmsEditModal.initialTab}
        onSaved={(updatedSection) => {
          updateSectionState(updatedSection);
        }}
      />

      {/* 알림 모달 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        message={alertModal.message}
        type={alertModal.type}
        onConfirm={alertModal.onConfirm}
      />
    </div>
  );
};

export default App;