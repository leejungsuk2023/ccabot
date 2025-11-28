// RAG 재사용 로컬 테스트 (외부 API/DB 호출 없이)
const path = require('path');

(async () => {
	const baseDir = path.resolve(__dirname, '../..');
	const cfgPath = path.join(baseDir, 'config.js');
	const utilsPath = path.join(baseDir, 'utils.js');
	const axiosPath = require.resolve('axios');
	const promptMgrPath = path.join(baseDir, 'promptManager.js');

	// 1) config.js 스텁 (Firebase/GCP 호출 회피)
	require.cache[cfgPath] = {
		exports: {
			admin: { firestore: { Timestamp: { now: () => new Date() } } },
			db: { collection: () => ({ doc: () => ({ get: async () => ({ exists: false, data: () => ({}) }), set: async () => {} }) }) },
			GEMINI_API_KEY: 'demo-key'
		}
	};

	// 2) utils.js 스텁 (ai.js와 promptManager.js가 사용하는 함수만 제공)
	const utilsStub = {
		// 간단 JSON 파서
		extractJsonFromText: (t) => { try { return JSON.parse(t); } catch { return null; } },
		// KB와 RAG는 고정 컨텍스트 반환
		getKnowledgeBase: async () => ({ dummy: true }),
		semanticSearchKnowledgeBase: async () => 'KBCTX',
		// 폴리시 텍스트
		getPolicyContext: async () => '# policy',
		// 이력/언어
		getConversationHistory: async () => [],
		detectLanguage: () => 'ko',
		getLanguagePatterns: () => ({ bookingConfirmed: '{name} {time}' }),
		handleError: () => 'error'
	};
	require.cache[utilsPath] = { exports: utilsStub };

	// 3) axios 스텁 (Gemini 호출 모킹)
	let scenario = 'ANSWER';
	require.cache[axiosPath] = {
		exports: {
			post: async () => ({
				data: {
					candidates: [
						{ content: { parts: [ { text: scenario === 'ANSWER' ? '{"action":"ANSWER","response":"ok"}' : '{"action":"CALL_FUNCTION","functionName":"foo"}' } ] } }
					]
				}
			})
		}
	};

	// 4) 모듈 로드 및 테스트 실행
	const ai = require(path.join(baseDir, 'ai.js'));

	// Case A: ANSWER 액션에서도 groundingContext 포함되는지 확인
	scenario = 'ANSWER';
	const decA = await ai.getAiDecision({ userInput: '보톡스', sessionId: 'u1' });
	console.log('[A] decision.groundingContext exists:', !!decA.groundingContext);
	await ai.getFinalResponse({ userInput: '보톡스', decision: decA, sessionId: 'u1' });
	console.log('[A] final response ok');

	// Case B: CALL_FUNCTION 액션이어도 groundingContext 포함되는지 확인
	scenario = 'CALL_FUNCTION';
	const decB = await ai.getAiDecision({ userInput: '보톡스', sessionId: 'u1' });
	console.log('[B] decision.action:', decB.action || decB.functionName);
	console.log('[B] decision.groundingContext exists:', !!decB.groundingContext);
	await ai.getFinalResponse({ userInput: '보톡스', decision: decB, sessionId: 'u1' });
	console.log('[B] final response ok');

	console.log('\n✅ RAG 재사용 테스트 완료');
})().catch(e => {
	console.error('❌ Test failed:', e && e.message || e);
	process.exit(1);
});
