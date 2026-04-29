// 알림 모달 컴포넌트
import React from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useModalBackButton } from '../hooks/useModalBackButton';

export type AlertType = 'success' | 'error' | 'info' | 'warning';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
  showCancel?: boolean;
  cancelText?: string;
  onConfirm?: () => void;
  isDanger?: boolean; // 위험한 작업인지 여부 (빨간색 버튼)
  isLoading?: boolean; // 로딩 중인지 여부 (버튼 비활성화)
}

const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = '확인',
  showCancel = false,
  cancelText = '닫기',
  onConfirm,
  isDanger = false,
  isLoading = false
}) => {
  // 모바일 뒤로 가기 버튼으로 모달 닫기
  useModalBackButton({ isOpen, onClose });

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={24} className="text-green-500" />;
      case 'error':
        return <AlertCircle size={24} className="text-rose-500" />;
      case 'warning':
        return <AlertTriangle size={24} className="text-amber-500" />;
      default:
        return <Info size={24} className="text-blue-500" />;
    }
  };

  const getTitleColor = () => {
    switch (type) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-rose-600';
      case 'warning':
        return 'text-amber-600';
      default:
        return 'text-blue-600';
    }
  };

  const getButtonColor = () => {
    if (isDanger) {
      return 'bg-rose-500 hover:bg-rose-600';
    }
    switch (type) {
      case 'success':
        return 'bg-green-500 hover:bg-green-600';
      case 'error':
        return 'bg-rose-500 hover:bg-rose-600';
      case 'warning':
        return 'bg-amber-500 hover:bg-amber-600';
      default:
        return 'bg-blue-500 hover:bg-blue-600';
    }
  };

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
      onClick={(e) => {
        // 모달 외부 클릭 시 닫히지 않음 (사용자 규칙에 따라)
        e.stopPropagation();
      }}
    >
      <div
        className="bg-white rounded-3xl p-6 max-w-md w-full mx-4 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 - 고정 위치 (빨간색) */}
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors z-[10002] shadow-lg"
          aria-label="닫기"
        >
          <X size={20} className="text-white" />
        </button>

        <div className="pr-12">
          {/* 아이콘과 제목 */}
          <div className="flex items-center gap-3 mb-4">
            {getIcon()}
            {title && (
              <h3 className={`text-xl font-bold ${getTitleColor()}`}>
                {title}
              </h3>
            )}
          </div>

          {/* 메시지 */}
          <p className="text-sm text-slate-700 mb-6 whitespace-pre-line">
            {message}
          </p>

          {/* 버튼 */}
          <div className="flex gap-2 justify-end">
            {showCancel && (
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className={`px-4 py-2.5 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${getButtonColor()}`}
            >
              {isLoading ? '처리 중...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AlertModal;

