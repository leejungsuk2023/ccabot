/**
 * 실제 운영환경 AI 응답 테스트
 * 운영 중인 정확한 프롬프트와 설정으로 테스트
 */

const { getFinalResponse } = require('./ai');
const { detectLanguage, getPolicyContext } = require('./utils');

async function testProductionAI() {
  console.log('🔥 === 운영환경 AI 응답 테스트 ===\n');
  
  // 실제 태국어 질문 테스트
  const thaiQuestion = "สวัสดีค่ะ สามารถเสริมจมูกได้ไหมคะ?";
  const userId = "test-user-thai";
  const userChatId = "test-chat-thai";
  
  console.log(`📝 질문: "${thaiQuestion}"`);
  
  // 언어 감지
  const detectedLang = detectLanguage(thaiQuestion);
  console.log(`🔍 감지된 언어: ${detectedLang}`);
  
  try {
    // 실제 getFinalResponse 함수 호출 (운영환경과 동일)
    const response = await getFinalResponse(
      thaiQuestion,
      userId,
      userChatId,
      null, // toolResult
      'IDLE', // intentState
      {}  // sessionData
    );
    
    console.log(`🤖 AI 응답: "${response}"`);
    
    // 응답 언어 검증
    const responseLang = detectLanguage(response);
    console.log(`✅ 응답 언어: ${responseLang}`);
    
    if (detectedLang === responseLang) {
      console.log('🎉 언어 매칭 성공!');
    } else {
      console.log(`❌ 언어 불일치! 예상: ${detectedLang}, 실제: ${responseLang}`);
      console.log('🔍 디버깅을 위한 추가 정보:');
      console.log(`   - 입력 언어: ${detectedLang}`);
      console.log(`   - 출력 언어: ${responseLang}`);
      console.log(`   - 응답 길이: ${response.length}글자`);
    }
    
  } catch (error) {
    console.error('❌ AI 응답 생성 실패:', error.message);
    console.error('스택:', error.stack);
  }
  
  console.log('\n🇰🇷 === 한국어 비교 테스트 ===');
  
  // 한국어 테스트로 비교
  const koreanQuestion = "안녕하세요, 코 성형 가능한가요?";
  console.log(`📝 질문: "${koreanQuestion}"`);
  
  try {
    const response = await getFinalResponse(
      koreanQuestion,
      userId,
      userChatId,
      null,
      'IDLE',
      {}
    );
    
    console.log(`🤖 AI 응답: "${response}"`);
    const responseLang = detectLanguage(response);
    console.log(`✅ 응답 언어: ${responseLang}`);
    
  } catch (error) {
    console.error('❌ 한국어 테스트 실패:', error.message);
  }
  
  console.log('\n🌐 === Policy Context 확인 ===');
  
  try {
    const policyContext = await getPolicyContext('NORMAL');
    console.log('📋 Policy Context 길이:', policyContext.length, '글자');
    
    // 언어 관련 키워드 검색
    const langKeywords = ['언어', 'language', 'Thai', 'Korean', '태국어', '한국어'];
    const foundKeywords = langKeywords.filter(keyword => 
      policyContext.toLowerCase().includes(keyword.toLowerCase())
    );
    
    console.log('🔍 언어 관련 키워드:', foundKeywords);
    
    // 특정 문구 찾기
    if (policyContext.includes('사용자가 태국어로 질문하면 자연스러운 태국어로 응답')) {
      console.log('✅ 태국어 응답 지침 발견');
    } else {
      console.log('❌ 태국어 응답 지침 없음');
    }
    
  } catch (error) {
    console.error('❌ Policy Context 조회 실패:', error.message);
  }
}

// 테스트 실행
testProductionAI()
  .then(() => {
    console.log('\n✅ 테스트 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 테스트 실패:', error);
    process.exit(1);
  });