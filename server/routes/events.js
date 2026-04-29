// 실시간 이벤트 스트리밍 (SSE)
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// 역할 권한 체크 함수
function hasRole(user, ...roles) {
  if (!user || !user.role) {
    return false;
  }
  return roles.includes(user.role);
}

// SSE 연결을 위한 클라이언트 저장소
const clients = new Set();

// 클라이언트에게 이벤트 브로드캐스트
function broadcastPendingUserCount() {
  const message = JSON.stringify({ type: 'pending_user_count_changed' });
  let sentCount = 0;
  let errorCount = 0;
  
  clients.forEach(client => {
    try {
      client.res.write(`data: ${message}\n\n`);
      sentCount++;
    } catch (error) {
      console.error('[SSE] 메시지 전송 오류:', error);
      errorCount++;
      // 연결이 끊어진 클라이언트 제거
      clients.delete(client);
    }
  });
  
  if (sentCount > 0 || errorCount > 0) {
    console.log(`[SSE] 승인 대기 사용자 수 변경 알림 전송: ${sentCount}개 성공, ${errorCount}개 실패 (총 ${clients.size}개 연결)`);
  }
}

// SSE 엔드포인트 (관리자만 접근 가능)
router.get('/pending-users', authenticate, (req, res) => {
  // 관리자 권한 체크
  if (!hasRole(req.user, 'admin', 'super-admin')) {
    return res.status(403).json({ success: false, message: '권한이 없습니다.' });
  }

  // SSE 헤더 설정
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx 버퍼링 방지

  // 클라이언트 등록
  const client = { res, userId: req.user.user_id, userRole: req.user.role };
  clients.add(client);

  // 초기 연결 메시지
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // 클라이언트 연결 종료 시 정리
  req.on('close', () => {
    clients.delete(client);
    console.log(`[SSE] 클라이언트 연결 종료 (user_id: ${client.userId}, role: ${client.userRole}, 남은 연결: ${clients.size}개)`);
  });

  // 에러 처리
  req.on('error', (error) => {
    console.error(`[SSE] 클라이언트 연결 오류 (user_id: ${client.userId}):`, error);
    clients.delete(client);
  });

  console.log(`[SSE] 클라이언트 연결 (user_id: ${client.userId}, role: ${client.userRole}, 총 ${clients.size}개 연결)`);
});

// 모듈 내보내기 (다른 라우터에서 사용)
module.exports = {
  router,
  broadcastPendingUserCount
};

