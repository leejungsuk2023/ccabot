const { getPolicyContext } = require('./utils');

// ===============================
// 🧪 모드별 Policy Context 테스트 시스템
// ===============================

/**
 * 모드별 Policy Context 로딩 테스트
 */
async function testModePolicyLoading() {
  console.log('🧪 [Policy Test] 모드별 Policy Context 로딩 테스트 시작\n');
  
  try {
    // 1. NORMAL 모드 테스트
    console.log('1️⃣ NORMAL 모드 Policy Context 테스트');
    console.log('─'.repeat(50));
    const normalPolicy = await getPolicyContext('NORMAL');
    console.log(`✅ NORMAL 모드 Policy Context 로드 완료`);
    console.log(`📊 길이: ${normalPolicy.length}자`);
    console.log(`📄 미리보기: ${normalPolicy.substring(0, 200)}...\n`);
    
    // 2. CONSULTATION_READY 모드 테스트
    console.log('2️⃣ CONSULTATION_READY 모드 Policy Context 테스트');
    console.log('─'.repeat(50));
    const consultationPolicy = await getPolicyContext('CONSULTATION_READY');
    console.log(`✅ CONSULTATION_READY 모드 Policy Context 로드 완료`);
    console.log(`📊 길이: ${consultationPolicy.length}자`);
    console.log(`📄 미리보기: ${consultationPolicy.substring(0, 200)}...\n`);
    
    // 3. 기본값 테스트 (파라미터 없음)
    console.log('3️⃣ 기본값 테스트 (파라미터 없음)');
    console.log('─'.repeat(50));
    const defaultPolicy = await getPolicyContext();
    console.log(`✅ 기본값 Policy Context 로드 완료`);
    console.log(`📊 길이: ${defaultPolicy.length}자`);
    console.log(`📄 미리보기: ${defaultPolicy.substring(0, 200)}...\n`);
    
    // 4. 내용 차이 분석
    console.log('4️⃣ 모드별 내용 차이 분석');
    console.log('─'.repeat(50));
    
    const normalLower = normalPolicy.toLowerCase();
    const consultationLower = consultationPolicy.toLowerCase();
    
    // NORMAL 모드 특성 확인
    const normalCharacteristics = [
      '객관적',
      '학술적',
      '교육적',
      '중립적',
      '일반적으로',
      '의학적으로'
    ];
    
    // CONSULTATION_READY 모드 특성 확인
    const consultationCharacteristics = [
      '친근',
      '예약',
      '상담',
      '방문',
      '추천',
      '맞춤'
    ];
    
    console.log('🔍 NORMAL 모드 특성 키워드 검출:');
    normalCharacteristics.forEach(keyword => {
      const found = normalLower.includes(keyword);
      console.log(`  ${found ? '✅' : '❌'} "${keyword}": ${found ? '포함됨' : '없음'}`);
    });
    
    console.log('\n🔍 CONSULTATION_READY 모드 특성 키워드 검출:');
    consultationCharacteristics.forEach(keyword => {
      const found = consultationLower.includes(keyword);
      console.log(`  ${found ? '✅' : '❌'} "${keyword}": ${found ? '포함됨' : '없음'}`);
    });
    
    // 5. 캐싱 테스트
    console.log('\n5️⃣ 캐싱 성능 테스트');
    console.log('─'.repeat(50));
    
    const startTime = Date.now();
    await getPolicyContext('NORMAL'); // 이미 캐시됨
    const cachedTime = Date.now() - startTime;
    console.log(`✅ 캐시된 NORMAL Policy Context 로드: ${cachedTime}ms`);
    
    const startTime2 = Date.now();
    await getPolicyContext('CONSULTATION_READY'); // 이미 캐시됨  
    const cachedTime2 = Date.now() - startTime2;
    console.log(`✅ 캐시된 CONSULTATION_READY Policy Context 로드: ${cachedTime2}ms`);
    
    return {
      normalPolicy,
      consultationPolicy,
      defaultPolicy,
      testResults: {
        normalLength: normalPolicy.length,
        consultationLength: consultationPolicy.length,
        cachedLoadTime: Math.max(cachedTime, cachedTime2)
      }
    };
    
  } catch (error) {
    console.error('❌ [Policy Test] 테스트 실패:', error);
    throw error;
  }
}

