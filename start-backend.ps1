# 백엔드 서버 시작 스크립트 (pm2 사용)
# 관리자 권한으로 실행해야 합니다

Write-Host "=== 백엔드 서버 시작 (pm2) ===" -ForegroundColor Cyan
Write-Host ""

# 작업 디렉토리로 이동
Push-Location server

# pm2로 서버 시작
Write-Host "pm2로 서버 시작 중..." -ForegroundColor Yellow
pm2 start index.js --name seomgim

# pm2 상태 확인
Write-Host ""
Write-Host "=== pm2 상태 ===" -ForegroundColor Cyan
pm2 list

# pm2 저장 (재부팅 후 자동 시작)
Write-Host ""
Write-Host "pm2 설정 저장 중..." -ForegroundColor Yellow
pm2 save

Write-Host ""
Write-Host "✅ 백엔드 서버가 pm2로 시작되었습니다!" -ForegroundColor Green
Write-Host ""
Write-Host "명령어:" -ForegroundColor Yellow
Write-Host "  - pm2 list          : 실행 중인 프로세스 확인" -ForegroundColor White
Write-Host "  - pm2 logs seomgim  : 로그 확인" -ForegroundColor White
Write-Host "  - pm2 stop seomgim  : 서버 중지" -ForegroundColor White
Write-Host "  - pm2 restart seomgim : 서버 재시작" -ForegroundColor White
Write-Host "  - pm2 delete seomgim : 서버 삭제" -ForegroundColor White

Pop-Location

