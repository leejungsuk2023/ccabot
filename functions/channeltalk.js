const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { CHANNELTALK_ACCESS_KEY, CHANNELTALK_ACCESS_SECRET, db } = require('./config');
const { handleError, setCache } = require('./utils');

// ===============================
// 📤 ChannelTalk 메시지 전송 함수들
// ===============================

/**
 * 안전한 ChannelTalk 메시지 전송
 * @param {string} userChatId - 사용자 채팅 ID
 * @param {string} message - 전송할 메시지
 * @param {string} userId - 사용자 ID (로깅용)
 * @returns {Promise<boolean>} - 전송 성공 여부
 */
async function sendChannelTalkMessage(userChatId, message, userId = '') {
  try {
    const botName = encodeURIComponent("케어커넥트 AI");
    const channelTalkUrl = `https://api.channel.io/open/v5/user-chats/${userChatId}/messages?botName=${botName}`;
    
    const outMessageId = uuidv4();
    const channelTalkPayload = { 
      messageId: outMessageId,
      blocks: [{ type: "text", value: message }]
    };
    // 🔒 웹훅 재유입 차단: 보낸 메시지 ID를 선등록하여 중복 처리
    try {
      setCache(`processed_${outMessageId}`, true, 600);
    } catch (_) { /* ignore */ }


    // 🔐 API 키 검증
    if (!CHANNELTALK_ACCESS_KEY || !CHANNELTALK_ACCESS_SECRET) {
      throw new Error('채널톡 API 키가 설정되지 않았습니다.');
    }
    
    const response = await axios.post(channelTalkUrl, channelTalkPayload, {
      headers: { 
        'X-Access-Key': CHANNELTALK_ACCESS_KEY, 
        'X-Access-Secret': CHANNELTALK_ACCESS_SECRET,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    console.log(`✅ [ChannelTalk] 메시지 전송 완료 (상태: ${response.status})`);

    // --- START OF CRITICAL CHANGE ---
    // 🔒 Self-Echo 방지: 봇이 보낸 메시지의 고유 ID를 캐시에 저장
    try {
      setCache(`outbound_${outMessageId}`, true, 60);
      console.log(`🔒 [Anti-Echo] 아웃바운드 ID 캐시됨: ${outMessageId}`);
    } catch (_) { /* ignore */ }
    // --- END OF CRITICAL CHANGE ---

    // ⏱️ 단기 디바운스: 직전 봇 발화 직후의 중복 전송 방지 (2초)
    try {
      setCache(`recent_bot_send_${userId}`, Date.now(), 2);
    } catch (_) { /* ignore */ }

    // 🗃️ Firestore에 아웃바운드 메시지 기록 저장 (루프 방지용 DB 의존성)
    try {
      await db.collection('outboundMessages').doc(outMessageId).set({
        userId,
        userChatId,
        message,
        createdAt: new Date()
      }, { merge: true });
    } catch (e) {
      console.warn('⚠️ [ChannelTalk] outboundMessages 저장 경고:', e?.message || e);
    }
    return true;
  } catch (error) {
    handleError('ChannelTalk', error, userId);
    return false;
  }
}

module.exports = {
  sendChannelTalkMessage
};
