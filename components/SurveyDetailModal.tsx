// 설문조사 상세 모달 컴포넌트
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';
import { getSurveyDetail, submitSurveyResponse, SurveyDetail, SurveyQuestion } from '../services/surveyApi';
import { getUserInfo } from '../services/authApi';
import AlertModal from './AlertModal';
import { useModalBackButton } from '../hooks/useModalBackButton';

interface SurveyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  surveyId: number;
  onUpdate: () => void;
}

const SurveyDetailModal: React.FC<SurveyDetailModalProps> = ({
  isOpen,
  onClose,
  surveyId,
  onUpdate
}) => {
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [answers, setAnswers] = useState<{ [key: number]: any }>({});
  const [user, setUser] = useState(getUserInfo());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (isOpen && surveyId && surveyId > 0) {
      loadSurvey();
    } else if (isOpen && (!surveyId || surveyId === 0)) {
      setError('설문조사 ID가 유효하지 않습니다.');
      setLoading(false);
    }
  }, [isOpen, surveyId]);

  const loadSurvey = async () => {
    if (!surveyId || surveyId === 0) {
      setError('설문조사 ID가 유효하지 않습니다.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);
    setAnswers({});
    try {
      const data = await getSurveyDetail(surveyId);
      // options가 JSON 문자열인 경우 파싱
      if (data.questions) {
        data.questions = data.questions.map((q: any) => {
          if (q.options && typeof q.options === 'string') {
            try {
              q.options = JSON.parse(q.options);
            } catch (e) {
              console.error('옵션 파싱 오류:', e);
              q.options = [];
            }
          }
          return q;
        });
      }
      setSurvey(data);
    } catch (err: any) {
      console.error('설문조사 로드 오류:', err);
      setError(err.message || '설문조사 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: number, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  // 선택한 답변 미리보기 텍스트 생성
  const getAnswerPreview = (question: SurveyQuestion, answer: any): string => {
    if (!answer) return '미응답';
    
    if (question.question_type === 'single') {
      return answer;
    } else if (question.question_type === 'multiple') {
      return Array.isArray(answer) ? answer.join(', ') : answer;
    } else if (question.question_type === 'text') {
      return answer.length > 50 ? answer.substring(0, 50) + '...' : answer;
    } else if (question.question_type === 'rating') {
      return `${answer}점`;
    }
    return '미응답';
  };

  // 폼 제출 (확인 모달 표시)
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey) return;

    // 필수 질문 확인
    const requiredQuestions = survey.questions.filter(q => q.is_required);
    for (const question of requiredQuestions) {
      if (!answers[question.question_id]) {
        setError(`${question.question_text}에 대한 답변을 입력해주세요.`);
        return;
      }
    }

    // 확인 모달 표시
    setError('');
    setConfirmed(false);
    setShowConfirmModal(true);
  };

  // 최종 제출
  const handleFinalSubmit = async () => {
    if (!survey || !confirmed) return;

    setSubmitting(true);
    setError('');
    setShowConfirmModal(false);

    try {
      const responseAnswers = survey.questions.map(question => {
        const answer = answers[question.question_id];
        if (!answer) return null;

        if (question.question_type === 'single') {
          return {
            question_id: question.question_id,
            answer_text: answer
          };
        } else if (question.question_type === 'multiple') {
          return {
            question_id: question.question_id,
            answer_options: Array.isArray(answer) ? answer : [answer]
          };
        } else if (question.question_type === 'text') {
          return {
            question_id: question.question_id,
            answer_text: answer
          };
        } else if (question.question_type === 'rating') {
          return {
            question_id: question.question_id,
            rating_value: parseInt(answer)
          };
        }
        return null;
      }).filter(a => a !== null);

      await submitSurveyResponse(surveyId, { answers: responseAnswers });
      setSuccess(true);
      setTimeout(() => {
        onUpdate();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || '설문조사 응답 제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  useModalBackButton({ isOpen, onClose });

  if (!isOpen || !surveyId || surveyId === 0) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* 닫기 버튼 - 모달 내부 우측 상단 고정 */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors z-[10001] shadow-lg"
          aria-label="닫기"
        >
          <X size={24} className="text-white" />
        </button>
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mb-4"></div>
            <p className="text-slate-500">설문조사 정보를 불러오는 중...</p>
          </div>
        ) : error && !survey ? (
          <div className="text-center py-16">
            <p className="text-rose-600">{error}</p>
          </div>
        ) : success ? (
          <div className="text-center py-16">
            <CheckCircle size={64} className="mx-auto mb-4 text-teal-500" />
            <h3 className="text-2xl font-bold text-slate-800 mb-2">응답이 제출되었습니다</h3>
            <p className="text-slate-600">감사합니다.</p>
          </div>
        ) : survey ? (
          <>
            <h2 className="text-2xl font-bold text-slate-800 mb-2 pr-16">{survey.title}</h2>
            {survey.description && (
              <p className="text-slate-600 mb-6">{survey.description}</p>
            )}

            {survey.hasResponded ? (
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-center">
                <p className="text-teal-700 font-semibold">이미 응답하신 설문조사입니다.</p>
              </div>
            ) : (survey.target_type === 'authenticated' || survey.target_type === 'authenticated_anonymous') && !user ? (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-center">
                <p className="text-rose-700 font-semibold mb-2">로그인이 필요한 설문조사입니다</p>
                <p className="text-rose-600 text-sm">설문조사에 응답하려면 로그인해주세요.</p>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-6">
                {survey.questions.map((question, index) => (
                  <div key={question.question_id} className="border-b border-slate-200 pb-6">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      {index + 1}. {question.question_text}
                      {question.is_required && <span className="text-rose-500 ml-1">*</span>}
                    </label>

                    {question.question_type === 'single' && (
                      <div className="space-y-2">
                        {question.options?.map((option, optIndex) => (
                          <label key={optIndex} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`question_${question.question_id}`}
                              value={option}
                              checked={answers[question.question_id] === option}
                              onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
                              className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500"
                              required={question.is_required}
                            />
                            <span className="text-slate-700">{option}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {question.question_type === 'multiple' && (
                      <div className="space-y-2">
                        {question.options?.map((option, optIndex) => (
                          <label key={optIndex} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              value={option}
                              checked={Array.isArray(answers[question.question_id]) && answers[question.question_id].includes(option)}
                              onChange={(e) => {
                                const current = Array.isArray(answers[question.question_id]) ? answers[question.question_id] : [];
                                if (e.target.checked) {
                                  handleAnswerChange(question.question_id, [...current, option]);
                                } else {
                                  handleAnswerChange(question.question_id, current.filter((v: string) => v !== option));
                                }
                              }}
                              className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500"
                            />
                            <span className="text-slate-700">{option}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {question.question_type === 'text' && (
                      <textarea
                        value={answers[question.question_id] || ''}
                        onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                        rows={4}
                        required={question.is_required}
                        placeholder="답변을 입력해주세요"
                      />
                    )}

                    {question.question_type === 'rating' && (
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => handleAnswerChange(question.question_id, rating.toString())}
                            className={`w-12 h-12 rounded-lg font-semibold transition-all ${
                              answers[question.question_id] === rating.toString()
                                ? 'bg-teal-500 text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {error && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-600 text-sm">
                    {error}
                  </div>
                )}

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
                    disabled={submitting}
                    className="flex-1 px-6 py-3 bg-teal-500 text-white rounded-xl font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? '제출 중...' : '제출하기'}
                  </button>
                </div>
              </form>
            )}
          </>
        ) : null}
      </div>
    </div>
  );

  // 확인 모달
  const confirmModalContent = showConfirmModal ? (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* 닫기 버튼 */}
        <button
          type="button"
          onClick={() => setShowConfirmModal(false)}
          className="absolute top-4 right-4 w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors z-[10001] shadow-lg"
          aria-label="닫기"
        >
          <X size={24} className="text-white" />
        </button>

        <div className="pr-16">
          {/* 경고 메시지 */}
          <div className="flex items-start gap-3 mb-6 p-4 bg-rose-50 border-2 border-rose-300 rounded-lg">
            <AlertTriangle size={24} className="text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold text-rose-800 mb-2">⚠️ 중요 안내</h3>
              <p className="text-rose-700 font-semibold">
                투표한 결과는 절대 돌이킬 수 없습니다.
              </p>
              <p className="text-rose-600 text-sm mt-1">
                제출 후에는 답변을 수정하거나 취소할 수 없으니 신중하게 확인해주세요.
              </p>
            </div>
          </div>

          {/* 선택한 답변 미리보기 */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">선택한 답변 확인</h3>
            <div className="space-y-4 bg-slate-50 rounded-lg p-4 border border-slate-200">
              {survey.questions.map((question, index) => {
                const answer = answers[question.question_id];
                const answerText = getAnswerPreview(question, answer);
                const hasAnswer = answer && (
                  (question.question_type === 'multiple' && Array.isArray(answer) && answer.length > 0) ||
                  (question.question_type !== 'multiple' && answer)
                );

                return (
                  <div key={question.question_id} className="border-b border-slate-200 pb-3 last:border-0">
                    <div className="flex items-start gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-600">{index + 1}.</span>
                      <span className="text-sm font-semibold text-slate-700 flex-1">
                        {question.question_text}
                      </span>
                    </div>
                    <div className="ml-6">
                      {hasAnswer ? (
                        <p className="text-sm text-slate-800 bg-white px-3 py-2 rounded border border-slate-300">
                          {answerText}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-400 italic">미응답</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 동의 체크박스 */}
          <div className="mb-6">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 w-5 h-5 text-rose-600 border-2 border-rose-300 rounded focus:ring-rose-500 focus:ring-2"
                required
              />
              <div className="flex-1">
                <p className="text-slate-800 font-semibold">
                  위 내용을 확인했으며, 투표 결과가 돌이킬 수 없음을 이해했습니다.
                </p>
                <p className="text-slate-600 text-sm mt-1">
                  동의하시면 제출하기 버튼을 눌러주세요.
                </p>
              </div>
            </label>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
            >
              다시 확인
            </button>
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={!confirmed || submitting}
              className="flex-1 px-6 py-3 bg-rose-500 text-white rounded-xl font-semibold hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '제출 중...' : '최종 제출하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {createPortal(modalContent, document.body)}
      {showConfirmModal && createPortal(confirmModalContent, document.body)}
    </>
  );
};

export default SurveyDetailModal;

