/**
 * Dictionary Aggregator
 * Tổng hợp, đối chiếu, gộp nghĩa, phân loại lĩnh vực & xếp hạng ưu tiên TOEIC
 * từ 2 nguồn: Merriam-Webster Learner's Dictionary và Free Dictionary API (Wiktionary)
 */

import { AggregatedWordEntry, DictionarySource, DomainCategory, ToeicPriority, WordSense, normalizeToStandardIpa } from './types';
import { MerriamWebsterApi } from './merriamWebsterApi';
import { FreeDictionaryApi } from './freeDictionaryApi';
import { TOEIC_MAP } from '../../data/toeicWordlist';

// Kho từ đa nghĩa chuẩn TOEIC được biên soạn thủ công với độ chính xác 100%
export const CURATED_TOEIC_MULTI_SENSES: Record<string, Partial<WordSense>[]> = {
  address: [
    {
      partOfSpeech: 'verb',
      definitionEn: 'to give attention to or deal with a matter or problem',
      meaningVi: 'giải quyết, xử lý (vấn đề, khiếu nại)',
      exampleEn: 'We must address the customer complaint promptly.',
      exampleVi: 'Chúng ta cần giải quyết khiếu nại của khách hàng kịp thời.',
      domain: 'business',
      toeicPriority: 'high'
    },
    {
      partOfSpeech: 'verb',
      definitionEn: 'to speak to a crowd or an audience in a formal way',
      meaningVi: 'phát biểu trước hội nghị, đám đông',
      exampleEn: 'The CEO will address the annual shareholder conference tomorrow.',
      exampleVi: 'Tổng giám đốc sẽ phát biểu trước hội nghị cổ đông thường niên vào ngày mai.',
      domain: 'business',
      toeicPriority: 'high'
    },
    {
      partOfSpeech: 'noun',
      definitionEn: 'the number of the house and the name of the street where someone lives or works',
      meaningVi: 'địa chỉ (nhà ở hoặc văn phòng)',
      exampleEn: 'Please write down your official billing address on the contract.',
      exampleVi: 'Vui lòng ghi lại địa chỉ thanh toán chính thức của bạn trên hợp đồng.',
      domain: 'general',
      toeicPriority: 'medium'
    }
  ],
  acquisition: [
    {
      partOfSpeech: 'noun',
      definitionEn: 'an asset, company, or piece of land bought or obtained by another business',
      meaningVi: 'sự mua lại, thâu tóm doanh nghiệp',
      exampleEn: 'The acquisition of the rival firm will expand our market share significantly.',
      exampleVi: 'Việc thâu tóm công ty đối thủ sẽ mở rộng thị phần của chúng ta đáng kể.',
      domain: 'business',
      toeicPriority: 'high'
    },
    {
      partOfSpeech: 'noun',
      definitionEn: 'the act of obtaining or beginning to have something, such as knowledge or skills',
      meaningVi: 'sự tiếp thu, đạt được (kiến thức, kỹ năng)',
      exampleEn: 'Language acquisition requires continuous daily immersion and practice.',
      exampleVi: 'Sự tiếp thu ngôn ngữ đòi hỏi sự đắm chìm và luyện tập liên tục hàng ngày.',
      domain: 'general',
      toeicPriority: 'medium'
    }
  ],
  conduct: [
    {
      partOfSpeech: 'verb',
      definitionEn: 'to organize and perform a particular activity or survey',
      meaningVi: 'tiến hành, thực hiện (nghiên cứu, khảo sát)',
      exampleEn: 'The research department will conduct a comprehensive market survey next week.',
      exampleVi: 'Phòng nghiên cứu sẽ tiến hành một cuộc khảo sát thị trường toàn diện vào tuần tới.',
      domain: 'business',
      toeicPriority: 'high'
    },
    {
      partOfSpeech: 'noun',
      definitionEn: 'the manner in which a person behaves, especially on a particular occasion or in a workplace',
      meaningVi: 'hành vi, tư cách, quy tắc ứng xử (công sở)',
      exampleEn: 'All new employees must adhere strictly to the corporate code of conduct.',
      exampleVi: 'Tất cả nhân viên mới phải tuân thủ nghiêm ngặt quy tắc ứng xử của công ty.',
      domain: 'workplace',
      toeicPriority: 'high'
    }
  ],
  issue: [
    {
      partOfSpeech: 'noun',
      definitionEn: 'a subject or problem that people are thinking and talking about',
      meaningVi: 'vấn đề, sự cố cần giải quyết',
      exampleEn: 'The board held an emergency meeting to resolve the technical issue.',
      exampleVi: 'Hội đồng quản trị đã tổ chức một cuộc họp khẩn để giải quyết vấn đề kỹ thuật.',
      domain: 'business',
      toeicPriority: 'high'
    },
    {
      partOfSpeech: 'verb',
      definitionEn: 'to produce or provide something official such as a document, ticket, or card',
      meaningVi: 'phát hành, cấp (thẻ, thông báo, hóa đơn)',
      exampleEn: 'The personnel department will issue new employee ID badges on Monday.',
      exampleVi: 'Phòng nhân sự sẽ cấp thẻ nhân viên mới vào thứ Hai.',
      domain: 'workplace',
      toeicPriority: 'high'
    },
    {
      partOfSpeech: 'noun',
      definitionEn: 'a set of newspapers or magazines printed at the same time',
      meaningVi: 'kỳ phát hành, số báo',
      exampleEn: 'The latest issue of the business journal features an interview with our founder.',
      exampleVi: 'Kỳ phát hành mới nhất của tạp chí kinh doanh đăng tải bài phỏng vấn nhà sáng lập của chúng tôi.',
      domain: 'general',
      toeicPriority: 'medium'
    }
  ],
  offer: [
    {
      partOfSpeech: 'verb',
      definitionEn: 'to ask someone if they would like to have something or if they would like you to do something',
      meaningVi: 'đề nghị, cung cấp (việc làm, mức lương, dịch vụ)',
      exampleEn: 'The multinational corporation offered him a senior executive position.',
      exampleVi: 'Tập đoàn đa quốc gia đã đề nghị anh ấy một vị trí điều hành cấp cao.',
      domain: 'workplace',
      toeicPriority: 'high'
    },
    {
      partOfSpeech: 'noun',
      definitionEn: 'an amount of money that someone is willing to pay or an opportunity to buy something at a lower price',
      meaningVi: 'lời đề nghị, đợt khuyến mãi giảm giá',
      exampleEn: 'This special promotional offer is valid exclusively for existing customers.',
      exampleVi: 'Lời đề nghị khuyến mãi đặc biệt này chỉ có hiệu lực cho khách hàng hiện tại.',
      domain: 'commerce',
      toeicPriority: 'high'
    }
  ],
  charge: [
    {
      partOfSpeech: 'noun',
      definitionEn: 'the amount of money that you have to pay for something, especially for an activity or service',
      meaningVi: 'tiền phí, phụ phí (dịch vụ, vận chuyển)',
      exampleEn: 'There is no extra charge for standard delivery within the city.',
      exampleVi: 'Không có phụ phí cho giao hàng tiêu chuẩn trong nội thành.',
      domain: 'finance',
      toeicPriority: 'high'
    },
    {
      partOfSpeech: 'verb',
      definitionEn: 'to ask an amount of money for something, especially a service or activity',
      meaningVi: 'tính phí, đòi tiền',
      exampleEn: 'The consultancy firm charges five hundred dollars per hour for professional advice.',
      exampleVi: 'Công ty tư vấn tính phí 500 đô la mỗi giờ cho lời khuyên chuyên môn.',
      domain: 'finance',
      toeicPriority: 'high'
    },
    {
      partOfSpeech: 'noun',
      definitionEn: 'the position of having control or responsibility for a group of people or an activity',
      meaningVi: 'sự phụ trách, chịu trách nhiệm',
      exampleEn: 'Mr. David is in charge of the international sales team.',
      exampleVi: 'Ông David phụ trách đội ngũ kinh doanh quốc tế.',
      domain: 'workplace',
      toeicPriority: 'high'
    }
  ],
  account: [
    {
      partOfSpeech: 'noun',
      definitionEn: 'an arrangement with a bank in which the customer puts in and removes money',
      meaningVi: 'tài khoản (ngân hàng, khách hàng doanh nghiệp)',
      exampleEn: 'Please transfer the invoice balance directly into our corporate bank account.',
      exampleVi: 'Vui lòng chuyển số dư hóa đơn trực tiếp vào tài khoản ngân hàng công ty của chúng tôi.',
      domain: 'finance',
      toeicPriority: 'high'
    },
    {
      partOfSpeech: 'verb',
      definitionEn: 'to form the total of something or explain the reason for something (used with for)',
      meaningVi: 'chiếm (tỷ lệ), giải thích (cho lý do)',
      exampleEn: 'Online transactions now account for sixty percent of overall company sales.',
      exampleVi: 'Giao dịch trực tuyến hiện chiếm sáu mươi phần trăm tổng doanh số của công ty.',
      domain: 'business',
      toeicPriority: 'high'
    },
    {
      partOfSpeech: 'noun',
      definitionEn: 'a written or spoken description of an event or meeting',
      meaningVi: 'bản báo cáo, lời tường thuật chi tiết',
      exampleEn: 'The project manager submitted a comprehensive account of the audit.',
      exampleVi: 'Trưởng dự án đã nộp một bản báo cáo toàn diện về đợt kiểm toán.',
      domain: 'workplace',
      toeicPriority: 'medium'
    }
  ],
  flyer: [
    {
      partOfSpeech: 'noun',
      definitionEn: 'a small sheet of paper advertising an event or product, given out on the street or in stores',
      meaningVi: 'tờ rơi quảng cáo',
      exampleEn: 'The marketing interns handed out promotional flyers to pedestrians.',
      exampleVi: 'Các thực tập sinh tiếp thị đã phát tờ rơi quảng cáo cho người đi bộ.',
      domain: 'commerce',
      toeicPriority: 'high'
    },
    {
      partOfSpeech: 'noun',
      definitionEn: 'a person who travels by plane or a pilot who operates an aircraft',
      meaningVi: 'phi công, hành khách đi máy bay',
      exampleEn: 'Frequent flyers enjoy priority boarding and lounge access.',
      exampleVi: 'Hành khách bay thường xuyên được hưởng quyền lên máy bay ưu tiên và phòng chờ.',
      domain: 'general',
      toeicPriority: 'medium'
    }
  ]
};

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'to', 'for', 'with', 'on', 'at', 'from', 'by', 'about',
  'as', 'into', 'like', 'through', 'after', 'over', 'between', 'out', 'against', 'during',
  'without', 'before', 'under', 'around', 'among', 'and', 'or', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'that', 'this', 'it',
  'someone', 'something', 'especially', 'used', 'make', 'person', 'act', 'state', 'quality'
]);

