const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { auth, calendar, CALENDAR_ID, CHANNELTALK_ACCESS_KEY, CHANNELTALK_ACCESS_SECRET, db } = require('./config');
const { handleError, setCache } = require('./utils');
const { sendChannelTalkMessage } = require('./channeltalk');

// ===============================
// 📅 Google Calendar 관련 함수들
// ===============================

/**
 * 예약 가능한 시간 슬롯 조회
 * @returns {Promise<Array>} - 예약 가능한 시간 슬롯 배열
 */
async function getAvailableSlots() {
  try {
    console.log('📅 [예약] Google Calendar API freebusy.query 호출 시작...');
    console.log('📅 [예약] 사용 중인 캘린더 ID:', CALENDAR_ID);
    
    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7일 후
    
    // 오전 10시부터 오후 7시까지의 시간대 설정
    const startHour = 10;
    const endHour = 19;
    
    // freebusy.query 요청 데이터
    const freebusyRequest = {
      timeMin: now.toISOString(),
      timeMax: endDate.toISOString(),
      items: [
        {
          id: CALENDAR_ID
        }
      ]
    };
    
    console.log('📅 [예약] freebusy.query 요청 데이터:', JSON.stringify(freebusyRequest, null, 2));
    
    // Google Calendar API 호출 전 인증 상태 확인
    try {
      const authClient = await auth.getClient();
      console.log('✅ [예약] Google Calendar API 인증 성공');
    } catch (authError) {
      console.error('❌ [예약] Google Calendar API 인증 실패:', authError);
      throw new Error('Google Calendar API 인증에 실패했습니다.');
    }
    
    const freebusyResponse = await calendar.freebusy.query({
      requestBody: freebusyRequest
    });
    
    console.log('📅 [예약] freebusy.query 응답:', JSON.stringify(freebusyResponse.data, null, 2));
    
    const busyPeriods = freebusyResponse.data.calendars[CALENDAR_ID]?.busy || [];
    console.log('📅 [예약] 바쁜 시간대:', busyPeriods);
    
    // 7일간의 가능한 시간 슬롯 생성
    const availableSlots = [];
    
    for (let day = 0; day < 7; day++) {
      const currentDate = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
      
      // 주말 제외 (토요일=6, 일요일=0)
      if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        continue;
      }
      
      for (let hour = startHour; hour < endHour; hour++) {
        const slotStart = new Date(currentDate);
        slotStart.setHours(hour, 0, 0, 0);
        
        const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000); // 30분 슬롯
        
        // 바쁜 시간대와 겹치는지 확인
        const isBusy = busyPeriods.some(busy => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return slotStart < busyEnd && slotEnd > busyStart;
        });
        
        if (!isBusy) {
          availableSlots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            display: `${slotStart.getMonth() + 1}월 ${slotStart.getDate()}일 ${hour.toString().padStart(2, '0')}:00`
          });
        }
      }
    }
    
    // 시간순으로 정렬하고 상위 3개만 반환
    availableSlots.sort((a, b) => new Date(a.start) - new Date(a.start));
    const top3Slots = availableSlots.slice(0, 3);
    
    console.log('📅 [예약] 예약 가능한 시간 슬롯 (상위 3개):', top3Slots);
    return top3Slots;
    
  } catch (error) {
    console.error('❌ [예약] Google Calendar API 호출 실패:', error);
    
    // 에러 발생 시 기본 시간 슬롯 반환 (fallback)
    const fallbackSlots = [];
    const now = new Date();
    
    for (let day = 1; day <= 3; day++) {
      const futureDate = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
      if (futureDate.getDay() !== 0 && futureDate.getDay() !== 6) { // 주말 제외
        fallbackSlots.push({
          start: new Date(futureDate.setHours(14, 0, 0, 0)).toISOString(),
          end: new Date(futureDate.setHours(14, 30, 0, 0)).toISOString(),
          display: `${futureDate.getMonth() + 1}월 ${futureDate.getDate()}일 14:00`
        });
      }
    }
    
    console.log('📅 [예약] fallback 시간 슬롯 사용:', fallbackSlots);
    return fallbackSlots;
  }
}

/**
 * Google Calendar에 예약 이벤트 생성
 * @param {string} customerName - 고객 이름
 * @param {string} customerContact - 고객 연락처
 * @param {string} selectedTime - 선택된 시간 (ISO String)
 * @returns {Promise<Object>} - 생성된 이벤트 정보
 */
