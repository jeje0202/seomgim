/**
 * [파일 용도] Cloudflare R2 저장 미디어 최적화 스크립트
 * 1) 과거 앨범 사진 중 썸네일(thumbnail_url)이 누락된 항목에 대해 600px 경량 JPEG 썸네일을 생성·업로드 후 DB 반영
 * 2) 기존 R2 객체들에 Cache-Control(public, max-age=31536000, immutable) 헤더를 부여하여 CDN 엣지 및 브라우저 캐시 가속화
 */

const path = require('path');
const sharp = require('sharp');
const { ListObjectsV2Command, HeadObjectCommand, CopyObjectCommand } = require('@aws-sdk/client-s3');
const { initializeDatabase, getPool } = require('../db');
const {
  s3Client,
  bucketName,
  getObjectFromR2,
  uploadToR2,
  normalizeR2Key,
  getMimeType
} = require('../utils/r2Storage');

const CACHE_HEADER = 'public, max-age=31536000, immutable';

// [한글 코멘트] 동시성 제한 병렬 실행 헬퍼 함수
async function runWithConcurrency(items, concurrency, worker) {
  let idx = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const current = idx++;
      if (current >= items.length) break;
      await worker(items[current], current);
    }
  });
  await Promise.all(runners);
}

async function generateMissingThumbnails(pool) {
  // [한글 코멘트] 삭제되지 않은 활성 앨범(a.is_deleted = FALSE)의 사진만 대상으로 누락 썸네일 조회
  const [rows] = await pool.query(`
    SELECT ap.photo_id, ap.album_id, ap.photo_url
    FROM album_photos ap
    JOIN albums a ON ap.album_id = a.album_id
    WHERE a.is_deleted = FALSE
      AND (ap.thumbnail_url IS NULL OR ap.thumbnail_url = '')
      AND ap.photo_url IS NOT NULL
  `);

  console.log(`🔍 누락된 앨범 썸네일 대상: ${rows.length}건`);
  if (rows.length === 0) return;

  let created = 0;
  let failed = 0;

  await runWithConcurrency(rows, 8, async (row) => {
    try {
      const srcKey = normalizeR2Key(row.photo_url);
      if (!srcKey) {
        failed++;
        return;
      }

      const originalBuffer = await getObjectFromR2(srcKey);
      if (!originalBuffer) {
        failed++;
        return;
      }

      // 600px 경량 JPEG 썸네일 생성 (자동 회전 포함)
      const thumbBuffer = await sharp(originalBuffer)
        .rotate()
        .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, progressive: true })
        .toBuffer();

      // 원본 키 경로(예: seomgim/data/album/202512/album-xxx.jpg)에서 연월 디렉토리 추출
      const dirName = path.posix.dirname(srcKey);
      const baseName = path.posix.basename(srcKey, path.posix.extname(srcKey));
      const thumbName = baseName.replace(/^album-/, 'thumb-') + '.jpg';
      const thumbKey = dirName.endsWith('/thumbnails')
        ? `${dirName}/${thumbName}`
        : `${dirName}/thumbnails/${thumbName}`;

      const uploaded = await uploadToR2(thumbBuffer, thumbKey, 'image/jpeg');

      await pool.query(
        'UPDATE album_photos SET thumbnail_url = ? WHERE photo_id = ?',
        [uploaded.url, row.photo_id]
      );
      created++;
      if (created % 25 === 0 || created === rows.length) {
        console.log(`  📸 썸네일 생성 진행: ${created}/${rows.length}`);
      }
    } catch (err) {
      failed++;
      console.error(`  ❌ photo_id=${row.photo_id} 썸네일 생성 실패:`, err.message);
    }
  });

  console.log(`✅ 누락 썸네일 생성 완료: 성공 ${created}건, 실패 ${failed}건`);
}

async function applyCacheControlToAllObjects() {
  const allKeys = [];
  let token = undefined;

  do {
    const res = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: 'seomgim/data/',
      ContinuationToken: token
    }));
    (res.Contents || []).forEach((obj) => {
      if (obj.Key && obj.Size > 0) {
        allKeys.push(obj.Key);
      }
    });
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  console.log(`🔍 R2 전체 미디어 객체 Cache-Control 점검 대상: ${allKeys.length}개`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  await runWithConcurrency(allKeys, 15, async (key) => {
    try {
      const head = await s3Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
      if (head.CacheControl === CACHE_HEADER) {
        skipped++;
        return;
      }

      const encodedSource = `${bucketName}/${key.split('/').map(encodeURIComponent).join('/')}`;
      await s3Client.send(new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: encodedSource,
        Key: key,
        ContentType: head.ContentType || getMimeType(key),
        CacheControl: CACHE_HEADER,
        MetadataDirective: 'REPLACE'
      }));
      updated++;
      if ((updated + skipped) % 200 === 0) {
        console.log(`  ⚡ Cache-Control 진행: 갱신 ${updated}건 / 유지 ${skipped}건`);
      }
    } catch (err) {
      failed++;
      console.error(`  ❌ Cache-Control 갱신 실패 (${key}):`, err.message);
    }
  });

  console.log(`✅ R2 Cache-Control 적용 완료: 갱신 ${updated}건, 기존유지 ${skipped}건, 실패 ${failed}건`);
}

(async () => {
  await initializeDatabase();
  const pool = getPool();
  await generateMissingThumbnails(pool);
  await applyCacheControlToAllObjects();
  console.log('🎉 R2 미디어 전체 최적화가 완료되었습니다!');
  process.exit(0);
})().catch((err) => {
  console.error('❌ 최적화 스크립트 오류:', err);
  process.exit(1);
});
