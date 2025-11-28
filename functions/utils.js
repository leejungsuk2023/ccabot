const { v4: uuidv4 } = require('uuid');
const { admin, db } = require('./config');
const { getEmbeddingService } = require('./embeddings');

// ===============================
// 🔧 유틸리티 함수들
// ===============================

/**
 * LLM 응답에서 순수 JSON을 안전하게 추출/정제
 * @param {string} text - 정제할 텍스트
 * @returns {Object|null} - 파싱된 JSON 객체 또는 null
 */
function extractJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;
  
  let cleaned = text.trim()
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/```$/g, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  // 더 많은 일반적인 오류를 수정하기 위한 정규식 추가
  // 예: "key": "value" "another_key": ... -> "key": "value", "another_key": ...
  cleaned = cleaned.replace(/}"\s*([a-zA-Z0-9_]+)"\s*:/g, '}", "$1":');

  // 키에 따옴표가 없는 경우 자동 보정: { key: ..., another: ... } -> { "key": ..., "another": ... }
  cleaned = cleaned.replace(/([\{,]\s*)([A-Za-z0-9_]+)\s*:/g, (m, p1, key) => `${p1}"${key}":`);

  // 후행 쉼표 제거
  cleaned = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('⚠️ [JSON] 파싱 실패. 원문:', text.slice(0, 200));
    return null;
  }
}

/**
 * 안전한 메시지 데이터 생성 (undefined 방지)
 * @param {Object} params - 메시지 파라미터
 * @returns {Object} - 안전한 메시지 데이터
 */
function createSafeMessageData(params) {
  return {
    userId: params.userId || '',
    userChatId: params.userChatId || '',
    chatKey: params.chatKey || '',
    sender: params.sender || 'unknown',
    text: params.text || '',
    timestamp: params.timestamp || admin.firestore.Timestamp.now()
  };
}

/**
 * 에러 로깅 및 사용자 친화적 메시지 생성 (다국어 지원)
 * @param {string} context - 에러 발생 컨텍스트
 * @param {Error} error - 발생한 에러
 * @param {string} userId - 사용자 ID (선택적)
 * @param {string} language - 언어 코드 (기본값: 'ko')
 * @returns {string} - 사용자에게 보여줄 메시지
 */
function handleError(context, error, userId = '', language = 'ko') {
  const errorId = uuidv4().slice(0, 8);
  console.error(`❌ [${context}] 에러 발생 (ID: ${errorId}):`, {
    message: error.message,
    stack: error.stack,
    userId: userId,
    timestamp: new Date().toISOString()
  });

  // 다국어 지원 안전한 에러 메시지
  const safeMessages = {
    'AI': {
      'ko': '죄송합니다. AI 처리 중 문제가 발생했습니다. 담당자가 확인하겠습니다.',
      'th': 'ขอโทษค่ะ เกิดข้อผิดพลาดในระบบ AI เจ้าหน้าที่จะตรวจสอบให้ค่ะ',
      'en': 'Sorry, there was an issue with the AI system. Our staff will check it.',
      'ja': 'すみません、AIシステムに問題が発生しました。担当者が確認いたします。'
    },
    'Calendar': {
      'ko': '죄송합니다. 예약 시스템에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      'th': 'ขอโทษค่ะ เกิดปัญหาชั่วคราวในระบบจองคิว กรุณาลองใหม่อีกครั้งค่ะ',
      'en': 'Sorry, there was a temporary issue with the booking system. Please try again later.',
      'ja': 'すみません、予約システムに一時的な問題が発生しました。少し待ってから再度お試しください。'
    },
    'ChannelTalk': {
      'ko': '메시지 전송 중 문제가 발생했습니다. 담당자가 확인하겠습니다.',
      'th': 'เกิดปัญหาในการส่งข้อความ เจ้าหน้าที่จะตรวจสอบให้ค่ะ',
      'en': 'There was an issue sending the message. Our staff will check it.',
      'ja': 'メッセージの送信中に問題が発生しました。担当者が確認いたします。'
    },
    'Database': {
      'ko': '데이터 처리 중 문제가 발생했습니다. 담당자가 확인하겠습니다.',
      'th': 'เกิดปัญหาในการประมวลผลข้อมูล เจ้าหน้าที่จะตรวจสอบให้ค่ะ',
      'en': 'There was an issue processing the data. Our staff will check it.',
      'ja': 'データ処理中に問題が発生しました。担当者が確認いたします。'
    }
  };

  const defaultMessages = {
    'ko': '일시적인 문제가 발생했습니다. 담당자가 확인하겠습니다.',
    'th': 'เกิดปัญหาชั่วคราว เจ้าหน้าที่จะตรวจสอบให้ค่ะ',
    'en': 'A temporary issue occurred. Our staff will check it.',
    'ja': '一時的な問題が発生しました。担当者が確認いたします。'
  };

  const contextMessages = safeMessages[context];
  if (contextMessages && contextMessages[language]) {
    return contextMessages[language];
  }

  return defaultMessages[language] || defaultMessages['en'];
}

/**
 * Firestore 작업을 안전하게 실행
 * @param {Function} operation - 실행할 Firestore 작업
 * @param {string} context - 작업 컨텍스트
 * @returns {Promise<any>} - 작업 결과 또는 null
 */
async function safeFirestoreOperation(operation, context) {
  try {
    return await operation();
  } catch (error) {
    handleError('Database', error);
    return null;
  }
}

// ===============================
// 🚀 성능 최적화 - 캐싱 시스템
// ===============================

/**
 * 캐시에서 데이터 조회
 * @param {string} key - 캐시 키
 * @returns {any} - 캐시된 데이터 또는 null
 */
function getFromCache(key) {
  try {
    const cacheKey = `cache_${key}`;
    const cached = global[cacheKey];
    
    if (!cached) return null;
    
    // TTL 체크
    if (cached.expiresAt && Date.now() > cached.expiresAt) {
      delete global[cacheKey];
      return null;
    }
    
    return cached.data;
  } catch (error) {
    console.error('❌ [Cache] 데이터 조회 실패:', error);
    return null;
  }
}

/**
 * 캐시에 데이터 저장
 * @param {string} key - 캐시 키
 * @param {any} data - 저장할 데이터
 * @param {number} ttlSeconds - TTL (초, 기본값: 300초)
 */
function setCache(key, data, ttlSeconds = 300) {
  try {
    const cacheKey = `cache_${key}`;
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    
    global[cacheKey] = {
      data: data,
      expiresAt: expiresAt,
      createdAt: Date.now()
    };
    
    // 메모리 누수 방지: 1분마다 만료된 캐시 정리
    if (!global.cacheCleanupInterval) {
      global.cacheCleanupInterval = setInterval(() => {
        Object.keys(global).forEach(key => {
          if (key.startsWith('cache_') && global[key]?.expiresAt && Date.now() > global[key].expiresAt) {
            delete global[key];
          }
        });
      }, 60000);
    }
  } catch (error) {
    console.error('❌ [Cache] 데이터 저장 실패:', error);
  }
}

/**
 * 캐시의 모든 키 조회 (AI 응답 중복 감지용)
 * @returns {Object} - 캐시된 데이터 객체
 */
function getCache() {
  try {
    const cacheData = {};
    Object.keys(global).forEach(key => {
      if (key.startsWith('cache_')) {
        const cacheKey = key.replace('cache_', '');
        const cached = global[key];
        
        // TTL 체크
        if (cached.expiresAt && Date.now() > cached.expiresAt) {
          delete global[key];
          return;
        }
        
        cacheData[cacheKey] = cached.data;
      }
    });
    
    return cacheData;
  } catch (error) {
    console.error('❌ [Cache] 전체 캐시 조회 실패:', error);
    return {};
  }
}

/**
 * 최적화된 지식 베이스 조회 (policy_context 제외, 캐싱 적용)
 * @returns {Promise<Object>} - 지식 베이스 데이터
 */
async function getKnowledgeBase() {
  const cacheKey = 'knowledge_base';
  const cached = getFromCache(cacheKey);
  
  if (cached) {
    return cached;
  }

  try {
    console.log('🚀 [Performance] 지식 베이스 DB 조회 시작 (policy_context 제외)...');
    const [promotionsDoc, pricingDoc, faqsDoc, clinicInfoDoc, reviewsDoc] = await Promise.all([
      db.collection('knowledge_base').doc('promotions').get(),
      db.collection('knowledge_base').doc('products').get(),
      db.collection('knowledge_base').doc('faqs').get(),
      db.collection('knowledge_base').doc('clinic_info').get(),
      db.collection('knowledge_base').doc('reviews').get()
    ]);

    const knowledgeBase = {
      promotionsInfo: promotionsDoc.exists ? promotionsDoc.data().content : 'No promotions found.',
      pricingInfo: pricingDoc.exists ? pricingDoc.data().content : 'No pricing found.',
      faqsInfo: faqsDoc.exists ? faqsDoc.data().content : 'No FAQs found.',
      clinicInfo: clinicInfoDoc.exists ? clinicInfoDoc.data().content : 'No clinic info found.',
      reviewsInfo: reviewsDoc.exists ? reviewsDoc.data().content : []
    };

    setCache(cacheKey, knowledgeBase);
    console.log('🚀 [Performance] 지식 베이스 조회 및 캐싱 완료 (policy_context 제외)');
    
    // 디버깅: 가격 정보 로깅
    console.log('📊 [DEBUG] Knowledge Base 내용 확인:');
    console.log('  - promotionsInfo 타입:', typeof knowledgeBase.promotionsInfo, '길이:', JSON.stringify(knowledgeBase.promotionsInfo).length);
    console.log('  - pricingInfo 타입:', typeof knowledgeBase.pricingInfo, '길이:', JSON.stringify(knowledgeBase.pricingInfo).length);
    console.log('  - pricingInfo 샘플:', JSON.stringify(knowledgeBase.pricingInfo).substring(0, 200) + '...');
    
    return knowledgeBase;
  } catch (error) {
    console.error('❌ [Performance] 지식 베이스 조회 실패:', error);
    return {
      promotionsInfo: [],
      pricingInfo: [],
      faqsInfo: [],
      clinicInfo: [],
      reviewsInfo: []
    };
  }
}

module.exports = {
  extractJsonFromText,
  createSafeMessageData,
  handleError,
  safeFirestoreOperation,
  getFromCache,
  setCache,
  getCache,
  getKnowledgeBase
};

/**
 * 통합된 Policy Context를 Firestore에서 조회 (캐싱 포함)
 * @returns {Promise<string>} - 정책 텍스트(없으면 기본값)
 */
async function getPolicyContext() {
  const cacheKey = 'policy_context';
  const cached = getFromCache(cacheKey);
  
  if (cached) {
    console.log(`🔄 [Policy Cache] Policy Context 캐시에서 로드`);
    return cached;
  }

  try {
    console.log(`🔍 [Policy Load] Policy Context 로딩 시작`);
    
    const policyDoc = await db.collection('knowledge_base').doc('policy_context').get();
    
    let finalPolicyText = '';
    
    if (policyDoc.exists) {
      finalPolicyText = policyDoc.data().content || '';
      console.log(`✅ [Policy] Policy Context 로드 (${finalPolicyText.length}자)`);
    }
    
    // 기본값 처리
    if (!finalPolicyText.trim()) {
      finalPolicyText = getDefaultPolicyContext();
      console.log(`⚠️ [Policy Default] 기본 Policy Context 사용`);
    }
    
    // 캐싱 (5분)
    setCache(cacheKey, finalPolicyText, 300);
    
    console.log(`🎯 [Policy Complete] Policy Context 로딩 완료 (총 ${finalPolicyText.length}자)`);
    
    return finalPolicyText;
    
  } catch (error) {
    console.error('❌ [Policy] Policy Context 조회 실패:', error);
    
    // 에러 발생 시 기본 Policy Context 반환
    const defaultPolicy = getDefaultPolicyContext();
    console.log(`🔄 [Policy Error Recovery] 기본 Policy Context 사용`);
    return defaultPolicy;
  }
}

/**
 * 최소 fallback Policy Context (Firebase 조회 실패 시에만 사용)
 * @returns {string} - 기본 정책 텍스트
 */
function getDefaultPolicyContext() {
  return `
