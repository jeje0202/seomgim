/**
 * [파일 용도] JWT 인증 토큰 시크릿 키 및 만료 시간 중앙 관리 설정 모듈
 * 여러 라우터 및 미들웨어에 분산되어 있던 하드코딩 폴백 시크릿을 제거하고 단일 설정으로 통합 관리함
 */

const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });

// [한글 코멘트] 환경변수에서 JWT_SECRET 로드, 미설정 시 추측 불가능한 런타임 난수 키를 생성하여 고정 문자열 노출 취약점 방지
let resolvedSecret = (process.env.JWT_SECRET || '').trim();

if (!resolvedSecret) {
  console.warn('⚠️ [보안 경고] config.env에 JWT_SECRET이 설정되지 않아 임시 난수 시크릿 키를 생성합니다. 서버 재시작 시 기존 세션이 만료될 수 있으므로 환경변수를 설정해주세요.');
  resolvedSecret = crypto.randomBytes(48).toString('hex');
}

const JWT_SECRET = resolvedSecret;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '30d').trim();

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN
};
