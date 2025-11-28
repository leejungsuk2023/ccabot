# 🤖 CareConnectBot

CareConnectBot은 ChannelTalk + Gemini AI + Google Calendar + Firestore를 연동한 완전한 예약 시스템입니다.

## ✅ 주요 기능

### 📅 예약 시스템
- **예약 의도 감지**: AI가 고객의 예약 의도를 자동 감지
- **시간 제안**: Google Calendar API로 빈 시간 조회 후 버튼으로 제안
- **시간 선택**: ChannelTalk 버튼 메시지로 직관적인 시간 선택
- **고객 정보 수집**: 이름과 연락처 자동 파싱
- **예약 확정**: Google Calendar에 이벤트 생성 및 확인 메시지

### 🧠 AI 시스템
- **Gemini AI 연동**: 지능형 대화 및 자연어 처리
- **다국어 지원**: 한국어, 태국어, 영어 등 자동 언어 감지
- **상담 모드 관리**: AI_MODE/HUMAN_MODE 자동 전환
- **동적 지식 베이스**: CSV 데이터 기반 실시간 업데이트

## 🚀 빠른 시작

### 1. 배포
```bash
cd functions
npm install
npm run deploy
```

### 2. 환경 설정
```bash
npm run setup-env
```

### 3. AI 지식 베이스 업데이트
```bash
npm run update-ai
```

### 4. 로그 확인
```bash
npm run logs
npm run save-logs  # 로그 파일 저장
```

## 🔧 설정 가이드

자세한 설정 방법은 [`functions/SETUP_GUIDE.md`](functions/SETUP_GUIDE.md) 참조

## 📊 현재 상태

- **웹훅 URL**: `https://channeltalkwebhook-7ljebxnryq-du.a.run.app`
- **Node.js 버전**: 22
- **지역**: asia-northeast3 (서울)
- **런타임**: Firebase Functions v2

## 📁 프로젝트 구조

```
CareConnectBot/
├── functions/
│   ├── index.js                 # 메인 웹훅 및 API 함수
│   ├── update_ai_brain_v5.js   # AI 지식 베이스 업데이트
│   ├── SETUP_GUIDE.md          # 설정 가이드
│   ├── *.csv                   # AI 지식 베이스 데이터
│   └── save-realtime-logs.bat  # 로그 저장 스크립트
├── logs/                       # 저장된 로그 파일들
├── firebase.json              # Firebase 설정
└── PROJECT_SUMMARY.md         # 프로젝트 현황
```

## 📞 지원

문제가 발생하면:
1. `npm run logs` - 실시간 로그 확인
2. `functions/SETUP_GUIDE.md` - 설정 가이드 참조
3. `PROJECT_SUMMARY.md` - 현재 상태 및 문제 해결

---

**버전**: v1.1.1
**마지막 업데이트**: 2025-11-28
**상태**: 배포 완료 ✅