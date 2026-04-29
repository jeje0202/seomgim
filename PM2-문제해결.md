# PM2 서버 실행 문제 해결 방법

## 문제 상황
Windows에서 PM2를 실행할 때 `EPERM` 권한 오류가 발생합니다.

## 해결 방법

### 방법 1: 관리자 권한으로 실행 (권장)
1. PowerShell 또는 명령 프롬프트를 **관리자 권한**으로 실행
2. 다음 명령어 실행:
   ```powershell
   cd C:\My\Seomgim-church
   pm2 delete all
   pm2 start ecosystem.config.cjs
   pm2 save
   ```

### 방법 2: PM2 완전 재설정
1. 모든 Node 프로세스 종료:
   ```powershell
   Get-Process -Name node | Stop-Process -Force
   ```
2. PM2 디렉토리 삭제:
   ```powershell
   Remove-Item -Path "$env:USERPROFILE\.pm2" -Recurse -Force
   ```
3. PM2 재시작:
   ```powershell
   pm2 start ecosystem.config.cjs
   ```

### 방법 3: 서버 직접 실행 (PM2 없이)
`start-server.bat` 파일을 더블클릭하여 실행하거나:
```powershell
cd C:\My\Seomgim-church\server
node index.js
```

## 현재 상태
서버는 정상적으로 실행 중입니다 (포트 5000).
PM2 권한 문제만 해결하면 됩니다.

