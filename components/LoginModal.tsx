// 로그인 모달 컴포넌트
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Lock, Mail, UserPlus } from 'lucide-react';
import { login, register, checkUsername, checkNickname, User as UserType } from '../services/authApi';
import AlertModal from './AlertModal';
import { useModalBackButton } from '../hooks/useModalBackButton';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserType) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    nickname: '',
    password: '',
    passwordConfirm: '',
    name: '',
    is_member: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameChecked, setUsernameChecked] = useState(false);
  const [nicknameChecked, setNicknameChecked] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [checkingNickname, setCheckingNickname] = useState(false);
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

  // 모달이 열릴 때 body 스크롤 막기
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // 모바일 뒤로 가기 버튼으로 모달 닫기
  useModalBackButton({ isOpen, onClose });

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
    
    // 아이디나 닉네임 변경 시 중복 확인 상태 리셋
    if (name === 'username') {
      setUsernameChecked(false);
    } else if (name === 'nickname') {
      setNicknameChecked(false);
    }
  };

  const handleCheckUsername = async () => {
    if (!formData.username.trim() || formData.username.length < 3) {
      setError('아이디는 3자 이상 입력해주세요.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      setError('아이디는 영문, 숫자, 언더스코어(_)만 사용 가능합니다.');
      return;
    }

    setCheckingUsername(true);
    setError('');
    try {
      const result = await checkUsername(formData.username);
      if (result.available) {
        setUsernameChecked(true);
        setError('');
      } else {
        setUsernameChecked(false);
        setError(result.message || '이미 사용 중인 아이디입니다.');
      }
    } catch (err: any) {
      setError(err.message || '중복 확인 중 오류가 발생했습니다.');
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleCheckNickname = async () => {
    if (!formData.nickname.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }

    setCheckingNickname(true);
    setError('');
    try {
      const result = await checkNickname(formData.nickname);
      if (result.available) {
        setNicknameChecked(true);
        setError('');
      } else {
        setNicknameChecked(false);
        setError(result.message || '이미 사용 중인 닉네임입니다.');
      }
    } catch (err: any) {
      setError(err.message || '중복 확인 중 오류가 발생했습니다.');
    } finally {
      setCheckingNickname(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.username.trim() || !formData.password.trim()) {
        setError('아이디와 비밀번호를 입력해주세요.');
        setLoading(false);
        return;
      }

      const result = await login(formData.username, formData.password);
      
      if (result.success && result.data) {
        onSuccess({
          user_id: result.data.user_id,
          username: result.data.username,
          nickname: result.data.nickname,
          name: result.data.name,
          role: result.data.role as any,
          is_active: true,
          is_approved: true
        });
        onClose();
        // 폼 초기화
        setFormData({
          username: '',
          nickname: '',
          password: '',
          passwordConfirm: '',
          name: '',
          is_member: false
        });
        setUsernameChecked(false);
        setNicknameChecked(false);
      } else {
        setError(result.message || '로그인에 실패했습니다.');
      }
    } catch (err: any) {
      setError(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 입력 검증
      if (!formData.username.trim() || formData.username.length < 3) {
        setError('아이디는 3자 이상 입력해주세요.');
        setLoading(false);
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        setError('아이디는 영문, 숫자, 언더스코어(_)만 사용 가능합니다.');
        setLoading(false);
        return;
      }
      if (!formData.password.trim() || formData.password.length < 4) {
        setError('비밀번호는 4자 이상 입력해주세요.');
        setLoading(false);
        return;
      }
      if (formData.password !== formData.passwordConfirm) {
        setError('비밀번호가 일치하지 않습니다.');
        setLoading(false);
        return;
      }
      if (!formData.name.trim()) {
        setError('이름을 입력해주세요.');
        setLoading(false);
        return;
      }
      if (!formData.nickname.trim()) {
        setError('닉네임을 입력해주세요.');
        setLoading(false);
        return;
      }
      if (!usernameChecked) {
        setError('아이디 중복 확인을 해주세요.');
        setLoading(false);
        return;
      }
      if (!nicknameChecked) {
        setError('닉네임 중복 확인을 해주세요.');
        setLoading(false);
        return;
      }

      const result = await register({
        username: formData.username,
        nickname: formData.nickname,
        password: formData.password,
        name: formData.name,
        is_member: formData.is_member
      });

      if (result.success && result.data) {
        // 승인된 경우에만 onSuccess 호출 (첫 사용자만)
        if (result.data.is_approved && result.data.token) {
          onSuccess({
            user_id: result.data.user_id,
            username: result.data.username,
            nickname: result.data.nickname,
            name: result.data.name,
            role: result.data.role as any,
            is_active: true,
            is_approved: true
          });
          onClose();
        } else {
          // 승인 대기 중인 경우
          setAlertModal({
            isOpen: true,
            message: result.message || '회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.',
            type: 'success',
            onConfirm: () => {
              setIsRegisterMode(false);
              onClose();
            }
          });
        }
        // 폼 초기화
        setFormData({
          username: '',
          nickname: '',
          password: '',
          passwordConfirm: '',
          name: '',
          is_member: false
        });
        setUsernameChecked(false);
        setNicknameChecked(false);
      } else {
        setError(result.message || '회원가입에 실패했습니다.');
      }
    } catch (err: any) {
      setError(err.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        zIndex: 9999
      }}
    >
      <div 
        className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        style={{
          position: 'relative',
          margin: 'auto',
          maxHeight: '90vh'
        }}
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
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            {isRegisterMode ? '회원가입' : '로그인'}
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            {isRegisterMode 
              ? '창원섬김의교회 회원으로 가입하세요' 
              : '아이디와 비밀번호를 입력해주세요'}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
              {error}
            </div>
          )}

          {isRegisterMode ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  아이디 <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="영문, 숫자, _ 만 사용 (3자 이상)"
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${
                        usernameChecked 
                          ? 'border-teal-300 focus:ring-teal-500' 
                          : 'border-slate-300 focus:ring-teal-500'
                      }`}
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckUsername}
                    disabled={checkingUsername || !formData.username.trim() || formData.username.length < 3}
                    className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm font-medium"
                  >
                    {checkingUsername ? '확인중...' : usernameChecked ? '✓ 사용가능' : '중복확인'}
                  </button>
                </div>
                {usernameChecked && (
                  <p className="mt-1 text-xs text-teal-600">✓ 사용 가능한 아이디입니다.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  이름 <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="이름을 입력하세요"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  닉네임(별명) <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      name="nickname"
                      value={formData.nickname}
                      onChange={handleChange}
                      placeholder="닉네임(별명)"
                      maxLength={50}
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${
                        nicknameChecked 
                          ? 'border-teal-300 focus:ring-teal-500' 
                          : 'border-slate-300 focus:ring-teal-500'
                      }`}
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckNickname}
                    disabled={checkingNickname || !formData.nickname.trim()}
                    className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm font-medium"
                  >
                    {checkingNickname ? '확인중...' : nicknameChecked ? '✓ 사용가능' : '중복확인'}
                  </button>
                </div>
                {nicknameChecked && (
                  <p className="mt-1 text-xs text-teal-600">✓ 사용 가능한 닉네임입니다.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  비밀번호 <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="4자 이상"
                    minLength={4}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  비밀번호 확인 <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    name="passwordConfirm"
                    value={formData.passwordConfirm}
                    onChange={handleChange}
                    placeholder="비밀번호를 다시 입력하세요"
                    minLength={4}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>

              {/* 교인여부 체크 */}
              <div>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_member"
                    checked={formData.is_member}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_member: e.target.checked }))}
                    className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                  />
                  <span className="ml-2 text-sm text-slate-700">교인으로 가입하기</span>
                </label>
                {formData.is_member && (
                  <p className="mt-2 text-xs text-rose-500 bg-rose-50 p-2 rounded">
                    ⚠️ 관리자의 승인후에 교인으로 인정됩니다.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-teal-500 text-white rounded-xl font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '가입 중...' : '회원가입'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  아이디
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="아이디를 입력하세요"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  비밀번호
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="비밀번호를 입력하세요"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-teal-500 text-white rounded-xl font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '로그인 중...' : '로그인'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setError('');
                setFormData({
                  username: '',
                  nickname: '',
                  password: '',
                  passwordConfirm: '',
                  name: '',
                  is_member: false
                });
                setUsernameChecked(false);
                setNicknameChecked(false);
              }}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center justify-center gap-2"
            >
              <UserPlus size={16} />
              {isRegisterMode ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // React Portal을 사용하여 body에 직접 렌더링
  if (!isOpen) return null;
  
  return (
    <>
      {createPortal(modalContent, document.body)}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        message={alertModal.message}
        type={alertModal.type}
        onConfirm={alertModal.onConfirm}
      />
    </>
  );
};

export default LoginModal;

