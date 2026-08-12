// [한글 코멘트] 사용자 요청: 관리자 권한 전용 설문조사 수정 모달 컴포넌트
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { updateSurvey, Survey } from '../services/surveyApi';
import { useModalBackButton } from '../hooks/useModalBackButton';
import HtmlToolbar from './HtmlToolbar';

interface SurveyEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  survey: Survey | null;
}

const SurveyEditModal: React.FC<SurveyEditModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  survey
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    is_active: true,
    is_anonymous: false,
    target_type: 'anyone' as 'anyone' | 'authenticated' | 'authenticated_anonymous',
    start_date: '',
    end_date: '',
    end_condition_type: 'date' as 'date' | 'count' | 'percentage',
    end_count: '',
    end_percentage: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // [한글 코멘트] 리치 텍스트 서식 툴바(HtmlToolbar) 연동을 위한 Ref
  const contentEditableRef = useRef<HTMLDivElement>(null);

  const updateDescriptionFromEditable = () => {
    if (contentEditableRef.current) {
      const htmlContent = contentEditableRef.current.innerHTML;
      setFormData(prev => ({ ...prev, description: htmlContent }));
    }
  };

  // [한글 코멘트] 모달 오픈 시 선택한 설문조사의 기존 정보 바인딩
  useEffect(() => {
    if (survey) {
      // ISO 날짜 문자열 YYYY-MM-DDTHH:mm 형태로 포맷팅
      const formatDateForInput = (dateStr: string | null) => {
        if (!dateStr) return '';
        try {
          const date = new Date(dateStr);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (e) {
          return '';
        }
      };

      const initialDesc = survey.description || '';
      setFormData({
        title: survey.title || '',
        description: initialDesc,
        is_active: survey.is_active !== undefined ? survey.is_active : true,
        is_anonymous: survey.is_anonymous || false,
        target_type: survey.target_type || 'anyone',
        start_date: formatDateForInput(survey.start_date),
        end_date: formatDateForInput(survey.end_date),
        end_condition_type: survey.end_condition_type || 'date',
        end_count: survey.end_count ? String(survey.end_count) : '',
        end_percentage: survey.end_percentage ? String(survey.end_percentage) : ''
      });

      if (contentEditableRef.current) {
        contentEditableRef.current.innerHTML = initialDesc;
      }
    }
  }, [survey, isOpen]);

  // [한글 코멘트] 뒤로가기 훅 연동
  useModalBackButton(isOpen, onClose);

  if (!isOpen || !survey) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError('설문조사 제목을 입력해주세요.');
      return;
    }

    if (formData.end_condition_type === 'date' && (!formData.start_date || !formData.end_date)) {
      setError('시작일과 종료일을 입력해주세요.');
      return;
    }

    if (formData.end_condition_type === 'count' && (!formData.end_count || parseInt(formData.end_count) < 1)) {
      setError('종료 인원수를 1명 이상 입력해주세요.');
      return;
    }

    if (formData.end_condition_type === 'percentage' && (!formData.end_percentage || parseFloat(formData.end_percentage) <= 0 || parseFloat(formData.end_percentage) > 100)) {
      setError('종료 비율을 1-100 사이로 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      // [한글 코멘트] 백엔드 PUT /api/surveys/:id 수정 API 호출
      await updateSurvey(survey.survey_id, {
        title: formData.title,
        description: formData.description,
        is_active: formData.is_active,
        is_anonymous: formData.is_anonymous,
        target_type: formData.target_type,
        start_date: formData.start_date && formData.start_date.trim() !== '' ? formData.start_date : null,
        end_date: formData.end_date && formData.end_date.trim() !== '' ? formData.end_date : null,
        end_condition_type: formData.end_condition_type,
        end_count: formData.end_count ? parseInt(formData.end_count) : null,
        end_percentage: formData.end_percentage ? parseFloat(formData.end_percentage) : null
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('설문조사 수정 처리 오류:', err);
      setError(err.message || '설문조사 수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* 모달 헤더 */}
        <div className="p-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-between">
          <h2 className="text-xl font-bold">설문조사 수정</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form 본문 */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-sm font-medium">
              {error}
            </div>
          )}

          {/* 제목 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              설문조사 제목 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="예: 2026년 상반기 교우 만족도 조사"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-800"
              required
            />
          </div>

          {/* 설명 본문 (줄바꿈 포함) */}
          {/* [한글 코멘트] 사용자 요청: 기본적인 글자 색상, 크기, 굵기, 이탤릭체 지정이 가능한 서식 툴바 연동 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              설문조사 상세 설명 서식 편집
            </label>
            <div className="border border-slate-200 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-purple-400 focus-within:border-transparent transition-all">
              <HtmlToolbar targetRef={contentEditableRef} onContentChange={updateDescriptionFromEditable} />
              <div
                ref={contentEditableRef}
                contentEditable
                onBlur={updateDescriptionFromEditable}
                onInput={updateDescriptionFromEditable}
                className="w-full min-h-[140px] max-h-[300px] overflow-y-auto px-4 py-3 bg-white text-slate-800 text-sm focus:outline-none leading-relaxed"
                style={{ whiteSpace: 'pre-wrap' }}
                data-placeholder="설문조사 상세 설명과 폰트 서식, 글자 색상, 기울임체, 하이퍼링크를 입력하세요"
              />
            </div>
          </div>

          {/* 설문 상태 & 익명 설정 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">설문 진행 상태</label>
              <select
                name="is_active"
                value={formData.is_active ? 'true' : 'false'}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-800 bg-white"
              >
                <option value="true">진행중 (활성)</option>
                <option value="false">종료됨 (비활성)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">익명성 설정</label>
              <div className="flex items-center mt-3">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium text-sm">
                  <input
                    type="checkbox"
                    name="is_anonymous"
                    checked={formData.is_anonymous}
                    onChange={handleChange}
                    className="w-5 h-5 text-purple-500 rounded focus:ring-purple-400"
                  />
                  익명 설문조사로 진행
                </label>
              </div>
            </div>
          </div>

          {/* 대상 구분 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">참여 대상</label>
            <select
              name="target_type"
              value={formData.target_type}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-800 bg-white"
            >
              <option value="anyone">모든 방문자 (누구나)</option>
              <option value="authenticated">로그인한 회원 (실명)</option>
              <option value="authenticated_anonymous">로그인한 회원 (익명 보장)</option>
            </select>
          </div>

          {/* 종료 조건 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">마감 기준 조건</label>
            <select
              name="end_condition_type"
              value={formData.end_condition_type}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-800 bg-white mb-4"
            >
              <option value="date">특정 기간 (시작일 ~ 종료일)</option>
              <option value="count">목표 응답 인원수 달성 시 종료</option>
              <option value="percentage">목표 등록 교인 비율 달성 시 종료</option>
            </select>

            {formData.end_condition_type === 'date' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">시작일시</label>
                  <input
                    type="datetime-local"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">종료일시</label>
                  <input
                    type="datetime-local"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-800 text-sm"
                  />
                </div>
              </div>
            )}

            {formData.end_condition_type === 'count' && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">목표 인원수 (명)</label>
                <input
                  type="number"
                  name="end_count"
                  value={formData.end_count}
                  onChange={handleChange}
                  placeholder="예: 50"
                  min="1"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-800 text-sm"
                />
              </div>
            )}

            {formData.end_condition_type === 'percentage' && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">목표 비율 (%)</label>
                <input
                  type="number"
                  name="end_percentage"
                  value={formData.end_percentage}
                  onChange={handleChange}
                  placeholder="예: 80"
                  min="1"
                  max="100"
                  step="0.1"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-800 text-sm"
                />
              </div>
            )}
          </div>

          {/* 버튼 하단 바 */}
          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold hover:from-purple-600 hover:to-pink-600 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? '수정 저장 중...' : '수정 완료'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default SurveyEditModal;
