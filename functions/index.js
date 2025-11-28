const { https } = require("firebase-functions/v2");
const { admin, db } = require('./config');
const { createSafeMessageData, handleError, safeFirestoreOperation, getFromCache, setCache } = require('./utils');
const { sendChannelTalkMessage } = require('./channeltalk');
const { getAiDecision, getFinalResponse } = require('./ai');
const { startBookingProcess, requestHumanAgent, createFinalBooking } = require('./tools');
// const { updateKnowledgeBase2025 } = require('./update-knowledge-base-2025'); // 파일이 존재하지 않음

// 첨부 파일/이미지 감지 함수
function extractAttachmentInfo(entity) {
  const blocks = Array.isArray(entity?.blocks) ? entity.blocks : [];
  const hasImageBlock = blocks.some(b =>
    ['image', 'image_link'].includes(b?.type) ||
    (b?.file?.mime || '').startsWith('image/')
  );
  const hasFileBlock = blocks.some(b =>
    ['file', 'video', 'audio'].includes(b?.type) ||
    (b?.file && !String(b.file.mime || '').startsWith('image/'))
  );
  const hasFromLegacy = Array.isArray(entity?.files) || Array.isArray(entity?.attachments);
  return {
    hasImage: hasImageBlock,
    hasFile: hasFileBlock || hasFromLegacy,
    hasAny: hasImageBlock || hasFileBlock || hasFromLegacy
  };
}

// ===============================
// 🌐 메인 웹훅 핸들러 (Think -> Act -> Respond)
// ===============================

