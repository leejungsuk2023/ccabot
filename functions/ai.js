const axios = require('axios');
const { GEMINI_API_KEY, db } = require('./config');
const { extractJsonFromText, getKnowledgeBase, handleError, searchKnowledgeBase, semanticSearchKnowledgeBase, getConversationHistory, getPolicyContext, detectLanguage } = require('./utils');
const { assembleSystemPrompt } = require('./promptManager');

// 언어별 메시지 함수들
function getErrorMessage(language) {
  const messages = {
    'ko': '죄송합니다, AI 시스템에 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    'th': 'ขอโทษค่ะ มีข้อผิดพลาดชั่วคราวในระบบ AI กรุณาลองใหม่ในอีกสักครู่ค่ะ',
    'en': 'Sorry, there was a temporary error with the AI system. Please try again later.',
    'ja': 'すみません、AIシステムに一時的なエラーが発生しました。少し待ってから再度お試しください。'
  };
  return messages[language] || messages['en'];
}

function getDefaultMessage(language) {
  const messages = {
    'ko': '도움이 필요하신 내용을 조금만 더 구체적으로 알려주실 수 있을까요?',
    'th': 'ช่วยบอกรายละเอียดที่ต้องการความช่วยเหลือให้ชัดเจนหน่อยได้ไหมคะ',
    'en': 'Could you please provide more specific details about what you need help with?',
    'ja': '必要なサポートについて、もう少し具体的に教えていただけますか？'
  };
  return messages[language] || messages['en'];
}

function getSentenceEnders(language) {
  const patterns = {
    'ko': [
      '습니다.', '습니다!', '습니다?',
      '입니다.', '입니다!', '입니다?', 
      '했습니다.', '했습니다!', '했습니다?',
      '됩니다.', '됩니다!', '됩니다?',
      '있습니다.', '있습니다!', '있습니다?',
      '하세요.', '하세요!', '하세요?',
      '해요.', '해요!', '해요?',
      '이에요.', '이에요!', '이에요?',
      '예요.', '예요!', '예요?',
      '에요.', '에요!', '에요?',
      '.', '!', '?'
    ],
    'th': [
      'ค่ะ.', 'ค่ะ!', 'ค่ะ?',
      'ครับ.', 'ครับ!', 'ครับ?',
      'คะ.', 'คะ!', 'คะ?',
      'นะคะ.', 'นะคะ!', 'นะคะ?',
      'นะครับ.', 'นะครับ!', 'นะครับ?',
      '.', '!', '?'
    ],
    'en': [
      ' you.', ' you!', ' you?',
      ' it.', ' it!', ' it?',
      ' help.', ' help!', ' help?',
      '.', '!', '?'
    ],
    'ja': [
      'です.', 'です!', 'です?',
      'ます.', 'ます!', 'ます?',
      'でした.', 'でした!', 'でした?',
      'ました.', 'ました!', 'ました?',
      '.', '!', '?'
    ]
  };
  return patterns[language] || patterns['en'];
}

function getEllipsis(language) {
  const ellipsis = {
    'ko': '...',
    'th': '...',
    'en': '...',
    'ja': '...'
  };
  return ellipsis[language] || '...';
}

// ===============================
// 🤖 AI Orchestrator Brain (RAG + Decision)
// ===============================

// Get current date for context (fixed at function definition time to avoid dynamic changes)
const currentDate = new Date();
const tomorrowDate = new Date(currentDate.getTime() + 24*60*60*1000);

// TECH_INSTRUCTIONS moved to promptManager

