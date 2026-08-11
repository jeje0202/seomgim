/**
 * [파일 용도] Cloudflare R2 클라우드 스토리지(S3 API 호환) 연동 모듈
 * 이미지 업로드, 삭제, 공개 URL 반환 및 버퍼 처리 유틸리티 제공
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });

const accountId = process.env.R2_ACCOUNT_ID || 'fd854655f29ef69879842c3463c56351';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || '61cc07b252f86956a177521903a10ddc';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '656833bba1679af72f68a2449e917923246daf6e90a6d914e5d4ae6e905ffcaa';
const bucketName = process.env.R2_BUCKET_NAME || 'media';
const endpointUrl = process.env.R2_ENDPOINT_URL || `https://${accountId}.r2.cloudflarestorage.com`;
const publicUrl = process.env.R2_PUBLIC_URL || `${endpointUrl}/${bucketName}`;

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
  const ext = path.extname(filePathOrKey).toLowerCase();
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
 * [한글 코멘트] 버퍼 또는 디스크 파일 경로를 Cloudflare R2에 업로드하는 함수
 * @param {Buffer|string} input - 파일 경로(string) 또는 파일 데이터(Buffer)
 * @param {string} r2Key - R2 버깃 내 대상 경로 Key (예: uploads/album/album1/photo.jpg)
 * @param {string} [customMimeType] - MIME 타입 (선택)
 * @returns {Promise<{success: boolean, key: string, url: string}>}
 */
const uploadToR2 = async (input, r2Key, customMimeType = null) => {
  try {
    let bodyBuffer;
    let contentType = customMimeType || getMimeType(r2Key);

    if (typeof input === 'string') {
      // 파일 경로인 경우
      bodyBuffer = await fs.promises.readFile(input);
      if (!customMimeType) {
        contentType = getMimeType(input);
      }
    } else if (Buffer.isBuffer(input)) {
      // Buffer인 경우
      bodyBuffer = input;
    } else {
      throw new Error('올바르지 않은 입력 형식입니다 (string 경로 또는 Buffer 지원)');
    }

    // 앞부분 슬래시(/) 제거 처리
    const cleanKey = r2Key.startsWith('/') ? r2Key.substring(1) : r2Key;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: cleanKey,
      Body: bodyBuffer,
      ContentType: contentType
    });

    await s3Client.send(command);

    const r2Url = `/uploads/${cleanKey.replace(/^uploads\//, '')}`;

    return {
      success: true,
      key: cleanKey,
      url: r2Url,
      bucket: bucketName
    };
  } catch (error) {
    console.error(`❌ R2 업로드 실패 (${r2Key}):`, error.message);
    throw error;
  }
};

/**
 * [한글 코멘트] Cloudflare R2 버깃에서 파일을 삭제하는 함수
 * @param {string} r2Key - R2 버깃 내 Key
 */
const deleteFromR2 = async (r2Key) => {
  try {
    const cleanKey = r2Key.startsWith('/') ? r2Key.substring(1) : r2Key;
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: cleanKey
    });
    await s3Client.send(command);
    return { success: true };
  } catch (error) {
    console.error(`❌ R2 삭제 실패 (${r2Key}):`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * [한글 코멘트] Cloudflare R2 버깃에서 파일 버퍼를 다운로드하는 함수
 * @param {string} r2Key - R2 버깃 내 Key
 */
const getObjectFromR2 = async (r2Key) => {
  try {
    const cleanKey = r2Key.startsWith('/') ? r2Key.substring(1) : r2Key;
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
    console.error(`❌ R2 객체 조회 실패 (${r2Key}):`, error.message);
    return null;
  }
};

module.exports = {
  s3Client,
  bucketName,
  publicUrl,
  uploadToR2,
  deleteFromR2,
  getObjectFromR2,
  getMimeType
};
