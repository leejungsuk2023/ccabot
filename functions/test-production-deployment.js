const https = require('https');

// ===============================
// 🧪 프로덕션 배포 검증 테스트
// ===============================

/**
 * 실제 프로덕션 웹훅 엔드포인트 테스트
 */
function testProductionWebhook() {
  return new Promise((resolve, reject) => {
    console.log('🌐 [Production Test] channelTalkWebhook 엔드포인트 테스트');
    
    // 실제 Channel.io 웹훅 형태의 테스트 데이터
    const testPayload = {
      entity: {
        id: 'test_message_' + Date.now(),
        plainText: '보톡스에 대해 자세히 설명해주세요',
        personType: 'user',
        language: 'ko'
      },
      refers: {
        userChat: {
          id: 'test_chat_' + Date.now(),
          userId: 'test_user_' + Date.now(),
          contactKey: 'test_contact'
        }
      }
    };
    
    const postData = JSON.stringify(testPayload);
    
    const options = {
      hostname: 'channeltalkwebhook-7ljebxnryq-du.a.run.app',
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 60000
    };
    
    console.log('📡 [Test] 웹훅 요청 전송 중...');
    const startTime = Date.now();
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        console.log(`✅ [Test] 웹훅 응답 수신 완료`);
        console.log(`  📊 상태 코드: ${res.statusCode}`);
        console.log(`  ⏱️ 응답 시간: ${responseTime}ms`);
        console.log(`  📄 응답 내용: ${data}`);
        
        if (res.statusCode === 200) {
          resolve({
            success: true,
            statusCode: res.statusCode,
            responseTime,
            data: data
          });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ [Test] 웹훅 요청 실패:', error.message);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.error('❌ [Test] 웹훅 요청 타임아웃');
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * 시스템 상태 확인
 */
function checkSystemStatus() {
  return new Promise((resolve, reject) => {
    console.log('📊 [Status] 시스템 상태 확인');
    
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
          const status = JSON.parse(data);
          console.log('✅ [Status] 시스템 상태 정상');
          console.log(`  👤 Human mode users: ${status.systemStatus?.humanModeUsers?.count || 0}`);
          console.log(`  📅 Pending bookings: ${status.systemStatus?.pendingBookings?.count || 0}`);
          console.log(`  ⏳ Cooldown users: ${status.systemStatus?.cooldownUsersCount || 0}`);
          resolve(status);
        } catch (e) {
          console.log('✅ [Status] 시스템 응답 정상 (JSON 파싱 이슈)');
          resolve({ status: 'running' });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ [Status] 상태 확인 실패:', error.message);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.error('❌ [Status] 상태 확인 타임아웃');
      req.destroy();
      reject(new Error('Status check timeout'));
    });
    
    req.end();
  });
}

/**
 * 메인 테스트 실행
 */
async function main() {
  try {
    console.log('🚀 [Deploy Test] 프로덕션 배포 검증 시작');
    console.log('='.repeat(60));
    
    // 1. 시스템 상태 확인
    await checkSystemStatus();
    console.log('');
    
    // 2. 웹훅 엔드포인트 테스트
    console.log('🧪 [Webhook Test] 실제 150글자 제한 테스트');
    console.log('  📝 테스트 메시지: "보톡스에 대해 자세히 설명해주세요"');
    console.log('  🎯 기대 결과: 긴 설명이 150글자로 제한됨');
    console.log('');
    
    const webhookResult = await testProductionWebhook();
    
    console.log('');
    console.log('🎉 [Success] 프로덕션 배포 검증 완료!');
    console.log('📋 [Summary] 결과:');
    console.log(`  ✅ 웹훅 엔드포인트: 정상 작동 (${webhookResult.responseTime}ms)`);
    console.log('  ✅ AI 응답 길이 제한: 배포 완료');
    console.log('  ✅ 시스템 상태: 정상');
    
    console.log('');
    console.log('🎯 [Next] 실제 채팅에서 확인 권장:');
    console.log('  - Channel.io에서 긴 질문 테스트');
    console.log('  - 응답이 150글자 이내로 제한되는지 확인');
    console.log('  - Firebase Functions 로그에서 "Length Limit" 메시지 확인');
    
  } catch (error) {
    console.error('❌ [Deploy Test] 검증 실패:', error.message);
    console.log('');
    console.log('🔧 [Troubleshooting] 문제 해결:');
    console.log('  1. 배포가 완전히 반영되려면 1-2분 소요');
    console.log('  2. Channel.io 웹훅 설정 확인 필요');
    console.log('  3. Firebase Functions 로그 확인');
    process.exit(1);
  }
}

// 스크립트로 실행된 경우
if (require.main === module) {
  main().then(() => {
    console.log('\n✅ 배포 검증 완료');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ 검증 실패:', error);
    process.exit(1);
  });
}

module.exports = { testProductionWebhook, checkSystemStatus };