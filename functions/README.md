# CareConnectBot - AI 챗봇 시스템

## 📋 프로젝트 개요

CareConnectBot은 ChannelTalk와 연동된 AI 챗봇 시스템으로, 예약 관리, 상담 지원, 지식 베이스 응답 등의 기능을 제공합니다.

## 🏗️ 아키텍처

### 핵심 컴포넌트
- **`index.js`**: ChannelTalk 웹훅 핸들러 및 메인 라우터
- **`ai.js`**: Gemini AI API 연동 및 Function Calling 처리
- **`promptManager.js`**: 시스템 프롬프트 중앙 관리자(기술/정책/언어 규칙 조립, 통합 Policy 로딩)
- **`tools.js`**: 핵심 비즈니스 로직 함수들 (예약, 상담원 연결 등)
- **`calendar.js`**: Google Calendar API 연동
- **`channeltalk.js`**: ChannelTalk API 연동
- **`utils.js`**: 유틸리티 함수들 (캐싱, 에러 처리 등)

### 데이터베이스 구조 (현행)
- **`conversations`**: 대화 기록
- **`sessions`**: 사용자 세션 상태(모드, bookingState 등)
- (레거시) **`sessionModes`**, **`pendingBookings`**: 기존 경로 호환용 읽기만 일부 유지
- **`knowledge_base`**: FAQ/가격/프로모션/병원정보/리뷰/Policy Context 등
  - **`products`**: 기존 시술 정보 + 2025년 최신 시술 20개 추가
  - **`trends_2025`**: 2025년 피부과 시술 트렌드 가이드 (신규)
  - **`policy_context`**: 단일 문서로 Policy Context 통합 관리

## 🔄 최신 수정사항 (v2.1.0 - 2025.08.13)

### 🧩 프롬프트/Policy 중앙화(promptManager.js)
- `ai.js`에 중복되던 시스템 프롬프트를 제거하고, `promptManager.assembleSystemPrompt()`를 통해 단일 조립
- 구성 요소
  - `getTechnicalInstructions()`
  - (통합) `getPolicyContext()` (Firestore `knowledge_base/policy_context`)
  - `getLanguageRules(language)`
  - `assembleSystemPrompt({ mode, language, intentState })`

### 🎭 HUMAN_MODE 전환 로직 복원
- 매니저 메시지 수신 시 즉시 HUMAN_MODE 전환, AI 응답 중단
- 30분 무응답 시 자동 AI_MODE 복귀(안내 전송)
- `//` 입력 시 즉시 AI_MODE 복귀

### 🌐 다국어 일관성 강화
- 웹훅에서 `detectLanguage(text)`로 강제 감지
- `utils.getConversationHistory()`에서 `sender: 'manager'` 메시지 제외하여 모델 컨텍스트 오염 방지

## 🔄 이전 수정사항 (v1.4.0)

### 🎯 AI 응답 길이 제한 시스템 도입
- **문제**: AI 응답이 너무 길어서 사용자 경험 저하
- **해결**: 3중 보안 체계로 모든 응답을 **150글자 이내**로 강제 제한

#### 📐 150글자 제한 시스템 구성요소
1. **🚫 AI 지시 강화**: 시스템 프롬프트에 절대적 길이 제한 규칙 추가
   ```javascript
   🚨 CRITICAL RESPONSE LENGTH RULE 🚨
   **절대적 필수 사항: 모든 응답은 반드시 150글자 이내로 제한**
   ```

2. **⚙️ API 파라미터 최적화**: Gemini API 호출 시 토큰 수 제한
   ```javascript
   generationConfig: {
     maxOutputTokens: 100,  // 150글자 ≈ 100 토큰 (한글 기준)
     temperature: 0.7,
     topP: 0.8,
     topK: 40
   }
   ```

3. **✂️ Post-processing 강제 제한**: 응답 생성 후 길이 검증 및 자동 자르기
   ```javascript
   if (response.length > 150) {
     // 문장 중간에서 자르지 않도록 완전한 문장까지만 반환
     const lastSentenceEnd = Math.max(/* 한글 문장 끝 탐지 */);
     return truncated.substring(0, lastSentenceEnd + 1);
   }
   ```

#### 🔍 모니터링 및 로깅
- 길이 제한 적용 시: `⚡ [Length Limit] XXX글자 → YYY글자로 제한`
- 제한 불필요 시: `✅ [Length OK] XXX글자 (150글자 이내)`