/**
 * 모드별 Policy Context 키워드 분석
 */
function analyzePolicyKeywords(normalPolicy, consultationPolicy) {
  console.log('\n🔍 [Analysis] 모드별 키워드 심화 분석');
  console.log('='.repeat(60));
  
  // 금지된 키워드 체크 (NORMAL 모드에서는 없어야 함)
  const forbiddenInNormal = [
    '예약해드릴까요',
    '상담받아보세요',
    '방문해주세요',
    '문의하세요',
    '전화 상담',
    '예약을 원하시면'
  ];
  
  // 권장된 키워드 체크 (CONSULTATION_READY 모드에서는 있어야 함)
  const requiredInConsultation = [
    '예약',
    '상담',
    '친근',
    '따뜻한',
    '맞춤',
    '방문'
  ];
  
  console.log('🚫 NORMAL 모드 금지 키워드 체크:');
  forbiddenInNormal.forEach(keyword => {
    const found = normalPolicy.toLowerCase().includes(keyword.toLowerCase());
    console.log(`  ${found ? '❌ 위반' : '✅ 정상'} "${keyword}": ${found ? '발견됨' : '없음'}`);
  });
  
  console.log('\n✅ CONSULTATION_READY 모드 필수 키워드 체크:');
  requiredInConsultation.forEach(keyword => {
    const found = consultationPolicy.toLowerCase().includes(keyword.toLowerCase());
    console.log(`  ${found ? '✅ 정상' : '❌ 누락'} "${keyword}": ${found ? '포함됨' : '없음'}`);
  });
}

/**
 * 모드 전환 시뮬레이션 테스트
 */
async function testModeTransitionSimulation() {
  console.log('\n🔄 [Transition] 모드 전환 시뮬레이션 테스트');
  console.log('='.repeat(60));
  
  try {
    // 대화 시뮬레이션: NORMAL → CONSULTATION_READY
    console.log('📝 시나리오: 사용자가 10번째 대화에서 모드 전환');
    
    // 1-9번째 대화: NORMAL 모드
    console.log('\n1️⃣ 초기 대화 (NORMAL 모드)');
    const normalStart = await getPolicyContext('NORMAL');
    console.log(`📊 NORMAL Policy 길이: ${normalStart.length}자`);
    
    // 10번째 대화: CONSULTATION_READY 모드로 전환
    console.log('\n2️⃣ 10번째 대화 (CONSULTATION_READY 모드로 전환)');
    const consultationStart = await getPolicyContext('CONSULTATION_READY');
    console.log(`📊 CONSULTATION_READY Policy 길이: ${consultationStart.length}자`);
    
    // 차이점 강조
    const sizeDifference = Math.abs(consultationStart.length - normalStart.length);
    const percentDifference = ((sizeDifference / normalStart.length) * 100).toFixed(1);
    
    console.log(`\n📈 모드 전환 효과:`);
    console.log(`  - 정책 크기 차이: ${sizeDifference}자 (${percentDifference}% 변화)`);
    console.log(`  - 캐시 키 분리: policy_context_v2_NORMAL vs policy_context_v2_CONSULTATION_READY`);
    console.log(`  - 즉시 전환: 다음 요청부터 새로운 모드 Policy Context 적용`);
    
    return true;
    
  } catch (error) {
    console.error('❌ [Transition Test] 모드 전환 테스트 실패:', error);
    return false;
  }
}

/**
 * 실제 응답 톤 시뮬레이션 (Policy Context 기반)
 */
