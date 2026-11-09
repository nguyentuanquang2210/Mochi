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

/**
 * Chuẩn hóa phiên âm IPA về bảng ký hiệu quốc tế chuẩn Oxford / Cambridge thân thuộc với người học:
 * - Thay thế ký tự r ngược chuyên ngành ngôn ngữ học (turned-r: ɹ, ɻ, ɾ) thành chữ r thông thường
 * - Thay thế l tối (velarized-l: ɫ) thành chữ l thông thường
 * - Thay thế g script (ɡ) thành g thông thường
 * - Thay thế nguyên âm hẹp của Wiktionary (ᵻ -> ɪ, ᵿ -> ʊ)
 * - Bỏ dấu nối âm tie-bars (t͡ʃ -> tʃ, d͡ʒ -> dʒ)
 * - Chuẩn hóa (ɹ) -> r, bỏ dấu gạch nối âm tiết kiểu Merriam-Webster
 * - Đảm bảo bao bọc bởi /.../
 */
export function normalizeToStandardIpa(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;

  // Bỏ các dấu bao ngoài: [ ... ], / ... /, \ ... \
  s = s.replace(/^[\[\/\\ ]+|[\]\/\\ ]+$/g, '').trim();

  s = s
    // 1. Chữ r ngược (turned r): ɹ, ɻ, ɾ -> r (người học không còn thấy chữ ɹ lạ mắt)
    .replace(/[ɹɻɾ]/g, 'r')
    .replace(/\(ɹ\)/g, 'r')
    .replace(/\(r\)/g, 'r')

    // 2. Chữ l tối: ɫ -> l
    .replace(/ɫ/g, 'l')

    // 3. Chữ g script: ɡ -> g
    .replace(/ɡ/g, 'g')

    // 4. Nguyên âm rút gọn Wiktionary: ᵻ -> ɪ, ᵿ -> ʊ
    .replace(/ᵻ/g, 'ɪ')
    .replace(/ᵿ/g, 'ʊ')

    // 5. Tie bars nối âm: t͡ʃ -> tʃ, d͡ʒ -> dʒ
    .replace(/[͜͡]/g, '')

    // 6. Ký hiệu phụ ngữ điệu siêu âm: ʷ, ʲ, ʰ, ˤ, ˀ
    .replace(/[ʷʲʰˤˀ]/g, '')

    // 7. Bỏ dấu gạch ngang phân tách âm tiết kiểu Merriam-Webster (\ə-ˈdres\ -> \əˈdres\)
    .replace(/-/g, '')

    // 8. Bỏ dấu gạch chéo ngược
    .replace(/\\/g, '')

    // 9. Chuẩn hóa khoảng trắng
    .replace(/\s+/g, ' ')
    .trim();

  return s ? `/${s}/` : null;
}

