// 사용자 관리 모달 컴포넌트
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Trash2, User, Shield, CheckCircle, XCircle, Lock, KeyRound, UserCheck } from 'lucide-react';
import { getUsers, updateUser, deleteUser, resetUserPassword, approveUser, User as UserType } from '../services/userApi';
import { getToken } from '../services/authApi';
import { useModalBackButton } from '../hooks/useModalBackButton';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated?: () => void; // 사용자 정보 업데이트 시 호출할 콜백
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  onUserUpdated
}) => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [actionType, setActionType] = useState<'role' | 'password' | 'delete' | 'approve' | null>(null);
  const [userToApprove, setUserToApprove] = useState<UserType | null>(null); // 승인할 사용자
  const [newRole, setNewRole] = useState<'user' | 'manager' | 'admin' | 'super-admin'>('user');
  const [newPassword, setNewPassword] = useState('');

  // 모달이 열릴 때 body 스크롤 막기
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setSelectedUser(null);
      setActionType(null);
      setUserToApprove(null);
      setError('');
      setSuccess('');
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // 모바일 뒤로 가기 버튼으로 모달 닫기
  useModalBackButton({ isOpen, onClose });

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen, currentPage, searchQuery]);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      // 토큰 확인
      const token = getToken();
      if (!token) {
        setError('로그인이 필요합니다. 다시 로그인해주세요.');
        setLoading(false);
        return;
      }

      const data = await getUsers({
        page: currentPage,
        limit: 20,
        search: searchQuery.trim() || undefined
      });
      console.log('사용자 목록 데이터:', data); // 디버깅용
      
      if (data && data.users) {
        setUsers(data.users);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      } else {
        setUsers([]);
        setTotalPages(1);
        setTotal(0);
      }
    } catch (err: any) {
      console.error('사용자 목록 로드 오류:', err); // 디버깅용
      const errorMessage = err.message || '사용자 목록을 불러올 수 없습니다.';
      setError(errorMessage);
      setUsers([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // 권한 변경
  const handleChangeRole = async () => {
    if (!selectedUser) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await updateUser(selectedUser.user_id, { role: newRole });
      setSuccess('권한이 변경되었습니다.');
      setSelectedUser(null);
      setActionType(null);
      loadUsers();
    } catch (err: any) {
      setError(err.message || '권한 변경에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 비밀번호 초기화
  const handleResetPassword = async () => {
    if (!selectedUser) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const password = newPassword.trim() || undefined;
      const newPwd = await resetUserPassword(selectedUser.user_id, password);
      setSuccess(`비밀번호가 초기화되었습니다. 새 비밀번호: ${newPwd}`);
      setSelectedUser(null);
      setActionType(null);
      setNewPassword('');
      loadUsers();
    } catch (err: any) {
      setError(err.message || '비밀번호 초기화에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 사용자 삭제
  const handleDelete = async () => {
    if (!selectedUser) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await deleteUser(selectedUser.user_id);
      setSuccess('사용자가 삭제되었습니다.');
      setSelectedUser(null);
      setActionType(null);
      loadUsers();
    } catch (err: any) {
      setError(err.message || '사용자 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 사용자 승인
  const handleApprove = async () => {
    if (!userToApprove) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await approveUser(userToApprove.user_id);
      setSuccess('사용자가 승인되었습니다.');
      setUserToApprove(null);
      loadUsers();
      // 승인 후 Header의 카운트 갱신
      if (onUserUpdated) {
        onUserUpdated();
      }
    } catch (err: any) {
      setError(err.message || '사용자 승인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 교인 여부 변경
  const handleToggleMember = async (user: UserType) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await updateUser(user.user_id, { is_member: !user.is_member });
      setSuccess('교인 여부가 변경되었습니다.');
      loadUsers();
    } catch (err: any) {
      setError(err.message || '교인 여부 변경에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 활성/비활성 변경
  const handleToggleActive = async (user: UserType) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await updateUser(user.user_id, { is_active: !user.is_active });
      setSuccess('활성 상태가 변경되었습니다.');
      loadUsers();
    } catch (err: any) {
      setError(err.message || '활성 상태 변경에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: { [key: string]: string } = {
      'user': '일반회원',
      'manager': '담당자',
      'admin': '관리자',
      'super-admin': '최고관리자'
    };
    return labels[role] || role;
  };

  const getRoleColor = (role: string) => {
    const colors: { [key: string]: string } = {
      'user': 'bg-slate-100 text-slate-700',
      'manager': 'bg-blue-100 text-blue-700',
      'admin': 'bg-purple-100 text-purple-700',
      'super-admin': 'bg-rose-100 text-rose-700'
    };
    return colors[role] || 'bg-slate-100 text-slate-700';
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4"
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
        className="bg-white rounded-3xl p-6 max-w-6xl w-full mx-4 shadow-2xl relative max-h-[90vh] overflow-y-auto"
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
          <h2 className="text-2xl font-bold text-slate-800 mb-6">사용자 관리</h2>

          {/* 에러/성공 메시지 */}
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg text-teal-600 text-sm">
              {success}
            </div>
          )}

          {/* 검색 바 */}
          <div className="mb-6 flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="아이디, 이름, 닉네임으로 검색..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* 사용자 목록 */}
          {loading && !users.length ? (
            <div className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mb-4"></div>
              <p className="text-slate-500">로딩 중...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <User size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-lg">사용자가 없습니다</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto mb-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">아이디</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">이름</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">닉네임</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">권한</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">교인여부</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">승인여부</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">상태</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">가입일</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.user_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-700 font-medium">{user.username}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{user.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{user.nickname || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getRoleColor(user.role)}`}>
                            {getRoleLabel(user.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => handleToggleMember(user)}
                            className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                              user.is_member 
                                ? 'bg-teal-100 text-teal-700 hover:bg-teal-200' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {user.is_member ? '교인' : '일반'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {!user.is_approved ? (
                            <span className="px-2 py-1 rounded text-xs font-semibold bg-rose-100 text-rose-700">
                              승인대기
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded text-xs font-semibold bg-teal-100 text-teal-700">
                              승인됨
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => handleToggleActive(user)}
                            className={`flex items-center gap-1 transition-colors ${
                              user.is_active ? 'text-teal-600 hover:text-teal-700' : 'text-slate-400 hover:text-slate-500'
                            }`}
                          >
                            {user.is_active ? (
                              <>
                                <CheckCircle size={16} />
                                <span className="text-xs">활성</span>
                              </>
                            ) : (
                              <>
                                <XCircle size={16} />
                                <span className="text-xs">비활성</span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {new Date(user.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setActionType('role');
                                setNewRole(user.role);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="권한 변경"
                            >
                              <Shield size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setActionType('password');
                                setNewPassword('');
                              }}
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                              title="비밀번호 초기화"
                            >
                              <KeyRound size={16} />
                            </button>
                            {!user.is_approved && (
                              <button
                                onClick={() => {
                                  setUserToApprove(user);
                                }}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="승인"
                              >
                                <UserCheck size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setActionType('delete');
                              }}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="삭제"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-slate-600">
                    총 {total}명 중 {((currentPage - 1) * 20) + 1} - {Math.min(currentPage * 20, total)}명 표시
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      이전
                    </button>
                    <span className="px-4 py-2 text-sm text-slate-700">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      다음
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 권한 변경 모달 */}
        {actionType === 'role' && selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10002]">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl relative">
              {/* 닫기 버튼 (빨간색) */}
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setActionType(null);
                  setError('');
                }}
                className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors z-[10003] shadow-lg"
                aria-label="닫기"
              >
                <X size={20} className="text-white" />
              </button>
              
              <h3 className="text-xl font-bold text-slate-800 mb-4">권한 변경</h3>
              
              {/* 에러 메시지 */}
              {error && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
                  {error}
                </div>
              )}
              
              <p className="text-sm text-slate-600 mb-4">
                <strong>{selectedUser.name}</strong> ({selectedUser.username})의 권한을 변경합니다.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">새 권한</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="user">일반회원</option>
                  <option value="manager">담당자</option>
                  <option value="admin">관리자</option>
                  <option value="super-admin">최고관리자</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleChangeRole}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-teal-500 text-white rounded-lg font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50"
                >
                  {loading ? '변경 중...' : '변경'}
                </button>
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setActionType(null);
                    setError('');
                  }}
                  className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 비밀번호 초기화 모달 */}
        {actionType === 'password' && selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10002]">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl relative">
              {/* 닫기 버튼 (빨간색) */}
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setActionType(null);
                  setNewPassword('');
                  setError('');
                }}
                className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors z-[10003] shadow-lg"
                aria-label="닫기"
              >
                <X size={20} className="text-white" />
              </button>
              <h3 className="text-xl font-bold text-slate-800 mb-4">비밀번호 초기화</h3>
              <p className="text-sm text-slate-600 mb-4">
                <strong>{selectedUser.name}</strong> ({selectedUser.username})의 비밀번호를 초기화합니다.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  새 비밀번호 (비워두면 기본값: 1234)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호 입력 (선택사항)"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleResetPassword}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition-colors disabled:opacity-50"
                >
                  {loading ? '초기화 중...' : '초기화'}
                </button>
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setActionType(null);
                    setNewPassword('');
                  }}
                  className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 삭제 확인 모달 */}
        {actionType === 'delete' && selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10002]">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl relative">
              {/* 닫기 버튼 (빨간색) */}
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setActionType(null);
                  setError('');
                }}
                className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors z-[10003] shadow-lg"
                aria-label="닫기"
              >
                <X size={20} className="text-white" />
              </button>
              
              <h3 className="text-xl font-bold text-rose-600 mb-4">사용자 삭제</h3>
              
              {/* 에러 메시지 */}
              {error && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
                  {error}
                </div>
              )}
              
              <p className="text-sm text-slate-600 mb-4">
                정말로 <strong>{selectedUser.name}</strong> ({selectedUser.username}) 사용자를 삭제하시겠습니까?
              </p>
              <p className="text-xs text-rose-600 mb-4 bg-rose-50 p-2 rounded">
                ⚠️ 이 작업은 되돌릴 수 없습니다.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-rose-500 text-white rounded-lg font-semibold hover:bg-rose-600 transition-colors disabled:opacity-50"
                >
                  {loading ? '삭제 중...' : '삭제'}
                </button>
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setActionType(null);
                    setError('');
                  }}
                  className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 승인 확인 모달 */}
        {userToApprove && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10002]">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl relative">
              {/* 닫기 버튼 (빨간색, 고정 위치) */}
              <button
                onClick={() => setUserToApprove(null)}
                className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors z-[10003] shadow-lg"
                aria-label="닫기"
              >
                <X size={20} className="text-white" />
              </button>
              
              <div className="pr-12">
                <h3 className="text-xl font-bold text-green-600 mb-4">사용자 승인</h3>
                <p className="text-sm text-slate-600 mb-4">
                  <strong>{userToApprove.name}</strong> ({userToApprove.username}) 사용자를 승인하시겠습니까?
                </p>
                <p className="text-xs text-slate-500 mb-4 bg-slate-50 p-2 rounded">
                  승인된 사용자는 로그인하여 서비스를 이용할 수 있습니다.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    {loading ? '승인 중...' : '승인'}
                  </button>
                  <button
                    onClick={() => setUserToApprove(null)}
                    className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default UserManagementModal;
