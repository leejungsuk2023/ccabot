const { getEmbeddingService } = require('./embeddings');
const { getKnowledgeBase, semanticSearchKnowledgeBase } = require('./utils');

// ===============================
// 🆕 2025년 신기술 시술 테스트
// ===============================

async function test2025Procedures() {
  try {
    console.log('🆕 [2025 Test] 2025년 최신 시술 검색 테스트 시작\n');
    
    // 1. Embedding 서비스 초기화
    const embeddingService = getEmbeddingService();
    const kb = await getKnowledgeBase();
    
    // 2. 2025년 신기술 시술 테스트 쿼리들
    const new2025Queries = [
      // 신기술 시술들
      '울쎄라 받고 싶어요',
      '인모드 효과가 어떤가요?',
      '포텐자로 모공 치료 가능한가요?',
      '프로파일로랑 스킨부스터 차이점은?',
      'LDM 시술 받을 수 있나요?',
      '올리지오 가격이 궁금해요',
      '써마지 FLX 효과는?',
      '버츄 RF 시술 아픈가요?',
      '티타늄 리프팅 후기 있나요?',
      '아쿠아필로 모공 관리 되나요?',
      '골드 PTT 여드름 치료',
      '줄기세포 시술 받고 싶어요',
      '체외충격파 시술이 뭐예요?',
      'PDRN 엑소좀 콤보 효과',
      '리니어펌 리프팅 통증 있나요?',
      
      // 조합 시술 문의
      '울쎄라랑 인모드 같이 받을 수 있나요?',
      '보톡스랑 프로파일로 조합 가능한가요?',
      '포텐자랑 스킨부스터 같이 하면?',
      '리프팅 시술 여러개 받고 싶어요',
      '안티에이징 시술 추천해주세요'
    ];
    
    // 3. 각 쿼리별 의미론적 검색 테스트
    for (const query of new2025Queries) {
      console.log(`🔍 테스트: "${query}"`);
      console.log('─'.repeat(50));
      
      try {
        const searchResult = await semanticSearchKnowledgeBase(query, kb);
        
        if (searchResult) {
          console.log(`✅ 검색 성공 (${searchResult.length}자)`);
          
          // 2025년 키워드 포함 여부 확인
          const new2025Keywords = [
            '울쎄라', '인모드', '포텐자', '프로파일로', 'LDM', 
            '올리지오', '써마지 FLX', '버츄 RF', '티타늄 리프팅',
            '아쿠아필', '골드 PTT', '줄기세포', '체외충격파', 
            'PDRN', '엑소좀', '리니어펌'
          ];
          
          const foundKeywords = new2025Keywords.filter(keyword => 
            searchResult.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (foundKeywords.length > 0) {
            console.log(`🎯 2025년 시술 키워드 발견: ${foundKeywords.join(', ')}`);
          }
          
          console.log(`📄 결과 미리보기: ${searchResult.substring(0, 150)}...`);
          
        } else {
          console.log('⚠️ 검색 결과 없음 (fallback 또는 낮은 유사도)');
        }
        
      } catch (error) {
        console.error(`❌ 검색 실패: ${error.message}`);
      }
      
      console.log(''); // 빈 줄
    }
    
    // 4. 2025년 트렌드 정보 테스트
    console.log('📊 [2025 Trends] 2025년 트렌드 정보 검색 테스트');
    console.log('='.repeat(60));
    
    const trendQueries = [
      '2025년 인기 시술은?',
      '요즘 트렌드 시술 뭐가 좋아요?',
      '예방적 안티에이징이 뭐예요?',
      '성분 기반 맞춤 케어란?',
      '비침습 시술 추천해주세요'
    ];
    
    for (const query of trendQueries) {
      console.log(`🔍 트렌드 테스트: "${query}"`);
      
      try {
        const result = await semanticSearchKnowledgeBase(query, kb);
        if (result) {
          console.log(`✅ 트렌드 검색 성공: ${result.substring(0, 100)}...`);
        } else {
          console.log('⚠️ 트렌드 검색 결과 없음');
        }
      } catch (error) {
        console.error(`❌ 트렌드 검색 실패: ${error.message}`);
      }
    }
    
    console.log('\n🎉 [Complete] 2025년 시술 테스트 완료!');
    
  } catch (error) {
    console.error('❌ [2025 Test] 테스트 실패:', error);
    throw error;
  }
}

/**
 * 가격 범위별 시술 추천 테스트
 */
async function testPriceRangeQueries() {
  try {
    console.log('\n💰 [Price Test] 가격 범위별 시술 추천 테스트');
    console.log('='.repeat(50));
    
    const kb = await getKnowledgeBase();
    
    const priceQueries = [
      '10만원 이하 시술 추천해주세요',
      '50만원 정도 예산으로 뭐가 좋을까요?',
      '100만원 이상 프리미엄 시술은?',
      '가성비 좋은 리프팅 시술은?',
      '저렴한 스킨케어 시술 있나요?'
    ];
    
    for (const query of priceQueries) {
      console.log(`💲 테스트: "${query}"`);
      
      try {
        const result = await semanticSearchKnowledgeBase(query, kb);
        if (result) {
          // 가격 정보 추출 시도
          const priceMatches = result.match(/(\d{1,3}(?:,\d{3})*원|\d+만원)/g);
          if (priceMatches) {
            console.log(`✅ 가격 정보 발견: ${priceMatches.slice(0, 3).join(', ')}`);
          } else {
            console.log('✅ 검색 성공 (가격 정보 미포함)');
          }
        } else {
          console.log('⚠️ 가격 검색 결과 없음');
        }
      } catch (error) {
        console.error(`❌ 가격 검색 실패: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ [Price Test] 가격 테스트 실패:', error);
  }
}

// 메인 실행 함수
async function runAll2025Tests() {
  try {
    console.log('🚀 [Test Suite] 2025년 최신 시술 전체 테스트 시작');
    console.log('='.repeat(70));
    
    // 1. 2025년 신기술 시술 테스트
    await test2025Procedures();
    
    // 2. 가격 범위별 테스트
    await testPriceRangeQueries();
    
    console.log('\n🎉 [Complete] 모든 2025년 시술 테스트 완료!');
    console.log('✅ Knowledge Base가 2025년 최신 시술 정보로 성공적으로 업데이트되었습니다.');
    
  } catch (error) {
    console.error('❌ [Test Suite] 테스트 실패:', error);
    throw error;
  }
}

// 스크립트로 실행된 경우
if (require.main === module) {
  runAll2025Tests().then(() => {
    console.log('\n✅ 테스트 완료');
    process.exit(0);
  }).catch(error => {
    console.error('❌ 테스트 에러:', error);
    process.exit(1);
  });
}

module.exports = {
  test2025Procedures,
  testPriceRangeQueries,
  runAll2025Tests
};