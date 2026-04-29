// 설문조사 섹션 컴포넌트
import React, { useState, useEffect } from 'react';
import { ClipboardList, PlusCircle, Calendar, Users, Eye, X, Trash2 } from 'lucide-react';
import { getSurveys, Survey, cancelSurvey, deleteSurvey } from '../services/surveyApi';
import { getUserInfo, hasRole, User as UserType } from '../services/authApi';
import SurveyDetailModal from './SurveyDetailModal';
import SurveyWriteModal from './SurveyWriteModal';
import AlertModal from './AlertModal';

const SurveySection: React.FC = () => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ended'>('active');
  const [cancelModal, setCancelModal] = useState<{ isOpen: boolean; surveyId: number | null; surveyTitle: string }>({
    isOpen: false,
    surveyId: null,
    surveyTitle: ''
  });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; surveyId: number | null; surveyTitle: string }>({
    isOpen: false,
    surveyId: null,
    surveyTitle: ''
  });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const userInfo = getUserInfo();
    setUser(userInfo);
    loadSurveys();
  }, [statusFilter]);

  const loadSurveys = async () => {
    setLoading(true);
    try {
      const result = await getSurveys({ status: statusFilter, limit: 20 });
      setSurveys(result.surveys);
    } catch (error) {
      console.error('설문조사 로드 오류:', error);
      setSurveys([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // 한국 시간대 기준으로 날짜 포맷팅
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    return `${year}.${month}.${day}`;
  };

  const isActive = (survey: Survey) => {
    if (!survey.is_active) return false;
    
    // 한국 시간대 기준으로 날짜만 추출하여 비교
    const koreaTimeZone = 'Asia/Seoul';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: koreaTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    // 날짜 문자열을 YYYY-MM-DD 형식으로 변환하는 헬퍼 함수
    const formatDateOnly = (d: Date) => {
      const parts = formatter.formatToParts(d);
      const year = parts.find(p => p.type === 'year')?.value || '';
      const month = parts.find(p => p.type === 'month')?.value || '';
      const day = parts.find(p => p.type === 'day')?.value || '';
      return `${year}-${month}-${day}`;
    };
    
    const now = new Date();
    const nowOnly = formatDateOnly(now);
    const nowObj = new Date(nowOnly + 'T00:00:00+09:00');
    
    if (survey.start_date) {
      const startDate = new Date(survey.start_date);
      const startOnly = formatDateOnly(startDate);
      const startObj = new Date(startOnly + 'T00:00:00+09:00');
      if (startObj > nowObj) return false;
    }
    if (survey.end_date) {
      const endDate = new Date(survey.end_date);
      const endOnly = formatDateOnly(endDate);
      const endObj = new Date(endOnly + 'T23:59:59+09:00'); // 종료일은 하루의 끝까지
      if (endObj < nowObj) return false;
    }
    return true;
  };

  const handleCancelSurvey = async () => {
    if (!cancelModal.surveyId) return;
    
    setProcessing(true);
    setError('');
    
    try {
      await cancelSurvey(cancelModal.surveyId);
      setCancelModal({ isOpen: false, surveyId: null, surveyTitle: '' });
      loadSurveys();
    } catch (err: any) {
      setError(err.message || '설문조사 취소에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteSurvey = async () => {
    if (!deleteModal.surveyId) return;
    
    setProcessing(true);
    setError('');
    
    try {
      await deleteSurvey(deleteModal.surveyId);
      setDeleteModal({ isOpen: false, surveyId: null, surveyTitle: '' });
      loadSurveys();
    } catch (err: any) {
      setError(err.message || '설문조사 삭제에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 py-24" id="survey">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center p-3 mb-4 bg-white/80 backdrop-blur-sm rounded-full text-purple-500 shadow-sm border border-purple-100">
            <ClipboardList size={24} />
          </div>
          <h2 className="text-3xl font-serif font-bold text-slate-800">설문조사</h2>
          <p className="mt-4 text-slate-600">교회의 의견을 듣는 공간입니다</p>
          
          {/* 관리자 이상만 작성 버튼 표시 */}
          {user && hasRole(user, 'admin', 'super-admin') && (
            <div className="mt-6">
              <button
                onClick={() => setShowWriteModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-white rounded-full font-semibold hover:bg-teal-600 transition-all shadow-md hover:shadow-lg"
              >
                <PlusCircle size={20} />
                설문조사 작성
              </button>
            </div>
          )}
        </div>

        {/* 필터 탭 */}
        <div className="flex gap-3 mb-8 justify-center">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-6 py-2 rounded-xl font-semibold transition-all ${
              statusFilter === 'all'
                ? 'bg-gradient-to-r from-purple-400 to-pink-400 text-white shadow-lg shadow-purple-200'
                : 'bg-white/80 backdrop-blur-sm text-slate-700 border-2 border-purple-100 hover:bg-purple-50 hover:border-purple-200'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-6 py-2 rounded-xl font-semibold transition-all ${
              statusFilter === 'active'
                ? 'bg-gradient-to-r from-purple-400 to-pink-400 text-white shadow-lg shadow-purple-200'
                : 'bg-white/80 backdrop-blur-sm text-slate-700 border-2 border-purple-100 hover:bg-purple-50 hover:border-purple-200'
            }`}
          >
            진행중
          </button>
          <button
            onClick={() => setStatusFilter('ended')}
            className={`px-6 py-2 rounded-xl font-semibold transition-all ${
              statusFilter === 'ended'
                ? 'bg-gradient-to-r from-purple-400 to-pink-400 text-white shadow-lg shadow-purple-200'
                : 'bg-white/80 backdrop-blur-sm text-slate-700 border-2 border-purple-100 hover:bg-purple-50 hover:border-purple-200'
            }`}
          >
            종료됨
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mb-4"></div>
            <p className="text-slate-600">설문조사를 불러오는 중...</p>
          </div>
        ) : surveys.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <ClipboardList size={48} className="mx-auto mb-4 opacity-30 text-purple-300" />
            <p className="text-lg font-medium">설문조사가 없습니다</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {surveys.map((survey) => (
              <div
                key={survey.survey_id}
                className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-sm border-2 border-purple-100/50 hover:shadow-lg hover:border-purple-300 hover:bg-white transition-all duration-300 relative"
              >
                {/* 취소/삭제 버튼 (관리자만 표시) */}
                {user && hasRole(user, 'admin', 'super-admin') && (
                  <div className="absolute top-3 right-3 flex gap-2 z-10">
                    {survey.is_active ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCancelModal({
                            isOpen: true,
                            surveyId: survey.survey_id,
                            surveyTitle: survey.title
                          });
                        }}
                        className="p-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-md transition-colors"
                        title="설문조사 취소"
                      >
                        <X size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteModal({
                            isOpen: true,
                            surveyId: survey.survey_id,
                            surveyTitle: survey.title
                          });
                        }}
                        className="p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full shadow-md transition-colors"
                        title="설문조사 삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                )}

                <div
                  onClick={() => {
                    setSelectedSurveyId(survey.survey_id);
                    setShowDetailModal(true);
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4 pr-12">
                    <h3 className="text-lg font-bold text-slate-800 line-clamp-2 flex-1">
                      {survey.title}
                    </h3>
                    {isActive(survey) ? (
                      <span className="ml-2 px-3 py-1 bg-gradient-to-r from-purple-200 to-pink-200 text-purple-700 rounded-full text-xs font-semibold whitespace-nowrap shadow-sm">
                        진행중
                      </span>
                    ) : (
                      <span className="ml-2 px-3 py-1 bg-slate-200 text-slate-600 rounded-full text-xs font-semibold whitespace-nowrap shadow-sm">
                        취소됨
                      </span>
                    )}
                  </div>
                
                {survey.description && (
                  <p className="text-slate-700 text-sm mb-4 line-clamp-2 leading-relaxed">
                    {survey.description}
                  </p>
                )}
                
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-full">
                    <Users size={14} className="text-purple-500" />
                    <span className="font-medium">{survey.response_count}명 참여</span>
                  </div>
                  <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-full">
                    <Calendar size={14} className="text-blue-500" />
                    <span className="font-medium">{formatDate(survey.created_at)}</span>
                  </div>
                </div>
                
                  {survey.is_anonymous && (
                    <div className="mt-3 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full inline-block">
                      🔒 익명 설문
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 오류 메시지 */}
        {error && (
          <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-center">
            {error}
          </div>
        )}
      </div>

      {/* 취소 확인 모달 */}
      <AlertModal
        isOpen={cancelModal.isOpen}
        onClose={() => {
          if (!processing) {
            setCancelModal({ isOpen: false, surveyId: null, surveyTitle: '' });
          }
        }}
        title="설문조사 취소"
        message={`"${cancelModal.surveyTitle}" 설문조사를 취소하시겠습니까?\n\n취소된 설문조사는 더 이상 응답을 받을 수 없으며, 취소 후에는 삭제할 수 있습니다.`}
        confirmText="취소하기"
        showCancel={true}
        cancelText="닫기"
        onConfirm={handleCancelSurvey}
        isDanger={true}
        isLoading={processing}
      />

      {/* 삭제 확인 모달 */}
      <AlertModal
        isOpen={deleteModal.isOpen}
        onClose={() => {
          if (!processing) {
            setDeleteModal({ isOpen: false, surveyId: null, surveyTitle: '' });
          }
        }}
        title="설문조사 삭제"
        message={`"${deleteModal.surveyTitle}" 설문조사를 삭제하시겠습니까?\n\n⚠️ 경고: 삭제된 설문조사는 복구할 수 없으며, 모든 응답 데이터도 함께 삭제됩니다.`}
        confirmText="삭제하기"
        showCancel={true}
        cancelText="닫기"
        onConfirm={handleDeleteSurvey}
        isDanger={true}
        isLoading={processing}
      />

      {/* 설문조사 작성 모달 */}
      {user && hasRole(user, 'admin', 'super-admin') && (
        <SurveyWriteModal
          isOpen={showWriteModal}
          onClose={() => setShowWriteModal(false)}
          onSuccess={() => {
            loadSurveys();
            setShowWriteModal(false);
          }}
        />
      )}

      {/* 설문조사 상세 모달 */}
      <SurveyDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedSurveyId(null);
        }}
        surveyId={selectedSurveyId || 0}
        onUpdate={() => {
          loadSurveys();
        }}
      />
    </div>
  );
};

export default SurveySection;

