const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_API_KEY } = require('./config');

// ===============================
// 🔤 Google Embeddings 서비스
// ===============================

class GoogleEmbeddingService {
  constructor() {
    if (!GEMINI_API_KEY) {
      console.error('❌ [Embeddings] GEMINI_API_KEY가 설정되지 않았습니다.');
      throw new Error('GEMINI_API_KEY is required for embeddings');
    }
    
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: "text-embedding-004" 
    });
    
    console.log('✅ [Embeddings] Google Embedding Service 초기화 완료');
  }

  /**
   * 단일 텍스트를 벡터로 변환
   * @param {string} text - 변환할 텍스트
   * @returns {Promise<number[]|null>} - 임베딩 벡터 또는 null
   */
  async getEmbedding(text) {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        console.warn('⚠️ [Embeddings] 빈 텍스트는 임베딩할 수 없습니다.');
        return null;
      }

      // 텍스트 전처리 (최대 2048자로 제한)
      const processedText = text.trim().substring(0, 2048);
      
      const result = await this.model.embedContent(processedText);
      
      if (result.embedding && result.embedding.values) {
        console.log(`✅ [Embeddings] 텍스트 임베딩 성공 (차원: ${result.embedding.values.length})`);
        return result.embedding.values;
      } else {
        console.warn('⚠️ [Embeddings] 임베딩 결과가 비정상적입니다.');
        return null;
      }
    } catch (error) {
      console.error('❌ [Embeddings] 임베딩 생성 실패:', error.message);
      
      // API 제한 에러 처리
      if (error.message && error.message.includes('quota')) {
        console.error('❌ [Embeddings] API 할당량 초과. 잠시 후 다시 시도하세요.');
      }
      
      return null;
    }
  }

  /**
   * 여러 텍스트를 배치로 벡터 변환
   * @param {string[]} texts - 변환할 텍스트 배열
   * @returns {Promise<(number[]|null)[]>} - 임베딩 벡터 배열
   */
  async getBatchEmbeddings(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
      console.warn('⚠️ [Embeddings] 빈 배열은 처리할 수 없습니다.');
      return [];
    }

    console.log(`📊 [Embeddings] ${texts.length}개 텍스트 배치 처리 시작`);
    
    // API 호출 제한을 위해 순차 처리 (병렬 처리 시 rate limit 문제)
    const embeddings = [];
    for (let i = 0; i < texts.length; i++) {
      const embedding = await this.getEmbedding(texts[i]);
      embeddings.push(embedding);
      
      // Rate limiting 방지 (100ms 딜레이)
      if (i < texts.length - 1) {
        await this.delay(100);
      }
      
      // 진행 상황 로깅
      if ((i + 1) % 10 === 0) {
        console.log(`  📝 [Embeddings] 진행: ${i + 1}/${texts.length}`);
      }
    }
    
    const validEmbeddings = embeddings.filter(emb => emb !== null);
    console.log(`✅ [Embeddings] 배치 처리 완료: ${validEmbeddings.length}/${texts.length} 성공`);
    
    return embeddings;
  }

  /**
   * 코사인 유사도 계산
   * @param {number[]} vecA - 첫 번째 벡터
   * @param {number[]} vecB - 두 번째 벡터
   * @returns {number} - 코사인 유사도 (0~1)
   */
  calculateCosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      console.warn('⚠️ [Embeddings] 벡터 차원이 일치하지 않습니다.');
      return 0;
    }

    try {
      const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
      const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
      const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
      
      if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
      }
      
      const similarity = dotProduct / (magnitudeA * magnitudeB);
      
      // 결과를 0~1 범위로 정규화
      return Math.max(0, Math.min(1, similarity));
    } catch (error) {
      console.error('❌ [Embeddings] 유사도 계산 실패:', error);
      return 0;
    }
  }

  /**
   * 유사도 점수를 백분율로 변환
   * @param {number} similarity - 코사인 유사도
   * @returns {string} - 백분율 문자열
   */
  similarityToPercentage(similarity) {
    return `${(similarity * 100).toFixed(1)}%`;
  }

  /**
   * 딜레이 함수 (Rate limiting 방지)
   * @param {number} ms - 밀리초
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 텍스트 전처리 (임베딩 전 정제)
   * @param {string} text - 원본 텍스트
   * @returns {string} - 정제된 텍스트
   */
  preprocessText(text) {
    if (!text) return '';
    
    // 불필요한 공백 제거
    let processed = text.trim();
    
    // 연속된 공백을 하나로
    processed = processed.replace(/\s+/g, ' ');
    
    // 특수문자 정규화
    processed = processed.replace(/[""]/g, '"');
    processed = processed.replace(/['']/g, "'");
    
    // 이모지 제거 (선택적)
    // processed = processed.replace(/[\u{1F600}-\u{1F64F}]/gu, '');
    
    return processed;
  }

  /**
   * 여러 텍스트 중 가장 유사한 항목 찾기
   * @param {string} query - 검색 쿼리
   * @param {string[]} candidates - 후보 텍스트 배열
   * @param {number} threshold - 최소 유사도 임계값
   * @returns {Promise<{text: string, similarity: number}[]>} - 유사도 순 결과
   */
  async findMostSimilar(query, candidates, threshold = 0.7) {
    if (!query || !candidates || candidates.length === 0) {
      return [];
    }

    console.log(`🔍 [Embeddings] "${query}"와 유사한 항목 검색 (후보: ${candidates.length}개)`);

    // 쿼리 임베딩
    const queryEmbedding = await this.getEmbedding(query);
    if (!queryEmbedding) {
      console.error('❌ [Embeddings] 쿼리 임베딩 실패');
      return [];
    }

    // 후보 임베딩
    const candidateEmbeddings = await this.getBatchEmbeddings(candidates);
    
    // 유사도 계산
    const results = [];
    for (let i = 0; i < candidates.length; i++) {
      const embedding = candidateEmbeddings[i];
      if (embedding) {
        const similarity = this.calculateCosineSimilarity(queryEmbedding, embedding);
        if (similarity >= threshold) {
          results.push({
            text: candidates[i],
            similarity: similarity,
            percentage: this.similarityToPercentage(similarity)
          });
        }
      }
    }

    // 유사도 순으로 정렬
    results.sort((a, b) => b.similarity - a.similarity);
    
    console.log(`✅ [Embeddings] ${results.length}개 유사 항목 발견 (임계값: ${threshold})`);
    if (results.length > 0) {
      console.log(`  🥇 최고 유사도: ${results[0].percentage}`);
    }

    return results;
  }
}

// 싱글톤 인스턴스 생성
let embeddingServiceInstance = null;

/**
 * Embedding 서비스 싱글톤 인스턴스 반환
 * @returns {GoogleEmbeddingService}
 */
function getEmbeddingService() {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new GoogleEmbeddingService();
  }
  return embeddingServiceInstance;
}

module.exports = { 
  GoogleEmbeddingService,
  getEmbeddingService
};