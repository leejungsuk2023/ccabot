# 🚀 CareConnectBot 설정 가이드

CareConnectBot의 예약 시스템을 위한 완전한 설정 가이드입니다.

## 📋 목차

1. [Google Calendar API 설정](#-google-calendar-api-설정)
2. [ChannelTalk API 설정](#-channeltalk-api-설정)
3. [Firestore Policy Context 준비](#-firestore-policy-context-준비)
4. [Firebase Functions 배포](#-firebase-functions-배포)
5. [문제 해결](#-문제-해결)

## 📅 Google Calendar API 설정

### 1.1 Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 프로젝트 선택: `careconnectai-51631`
3. "API 및 서비스" → "라이브러리" 선택
4. "Google Calendar API" 검색 후 "사용" 버튼 클릭

### 1.2 서비스 계정 생성

1. "API 및 서비스" → "사용자 인증 정보" 선택
2. "사용자 인증 정보 만들기" → "서비스 계정" 선택
3. 서비스 계정 정보 입력:
   - 이름: `careconnectbot-calendar`
   - 설명: `CareConnectBot 예약 시스템용 서비스 계정`
4. "만들고 계속하기" 클릭

### 1.3 서비스 계정 키 생성

1. 생성된 서비스 계정 클릭
2. "키" 탭 선택
3. "키 추가" → "새 키 만들기" → "JSON" 선택
4. JSON 키 파일 다운로드

### 1.4 키 파일 배치

1. 다운로드한 JSON 파일을 `functions/` 폴더에 복사
2. 파일명을 `service-account-key.json`으로 변경
3. `.gitignore`에 이미 포함되어 있으므로 Git에 커밋되지 않음

### 1.5 Google Calendar 설정

1. [Google Calendar](https://calendar.google.com/)에 접속
2. 새 캘린더 생성: "케어커넥트 예약"
3. 캘린더 설정 → "특정 사용자와 공유"
4. 서비스 계정 이메일 주소 추가 (JSON 키 파일의 `client_email` 값)
5. 권한: "이벤트 변경" 선택
6. 캘린더 ID 복사 (예: `abc123@group.calendar.google.com`)

## 💬 ChannelTalk API 설정

### 2.1 ChannelTalk 관리자 설정

1. [ChannelTalk 관리자](https://admin.channel.io/)에 접속
2. "설정" → "API" 선택
3. API 키와 시크릿 확인/생성

### 2.2 웹훅 설정

1. "설정" → "웹훅" 선택
2. 새 웹훅 추가:
   - URL: `https://channeltalkwebhook-7ljebxnryq-du.a.run.app`
   - 이벤트: "메시지 수신" 선택
3. 웹훅 활성화

## 🧠 Firestore Policy Context 준비 (통합)

`promptManager`는 단일 Policy 문서를 참조합니다. 코드 내 하드코딩은 금지합니다.

- 컬렉션: `knowledge_base`
- 문서:
  - `policy_context` → 통합 Policy 텍스트(모드별 가이드 포함)

문서는 Firebase Console 또는 배치 스크립트로 업데이트하세요.

## 🔧 Firebase Functions 배포

### 3.1 환경 변수 설정

```bash
cd functions

# 전체 환경 변수 설정 (권장)
npm run setup-env

# 또는 수동 설정
firebase functions:config:set channeltalk.access_key="your-channeltalk-key"
firebase functions:config:set channeltalk.access_secret="your-channeltalk-secret"
firebase functions:config:set gemini.api_key="your-gemini-key"
firebase functions:config:set google.calendar_id="your-calendar-id@group.calendar.google.com"
```

### 3.2 배포

```bash
# 의존성 설치
npm install

# 배포
npm run deploy

# 또는 전체 배포 (환경 변수 설정 포함)
npm run deploy-full
```

배포 후 점검:
- 웹훅 언어 감지: `🌐 [Webhook] 감지된 언어:` 로그 확인
- HUMAN_MODE 전환: 매니저 발화 시 AI 응답 중단 확인
- 30분 타임아웃 복귀: 자동 안내 메시지 전송 확인

### 3.3 배포 확인

배포 후 다음 URL들이 생성됩니다:
- **웹훅 URL**: `https://channeltalkwebhook-7ljebxnryq-du.a.run.app`
- **AI 업데이트 URL**: `https://updateaibrainhttp-7ljebxnryq-du.a.run.app`
- **예약 조회 URL**: `https://getbookings-7ljebxnryq-du.a.run.app`

## 🧪 테스트

### 4.1 로그 확인

```bash
# 실시간 로그 확인
npm run logs

# 특정 함수 로그 확인
firebase functions:log --only channelTalkWebhook
```

### 4.2 예약 시스템 테스트

1. ChannelTalk에서 "예약하고 싶어요" 메시지 전송
2. AI가 예약 의도를 감지하고 시간 제안
3. 버튼 클릭으로 시간 선택
4. 고객 정보 입력 (예: "홍길동 010-1234-5678")
5. 예약 확정 확인

## 🔍 문제 해결

### 5.1 Google Calendar API 오류

**증상**: "Google Calendar API 인증에 실패했습니다" 오류

**해결 방법**:
1. 서비스 계정 키 파일이 `functions/service-account-key.json`에 있는지 확인
2. Google Calendar API가 활성화되어 있는지 확인
3. 서비스 계정이 캘린더에 공유되어 있는지 확인
4. 캘린더 ID가 올바른지 확인

### 5.2 ChannelTalk 버튼 메시지 422 오류

**증상**: 버튼 메시지 전송 시 422 에러

**해결 방법**:
1. ChannelTalk API 키와 시크릿이 올바른지 확인
2. 웹훅 URL이 올바르게 설정되어 있는지 확인
3. 버튼 형식이 ChannelTalk API v5와 호환되는지 확인

### 5.3 Firebase Functions 배포 오류

**증상**: 배포 중 오류 발생

**해결 방법**:
1. Firebase CLI가 최신 버전인지 확인: `firebase --version`
2. 프로젝트가 올바르게 설정되어 있는지 확인: `firebase projects:list`
3. 환경 변수가 올바르게 설정되어 있는지 확인: `firebase functions:config:get`

### 5.4 로그 확인 방법

```bash
# 전체 로그 확인
firebase functions:log

# 특정 함수 로그 확인
firebase functions:log --only channelTalkWebhook

# 실시간 로그 확인
firebase functions:log --follow
```

## 📞 지원

문제가 발생하면 다음을 확인하세요:

1. **Firebase Functions 로그**: `npm run logs`
2. **Google Cloud Console 로그**: [Google Cloud Console](https://console.cloud.google.com/)
3. **ChannelTalk 관리자**: [ChannelTalk 관리자](https://admin.channel.io/)

## 🔒 보안 주의사항

1. **서비스 계정 키 파일을 절대 Git에 커밋하지 마세요**
2. **API 키를 코드에 하드코딩하지 마세요**
3. **환경 변수를 통해 민감한 정보를 관리하세요**
4. **정기적으로 API 키를 로테이션하세요**

## 📝 체크리스트

- [ ] Google Calendar API 활성화
- [ ] 서비스 계정 생성 및 키 파일 배치
- [ ] Google Calendar 생성 및 공유 설정
- [ ] ChannelTalk API 키 설정
- [ ] ChannelTalk 웹훅 설정
- [ ] Firebase Functions 환경 변수 설정
- [ ] Firebase Functions 배포
- [ ] 예약 시스템 테스트
- [ ] 로그 확인 및 문제 해결
