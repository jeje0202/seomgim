// 설문조사 작성 모달 컴포넌트
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2 } from 'lucide-react';
import { createSurvey } from '../services/surveyApi';
import { useModalBackButton } from '../hooks/useModalBackButton';

interface SurveyWriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Question {
  question_text: string;
  question_type: 'single' | 'multiple' | 'text' | 'rating';
  is_required: boolean;
  options: string[];
}

const SurveyWriteModal: React.FC<SurveyWriteModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    is_anonymous: false,
    target_type: 'anyone' as 'anyone' | 'authenticated' | 'authenticated_anonymous',
    start_date: '',
    end_date: '',
    end_condition_type: 'date' as 'date' | 'count' | 'percentage',
    end_count: '',
    end_percentage: ''
  });
  const [questions, setQuestions] = useState<Question[]>([
    {
      question_text: '',
      question_type: 'single',
      is_required: true,
      options: ['옵션 1', '옵션 2']
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const addQuestion = () => {
    setQuestions(prev => [...prev, {
      question_text: '',
      question_type: 'single',
      is_required: true,
      options: ['옵션 1', '옵션 2']
    }]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    setQuestions(prev => prev.map((q, i) => 
      i === index ? { ...q, [field]: value } : q
    ));
  };

  const addOption = (questionIndex: number) => {
    setQuestions(prev => prev.map((q, i) => 
      i === questionIndex 
        ? { ...q, options: [...q.options, `옵션 ${q.options.length + 1}`] }
        : q
    ));
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    setQuestions(prev => prev.map((q, i) => 
      i === questionIndex 
        ? { ...q, options: q.options.filter((_, oi) => oi !== optionIndex) }
        : q
    ));
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    setQuestions(prev => prev.map((q, i) => 
      i === questionIndex 
        ? { ...q, options: q.options.map((opt, oi) => oi === optionIndex ? value : opt) }
        : q
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }

    if (questions.length === 0) {
      setError('최소 1개 이상의 질문을 추가해주세요.');
      return;
    }

    for (const q of questions) {
      if (!q.question_text.trim()) {
        setError('모든 질문에 내용을 입력해주세요.');
        return;
      }
      if ((q.question_type === 'single' || q.question_type === 'multiple') && q.options.length < 2) {
        setError('선택형 질문은 최소 2개 이상의 선택지를 추가해주세요.');
        return;
      }
    }

    // 종료 조건 검증
    if (formData.end_condition_type === 'count' && (!formData.end_count || parseInt(formData.end_count) < 1)) {
      setError('인원수 기반 종료를 선택한 경우 종료 인원수를 입력해주세요.');
      return;
    }
    if (formData.end_condition_type === 'percentage' && (!formData.end_percentage || parseFloat(formData.end_percentage) <= 0 || parseFloat(formData.end_percentage) > 100)) {
      setError('비율 기반 종료를 선택한 경우 종료 비율을 입력해주세요. (0-100%)');
      return;
    }
    if (formData.end_condition_type === 'date' && (!formData.start_date || !formData.end_date)) {
      setError('기간 기반 종료를 선택한 경우 시작일과 종료일을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      await createSurvey({
        title: formData.title,
        description: formData.description || undefined,
        is_anonymous: formData.is_anonymous,
        target_type: formData.target_type,
        start_date: formData.end_condition_type === 'date' ? formData.start_date || undefined : undefined,
        end_date: formData.end_condition_type === 'date' ? formData.end_date || undefined : undefined,
        end_condition_type: formData.end_condition_type,
        end_count: formData.end_condition_type === 'count' ? parseInt(formData.end_count) : undefined,
        end_percentage: formData.end_condition_type === 'percentage' ? parseFloat(formData.end_percentage) : undefined,
        questions: questions.map(q => ({
          question_text: q.question_text,
          question_type: q.question_type,
          is_required: q.is_required,
          options: (q.question_type === 'single' || q.question_type === 'multiple') ? q.options : undefined
        }))
      });

      onSuccess();
      onClose();
      // 폼 초기화
      setFormData({
        title: '',
        description: '',
        is_anonymous: false,
        target_type: 'anyone',
        start_date: '',
        end_date: '',
        end_condition_type: 'date',
        end_count: '',
        end_percentage: ''
      });
      setQuestions([{
        question_text: '',
        question_type: 'single',
        is_required: true,
        options: ['옵션 1', '옵션 2']
      }]);
    } catch (err: any) {
      setError(err.message || '설문조사 작성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useModalBackButton({ isOpen, onClose });

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <button
        type="button"
        onClick={onClose}
        className="fixed top-[5vh] right-[max(calc((100vw-40rem)/2+1rem),2rem)] w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors z-[10001] shadow-lg"
      >
        <X size={24} className="text-white" />
      </button>
      
      <div className="bg-white rounded-3xl p-8 max-w-3xl w-full mx-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">설문조사 작성</h2>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              제목 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              설명
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              rows={3}
            />
          </div>

          {/* 설문 대상 타입 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              설문 대상
            </label>
            <select
              name="target_type"
              value={formData.target_type}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="anyone">인증여부와 상관없이 누구나 투표</option>
              <option value="authenticated">인증된 사용자만 투표</option>
              <option value="authenticated_anonymous">인증된 사용자이면서 익명으로 투표</option>
            </select>
          </div>

          {/* 익명 설문 (target_type이 authenticated_anonymous일 때는 자동으로 익명) */}
          {formData.target_type !== 'authenticated_anonymous' && (
            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_anonymous"
                id="is_anonymous"
                checked={formData.is_anonymous}
                onChange={handleChange}
                className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
              />
              <label htmlFor="is_anonymous" className="ml-2 text-sm text-slate-700">
                익명 설문조사
              </label>
            </div>
          )}

          {/* 종료 조건 타입 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              자동 종료 방법
            </label>
            <select
              name="end_condition_type"
              value={formData.end_condition_type}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="date">기간별 (시작일/종료일)</option>
              <option value="count">인원수 설정</option>
              <option value="percentage">가입된 인원의 % 설정</option>
            </select>
          </div>

          {/* 기간별 종료 조건 */}
          {formData.end_condition_type === 'date' && (
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  시작일시 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  종료일시 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
            </div>
          )}

          {/* 인원수 기반 종료 조건 */}
          {formData.end_condition_type === 'count' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                종료 인원수 <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                name="end_count"
                value={formData.end_count}
                onChange={handleChange}
                min="1"
                placeholder="예: 100"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
              <p className="mt-1 text-xs text-slate-500">설정한 인원수가 응답하면 자동으로 종료됩니다.</p>
            </div>
          )}

          {/* 비율 기반 종료 조건 */}
          {formData.end_condition_type === 'percentage' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                종료 비율 (%) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                name="end_percentage"
                value={formData.end_percentage}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.1"
                placeholder="예: 50"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
              <p className="mt-1 text-xs text-slate-500">가입된 인원의 설정한 비율이 응답하면 자동으로 종료됩니다. (0-100%)</p>
            </div>
          )}

          <div className="border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">질문</h3>
              <button
                type="button"
                onClick={addQuestion}
                className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg font-semibold hover:bg-teal-600 transition-colors"
              >
                <Plus size={18} />
                질문 추가
              </button>
            </div>

            <div className="space-y-6">
              {questions.map((question, qIndex) => (
                <div key={qIndex} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm font-semibold text-slate-700">질문 {qIndex + 1}</span>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeQuestion(qIndex)}
                        className="text-rose-500 hover:text-rose-600"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>

                  <div className="mb-3">
                    <input
                      type="text"
                      value={question.question_text}
                      onChange={(e) => updateQuestion(qIndex, 'question_text', e.target.value)}
                      placeholder="질문 내용을 입력하세요"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <select
                      value={question.question_type}
                      onChange={(e) => updateQuestion(qIndex, 'question_type', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="single">단일 선택</option>
                      <option value="multiple">다중 선택</option>
                      <option value="text">텍스트</option>
                      <option value="rating">평점 (1-5)</option>
                    </select>
                  </div>

                  {(question.question_type === 'single' || question.question_type === 'multiple') && (
                    <div className="space-y-2">
                      {question.options.map((option, oIndex) => (
                        <div key={oIndex} className="flex gap-2">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                            required
                          />
                          {question.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOption(qIndex, oIndex)}
                              className="px-3 py-2 text-rose-500 hover:text-rose-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(qIndex)}
                        className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                      >
                        + 선택지 추가
                      </button>
                    </div>
                  )}

                  <div className="flex items-center mt-3">
                    <input
                      type="checkbox"
                      checked={question.is_required}
                      onChange={(e) => updateQuestion(qIndex, 'is_required', e.target.checked)}
                      className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                    />
                    <label className="ml-2 text-sm text-slate-700">
                      필수 질문
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-teal-500 text-white rounded-xl font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '작성 중...' : '작성하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default SurveyWriteModal;

