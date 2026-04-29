const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

// 프로젝트 루트 경로
const projectRoot = path.resolve(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');

// DB 설정
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'seomgim_church',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// 파일 경로 유틸리티
function getOldFilePath(url, type) {
    if (!url) return null;

    // URL 디코딩 (한글 파일명 등)
    const decodedUrl = decodeURIComponent(url);

    if (type === 'album') {
        // /uploads/album/ 제거
        if (decodedUrl.startsWith('/uploads/album/')) {
            const relativePath = decodedUrl.replace('/uploads/album/', '');
            const osPath = relativePath.split('/').join(path.sep);
            return path.join(dataDir, 'album', osPath);
        }
    } else if (type === 'thumbnail') {
        // 썸네일은 두 가지 케이스 존재
        // 1. 레거시: /uploads/thumbnail/YYYYMM/file.jpg
        if (decodedUrl.startsWith('/uploads/thumbnail/')) {
            const relativePath = decodedUrl.replace('/uploads/thumbnail/', '');
            const osPath = relativePath.split('/').join(path.sep);
            return path.join(dataDir, 'thumbnail', osPath);
        }
        // 2. 이미 마이그레이션 된 경우 또는 다른 경로: /uploads/album/.../thumbnails/...
        if (decodedUrl.startsWith('/uploads/album/') && decodedUrl.includes('/thumbnails/')) {
            const relativePath = decodedUrl.replace('/uploads/album/', '');
            const osPath = relativePath.split('/').join(path.sep);
            return path.join(dataDir, 'album', osPath);
        }
    }
    return null;
}

async function migrate() {
    console.log('앨범 데이터 마이그레이션을 시작합니다...');

    let pool;
    try {
        pool = mysql.createPool(dbConfig);

        // 1. 모든 앨범 사진 정보 조회 (앨범 생성일 포함)
        const [photos] = await pool.query(`
      SELECT 
        ap.photo_id, ap.album_id, ap.photo_url, ap.thumbnail_url, ap.created_at as photo_created_at,
        a.created_at as album_created_at
      FROM album_photos ap
      JOIN albums a ON ap.album_id = a.album_id
    `);

        console.log(`총 ${photos.length}개의 사진 데이터를 처리합니다.`);

        let processedCount = 0;
        let errorCount = 0;

        for (const photo of photos) {
            try {
                // 날짜 기준 결정 (사진 생성일 -> 앨범 생성일 -> 현재)
                const dateStr = photo.photo_created_at || photo.album_created_at || new Date();
                const date = new Date(dateStr);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const folderName = `${year}${month}`;

                // 목표 디렉토리 생성
                const targetAlbumDir = path.join(dataDir, 'album', folderName);
                const targetThumbnailDir = path.join(targetAlbumDir, 'thumbnails');

                if (!fs.existsSync(targetAlbumDir)) fs.mkdirSync(targetAlbumDir, { recursive: true });
                if (!fs.existsSync(targetThumbnailDir)) fs.mkdirSync(targetThumbnailDir, { recursive: true });

                // 업데이트할 URL 정보
                let newPhotoUrl = photo.photo_url;
                let newThumbnailUrl = photo.thumbnail_url;
                let needUpdate = false;

                // 1. 원본 이미지 처리
                const oldPhotoPath = getOldFilePath(photo.photo_url, 'album');
                if (oldPhotoPath && fs.existsSync(oldPhotoPath)) {
                    const filename = path.basename(oldPhotoPath);
                    const targetPhotoPath = path.join(targetAlbumDir, filename);

                    // 이미 같은 위치에 있는지 확인
                    const isSamePath = path.normalize(oldPhotoPath) === path.normalize(targetPhotoPath);

                    if (!isSamePath) {
                        // 파일 이동
                        if (fs.existsSync(targetPhotoPath)) {
                            // 타겟에 파일이 이미 있으면 덮어쓰거나 이름 변경?
                            // 여기선 덮어쓰기 로직보다는 로그 남기고 건너뜀 (이미 마이그레이션 된 것으로 간주)
                            console.log(`[중복] 원본 파일이 대상 위치에 이미 존재함: ${targetPhotoPath}`);
                        } else {
                            fs.renameSync(oldPhotoPath, targetPhotoPath);
                            console.log(`[이동] 원본: ${oldPhotoPath} -> ${targetPhotoPath}`);
                        }

                        // URL 업데이트
                        newPhotoUrl = `/uploads/album/${folderName}/${filename}`;
                        needUpdate = true;
                    } else {
                        // 경로는 같지만 URL 형식이 다를 수 있음 (예: /uploads/album/202501/img.jpg vs /uploads/album/202501/img.jpg)
                        // 이미 맞는 위치면 URL도 맞을 확률 높음
                        const expectedUrl = `/uploads/album/${folderName}/${filename}`;
                        if (photo.photo_url !== expectedUrl) {
                            newPhotoUrl = expectedUrl;
                            needUpdate = true;
                        }
                    }
                } else {
                    if (oldPhotoPath) console.warn(`[누락] 원본 파일을 찾을 수 없음: ${oldPhotoPath}`);
                }

                // 2. 썸네일 이미지 처리
                if (photo.thumbnail_url) {
                    const oldThumbnailPath = getOldFilePath(photo.thumbnail_url, 'thumbnail');
                    if (oldThumbnailPath && fs.existsSync(oldThumbnailPath)) {
                        const filename = path.basename(oldThumbnailPath);
                        const targetThumbPath = path.join(targetThumbnailDir, filename);

                        const isSamePath = path.normalize(oldThumbnailPath) === path.normalize(targetThumbPath);

                        if (!isSamePath) {
                            if (fs.existsSync(targetThumbPath)) {
                                console.log(`[중복] 썸네일 파일이 대상 위치에 이미 존재함: ${targetThumbPath}`);
                            } else {
                                fs.renameSync(oldThumbnailPath, targetThumbPath);
                                console.log(`[이동] 썸네일: ${oldThumbnailPath} -> ${targetThumbPath}`);
                            }

                            newThumbnailUrl = `/uploads/album/${folderName}/thumbnails/${filename}`;
                            needUpdate = true;
                        } else {
                            const expectedUrl = `/uploads/album/${folderName}/thumbnails/${filename}`;
                            if (photo.thumbnail_url !== expectedUrl) {
                                newThumbnailUrl = expectedUrl;
                                needUpdate = true;
                            }
                        }
                    } else {
                        if (oldThumbnailPath) console.warn(`[누락] 썸네일 파일을 찾을 수 없음: ${oldThumbnailPath}`);
                    }
                }

                // DB 업데이트
                if (needUpdate) {
                    await pool.query(
                        'UPDATE album_photos SET photo_url = ?, thumbnail_url = ? WHERE photo_id = ?',
                        [newPhotoUrl, newThumbnailUrl, photo.photo_id]
                    );
                    processedCount++;
                }

            } catch (err) {
                console.error(`[오류] 사진 ID ${photo.photo_id} 처리 중 오류:`, err);
                errorCount++;
            }
        }

        console.log(`마이그레이션 완료: 처리됨 ${processedCount}건, 오류 ${errorCount}건`);

        // (선택) 빈 폴더 정리 로직은 생략 (안전하게)

    } catch (error) {
        console.error('마이그레이션 치명적 오류:', error);
    } finally {
        if (pool) await pool.end();
    }
}

migrate();
