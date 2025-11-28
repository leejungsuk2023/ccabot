/**
 * 언어 감지 및 응답 테스트 스크립트
 */

const { detectLanguage } = require('./utils');

console.log('🌐 === 언어 감지 테스트 시작 ===\n');

// 테스트 케이스
const testCases = [
  { text: '안녕하세요', expected: 'ko', description: '한국어' },
  { text: 'Hello, how are you?', expected: 'en', description: '영어' },
  { text: 'สวัสดีค่ะ สามารถเสริมจมูกได้ไหมคะ?', expected: 'th', description: '태국어' },
  { text: 'こんにちは', expected: 'ja', description: '일본어' },
  { text: '你好', expected: 'zh', description: '중국어' },
  { text: 'Xin chào', expected: 'vi', description: '베트남어' },
  { text: 'Bonjour', expected: 'fr', description: '프랑스어' },
  { text: 'Hola', expected: 'es', description: '스페인어' },
  { text: 'مرحبا', expected: 'ar', description: '아랍어' },
  { text: 'Привет', expected: 'ru', description: '러시아어' },
  { text: 'नमस्ते', expected: 'hi', description: '힌디어' },
  { text: 'Olá', expected: 'pt', description: '포르투갈어' },
  { text: 'Hallo', expected: 'de', description: '독일어' },
  { text: 'Apa kabar', expected: 'id', description: '인도네시아어' },
  { text: 'สวัสดีครับ ขอถามหน่อย', expected: 'th', description: '태국어 2' },
  { text: 'ราคาเท่าไหร่คะ', expected: 'th', description: '태국어 3' },
  { text: 'ทำอะไรได้บ้าง', expected: 'th', description: '태국어 4' }
];

let passCount = 0;
let failCount = 0;

// 각 테스트 케이스 실행
testCases.forEach((testCase, index) => {
  const detected = detectLanguage(testCase.text);
  const isPass = detected === testCase.expected;
  
  if (isPass) {
    passCount++;
    console.log(`✅ Test ${index + 1}: ${testCase.description}`);
  } else {
    failCount++;
    console.log(`❌ Test ${index + 1}: ${testCase.description}`);
  }
  
  console.log(`   입력: "${testCase.text}"`);
  console.log(`   예상: ${testCase.expected}, 결과: ${detected}`);
  console.log('');
});

// 결과 요약
console.log('🎯 === 테스트 결과 요약 ===');
console.log(`✅ 성공: ${passCount}개`);
console.log(`❌ 실패: ${failCount}개`);
console.log(`📊 성공률: ${((passCount / testCases.length) * 100).toFixed(1)}%`);

// 태국어 특별 테스트
console.log('\n🇹🇭 === 태국어 특별 검증 ===');
const thaiTests = [
  'สวัสดีค่ะ',
  'ขอบคุณค่ะ',
  'ราคาเท่าไหร่',
  'จองได้ไหมคะ',
  'มีโปรโมชั่นไหม',
  'ทำอะไรได้บ้าง',
  'เสริมจมูกได้ไหม'
];

thaiTests.forEach(text => {
  const detected = detectLanguage(text);
  console.log(`${detected === 'th' ? '✅' : '❌'} "${text}" → ${detected}`);
});

console.log('\n🔍 === 유니코드 범위 테스트 ===');
// 태국어 유니코드 범위 직접 테스트
const thaiChar = 'ส'; // 태국어 문자
console.log(`태국어 문자 'ส'의 유니코드: U+${thaiChar.charCodeAt(0).toString(16).toUpperCase()}`);
console.log(`태국어 범위 체크 (U+0E00-U+0E7F): ${/[\u0e00-\u0e7f]/.test(thaiChar) ? '✅ 통과' : '❌ 실패'}`);

// 한국어 테스트
const koreanChar = '한';
console.log(`한국어 문자 '한'의 유니코드: U+${koreanChar.charCodeAt(0).toString(16).toUpperCase()}`);
console.log(`한국어 범위 체크: ${/[\u3131-\u314e\u314f-\u3163\uac00-\ud7a3]/.test(koreanChar) ? '✅ 통과' : '❌ 실패'}`);