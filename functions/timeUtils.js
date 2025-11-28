const { admin } = require('./config');

// ===============================
// 🕐 시간대 처리 유틸리티 함수들
// ===============================

/**
 * ISO 8601 문자열을 한국 시간(KST)으로 변환
 * @param {string} isoString - ISO 8601 형식 문자열
 * @returns {Date} - 한국 시간 Date 객체
 */
function toKST(isoString) {
  const date = new Date(isoString);
  // UTC to KST (+9 hours)
  return new Date(date.getTime() + (9 * 60 * 60 * 1000));
}

/**
 * 한국 시간을 UTC ISO 문자열로 변환
 * @param {Date} kstDate - 한국 시간 Date 객체
 * @returns {string} - UTC ISO 8601 문자열
 */
function kstToUTC(kstDate) {
  // KST to UTC (-9 hours)
  const utcDate = new Date(kstDate.getTime() - (9 * 60 * 60 * 1000));
  return utcDate.toISOString();
}

/**
 * 자연어 시간을 ISO 8601 형식으로 변환
 * @param {string} naturalTime - 자연어 시간 (예: "내일 2시", "오후 3시")
 * @param {Date} [referenceDate] - 기준 날짜 (기본값: 현재 시간)
 * @returns {string|null} - ISO 8601 형식 문자열 또는 null
 */
function parseNaturalTime(naturalTime, referenceDate = new Date()) {
  if (!naturalTime || typeof naturalTime !== 'string') return null;
  
  const text = naturalTime.toLowerCase().trim();
  const baseDate = new Date(referenceDate);
  
  // 날짜 파싱
  let targetDate = new Date(baseDate);
  
  if (text.includes('내일') || text.includes('tomorrow')) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (text.includes('모레') || text.includes('day after tomorrow')) {
    targetDate.setDate(targetDate.getDate() + 2);
  } else if (text.includes('오늘') || text.includes('today')) {
    // 오늘은 그대로
  }
  
  // 시간 파싱
  let hour = null;
  let minute = 0;
  
  // 정규식으로 시간 추출
  const timePatterns = [
    /(\d{1,2})\s*시\s*(\d{1,2})?\s*분?/,  // "14시 30분", "2시"
    /(\d{1,2}):(\d{2})/,                   // "14:30", "2:00"
    /(\d{1,2})\s*(am|pm|AM|PM)/,           // "2pm", "2 PM"
    /오전\s*(\d{1,2})/,                     // "오전 10"
    /오후\s*(\d{1,2})/,                     // "오후 3"
  ];
  
  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern.source.includes('오전')) {
        hour = parseInt(match[1]);
        if (hour === 12) hour = 0; // 오전 12시는 0시
      } else if (pattern.source.includes('오후')) {
        hour = parseInt(match[1]);
        if (hour !== 12) hour += 12; // 오후 12시는 그대로
      } else if (pattern.source.includes('am|pm')) {
        hour = parseInt(match[1]);
        const isPM = match[2].toLowerCase() === 'pm';
        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;
      } else {
        hour = parseInt(match[1]);
        minute = match[2] ? parseInt(match[2]) : 0;
        
        // 오전/오후 키워드 체크
        if (text.includes('오후') || text.includes('pm')) {
          if (hour !== 12) hour += 12;
        } else if (text.includes('오전') || text.includes('am')) {
          if (hour === 12) hour = 0;
        }
      }
      break;
    }
  }
  
  // 시간이 파싱되지 않은 경우 기본값 (오전 10시)
  if (hour === null) {
    if (text.includes('예약')) {
      hour = 10; // 예약 관련 질문의 기본 시간
    } else {
      return null;
    }
  }
  
  // 시간 설정
  targetDate.setHours(hour, minute, 0, 0);
  
  // ISO 8601 형식으로 반환
  return targetDate.toISOString().split('.')[0]; // 밀리초 제거
}

/**
 * ISO 8601 문자열 유효성 검사
 * @param {string} dateTimeString - 검사할 문자열
 * @returns {boolean} - 유효한 ISO 8601 형식인지 여부
 */