exports.channelTalkWebhook = https.onRequest({ region: "asia-northeast3" }, async (req, res) => {
  try {
    console.log('📨 [Webhook] 요청 수신됨');
    const messageEntity = req.body?.entity;
    const refers = req.body?.refers;

    if (!messageEntity || !refers || !refers.userChat) {
      console.log('필수 데이터(entity, refers.userChat) 누락');
        return res.status(200).send('ignored: missing data');
    }

    const personType = messageEntity.personType;
    const text = messageEntity.plainText || '';
    const messageId = messageEntity.id;
    const userId = refers.userChat.userId;
    const userChatId = refers.userChat.id;
    const chatKey = refers.userChat.contactKey || '';
    
    // 첨부 파일/이미지 감지
    const attachmentInfo = extractAttachmentInfo(messageEntity);
    console.log(`📎 [Attachment] 감지 결과:`, attachmentInfo);
    
    // 강제 언어 감지: ChannelTalk의 language 필드가 없거나 부정확할 수 있으므로 직접 감지
    const { detectLanguage } = require('./utils');
    const language = detectLanguage(text);
    console.log(`🌐 [Webhook] 감지된 언어: ${language}`);

    if (messageEntity.log) {
      console.log(`🚫 시스템 메시지 생략 (messageId=${messageId})`);
      return res.status(200).send('ignored');
    }
    
    // 텍스트가 비어있고 첨부도 없으면 무시
    if (!text.trim() && !attachmentInfo.hasAny) {
      console.log(`🚫 빈 메시지 및 첨부 없음 생략 (messageId=${messageId})`);
      return res.status(200).send('ignored');
    }
    
    // 첨부 파일/이미지 수신 시 HUMAN_MODE로 전환
    if (attachmentInfo.hasAny) {
      console.log(`📎 [Attachment] 첨부 파일/이미지 수신 감지, HUMAN_MODE로 전환`);
      
      // 세션을 HUMAN_MODE로 전환
      await db.collection('sessions').doc(userId).set({ 
        mode: 'HUMAN_MODE', 
        lastUpdatedAt: new Date(), 
        userId, 
        userChatId,
        attachmentReceived: true,
        attachmentType: attachmentInfo.hasImage ? 'image' : 'file'
      }, { merge: true });
      
      // 친근한 안내 메시지 전송
      const attachmentMessage = attachmentInfo.hasImage 
        ? '사진 잘 받았어요! 의사가 확인한 뒤 낮 시간에 자세히 안내드릴게요.'
        : '파일 잘 받았어요! 의사가 확인한 뒤 낮 시간에 자세히 안내드릴게요.';
      
      await sendChannelTalkMessage(userChatId, attachmentMessage, userId);
      
      // 대화 기록에 첨부 수신 사실 저장
      await safeFirestoreOperation(async () => {
        await db.collection('conversations').add(createSafeMessageData({
          userId,
          userChatId,
          chatKey,
          sender: 'user',
          text: `[${attachmentInfo.hasImage ? '이미지' : '파일'} 첨부 수신]`,
          timestamp: admin.firestore.Timestamp.now()
        }));
      }, 'attachment_conversation_save');
      
      // 봇 응답 메시지도 저장
      await safeFirestoreOperation(async () => {
        await db.collection('conversations').add(createSafeMessageData({
          userId,
          userChatId,
          chatKey,
          sender: 'bot',
          text: attachmentMessage,
          timestamp: admin.firestore.Timestamp.now()
        }));
      }, 'attachment_bot_response_save');
      
      console.log(`✅ [Attachment] HUMAN_MODE 전환 및 안내 메시지 전송 완료`);
      return res.status(200).send('attachment_handled');
    }

    // 1) Anti-echo: 메시지 ID 캐시
    const processedKey = `processed_${messageId}`;
    if (getFromCache(processedKey)) {
      console.log(`🔄 이미 처리된 메시지 생략 (messageId=${messageId})`);
      return res.status(200).send('already_processed');
    }
    setCache(processedKey, true, 600);

    // 2) Anti-echo: bot self-message ignore (Channel.io personType)
    if (personType === 'bot') {
      console.log('🤖 봇 메시지 무시 (personType=bot)');
      return res.status(200).send('bot_message_ignored');
    }

    // 3) Anti-echo: externalMessageId 확인 (강화)
    if (messageEntity.externalMessageId) {
      const extId = messageEntity.externalMessageId;
      // 우리가 방금 보낸 아웃바운드 메시지 ID를 60초 동안 기억하고 있으므로, 일치 시 에코로 판단
      if (getFromCache(`outbound_${extId}`)) {
        console.log('🔒 [Anti-Echo] outbound ID 캐시 일치로 차단:', extId);
        return res.status(200).send('outbound_echo_ignored');
      }
      // 기존 processed_ 캐시(백워드 호환)
      if (getFromCache(`processed_${extId}`)) {
        console.log('🔒 [Anti-Echo] processed 캐시 일치로 차단:', extId);
      return res.status(200).send('outbound_echo_ignored');
    }
    }
      try {
        const outDoc = await db.collection('outboundMessages').doc(messageId).get();
        if (outDoc.exists) {
        console.log('🔒 Outbound DB 차단: 동일 messageId 존재');
          return res.status(200).send('outbound_db_ignored');
        }
      } catch (e) {
      console.warn('⚠️ outboundMessages 조회 경고:', e?.message || e);
    }

    // 대화 저장 (inbound) - 발신자 구분 저장
    const inboundSender = (personType === 'manager') ? 'manager' : 'user';
    await safeFirestoreOperation(async () => {
      await db.collection('conversations').add(createSafeMessageData({
        userId,
        userChatId,
        chatKey,
        sender: inboundSender,
        text,
        timestamp: admin.firestore.Timestamp.now()
      }));
    }, 'conversation_save');

    // 세션 모드 확인 (sessions 컬렉션 우선)
    let mode = 'AI_MODE';
    let sessionData = null;
    try {
      const sess = await db.collection('sessions').doc(userId).get();
      if (sess.exists) {
        sessionData = sess.data();
        if (sessionData.mode) mode = sessionData.mode;
      }
    } catch (_) { /* ignore */ }

    const currentIntentState = sessionData?.intentState || 'IDLE';

    // manager의 수동 복귀 명령 처리 ('//')
    if (personType === 'manager' && text.trim() === '//') {
      await db.collection('sessions').doc(userId).set({ mode: 'AI_MODE', lastUpdatedAt: new Date(), userId, userChatId }, { merge: true });
      console.log(`🔁 세션 모드 AI_MODE로 전환 (userId=${userId})`);
      return res.status(200).send('ai_mode_activated');
    }

    // 매니저가 개입하면 HUMAN_MODE로 즉시 전환하고 AI 응답 중단
    if (personType === 'manager') {
      await db.collection('sessions').doc(userId).set({ mode: 'HUMAN_MODE', lastUpdatedAt: new Date(), userId, userChatId }, { merge: true });
      console.log(`🎭 HUMAN_MODE 활성화 (manager intervened) userId=${userId}`);
      return res.status(200).send('human_mode_activated');
    }

    // HUMAN_MODE면 타임아웃 확인 후 중단
    if (mode === 'HUMAN_MODE') {
      const last = sessionData?.lastUpdatedAt ? new Date(sessionData.lastUpdatedAt.toDate ? sessionData.lastUpdatedAt.toDate() : sessionData.lastUpdatedAt) : null;
      const now = new Date();
      const timedOut = last ? (now - last) > 30 * 60 * 1000 : false;
      if (timedOut) {
        await db.collection('sessions').doc(userId).set({ mode: 'AI_MODE', lastUpdatedAt: new Date() }, { merge: true });
        await sendChannelTalkMessage(userChatId, '상담원이 일정 시간 응답하지 않아 AI 모드로 전환되었습니다. 계속 원하시는 내용을 말씀해 주세요.', userId);
        return res.status(200).send('human_mode_timeout_recovered');
      }
      // HUMAN_MODE 유지 중 활동 시간 갱신
      await db.collection('sessions').doc(userId).set({ lastUpdatedAt: new Date() }, { merge: true });
      console.log(`👤 HUMAN_MODE 활성. AI 처리 중단 (userId=${userId})`);
      return res.status(200).send('human_mode_active');
    }

    // 세션 업데이트 (대화 횟수 및 상태 추적)
    const { upsertSession } = require('./utils');
    const sessionUpdate = await upsertSession(userId, {}); // 대화 횟수 및 상태 업데이트
    
    // Think: 의사결정 + RAG
    const decision = await getAiDecision({ userInput: text, sessionId: userId, language, intentState: currentIntentState });
    console.log('🧠 AI Decision:', decision);

    // Act: Execute tools based on AI decision
    let toolResult = null;
    const functionName = decision?.function || decision?.functionName;
    if (decision?.action === 'CALL_FUNCTION' && functionName) {
      const args = { ...(decision.parameters || decision.args || {}), userId, userChatId };
      switch (functionName) {
        case 'startBookingProcess':
          console.log('🔧 [Tool] startBookingProcess 함수 실행 시작');
          toolResult = await startBookingProcess(args);
          // If booking slot is available, move to AWAITING_INFO state
          if (toolResult.success && toolResult.action === 'time_slot_available') {
            const { updateSessionBookingState } = require('./utils');
            await updateSessionBookingState(userId, { intentState: 'AWAITING_INFO' });
            console.log(`✅ [State] AWAITING_INFO로 전환 (예약 시간 확정됨)`);
          }
          break;
        case 'requestHumanAgent':
          // TEMPORARY DISABLED: requestHumanAgent 함수가 비활성화되어 있으므로 처리하지 않음
          console.log('🚫 [Webhook] requestHumanAgent 함수 호출이 비활성화되었습니다. AI가 계속 응답합니다.');
          toolResult = await requestHumanAgent(userId, { reason: args.reason, context: args.context });
          // HUMAN_MODE로 전환하지 않음 - AI가 계속 응답
          break;
        case 'createFinalBooking':
          console.log('🔧 [Tool] createFinalBooking 함수 실행 시작');
          toolResult = await createFinalBooking(args);
          if (toolResult.success) {
             // Set cooldown in the orchestrator
             const cooldownRef = db.collection('bookingCooldown').doc(userId);
             const cooldownEnd = new Date();
             cooldownRef.set({ cooldownEnd, lastBookingAt: new Date() });
          }
          break;
      }
    }

    // Respond: Generate the final user-facing message using getFinalResponse
    const finalMessage = await getFinalResponse({ userInput: text, toolResult, language, decision, intentState: currentIntentState, sessionId: userId });

    // The orchestrator is solely responsible for sending the final message.
    if (finalMessage && finalMessage.trim()) {
      await sendChannelTalkMessage(userChatId, finalMessage, userId);
      await safeFirestoreOperation(async () => {
        await db.collection('conversations').add(createSafeMessageData({
          userId,
          userChatId,
          chatKey,
          sender: 'bot',
          text: finalMessage,
          timestamp: admin.firestore.Timestamp.now()
        }));
      }, 'final_response_save');
    }

    // The orchestrator is solely responsible for updating the state at the end.
    const nextState = decision?.nextState || currentIntentState;
    if (nextState !== currentIntentState) {
        const { updateSessionBookingState } = require('./utils');
        await updateSessionBookingState(userId, { intentState: nextState });
        console.log(`✅ [State] 세션 상태 업데이트 완료: ${currentIntentState} -> ${nextState}`);
    }

    return res.status(200).send('ok');

  } catch (error) {
    console.error('❌ [Webhook] 오류:', error);
    return res.status(500).send('server_error');
  }
});

