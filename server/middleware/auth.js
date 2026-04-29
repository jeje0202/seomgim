// 인증 및 권한 체크 미들웨어
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'seomgim-church-secret-key-change-in-production';

// JWT 토큰에서 사용자 정보 추출
// EventSource는 헤더를 설정할 수 없으므로 쿼리 파라미터도 확인
const extractToken = (req) => {
  // 1. Authorization 헤더에서 토큰 확인 (일반적인 경우)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  // 2. 쿼리 파라미터에서 토큰 확인 (EventSource용)
  if (req.query && req.query.token) {
    return req.query.token;
  }
  return null;
};

// 인증 미들웨어 (로그인 필수)
exports.authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: '로그인이 필요합니다.' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const pool = getPool();

    // 사용자 정보 조회 (is_member 포함)
    const [users] = await pool.query(
      'SELECT user_id, username, nickname, name, role, is_active, is_approved, is_member FROM users WHERE user_id = ?',
      [decoded.user_id]
    );

    if (users.length === 0 || !users[0].is_active) {
      return res.status(401).json({ 
        success: false, 
        message: '유효하지 않은 토큰입니다.' 
      });
    }

    // 요청 객체에 사용자 정보 추가
    req.user = users[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: '유효하지 않은 토큰입니다.' 
      });
    }
    console.error('인증 미들웨어 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 권한 체크 미들웨어 (특정 권한 이상 필요)
exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: '로그인이 필요합니다.' 
      });
    }

    // 권한 계층 구조
    const roleHierarchy = {
      'user': 1,
      'manager': 2,
      'admin': 3,
      'super-admin': 4
    };

    const userRoleLevel = roleHierarchy[req.user.role] || 0;
    const hasPermission = allowedRoles.some(role => {
      const requiredLevel = roleHierarchy[role] || 0;
      return userRoleLevel >= requiredLevel;
    });

    if (!hasPermission) {
      return res.status(403).json({ 
        success: false, 
        message: '권한이 없습니다.' 
      });
    }

    next();
  };
};

// 선택적 인증 (로그인 안 해도 접근 가능, 하지만 로그인 정보가 있으면 req.user에 추가)
exports.optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const pool = getPool();

      const [users] = await pool.query(
        'SELECT user_id, username, nickname, name, role, is_active, is_approved, is_member FROM users WHERE user_id = ?',
        [decoded.user_id]
      );

      if (users.length > 0 && users[0].is_active) {
        req.user = users[0];
      }
    }
    
    next();
  } catch (error) {
    // 토큰이 없거나 유효하지 않아도 계속 진행 (선택적 인증)
    next();
  }
};

