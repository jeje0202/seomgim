# 읽지 않은 글 수 디버깅 스크립트
# 이 스크립트를 관리자 권한 PowerShell에서 실행하세요

Write-Host "=== 읽지 않은 글 수 디버깅 ===" -ForegroundColor Cyan
Write-Host ""

# 1. pm2 상태 확인
Write-Host "1. pm2 프로세스 상태:" -ForegroundColor Yellow
pm2 list

Write-Host ""
Write-Host "2. 서버 로그 (최근 100줄):" -ForegroundColor Yellow
pm2 logs seomgim --lines 100 --nostream | Select-String -Pattern "카테고리 조회|게시글 조회|조회수 증가|post_views" -Context 0,2

Write-Host ""
Write-Host "=== 진단 결과 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "확인할 사항:" -ForegroundColor Yellow
Write-Host "  1. [카테고리 조회] 로그에서 user_id와 unread_count 확인" -ForegroundColor White
Write-Host "  2. [게시글 조회] 로그에서 조회수 증가 및 기록 저장 성공 확인" -ForegroundColor White
Write-Host "  3. 게시글을 읽은 후 다시 카테고리 조회 시 unread_count 감소 확인" -ForegroundColor White
Write-Host ""
Write-Host "테스트 절차:" -ForegroundColor Yellow
Write-Host "  1. 브라우저에서 게시판 페이지 열기 (카테고리 조회 로그 확인)" -ForegroundColor White
Write-Host "  2. 읽지 않은 글 하나 클릭 (게시글 조회 로그 확인)" -ForegroundColor White
Write-Host "  3. 모달 닫기" -ForegroundColor White
Write-Host "  4. 다시 이 스크립트 실행하여 로그 확인" -ForegroundColor White
Write-Host ""
Write-Host "로그에서 다음을 확인하세요:" -ForegroundColor Yellow
Write-Host "  ✓ 조회수 증가 및 기록 저장 성공" -ForegroundColor Green
Write-Host "  ✓ 카테고리 조회 시 unread_count가 1 감소" -ForegroundColor Green