# CareConnect AI 긴급 fallback 정책
- 사용자 언어와 동일한 언어로 응답 (다국어 지원)
- 250글자 이내 완전한 문장으로 응답
- 정확하고 안전한 의료/미용 정보 제공
- 3회+ 대화 시 예약 유도 허용
- "개인차가 있을 수 있습니다" 필수 언급

⚠️ 이 정책은 Firebase 조회 실패 시에만 사용됩니다.
정상적인 경우 Firebase에서 완전한 정책을 로드합니다.
`;
}

module.exports.getPolicyContext = getPolicyContext;

// ===============================
// 🔎 RAG 검색 + 세션 헬퍼 (신규)
// ===============================

/**
 * 의미론적 검색으로 지식베이스에서 가장 관련성 높은 정보 반환
 * @param {string} query - 검색 쿼리
 * @param {Object} knowledgeBase - {promotionsInfo, pricingInfo, faqsInfo, clinicInfo, reviewsInfo}
 * @returns {Promise<string|null>} - 찾은 정보 또는 null
 */
async function semanticSearchKnowledgeBase(query, knowledgeBase) {
  try {
    console.log('🔍 [Semantic Search] 의미론적 검색 시작:', query);
    
    // Embeddings 서비스 초기화 시도
    let embeddingService;
    try {
      embeddingService = getEmbeddingService();
    } catch (error) {
      console.log('⚠️ [Fallback] Embeddings 서비스 초기화 실패, 키워드 검색으로 전환');
      return searchKnowledgeBase(query, knowledgeBase);
    }
    
    // 1. 질문을 벡터로 변환
    const queryEmbedding = await embeddingService.getEmbedding(query);
    if (!queryEmbedding) {
      console.log('⚠️ [Fallback] 쿼리 임베딩 실패, 키워드 검색으로 전환');
      return searchKnowledgeBase(query, knowledgeBase);
    }

    // 2. 지식베이스 필드들을 텍스트로 준비
    const fields = [
      { name: 'promotions', data: knowledgeBase?.promotionsInfo || [] },
      { name: 'pricing', data: knowledgeBase?.pricingInfo || [] },
      { name: 'faqs', data: knowledgeBase?.faqsInfo || [] },
      { name: 'clinic', data: knowledgeBase?.clinicInfo || [] },
      { name: 'reviews', data: knowledgeBase?.reviewsInfo || [] }
    ];

    let bestMatch = { score: 0, content: '', source: '' };
    
    // 3. 각 필드와의 유사도 계산
    for (const field of fields) {
      const textContent = typeof field.data === 'string' ? field.data : JSON.stringify(field.data);
      
      if (textContent.trim().length === 0) continue;
      
      // 각 필드의 임베딩과 유사도 계산
      const fieldEmbedding = await embeddingService.getEmbedding(textContent);
      if (fieldEmbedding) {
        const similarity = embeddingService.calculateCosineSimilarity(queryEmbedding, fieldEmbedding);
        
        console.log(`  📊 [${field.name}] 유사도: ${embeddingService.similarityToPercentage(similarity)}`);
        
        if (similarity > bestMatch.score) {
          bestMatch = { 
            score: similarity, 
            content: textContent,
            source: field.name
          };
        }
      }
      
      // API 제한 방지 딜레이 제거로 응답 속도 개선
      // await embeddingService.delay(50);
    }

    // 4. 임계값 이상의 결과만 반환
    const threshold = 0.7;
    if (bestMatch.score > threshold) {
      console.log(`✅ [Semantic Search] 최고 유사도: ${embeddingService.similarityToPercentage(bestMatch.score)} (${bestMatch.source})`);
      return _summarize(bestMatch.content, 800);
    } else {
      console.log(`⚠️ [Fallback] 유사도 낮음 (${embeddingService.similarityToPercentage(bestMatch.score)}), 키워드 검색 사용`);
      return searchKnowledgeBase(query, knowledgeBase);
    }

  } catch (error) {
    console.error('❌ [Semantic Search] 오류:', error);
    console.log('⚠️ [Fallback] 에러 발생, 키워드 검색 사용');
    return searchKnowledgeBase(query, knowledgeBase);
  }
}

/**
 * 지식베이스에서 간단한 키워드 기반 검색으로 스니펫을 반환 (Fallback 함수)
 * @param {string} query
 * @param {Object} knowledgeBase - {promotionsInfo, pricingInfo, faqsInfo, clinicInfo, reviewsInfo}
 * @returns {string|null}
 */
function searchKnowledgeBase(query, knowledgeBase) {
  try {
    const q = (query || '').toLowerCase();
    if (!q) return null;
    
    // 각 필드를 문자열로 정규화 (이중 JSON.stringify 방지)
    const fields = [
      knowledgeBase?.promotionsInfo || [],
      knowledgeBase?.pricingInfo || [],
      knowledgeBase?.faqsInfo || [],
      knowledgeBase?.clinicInfo || [],
      knowledgeBase?.reviewsInfo || []
    ].map(v => {
      // 이미 문자열이면 그대로, 배열/객체면 JSON.stringify
      if (typeof v === 'string') return v;
      return JSON.stringify(v || []);
    });
    
    let best = { score: 0, text: '' };
    for (const text of fields) {
      const { score } = _keywordScore(q, text.toLowerCase());
      if (score > best.score) best = { score, text };
    }
    if (best.score === 0) return null;
    
    // 디버깅: 검색 결과 로깅
    console.log('🔍 [DEBUG] Knowledge Base 검색 결과:');
    console.log('  - 검색어:', q);
    console.log('  - 최고 점수:', best.score);
    console.log('  - 검색 결과 샘플:', best.text.substring(0, 300) + '...');
    
    return _summarize(best.text, 600);
  } catch (error) { 
    console.warn('⚠️ [KB Search] 검색 실패:', error.message);
    return null; 
  }
}

function _keywordScore(q, doc) {
  const tokens = Array.from(new Set(q.split(/\s+/).filter(Boolean)));
  let score = 0;
  for (const t of tokens) {
    const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = doc.match(re);
    if (matches) score += matches.length;
  }
  
  // 가격 관련 검색 시 pricing 데이터에 보너스 점수 부여
  if ((q.includes('가격') || q.includes('price')) && doc.includes('price_krw')) {
    score += 10; // 가격 데이터에 보너스 점수
  }
  
  // 동적 시술명 매칭 - 실제 데이터에서 시술명 추출하여 보너스 점수 부여
  if (doc.includes('price_krw') || doc.includes('"name"')) {
    // 가격 정보가 있는 데이터에서 시술명 추출 시도
    try {
      const jsonMatch = doc.match(/\[.*\]/);
      if (jsonMatch) {
        const items = JSON.parse(jsonMatch[0]);
        for (const item of items) {
          if (item.name) {
            // 시술명에서 주요 키워드 추출 (괄호 안 내용 제외)
            const procedureName = item.name.replace(/\s*\([^)]*\)/g, '').trim();
            const keywords = procedureName.split(/\s+/);
            
            // 검색어와 시술명 키워드 매칭
            for (const keyword of keywords) {
              if (keyword.length > 1 && q.includes(keyword)) {
                score += 8; // 실제 시술명 매칭 시 높은 보너스
                console.log(`🎯 [검색 보너스] "${keyword}" 매칭으로 +8점`);
              }
            }
          }
        }
      }
    } catch (e) {
      // JSON 파싱 실패 시 기본 키워드 매칭
      const commonProcedures = ['슈링크', '인모드', '보톡스', '필러', '리프팅', '레이저', '필링', '마사지', '케어'];
      for (const proc of commonProcedures) {
        if (q.includes(proc) && doc.includes(proc)) {
          score += 5; // 기본 시술명 매칭 보너스
        }
      }
    }
  }
  
  return { score };
}

function _summarize(text, maxLen) {
  let s = typeof text === 'string' ? text : JSON.stringify(text || '');
  
  // 모든 시술의 가격 데이터 포맷팅 (동적 처리)
  s = s.replace(/"price_krw":"(\d+)"/g, (match, price) => {
    // 모든 숫자 가격을 천 단위 콤마와 원 단위로 포맷팅
    const formatted = parseInt(price).toLocaleString('ko-KR') + '원';
    return `"price_krw":"${formatted}"`;
  });
  
  // 추가적으로 이미 원 단위가 붙어있지 않은 숫자들도 처리
  s = s.replace(/(\d{4,})/g, (match, number) => {
    // 4자리 이상 숫자를 천 단위 콤마로 포맷팅 (단, 이미 처리된 것은 제외)
    if (!match.includes(',') && !s.includes(match + '원')) {
      return parseInt(number).toLocaleString('ko-KR');
    }
    return match;
  });
  
  return s.length <= maxLen ? s : s.slice(0, maxLen) + '...';
}

/**
 * 세션 조회 (sessions/{userId})
 * @param {string} userId
 */
async function getSession(userId) {
  try {
    const doc = await db.collection('sessions').doc(userId).get();
    return doc.exists ? doc.data() : null;
  } catch (e) {
    console.warn('⚠️ [Session] 세션 조회 실패:', e?.message || e);
    return null;
  }
}

/**
 * 세션 부분 업데이트 (merge) - 상태 기반 대화 관리
 * @param {string} userId
 * @param {Object} partial
 */
async function upsertSession(userId, partial) {
  try {
    // 현재 세션 데이터 가져오기
    const currentSession = await getSession(userId);
    const now = new Date();
    
    // 대화 횟수 및 상태 추적 로직
    let conversationCount = currentSession?.conversationCount || 0;
    let conversationState = currentSession?.conversationState || 'NORMAL';
    let lastMessageTime = currentSession?.lastMessageTime ? new Date(currentSession.lastMessageTime) : null;
    
    // 10분 이내 대화면 카운트 증가, 아니면 리셋
    if (lastMessageTime && (now - lastMessageTime) < 10 * 60 * 1000) {
      conversationCount += 1;
    } else {
      conversationCount = 1; // 새로운 대화 세션 시작
      conversationState = 'NORMAL'; // 상태도 리셋
    }
    
    // 3회 이상 대화 시 상담 유도 상태로 전환
    if (conversationCount >= 3 && conversationState === 'NORMAL') {
      conversationState = 'CONSULTATION_READY';
      console.log(`🎯 [Session] 상담 유도 상태로 전환 (${conversationCount}회 대화 후)`);
    }
    
    // partial에서 conversationCount, conversationState, lastMessageTime 제거 (계산된 값 보호)
    const { conversationCount: _, conversationState: __, lastMessageTime: ___, ...safePartial } = partial;
    
    await db.collection('sessions').doc(userId).set({
      userId,
      lastUpdatedAt: now,
      conversationCount,
      conversationState,
      lastMessageTime: now,
      ...safePartial
    }, { merge: true });
    
    console.log(`📊 [Session] 대화 ${conversationCount}회, 상태: ${conversationState} (userId: ${userId})`);
    return { conversationCount, conversationState };
  } catch (e) {
    console.warn('⚠️ [Session] 세션 업데이트 실패:', e?.message || e);
    return { conversationCount: 1, conversationState: 'NORMAL' };
  }
}

/**
 * 세션의 bookingState 병합 업데이트
 * @param {string} userId
 * @param {Object} bookingPartial
 */
async function updateSessionBookingState(userId, bookingPartial) {
  try {
    const current = await getSession(userId);
    const merged = { ...(current?.bookingState || {}), ...bookingPartial };
    await upsertSession(userId, { bookingState: merged });
    return merged;
  } catch (e) {
    console.warn('⚠️ [Session] bookingState 업데이트 실패:', e?.message || e);
    return null;
  }
}

module.exports.searchKnowledgeBase = searchKnowledgeBase;
module.exports.semanticSearchKnowledgeBase = semanticSearchKnowledgeBase;
module.exports.getSession = getSession;
module.exports.upsertSession = upsertSession;
module.exports.updateSessionBookingState = updateSessionBookingState;

/**
 * Firestore에서 대화 기록을 조회하여 Gemini API 형식에 맞게 변환
 * @param {string} userId - 사용자 ID
 * @param {number} limit - 가져올 최근 대화 개수
 * @returns {Promise<Array>} - Gemini API의 contents 배열 형식
 */
async function getConversationHistory(userId, limit = 10) {
  if (!userId) return [];
  try {
    const snapshot = await db
      .collection('conversations')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    if (snapshot.empty) return [];

    // 관리자 메시지는 히스토리에서 제외하여 언어/맥락을 오염시키지 않음
    const history = snapshot.docs
      .map(doc => doc.data())
      .reverse()
      .filter(msg => msg.sender !== 'manager');

    return history.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text || '' }]
    }));
  } catch (error) {
    console.error('❌ [History] 대화 기록 조회 실패:', error);
    return [];
  }
}

module.exports.getConversationHistory = getConversationHistory;

/**
 * 텍스트에서 언어를 자동 감지
 * @param {string} text - 감지할 텍스트
 * @returns {string} - 언어 코드 (ko, en, th, ja, zh 등)
 */
function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'ko';
  
  const trimmedText = text.trim().toLowerCase();
  
  // 한국어 감지 (한글 유니코드 범위)
  const koreanPattern = /[\u3131-\u314e\u314f-\u3163\uac00-\ud7a3]/;
  if (koreanPattern.test(text)) return 'ko';
  
  // 태국어 감지 (태국어 유니코드 범위)
  const thaiPattern = /[\u0e00-\u0e7f]/;
  if (thaiPattern.test(text)) return 'th';
  
  // 태국어 특징적 단어 감지 (유니코드 범위 외에도)
  const thaiWords = [
    'สวัสดี', 'ขอบคุณ', 'ขอโทษ', 'ใช่', 'ไม่', 'อะไร', 'อย่างไร', 'เมื่อไหร่', 'ที่ไหน', 'ทำไม',
    'โบท็อกซ์', 'ผิว', 'สวย', 'รักษา', 'หมอ', 'โรงพยาบาล', 'นัดหมาย', 'ราคา', 'ผลลัพธ์', 'ปลอดภัย',
    'ค่ะ', 'ครับ', 'นะคะ', 'นะครับ', 'ครับ', 'ค่ะ', 'ครับ', 'ค่ะ', 'ครับ', 'ค่ะ'
  ];
  if (thaiWords.some(word => trimmedText.includes(word))) return 'th';
  
  // 일본어 감지 (히라가나, 가타카나, 한자)
  const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/;
  if (japanesePattern.test(text)) return 'ja';
  
  // 중국어 감지 (중국어 한자)
  const chinesePattern = /[\u4e00-\u9fff]/;
  if (chinesePattern.test(text)) return 'zh';
  
  // 베트남어 감지 (베트남어 특수 문자)
  const vietnamesePattern = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/;
  if (vietnamesePattern.test(trimmedText)) return 'vi';
  
  // 아랍어 감지 (아랍어 유니코드 범위)
  const arabicPattern = /[\u0600-\u06ff]/;
  if (arabicPattern.test(text)) return 'ar';
  
  // 힌디어 감지 (데바나가리 문자)
  const hindiPattern = /[\u0900-\u097f]/;
  if (hindiPattern.test(text)) return 'hi';
  
  // 러시아어 감지 (키릴 문자)
  const russianPattern = /[\u0400-\u04ff]/;
  if (russianPattern.test(text)) return 'ru';
  
  // 스페인어/포르투갈어 특징적 단어 감지
  const spanishWords = ['hola', 'como', 'que', 'por', 'para', 'con', 'una', 'está', 'muy', 'gracias', 'donde', 'cuando'];
  const portugueseWords = ['olá', 'como', 'que', 'para', 'com', 'uma', 'está', 'muito', 'obrigado', 'onde', 'quando'];
  const frenchWords = ['bonjour', 'comment', 'que', 'pour', 'avec', 'une', 'est', 'très', 'merci', 'où', 'quand'];
  const germanWords = ['hallo', 'wie', 'was', 'für', 'mit', 'eine', 'ist', 'sehr', 'danke', 'wo', 'wann'];
  
  if (spanishWords.some(word => trimmedText.includes(word))) return 'es';
  if (portugueseWords.some(word => trimmedText.includes(word))) return 'pt';
  if (frenchWords.some(word => trimmedText.includes(word))) return 'fr';
  if (germanWords.some(word => trimmedText.includes(word))) return 'de';
  
  // 인도네시아어/말레이어 감지 (공통 단어들)
  const malayIndonesianWords = ['apa', 'bagaimana', 'dimana', 'kapan', 'mengapa', 'dengan', 'untuk', 'dari', 'yang', 'adalah'];
  if (malayIndonesianWords.some(word => trimmedText.includes(word))) {
    // 세부적으로 구분하기 어려우므로 인도네시아어로 기본 설정
    return 'id';
  }
  
  // 말레이어 감지 (일부 대표 단어)
  const malayWords = ['apa khabar', 'bagaimana', 'di mana', 'bila', 'mengapa', 'dengan', 'untuk', 'daripada', 'yang', 'ialah', 'sila', 'terima kasih'];
  if (malayWords.some(word => trimmedText.includes(word))) return 'ms';
  
  // 영어 기본값 (라틴 문자 기반)
  return 'en';
}

/**
 * 언어별 기본 인사말 및 응답 패턴
 * @param {string} language - 언어 코드
 * @returns {Object} - 언어별 기본 응답 패턴
 */
function getLanguagePatterns(language) {
  const patterns = {
    ko: {
      greeting: '안녕하세요! 저는 케어커넥트 AI입니다. 궁금한 것이 있으시면 언제든 말씀해 주세요.',
      bookingConfirmed: '{name}님의 예약이 완료되었습니다! 📅\n예약 시간: {time}\n곧 확인 연락을 드리겠습니다.',
      needInfo: '예약을 확정하시려면 성함과 연락처를 모두 알려주세요.',
      unavailable: '죄송합니다. 현재 시스템에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.'
    },
    en: {
      greeting: 'Hello! I\'m CareConnect AI. Please feel free to ask me anything you\'d like to know.',
      bookingConfirmed: '{name}, your appointment has been confirmed! 📅\nAppointment time: {time}\nWe will contact you shortly for confirmation.',
      needInfo: 'To confirm your appointment, please provide both your name and contact number.',
      unavailable: 'Sorry, there\'s a temporary system issue. Please try again in a moment.'
    },
    th: {
      greeting: 'สวัสดีค่ะ! ฉันคือ CareConnect AI กรุณาถามสิ่งที่คุณต้องการทราบได้เลยค่ะ',
      bookingConfirmed: 'คุณ{name} การจองของคุณเสร็จสมบูรณ์แล้วค่ะ! 📅\nเวลานัดหมาย: {time}\nเราจะติดต่อกลับเพื่อยืนยันค่ะ',
      needInfo: 'เพื่อยืนยันการจอง กรุณาแจ้งชื่อและหมายเลขโทรศัพท์ค่ะ',
      unavailable: 'ขออภัยค่ะ ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้งค่ะ',
      // 추가 태국어 응답 패턴
      botoxInfo: 'โบท็อกซ์เป็นวิธีรักษาที่ใช้สารพิษจากแบคทีเรียเพื่อผ่อนคลายกล้ามเนื้อและลดริ้วรอยค่ะ',
      skinCare: 'การดูแลผิวเป็นสิ่งสำคัญสำหรับสุขภาพผิวที่ดีค่ะ',
      appointment: 'การนัดหมายสามารถทำได้ผ่านระบบของเราค่ะ',
      consultation: 'การให้คำปรึกษาเป็นบริการฟรีของเราค่ะ',
      price: 'ราคาขึ้นอยู่กับประเภทของการรักษาค่ะ',
      effect: 'ผลลัพธ์จะแตกต่างกันไปตามแต่ละบุคคลค่ะ',
      duration: 'ระยะเวลาการรักษาแตกต่างกันไปตามประเภทค่ะ',
      safety: 'การรักษาทั้งหมดมีความปลอดภัยและผ่านการรับรองค่ะ',
      preparation: 'การเตรียมตัวก่อนการรักษาไม่ซับซ้อนค่ะ',
      aftercare: 'การดูแลหลังการรักษาเป็นสิ่งสำคัญค่ะ'
    },
    ja: {
      greeting: 'こんにちは！私はCareConnect AIです。何でもお気軽にお聞きください。',
      bookingConfirmed: '{name}様のご予約が完了いたしました！📅\nご予約時間: {time}\n確認のご連絡を差し上げます。',
      needInfo: 'ご予約を確定するために、お名前と連絡先をお教えください。',
      unavailable: '申し訳ございません。システムに一時的な問題が発生しています。しばらくしてからお試しください。'
    },
    zh: {
      greeting: '您好！我是CareConnect AI。有任何问题请随时询问。',
      bookingConfirmed: '{name}，您的预约已确认！📅\n预约时间: {time}\n我们将很快联系您确认。',
      needInfo: '为确认您的预约，请提供您的姓名和联系电话。',
      unavailable: '抱歉，系统暂时出现问题。请稍后再试。'
    },
    vi: {
      greeting: 'Xin chào! Tôi là CareConnect AI. Vui lòng hỏi bất cứ điều gì bạn muốn biết.',
      bookingConfirmed: '{name}, lịch hẹn của bạn đã được xác nhận! 📅\nThời gian hẹn: {time}\nChúng tôi sẽ liên hệ với bạn sớm.',
      needInfo: 'Để xác nhận lịch hẹn, vui lòng cung cấp tên và số điện thoại của bạn.',
      unavailable: 'Xin lỗi, hệ thống đang gặp sự cố tạm thời. Vui lòng thử lại sau.'
    },
    es: {
      greeting: '¡Hola! Soy CareConnect AI. Por favor, siéntete libre de preguntarme lo que quieras saber.',
      bookingConfirmed: '{name}, ¡tu cita ha sido confirmada! 📅\nHora de la cita: {time}\nTe contactaremos pronto para confirmación.',
      needInfo: 'Para confirmar tu cita, por favor proporciona tu nombre y número de contacto.',
      unavailable: 'Lo siento, hay un problema temporal del sistema. Por favor, inténtalo de nuevo en un momento.'
    },
    pt: {
      greeting: 'Olá! Eu sou o CareConnect AI. Sinta-se à vontade para me perguntar qualquer coisa.',
      bookingConfirmed: '{name}, sua consulta foi confirmada! 📅\nHorário da consulta: {time}\nEntraremos em contato em breve.',
      needInfo: 'Para confirmar sua consulta, por favor forneça seu nome e número de contato.',
      unavailable: 'Desculpe, há um problema temporário no sistema. Tente novamente em um momento.'
    },
    fr: {
      greeting: 'Bonjour! Je suis CareConnect AI. N\'hésitez pas à me poser toute question.',
      bookingConfirmed: '{name}, votre rendez-vous a été confirmé! 📅\nHeure du rendez-vous: {time}\nNous vous contacterons bientôt.',
      needInfo: 'Pour confirmer votre rendez-vous, veuillez fournir votre nom et numéro de contact.',
      unavailable: 'Désolé, il y a un problème temporaire du système. Veuillez réessayer dans un moment.'
    },
    de: {
      greeting: 'Hallo! Ich bin CareConnect AI. Fragen Sie mich gerne alles, was Sie wissen möchten.',
      bookingConfirmed: '{name}, Ihr Termin wurde bestätigt! 📅\nTerminzeit: {time}\nWir werden Sie bald kontaktieren.',
      needInfo: 'Um Ihren Termin zu bestätigen, geben Sie bitte Ihren Namen und Kontakt an.',
      unavailable: 'Entschuldigung, es gibt ein vorübergehendes Systemproblem. Versuchen Sie es in einem Moment erneut.'
    },
    ms: {
      greeting: 'Hai! Saya CareConnect AI. Sila tanya apa sahaja yang ingin anda ketahui.',
      bookingConfirmed: '{name}, janji temu anda telah disahkan! 📅\nMasa janji temu: {time}\nKami akan menghubungi anda tidak lama lagi.',
      needInfo: 'Untuk mengesahkan janji temu, sila berikan nama dan nombor telefon anda.',
      unavailable: 'Maaf, terdapat masalah sistem sementara. Sila cuba lagi sebentar lagi.'
    }
  };
  
  return patterns[language] || patterns['en'];
}

module.exports.detectLanguage = detectLanguage;
module.exports.getLanguagePatterns = getLanguagePatterns;