#### 🆕 2025년 최신 시술 정보 업데이트 (Knowledge Base 확장)
- **20개 인기 시술 추가**: 울쎄라, 인모드, 포텐자, 프로파일로 등
- **트렌드 정보 포함**: 2025년 피부과 시술 트렌드 가이드
- **벡터화 지원**: products_2025.csv로 의미론적 검색 최적화
- **가격 정보**: 한국(KRW) 및 태국(THB) 가격 동시 제공

#### 📋 Policy Context 시스템 개선
- **3문장 → 150글자** 제한으로 더욱 정확한 길이 제어
- **utils.js fallback** 정책도 동일하게 150글자 제한 적용
- **모든 대화 모드**에 일관된 길이 제한 적용

## 🔄 이전 수정사항 (v1.3.x)

### Orchestrator + RAG 전환 및 가드레일 준수 강화
- Policy Context 동적 로딩: Firestore `knowledge_base/policy_context.content` → `ai.js`에서 `systemInstruction`로 주입
- 기술 지침만 코드에 유지(함수 스키마/출력 포맷/날짜 규칙)
- 에코 방지 강화: 아웃바운드 메시지 ID 캐시(`outbound_<id>`)와 `externalMessageId` 매칭 차단
- HUMAN_MODE 전환 시 즉시 안내 전송 및 후속 모델 응답 억제
- `createFinalBooking` 입력 Zod 검증 도입

## 🔄 이전 수정사항 (v1.2.1)

### Channel.io 웹훅 기반 메시지 필터링 시스템
- **정확한 봇 메시지 구분**: `personType=bot`과 메시지 내용 패턴을 조합하여 정확한 필터링
- **AI 응답 중복 처리 방지**: AI가 보낸 메시지가 다시 웹훅으로 들어오는 것을 완벽하게 차단
- **캐시 기반 중복 감지**: AI 응답 내용의 해시값을 기반으로 한 정확한 중복 메시지 감지
- **텍스트 유사도 검사**: 80% 이상 일치하는 AI 응답 메시지를 자동으로 필터링

### 메시지 처리 우선순위
1. **AI 응답 메시지**: `isAiResponseMessage` 또는 `isCachedAiResponse` - 즉시 차단
2. **봇 메시지**: `isBotMessage` - 시스템/로그 메시지만 차단
3. **사용자 메시지**: `isUserMessagePattern` - 처리 진행
4. **미분류 메시지**: 기본 처리 진행 (사용자 메시지일 가능성)

### 중복 처리 방지 메커니즘
- **메시지 ID 기반**: Channel.io의 고유 메시지 ID를 활용한 기본 중복 방지
- **AI 응답 캐시**: AI 응답 내용을 해시화하여 캐시에 저장 (10분간 유지)
- **유사도 검사**: Jaccard 유사도 기반 텍스트 비교로 정확한 중복 감지
- **메모리 관리**: 자동 캐시 정리로 메모리 누수 방지

## 🔄 이전 수정사항 (v1.2.0)

### 자연스러운 대화 시스템 전환
- **새로운 방식**: AI가 사용자의 자연스러운 답변을 이해하고 직접 함수 호출

### 주요 개선사항
1. **자연스러운 대화**: "2시로 해주세요", "내일 오후가 편해요" 등 자연스러운 표현 지원
2. **직접 함수 호출**: AI가 사용자 답변을 분석하여 startBookingProcess() 직접 호출
3. **구글 캘린더 연동**: 함수 호출 시 자동으로 구글 캘린더 확인 및 예약 진행
4. **복잡한 UI 제거**: 불릿포인트 선택 UI 제거로 사용자 경험 단순화

## 🚀 주요 기능

### 1. AI 기반 자연어 처리
- Gemini AI를 활용한 자연스러운 대화
- Function Calling을 통한 자동 예약 처리
- 다국어 지원 (한국어, 영어, 태국어 등)

### 2. 예약 관리 시스템
- Google Calendar 연동으로 실시간 예약 가능 시간 확인
- 자연스러운 시간 표현 인식 ("내일 오후 2시", "다음주 월요일" 등)
- 예약 상태 추적 및 관리

### 3. 상담원 연결
- 복잡한 상담이나 개인 맞춤 상담 시 상담원 연결
- 자동 모드 전환 (AI_MODE → HUMAN_MODE)

