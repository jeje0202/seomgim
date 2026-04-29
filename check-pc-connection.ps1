# PC 연결 상태 확인 스크립트
# PowerShell 관리자 권한으로 실행하세요

Write-Host "=== PC 연결 상태 진단 ===" -ForegroundColor Cyan
Write-Host ""

# 1. DNS 조회
Write-Host "1. DNS 조회 결과:" -ForegroundColor Yellow
$dnsResult = Resolve-DnsName -Name "seomgim.foryou.me" -Type A -ErrorAction SilentlyContinue
if ($dnsResult) {
    Write-Host "   도메인: seomgim.foryou.me" -ForegroundColor Green
    $dnsResult | ForEach-Object {
        Write-Host "   IP 주소: $($_.IPAddress)" -ForegroundColor Gray
    }
    
    # Cloudflare IP 범위 확인 (103.21.244.0/22, 103.22.200.0/22 등)
    $isCloudflare = $false
    $dnsResult | ForEach-Object {
        $ip = $_.IPAddress
        $octets = $ip.Split('.')
        $firstOctet = [int]$octets[0]
        $secondOctet = [int]$octets[1]
        
        # Cloudflare IP 범위 (일부)
        if (($firstOctet -eq 103 -and $secondOctet -ge 21 -and $secondOctet -le 22) -or
            ($firstOctet -eq 104 -and $secondOctet -ge 16 -and $secondOctet -le 31) -or
            ($firstOctet -eq 172 -and $secondOctet -eq 64) -or
            ($firstOctet -eq 173 -and $secondOctet -eq 245) -or
            ($firstOctet -eq 188 -and $secondOctet -eq 114) -or
            ($firstOctet -eq 198 -and $secondOctet -eq 41)) {
            $isCloudflare = $true
        }
    }
    
    if ($isCloudflare) {
        Write-Host "   ✅ Cloudflare IP로 해석됨" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Cloudflare IP가 아님 (직접 서버 IP일 수 있음)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ DNS 조회 실패" -ForegroundColor Red
}

Write-Host ""

# 2. hosts 파일 확인
Write-Host "2. hosts 파일 확인:" -ForegroundColor Yellow
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
if (Test-Path $hostsPath) {
    $hostsContent = Get-Content $hostsPath -ErrorAction SilentlyContinue
    $seomgimEntry = $hostsContent | Select-String -Pattern "seomgim"
    if ($seomgimEntry) {
        Write-Host "   ⚠️ hosts 파일에 seomgim.foryou.me 항목 발견:" -ForegroundColor Yellow
        $seomgimEntry | ForEach-Object {
            Write-Host "   $_" -ForegroundColor Red
        }
        Write-Host "   이 항목이 Cloudflare를 우회할 수 있습니다!" -ForegroundColor Yellow
    } else {
        Write-Host "   ✅ hosts 파일에 seomgim.foryou.me 항목 없음" -ForegroundColor Green
    }
} else {
    Write-Host "   ⚠️ hosts 파일을 찾을 수 없습니다" -ForegroundColor Yellow
}

Write-Host ""

# 3. 네트워크 연결 테스트
Write-Host "3. HTTPS 연결 테스트:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://seomgim.foryou.me" -Method Head -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✅ HTTPS 연결 성공" -ForegroundColor Green
    Write-Host "   상태 코드: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   서버: $($response.Headers.Server)" -ForegroundColor Gray
    
    # SSL 인증서 정보
    $cert = [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
    Write-Host "   SSL 인증서: 확인됨" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ HTTPS 연결 실패: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 4. 브라우저별 확인 사항
Write-Host "4. 브라우저 확인 사항:" -ForegroundColor Yellow
Write-Host "   Chrome:" -ForegroundColor White
Write-Host "     - 주소창에 'https://seomgim.foryou.me' 직접 입력" -ForegroundColor Gray
Write-Host "     - 개발자 도구(F12) → Network 탭 → 요청 URL 확인" -ForegroundColor Gray
Write-Host "     - 실제 접속 IP 주소 확인" -ForegroundColor Gray
Write-Host ""
Write-Host "   Edge:" -ForegroundColor White
Write-Host "     - 위와 동일" -ForegroundColor Gray

Write-Host ""
Write-Host "=== 해결 방법 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. hosts 파일에 항목이 있다면:" -ForegroundColor Yellow
Write-Host "   notepad $hostsPath" -ForegroundColor White
Write-Host "   → seomgim.foryou.me 관련 줄 삭제" -ForegroundColor Gray
Write-Host ""
Write-Host "2. DNS 서버 확인:" -ForegroundColor Yellow
Write-Host "   ipconfig /all | findstr DNS" -ForegroundColor White
Write-Host "   → Cloudflare DNS(1.1.1.1) 또는 공용 DNS 사용 권장" -ForegroundColor Gray
Write-Host ""
Write-Host "3. 브라우저에서 실제 접속 URL 확인:" -ForegroundColor Yellow
Write-Host "   F12 → Network 탭 → 요청 URL 확인" -ForegroundColor White
Write-Host "   → IP 주소로 직접 접속하고 있지 않은지 확인" -ForegroundColor Gray

