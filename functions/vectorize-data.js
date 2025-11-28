const fs = require('fs');
const path = require('path');
const { parse: csvParse } = require('csv-parse');
const { getEmbeddingService } = require('./embeddings');
const { db, admin } = require('./config');

// ===============================
// 📊 데이터 벡터화 시스템
// ===============================

class DataVectorizer {
  constructor() {
    this.embeddingService = getEmbeddingService();
  }

  /**
   * 모든 CSV 파일을 벡터화하여 Firestore에 저장
   */
  async vectorizeCSVFiles() {
    const csvFiles = [
      'clinic_info.csv',
      'faqs.csv',
      'products.csv',
      'products_2025.csv',  // 새로운 2025년 시술 정보
      'promotions.csv',
      'reviews.csv'
    ];

    console.log('📊 [Vectorize] CSV 파일 벡터화 시작');
    console.log(`📁 처리할 파일: ${csvFiles.length}개`);

    for (const filename of csvFiles) {
      try {
        console.log(`\n🔄 [Vectorize] ${filename} 처리 중...`);
        
        // CSV 파일 존재 확인
        const filePath = path.join(__dirname, filename);
        if (!fs.existsSync(filePath)) {
          console.warn(`⚠️ [Vectorize] ${filename} 파일을 찾을 수 없습니다.`);
          continue;
        }
        
        // CSV 파일 읽기
        const csvData = await this.readCSVFile(filename);
        if (csvData.length === 0) {
          console.warn(`⚠️ [Vectorize] ${filename} 파일이 비어있습니다.`);
          continue;
        }
        
        // 텍스트 추출 및 벡터화
        const vectorData = await this.processCSVData(csvData, filename);
        if (vectorData.length === 0) {
          console.warn(`⚠️ [Vectorize] ${filename} 벡터화 결과가 없습니다.`);
          continue;
        }
        
        // Firestore에 저장
        await this.saveToFirestore(vectorData, filename);
        
        console.log(`✅ [Vectorize] ${filename} 완료 (${vectorData.length}개 벡터)`);
        
        // 파일 간 딜레이 (API 제한 방지)
        await this.delay(1000);
        
      } catch (error) {
        console.error(`❌ [Vectorize] ${filename} 실패:`, error.message);
      }
    }
    
    console.log('\n🎉 [Vectorize] 모든 파일 처리 완료!');
  }

