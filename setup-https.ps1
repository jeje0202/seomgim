# HTTPS 설정 스크립트
# PowerShell 관리자 권한으로 실행하세요

Write-Host "=== HTTPS 설정 스크립트 ===" -ForegroundColor Cyan
Write-Host ""

# 1. SSL 폴더 생성
Write-Host "1. SSL 폴더 확인 중..." -ForegroundColor Yellow
$sslDir = "C:\nginx\conf\ssl"
if (-not (Test-Path $sslDir)) {
    New-Item -ItemType Directory -Path $sslDir -Force | Out-Null
    Write-Host "   ✅ SSL 폴더 생성: $sslDir" -ForegroundColor Green
} else {
    Write-Host "   ✅ SSL 폴더 이미 존재: $sslDir" -ForegroundColor Green
}

Write-Host ""
Write-Host "2. SSL 인증서 파일 확인 중..." -ForegroundColor Yellow
$certFile = Join-Path $sslDir "cert.pem"
$keyFile = Join-Path $sslDir "key.pem"

if (Test-Path $certFile) {
    Write-Host "   ✅ 인증서 파일 존재: $certFile" -ForegroundColor Green
} else {
    Write-Host "   ⚠️ 인증서 파일 없음: $certFile" -ForegroundColor Yellow
    Write-Host "   Cloudflare에서 Origin Certificate를 생성하고 파일을 저장하세요." -ForegroundColor White
}

if (Test-Path $keyFile) {
    Write-Host "   ✅ 개인키 파일 존재: $keyFile" -ForegroundColor Green
} else {
    Write-Host "   ⚠️ 개인키 파일 없음: $keyFile" -ForegroundColor Yellow
    Write-Host "   Cloudflare에서 Private Key를 생성하고 파일을 저장하세요." -ForegroundColor White
}

Write-Host ""
Write-Host "3. Nginx 설정 테스트 중..." -ForegroundColor Yellow
Set-Location "C:\nginx"
$testResult = & .\nginx.exe -t 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Nginx 설정 정상" -ForegroundColor Green
} else {
    Write-Host "   ❌ Nginx 설정 오류:" -ForegroundColor Red
    Write-Host $testResult -ForegroundColor Red
    Write-Host ""
    Write-Host "⚠️ 인증서 파일이 없으면 Nginx가 시작되지 않습니다." -ForegroundColor Yellow
    Write-Host "   Cloudflare에서 인증서를 생성한 후 다시 실행하세요." -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "4. Cloudflare SSL 모드 확인 필요:" -ForegroundColor Yellow
Write-Host "   Cloudflare 대시보드 → SSL/TLS → Overview" -ForegroundColor White
Write-Host "   'Full' 또는 'Full (strict)' 모드로 설정되어 있어야 합니다." -ForegroundColor White

Write-Host ""
Write-Host "=== 다음 단계 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Cloudflare Origin Certificate 생성:" -ForegroundColor Yellow
Write-Host "   - Cloudflare 대시보드 → SSL/TLS → Origin Server" -ForegroundColor White
Write-Host "   - Create Certificate 클릭" -ForegroundColor White
Write-Host "   - Origin Certificate와 Private Key 복사" -ForegroundColor White
Write-Host ""
Write-Host "2. 인증서 파일 저장:" -ForegroundColor Yellow
Write-Host "   - Origin Certificate → C:\nginx\conf\ssl\cert.pem" -ForegroundColor White
Write-Host "   - Private Key → C:\nginx\conf\ssl\key.pem" -ForegroundColor White
Write-Host ""
Write-Host "3. Nginx 재시작:" -ForegroundColor Yellow
Write-Host "   Stop-Process -Name nginx -Force" -ForegroundColor White
Write-Host "   .\nginx.exe" -ForegroundColor White
Write-Host ""
Write-Host "4. HTTPS 테스트:" -ForegroundColor Yellow
Write-Host "   https://seomgim.foryou.me" -ForegroundColor White
Write-Host ""

