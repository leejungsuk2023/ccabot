@echo off
REM Firebase Functions 로그 수집 배치 파일
REM CareConnectBot 프로젝트용 로그 수집 스크립트

echo.
echo ========================================
echo  Firebase Functions 로그 수집 도구
echo  CareConnectBot 프로젝트
echo ========================================
echo.

REM Node.js 설치 확인
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js가 설치되어 있지 않습니다.
    echo 💡 https://nodejs.org에서 Node.js를 다운로드하여 설치하세요.
    pause
    exit /b 1
)

REM Firebase CLI 설치 확인
firebase --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Firebase CLI가 설치되어 있지 않습니다.
    echo 💡 Firebase CLI를 설치하시겠습니까? [Y/N]
    set /p install_firebase="선택: "
    if /i "!install_firebase!"=="Y" (
        echo 📦 Firebase CLI 설치 중...
        npm install -g firebase-tools
        if errorlevel 1 (
            echo ❌ Firebase CLI 설치 실패
            pause
            exit /b 1
        )
        echo ✅ Firebase CLI 설치 완료
    ) else (
        echo ❌ Firebase CLI가 필요합니다.
        pause
        exit /b 1
    )
)

REM 로그 수집 옵션 설정
echo 📋 로그 수집 옵션을 설정하세요:
echo.
echo 1. 기본 설정 (1000줄, 자동 파일명)
echo 2. 사용자 정의 설정
echo.
set /p option="선택 (1-2): "

if "%option%"=="1" (
    REM 기본 설정으로 실행
    echo.
    echo 🔥 기본 설정으로 로그 수집을 시작합니다...
    node get-firebase-logs.js
) else if "%option%"=="2" (
    REM 사용자 정의 설정
    echo.
    set /p lines="📊 가져올 로그 라인 수 (기본값: 1000): "
    if "%lines%"=="" set lines=1000
    
    set /p output_file="📁 출력 파일명 (기본값: 자동생성): "
    
    set /p project_id="🏷️ Firebase 프로젝트 ID (기본값: 현재 설정): "
    
    REM 명령어 구성
    set cmd_args=--lines %lines%
    if not "%output_file%"=="" set cmd_args=%cmd_args% --output "%output_file%"
    if not "%project_id%"=="" set cmd_args=%cmd_args% --project "%project_id%"
    
    echo.
    echo 🔥 사용자 정의 설정으로 로그 수집을 시작합니다...
    echo 📝 명령어: node get-firebase-logs.js %cmd_args%
    echo.
    
    node get-firebase-logs.js %cmd_args%
) else (
    echo ❌ 잘못된 선택입니다.
    pause
    exit /b 1
)

REM 결과 확인
if errorlevel 1 (
    echo.
    echo ❌ 로그 수집 중 오류가 발생했습니다.
    echo.
    echo 💡 일반적인 해결 방법:
    echo    1. Firebase 로그인: firebase login
    echo    2. 프로젝트 설정: firebase use --add
    echo    3. 권한 확인: Firebase 콘솔에서 프로젝트 권한 확인
    echo.
) else (
    echo.
    echo ✅ 로그 수집이 완료되었습니다!
    echo 📁 생성된 로그 파일을 확인하세요.
    echo.
    echo 💡 추가 옵션:
    echo    - 더 많은 로그: get-firebase-logs.bat 다시 실행
    echo    - 특정 프로젝트: --project 옵션 사용
    echo    - 도움말: node get-firebase-logs.js --help
    echo.
)

echo.
echo 📋 로그 파일 목록:
dir /b firebase-logs-*.txt 2>nul
if errorlevel 1 (
    echo    (로그 파일이 없습니다)
) 

echo.
pause