### 4. 지식 베이스 응답
- FAQ, 가격 정보, 프로모션 등 자동 응답 (내부 KB 우선)
- Firestore 기반 동적 지식 베이스 관리
- 웹검색 함수 미도입(모델 네이티브 기능 활용)

## 🔧 기술 스택

- **Backend**: Firebase Functions (Node.js)
- **AI**: Google Gemini API
- **Database**: Firestore
- **Calendar**: Google Calendar API
- **Messaging**: ChannelTalk API
- **Caching**: In-memory caching with TTL

## 📁 파일 구조

```
functions/
├── index.js                      # 웹훅 핸들러 및 메인 라우터
├── ai.js                        # AI 응답 생성 및 Function Calling (150글자 제한 포함)
├── tools.js                     # 핵심 비즈니스 로직 함수들
├── calendar.js                  # Google Calendar 연동
├── channeltalk.js               # ChannelTalk API 연동
├── utils.js                     # 유틸리티 함수들 (150글자 제한 fallback 포함)
├── config.js                    # 설정 파일
├── update-policy-contexts.js    # Policy Context 업데이트 스크립트
├── update-knowledge-base-2025.js # 2025년 시술 정보 업데이트 스크립트
├── products_2025.csv            # 2025년 최신 시술 데이터 (벡터화용)
├── vectorize-data.js            # 데이터 벡터화 시스템
├── test-2025-procedures.js      # 2025년 시술 정보 테스트
├── test-response-length.js      # AI 응답 길이 제한 테스트
├── test-production-deployment.js # 프로덕션 배포 검증 테스트
├── deploy-ai-fixes.js           # 배포 상태 확인 스크립트
└── README.md                    # 프로젝트 문서 (이 파일)
```

## 🚀 배포

```bash
# Firebase Functions 배포 (전체)
firebase deploy --only functions --force

# 특정 함수만 배포
firebase deploy --only functions:channeltalkwebhook

# Policy Context 업데이트 (프로덕션에서 직접 실행)
curl https://updatepolicycontexthttp-7ljebxnryq-du.a.run.app

# 2025년 시술 정보 업데이트
curl https://updateknowledgebase2025http-7ljebxnryq-du.a.run.app
```

## 🔍 모니터링

```bash
# 실시간 로그 확인
firebase functions:log --only channeltalkwebhook

# 특정 기간 로그 조회
firebase functions:log --only channeltalkwebhook --start="2025-08-10T00:00:00Z"

# 시스템 상태 확인
curl https://systemstatus-7ljebxnryq-du.a.run.app

# 응답 길이 제한 테스트 (로컬)
node test-response-length.js

# 프로덕션 배포 검증 테스트
node test-production-deployment.js
```

## 📝 개발 가이드라인

### 1. AI 응답 길이 제한 원칙 ⭐ (v1.4.0 신규)
- **모든 AI 응답은 150글자 이내**로 제한됨
- **3중 보안 체계**: AI 지시 + API 파라미터 + Post-processing
- **문장 단위 자르기**: 단어 중간에서 자르지 않고 완전한 문장까지만 반환
- **모니터링**: 로그에서 `⚡ [Length Limit]` 또는 `✅ [Length OK]` 메시지 확인

### 2. Knowledge Base 업데이트 원칙
- **2025년 최신 정보**: 정기적으로 트렌드 시술 정보 업데이트 필요
- **벡터화 필수**: 새로운 데이터는 반드시 `vectorize-data.js`로 벡터화
- **가격 정보**: 한국(KRW), 태국(THB) 모두 포함
- **테스트 필수**: `test-2025-procedures.js`로 검색 가능성 검증

### 3. Function Calling 사용 원칙
- **사용해야 하는 경우**: 예약 요청, 상담원 연결, 예약 확정
- **사용하면 안 되는 경우**: 일반 정보 질문, 인사, 감사 표현

### 4. 에러 처리
- 모든 함수에서 try-catch 블록 사용
- 사용자 친화적인 에러 메시지 제공
- 상세한 로깅으로 디버깅 지원

### 5. 성능 최적화
- 캐싱을 통한 데이터베이스 조회 최소화
- 불필요한 API 호출 방지
- 비동기 처리 최적화

## 🤝 기여하기

1. 이슈 리포트 생성
2. 기능 브랜치 생성
3. 코드 수정 및 테스트
4. Pull Request 생성

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.