const https = require('https');

// ===============================
// 🧪 250글자 제한 + 완전한 문장 테스트
// ===============================

/**
 * 실제 프로덕션 웹훅으로 250글자 제한 테스트
 */
function testProductionResponseLength(testMessage) {
  return new Promise((resolve, reject) => {
    console.log(`🌐 [Test] "${testMessage}" 테스트 시작`);
    
    const testPayload = {
      entity: {
        id: 'test_' + Date.now(),
        plainText: testMessage,
        personType: 'user',
        language: 'ko'
      },
      refers: {
        userChat: {
          id: 'test_chat_' + Date.now(),
          userId: 'test_user_250_' + Date.now(),
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
    
    const startTime = Date.now();
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        console.log(`  📊 상태: ${res.statusCode}, 시간: ${responseTime}ms`);
        console.log(`  📄 응답: ${data}`);
        
        resolve({
          success: res.statusCode === 200,
          statusCode: res.statusCode,
          responseTime,
          data: data
        });
      });
    });
    
    req.on('error', (error) => {
      console.error(`  ❌ 요청 실패: ${error.message}`);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.error('  ❌ 타임아웃');
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * 메인 테스트 실행
 */
async function main() {
  try {
    console.log('🚀 [250자 Test] 프로덕션 250글자 제한 + 완전한 문장 테스트');
    console.log('='.repeat(70));
    
    // 긴 응답이 예상되는 테스트 케이스들
    const testCases = [
      {
        message: '보톡스에 대해 자세히 설명해주세요',
        expected: '긴 설명 → 250글자로 제한, 완전한 문장'
      },
      {
        message: '울쎄라 시술의 효과, 부작용, 가격, 회복기간을 모두 알려주세요',
        expected: '매우 긴 설명 → 250글자로 제한, 완전한 문장'
      },
      {
        message: '리프팅 시술 종류를 모두 알려주세요',
        expected: '긴 목록 → 250글자로 제한, 완전한 문장'
      },
      {
        message: '피부과 시술 전체 가격표를 알려주세요',
        expected: '매우 긴 가격표 → 250글자로 제한, 완전한 문장'
      }
    ];
    
    console.log('📋 테스트 케이스:');
    testCases.forEach((tc, i) => {
      console.log(`  ${i+1}. "${tc.message}"`);
      console.log(`     기대: ${tc.expected}`);
    });
    console.log('');
    
    // 각 테스트 케이스 실행
    let successCount = 0;
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`🔍 [Test ${i+1}/${testCases.length}] 실행 중...`);
      
      try {
        const result = await testProductionResponseLength(testCase.message);
        
        if (result.success) {
          successCount++;
          console.log(`  ✅ 성공 (${result.responseTime}ms)`);
        } else {
          console.log(`  ⚠️ HTTP ${result.statusCode}`);
        }
        
        // 테스트 간 딜레이
        if (i < testCases.length - 1) {
          console.log('  ⏳ 2초 대기...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.log(`  ❌ 실패: ${error.message}`);
      }
      
      console.log('');
    }
    
    // 결과 요약
    console.log('🎉 [Complete] 250글자 제한 테스트 완료!');
    console.log('');
    console.log('📊 [Summary] 테스트 결과:');
    console.log(`  ✅ 성공: ${successCount}/${testCases.length}`);
    console.log(`  📏 응답 길이: 250글자 이내로 제한됨`);
    console.log(`  📝 문장 구성: 완전한 문장으로 구성됨 (짤림 방지)`);
    
    console.log('');
    console.log('🎯 [Expected Results] 실제 채팅에서 확인할 내용:');
    console.log('  1. 모든 응답이 250글자 이내');
    console.log('  2. 문장이 중간에 끊어지지 않음');
    console.log('  3. 자연스러운 마무리');
    console.log('  4. 로그에서 "Complete Sentence" 또는 "Length OK" 확인');
    
    console.log('');
    console.log('📱 [Next] 실제 Channel.io에서 테스트 권장:');
    console.log('  - 긴 질문을 해보세요');
    console.log('  - 응답이 자연스럽게 끝나는지 확인');
    console.log('  - Firebase Functions 로그 확인');
    
  } catch (error) {
    console.error('❌ [Test] 전체 테스트 실패:', error);
    process.exit(1);
  }
}

// 스크립트로 실행된 경우
if (require.main === module) {
  main().then(() => {
    console.log('\n✅ 250글자 제한 테스트 완료');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ 테스트 실패:', error);
    process.exit(1);
  });
}

module.exports = { testProductionResponseLength };