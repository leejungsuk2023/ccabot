const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { admin, db } = require('./config');

// CSV 파일을 읽어서 배열로 변환하는 함수
function readCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// Firestore에 데이터를 저장하는 함수
async function updateFirestoreDocument(collection, documentId, data) {
  try {
    console.log(`🔍 [UPDATE] ${collection}/${documentId} 업데이트 시작`);
    console.log(`🔍 [UPDATE] 저장할 데이터:`, JSON.stringify(data, null, 2));
    
    await db.collection(collection).doc(documentId).set({
      content: data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      version: '1.0'
    });
    
    // 저장 후 확인
    const savedDoc = await db.collection(collection).doc(documentId).get();
    console.log(`✅ ${collection}/${documentId} 업데이트 완료`);
    console.log(`🔍 [UPDATE] 저장된 데이터 확인:`, JSON.stringify(savedDoc.data(), null, 2));
  } catch (error) {
    console.error(`❌ ${collection}/${documentId} 업데이트 실패:`, error);
    throw error;
  }
}

// AI 두뇌 업데이트 메인 함수
async function updateAIBrain() {
  console.log('🧠 AI 두뇌 업데이트를 시작합니다...\n');

  try {
    // CSV 파일 경로
    const CSV_FILES = {
      products: path.join(__dirname, 'products.csv'),
      promotions: path.join(__dirname, 'promotions.csv'),
      faqs: path.join(__dirname, 'faqs.csv'),
      clinic_info: path.join(__dirname, 'clinic_info.csv'),
      reviews: path.join(__dirname, 'reviews.csv')
    };

    // 1. products.csv 파일 읽기 및 업데이트
    console.log('📋 1/6: products.csv 파일을 읽어서 knowledge_base/products 업데이트 중...');
    const productsData = await readCSVFile(CSV_FILES.products);
    await updateFirestoreDocument('knowledge_base', 'products', productsData);
    console.log(`   - ${productsData.length}개의 시술 정보 업데이트 완료\n`);

    // 2. promotions.csv 파일 읽기 및 업데이트
    console.log('🎁 2/6: promotions.csv 파일을 읽어서 knowledge_base/promotions 업데이트 중...');
    const promotionsData = await readCSVFile(CSV_FILES.promotions);
    await updateFirestoreDocument('knowledge_base', 'promotions', promotionsData);
    console.log(`   - ${promotionsData.length}개의 프로모션 정보 업데이트 완료\n`);

    // 3. faqs.csv 파일 읽기 및 업데이트
    console.log('❓ 3/6: faqs.csv 파일을 읽어서 knowledge_base/faqs 업데이트 중...');
    const faqsData = await readCSVFile(CSV_FILES.faqs);
    await updateFirestoreDocument('knowledge_base', 'faqs', faqsData);
    console.log(`   - ${faqsData.length}개의 FAQ 정보 업데이트 완료\n`);

    // 4. clinic_info.csv 파일 읽기 및 업데이트
    console.log('🏥 4/6: clinic_info.csv 파일을 읽어서 knowledge_base/clinic_info 업데이트 중...');
    const clinicInfoData = await readCSVFile(CSV_FILES.clinic_info);
    await updateFirestoreDocument('knowledge_base', 'clinic_info', clinicInfoData);
    console.log(`   - ${clinicInfoData.length}개의 병원 정보 업데이트 완료\n`);

    // 5. reviews.csv 파일 읽기 및 업데이트
    console.log('⭐ 5/5: reviews.csv 파일을 읽어서 knowledge_base/reviews 업데이트 중...');
    const reviewsPath = path.join(__dirname, 'reviews.csv');
    if (fs.existsSync(reviewsPath)) {
      const reviewsData = await readCSVFile(reviewsPath);
      await updateFirestoreDocument('knowledge_base', 'reviews', reviewsData);
    } else {
      console.log('⚠️ reviews.csv 파일이 없어 빈 배열로 설정합니다.');
      await updateFirestoreDocument('knowledge_base', 'reviews', []);
    }

    console.log('✅ 모든 AI 지식 베이스 업데이트가 완료되었습니다!');
    console.log('📊 업데이트된 컬렉션: products, promotions, faqs, clinic_info, reviews');
    console.log('🚀 Policy Context는 이제 코드에 하드코딩되어 있어 별도 업데이트가 필요하지 않습니다.');

  } catch (error) {
    console.error('❌ AI 두뇌 업데이트 중 오류 발생:', error);
    throw error;
  }
}

module.exports = {
  updateAIBrain,
  readCSVFile,
  updateFirestoreDocument
};