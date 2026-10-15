/**
 * [파일 용도] 게시글, 주보, 교회소식, 사진첩 등의 딥링크 공유하기 버튼 및 공유 모달 컴포넌트
 * 링크 복사, 카카오톡/단톡방 안내 문구 포함 복사, 모바일 OS 기본 공유 시트 호출 기능을 제공하며 모든 알림은 모달창으로 표시함
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Share2, Link2, Check, MessageCircle, Copy, X } from 'lucide-react';
import AlertModal from './AlertModal';

interface ShareButtonProps {
  title: string;
  description?: string;
  shareUrl: string;
  categoryLabel?: string;
  variant?: 'default' | 'compact' | 'light';
  className?: string;
}

const ShareButton: React.FC<ShareButtonProps> = ({
  title,
  description = '',
  shareUrl,
  categoryLabel = '창원섬김의교회',
  variant = 'default',
  className = ''
}) => {
  // [한글 코멘트] 공유 선택 모달 및 완료 알림 모달 상태 관리
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<'url' | 'message' | null>(null);
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  // [한글 코멘트] 클립보드 복사 공통 헬퍼 함수 (구형 브라우저 폴백 지원)
  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('클립보드 복사 오류:', err);
      return false;
    }
  };

  // [한글 코멘트] 단톡방/문자 공유용 포맷팅 텍스트 생성
  const formattedShareText = `[${categoryLabel}] ${title}${description ? `\n\n${description}` : ''}\n\n👉 바로보기: ${shareUrl}`;

  // [한글 코멘트] 링크만 복사 핸들러
  const handleCopyUrl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopiedType('url');
      setTimeout(() => setCopiedType(null), 2500);
      setIsShareModalOpen(false);
      setAlertModal({
        isOpen: true,
        title: '링크 복사 완료',
        message: '공유 링크가 클립보드에 복사되었습니다.\n카카오톡이나 문자메시지에 붙여넣기(Ctrl+V)하여 공유해 보세요.',
        type: 'success'
      });
    } else {
      setAlertModal({
        isOpen: true,
        title: '복사 실패',
        message: '링크 복사에 실패했습니다. 아래 주소를 직접 선택해 복사해 주세요.',
        type: 'error'
      });
    }
  };

  // [한글 코멘트] 제목+요약+링크 함께 복사 핸들러 (단체 카톡방 공유 최적화)
  const handleCopyWithMessage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(formattedShareText);
    if (ok) {
      setCopiedType('message');
      setTimeout(() => setCopiedType(null), 2500);
      setIsShareModalOpen(false);
      setAlertModal({
        isOpen: true,
        title: '안내 문구 + 링크 복사 완료',
        message: '제목과 바로가기 링크가 함께 복사되었습니다.\n성도님들과 나누실 카카오톡 대화방에 바로 붙여넣기 하실 수 있습니다.',
        type: 'success'
      });
    }
  };

  // [한글 코멘트] 모바일/OS 기본 공유 시트(navigator.share) 호출 핸들러
  const handleNativeShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `[${categoryLabel}] ${title}`,
          text: description ? `[${categoryLabel}] ${title}\n${description}` : `[${categoryLabel}] ${title}`,
          url: shareUrl
        });
        setIsShareModalOpen(false);
      } catch (err: any) {
        // 사용자가 공유 창을 취소한 경우 무시
        if (err?.name !== 'AbortError') {
          console.error('시스템 공유 오류:', err);
        }
      }
    }
  };

  // [한글 코멘트] 버튼 스타일 분기
  const getButtonStyle = () => {
    if (variant === 'compact') {
      return 'inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm';
    }
    if (variant === 'light') {
      return 'inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl text-xs md:text-sm font-semibold transition-all cursor-pointer backdrop-blur-sm';
    }
    return 'inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-700 border border-slate-200 hover:border-teal-200 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-sm';
  };

  const canUseNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsShareModalOpen(true);
        }}
        className={`${getButtonStyle()} ${className}`}
        title="이 페이지 링크 공유하기"
      >
        {copiedType ? <Check size={15} className="text-teal-600" /> : <Share2 size={15} />}
        <span>공유하기</span>
      </button>

      {/* [한글 코멘트] 공유하기 옵션 선택 모달창 */}
      {isShareModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10020] p-4"
            onClick={(e) => {
              e.stopPropagation();
              setIsShareModalOpen(false);
            }}
          >
            <div
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 닫기 버튼 */}
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
                title="닫기"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-2.5 bg-teal-50 text-teal-600 rounded-2xl">
                  <Share2 size={20} />
                </div>
                <div>
                  <span className="text-xs font-bold text-teal-600">{categoryLabel}</span>
                  <h3 className="text-lg font-bold text-slate-800">소식·말씀 공유하기</h3>
                </div>
              </div>

              {/* 공유 대상 미리보기 카드 */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 mb-5">
                <p className="text-sm font-bold text-slate-800 line-clamp-2 mb-1">{title}</p>
                {description && (
                  <p className="text-xs text-slate-500 line-clamp-2 mb-2">{description}</p>
                )}
                <div className="flex items-center gap-1.5 text-xs text-teal-700 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 truncate">
                  <Link2 size={13} className="shrink-0" />
                  <span className="truncate">{shareUrl}</span>
                </div>
              </div>

              {/* 공유 액션 버튼 목록 */}
              <div className="space-y-2.5">
                {canUseNativeShare && (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-[#FEE500] hover:bg-[#f5dc00] text-[#191919] rounded-xl font-bold text-sm transition-all shadow-sm cursor-pointer"
                  >
                    <MessageCircle size={18} />
                    <span>카카오톡 / 앱으로 바로 공유하기</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCopyWithMessage}
                  className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm cursor-pointer"
                >
                  <Copy size={17} />
                  <span>카카오톡 단톡방용 (제목 + 링크) 복사</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all cursor-pointer"
                >
                  <Link2 size={17} />
                  <span>링크 주소만 복사하기</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* [한글 코멘트] 복사 완료/오류 안내 모달창 (사용자 규칙: alert는 항상 모달창으로 표시) */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        confirmText="확인"
      />
    </>
  );
};

export default ShareButton;
