# 백엔드 서버 직접 실행 스크립트 (pm2 없이)
# pm2 권한 문제가 있을 때 사용

Write-Host "=== 백엔드 서버 직접 실행 ===" -ForegroundColor Cyan
Write-Host ""

# 작업 디렉토리로 이동
Push-Location server

# 서버 시작
Write-Host "백엔드 서버 시작 중..." -ForegroundColor Yellow
Write-Host "서버를 중지하려면 Ctrl+C를 누르세요" -ForegroundColor Gray
Write-Host ""

node index.js

Pop-Location