  /**
   * CSV 파일을 읽어서 객체 배열로 반환
   * @param {string} filename - CSV 파일명
   * @returns {Promise<Object[]>} - 파싱된 데이터 배열
   */
  async readCSVFile(filename) {
    return new Promise((resolve, reject) => {
      const results = [];
      const filePath = path.join(__dirname, filename);
      
      console.log(`  📖 [${filename}] 파일 읽기 중...`);
      
      fs.createReadStream(filePath, { encoding: 'utf8' })
        .pipe(csvParse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          bom: true  // UTF-8 BOM 제거
        }))
        .on('data', (data) => {
          // 빈 행 필터링
          if (Object.values(data).some(value => value && value.trim())) {
            results.push(data);
          }
        })
        .on('end', () => {
          console.log(`  ✅ [${filename}] 읽기 완료: ${results.length}개 행`);
          resolve(results);
        })
        .on('error', (error) => {
          console.error(`  ❌ [${filename}] 읽기 실패:`, error);
          reject(error);
        });
    });
  }

  /**
   * CSV 데이터를 처리하여 벡터화
   * @param {Object[]} csvData - CSV 데이터 배열
   * @param {string} filename - 파일명 (소스 표시용)
   * @returns {Promise<Object[]>} - 벡터화된 데이터 배열
   */
  async processCSVData(csvData, filename) {
    const vectorData = [];
    const fileType = filename.replace('.csv', '');
    
    console.log(`  📝 [${filename}] ${csvData.length}개 행 벡터화 시작`);
    
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      
      try {
        // 행 데이터를 의미있는 텍스트로 변환
        const textContent = this.rowToText(row, fileType);
        
        if (!textContent || textContent.trim().length < 10) {
          console.log(`    ⚠️ [${i + 1}/${csvData.length}] 텍스트가 너무 짧아 건너뜀`);
          continue;
        }
        
        console.log(`    🔤 [${i + 1}/${csvData.length}] 벡터화 중... (${textContent.length}자)`);
        
        // 임베딩 생성
        const embedding = await this.embeddingService.getEmbedding(textContent);
        if (embedding) {
          vectorData.push({
            id: `${fileType}_${i + 1}`,
            content: textContent,
            embedding: embedding,
            source: fileType,
            metadata: {
              ...row,
              originalIndex: i,
              processedAt: admin.firestore.Timestamp.now()
            }
          });
        } else {
          console.log(`    ❌ [${i + 1}/${csvData.length}] 임베딩 생성 실패`);
        }
        
        // API 제한 방지를 위한 딜레이
        if (i < csvData.length - 1) {
          await this.delay(200);
        }
        
      } catch (error) {
        console.error(`    ❌ [${i + 1}/${csvData.length}] 처리 실패:`, error.message);
      }
    }
    
    console.log(`  ✅ [${filename}] 벡터화 완료: ${vectorData.length}/${csvData.length} 성공`);
    return vectorData;
  }

  /**
   * CSV 행 데이터를 의미있는 텍스트로 변환
   * @param {Object} row - CSV 행 데이터
   * @param {string} fileType - 파일 유형
   * @returns {string} - 변환된 텍스트
   */
  rowToText(row, fileType) {
    switch (fileType) {
      case 'products':
        return this.productToText(row);
      case 'promotions':
        return this.promotionToText(row);
      case 'faqs':
        return this.faqToText(row);
      case 'reviews':
        return this.reviewToText(row);
      case 'clinic_info':
        return this.clinicInfoToText(row);
      default:
        // 기본: 모든 값을 공백으로 연결
        return Object.values(row).filter(v => v).join(' ').trim();
    }
  }

  /**
   * 제품 정보를 텍스트로 변환
   */
  productToText(row) {
    const parts = [];
    if (row.name) parts.push(`시술명: ${row.name}`);
    if (row.price_krw) parts.push(`가격: ${row.price_krw}원`);
    if (row.price_thb) parts.push(`태국 가격: ${row.price_thb}바트`);
    if (row.description) parts.push(`설명: ${row.description}`);
    if (row.package_discount_10) parts.push(`패키지 할인: ${(parseFloat(row.package_discount_10) * 100)}%`);
    return parts.join('. ');
  }

  /**
   * 프로모션 정보를 텍스트로 변환
   */
  promotionToText(row) {
    const parts = [];
    if (row.title) parts.push(`프로모션: ${row.title}`);
    if (row.description) parts.push(`내용: ${row.description}`);
    if (row.related_product_id) parts.push(`관련 시술: ${row.related_product_id}`);
    return parts.join('. ');
  }

  /**
   * FAQ를 텍스트로 변환
   */
  faqToText(row) {
    const parts = [];
    if (row.question) parts.push(`질문: ${row.question}`);
    if (row.answer) parts.push(`답변: ${row.answer}`);
    return parts.join('. ');
  }

  /**
   * 리뷰를 텍스트로 변환
   */
  reviewToText(row) {
    const parts = [];
    if (row.content) parts.push(`리뷰: ${row.content}`);
    if (row.rating) parts.push(`평점: ${row.rating}점`);
    if (row.service) parts.push(`시술: ${row.service}`);
    return parts.join('. ');
  }

  /**
   * 클리닉 정보를 텍스트로 변환
   */
  clinicInfoToText(row) {
    const parts = [];
    if (row.info_type) parts.push(`유형: ${row.info_type}`);
    if (row.value) parts.push(`정보: ${row.value}`);
    return parts.join('. ');
  }

  /**
   * 벡터화된 데이터를 Firestore에 저장
   * @param {Object[]} vectorData - 벡터화된 데이터
   * @param {string} filename - 파일명
   */
  async saveToFirestore(vectorData, filename) {
    if (vectorData.length === 0) {
      console.log(`  ⚠️ [${filename}] 저장할 데이터가 없습니다.`);
      return;
    }

    const collectionName = `vectors_${filename.replace('.csv', '')}`;
    console.log(`  💾 [${filename}] Firestore 저장 중... (컬렉션: ${collectionName})`);
    
    try {
      // 기존 데이터 삭제 (선택적)
      await this.clearCollection(collectionName);
      
      // 배치 단위로 저장 (Firestore 500개 제한)
      const batchSize = 100;
      for (let i = 0; i < vectorData.length; i += batchSize) {
        const batch = db.batch();
        const chunk = vectorData.slice(i, i + batchSize);
        
        chunk.forEach((item) => {
          const docRef = db.collection(collectionName).doc(item.id);
          batch.set(docRef, item);
        });
        
        await batch.commit();
        console.log(`    ✅ [${filename}] 배치 ${Math.ceil((i + 1) / batchSize)} 저장 완료 (${chunk.length}개)`);
        
        // 배치 간 딜레이
        if (i + batchSize < vectorData.length) {
          await this.delay(500);
        }
      }
      
      console.log(`  💾 [${filename}] Firestore 저장 완료: ${vectorData.length}개 벡터`);
      
    } catch (error) {
      console.error(`  ❌ [${filename}] Firestore 저장 실패:`, error);
      throw error;
    }
  }

  /**
   * 컬렉션의 모든 문서 삭제
   * @param {string} collectionName - 컬렉션 이름
   */
  async clearCollection(collectionName) {
    try {
      console.log(`    🗑️ [${collectionName}] 기존 데이터 정리 중...`);
      
      const snapshot = await db.collection(collectionName).get();
      if (snapshot.empty) {
        console.log(`    ✅ [${collectionName}] 기존 데이터 없음`);
        return;
      }
      
      // 배치 삭제
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`    🗑️ [${collectionName}] ${snapshot.size}개 기존 문서 삭제 완료`);
      
    } catch (error) {
      console.warn(`    ⚠️ [${collectionName}] 기존 데이터 정리 실패:`, error.message);
    }
  }

  /**
   * 딜레이 함수
   * @param {number} ms - 밀리초
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 저장된 벡터 통계 출력
   */
  async printVectorStats() {
    const collections = [
      'vectors_clinic_info',
      'vectors_faqs',
      'vectors_products',
      'vectors_promotions',
      'vectors_reviews'
    ];

    console.log('\n📊 [Stats] 저장된 벡터 통계:');
    
    for (const collectionName of collections) {
      try {
        const snapshot = await db.collection(collectionName).get();
        console.log(`  📁 ${collectionName}: ${snapshot.size}개 벡터`);
      } catch (error) {
        console.log(`  ❌ ${collectionName}: 조회 실패`);
      }
    }
  }
}

// 메인 실행 함수
async function main() {
  try {
    console.log('🚀 [Vectorizer] 데이터 벡터화 시작');
    console.log('⏰ 예상 소요 시간: 5-10분');
    
    const vectorizer = new DataVectorizer();
    
    // CSV 파일 벡터화
    await vectorizer.vectorizeCSVFiles();
    
    // 통계 출력
    await vectorizer.printVectorStats();
    
    console.log('\n🎉 [Complete] 모든 데이터 벡터화 완료!');
    console.log('✅ 이제 의미론적 검색이 더욱 정확하게 작동합니다.');
    
  } catch (error) {
    console.error('❌ [Error] 벡터화 실패:', error);
    process.exit(1);
  }
}

// 스크립트로 실행된 경우
if (require.main === module) {
  main().then(() => {
    console.log('✅ 프로세스 완료');
    process.exit(0);
  }).catch(error => {
    console.error('❌ 프로세스 에러:', error);
    process.exit(1);
  });
}

module.exports = { DataVectorizer };