/**
 * 태국어 응답 생성 테스트
 * Gemini AI가 실제로 태국어로 응답하는지 확인
 */

const axios = require('axios');
const { GEMINI_API_KEY } = require('./config');
const { detectLanguage } = require('./utils');

async function testThaiResponse() {
  console.log('🇹🇭 === 태국어 응답 테스트 시작 ===\n');
  
  // 테스트할 태국어 질문들
  const thaiQuestions = [
    'สวัสดีค่ะ',
    'ราคาเท่าไหร่คะ',
    'เสริมจมูกได้ไหมคะ',
    'มีโปรโมชั่นไหม'
  ];
  
  for (const question of thaiQuestions) {
    console.log(`\n📝 질문: "${question}"`);
    
    // 언어 감지
    const detectedLang = detectLanguage(question);
    console.log(`🔍 감지된 언어: ${detectedLang}`);
    
    // Gemini API 호출
    try {
      const system = `
You are a friendly medical beauty clinic assistant.

🌐 MULTI-LANGUAGE SUPPORT:
- AUTOMATICALLY detect user's language and respond in the SAME language
- User's detected language: ${detectedLang}
- CRITICAL: You MUST respond in ${detectedLang === 'th' ? 'Thai (ภาษาไทย)' : detectedLang} language
- If user speaks Thai, respond in Thai
- If user speaks Korean, respond in Korean
- If user speaks English, respond in English

Current user language: ${detectedLang}
YOU MUST RESPOND IN: ${detectedLang === 'th' ? 'Thai language (ภาษาไทย)' : detectedLang}

Response requirements:
- Keep response under 100 characters
- Be friendly and helpful
- Use the same language as the user input
`;
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
      
      const requestBody = {
        contents: [{
          parts: [{
            text: question
          }]
        }],
        systemInstruction: {
          parts: [{
            text: system
          }]
        },
        generationConfig: {
          maxOutputTokens: 200,
          temperature: 0.7
        }
      };
      
      const response = await axios.post(url, requestBody, {
        timeout: 10000
      });
      
      const aiResponse = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log(`🤖 AI 응답: "${aiResponse}"`);
      
      // 응답 언어 검증
      const responseLang = detectLanguage(aiResponse);
      console.log(`✅ 응답 언어: ${responseLang}`);
      
      if (detectedLang === responseLang) {
        console.log('✅ 언어 매칭 성공!');
      } else {
        console.log(`❌ 언어 불일치! 예상: ${detectedLang}, 실제: ${responseLang}`);
      }
      
    } catch (error) {
      console.error('❌ API 호출 실패:', error.message);
    }
  }
  
  console.log('\n\n🎯 === 추가 다국어 테스트 ===');
  
  // 다른 언어 테스트
  const multiLangTests = [
    { text: '안녕하세요', lang: 'ko' },
    { text: 'Hello', lang: 'en' },
    { text: 'こんにちは', lang: 'ja' }
  ];
  
  for (const test of multiLangTests) {
    console.log(`\n📝 ${test.lang.toUpperCase()} 테스트: "${test.text}"`);
    
    try {
      const system = `
You are a friendly assistant.
User language detected: ${test.lang}
YOU MUST respond in ${test.lang} language.
Keep response under 50 characters.
`;
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
      
      const requestBody = {
        contents: [{
          parts: [{
            text: test.text
          }]
        }],
        systemInstruction: {
          parts: [{
            text: system
          }]
        },
        generationConfig: {
          maxOutputTokens: 100,
          temperature: 0.7
        }
      };
      
      const response = await axios.post(url, requestBody, {
        timeout: 10000
      });
      
      const aiResponse = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const responseLang = detectLanguage(aiResponse);
      
      console.log(`🤖 응답: "${aiResponse}"`);
      console.log(`${test.lang === responseLang ? '✅' : '❌'} 언어: ${responseLang}`);
      
    } catch (error) {
      console.error('❌ 실패:', error.message);
    }
  }
}

// 테스트 실행
testThaiResponse()
  .then(() => {
    console.log('\n✅ 테스트 완료');
  })
  .catch(error => {
    console.error('❌ 테스트 실패:', error);
  });