/**
 * [파일 용도] Cloudflare R2 클라우드 스토리지(S3 API 호환) 연동 모듈
 * 이미지 업로드(CDN 캐시 헤더 포함), 삭제(공개 URL 및 상대 경로 모두 정규화 지원), 공개 URL 변환 및 버퍼 조회 유틸리티 제공
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });

// [한글 코멘트] 보안 강화: Cloudflare R2 인증키를 환경변수(config.env)에서 로드
const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
const bucketName = (process.env.R2_BUCKET_NAME || 'media').trim();
const endpointUrl = (process.env.R2_ENDPOINT_URL || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')).trim();
const publicUrl = (process.env.R2_PUBLIC_URL || 'https://media.foryou.me').trim().replace(/\/+$/, '');
const r2Prefix = (process.env.R2_PREFIX || 'seomgim/data').trim().replace(/^\/+|\/+$/g, '');

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.warn('⚠️ [R2 Storage] config.env에 R2 인증 환경변수가 설정되지 않았습니다.');
}

// [한글 코멘트] S3 호환 Cloudflare R2 클라이언트 객체 생성
const s3Client = new S3Client({
  region: 'auto',
  endpoint: endpointUrl,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey
  }
});

// [한글 코멘트] 파일 확장자에 따른 MIME 타입 매핑 헬퍼
const getMimeType = (filePathOrKey) => {
  const ext = path.extname(filePathOrKey || '').toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };
  return mimeMap[ext] || 'application/octet-stream';
};

/**
 * [한글 코멘트] 공개 URL(https://media.foryou.me/...), 상대 경로(/uploads/...), R2 키(seomgim/data/...) 등
 * 어떠한 형태의 입력이 들어와도 정확한 R2 버킷 객체 Key(seomgim/data/...)로 정규화하는 함수
 * (경로 탐색 문자 '..' 포함 시 null 반환하여 보안 위협 차단)
 */
const normalizeR2Key = (urlOrKey) => {
  if (!urlOrKey || typeof urlOrKey !== 'string') return null;

  let raw = urlOrKey.trim();
  if (!raw) return null;

  // 1. 전체 http(s) URL인 경우 pathname 추출 (기존 deleteFromR2에서 URL 전체가 키로 잘못 붙던 버그 수정)
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      raw = decodeURIComponent(parsed.pathname);
    } catch (e) {
      return null;
    }
  }

  // 앞쪽 슬래시 제거 및 역슬래시 정규화
  let cleanKey = raw.replace(/\\/g, '/').replace(/^\/+/, '');

  // 보안 검증: 상위 디렉토리 탐색 차단
  if (cleanKey.includes('..')) {
    return null;
  }

  // 2. 접두사 정규화 (uploads/... -> seomgim/data/...)
  if (cleanKey.startsWith('uploads/')) {
    cleanKey = cleanKey.replace(/^uploads\//, `${r2Prefix}/`);
  } else if (!cleanKey.startsWith(`${r2Prefix}/`)) {
    cleanKey = `${r2Prefix}/${cleanKey}`;
  }

  return cleanKey;
};

/**
 * [한글 코멘트] 상대 경로(/uploads/...) 또는 R2 Key를 Cloudflare R2 공개 CDN URL로 즉시 변환하는 함수
 */
const toR2PublicUrl = (urlOrKey) => {
  const cleanKey = normalizeR2Key(urlOrKey);
  if (!cleanKey) return urlOrKey;
  return `${publicUrl}/${cleanKey}`;
};

/**
 * [한글 코멘트] 버퍼 또는 디스크 파일 경로를 Cloudflare R2에 업로드하고 CDN 캐시 헤더 및 공개 URL을 반환하는 함수
 */
const uploadToR2 = async (input, r2Key, customMimeType = null) => {
  try {
    let bodyBuffer;
    let contentType = customMimeType || getMimeType(r2Key);

    if (typeof input === 'string') {
      bodyBuffer = await fs.promises.readFile(input);
      if (!customMimeType) {
        contentType = getMimeType(input);
      }
    } else if (Buffer.isBuffer(input)) {
      bodyBuffer = input;
    } else {
      throw new Error('올바르지 않은 입력 형식입니다 (string 경로 또는 Buffer 지원)');
    }

    const cleanKey = normalizeR2Key(r2Key);
    if (!cleanKey) {
      throw new Error(`유효하지 않은 R2 업로드 경로입니다: ${r2Key}`);
    }

    // [한글 코멘트] 속도 개선: CacheControl 헤더를 명시하여 Cloudflare 엣지 CDN 캐싱(HIT) 및 브라우저 영구 캐싱 활성화
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: cleanKey,
      Body: bodyBuffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable'
    });

    await s3Client.send(command);

    const fullPublicUrl = `${publicUrl}/${cleanKey}`;

    return {
      success: true,
      key: cleanKey,
      url: fullPublicUrl,
      bucket: bucketName
    };
  } catch (error) {
    console.error(`❌ R2 업로드 실패 (${r2Key}):`, error.message);
    throw error;
  }
};

/**
 * [한글 코멘트] Cloudflare R2 버킷에서 파일을 삭제하는 함수 (전체 공개 URL 및 상대 경로 모두 정상 삭제 지원)
 */
const deleteFromR2 = async (urlOrKey) => {
  try {
    const cleanKey = normalizeR2Key(urlOrKey);
    if (!cleanKey) {
      return { success: false, error: '유효하지 않은 R2 경로' };
    }

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: cleanKey
    });
    await s3Client.send(command);
    return { success: true, key: cleanKey };
  } catch (error) {
    console.error(`❌ R2 삭제 실패 (${urlOrKey}):`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * [한글 코멘트] Cloudflare R2 버킷에서 파일 버퍼를 다운로드하는 함수
 */
const getObjectFromR2 = async (urlOrKey) => {
  try {
    const cleanKey = normalizeR2Key(urlOrKey);
    if (!cleanKey) return null;

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: cleanKey
    });
    const response = await s3Client.send(command);
    const streamToBuffer = (stream) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    return await streamToBuffer(response.Body);
  } catch (error) {
    console.error(`❌ R2 객체 조회 실패 (${urlOrKey}):`, error.message);
    return null;
  }
};

module.exports = {
  s3Client,
  bucketName,
  publicUrl,
  r2Prefix,
  normalizeR2Key,
  toR2PublicUrl,
  uploadToR2,
  deleteFromR2,
  getObjectFromR2,
  getMimeType
};
