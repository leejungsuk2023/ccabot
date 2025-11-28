# Firebase Functions 로그 수집 PowerShell 스크립트
# CareConnectBot 프로젝트용 로그 수집 도구

param(
    [int]$Lines = 1000,
    [string]$Output = "",
    [string]$Project = "",
    [switch]$Help
)

# 도움말 표시
if ($Help) {
    Write-Host @"

Firebase Functions 로그 수집 PowerShell 스크립트

사용법: .\get-firebase-logs.ps1 [매개변수]

매개변수:
  -Lines <숫자>      가져올 로그 라인 수 (기본값: 1000)
  -Output <파일명>   출력 파일명 (기본값: firebase-logs-YYYYMMDD-HHMMSS.txt)
  -Project <ID>      Firebase 프로젝트 ID
  -Help             이 도움말 표시

예시:
  .\get-firebase-logs.ps1 -Lines 2000
  .\get-firebase-logs.ps1 -Output "my-logs.txt" -Project "my-project-id"
  .\get-firebase-logs.ps1 -Lines 5000 -Project "my-project-id"

"@ -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Firebase Functions 로그 수집 도구" -ForegroundColor Cyan
Write-Host " CareConnectBot 프로젝트" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Node.js 설치 확인
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js 버전: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js가 설치되어 있지 않습니다." -ForegroundColor Red
    Write-Host "💡 https://nodejs.org에서 Node.js를 다운로드하여 설치하세요." -ForegroundColor Yellow
    Read-Host "계속하려면 Enter를 누르세요"
    exit 1
}

# Firebase CLI 설치 확인
try {
    $firebaseVersion = firebase --version
    Write-Host "✅ Firebase CLI 버전: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase CLI가 설치되어 있지 않습니다." -ForegroundColor Red
    $install = Read-Host "💡 Firebase CLI를 설치하시겠습니까? [Y/N]"
    
    if ($install -eq "Y" -or $install -eq "y") {
        Write-Host "📦 Firebase CLI 설치 중..." -ForegroundColor Yellow
        try {
            npm install -g firebase-tools
            Write-Host "✅ Firebase CLI 설치 완료" -ForegroundColor Green
        } catch {
            Write-Host "❌ Firebase CLI 설치 실패" -ForegroundColor Red
            Read-Host "계속하려면 Enter를 누르세요"
            exit 1
        }
    } else {
        Write-Host "❌ Firebase CLI가 필요합니다." -ForegroundColor Red
        Read-Host "계속하려면 Enter를 누르세요"
        exit 1
    }
}

# 기본 출력 파일명 생성
if (-not $Output) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $Output = "firebase-logs-$timestamp.txt"
}

# Firebase CLI 명령어 구성
$firebaseCmd = "firebase functions:log --lines $Lines"

if ($Project) {
    $firebaseCmd += " --project $Project"
}

Write-Host "🔥 Firebase Functions 로그를 수집하는 중..." -ForegroundColor Yellow
Write-Host "📝 명령어: $firebaseCmd" -ForegroundColor Gray
Write-Host "📁 출력 파일: $Output" -ForegroundColor Gray
Write-Host "📊 라인 수: $Lines" -ForegroundColor Gray
Write-Host ""

try {
    # Firebase CLI 실행
    $logData = Invoke-Expression $firebaseCmd 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        throw "Firebase CLI 명령어 실행 실패"
    }
    
    # 헤더 정보 추가
    $header = @"
# Firebase Functions 로그
# 수집 시간: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# 프로젝트: $(if ($Project) { $Project } else { "현재 설정된 프로젝트" })
# 라인 수: $Lines
# 명령어: $firebaseCmd
# ========================================

"@

    $fullLogData = $header + ($logData | Out-String)
    
    # 루트 폴더에 파일 저장
    $outputPath = Resolve-Path $Output -ErrorAction SilentlyContinue
    if (-not $outputPath) {
        $outputPath = Join-Path $PWD $Output
    }
    
    $fullLogData | Out-File -FilePath $outputPath -Encoding UTF8
    
    Write-Host "✅ 로그 수집 완료!" -ForegroundColor Green
    Write-Host "📁 저장 위치: $outputPath" -ForegroundColor Green
    
    $fileSize = (Get-Item $outputPath).Length / 1KB
    Write-Host "📊 파일 크기: $($fileSize.ToString('F2')) KB" -ForegroundColor Green
    
    # 로그 요약 정보 표시
    $lineCount = ($fullLogData -split "`n").Count
    Write-Host "📝 총 라인 수: $lineCount" -ForegroundColor Green
    
    # 최근 로그 몇 줄 미리보기
    Write-Host ""
    Write-Host "📋 로그 미리보기 (처음 10줄):" -ForegroundColor Cyan
    Write-Host ("─" * 50) -ForegroundColor Gray
    
    $previewLines = ($fullLogData -split "`n")[0..9]
    foreach ($line in $previewLines) {
        Write-Host $line -ForegroundColor White
    }
    
    Write-Host ("─" * 50) -ForegroundColor Gray
    Write-Host ""
    Write-Host "💡 전체 로그는 파일을 열어서 확인하세요: $outputPath" -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ 오류 발생: $($_.Exception.Message)" -ForegroundColor Red
    
    # 일반적인 오류 해결 방법 제안
    if ($_.Exception.Message -like "*not logged in*") {
        Write-Host ""
        Write-Host "💡 해결 방법:" -ForegroundColor Yellow
        Write-Host "   firebase login" -ForegroundColor White
    } elseif ($_.Exception.Message -like "*project*") {
        Write-Host ""
        Write-Host "💡 해결 방법:" -ForegroundColor Yellow
        Write-Host "   firebase use --add" -ForegroundColor White
        Write-Host "   또는" -ForegroundColor White
        Write-Host "   .\get-firebase-logs.ps1 -Project YOUR_PROJECT_ID" -ForegroundColor White
    }
    
    Read-Host "계속하려면 Enter를 누르세요"
    exit 1
}

Write-Host ""
Write-Host "📋 현재 디렉토리의 로그 파일 목록:" -ForegroundColor Cyan
$logFiles = Get-ChildItem -Name "firebase-logs-*.txt" -ErrorAction SilentlyContinue
if ($logFiles) {
    foreach ($file in $logFiles) {
        Write-Host "   $file" -ForegroundColor White
    }
} else {
    Write-Host "   (로그 파일이 없습니다)" -ForegroundColor Gray
}

Write-Host ""
Read-Host "완료! 계속하려면 Enter를 누르세요"
