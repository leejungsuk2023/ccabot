// 의미론적 검색 시스템 테스트 스크립트
const { getEmbeddingService } = require('./embeddings');
const { getKnowledgeBase, semanticSearchKnowledgeBase } = require('./utils');

async function testSemanticSearch() {
  try {
    console.log('🧪 [Test] 의미론적 검색 시스템 테스트 시작');
    
    // 1. Embedding 서비스 초기화 테스트
    console.log('\n1️⃣ Embedding 서비스 초기화 테스트');
    const embeddingService = getEmbeddingService();
    console.log('✅ Embedding 서비스 초기화 성공');
    
    // 2. 단순 임베딩 테스트
    console.log('\n2️⃣ 단순 임베딩 테스트');
    const testText = '보톡스 시술 가격';
    const embedding = await embeddingService.getEmbedding(testText);
    if (embedding && embedding.length > 0) {
      console.log(`✅ 임베딩 생성 성공: 차원 ${embedding.length}`);
    } else {
      console.log('❌ 임베딩 생성 실패');
    }
    
    // 3. 지식베이스 로드 테스트
    console.log('\n3️⃣ 지식베이스 로드 테스트');
    const knowledgeBase = await getKnowledgeBase();
    console.log('✅ 지식베이스 로드 성공');
    console.log('  - 프로모션 정보:', knowledgeBase.promotionsInfo ? '✅' : '❌');
    console.log('  - 가격 정보:', knowledgeBase.pricingInfo ? '✅' : '❌');
    console.log('  - FAQ 정보:', knowledgeBase.faqsInfo ? '✅' : '❌');
    console.log('  - 클리닉 정보:', knowledgeBase.clinicInfo ? '✅' : '❌');
    
    // 4. 의미론적 검색 테스트
    console.log('\n4️⃣ 의미론적 검색 테스트');
    
    const testQueries = [
      '보톡스하고 같이 인모드도 하려 하는데요',  // 핵심 테스트 케이스
      '턱살 빼고 싶어요',
      'HIFU 시술 받고 싶어요',
      '가격이 궁금해요',
      '예약하고 싶어요'
    ];
    
    for (const query of testQueries) {
      console.log(`\n🔍 테스트 쿼리: "${query}"`);
      try {
        const result = await semanticSearchKnowledgeBase(query, knowledgeBase);
        if (result) {
          console.log(`✅ 검색 성공 (길이: ${result.length}자)`);
          console.log(`📄 결과 샘플: ${result.substring(0, 200)}...`);
        } else {
          console.log('⚠️ 검색 결과 없음 (fallback 또는 낮은 유사도)');
        }
      } catch (error) {
        console.error(`❌ 검색 실패: ${error.message}`);
      }
    }
    
    console.log('\n🎉 [Test] 의미론적 검색 시스템 테스트 완료!');
    
  } catch (error) {
    console.error('❌ [Test] 테스트 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  testSemanticSearch().then(() => {
    console.log('✅ 테스트 완료');
    process.exit(0);
  }).catch(error => {
    console.error('❌ 테스트 에러:', error);
    process.exit(1);
  });
}

module.exports = { testSemanticSearch };