const https = require('https');
const fs = require('fs');

// ===============================
// 🚀 AI 응답 길이 제한 핫픽스 배포
// ===============================

/**
 * 현재 ai.js 파일을 읽어서 길이 제한 코드가 포함되어 있는지 확인
 */
function checkAiCodeUpdates() {
  try {
    console.log('🔍 [Check] ai.js 파일의 길이 제한 코드 확인');
    
    const aiFilePath = 'C:\\Users\\jsmh8\\CareConnectBot\\functions\\ai.js';
    const aiContent = fs.readFileSync(aiFilePath, 'utf8');
    
    // 필수 코드 패턴들 확인
    const patterns = [
      'maxOutputTokens: 100',
      '150글자 강제 제한',
      'response.length > 150',
      'CRITICAL RESPONSE LENGTH RULE'
    ];
    
    console.log('📋 코드 패턴 확인 결과:');
    let allPresent = true;
    
    patterns.forEach(pattern => {
      const found = aiContent.includes(pattern);
      const status = found ? '✅' : '❌';
      console.log(`  ${status} "${pattern}": ${found ? '발견됨' : '누락'}`);
      if (!found) allPresent = false;
    });
    
    if (allPresent) {
      console.log('✅ [Check] 모든 길이 제한 코드가 올바르게 포함되어 있습니다');
      return true;
    } else {
      console.log('❌ [Check] 일부 길이 제한 코드가 누락되었습니다');
      return false;
    }
    
  } catch (error) {
    console.error('❌ [Check] ai.js 파일 확인 실패:', error.message);
    return false;
  }
}

/**
 * 프로덕션 배포 상태 확인
 */
function checkDeploymentStatus() {
  return new Promise((resolve, reject) => {
    console.log('🌐 [Deploy Check] 프로덕션 배포 상태 확인');
    
    const options = {
      hostname: 'systemstatus-7ljebxnryq-du.a.run.app',
      port: 443,
      path: '/',
      method: 'GET',
      timeout: 10000
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('✅ [Deploy Check] 시스템 상태 확인 완료');
          console.log(`  📊 Human mode users: ${response.systemStatus?.humanModeUsers?.count || 0}`);
          console.log(`  📊 Pending bookings: ${response.systemStatus?.pendingBookings?.count || 0}`);
          resolve(response);
        } catch (e) {
          console.log('⚠️ [Deploy Check] JSON 파싱 실패, 하지만 서버는 응답함');
          resolve({ status: 'running' });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ [Deploy Check] 시스템 상태 확인 실패:', error.message);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.error('❌ [Deploy Check] 시스템 상태 확인 타임아웃');
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.end();
  });
}

/**
 * 메인 배포 확인 함수
 */
async function main() {
  try {
    console.log('🚀 [Deploy Checker] AI 응답 길이 제한 배포 상태 확인');
    console.log('='.repeat(70));
    
    // 1. 로컬 코드 확인
    const codeOk = checkAiCodeUpdates();
    
    console.log('');
    
    // 2. 프로덕션 상태 확인
    await checkDeploymentStatus();
    
    console.log('');
    
    // 3. 결과 요약
    if (codeOk) {
      console.log('📋 [Summary] 배포 권장사항:');
      console.log('✅ 로컬 코드: 길이 제한 로직 완비');
      console.log('⏳ 프로덕션: 수동 배포 필요');
      console.log('');
      console.log('🔧 권장 조치:');
      console.log('1. Firebase Console에서 직접 함수 업데이트');
      console.log('2. 또는 권한 문제 해결 후 `firebase deploy` 재시도');
      console.log('3. 배포 후 실제 채팅에서 응답 길이 테스트');
    } else {
      console.log('❌ [Summary] 코드 수정이 완료되지 않았습니다');
    }
    
    console.log('');
    console.log('🎯 [Expected Result] 배포 완료 후:');
    console.log('- 모든 AI 응답이 150글자 이내로 제한됨');
    console.log('- 긴 응답은 자동으로 잘려서 전송됨'); 
    console.log('- 로그에 "Length Limit" 메시지 출력됨');
    
  } catch (error) {
    console.error('❌ [Deploy Checker] 확인 실패:', error);
    process.exit(1);
  }
}

// 스크립트로 실행된 경우
if (require.main === module) {
  main().then(() => {
    console.log('\n✅ 배포 상태 확인 완료');
    process.exit(0);
  }).catch(error => {
    console.error('❌ 확인 실패:', error);
    process.exit(1);
  });
}

module.exports = { checkAiCodeUpdates, checkDeploymentStatus };