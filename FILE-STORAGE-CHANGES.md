# 파일 저장 구조 변경 사항

## 변경 내용

### 1. 앨범 이미지 저장 경로
- **기존**: `C:\My\Seomgim-church\data\album\`에 모든 이미지 저장
- **변경 후**: 
  - 기본 폴더에 500개 미만이면 `data/album/`에 저장
  - 500개 이상이면 `data/album/album1/`, `data/album/album2/`... 형태로 폴더 분리
  - 각 폴더당 최대 500개 이미지 저장

### 2. 썸네일 저장 경로
- **기존**: 앨범 이미지와 같은 폴더에 저장
- **변경 후**: 
  - `C:\My\Seomgim-church\data\thumbnail\{yyyymm}\` 폴더에 저장
  - 예: `data/thumbnail/202512/` (2025년 12월)
  - 앨범 썸네일과 게시판 이미지 썸네일 모두 같은 곳에 저장

### 3. 게시판 이미지 업로드
- **변경**: 썸네일도 함께 업로드 가능하도록 수정
- 썸네일은 년월별 폴더에 저장

## 파일 구조

```
data/
├── album/              # 앨범 이미지 (500개마다 폴더 분리)
│   ├── album-*.jpg
│   ├── album1/
│   │   └── album-*.jpg
│   └── album2/
│       └── album-*.jpg
├── thumbnail/          # 썸네일 (년월별 폴더)
│   ├── 202512/
│   │   └── thumb-*.jpg
│   └── 202601/
│       └── thumb-*.jpg
└── bulletin-*.jpg       # 게시판 이미지 (원본)
```

## 변경된 파일

### 서버 파일
- `server/utils/fileStorage.js` - 파일 저장 경로 결정 로직
- `server/utils/filePathHelper.js` - URL에서 파일 경로 추출
- `server/routes/albums.js` - 앨범 이미지 업로드 및 삭제 로직 수정
- `server/routes/upload.js` - 게시판 이미지 업로드 수정 (썸네일 지원)
- `server/index.js` - 정적 파일 서빙 경로 수정

### 스크립트
- `server/scripts/migrate-thumbnails.js` - 기존 썸네일 파일 이동 스크립트

## 기존 파일 이동

기존 썸네일 파일을 새로운 구조로 이동하려면:

```powershell
cd C:\My\Seomgim-church\server
node scripts/migrate-thumbnails.js
```

이 스크립트는:
1. `data/album` 폴더에서 `thumb-`로 시작하는 파일을 찾아서 이동
2. `data` 폴더에서 `thumb-`로 시작하는 파일을 찾아서 이동
3. 각 파일의 생성 시간을 기반으로 년월 폴더 결정
4. `data/thumbnail/{yyyymm}/` 폴더로 이동

## 주의사항

1. **서버 재시작 필요**: 변경 사항 적용을 위해 서버를 재시작해야 합니다.
2. **기존 파일 이동**: 기존 썸네일 파일은 스크립트를 실행하여 이동해야 합니다.
3. **데이터베이스 URL**: 데이터베이스에 저장된 URL은 자동으로 새 경로로 업데이트됩니다.

## URL 형식

### 앨범 이미지
- 기본 폴더: `/uploads/album/album-1234567890-123456789.jpg`
- 하위 폴더: `/uploads/album/album1/album-1234567890-123456789.jpg`

### 썸네일
- `/uploads/thumbnail/202512/thumb-1234567890-123456789.jpg`

