const { getFinalResponse } = require('./ai');
const { admin, db } = require('./config');

// ===============================
// 🧪 응답 길이 제한 테스트
// ===============================

async function testResponseLength() {
  try {
    console.log('🧪 [Test] AI 응답 길이 제한 테스트 시작\n');
    
    // 테스트 케이스들 (긴 답변이 예상되는 질문들)
    const testCases = [
      {
        input: "보톡스에 대해 자세히 설명해주세요",
        expected: "긴 설명이 예상됨"
      },
      {
        input: "울쎄라 시술의 모든 효과와 부작용, 가격, 회복기간을 알려주세요",
        expected: "매우 긴 설명이 예상됨"
      },
      {
        input: "리프팅 시술 종류를 모두 알려주세요",
        expected: "긴 목록이 예상됨"
      },
      {
        input: "안녕하세요",
        expected: "짧은 인사"
      },
      {
        input: "가격이 궁금해요",
        expected: "중간 길이 답변"
      }
    ];
    
    console.log('📋 테스트 케이스:');
    testCases.forEach((tc, i) => {
      console.log(`  ${i+1}. "${tc.input}" (${tc.expected})`);
    });
    console.log('');
    
    // 각 테스트 케이스 실행
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`🔍 [Test ${i+1}/${testCases.length}] "${testCase.input}"`);
      console.log('─'.repeat(60));
      
      try {
        const startTime = Date.now();
        
        // getFinalResponse 직접 호출
        const response = await getFinalResponse({
          userInput: testCase.input,
          toolResult: null,
          language: 'ko',
          decision: { action: 'ANSWER' },
          intentState: 'IDLE',
          sessionId: 'test_session_' + Date.now()
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // 응답 분석
        const length = response.length;
        const isWithinLimit = length <= 150;
        const status = isWithinLimit ? '✅ PASS' : '❌ FAIL';
        
        console.log(`${status} 응답 길이: ${length}글자 (제한: 150글자)`);
        console.log(`⏱️ 응답 시간: ${responseTime}ms`);
        console.log(`📝 응답 내용: "${response}"`);
        
        if (!isWithinLimit) {
          console.log(`⚠️ 길이 초과! 예상 잘림: "${response.substring(0, 150)}..."`);
        }
        
      } catch (error) {
        console.log(`❌ 테스트 실패: ${error.message}`);
      }
      
      console.log(''); // 빈 줄
      
      // 테스트 간 딜레이 (API 제한 방지)
      if (i < testCases.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('🎉 [Complete] 응답 길이 제한 테스트 완료!');
    
  } catch (error) {
    console.error('❌ [Test] 전체 테스트 실패:', error);
    throw error;
  }
}

// 메인 실행
async function main() {
  try {
    console.log('🚀 [Main] 응답 길이 제한 동작 확인 테스트');
    console.log('='.repeat(70));
    
    await testResponseLength();
    
    console.log('\n📊 [Summary] 테스트 결과 요약:');
    console.log('✅ 150글자 이내 응답: PASS');
    console.log('❌ 150글자 초과 응답: FAIL (수정 필요)');
    
  } catch (error) {
    console.error('❌ [Main] 프로세스 실패:', error);
    process.exit(1);
  }
}

// 스크립트로 실행된 경우
if (require.main === module) {
  main().then(() => {
    console.log('\n✅ 테스트 완료');
    process.exit(0);
  }).catch(error => {
    console.error('❌ 테스트 에러:', error);
    process.exit(1);
  });
}

module.exports = { testResponseLength };