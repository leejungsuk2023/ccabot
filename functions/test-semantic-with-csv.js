// CSV 데이터를 직접 로드하여 의미론적 검색 테스트
const fs = require('fs');
const { parse: csvParse } = require('csv-parse');
const { getEmbeddingService } = require('./embeddings');

async function testSemanticSearchWithCSV() {
  try {
    console.log('🧪 [Test] CSV 기반 의미론적 검색 테스트 시작\n');
    
    // 1. Embedding 서비스 초기화
    const embeddingService = getEmbeddingService();
    
    // 2. CSV 파일 읽기
    console.log('📖 CSV 파일 로딩 중...');
    const [products, faqs, promotions] = await Promise.all([
      readCSV('products.csv'),
      readCSV('faqs.csv'), 
      readCSV('promotions.csv')
    ]);
    
    console.log(`✅ 데이터 로드 완료:`);
    console.log(`  - 시술 정보: ${products.length}개`);
    console.log(`  - FAQ: ${faqs.length}개`);
    console.log(`  - 프로모션: ${promotions.length}개\n`);
    
    // 3. 테스트 데이터 준비 (각 카테고리에서 대표적인 항목들)
    const searchCandidates = [
      ...products.map(p => `시술: ${p.name} - ${p.description} (가격: ${p.price_krw}원)`),
      ...faqs.map(f => `FAQ: ${f.question} - ${f.answer}`),
      ...promotions.map(pr => `프로모션: ${pr.title} - ${pr.description}`)
    ];
    
    console.log(`🔍 검색 대상: ${searchCandidates.length}개 항목\n`);
    
    // 4. 핵심 테스트 케이스들
    const testQueries = [
      '보톡스하고 같이 인모드도 하려 하는데요',  // 핵심 문제 케이스
      '턱살 빼고 싶어요',
      '리프팅 받고 싶어요', 
      '가격이 궁금해요',
      '할인 있나요',
      'HIFU 시술 받을 수 있나요'
    ];
    
    // 5. 각 쿼리별 의미론적 검색 테스트
    for (const query of testQueries) {
      console.log(`🔍 테스트: "${query}"`);
      console.log('─'.repeat(50));
      
      try {
        const results = await embeddingService.findMostSimilar(
          query, 
          searchCandidates, 
          0.5  // 낮은 임계값으로 더 많은 결과 확인
        );
        
        if (results.length > 0) {
          console.log(`✅ ${results.length}개 유사 항목 발견:`);
          results.slice(0, 3).forEach((result, index) => {
            console.log(`  ${index + 1}. [${result.percentage}] ${result.text.substring(0, 100)}...`);
          });
        } else {
          console.log('❌ 유사한 항목을 찾지 못했습니다.');
        }
        
      } catch (error) {
        console.error(`❌ 검색 실패: ${error.message}`);
      }
      
      console.log('');  // 빈 줄
    }
    
    // 6. 특별 테스트: 보톡스+인모드 조합 검색
    console.log('🎯 특별 테스트: 보톡스+인모드 조합 검색');
    console.log('='.repeat(50));
    
    const botoxItems = searchCandidates.filter(item => 
      item.toLowerCase().includes('보톡스') || item.toLowerCase().includes('botox')
    );
    const inmodeItems = searchCandidates.filter(item => 
      item.toLowerCase().includes('인모드') || item.toLowerCase().includes('inmode')
    );
    
    console.log(`📊 보톡스 관련: ${botoxItems.length}개`);
    console.log(`📊 인모드 관련: ${inmodeItems.length}개`);
    
    botoxItems.forEach(item => console.log(`  🔸 ${item.substring(0, 80)}...`));
    inmodeItems.forEach(item => console.log(`  🔸 ${item.substring(0, 80)}...`));
    
    console.log('\n🎉 테스트 완료!');
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

// CSV 파일 읽기 헬퍼 함수
function readCSV(filename) {
  return new Promise((resolve, reject) => {
    const results = [];
    const filePath = `${__dirname}/${filename}`;
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ ${filename} 파일을 찾을 수 없습니다.`);
      resolve([]);
      return;
    }
    
    fs.createReadStream(filePath, { encoding: 'utf8' })
      .pipe(csvParse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true
      }))
      .on('data', (data) => {
        if (Object.values(data).some(value => value && value.trim())) {
          results.push(data);
        }
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// 스크립트 실행
if (require.main === module) {
  testSemanticSearchWithCSV().then(() => {
    console.log('✅ 테스트 완료');
    process.exit(0);
  }).catch(error => {
    console.error('❌ 테스트 에러:', error);
    process.exit(1);
  });
}

module.exports = { testSemanticSearchWithCSV };