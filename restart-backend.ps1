# 백엔드 서버 재시작 스크립트

Write-Host "=== 백엔드 서버 재시작 ===" -ForegroundColor Cyan
Write-Host ""

# pm2가 실행 중인지 확인
try {
    $pm2Status = pm2 list 2>&1 | Out-String
    
    if ($pm2Status -match "seomgim") {
        Write-Host "pm2로 seomgim 서버 재시작 중..." -ForegroundColor Yellow
        pm2 restart seomgim
        
        Start-Sleep -Seconds 2
        
        Write-Host ""
        Write-Host "=== pm2 상태 ===" -ForegroundColor Cyan
        pm2 list
        
        Write-Host ""
        Write-Host "=== 최근 로그 ===" -ForegroundColor Cyan
        pm2 logs seomgim --lines 20 --nostream
    } else {
        Write-Host "⚠️ pm2에 seomgim 프로세스가 없습니다." -ForegroundColor Yellow
        Write-Host "서버를 시작하려면: pm2 start server/index.js --name seomgim" -ForegroundColor White
    }
} catch {
    Write-Host "❌ pm2 명령 실행 실패: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "대안: Node.js로 직접 실행" -ForegroundColor Yellow
    Write-Host "  cd server" -ForegroundColor Gray
    Write-Host "  node index.js" -ForegroundColor Gray
}

Write-Host ""
Write-Host "완료!" -ForegroundColor Green

