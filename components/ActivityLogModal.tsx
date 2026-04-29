// 사용자 활동 로그 조회 모달 (최고관리자만)
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Clock, User, Activity, BarChart3, Download, MapPin } from 'lucide-react';
import { getSessions, getActivities, getStatistics, getIPStatistics, UserSession, UserActivity, IPStatistics, IPActivityStatistics } from '../services/activityApi';
import { getUserInfo, hasRole } from '../services/authApi';
import { useModalBackButton } from '../hooks/useModalBackButton';

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'sessions' | 'activities' | 'statistics' | 'ip-analysis';

const ActivityLogModal: React.FC<ActivityLogModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('sessions');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 세션 목록
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionTotalPages, setSessionTotalPages] = useState(1);
  
  // 활동 목록
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  
  // 통계
  const [statistics, setStatistics] = useState<any>(null);
  
  // IP 통계
  const [ipStatistics, setIpStatistics] = useState<IPStatistics[]>([]);
  const [ipActivityStatistics, setIpActivityStatistics] = useState<IPActivityStatistics[]>([]);
  
  // 필터
  const [filters, setFilters] = useState({
    user_id: '',
    start_date: '',
    end_date: '',
    activity_type: ''
  });

  const user = getUserInfo();

  useEffect(() => {
    if (isOpen && user && hasRole(user, 'super-admin')) {
      loadData();
    }
  }, [isOpen, activeTab, sessionPage, activityPage, filters]);

  const loadData = async () => {
    if (!user || !hasRole(user, 'super-admin')) {
      setError('최고관리자만 접근할 수 있습니다.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (activeTab === 'sessions') {
        const result = await getSessions({
          user_id: filters.user_id ? parseInt(filters.user_id) : undefined,
          start_date: filters.start_date || undefined,
          end_date: filters.end_date || undefined,
          page: sessionPage,
          limit: 20
        });
        if (result.data) {
          setSessions(result.data.sessions);
          setSessionTotalPages(result.data.pagination.totalPages);
        }
      } else if (activeTab === 'activities') {
        const result = await getActivities({
          user_id: filters.user_id ? parseInt(filters.user_id) : undefined,
          activity_type: filters.activity_type || undefined,
          start_date: filters.start_date || undefined,
          end_date: filters.end_date || undefined,
          page: activityPage,
          limit: 50
        });
        if (result.data) {
          setActivities(result.data.activities);
          setActivityTotalPages(result.data.pagination.totalPages);
        }
      } else if (activeTab === 'statistics') {
        const result = await getStatistics({
          user_id: filters.user_id ? parseInt(filters.user_id) : undefined,
          start_date: filters.start_date || undefined,
          end_date: filters.end_date || undefined
        });
        if (result.data) {
          setStatistics(result.data);
        }
      } else if (activeTab === 'ip-analysis') {
        const result = await getIPStatistics({
          start_date: filters.start_date || undefined,
          end_date: filters.end_date || undefined
        });
        if (result.data) {
          setIpStatistics(result.data.ip_statistics);
          setIpActivityStatistics(result.data.ip_activity_statistics);
        }
      }
    } catch (err: any) {
      setError(err.message || '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 날짜 포맷팅 (한국 시간대 적용)
  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Seoul' // 한국 시간대 적용
    });
  };

  // 시간 포맷팅 (초를 시:분:초로)
  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}시간 ${minutes}분 ${secs}초`;
    } else if (minutes > 0) {
      return `${minutes}분 ${secs}초`;
    } else {
      return `${secs}초`;
    }
  };

  // 모달이 열릴 때 body 스크롤 막기
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // 모바일 뒤로 가기 버튼으로 모달 닫기
  useModalBackButton({ isOpen, onClose });

  if (!isOpen) return null;

  if (!user || !hasRole(user, 'super-admin')) {
    return null;
  }

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
    >
      <div 
        className="bg-white rounded-3xl p-6 max-w-7xl w-full mx-4 shadow-2xl relative max-h-[90vh] overflow-y-auto"
      >
        {/* 닫기 버튼 - 모달 내부 우측 상단 고정 (스크롤과 무관하게 항상 표시) */}
        <button
          onClick={onClose}
          className="sticky top-0 float-right -mr-6 -mt-6 mb-4 w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors z-[10002] shadow-lg"
          aria-label="닫기"
          title="닫기 (ESC)"
        >
          <X size={24} className="text-white" />
        </button>

        <div className="pr-12">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">사용자 활동 로그</h2>

          {/* 탭 */}
          <div className="flex gap-2 mb-6 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-4 py-2 font-semibold transition-colors ${
                activeTab === 'sessions'
                  ? 'text-teal-600 border-b-2 border-teal-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Clock size={18} className="inline mr-2" />
              세션 로그
            </button>
            <button
              onClick={() => setActiveTab('activities')}
              className={`px-4 py-2 font-semibold transition-colors ${
                activeTab === 'activities'
                  ? 'text-teal-600 border-b-2 border-teal-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Activity size={18} className="inline mr-2" />
              활동 로그
            </button>
            <button
              onClick={() => setActiveTab('statistics')}
              className={`px-4 py-2 font-semibold transition-colors ${
                activeTab === 'statistics'
                  ? 'text-teal-600 border-b-2 border-teal-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <BarChart3 size={18} className="inline mr-2" />
              통계
            </button>
            <button
              onClick={() => setActiveTab('ip-analysis')}
              className={`px-4 py-2 font-semibold transition-colors ${
                activeTab === 'ip-analysis'
                  ? 'text-teal-600 border-b-2 border-teal-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <MapPin size={18} className="inline mr-2" />
              IP 분석
            </button>
          </div>

          {/* 필터 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">사용자 ID</label>
              <input
                type="number"
                value={filters.user_id}
                onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                placeholder="전체"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">시작일</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">종료일</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            {activeTab === 'activities' && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">활동 유형</label>
                <select
                  value={filters.activity_type}
                  onChange={(e) => setFilters({ ...filters, activity_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">전체</option>
                  <option value="menu_click">메뉴 클릭</option>
                  <option value="page_view">페이지 조회</option>
                </select>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mb-4"></div>
              <p className="text-slate-500">데이터를 불러오는 중...</p>
            </div>
          ) : (
            <>
              {/* 세션 로그 */}
              {activeTab === 'sessions' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-4 py-3 text-left">사용자</th>
                        <th className="px-4 py-3 text-left">로그인 시간</th>
                        <th className="px-4 py-3 text-left">로그아웃 시간</th>
                        <th className="px-4 py-3 text-left">이용시간</th>
                        <th className="px-4 py-3 text-left">IP 주소</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((session) => (
                        <tr key={session.session_id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div>
                              <div className="font-semibold">{session.name} ({session.nickname})</div>
                              <div className="text-xs text-slate-500">{session.username}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3">{formatDateTime(session.login_time)}</td>
                          <td className="px-4 py-3">
                            {session.logout_time ? formatDateTime(session.logout_time) : <span className="text-slate-400">진행 중</span>}
                          </td>
                          <td className="px-4 py-3">{formatDuration(session.session_duration)}</td>
                          <td className="px-4 py-3">{session.ip_address}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sessions.length === 0 && (
                    <div className="text-center py-16 text-slate-400">
                      <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                      <p>세션 로그가 없습니다.</p>
                    </div>
                  )}
                  {sessionTotalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                      <button
                        onClick={() => setSessionPage(prev => Math.max(1, prev - 1))}
                        disabled={sessionPage === 1}
                        className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        이전
                      </button>
                      <span className="px-4 py-2">
                        {sessionPage} / {sessionTotalPages}
                      </span>
                      <button
                        onClick={() => setSessionPage(prev => Math.min(sessionTotalPages, prev + 1))}
                        disabled={sessionPage === sessionTotalPages}
                        className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        다음
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 활동 로그 */}
              {activeTab === 'activities' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-4 py-3 text-left">사용자/IP</th>
                        <th className="px-4 py-3 text-left">활동 유형</th>
                        <th className="px-4 py-3 text-left">활동 이름</th>
                        <th className="px-4 py-3 text-left">시간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities.map((activity) => (
                        <tr key={activity.activity_id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3">
                            {activity.user_id ? (
                              <div>
                                <div className="font-semibold">{activity.name} ({activity.nickname})</div>
                                <div className="text-xs text-slate-500">{activity.username}</div>
                                {activity.ip_address && (
                                  <div className="text-xs text-slate-400 font-mono mt-1">IP: {activity.ip_address}</div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <div className="font-semibold text-slate-500">비로그인 사용자</div>
                                {activity.ip_address && (
                                  <div className="text-xs text-slate-600 font-mono mt-1">IP: {activity.ip_address}</div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-teal-100 text-teal-700 rounded text-xs">
                              {activity.activity_type}
                            </span>
                          </td>
                          <td className="px-4 py-3">{activity.activity_name}</td>
                          <td className="px-4 py-3">{formatDateTime(activity.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {activities.length === 0 && (
                    <div className="text-center py-16 text-slate-400">
                      <Activity size={48} className="mx-auto mb-4 opacity-20" />
                      <p>활동 로그가 없습니다.</p>
                    </div>
                  )}
                  {activityTotalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                      <button
                        onClick={() => setActivityPage(prev => Math.max(1, prev - 1))}
                        disabled={activityPage === 1}
                        className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        이전
                      </button>
                      <span className="px-4 py-2">
                        {activityPage} / {activityTotalPages}
                      </span>
                      <button
                        onClick={() => setActivityPage(prev => Math.min(activityTotalPages, prev + 1))}
                        disabled={activityPage === activityTotalPages}
                        className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        다음
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 통계 */}
              {activeTab === 'statistics' && statistics && (
                <div className="space-y-6">
                  {/* 세션 통계 */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4">사용자별 세션 통계</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="px-4 py-3 text-left">사용자</th>
                            <th className="px-4 py-3 text-left">총 세션 수</th>
                            <th className="px-4 py-3 text-left">총 이용시간</th>
                            <th className="px-4 py-3 text-left">평균 이용시간</th>
                            <th className="px-4 py-3 text-left">첫 로그인</th>
                            <th className="px-4 py-3 text-left">마지막 로그인</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statistics.session_statistics.map((stat: any, index: number) => (
                            <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <div>
                                  <div className="font-semibold">{stat.name} ({stat.nickname})</div>
                                  <div className="text-xs text-slate-500">{stat.username}</div>
                                </div>
                              </td>
                              <td className="px-4 py-3">{stat.total_sessions || 0}</td>
                              <td className="px-4 py-3">{formatDuration(stat.total_duration)}</td>
                              <td className="px-4 py-3">{formatDuration(stat.avg_duration)}</td>
                              <td className="px-4 py-3">{stat.first_login ? formatDateTime(stat.first_login) : '-'}</td>
                              <td className="px-4 py-3">{stat.last_login ? formatDateTime(stat.last_login) : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 활동 통계 */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4">활동 유형별 통계</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="px-4 py-3 text-left">활동 유형</th>
                            <th className="px-4 py-3 text-left">활동 이름</th>
                            <th className="px-4 py-3 text-left">횟수</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statistics.activity_statistics.map((stat: any, index: number) => (
                            <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <span className="px-2 py-1 bg-teal-100 text-teal-700 rounded text-xs">
                                  {stat.activity_type}
                                </span>
                              </td>
                              <td className="px-4 py-3">{stat.activity_name}</td>
                              <td className="px-4 py-3 font-semibold">{stat.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* IP 분석 */}
              {activeTab === 'ip-analysis' && (
                <div className="space-y-6">
                  {/* IP별 세션 통계 */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4">IP 주소별 세션 통계</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="px-4 py-3 text-left">IP 주소</th>
                            <th className="px-4 py-3 text-left">접속 지역</th>
                            <th className="px-4 py-3 text-left">고유 사용자</th>
                            <th className="px-4 py-3 text-left">총 세션 수</th>
                            <th className="px-4 py-3 text-left">총 이용시간</th>
                            <th className="px-4 py-3 text-left">평균 이용시간</th>
                            <th className="px-4 py-3 text-left">첫 접속</th>
                            <th className="px-4 py-3 text-left">마지막 접속</th>
                            <th className="px-4 py-3 text-left">사용자 목록</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ipStatistics.map((stat, index) => (
                            <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <div className="font-mono text-xs">{stat.ip_address}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-xs">
                                  <div className="font-semibold text-slate-800 mb-1">
                                    {stat.location.locationDetail || 
                                      `${stat.location.country}${stat.location.region !== stat.location.country ? ` > ${stat.location.region}` : ''}${stat.location.city && stat.location.city !== stat.location.region ? ` > ${stat.location.city}` : ''}`}
                                  </div>
                                  {stat.location.latitude && stat.location.longitude && (
                                    <div className="text-slate-500 text-xs mt-1">
                                      좌표: {stat.location.latitude.toFixed(4)}, {stat.location.longitude.toFixed(4)}
                                    </div>
                                  )}
                                  <div className="text-slate-500 mt-1">
                                    <div>ISP: {stat.location.isp}</div>
                                    {stat.location.org && stat.location.org !== stat.location.isp && (
                                      <div className="text-xs">조직: {stat.location.org}</div>
                                    )}
                                    {stat.location.asname && (
                                      <div className="text-xs">AS: {stat.location.asname} ({stat.location.as})</div>
                                    )}
                                  </div>
                                  <div className="text-slate-400 text-xs mt-1">
                                    타임존: {stat.location.timezone}
                                    {stat.location.countryCode && (
                                      <span className="ml-2">({stat.location.countryCode})</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-semibold">{stat.unique_users}</td>
                              <td className="px-4 py-3">{stat.total_sessions}</td>
                              <td className="px-4 py-3">{formatDuration(stat.total_duration)}</td>
                              <td className="px-4 py-3">{formatDuration(stat.avg_duration)}</td>
                              <td className="px-4 py-3 text-xs">{formatDateTime(stat.first_access)}</td>
                              <td className="px-4 py-3 text-xs">{formatDateTime(stat.last_access)}</td>
                              <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate" title={stat.user_names}>
                                {stat.user_names}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {ipStatistics.length === 0 && (
                        <div className="text-center py-16 text-slate-400">
                          <MapPin size={48} className="mx-auto mb-4 opacity-20" />
                          <p>IP 통계 데이터가 없습니다.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* IP별 활동 통계 */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4">IP 주소별 활동 통계 (로그인/비로그인 사용자 모두 포함)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="px-4 py-3 text-left">IP 주소</th>
                            <th className="px-4 py-3 text-left">접속 지역</th>
                            <th className="px-4 py-3 text-left">고유 사용자</th>
                            <th className="px-4 py-3 text-left">총 활동 수</th>
                            <th className="px-4 py-3 text-left">활동 유형 수</th>
                            <th className="px-4 py-3 text-left">첫 접속</th>
                            <th className="px-4 py-3 text-left">마지막 접속</th>
                            <th className="px-4 py-3 text-left">사용자 목록</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ipActivityStatistics.map((stat, index) => (
                            <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <div className="font-mono text-xs">{stat.ip_address}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-xs">
                                  <div className="font-semibold text-slate-800 mb-1">
                                    {stat.location.locationDetail || 
                                      `${stat.location.country}${stat.location.region !== stat.location.country ? ` > ${stat.location.region}` : ''}${stat.location.city && stat.location.city !== stat.location.region ? ` > ${stat.location.city}` : ''}`}
                                  </div>
                                  {stat.location.latitude && stat.location.longitude && (
                                    <div className="text-slate-500 text-xs mt-1">
                                      좌표: {stat.location.latitude.toFixed(4)}, {stat.location.longitude.toFixed(4)}
                                    </div>
                                  )}
                                  <div className="text-slate-500 mt-1">
                                    <div>ISP: {stat.location.isp}</div>
                                    {stat.location.org && stat.location.org !== stat.location.isp && (
                                      <div className="text-xs">조직: {stat.location.org}</div>
                                    )}
                                    {stat.location.asname && (
                                      <div className="text-xs">AS: {stat.location.asname} ({stat.location.as})</div>
                                    )}
                                  </div>
                                  <div className="text-slate-400 text-xs mt-1">
                                    타임존: {stat.location.timezone}
                                    {stat.location.countryCode && (
                                      <span className="ml-2">({stat.location.countryCode})</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-semibold">{stat.unique_users || 0}</td>
                              <td className="px-4 py-3 font-semibold">{stat.total_activities}</td>
                              <td className="px-4 py-3">{stat.activity_types}</td>
                              <td className="px-4 py-3 text-xs">{stat.first_access ? formatDateTime(stat.first_access) : '-'}</td>
                              <td className="px-4 py-3 text-xs">{stat.last_access ? formatDateTime(stat.last_access) : '-'}</td>
                              <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate" title={stat.user_names || ''}>
                                {stat.user_names || <span className="text-slate-400">비로그인 사용자</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {ipActivityStatistics.length === 0 && (
                        <div className="text-center py-16 text-slate-400">
                          <Activity size={48} className="mx-auto mb-4 opacity-20" />
                          <p>IP 활동 통계 데이터가 없습니다.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ActivityLogModal;