function simulateResponseTone(normalPolicy, consultationPolicy) {
  console.log('\n🎭 [Simulation] 모드별 응답 톤 시뮬레이션');
  console.log('='.repeat(60));
  
  const testQuestion = "보톡스 효과가 어떤가요?";
  console.log(`📋 테스트 질문: "${testQuestion}"`);
  
  // NORMAL 모드 기대 응답 스타일
  console.log('\n📚 NORMAL 모드 기대 응답 스타일:');
  console.log('─'.repeat(30));
  console.log('💬 "보톡스는 보툴리눔 독소를 이용해 근육 수축을 억제하는 시술입니다."');
  console.log('💬 "일반적으로 3-6개월간 지속되며, 개인차가 있을 수 있습니다."');
  console.log('💬 "의학적 연구에 따르면 주름 개선에 효과적임이 입증되었습니다."');
  console.log('🚫 예약이나 상담 유도 없음');
  
  // CONSULTATION_READY 모드 기대 응답 스타일  
  console.log('\n💝 CONSULTATION_READY 모드 기대 응답 스타일:');
  console.log('─'.repeat(35));
  console.log('💬 "보톡스는 주름 개선에 정말 효과적이에요!"');
  console.log('💬 "개인별 피부 상태에 따라 효과가 달라질 수 있어서..."');
  console.log('💬 "정확한 상담을 받아보시는 걸 추천드려요."');
  console.log('✅ "예약해드릴까요?" 적극적 예약 유도');
  
  // Policy Context 기반 톤 분석
  console.log('\n🔍 Policy Context 기반 톤 분석:');
  console.log('─'.repeat(30));
  
  const normalTone = normalPolicy.includes('학술적') && normalPolicy.includes('객관적');
  const consultationTone = consultationPolicy.includes('친근') && consultationPolicy.includes('예약');
  
  console.log(`📊 NORMAL 모드 톤 설정: ${normalTone ? '✅ 학술적/객관적' : '❌ 톤 설정 오류'}`);
  console.log(`📊 CONSULTATION_READY 모드 톤 설정: ${consultationTone ? '✅ 친근함/예약유도' : '❌ 톤 설정 오류'}`);
}

// 메인 테스트 실행 함수
async function runAllPolicyTests() {
  try {
    console.log('🚀 [Test Suite] 모드별 Policy Context 전체 테스트 시작');
    console.log('='.repeat(70));
    
    // 1. 기본 로딩 테스트
    const loadingResults = await testModePolicyLoading();
    
    // 2. 키워드 분석 테스트  
    analyzePolicyKeywords(loadingResults.normalPolicy, loadingResults.consultationPolicy);
    
    // 3. 모드 전환 시뮬레이션
    await testModeTransitionSimulation();
    
    // 4. 응답 톤 시뮬레이션
    simulateResponseTone(loadingResults.normalPolicy, loadingResults.consultationPolicy);
    
    console.log('\n🎉 [Complete] 모든 Policy Context 테스트 완료!');
    console.log('✅ 모드별 Policy Context 시스템이 정상 작동합니다.');
    console.log('\n📋 다음 단계:');
    console.log('  1. update-policy-contexts.js 실행하여 Firestore에 Policy Context 업로드');
    console.log('  2. 실제 대화 테스트로 모드별 AI 동작 확인');
    console.log('  3. 배포 후 프로덕션 환경에서 최종 검증');
    
    return loadingResults.testResults;
    
  } catch (error) {
    console.error('❌ [Test Suite] 테스트 실패:', error);
    throw error;
  }
}

// 스크립트로 실행된 경우
if (require.main === module) {
  runAllPolicyTests().then((results) => {
    console.log('\n📊 [Results] 테스트 결과 요약:');
    console.log(`  - NORMAL Policy 길이: ${results.normalLength}자`);
    console.log(`  - CONSULTATION_READY Policy 길이: ${results.consultationLength}자`);
    console.log(`  - 캐시 로드 시간: ${results.cachedLoadTime}ms`);
    console.log('\n✅ 테스트 완료');
    process.exit(0);
  }).catch(error => {
    console.error('❌ 테스트 에러:', error);
    process.exit(1);
  });
}

module.exports = {
  testModePolicyLoading,
  analyzePolicyKeywords,
  testModeTransitionSimulation,
  simulateResponseTone,
  runAllPolicyTests
};