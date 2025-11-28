const { db } = require('./config');

function getTechnicalInstructions() {
  const currentDate = new Date();
  const tomorrowDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  return `🚨 MANDATORY FUNCTION CALLING RULES - OVERRIDE ALL OTHER INSTRUCTIONS 🚨

[RULE 1] You MUST strictly adhere to the function schemas provided. NEVER invent parameter names.
[RULE 2] When calculating dates, ALWAYS use current date as reference. "Tomorrow" = day after today.
[RULE 3] dateTime MUST be in ISO 8601 format (YYYY-MM-DDTHH:MM:SS). NEVER use natural language.
// [RULE 4] MANDATORY: When user mentions ANY specific time OR asks about booking → CALL startBookingProcess IMMEDIATELY
// [RULE 5] CRITICAL: "예약은요?", "예약 가능한가요?", "can you recommend treatment" → CALL startBookingProcess with next available time

# DateTime Conversion Guidelines:
Today's date: ${currentDate.toISOString().split('T')[0]}
Tomorrow's date: ${tomorrowDate.toISOString().split('T')[0]}

- "내일 2시" → Use tomorrow's date + "T14:00:00" (e.g., "${tomorrowDate.toISOString().split('T')[0]}T14:00:00")
- "오후 3시" → Use today's date + "T15:00:00" (e.g., "${currentDate.toISOString().split('T')[0]}T15:00:00")
- "tomorrow 2pm" → Use tomorrow's date + "T14:00:00"
// - "예약은요?" → Use tomorrow's date + "T10:00:00" as default

// - Allowed Functions: startBookingProcess, createFinalBooking (requestHumanAgent TEMPORARILY DISABLED)

// 🔥 MANDATORY FUNCTION CALLING TRIGGERS 🔥
// - startBookingProcess: REQUIRED when user says ANY time OR asks about booking → use "dateTime" parameter
// - createFinalBooking: REQUIRED when name + phone number detected → use "selectedTime" parameter (get from history)
- requestHumanAgent: TEMPORARILY DISABLED - AI가 과도하게 상담원 연결을 요청하는 문제 해결 중

// ⚠️ SCHEMA CRITICAL: startBookingProcess uses 'dateTime', createFinalBooking uses 'selectedTime'
// ⚠️ CRITICAL: If user mentions time OR asks about booking → action MUST be "CALL_FUNCTION", NOT "ANSWER"

// # BOOKING FLOW STATE MACHINE:
// 1. User mentions specific time → CALL startBookingProcess (set nextState: 'AWAITING_INFO')
// 2. Time confirmed + need info → ANSWER asking for name and phone (stay 'AWAITING_INFO')
// 3. Got name + phone → CALL createFinalBooking (set nextState: 'IDLE')

// # CONTEXT-AWARE INFORMATION PARSING (for createFinalBooking):
// 🧠 Analyze conversation to extract customerName, phoneNumber, selectedTime (from history)
// 📱 Normalize Korean phone numbers to 010-XXXX-XXXX`;
}

function getLanguageRules(language = 'ko') {
  const base = `🌐 MULTI-LANGUAGE SUPPORT - ABSOLUTE REQUIREMENT:\n🚨 You MUST respond ONLY in ${language}`;
  if (language === 'th') {
    return base + `\n- 태국어(ภาษาไทย)만 사용, 한국어/영어 혼용 금지\n- 존칭(ค่ะ/ครับ) 유지`;
  }
  if (language === 'ko') {
    return base + `\n- 한국어 존댓말 유지 (습니다/입니다)`;
  }
  if (language === 'ja') {
    return base + `\n- 일본어 정중체(です/ます) 유지`;
  }
  return base;
}

async function assembleSystemPrompt({ mode = 'NORMAL', language = 'ko', intentState = 'IDLE' }) {
  const techInstructions = getTechnicalInstructions();
  const { getPolicyContext } = require('./utils');
  const behavioralPolicy = await getPolicyContext();
  const languageRules = getLanguageRules(language);
  return `${techInstructions}\n\n${behavioralPolicy}\n\nCurrentIntentState: ${intentState}\nLanguage: ${language}\n\n${languageRules}`;
}

module.exports = { assembleSystemPrompt, getTechnicalInstructions, getLanguageRules };


