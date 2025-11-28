const admin = require('firebase-admin');
const { google } = require('googleapis');

// 🔧 dotenv 설정 (로컬 개발용)
try {
  require('dotenv').config();
  console.log('✅ [ENV] dotenv 설정 완료 - 로컬 개발 모드');
} catch (error) {
  console.log('⚠️ [ENV] dotenv 로드 실패 (프로덕션 환경에서는 정상):', error.message);
}

// Firebase 초기화
admin.initializeApp();
const db = admin.firestore();

// 🔒 Firebase Functions 환경 변수에서 API 키 가져오기
const functions = require('firebase-functions');

// 환경 변수 가져오기 함수 (Firebase Functions Config + dotenv 지원)
const getConfig = () => {
  try {
    const firebaseConfig = functions.config();
    // 로컬 개발용 process.env와 Firebase config 병합
    return {
      channeltalk: {
        access_key: firebaseConfig.channeltalk?.access_key || process.env.CHANNELTALK_ACCESS_KEY,
        access_secret: firebaseConfig.channeltalk?.access_secret || process.env.CHANNELTALK_ACCESS_SECRET
      },
      gemini: {
        api_key: firebaseConfig.gemini?.api_key || process.env.GEMINI_API_KEY
      },
      google: {
        calendar_id: firebaseConfig.google?.calendar_id || process.env.GOOGLE_CALENDAR_ID
      }
    };
  } catch (error) {
    console.log('⚠️ Firebase Functions config를 가져올 수 없습니다. process.env 사용합니다.');
    return {
      channeltalk: {
        access_key: process.env.CHANNELTALK_ACCESS_KEY,
        access_secret: process.env.CHANNELTALK_ACCESS_SECRET
      },
      gemini: {
        api_key: process.env.GEMINI_API_KEY
      },
      google: {
        calendar_id: process.env.GOOGLE_CALENDAR_ID
      }
    };
  }
};

const config = getConfig();

// 🔒 API 키 설정 (환경 변수 필수 - 보안상 하드코딩 제거)
const CHANNELTALK_ACCESS_KEY = config.channeltalk?.access_key;
const CHANNELTALK_ACCESS_SECRET = config.channeltalk?.access_secret;
const GEMINI_API_KEY = config.gemini?.api_key;

// 🔐 API 키 검증 - 누락 시 경고 출력 (배포 호환성을 위해 throw 제거)
if (!CHANNELTALK_ACCESS_KEY || !CHANNELTALK_ACCESS_SECRET || !GEMINI_API_KEY) {
  console.error('⚠️ [보안] 일부 API 키가 설정되지 않았습니다.');
  console.error('⚠️ [보안] 누락된 키:');
  if (!CHANNELTALK_ACCESS_KEY) console.error('   - channeltalk.access_key');
  if (!CHANNELTALK_ACCESS_SECRET) console.error('   - channeltalk.access_secret');
  if (!GEMINI_API_KEY) console.error('   - gemini.api_key');
  console.error('⚠️ [보안] 설정 방법: npm run setup-env');
  console.error('⚠️ [보안] 일부 기능이 정상 동작하지 않을 수 있습니다.');
} else {
  console.log('✅ [보안] 모든 필수 API 키가 안전하게 로드되었습니다.');
}

// A. Google API 인증 설정 - 서비스 계정 키 파일 사용
let auth;
try {
  // 서비스 계정 키 파일이 있는 경우 사용
  const serviceAccount = require('./service-account-key.json');
  auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });
  console.log('✅ [Google Calendar] 서비스 계정 키 파일로 인증 설정 완료');
} catch (error) {
  // 서비스 계정 키 파일이 없는 경우 기본 인증 사용
  console.log('⚠️ [Google Calendar] 서비스 계정 키 파일을 찾을 수 없습니다. 기본 인증을 사용합니다.');
  auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/calendar']
  });
}

const calendar = google.calendar({version: 'v3', auth});

// 🗓️ Google Calendar 설정
const CALENDAR_ID = config.google?.calendar_id || "primary";

// 📅 캘린더 ID 검증 및 로깅
if (CALENDAR_ID === "primary") {
  console.log('⚠️ [Calendar] 기본 캘린더 사용 중. 실제 캘린더 ID 설정을 권장합니다.');
} else {
  console.log('✅ [Calendar] 사용자 정의 캘린더 ID가 설정되었습니다.');
}

module.exports = {
  admin,
  db,
  config,
  CHANNELTALK_ACCESS_KEY,
  CHANNELTALK_ACCESS_SECRET,
  GEMINI_API_KEY,
  auth,
  calendar,
  CALENDAR_ID
};