export class DictionaryAggregator {
  /**
   * Tính độ tương đồng từ vựng giữa hai định nghĩa tiếng Anh (Jaccard Index)
   */
  private static calculateSemanticSimilarity(defA: string, defB: string): number {
    const tokenize = (text: string): Set<string> => {
      const words = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w));
      return new Set(words);
    };

    const tokensA = tokenize(defA);
    const tokensB = tokenize(defB);

    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let intersectionCount = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersectionCount++;
    }

    const unionCount = new Set([...tokensA, ...tokensB]).size;
    return unionCount > 0 ? intersectionCount / unionCount : 0;
  }

  /**
   * Xác định lĩnh vực (domain) và độ ưu tiên TOEIC dựa trên từ khóa ngữ cảnh
   */
  private static evaluateToeicPriority(
    word: string,
    pos: string,
    defEn: string,
    exEn?: string | null
  ): { domain: DomainCategory; priority: ToeicPriority } {
    const combined = `${word} ${defEn} ${exEn || ''}`.toLowerCase();

    // Từ khóa môi trường công sở / kinh doanh / tài chính TOEIC
    const businessKeywords = [
      'business', 'company', 'corporate', 'firm', 'office', 'workplace', 'work', 'job',
      'employee', 'employer', 'staff', 'manager', 'management', 'director', 'executive',
      'meeting', 'conference', 'presentation', 'discuss', 'agenda', 'board',
      'contract', 'agreement', 'negotiat', 'deal', 'partner', 'clause',
      'finance', 'money', 'budget', 'fund', 'bank', 'cost', 'price', 'fee', 'charge',
      'bill', 'invoice', 'payment', 'salary', 'wage', 'bonus', 'expense', 'revenue',
      'market', 'commercial', 'commerce', 'sale', 'customer', 'client', 'consumer',
      'product', 'produce', 'merchandise', 'order', 'deliver', 'shipment', 'cargo',
      'hire', 'recruit', 'interview', 'resume', 'candidate', 'position', 'promot',
      'resign', 'retire', 'policy', 'procedure', 'schedule', 'deadline', 'cancel',
      'confirm', 'reserv', 'flight', 'airline', 'hotel', 'report', 'audit', 'tax',
      'invest', 'stock', 'shareholder', 'acquir', 'merger', 'monopoly'
    ];

    let matchCount = 0;
    for (const kw of businessKeywords) {
      if (combined.includes(kw)) {
        matchCount++;
      }
    }

    // Kiểm tra xem từ có nằm trong danh sách TOEIC chuẩn không
    const toeicMatch = TOEIC_MAP.get(word.toLowerCase());
    const isToeicVocab = Boolean(toeicMatch);

    if (matchCount >= 2 || (isToeicVocab && matchCount >= 1)) {
      if (/finance|money|bank|cost|fee|charge|bill|invoice|salary|fund|budget/i.test(combined)) {
        return { domain: 'finance', priority: 'high' };
      }
      if (/employee|staff|manager|job|office|hire|recruit|workplace|interview/i.test(combined)) {
        return { domain: 'workplace', priority: 'high' };
      }
      if (/market|sale|customer|order|deliver|product|merchandise|store/i.test(combined)) {
        return { domain: 'commerce', priority: 'high' };
      }
      return { domain: 'business', priority: 'high' };
    }

    if (isToeicVocab) {
      return { domain: 'business', priority: 'high' };
    }

    // Kiểm tra nghĩa hiếm hoặc cổ
    if (/archaic|obsolete|rare|historical|slang/i.test(combined)) {
      return { domain: 'general', priority: 'low' };
    }

    return { domain: 'general', priority: 'medium' };
  }

  /**
   * Dịch định nghĩa và ví dụ tiếng Anh sang tiếng Việt theo ngữ cảnh
   */
  private static async translateContextual(
    text: string,
    timeoutMs = 2500
  ): Promise<string | null> {
    const clean = text.trim();
    if (!clean) return null;

    try {
      const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(clean)}`;
      const res = await fetch(gUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.[0])) {
          const translated = data[0].map((chunk: any) => chunk?.[0] || '').join('').trim();
          if (translated && translated.toLowerCase() !== clean.toLowerCase()) {
            return translated;
          }
        }
      }
    } catch {}

    try {
      const mUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=en|vi`;
      const res = await fetch(mUrl);
      if (res.ok) {
        const data = await res.json();
        const trans = (data?.responseData?.translatedText || '').trim();
        if (trans && trans.toLowerCase() !== clean.toLowerCase() && !trans.includes('MYMEMORY WARNING')) {
          return trans;
        }
      }
    } catch {}

    return null;
  }

  /**
   * Tra cứu, tổng hợp và phân loại toàn diện một từ vựng tiếng Anh
   */
  static async aggregateWord(rawWord: string): Promise<AggregatedWordEntry> {
    const word = rawWord.trim().toLowerCase();

    // 1. Kiểm tra kho từ đa nghĩa biên soạn thủ công (phản hồi tức thì 0ms)
    if (CURATED_TOEIC_MULTI_SENSES[word]) {
      const curatedList = CURATED_TOEIC_MULTI_SENSES[word];
      const senses: WordSense[] = curatedList.map((item, idx) => ({
        id: `curated-${word}-${item.partOfSpeech?.slice(0, 1) || 'n'}-${idx + 1}`,
        partOfSpeech: item.partOfSpeech || 'noun',
        definitionEn: item.definitionEn || '',
        meaningVi: item.meaningVi || '',
        exampleEn: item.exampleEn || null,
        exampleVi: item.exampleVi || null,
        domain: item.domain || 'business',
        toeicPriority: item.toeicPriority || 'high',
        synonyms: item.synonyms || [],
        antonyms: item.antonyms || [],
        source: 'toeic_curated',
        sourceAttribution: 'TOEIC Curated Vocabulary Database'
      }));

      // Lấy phiên âm chuẩn Oxford/Cambridge từ TOEIC_MAP
      const toeic = TOEIC_MAP.get(word);

      return {
        word,
        ipaUs: normalizeToStandardIpa(toeic?.ipaUs),
        ipaUk: normalizeToStandardIpa(toeic?.ipaUk || toeic?.ipaUs),
        sources: ['toeic_curated'],
        senses,
        toeicRecommendedSenseId: senses[0]?.id,
        cachedAt: Date.now()
      };
    }

    // 2. Tra cứu đồng thời cả 2 nguồn: Merriam-Webster & Free Dictionary API
    const [mwRes, fdRes] = await Promise.allSettled([
      MerriamWebsterApi.lookup(word),
      FreeDictionaryApi.lookup(word)
    ]);

    const mwData = mwRes.status === 'fulfilled' ? mwRes.value : null;
    const fdData = fdRes.status === 'fulfilled' ? fdRes.value : null;

    const sources: DictionarySource[] = [];
    if (mwData) sources.push('merriam_webster');
    if (fdData) sources.push('free_dictionary');

    // Phiên âm: Ưu tiên bộ từ điển TOEIC chuẩn sẵn có trong app (Oxford/Cambridge sạch, không chứa ký tự lạ),
    // sau đó đến Merriam-Webster và Free Dictionary, tất cả đều được chuẩn hóa qua normalizeToStandardIpa
    const toeic = TOEIC_MAP.get(word);
    const rawIpaUs = toeic?.ipaUs || mwData?.ipaUs || fdData?.ipaUs || null;
    const rawIpaUk = toeic?.ipaUk || fdData?.ipaUk || mwData?.ipaUs || null;

    const ipaUs = normalizeToStandardIpa(rawIpaUs);
    const ipaUk = normalizeToStandardIpa(rawIpaUk || rawIpaUs);
    const audioUsUrl = mwData?.audioUsUrl || fdData?.audioUsUrl || null;
    const audioUkUrl = fdData?.audioUkUrl || null;

    // Biến thể từ loại (inflections)
    const inflections = Array.from(new Set([...(mwData?.inflections || []), ...(fdData?.inflections || [])]));

    const rawMwSenses = mwData?.senses || [];
    const rawFdSenses = fdData?.senses || [];

    // 3. Đối chiếu & Gộp các nét nghĩa tương đồng giữa 2 nguồn
    const mergedSenses: WordSense[] = [];
    const matchedFdIds = new Set<string>();

    for (const mwSense of rawMwSenses) {
      let matchedFdSense: WordSense | null = null;

      for (const fdSense of rawFdSenses) {
        if (matchedFdIds.has(fdSense.id)) continue;
        if (mwSense.partOfSpeech !== fdSense.partOfSpeech) continue;

        const sim = this.calculateSemanticSimilarity(mwSense.definitionEn, fdSense.definitionEn);
        if (sim >= 0.35) {
          matchedFdSense = fdSense;
          matchedFdIds.add(fdSense.id);
          break;
        }
      }

      if (matchedFdSense) {
        // Gộp hai nguồn lại thành một sense thống nhất
        const evalResult = this.evaluateToeicPriority(
          word,
          mwSense.partOfSpeech,
          mwSense.definitionEn,
          mwSense.exampleEn || matchedFdSense.exampleEn
        );

        mergedSenses.push({
          id: `merged-${word}-${mwSense.partOfSpeech.slice(0, 1)}-${mergedSenses.length + 1}`,
          partOfSpeech: mwSense.partOfSpeech,
          definitionEn: mwSense.definitionEn, // Định nghĩa MW rõ ràng, thân thiện với người học
          meaningVi: matchedFdSense.meaningVi || '',
          exampleEn: mwSense.exampleEn || matchedFdSense.exampleEn,
          exampleVi: null,
          domain: evalResult.domain,
          toeicPriority: evalResult.priority,
          synonyms: Array.from(new Set([...mwSense.synonyms, ...matchedFdSense.synonyms])),
          antonyms: Array.from(new Set([...mwSense.antonyms, ...matchedFdSense.antonyms])),
          source: 'merged',
          sourceAttribution: 'Merriam-Webster & Free Dictionary API'
        });
      } else {
        const evalResult = this.evaluateToeicPriority(
          word,
          mwSense.partOfSpeech,
          mwSense.definitionEn,
          mwSense.exampleEn
        );

        mergedSenses.push({
          ...mwSense,
          domain: evalResult.domain,
          toeicPriority: evalResult.priority
        });
      }
    }

    // Bổ sung các senses riêng biệt chỉ có trong Free Dictionary
    for (const fdSense of rawFdSenses) {
      if (!matchedFdIds.has(fdSense.id)) {
        const evalResult = this.evaluateToeicPriority(
          word,
          fdSense.partOfSpeech,
          fdSense.definitionEn,
          fdSense.exampleEn
        );

        mergedSenses.push({
          ...fdSense,
          domain: evalResult.domain,
          toeicPriority: evalResult.priority
        });
      }
    }

    // 4. Nếu cả 2 API đều không trả về senses (hoặc offline), fallback về TOEIC_MAP
    if (mergedSenses.length === 0) {
      const toeic = TOEIC_MAP.get(word);
      if (toeic) {
        mergedSenses.push({
          id: `fallback-${word}-1`,
          partOfSpeech: toeic.pos || 'từ vựng',
          definitionEn: word,
          meaningVi: toeic.meaningVi,
          exampleEn: null,
          exampleVi: null,
          domain: 'business',
          toeicPriority: 'high',
          synonyms: [],
          antonyms: [],
          source: 'toeic_curated',
          sourceAttribution: 'TOEIC Wordlist'
        });
        sources.push('toeic_curated');
      }
    }

    // 5. Dịch tiếng Việt cho các senses chưa có nghĩa tiếng Việt (tối đa 4 senses tiêu biểu)
    for (let i = 0; i < Math.min(mergedSenses.length, 5); i++) {
      const sense = mergedSenses[i];
      if (!sense.meaningVi) {
        // Dịch định nghĩa tiếng Anh
        const trans = await this.translateContextual(sense.definitionEn);
        if (trans) {
          // Trích xuất cụm nghĩa ngắn gọn
          const shortMeaning = trans.split(/[.;:]/)[0].trim();
          sense.meaningVi = shortMeaning;
          sense.isAiTranslated = true;
        } else {
          sense.meaningVi = TOEIC_MAP.get(word)?.meaningVi || word;
        }
      }

      // Dịch câu ví dụ nếu có
      if (sense.exampleEn && !sense.exampleVi) {
        const exTrans = await this.translateContextual(sense.exampleEn);
        if (exTrans) {
          sense.exampleVi = exTrans;
          sense.isAiTranslated = true;
        }
      }
    }

    // 6. Sắp xếp thứ tự ưu tiên TOEIC: high -> medium -> low
    const priorityWeight: Record<ToeicPriority, number> = {
      high: 3,
      medium: 2,
      low: 1
    };

    mergedSenses.sort((a, b) => {
      const diff = priorityWeight[b.toeicPriority] - priorityWeight[a.toeicPriority];
      if (diff !== 0) return diff;
      // Ưu tiên senses có câu ví dụ thực tế
      if (b.exampleEn && !a.exampleEn) return 1;
      if (!b.exampleEn && a.exampleEn) return -1;
      return 0;
    });

    const topHighSense = mergedSenses.find(s => s.toeicPriority === 'high') || mergedSenses[0];

    return {
      word,
      ipaUs,
      ipaUk,
      audioUsUrl,
      audioUkUrl,
      inflections,
      sources: sources.length > 0 ? sources : ['free_dictionary'],
      senses: mergedSenses,
      toeicRecommendedSenseId: topHighSense?.id,
      cachedAt: Date.now()
    };
  }
}
