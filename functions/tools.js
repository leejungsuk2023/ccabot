const { db } = require('./config');
const { isTimeRangeAvailable, findNearestAvailableSlot } = require('./calendar');
const { safeFirestoreOperation } = require('./utils');
const { isValidISO8601, parseNaturalTime } = require('./timeUtils');
const { z } = require('zod');

// ===============================
// 🔧 Gemini Function Calling 도구 함수들 (간소화됨)
// ===============================

/**
 * 예약 프로세스를 시작합니다 - 단순 실행기 (Simple Executor)
 * 주어진 dateTime에 대해 캘린더 가용성만 확인하고 결과를 반환합니다.
 * 
 * @param {Object} details - 예약 세부사항
 * @param {string} details.dateTime - ISO 8601 형식의 날짜/시간
 * @returns {Promise<Object>} - 처리 결과 (데이터만, 메시지 전송 없음)
 */
async function startBookingProcess(details) {
  const { dateTime } = details;
  console.log('📅 [도구] 예약 가능 시간 확인 시작:', { dateTime });

  if (!dateTime || typeof dateTime !== 'string' || dateTime === 'undefined') {
    return { success: false, action: 'invalid_datetime_format', message: '구체적인 예약 시간이 필요합니다. 예: "내일 2시", "오후 3시"' };
  }

  // 자연어가 포함된 경우 파싱 시도
  const naturalLanguagePatterns = ['tomorrow', 'today', 'next', '내일', '오늘', '다음', '오전', '오후'];
  if (naturalLanguagePatterns.some(pattern => dateTime.toLowerCase().includes(pattern))) {
    console.log('🔄 [도구] 자연어 시간 감지, 파싱 시도:', dateTime);
    const parsedTime = parseNaturalTime(dateTime);
    if (parsedTime) {
      dateTime = parsedTime;
      console.log('✅ [도구] 자연어 시간 파싱 성공:', dateTime);
    } else {
      return { success: false, action: 'natural_language_parse_failed', message: '시간을 이해할 수 없습니다. ISO 8601 형식으로 제공해주세요.' };
    }
  }

  // ISO 8601 형식 검증
  if (!isValidISO8601(dateTime)) {
    return { success: false, action: 'invalid_iso_format', message: 'ISO 8601 형식(YYYY-MM-DDTHH:MM:SS)이 필요합니다.' };
  }

  try {
    const testDate = new Date(dateTime);
    if (isNaN(testDate.getTime())) {
      throw new Error('유효하지 않은 날짜/시간입니다.');
    }

    const isAvailable = await isTimeRangeAvailable(dateTime, 30);
    if (isAvailable) {
      return { success: true, action: 'time_slot_available', isAvailable: true, confirmedTime: dateTime };
    } else {
      const nearestSlot = await findNearestAvailableSlot(dateTime, 4);
      return { success: true, action: 'time_slot_unavailable', isAvailable: false, nearestSlot: nearestSlot };
    }
  } catch (error) {
    console.error('❌ [도구] startBookingProcess 실패:', error.message);
    return { success: false, action: 'system_error', message: error.message };
  }
}

/**
 * 상담원 연결 요청 - 단순 실행기 (Simple Executor)
 * 상담원 연결을 위한 데이터만 반환합니다.
 * 
 * @param {string} userId - 사용자 ID
 * @param {Object} [options] - 추가 옵션
 * @param {string} [options.reason] - 상담원 연결 사유
 * @param {string} [options.context] - 상황 설명
 * @param {number} [options.requestCount] - 요청 횟수 (비례 제한용)
 * @returns {Promise<Object>} - 처리 결과 (데이터만, 메시지 전송 없음)
 */
