# 썸네일 파일 이동 가이드

기존 썸네일 파일을 년월별 폴더로 이동하는 스크립트입니다.

## 실행 방법

```powershell
cd C:\My\Seomgim-church\server
node scripts/migrate-thumbnails.js
```

## 동작 방식

1. `data/album` 폴더에서 `thumb-`로 시작하는 파일을 찾아서 이동
2. `data` 폴더에서 `thumb-`로 시작하는 파일을 찾아서 이동
3. 각 파일의 생성 시간을 기반으로 년월 폴더 결정 (예: 202512)
4. `data/thumbnail/{yyyymm}/` 폴더로 이동

## 주의사항

- 파일 이동 전에 백업을 권장합니다
- 스크립트 실행 후 서버를 재시작해야 합니다