async function createBooking(customerName, customerContact, selectedTime) {
  try {
    console.log('📅 [예약] Google Calendar API events.insert 호출 시작:', {
      customerName,
      customerContact,
      selectedTime
    });
    console.log('📅 [예약] 사용 중인 캘린더 ID:', CALENDAR_ID);
    
    const startTime = new Date(selectedTime);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30분 예약

    // Google Calendar 이벤트 생성
    const event = {
      summary: `상담예약: ${customerName}`,
      description: `고객 연락처: ${customerContact}\n예약 시간: ${startTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Asia/Seoul',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Asia/Seoul',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1일 전 이메일
          { method: 'popup', minutes: 30 }, // 30분 전 팝업
        ],
      },
    };

    console.log('📅 [예약] Calendar 이벤트 데이터:', JSON.stringify(event, null, 2));

    // Google Calendar API 호출 전 인증 상태 확인
    try {
      const authClient = await auth.getClient();
      console.log('✅ [예약] Google Calendar API 인증 성공');
    } catch (authError) {
      console.error('❌ [예약] Google Calendar API 인증 실패:', authError);
      throw new Error('Google Calendar API 인증에 실패했습니다.');
    }

    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: event,
    });

    console.log('✅ [예약] Google Calendar 이벤트 생성 성공:', response.data.id);
    return { id: response.data.id };
    
  } catch (error) {
    console.error('❌ [예약] Google Calendar 이벤트 생성 실패:', error);
    
    // API 호출 실패 시 명확한 오류 메시지 반환
    throw new Error("예약 생성 중 문제가 발생했습니다. 담당자에게 연락해 주세요.");
  }
}

/**
 * 예약 수정: 불릿포인트 대신 자연스러운 메시지 전송
 * @param {string} userId - 사용자 ID
 * @param {string} userChatId - 사용자 채팅 ID
 * @param {string} message - 메시지 내용
 * @param {Array} [availableSlots] - 예약 가능한 시간 슬롯 (선택적)
 * @returns {Promise<Object>} - 전송 결과
 */
async function sendNaturalMessage(userId, userChatId, message, availableSlots = null) {
  try {
    let finalMessage = message;
    // 예약 가능한 시간이 있으면 자연스럽게 추가
    if (availableSlots && availableSlots.length > 0) {
      const timeInfo = availableSlots.map(slot => slot.display).join(', ');
      finalMessage += `\n\n현재 예약 가능한 시간은 ${timeInfo} 등이 있습니다. 언제가 편하신지 말씀해 주세요!`;
    }

    console.log('🔍 [예약] 자연스러운 메시지(Wrapper 전송):', finalMessage.substring(0, 120) + (finalMessage.length > 120 ? '...' : ''));

    const ok = await sendChannelTalkMessage(userChatId, finalMessage, userId);
    if (!ok) {
      console.warn('⚠️ [예약] Wrapper 기반 메시지 전송 실패');
    } else {
      console.log('✅ [예약] 자연스러운 메시지 전송 완료(Wrapper)');
    }

    // 🔒 웹훅 재유입 차단: AI 응답 캐시에 저장
    try {
      const aiResponseHash = Buffer.from(finalMessage.substring(0, 100)).toString('base64').substring(0, 20);
      const aiMessageKey = `ai_response_${userId}_${aiResponseHash}`;
      setCache(aiMessageKey, {
        content: finalMessage.substring(0, 200),
        timestamp: Date.now(),
        userId,
        userChatId,
        hash: aiResponseHash
      }, 600);
      console.log(`🔧 [예약] 도구 전송 메시지 캐시 저장: ${aiMessageKey}`);
    } catch (cacheError) {
      console.warn('⚠️ [예약] 도구 전송 메시지 캐시 저장 실패:', cacheError?.message || cacheError);
    }
    return { success: !!ok };

  } catch (error) {
    console.error('❌ [예약] 자연스러운 메시지 전송 실패(Wrapper):', error);
    // Wrapper 실패 시 상위에서 처리하도록 성공/실패만 반환
    return { success: false, error: error?.message || String(error) };
  }
}

module.exports = {
  getAvailableSlots,
  createBooking,
  sendNaturalMessage  // sendButtonMessage 대신 sendNaturalMessage export
};

// ===============================
// 🔎 추가 유틸: 특정 시간 가용성 확인 및 근접 슬롯 탐색
// ===============================

/**
 * 주어진 시작 시각(ISO)과 길이(분) 동안 캘린더가 비어있는지 확인
 * @param {string} startIso
 * @param {number} durationMinutes
 * @returns {Promise<boolean>}
 */
async function isTimeRangeAvailable(startIso, durationMinutes = 30) {
  try {
    const start = new Date(startIso);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const freebusyRequest = {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      items: [{ id: CALENDAR_ID }]
    };

    const authClient = await auth.getClient();
    void authClient; // 인증 확인만
    const freebusyResponse = await calendar.freebusy.query({ requestBody: freebusyRequest });
    const busy = freebusyResponse.data.calendars[CALENDAR_ID]?.busy || [];
    const hasOverlap = busy.some(b => {
      const bStart = new Date(b.start);
      const bEnd = new Date(b.end);
      return start < bEnd && end > bStart;
    });
    return !hasOverlap;
  } catch (error) {
    console.error('❌ [예약] isTimeRangeAvailable 실패:', error);
    // 보수적으로 사용 불가로 간주하지 않고 true로 반환하여 흐름을 막지 않음
    return true;
  }
}

/**
 * 기준 시각 이후 가장 가까운 30분 단위 가용 슬롯을 탐색 (영업시간/주말 제외 규칙 반영)
 * @param {string} startIso
 * @param {number} searchHours
 * @returns {Promise<string|null>} - ISO 문자열 또는 null
 */
async function findNearestAvailableSlot(startIso, searchHours = 4) {
  try {
    const start = new Date(startIso);
    const limit = new Date(start.getTime() + searchHours * 60 * 60 * 1000);
    const stepMs = 30 * 60 * 1000;

    for (let t = start.getTime(); t <= limit.getTime(); t += stepMs) {
      const cand = new Date(t);
      // 영업시간 10~19, 주말 제외
      const hour = cand.getHours();
      const day = cand.getDay();
      if (day === 0 || day === 6) continue;
      if (hour < 10 || hour >= 19) continue;
      const ok = await isTimeRangeAvailable(cand.toISOString(), 30);
      if (ok) return cand.toISOString();
    }
    return null;
  } catch (error) {
    console.error('❌ [예약] findNearestAvailableSlot 실패:', error);
    return null;
  }
}

module.exports.isTimeRangeAvailable = isTimeRangeAvailable;
module.exports.findNearestAvailableSlot = findNearestAvailableSlot;