async function requestHumanAgent(userId, options = {}) {
  const { reason = '', context = '', requestCount = 1 } = options;
  const { admin } = require('./config');
  
  // Rate limiting: 사용자가 3번 이상 명시적으로 요청한 경우에만 활성화
  if (requestCount < 3) {
    console.log('ℹ️ [도구] 상담원 연결 요청 (비례 제한중)', { userId, requestCount });
    return {
      success: false,
      action: 'rate_limited',
      message: 'AI가 계속해서 도움을 드리겠습니다. 추가 도움이 필요하시면 다시 말씀해주세요.',
      requestCount,
      reason: 'rate_limiting'
    };
  }
  
  console.log('✅ [도구] 상담원 연결 요청 승인', { userId, reason, context });
  
  // 세션을 HUMAN_MODE로 전환
  try {
    await safeFirestoreOperation(async () => {
      await db.collection('sessions').doc(userId).set({
        mode: 'HUMAN_MODE',
        humanModeStartTime: admin.firestore.Timestamp.now(),
        reason,
        context,
        lastUpdated: admin.firestore.Timestamp.now()
      }, { merge: true });
    }, 'session_update');
    
    return {
      success: true,
      action: 'human_agent_requested',
      message: '상담원이 곧 연결될 때까지 잠시만 기다려주세요.',
      mode: 'HUMAN_MODE'
    };
  } catch (error) {
    console.error('❌ [도구] 상담원 연결 실패:', error);
    return {
      success: false,
      action: 'system_error',
      message: '상담원 연결 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
    };
  }
}

/**
 * 최종 예약 생성 - 단순 실행기 (Simple Executor)
 * 예약 정보를 받아 캘린더에 예약을 생성하고 결과만 반환합니다.
 * 
 * @param {Object} bookingInfo - 예약 정보
 * @param {string} bookingInfo.userId - 사용자 ID
 * @param {string} bookingInfo.userChatId - 채팅방 ID
 * @param {string} bookingInfo.customerName - 고객 이름
 * @param {string} bookingInfo.phoneNumber - 고객 연락처
 * @param {string} bookingInfo.selectedTime - 선택된 시간 (ISO 8601)
 * @param {string} [bookingInfo.serviceType] - 서비스 유형
 * @returns {Promise<Object>} - 처리 결과 (데이터만, 메시지 전송 없음)
 */
async function createFinalBooking(bookingInfo) {
  try {
    // 1. Zod 스키마로 데이터 유효성 검사 및 파싱
    const validatedInfo = FinalBookingSchema.parse(bookingInfo);
    console.log('📝 [도구] 최종 예약 생성 시작 (검증 완료):', validatedInfo);

    const { userId, userChatId, customerName, phoneNumber, selectedTime, serviceType } = validatedInfo;

    // 2. Google Calendar에 예약 생성
    const { createBooking } = require('./calendar');
    const event = await createBooking(
      customerName,
      phoneNumber,
      selectedTime
    );

    const eventId = event?.id;
    if (!eventId) {
      return { success: false, action: 'calendar_booking_failed', message: '캘린더 예약 생성에 실패했습니다.' };
    }

    // 3. Firestore에 예약 기록 저장
    await safeFirestoreOperation(async () => {
      await db.collection('bookings').add({
        userId,
        userChatId,
        customerName,
        phoneNumber,
        selectedTime,
        serviceType,
        calendarEventId: eventId,
        status: 'confirmed',
        createdAt: new Date(),
        bookingSource: 'chatbot'
      });
    }, 'final_booking_save');

    console.log('✅ [도구] 최종 예약 생성 완료:', { userId, customerName, selectedTime, eventId });
    
    return {
      success: true,
      action: 'booking_confirmed',
      bookingDetails: { 
        userId,
        customerName, 
        phoneNumber,
        selectedTime, 
        serviceType, 
        eventId 
      }
    };

  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = Array.isArray(error.errors) && error.errors.length > 0
        ? error.errors[0].message
        : (error.message || '입력값이 유효하지 않습니다.');
      console.warn('⚠️ [도구] 최종 예약 유효성 검사 실패:', firstError);
      return { success: false, action: 'validation_failed', message: firstError };
    }

    console.error('❌ [도구] 최종 예약 생성 실패:', error);
    return {
      success: false,
      action: 'final_booking_error',
      message: '예약 생성 중 시스템 오류가 발생했습니다.',
      error: error.message
    };
  }
}

