const axios = require('axios');
const { formatDateTimeByLanguage } = require('./timeUtils');
const { detectLanguage, getLanguagePatterns } = require('./utils');

console.log('🌐 다국어 지원 및 시간 표시 테스트 시작');
console.log('='.repeat(60));

// 1. 언어 감지 테스트
console.log('1️⃣ 언어 감지 테스트');
const testTexts = [
  'Hello, I want to book an appointment',
  '안녕하세요, 예약하고 싶어요',
  'สวัสดีค่ะ ขอจองเวลาได้ไหมคะ',
  'こんにちは、予約したいです',
  '您好，我想预约',
  'Xin chào, tôi muốn đặt lịch hẹn',
  'Hola, quiero hacer una cita',
  'Olá, eu gostaria de agendar uma consulta',
  'Bonjour, je voudrais prendre rendez-vous',
  'Hallo, ich möchte einen Termin buchen'
];

testTexts.forEach(text => {
  const detected = detectLanguage(text);
  console.log(`📝 "${text}" → ${detected}`);
});

console.log('\n2️⃣ 시간 포맷팅 테스트');
const testTime = '2025-08-13T05:00:00Z'; // UTC 05:00 = KST 14:00
const languages = ['ko', 'en', 'th', 'ja', 'zh', 'vi', 'es', 'pt', 'fr', 'de'];

languages.forEach(lang => {
  const formatted = formatDateTimeByLanguage(testTime, lang);
  console.log(`⏰ ${lang}: ${formatted}`);
});

console.log('\n3️⃣ 언어별 예약 확정 메시지 테스트');
languages.forEach(lang => {
  const patterns = getLanguagePatterns(lang);
  const message = patterns.bookingConfirmed
    .replace('{name}', '홍길동')
    .replace('{time}', formatDateTimeByLanguage(testTime, lang));
  console.log(`💬 ${lang}: ${message}`);
});

console.log('\n4️⃣ 프로덕션 테스트 - 시스템 상태 확인');
async function testProduction() {
  try {
    const response = await axios.get('https://systemstatus-7ljebxnryq-du.a.run.app');
    console.log('✅ 시스템 정상 작동 중');
    console.log('📊 상태:', JSON.stringify(response.data, null, 2).substring(0, 200));
  } catch (error) {
    console.error('❌ 시스템 상태 확인 실패:', error.message);
  }
}

testProduction();

console.log('\n✅  다국어 지원 및 시간 표시 테스트 완료!');
console.log('🎯 이제 Channel.io에서 다음과 같이 테스트해보세요:');
console.log('• 한국어: "내일 2시 예약 가능한가요?"');
console.log('• English: "Can I book an appointment for tomorrow 2pm?"');
console.log('• ไทย: "จองเวลานัดหมายพรุ่งนี้ 14:00 ได้ไหมคะ"');
console.log('• 日本語: "明日の午後2時に予約できますか？"');