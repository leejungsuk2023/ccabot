const { detectLanguage, getLanguagePatterns } = require('./utils');
const { getAiDecision, getFinalResponse } = require('./ai');

// 태국어 응답 테스트
async function testThaiLanguage() {
  console.log('🧪 태국어 응답 시스템 테스트 시작\n');

  // 테스트 케이스들
  const testCases = [
    {
      text: 'สวัสดีค่ะ',
      description: '기본 태국어 인사'
    },
    {
      text: 'โบท็อกซ์ราคาเท่าไหร่คะ',
      description: '보톡스 가격 문의 (태국어)'
    },
    {
      text: 'ผิวสวยทำอย่างไรคะ',
      description: '피부 미용 문의 (태국어)'
    },
    {
      text: 'นัดหมายได้ไหมคะ',
      description: '예약 문의 (태국어)'
    },
    {
      text: 'ขอบคุณค่ะ',
      description: '감사 인사 (태국어)'
    }
  ];

  for (const testCase of testCases) {
    console.log(`📝 테스트: ${testCase.description}`);
    console.log(`입력: ${testCase.text}`);
    
    // 언어 감지 테스트
    const detectedLang = detectLanguage(testCase.text);
    console.log(`🌐 감지된 언어: ${detectedLang}`);
    
    // 언어 패턴 테스트
    const patterns = getLanguagePatterns(detectedLang);
    console.log(`📋 언어 패턴: ${Object.keys(patterns).length}개 패턴`);
    
    // AI 응답 테스트 (시뮬레이션)
    try {
      const aiResponse = await getAiDecision({
        userInput: testCase.text,
        intentState: 'IDLE',
        sessionId: 'test-session'
      });
      
      console.log(`🤖 AI 응답: ${aiResponse.response || '응답 없음'}`);
      console.log(`🔧 AI 액션: ${aiResponse.action}`);
      
    } catch (error) {
      console.log(`❌ AI 응답 실패: ${error.message}`);
    }
    
    console.log('─'.repeat(50));
  }

  // 한국어와 비교 테스트
  console.log('\n🇰🇷 한국어 비교 테스트');
  const koreanText = '안녕하세요 보톡스 가격이 궁금해요';
  const koreanLang = detectLanguage(koreanText);
  console.log(`한국어 입력: ${koreanText}`);
  console.log(`감지된 언어: ${koreanLang}`);
  
  // 영어와 비교 테스트
  console.log('\n🇺🇸 영어 비교 테스트');
  const englishText = 'Hello, what is the price of botox?';
  const englishLang = detectLanguage(englishText);
  console.log(`영어 입력: ${englishText}`);
  console.log(`감지된 언어: ${englishLang}`);
  
  console.log('\n✅ 태국어 응답 시스템 테스트 완료');
}

// 태국어 응답 품질 테스트
async function testThaiResponseQuality() {
  console.log('\n🔍 태국어 응답 품질 테스트');
  
  const thaiQuestions = [
    'โบท็อกซ์คืออะไรคะ',
    'ผิวสวยทำอย่างไรคะ',
    'นัดหมายได้ไหมคะ',
    'ราคาเท่าไหร่คะ',
    'ปลอดภัยไหมคะ'
  ];
  
  for (const question of thaiQuestions) {
    console.log(`\n❓ 질문: ${question}`);
    
    try {
      const response = await getAiDecision({
        userInput: question,
        intentState: 'IDLE',
        sessionId: 'quality-test'
      });
      
      if (response && response.response) {
        const responseLang = detectLanguage(response.response);
        console.log(`🤖 응답: ${response.response}`);
        console.log(`🌐 응답 언어: ${responseLang}`);
        console.log(`✅ 태국어 응답 여부: ${responseLang === 'th' ? '성공' : '실패'}`);
      }
      
    } catch (error) {
      console.log(`❌ 응답 실패: ${error.message}`);
    }
  }
}

// 메인 실행
async function main() {
  try {
    await testThaiLanguage();
    await testThaiResponseQuality();
  } catch (error) {
    console.error('❌ 테스트 실행 실패:', error);
  }
}

// 스크립트 직접 실행 시에만 실행
if (require.main === module) {
  main();
}

module.exports = {
  testThaiLanguage,
  testThaiResponseQuality
};