function isValidISO8601(dateTimeString) {
  if (!dateTimeString || typeof dateTimeString !== 'string') return false;
  
  // ISO 8601 형식 패턴
  const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/;
  
  if (!iso8601Pattern.test(dateTimeString)) return false;
  
  // Date 객체로 파싱 가능한지 확인
  const date = new Date(dateTimeString);
  return !isNaN(date.getTime());
}

/**
 * 현재 시간 기준으로 영업 시간 내인지 확인
 * @param {Date} [checkTime] - 확인할 시간 (기본값: 현재 시간)
 * @returns {boolean} - 영업 시간 내인지 여부
 */
function isBusinessHours(checkTime = new Date()) {
  const kstTime = toKST(checkTime.toISOString());
  const hour = kstTime.getHours();
  const day = kstTime.getDay();
  
  // 주말 제외 (토요일=6, 일요일=0)
  if (day === 0 || day === 6) return false;
  
  // 영업 시간: 오전 10시 ~ 오후 7시
  return hour >= 10 && hour < 19;
}

/**
 * 다음 영업 가능 시간 계산
 * @param {Date} [fromTime] - 기준 시간 (기본값: 현재 시간)
 * @returns {Date} - 다음 영업 가능 시간
 */
function getNextBusinessTime(fromTime = new Date()) {
  let nextTime = new Date(fromTime);
  
  // 영업 시간이 아닌 경우 다음 영업 시간으로 조정
  while (!isBusinessHours(nextTime)) {
    const hour = nextTime.getHours();
    const day = nextTime.getDay();
    
    if (day === 0) {
      // 일요일 -> 월요일 10시
      nextTime.setDate(nextTime.getDate() + 1);
      nextTime.setHours(10, 0, 0, 0);
    } else if (day === 6) {
      // 토요일 -> 월요일 10시
      nextTime.setDate(nextTime.getDate() + 2);
      nextTime.setHours(10, 0, 0, 0);
    } else if (hour < 10) {
      // 영업 시간 전 -> 오늘 10시
      nextTime.setHours(10, 0, 0, 0);
    } else if (hour >= 19) {
      // 영업 시간 후 -> 다음날 10시
      nextTime.setDate(nextTime.getDate() + 1);
      nextTime.setHours(10, 0, 0, 0);
    }
  }
  
  return nextTime;
}

/**
 * ISO 8601 UTC 시간을 한국 시간 문자열로 포맷
 * @param {string} isoString - UTC ISO 8601 시간 문자열 (예: '2025-08-13T05:00:00Z')
 * @returns {string} - 한국 시간 포맷 문자열 (예: '2025년 8월 13일 오후 2시')
 */
function formatKoreanDateTime(isoString) {
  if (!isoString || typeof isoString !== 'string') return '';
  
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    
    // 한국 시간으로 변환하여 포맷
    return date.toLocaleString('ko-KR', { 
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('❌ [Time] 시간 포맷 변환 실패:', error);
    return isoString;
  }
}

/**
 * 언어별 시간 포맷팅 (다국어 지원)
 * @param {string} isoString - UTC ISO 8601 시간 문자열
 * @param {string} language - 언어 코드 (ko, en, th, ja, zh 등)
 * @returns {string} - 해당 언어로 포맷된 시간 문자열
 */
function formatDateTimeByLanguage(isoString, language = 'ko') {
  if (!isoString || typeof isoString !== 'string') return '';
  
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    
    // 언어별 locale 및 옵션 설정
    const localeMap = {
      'ko': 'ko-KR',
      'en': 'en-US', 
      'th': 'th-TH',
      'ja': 'ja-JP',
      'zh': 'zh-CN',
      'vi': 'vi-VN',
      'id': 'id-ID',
      'ms': 'ms-MY',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'ru': 'ru-RU',
      'ar': 'ar-SA',
      'hi': 'hi-IN',
      'pt': 'pt-BR'
    };
    
    const locale = localeMap[language] || localeMap['en'];
    
    return date.toLocaleString(locale, {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('❌ [Time] 다국어 시간 포맷 변환 실패:', error);
    return isoString;
  }
}

module.exports = {
  toKST,
  kstToUTC,
  parseNaturalTime,
  isValidISO8601,
  isBusinessHours,
  getNextBusinessTime,
  formatKoreanDateTime,
  formatDateTimeByLanguage
};