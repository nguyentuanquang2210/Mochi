/**
 * Cấu trúc dữ liệu từ vựng đa nguồn và đa nghĩa (Multi-Sense Dictionary Types)
 * Hỗ trợ Merriam-Webster Learner's Dictionary API & Free Dictionary API (freedictionaryapi.com)
 */

export type DomainCategory =
  | 'business'
  | 'finance'
  | 'workplace'
  | 'commerce'
  | 'law'
  | 'tech'
  | 'general';

export type ToeicPriority = 'high' | 'medium' | 'low';

export type DictionarySource =
  | 'merriam_webster'
  | 'free_dictionary'
  | 'toeic_curated'
  | 'merged';

export interface WordSense {
  id: string;                         // Định danh duy nhất cho từng sense (ví dụ: 'mw-address-v-1')
  partOfSpeech: string;               // 'noun', 'verb', 'adjective', 'adverb'...
  definitionEn: string;               // Định nghĩa tiếng Anh chuẩn gốc
  meaningVi: string;                  // Nghĩa tiếng Việt của sense này
  explanationVi?: string;             // Giải thích tiếng Việt (nếu có)
  exampleEn?: string | null;          // Câu ví dụ tiếng Anh của sense này
  exampleVi?: string | null;          // Bản dịch tiếng Việt của câu ví dụ
  domain?: DomainCategory;            // Lĩnh vực (kinh doanh, công sở, thương mại, chung...)
  toeicPriority: ToeicPriority;       // Mức độ ưu tiên cho người học TOEIC
  synonyms: string[];                 // Từ đồng nghĩa
  antonyms: string[];                 // Từ trái nghĩa
  source: DictionarySource;           // Nguồn dữ liệu
  sourceAttribution: string;          // Ghi nhận nguồn (VD: 'Merriam-Webster Learner\'s', 'Wiktionary via Free Dictionary API')
  isAiTranslated?: boolean;           // Đánh dấu bản dịch máy/AI đối với tiếng Việt
}

export interface AggregatedWordEntry {
  word: string;                       // Từ gốc (Headword)
  ipaUs?: string | null;              // Phiên âm quốc tế chuẩn Mỹ
  ipaUk?: string | null;              // Phiên âm quốc tế chuẩn Anh
  audioUsUrl?: string | null;         // Link âm thanh phát âm US
  audioUkUrl?: string | null;         // Link âm thanh phát âm UK
  inflections?: string[];             // Các dạng biến thể từ loại (plurals, verb tenses...)
  etymology?: string | null;          // Nguồn gốc từ
  sources: DictionarySource[];        // Các nguồn đã đóng góp dữ liệu cho từ này
  senses: WordSense[];                // Danh sách tất cả các nét nghĩa đã phân loại & sắp xếp
  toeicRecommendedSenseId?: string;   // ID của nghĩa thông dụng nhất trong TOEIC
  cachedAt: number;                   // Thời gian cache (timestamp)
}