async function getAiDecision({ userInput, sessionId, language = 'ko', intentState = 'IDLE' }) {
  // 사용자 언어 자동 감지 (최상위 스코프에서 먼저 정의)
  const detectedLanguage = detectLanguage(userInput);
  
  try {
    console.log(`🔍 [AI] 사용자 입력 분석 시작: "${userInput}" (상태: ${intentState})`);
    
    // 세션 정보를 통해 conversationState 확인
    const { getSession } = require('./utils');
    const sessionData = await getSession(sessionId);
    const conversationState = sessionData?.conversationState || 'NORMAL';
    
    console.log(`🎭 [AI Mode] ${conversationState} 모드로 Policy Context 로딩`);
    const policyContext = await getPolicyContext();
    const kb = await getKnowledgeBase();

    // Enhanced RAG: 의미론적 검색으로 더 정확한 컨텍스트 구축
    const ragContext = await semanticSearchKnowledgeBase(userInput, kb) || '';
    console.log(`🌐 [Language] 감지된 언어: ${detectedLanguage}`);

    const system = await assembleSystemPrompt({ mode: conversationState, language: detectedLanguage, intentState });
    // --- START OF CRITICAL CHANGE: history injection ---
    const history = await getConversationHistory(sessionId);
    console.log(`[History] Found ${history.length} previous turns for user ${sessionId}`);
    const contents = [
      ...history,
      { role: 'user', parts: [{ text: `User Input: ${userInput}\nRAG Context (optional): ${ragContext || 'N/A'}\nReturn STRICT JSON.` }] }
    ];
    // --- END OF CRITICAL CHANGE ---

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const requestBody = {
      contents,
      systemInstruction: { parts: [{ text: system }] },
      generationConfig: {
        maxOutputTokens: 500,  // JSON 응답이 완전히 생성되도록 충분한 토큰 할당
        temperature: 0.7,
        topP: 0.9,
        topK: 50
      }
      // Note: googleSearch removed here - JSON output required for decision making
    };
    const { data } = await axios.post(url, requestBody);
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let json = extractJsonFromText(text);

    // Handle function_call format from Gemini (convert to expected format)
    if (json && json.function_call && !json.action) {
      console.log('🔄 [AI] function_call 형식 감지, CALL_FUNCTION으로 변환');
      json = {
        action: 'CALL_FUNCTION',
        functionName: json.function_call.name,
        parameters: json.function_call.parameters || json.function_call.arguments || {},
        nextState: json.nextState || 'IDLE'
      };
    }

    // --- START OF CRITICAL CHANGE: hardened fallback ---
    if (!json || !json.action) {
      console.warn('⚠️ [AI] 유효한 JSON 액션을 받지 못했습니다. 사용자에게 재요청합니다.', { receivedText: text });
      
      // 언어별 fallback 메시지
      const fallbackMessages = {
        'ko': '죄송합니다, 요청을 정확히 이해하지 못했어요. 조금 다른 방식으로 말씀해주시겠어요?',
        'th': 'ขอโทษค่ะ ฉันเข้าใจคำถามของคุณไม่ค่อยค่ะ กรุณาถามใหม่ได้ไหมคะ',
        'en': "I'm sorry, I didn't understand your request. Could you please rephrase it?",
        'ja': 'すみません、リクエストを理解できませんでし〇。別の表現で言い換えていただけますか？'
      };
      
      return {
        action: 'ANSWER',
        response: fallbackMessages[detectedLanguage] || fallbackMessages['en']
      };
    }
    // --- END OF CRITICAL CHANGE ---
    // attach grounding context always when available to avoid duplicate RAG later
    if (ragContext) json.groundingContext = ragContext;
    // nextState 필드가 없으면 보수적으로 현재 상태 유지
    if (!json.nextState) json.nextState = intentState;
    return json;
  } catch (error) {
    console.error('❌ getAiDecision error:', error);
    return {
      action: 'ANSWER',
      response: getErrorMessage(detectedLanguage || 'ko')
    };
  }
}

