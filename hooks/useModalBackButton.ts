// 모바일 뒤로 가기 버튼으로 모달 닫기 훅
import { useEffect, useRef } from 'react';

interface UseModalBackButtonOptions {
  isOpen: boolean;
  onClose: () => void;
  enabled?: boolean; // 기본값 true
}

/**
 * 모바일 환경에서 뒤로 가기 버튼을 눌렀을 때 모달을 닫는 훅
 * @param isOpen 모달이 열려있는지 여부
 * @param onClose 모달 닫기 함수
 * @param enabled 훅 활성화 여부 (기본값: true)
 */
export const useModalBackButton = ({ 
  isOpen, 
  onClose, 
  enabled = true 
}: UseModalBackButtonOptions) => {
  const historyStateRef = useRef<string | null>(null);
  const isClosingByBackRef = useRef(false);

  useEffect(() => {
    // 활성화되지 않았거나 모달이 닫혀있으면 동작하지 않음
    if (!enabled || !isOpen) {
      // 모달이 닫혀있을 때 히스토리 정리 (뒤로 가기로 닫힌 경우가 아닐 때만)
      if (historyStateRef.current && !isClosingByBackRef.current) {
        const currentState = window.history.state;
        if (currentState?.modal === historyStateRef.current) {
          // 히스토리 엔트리가 남아있으면 제거
          window.history.back();
        }
        historyStateRef.current = null;
      }
      isClosingByBackRef.current = false;
      return;
    }

    // 모바일 환경 체크 (768px 미만)
    const isMobile = window.innerWidth < 768;
    if (!isMobile) {
      return;
    }

    // 모달이 열릴 때 히스토리 엔트리 추가
    const uniqueId = `modal-${Date.now()}-${Math.random()}`;
    historyStateRef.current = uniqueId;
    window.history.pushState({ modal: uniqueId }, '', window.location.href);

    // popstate 이벤트 리스너 (뒤로 가기 버튼 감지)
    const handlePopState = (event: PopStateEvent) => {
      // 모달이 여전히 열려있고, 현재 히스토리 상태가 모달 상태인 경우
      if (isOpen && historyStateRef.current) {
        isClosingByBackRef.current = true;
        onClose();
        historyStateRef.current = null;
      }
    };

    window.addEventListener('popstate', handlePopState);

    // cleanup 함수
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose, enabled]);
};

