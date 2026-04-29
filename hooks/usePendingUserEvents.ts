// 승인 대기 사용자 수 실시간 업데이트 훅
import { useEffect, useRef } from 'react';
import { getUserInfo, hasRole, getToken } from '../services/authApi';

interface UsePendingUserEventsOptions {
  onCountChanged: () => void;
  enabled?: boolean;
}

export const usePendingUserEvents = ({ 
  onCountChanged, 
  enabled = true 
}: UsePendingUserEventsOptions) => {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5; // 최대 재연결 시도 횟수
  const baseReconnectDelay = 5000; // 기본 재연결 지연 시간 (5초)

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // 관리자 권한 체크
    const user = getUserInfo();
    if (!user || !hasRole(user, 'admin', 'super-admin')) {
      return;
    }

    // 토큰 가져오기
    const token = getToken();
    if (!token) {
      return;
    }

    // EventSource로 SSE 연결 (fetch 대신 EventSource 사용 - QUIC 오류 방지)
    const connectSSE = () => {
      // 기존 연결이 있으면 닫기
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      try {
        // EventSource는 URL에 토큰을 쿼리 파라미터로 전달해야 함 (헤더 지원 안 함)
        const url = `/api/events/pending-users?token=${encodeURIComponent(token)}`;
        const eventSource = new EventSource(url);

        eventSourceRef.current = eventSource;
        reconnectAttemptsRef.current = 0; // 연결 성공 시 재시도 횟수 리셋

        eventSource.onopen = () => {
          console.log('[SSE] 승인 대기 사용자 이벤트 스트림 연결됨');
          reconnectAttemptsRef.current = 0; // 연결 성공 시 재시도 횟수 리셋
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'pending_user_count_changed') {
              console.log('[SSE] 승인 대기 사용자 수 변경 감지 - 즉시 갱신');
              onCountChanged();
            } else if (data.type === 'connected') {
              console.log('[SSE] 서버 연결 확인됨');
            }
          } catch (error) {
            console.error('[SSE] 메시지 파싱 오류:', error);
          }
        };

        eventSource.onerror = (error) => {
          // EventSource의 readyState 확인
          // CONNECTING(0): 연결 시도 중
          // OPEN(1): 연결 성공
          // CLOSED(2): 연결 종료
          
          // QUIC 프로토콜 오류는 때때로 발생하지만 연결은 정상적으로 유지될 수 있음
          // OPEN 상태이면 연결이 성공한 것이므로 오류를 무시
          if (eventSource.readyState === EventSource.OPEN) {
            // 연결이 성공적으로 열려있으면 오류를 무시 (QUIC 프로토콜 오류는 무시)
            return;
          }
          
          // 연결이 닫혔을 때만 재연결 시도
          if (eventSource.readyState === EventSource.CLOSED) {
            // EventSource가 자동으로 재연결을 시도하므로, 수동 재연결은 최소화
            // 최대 재연결 시도 횟수를 초과하지 않은 경우에만 재연결 시도
            if (reconnectAttemptsRef.current < maxReconnectAttempts) {
              reconnectAttemptsRef.current++;
              // 지수 백오프: 재시도 횟수가 많을수록 대기 시간 증가
              const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1);
              
              // 재연결 시도는 하지만 콘솔 오류는 출력하지 않음 (QUIC 오류는 정상 동작에 영향 없음)
              reconnectTimeoutRef.current = setTimeout(() => {
                if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
                  connectSSE();
                }
              }, delay);
            } else {
              // 최대 재시도 횟수 초과 시에만 경고 출력
              console.warn('[SSE] 최대 재연결 시도 횟수 초과. SSE 연결을 포기합니다. 폴링 방식으로 전환됩니다.');
            }
          }
        };
      } catch (error: any) {
        console.error('[SSE] 연결 초기화 오류:', error);
        // QUIC 오류 등으로 연결 실패 시 재연결 시도
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1);
          reconnectTimeoutRef.current = setTimeout(() => {
            connectSSE();
          }, delay);
        }
      }
    };

    connectSSE();

    // cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
    };
  }, [enabled, onCountChanged]);
};