// ===============================
// 🛠️ Simple Executor 완료
// ===============================

// ===============================
// 🔧 Gemini Function Calling을 위한 도구 정의 (간소화)
// ===============================

// Zod 스키마 (최종 예약 입력 검증)
const FinalBookingSchema = z.object({
  userId: z.string().min(1, "사용자 ID가 필요합니다."),
  userChatId: z.string().min(1, "채팅방 ID가 필요합니다."),
  customerName: z.string().min(2, "이름은 2글자 이상 입력해주세요."),
  phoneNumber: z.string().regex(/^010-\d{4}-\d{4}$/, "연락처는 '010-XXXX-YYYY' 형식이어야 합니다."),
  selectedTime: z.string().datetime({ message: "예약 시간은 유효한 ISO 8601 형식이어야 합니다." }),
  serviceType: z.string().optional().default('일반 상담')
});

const TOOL_DEFINITIONS = {
  functionDeclarations: [
    {
      name: 'startBookingProcess',
      description: '사용자가 요청한 시간에 대해 캘린더 가용성을 확인합니다. 단순히 시간 확인만 수행하고 결과를 반환합니다.',
      parameters: {
        type: 'object',
        properties: {
          dateTime: { 
            type: 'string', 
            description: "사용자가 요청한 날짜와 시간을 **반드시 현재 시점을 기준으로 계산**하여, 명확한 단일 ISO 8601 형식(예: '2025-01-15T14:00:00+09:00')으로 변환해주세요. '내일 2시'는 미래의 시간입니다." 
          }
        },
        required: ['dateTime']
      }
    },
    // TEMPORARY DISABLED: requestHumanAgent 함수가 비활성화되어 있으므로 Function Declaration도 주석처리
    // {
    //   name: 'requestHumanAgent',
    //   description: '상담원 연결을 위한 데이터를 준비합니다. 실제 모드 전환은 다른 모듈에서 처리됩니다.',
    //   parameters: {
    //     type: 'object',
    //     properties: {
    //       userId: { type: 'string', description: '사용자 ID' },
    //       reason: { type: 'string', enum: ['user_request', 'complex_consultation', 'knowledge_gap', 'technical_issue'], description: '상담원 연결을 요청하는 가장 적절한 이유.' },
    //       context: { type: 'string', description: '상담원이 참고할 수 있도록 현재 대화의 맥락을 요약합니다.' }
    //     },
    //     required: ['userId']
    //   }
    // },
    {
      name: 'createFinalBooking',
      description: '예약 정보를 받아 캘린더에 예약을 생성하고 데이터베이스에 저장합니다.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: '사용자 ID' },
          userChatId: { type: 'string', description: '채팅방 ID' },
          customerName: { type: 'string', description: "사용자가 문장으로 말해도 이름만 정확히 추출한 고객의 전체 이름(풀네임)." },
          phoneNumber: { type: 'string', description: "사용자가 어떤 형식으로 입력하든(예: '01012345678'), 반드시 '010-XXXX-YYYY' 형식으로 정규화(normalize)하여 제공하세요." },
          selectedTime: { type: 'string', description: "사용자가 선택한 시간을 한국(Asia/Seoul) 시간 기준의 ISO 8601 형식으로 변환하여 제공하세요. 예: '2025-01-15T14:00:00+09:00'" },
          serviceType: { type: 'string', description: '예약이 확정된 서비스 유형' }
        },
        required: ['userId', 'userChatId', 'customerName', 'phoneNumber', 'selectedTime']
      }
    }
  ]
};

module.exports = {
  startBookingProcess,
  requestHumanAgent, 
  createFinalBooking,
  TOOL_DEFINITIONS
};