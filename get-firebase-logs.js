#!/usr/bin/env node

/**
 * Firebase Functions 로그 수집 스크립트
 * Firebase Functions의 로그를 가져와서 루트 폴더에 저장합니다.
 * 
 * 사용법: node get-firebase-logs.js [옵션]
 * 옵션:
 *   --lines <숫자>    가져올 로그 라인 수 (기본값: 15 - 상세 로그 15개)
 *   --output <파일명>  출력 파일명 (기본값: firebase-logs-YYYYMMDD-HHMMSS.txt)
 *   --project <ID>    Firebase 프로젝트 ID
 *   --help           도움말 표시
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 명령행 인수 파싱
const args = process.argv.slice(2);
let lines = 15; // 기본값을 15줄로 변경 (상세 로그 15개 정도)
let outputFile = null;
let projectId = null;
let showHelp = false;

for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
        case '--lines':
            lines = parseInt(args[++i]) || 15;
            break;
        case '--output':
            outputFile = args[++i];
            break;
        case '--project':
            projectId = args[++i];
            break;
        case '--help':
            showHelp = true;
            break;
    }
}

if (showHelp) {
    console.log(`
Firebase Functions 로그 수집 스크립트

사용법: node get-firebase-logs.js [옵션]

옵션:
  --lines <숫자>     가져올 로그 라인 수 (기본값: 15 - 상세 로그 15개)
  --output <파일명>  출력 파일명 (기본값: firebase-logs-YYYYMMDD-HHMMSS.txt)
  --project <ID>     Firebase 프로젝트 ID
  --help            이 도움말 표시

예시:
  node get-firebase-logs.js                    # 최근 15줄 (기본값)
  node get-firebase-logs.js --lines 10        # 최근 10줄만 (빠른 확인)
  node get-firebase-logs.js --lines 30        # 더 많은 로그가 필요한 경우
  node get-firebase-logs.js --output recent-logs.txt --project my-project-id
`);
    process.exit(0);
}

// 기본 출력 파일명 생성
if (!outputFile) {
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, '')
        .replace('T', '-');
    outputFile = `firebase-logs-${timestamp}.txt`;
}

// Firebase CLI 명령어 구성
let firebaseCmd = 'firebase functions:log';

if (lines) {
    firebaseCmd += ` --lines ${lines}`;
}

if (projectId) {
    firebaseCmd += ` --project ${projectId}`;
}

console.log('🔥 Firebase Functions 최근 로그를 수집하는 중...');
console.log(`📝 명령어: ${firebaseCmd}`);
console.log(`📁 출력 파일: ${outputFile}`);
console.log(`📊 라인 수: ${lines} (상세 로그 분석용)`);

// Firebase CLI 실행
exec(firebaseCmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ 오류 발생:', error.message);
        
        // 일반적인 오류 해결 방법 제안
        if (error.message.includes('not logged in')) {
            console.error('\n💡 해결 방법:');
            console.error('   firebase login');
        } else if (error.message.includes('project')) {
            console.error('\n💡 해결 방법:');
            console.error('   firebase use --add');
            console.error('   또는');
            console.error('   node get-firebase-logs.js --project YOUR_PROJECT_ID');
        } else if (error.message.includes('firebase: command not found')) {
            console.error('\n💡 해결 방법:');
            console.error('   npm install -g firebase-tools');
        }
        
        process.exit(1);
    }

    if (stderr) {
        console.warn('⚠️ 경고:', stderr);
    }

    // 로그 데이터 처리
    let logData = stdout;
    
    // 헤더 정보 추가
    const header = `# Firebase Functions 상세 로그 (문제 분석용)
# 수집 시간: ${new Date().toLocaleString('ko-KR')}
# 프로젝트: ${projectId || '현재 설정된 프로젝트'}
# 라인 수: ${lines} (상세 로그 ${lines}개)
# 명령어: ${firebaseCmd}
# 용도: 최근 발생한 문제의 상세 분석
# ========================================

`;

    logData = header + logData;

    // 루트 폴더에 파일 저장
    const outputPath = path.resolve(outputFile);
    
    try {
        fs.writeFileSync(outputPath, logData, 'utf8');
        
        console.log('✅ 최근 로그 수집 완료!');
        console.log(`📁 저장 위치: ${outputPath}`);
        console.log(`📊 파일 크기: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
        
        // 로그 요약 정보 표시
        const totalLines = logData.split('\n').length;
        console.log(`📝 총 라인 수: ${totalLines}`);
        
        // 로그 분석을 위한 간단한 통계
        const logLines = logData.split('\n');
        const webhookCount = logLines.filter(line => line.includes('📨')).length;
        const errorCount = logLines.filter(line => line.includes('❌') || line.includes('ERROR')).length;
        const bookingCount = logLines.filter(line => line.includes('📅')).length;
        
        console.log('\n📊 로그 요약:');
        console.log(`   📨 웹훅 요청: ${webhookCount}개`);
        console.log(`   📅 예약 관련: ${bookingCount}개`);
        console.log(`   ❌ 오류: ${errorCount}개`);
        
        // 최근 로그 전체 미리보기 (15줄이므로 모두 표시)
        const previewLines = logData.split('\n').slice(7); // 헤더 제외하고 실제 로그만
        console.log('\n📋 수집된 로그 전체 미리보기:');
        console.log('─'.repeat(100));
        previewLines.forEach((line, index) => {
            if (line.trim()) {
                // 중요한 로그는 강조 표시
                if (line.includes('❌') || line.includes('ERROR')) {
                    console.log(`🔴 ${line}`);
                } else if (line.includes('📨') || line.includes('📅')) {
                    console.log(`🔵 ${line}`);
                } else {
                    console.log(`   ${line}`);
                }
            }
        });
        console.log('─'.repeat(100));
        
        if (errorCount > 0) {
            console.log('\n⚠️  오류가 발견되었습니다. 로그 파일을 확인해주세요.');
        } else {
            console.log('\n✅ 오류가 발견되지 않았습니다.');
        }
        
    } catch (writeError) {
        console.error('❌ 파일 저장 실패:', writeError.message);
        process.exit(1);
    }
});