// ===============================
// 🔧 기타 API 엔드포인트들 (유지)
// ===============================

// AI 두뇌 업데이트 HTTP 엔드포인트
exports.updateAIBrainHttp = https.onRequest({region: "asia-northeast3"}, async (req, res) => {
  try {
    // update_ai_brain_v5.js의 updateAIBrain 함수를 직접 호출
    const { updateAIBrain } = require('./update_ai_brain_v5');
    
    await updateAIBrain();
    res.status(200).json({
      success: true,
      message: 'AI 두뇌 업데이트가 성공적으로 완료되었습니다!'
    });
  } catch (error) {
    console.error('❌ AI 두뇌 업데이트 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Policy Context 업데이트 HTTP 엔드포인트
exports.updatePolicyContextHttp = https.onRequest({region: "asia-northeast3"}, async (req, res) => {
  try {
    const { updatePolicyContext } = require('./policy_context');
    
    await updatePolicyContext();
    res.status(200).json({
      success: true,
      message: 'Policy Context 업데이트가 성공적으로 완료되었습니다!'
    });
  } catch (error) {
    console.error('❌ Policy Context 업데이트 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🧪 예약 시스템 테스트 API
exports.testBookingSystem = https.onRequest({region: "asia-northeast3"}, async (req, res) => {
  try {
    console.log('�� [Test] 예약 시스템 테스트 시작');
    
    // Google Calendar 연결 테스트
    try {
      const { auth } = require('./config');
      const authClient = await auth.getClient();
      console.log('🧪 [Test] Google Calendar 인증 성공');
      
      // 예약 가능 시간 조회 테스트
      const { getAvailableSlots } = require('./calendar');
      const availableSlots = await getAvailableSlots();
      console.log('🧪 [Test] 예약 가능 시간 조회 결과:', availableSlots.length, '개');
      
      res.status(200).json({
        success: true,
        results: {
          calendarAuth: 'success',
          availableSlots: availableSlots.length,
          sampleSlots: availableSlots.slice(0, 2),
          functionCallingEnabled: true
        }
      });
    } catch (authError) {
      console.error('🧪 [Test] Google Calendar 인증 실패:', authError);
      res.status(500).json({
        success: false,
        error: 'Calendar authentication failed',
        details: authError.message
      });
    }
  } catch (error) {
    console.error('🧪 [Test] 예약 시스템 테스트 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🧪 Function Calling 테스트 API
exports.testFunctionCalling = https.onRequest({region: "asia-northeast3"}, async (req, res) => {
  try {
    console.log('🧪 [Test] Function Calling 테스트 시작');
    
    // Function Calling 관련 모듈 로드 테스트
    const { TOOL_DEFINITIONS } = require('./tools');
    
    res.json({
      success: true,
      message: 'Function Calling 시스템이 정상적으로 로드되었습니다.',
      toolsCount: TOOL_DEFINITIONS.functionDeclarations.length,
      availableFunctions: TOOL_DEFINITIONS.functionDeclarations.map(func => func.name),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('🧪 [API] Function Calling 테스트 오류:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 🛡️ 시스템 상태 모니터링 API (Refactored)
exports.systemStatus = https.onRequest({region: "asia-northeast3"}, async (req, res) => {
  try {
    console.log('📊 [Monitor] 시스템 상태 확인 시작 (v2)');
    
    const sessionsSnapshot = await db.collection('sessions').get();
    const now = new Date();
    
    const humanModeUsers = [];
    const pendingBookings = [];
    
    sessionsSnapshot.forEach(doc => {
      const data = doc.data();
      const lastActivity = data.lastUpdatedAt?.toDate ? data.lastUpdatedAt.toDate() : new Date();
      const minutesAgo = Math.floor((now - lastActivity) / 60000);

      // 1. HUMAN_MODE 사용자 집계
      if (data.mode === 'HUMAN_MODE') {
      humanModeUsers.push({
        userId: doc.id,
          lastActivity: lastActivity.toISOString(),
        minutesAgo: minutesAgo,
        needsTimeout: minutesAgo > 30
      });
      }

      // 2. 진행 중인 예약 집계 (확정되지 않은 상태)
      if (data.bookingState && data.bookingState.step !== 'confirmed') {
      pendingBookings.push({
        userId: doc.id,
          step: data.bookingState.step,
          selectedTime: data.bookingState.selectedTime || null,
          lastActivity: lastActivity.toISOString(),
        minutesAgo: minutesAgo,
        needsCleanup: minutesAgo > 30
      });
      }
    });
    
    // 예약 완료 후 쿨다운 사용자 수 확인 (이 컬렉션은 유지)
    const cooldownSnapshot = await db.collection('bookingCooldown').get();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      systemStatus: {
        humanModeUsers: {
          count: humanModeUsers.length,
          users: humanModeUsers,
          needingTimeout: humanModeUsers.filter(u => u.needsTimeout).length
        },
        pendingBookings: {
          count: pendingBookings.length,
          bookings: pendingBookings,
          needingCleanup: pendingBookings.filter(b => b.needsCleanup).length
        },
        cooldownUsersCount: cooldownSnapshot.size,
      }
    });
    
  } catch (error) {
    console.error('❌ [Monitor] 시스템 상태 확인 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 예약 조회 API
exports.getBookings = https.onRequest({region: "asia-northeast3"}, async (req, res) => {
  try {
    const { userId, limit = 10 } = req.query;
    
    let query = db.collection('bookings').orderBy('createdAt', 'desc');
    
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    
    const snapshot = await query.limit(parseInt(limit)).get();
    const bookings = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      bookings.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null
      });
    });
    
    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings: bookings
    });
    
  } catch (error) {
    console.error('❌ [API] 예약 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 리뷰 조회 API (데모용: 단일 URL 또는 제품별 필터)
exports.getReviews = https.onRequest({region: "asia-northeast3"}, async (req, res) => {
  try {
    const { productId } = req.query;
    const doc = await db.collection('knowledge_base').doc('reviews').get();
    const list = doc.exists ? (doc.data().content || []) : [];
    let results = list;
    if (productId) {
      results = list.filter(r => (r.product_id || '').toString() === productId.toString());
    }
    // 데모: 비어있으면 첫 하나만 제공하도록 폴백 (CSV에 한 개만 있을 수 있음)
    if ((!results || results.length === 0) && list.length > 0) {
      results = [list[0]];
    }
    res.status(200).json({ success: true, count: results.length, reviews: results });
  } catch (error) {
    console.error('❌ [API] 리뷰 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// 🆕 2025년 최신 시술 Knowledge Base 업데이트 API
// ===============================
exports.updateKnowledgeBase2025Http = https.onRequest({region: "asia-northeast3"}, async (req, res) => {
  try {
    console.log('🆕 [KB Update] 2025년 최신 시술 Knowledge Base 업데이트 시작');
    
    // 업데이트 실행
    const result = await updateKnowledgeBase2025();
    
    console.log('✅ [KB Update] 업데이트 완료');
    res.status(200).json({
      success: true,
      message: '2025년 최신 시술 정보가 성공적으로 업데이트되었습니다!',
      result: {
        addedProcedures: result.addedProcedures,
        updatedCollections: result.updatedCollections
      }
    });
    
  } catch (error) {
    console.error('❌ [KB Update] 업데이트 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '2025년 시술 정보 업데이트에 실패했습니다.'
    });
  }
});