async function getFinalResponse({ userInput, toolResult, language = 'ko', decision, intentState, sessionId }) {
  try {
    // 세션 정보 가져오기 (대화 상태 확인)
    const { getSession } = require('./utils');
    const sessionData = await getSession(sessionId);
    const conversationCount = sessionData?.conversationCount || 0;
    const conversationState = sessionData?.conversationState || 'NORMAL';
    
    console.log(`📊 [AI Response] 대화 ${conversationCount}회, 상태: ${conversationState}`);
    console.log(`🎭 [Final Response Mode] ${conversationState} 모드로 Policy Context 로딩`);
    
    const policyContext = await getPolicyContext();
    const kb = await getKnowledgeBase();
    const ragContext = decision?.groundingContext || await semanticSearchKnowledgeBase(userInput, kb) || '';
    
    // CRITICAL FIX: 대화 히스토리 포함
    const history = await getConversationHistory(sessionId);
    console.log(`[Final Response] 대화 히스토리 ${history.length}개 포함`);
    
    // 사용자 언어 감지
    const { detectLanguage, getLanguagePatterns } = require('./utils');
    const { formatDateTimeByLanguage } = require('./timeUtils');
    const detectedLanguage = detectLanguage(userInput);
    const languagePatterns = getLanguagePatterns(detectedLanguage);
    console.log(`🌐 [Final Response] 감지된 언어: ${detectedLanguage}`);
    
    // Build state-aware system instruction with conversation state
    const system = await assembleSystemPrompt({ mode: conversationState, language: detectedLanguage, intentState });


    let contextText = `사용자 입력: ${userInput}\n참고정보: ${ragContext}`;
    
    // Add tool result context if available with time formatting
    if (toolResult) {
      // 예약 확정 시 시간 포맷팅 적용
      if (toolResult.action === 'booking_confirmed' && toolResult.data?.selectedTime) {
        const formattedTime = formatDateTimeByLanguage(toolResult.data.selectedTime, detectedLanguage);
        const customerName = toolResult.data.customerName || '';
        
        // 언어별 예약 확정 메시지 생성
        const confirmMessage = languagePatterns.bookingConfirmed
          .replace('{name}', customerName)
          .replace('{time}', formattedTime);
        
        // 툴 결과에 포맷된 응답 추가
        toolResult.formattedResponse = confirmMessage;
        console.log(`🌐 [Time Format] ${detectedLanguage}에 맞게 시간 포맷팅: ${formattedTime}`);
      }
      
      contextText += `\n도구 실행 결과: ${JSON.stringify(toolResult, null, 2)}`;
    }

    // CRITICAL FIX: 대화 히스토리 포함
    const contents = [
      ...history,
      { role: 'user', parts: [{ text: contextText }] }
    ];
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const requestBody = { 
      contents, 
      systemInstruction: { parts: [{ text: system }] },
      generationConfig: {
        maxOutputTokens: 400,  // 여유있게 생성 후 후처리에서 250글자로 제한
        temperature: 0.7,      // 일관성 있는 응답
        topP: 0.9,            // 자연스러운 문장 구성
        topK: 50              // 완전한 문장 생성을 위한 선택의 폭 확대
      },
      tools: [{
        googleSearch: {}
      }]
    };
    const { data } = await axios.post(url, requestBody);
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // 🔥 CRITICAL: 250글자 제한 + 완전한 문장 보장
    const response = text.trim() || getDefaultMessage(detectedLanguage || 'ko');
    
    if (response.length > 250) {
      // 언어별 문장 끝 패턴
      const sentenceEnders = getSentenceEnders(detectedLanguage || 'ko');
      
      let bestCutPoint = -1;
      
      // 문장 끝 패턴을 길이 순으로 검사하여 가장 적절한 자르기 지점 찾기
      for (const ender of sentenceEnders) {
        const cutPoint = response.lastIndexOf(ender, 250);
        if (cutPoint > bestCutPoint && cutPoint >= 100) { // 최소 100글자는 보장
          bestCutPoint = cutPoint + ender.length;
        }
      }
      
      if (bestCutPoint > 100) {
        const truncated = response.substring(0, bestCutPoint);
        console.log(`⚡ [Complete Sentence] ${response.length}글자 → ${truncated.length}글자로 완전한 문장 구성`);
        return truncated;
      } else {
        // 적절한 문장 끝을 찾지 못한 경우 250글자에서 자르고 마침표 추가
        const truncated = response.substring(0, 247);
        const ellipsis = getEllipsis(detectedLanguage || 'ko');
        console.log(`⚡ [Force Limit] ${response.length}글자 → 250글자로 제한 후 마침표 추가`);
        return truncated + ellipsis;
      }
    }
    
    console.log(`✅ [Length OK] ${response.length}글자 (250글자 이내)`);
    return response;
  } catch (error) {
    // 사용자 언어 감지
    const { detectLanguage } = require('./utils');
    const detectedLanguage = detectLanguage(userInput);
    return handleError('AI', error, sessionId, detectedLanguage);
  }
}

// no local RAG needed; delegated to utils.searchKnowledgeBase

module.exports = {
  getAiDecision,
  getFinalResponse
};


