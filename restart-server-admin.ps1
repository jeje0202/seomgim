# 관리자 권한으로 서버 재시작 스크립트
# PowerShell 관리자 권한으로 실행하세요

Write-Host "=== 백엔드 서버 재시작 ===" -ForegroundColor Cyan
Write-Host ""

# 현재 디렉토리로 이동
Set-Location -Path "$PSScriptRoot\server"

# pm2 프로세스 확인
Write-Host "pm2 프로세스 확인 중..." -ForegroundColor Yellow
try {
    $pm2Status = pm2 status 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "pm2 실행 중" -ForegroundColor Green
    } else {
        Write-Host "pm2 데몬 시작 중..." -ForegroundColor Yellow
        pm2 kill
        Start-Sleep -Seconds 2
    }
} catch {
    Write-Host "pm2 초기화 중..." -ForegroundColor Yellow
}

# 기존 프로세스 중지 및 재시작
Write-Host ""
Write-Host "seomgim 프로세스 재시작 중..." -ForegroundColor Yellow
pm2 restart seomgim-church-backend 2>&1 | Out-Null
pm2 restart seomgim 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Set-Location -Path "$PSScriptRoot"
    pm2 start ecosystem.config.cjs
}

# 상태 확인
Write-Host ""
Write-Host "서버 상태 확인 중..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
pm2 status

Write-Host ""
Write-Host "=== 완료 ===" -ForegroundColor Green
Write-Host ""
Write-Host "로그 확인: pm2 logs seomgim" -ForegroundColor Cyan
Write-Host "상태 확인: pm2 status" -ForegroundColor Cyan

