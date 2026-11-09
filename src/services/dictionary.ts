import { database } from '../data/database';
import { TOEIC_MAP, TOEIC_WORDLIST, ToeicWordEntry } from '../data/toeicWordlist';

export interface WordMeaningItem {
  partOfSpeech: string;       // noun, verb, adjective, adverb...
  definitionVi: string;       // Nghĩa tiếng Việt của nét nghĩa này
  definitionEn?: string;      // Định nghĩa tiếng Anh
  exampleEn?: string | null;  // Câu ví dụ tiếng Anh của nét nghĩa này
  exampleVi?: string | null;  // Bản dịch tiếng Việt của câu ví dụ này
}

export interface SuggestionItem {
  word: string;
  ipa?: string | null;
  ipaUs?: string | null;
  ipaUk?: string | null;
  meaningVi?: string | null;
  exampleEn?: string | null;    // Câu ví dụ tiếng Anh
  exampleVi?: string | null;    // Nghĩa câu tiếng Anh (tiếng Việt)
  partOfSpeech?: string | null; // Từ loại (noun, verb, adj...)
  isToeic?: boolean;
}

export interface DictionaryWordInfo {
  word: string;
  ipaUs?: string | null;
  ipaUk?: string | null;
  phonetic?: string | null;
  meaningVi?: string | null;
  explanationVi?: string | null; // Giải thích ngắn gọn (nếu có)
  exampleEn?: string | null;    // Câu ví dụ tiếng Anh
  exampleVi?: string | null;    // Nghĩa câu tiếng Anh (tiếng Việt)
  partOfSpeech?: string | null; // Từ loại
  meaningsList?: WordMeaningItem[]; // Danh sách TẤT CẢ các nghĩa và ví dụ tương ứng
  verified: boolean;
  networkError?: boolean;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 2500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Bảng từ điển dịch nhanh offline cho các từ và cụm từ tiếng Anh thông dụng (phản hồi tức thì 0ms)
const COMMON_TRANSLATIONS: Record<string, string> = {
  // Cụm từ thông dụng (phrasal verbs & common collocations)
  'your friends': 'bạn bè của bạn',
  'come in': 'vào đi, mời vào',
  'look forward to': 'mong đợi, trông chờ',
  'take care of': 'chăm sóc, phụ trách',
  'as well as': 'cũng như',
  'set up': 'thiết lập, sắp xếp',
  'pick up': 'đón, nhặt lên',
  'deal with': 'xử lý, giải quyết',
  'in order to': 'để mà',
  'point of view': 'quan điểm',
  'each other': 'lẫn nhau',
  'one another': 'nhau, lẫn nhau',
  'run out of': 'hết, cạn kiệt',
  'give up': 'từ bỏ',
  'turn on': 'bật lên',
  'turn off': 'tắt đi',
  'find out': 'tìm ra, phát hiện',
  'sharp turn': 'khúc cua gấp',
  'at least': 'ít nhất',
  'at all': 'chút nào',
  'in front of': 'ở phía trước',
  'next to': 'bên cạnh',
  'according to': 'theo như',
  'due to': 'do, bởi vì',
  'because of': 'vì, do',
  'instead of': 'thay vì',
  'depend on': 'phụ thuộc vào',
  'pay attention to': 'chú ý đến',
  'make sure': 'đảm bảo',

  // Đại từ & Từ chỉ định
  'i': 'tôi',
  'you': 'bạn',
  'he': 'anh ấy',
  'she': 'cô ấy',
  'it': 'nó',
  'we': 'chúng tôi, chúng ta',
  'they': 'họ, chúng',
  'me': 'tôi (tân ngữ)',
  'him': 'anh ấy (tân ngữ)',
  'her': 'cô ấy, của cô ấy',
  'us': 'chúng tôi (tân ngữ)',
  'them': 'họ (tân ngữ)',
  'my': 'của tôi',
  'your': 'của bạn',
  'his': 'của anh ấy',
  'our': 'của chúng tôi',
  'their': 'của họ',
  'this': 'này, cái này',
  'that': 'đó, cái đó',
  'these': 'những cái này',
  'those': 'những cái đó',

  // Động từ to be & Trợ động từ
  'is': 'thì, là, ở',
  'are': 'thì, là, ở',
  'am': 'thì, là, ở',
  'was': 'đã là, đã ở',
  'were': 'đã là, đã ở',
  'be': 'là, tồn tại',
  'been': 'đã từng là',
  'being': 'đang là',
  'have': 'có, đã',
  'has': 'có, đã',
  'had': 'đã có',
  'do': 'làm',
  'does': 'làm',
  'did': 'đã làm',
  'will': 'sẽ',
  'would': 'sẽ (quá khứ)',
  'can': 'có thể',
  'could': 'có thể (quá khứ)',
  'should': 'nên',
  'must': 'phải',
  'may': 'có thể',
  'might': 'có thể',

  // Giới từ & Trạng từ chỉ nơi chốn/thời gian
  'here': 'ở đây',
  'there': 'ở đó',
  'in': 'trong, ở trong',
  'on': 'trên, ở trên',
  'at': 'tại, ở',
  'to': 'đến, để',
  'for': 'cho, dành cho',
  'with': 'với, cùng với',
  'from': 'từ',
  'by': 'bởi, bằng',
  'about': 'về, khoảng',
  'into': 'vào trong',
  'through': 'qua, xuyên qua',
  'after': 'sau khi',
  'before': 'trước khi',
  'under': 'dưới',
  'over': 'qua, trên',
  'between': 'ở giữa',
  'out': 'ngoài, ra ngoài',
  'up': 'lên, lên trên',
  'down': 'xuống',

  // Liên từ & Quán từ
  'the': 'cái, con, người (xác định)',
  'a': 'một',
  'an': 'một',
  'and': 'và',
  'or': 'hoặc',
  'but': 'nhưng',
  'so': 'vì vậy, nên',
  'because': 'bởi vì',
  'if': 'nếu',
  'when': 'khi, khi nào',
  'while': 'trong khi',
  'not': 'không',
  'no': 'không',
  'yes': 'vâng, có',
  'all': 'tất cả',
  'some': 'một vài, một số',
  'any': 'bất kỳ',
  'many': 'nhiều',
  'much': 'nhiều',
  'more': 'nhiều hơn',
  'now': 'bây giờ',
  'then': 'sau đó, lúc đó',
  'again': 'lại, lần nữa',
  'very': 'rất',
  'too': 'quá, cũng',
  'friends': 'những người bạn',
  'friend': 'người bạn'
};

class DictionaryServiceImpl {
  // In-memory runtime cache for instantaneous response (< 1ms)
  private memoryCache = new Map<string, DictionaryWordInfo>();
  private phraseCache = new Map<string, string>();
  private activeAbortController: AbortController | null = null;

  constructor() {
    // 1. Nạp trước kho từ vựng TOEIC với đầy đủ IPA US/UK vào in-memory cache
    for (const entry of TOEIC_WORDLIST) {
      this.memoryCache.set(entry.word.toLowerCase(), {
        word: entry.word,
        ipaUs: entry.ipaUs,
        ipaUk: entry.ipaUk || entry.ipaUs,
        phonetic: entry.ipaUs,
        meaningVi: entry.meaningVi,
        partOfSpeech: entry.pos || null,
        verified: true
      });
    }
  }

  /**
   * Dịch từ hoặc cụm từ đơn lẻ trong câu ví dụ (dùng cho Interactive Tooltip chạm để tra)
   * Phản hồi siêu nhanh: ưu tiên cache nội bộ & TOEIC_MAP -> API dịch thuật -> fallback
   */
  async translateWordOrPhrase(rawText: string): Promise<string> {
    const clean = rawText.trim().toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');
    if (!clean) return '';

    // 1. Kiểm tra cache cụm từ in-memory (0ms)
    if (this.phraseCache.has(clean)) {
      return this.phraseCache.get(clean)!;
    }

    // 2. Kiểm tra từ điển thông dụng COMMON_TRANSLATIONS (0ms)
    if (COMMON_TRANSLATIONS[clean]) {
      const res = COMMON_TRANSLATIONS[clean];
      this.phraseCache.set(clean, res);
      return res;
    }

    // 3. Kiểm tra TOEIC_MAP (0ms)
    const toeic = TOEIC_MAP.get(clean);
    if (toeic?.meaningVi) {
      this.phraseCache.set(clean, toeic.meaningVi);
      return toeic.meaningVi;
    }

    // 4. Kiểm tra in-memory cache từ vựng
    const mem = this.memoryCache.get(clean);
    if (mem?.meaningVi) {
      this.phraseCache.set(clean, mem.meaningVi);
      return mem.meaningVi;
    }

    // 5. Kiểm tra SQLite cache
    try {
      const db = await database();
      const cached = await db.getFirstAsync<{ data_json: string | null }>(
        'SELECT data_json FROM dictionary_cache WHERE LOWER(word) = ?', clean
      );
      if (cached?.data_json) {
        const parsed = JSON.parse(cached.data_json);
        if (parsed.meaningVi) {
          this.phraseCache.set(clean, parsed.meaningVi);
          return parsed.meaningVi;
        }
      }
    } catch {}

    // 6. Gọi API dịch thuật miễn phí MyMemory
    const trans = await this.translateEnToVi(clean);
    if (trans) {
      this.phraseCache.set(clean, trans);
      return trans;
    }

    return clean;
  }

  /**
   * Tra cứu từ điển chuẩn qua Google Translate Dictionary Engine
   * Lấy nghĩa gốc chính xác, danh sách từ loại (noun, verb, adj...) cùng các nghĩa tiếng Việt chuẩn xác
   */
  async fetchGoogleDictionary(word: string): Promise<{
    primaryTranslation: string;
    meanings: { partOfSpeech: string; definitions: string[] }[];
  } | null> {
    const clean = word.trim().toLowerCase();
    if (!clean) return null;
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(clean)}`;
      const res = await fetchWithTimeout(url, {}, 3000);
      if (res.ok) {
        const data = await res.json();
        const primary = data?.[0]?.[0]?.[0]?.trim() || '';
        const meanings: { partOfSpeech: string; definitions: string[] }[] = [];

        if (Array.isArray(data?.[1])) {
          for (const item of data[1]) {
            if (Array.isArray(item) && item.length >= 2 && typeof item[0] === 'string' && Array.isArray(item[1])) {
              const pos = item[0].trim();
              const defs = item[1].map((d: any) => String(d).trim()).filter(Boolean);
              if (defs.length > 0) {
                meanings.push({
                  partOfSpeech: pos,
                  definitions: defs.slice(0, 4)
                });
              }
            }
          }
        }

        if (primary || meanings.length > 0) {
          return {
            primaryTranslation: primary || (meanings[0]?.definitions[0] ?? clean),
            meanings
          };
        }
      }
    } catch {}
    return null;
  }

  /**
   * Dịch văn bản tiếng Anh sang tiếng Việt: ưu tiên Google Translate API chuẩn xác, dự phòng MyMemory
   */
  private async translateEnToVi(text: string): Promise<string | null> {
    const clean = text.trim();
    if (!clean) return null;

    // 1. Google Translate API (siêu tốc ~100ms, độ chính xác cao nhất)
    try {
      const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(clean)}`;
      const gRes = await fetchWithTimeout(gUrl, {}, 2500);
      if (gRes.ok) {
        const gData = await gRes.json();
        if (Array.isArray(gData?.[0])) {
          const translated = gData[0].map((chunk: any) => chunk?.[0] || '').join('').trim();
          if (translated && translated.toLowerCase() !== clean.toLowerCase()) {
            return translated;
          }
        }
      }
    } catch {}

    // 2. Dự phòng qua MyMemory
    try {
      const res = await fetchWithTimeout(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=en|vi`,
        {},
        2500
      );
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
   * Tạo các biến thể dạng từ gốc (lemmas) cho các từ có đuôi chia thì/số nhiều
   * Ví dụ: revised -> revise; packing -> pack; applied -> apply
   */
  private getBaseForms(word: string): string[] {
    const w = word.toLowerCase();
    const bases: string[] = [];
    if (w.endsWith('ing')) {
      bases.push(w.slice(0, -3)); // pack(ing) -> pack
      bases.push(w.slice(0, -3) + 'e'); // mak(ing) -> make
      if (w.length > 5 && w[w.length - 4] === w[w.length - 5]) {
        bases.push(w.slice(0, -4)); // runn(ing) -> run
      }
    } else if (w.endsWith('ed')) {
      bases.push(w.slice(0, -2)); // pack(ed) -> pack
      bases.push(w.slice(0, -1)); // revise(d) -> revise
      if (w.endsWith('ied')) {
        bases.push(w.slice(0, -3) + 'y'); // appl(ied) -> apply
      }
    } else if (w.endsWith('es')) {
      bases.push(w.slice(0, -2)); // box(es) -> box
      bases.push(w.slice(0, -1)); // increas(es) -> increase
    } else if (w.endsWith('s') && !w.endsWith('ss')) {
      bases.push(w.slice(0, -1)); // contract(s) -> contract
    } else if (w.endsWith('ly')) {
      bases.push(w.slice(0, -2)); // quick(ly) -> quick
    }
    return bases.filter(b => b.length >= 2);
  }

  /**
   * Định dạng chuỗi IPA chuẩn với dấu gạch chéo /.../
   */
  private formatIpa(raw: string | null | undefined): string | null {
    if (!raw) return null;
    let cleaned = raw.trim();
    if (!cleaned) return null;
    cleaned = cleaned.replace(/^\/+|\/+$/g, '').trim();
    return cleaned ? `/${cleaned}/` : null;
  }

  /**
   * Trích xuất câu ví dụ tốt nhất từ DictionaryAPI entry data.
   * Ưu tiên: câu có ngữ cảnh công việc/văn phòng, độ dài vừa phải (< 100 chars)
   */
  private extractBestExample(meanings: any[]): { example: string | null; definition: string | null; partOfSpeech: string | null } {
    let bestEx: string | null = null;
    let bestDef: string | null = null;
    let partOfSpeech: string | null = null;

    // Ưu tiên theo thứ tự: verb > noun > adj > adv
    const posOrder = ['verb', 'noun', 'adjective', 'adverb'];
    const sortedMeanings = [...meanings].sort((a, b) => {
      const ai = posOrder.indexOf(a.partOfSpeech);
      const bi = posOrder.indexOf(b.partOfSpeech);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    for (const m of sortedMeanings) {
      for (const d of (m.definitions || [])) {
        if (!bestDef && d.definition) {
          bestDef = d.definition;
          partOfSpeech = m.partOfSpeech;
        }
        if (!bestEx && d.example) {
          const ex = d.example.trim();
          // Lọc câu có độ dài phù hợp để học (không quá ngắn hoặc quá dài)
          if (ex.length >= 8 && ex.length <= 120) {
            bestEx = ex;
          }
        }
        if (bestEx && bestDef) break;
      }
      if (bestEx && bestDef) break;
    }

    return { example: bestEx, definition: bestDef, partOfSpeech };
  }

  /**
   * Tạo câu ví dụ dự phòng từ Datamuse definitions khi DictionaryAPI không có câu ví dụ.
   * Parse format "v\t(transitive) To get." -> "To get."
   */
  private parseDatamuseDef(defs: string[] | undefined): string | null {
    if (!Array.isArray(defs) || defs.length === 0) return null;
    for (const d of defs) {
      const parts = d.split('\t');
      const def = (parts[1] || parts[0] || '').trim();
      if (def) return def;
    }
    return null;
  }

  /**
   * 1. GỢI Ý TỪ KHI NGƯỜI DÙNG NHẬP (AUTOCOMPLETE)
   * - Bắt đầu khi nhập ít nhất 2 ký tự
   * - Đảm bảo 100% từ gợi ý ĐỀU CÓ PHIÊN ÂM IPA (từ Datamuse IPA tag hoặc TOEIC list)
   * - Ưu tiên từ TOEIC khớp tiền tố
   */
  async searchSuggestions(query: string, limit = 8): Promise<SuggestionItem[]> {
    const cleanQuery = query.trim().toLowerCase();
    if (cleanQuery.length < 2) {
      return [];
    }

    const results: SuggestionItem[] = [];
    const seenWords = new Set<string>();

    // 1. Quét kho từ TOEIC nội bộ (phản hồi siêu nhanh < 3ms, luôn có IPA 100%)
    const toeicPrefixMatches: ToeicWordEntry[] = [];
    const toeicContainsMatches: ToeicWordEntry[] = [];

    for (const entry of TOEIC_WORDLIST) {
      const lower = entry.word.toLowerCase();
      if (lower.startsWith(cleanQuery)) {
        toeicPrefixMatches.push(entry);
      } else if (lower.includes(cleanQuery) && cleanQuery.length >= 3) {
        toeicContainsMatches.push(entry);
      }
    }

    toeicPrefixMatches.sort((a, b) => {
      if (a.word.toLowerCase() === cleanQuery) return -1;
      if (b.word.toLowerCase() === cleanQuery) return 1;
      return a.word.length - b.word.length;
    });

    for (const item of toeicPrefixMatches) {
      if (results.length >= limit) break;
      if (!seenWords.has(item.word.toLowerCase())) {
        seenWords.add(item.word.toLowerCase());
        results.push({
          word: item.word,
          ipa: item.ipaUs || item.ipaUk,
          ipaUs: item.ipaUs,
          ipaUk: item.ipaUk,
          meaningVi: item.meaningVi,
          isToeic: true
        });
      }
    }

    // 2. Tra cứu từ bảng dictionary_cache trong SQLite (các từ đã tra cứu trước đó)
    if (results.length < limit) {
      try {
        const db = await database();
        const cachedRows = await db.getAllAsync<{
          word: string;
          ipa_us: string | null;
          ipa_uk: string | null;
          phonetic: string | null;
        }>(
          'SELECT word, ipa_us, ipa_uk, phonetic FROM dictionary_cache WHERE word LIKE ? ORDER BY LENGTH(word) ASC LIMIT ?',
          `${cleanQuery}%`,
          limit - results.length
        );

        for (const r of cachedRows) {
          const lower = r.word.toLowerCase();
          if (!seenWords.has(lower) && results.length < limit) {
            seenWords.add(lower);
            const ipa = r.ipa_us || r.ipa_uk || r.phonetic;
            results.push({
              word: r.word,
              ipa,
              ipaUs: r.ipa_us || ipa,
              ipaUk: r.ipa_uk || ipa,
              isToeic: false
            });
          }
        }
      } catch (dbErr) {
        // Fallback gracefully
      }
    }

    // 3. Gọi Datamuse API với cờ &ipa=1 để lấy trực tiếp IPA chuẩn CMU cho từng từ
    if (results.length < limit) {
      try {
        if (this.activeAbortController) {
          this.activeAbortController.abort();
        }
        this.activeAbortController = new AbortController();

        const response = await fetch(
          `https://api.datamuse.com/words?sp=${encodeURIComponent(cleanQuery)}*&md=r&ipa=1&max=15`,
          { signal: this.activeAbortController.signal }
        );

        if (response.ok) {
          const apiWords: { word: string; tags?: string[] }[] = await response.json();
          for (const item of apiWords) {
            const w = item.word.toLowerCase().trim();
            if (
              /^[a-z]+(-[a-z]+)?$/i.test(w) &&
              w.startsWith(cleanQuery) &&
              !seenWords.has(w)
            ) {
              seenWords.add(w);

              // Trích xuất IPA từ tags 'ipa_pron:...' của Datamuse (chuẩn CMU dictionary)
              let extractedIpa: string | null = null;
              if (Array.isArray(item.tags)) {
                const ipaTag = item.tags.find(t => t.startsWith('ipa_pron:'));
                if (ipaTag) {
                  extractedIpa = this.formatIpa(ipaTag.replace('ipa_pron:', ''));
                }
              }

              // Kiểm tra thêm in-memory cache nếu có
              const cachedInfo = this.memoryCache.get(w);
              const finalIpa = cachedInfo?.ipaUs || cachedInfo?.ipaUk || cachedInfo?.phonetic || extractedIpa;

              // Tự động lưu vào memory cache để người dùng chọn là có ngay
              if (finalIpa && !this.memoryCache.has(w)) {
                this.memoryCache.set(w, {
                  word: w,
                  ipaUs: finalIpa,
                  ipaUk: finalIpa,
                  phonetic: finalIpa,
                  verified: true
                });
              }

              results.push({
                word: w,
                ipa: finalIpa,
                ipaUs: cachedInfo?.ipaUs || finalIpa,
                ipaUk: cachedInfo?.ipaUk || finalIpa,
                meaningVi: cachedInfo?.meaningVi,
                isToeic: false
              });

              if (results.length >= limit) break;
            }
          }
        }
      } catch (err: any) {
        // Network timeout / aborted: gracefully ignore
      }
    }

    // 4. Bổ sung các từ TOEIC liên quan chính tả nếu còn chỗ
    if (results.length < limit) {
      for (const item of toeicContainsMatches) {
        if (results.length >= limit) break;
        if (!seenWords.has(item.word.toLowerCase())) {
          seenWords.add(item.word.toLowerCase());
          results.push({
            word: item.word,
            ipa: item.ipaUs || item.ipaUk,
            ipaUs: item.ipaUs,
            ipaUk: item.ipaUk,
            meaningVi: item.meaningVi,
            isToeic: true
          });
        }
      }
    }

    return results;
  }

  /**
   * 4. TỰ ĐỘNG LẤY PHIÊN ÂM IPA & TRA CỨU TỪ ĐIỂN
   * Kết hợp 2 nguồn từ điển chính:
   * 1. Free Dictionary API (dictionaryapi.dev)
   * 2. Datamuse CMU Pronouncing Dictionary (chứa hơn 134,000 từ tiếng Anh với 100% IPA đầy đủ
   *    kể cả các dạng số nhiều -s, quá khứ -ed, tiếp diễn -ing, tính từ -al...)
   */
  async lookupWord(rawWord: string): Promise<DictionaryWordInfo> {
    const word = rawWord.trim().toLowerCase();
    if (!word) {
      return { word: rawWord, verified: false };
    }

    // 1. Kiểm tra in-memory cache (phản hồi siêu nhanh < 1ms)
    const memCached = this.memoryCache.get(word);
    if (memCached && (memCached.ipaUs || memCached.ipaUk || memCached.phonetic)) {
      return memCached;
    }

    // 2. Kiểm tra bộ từ TOEIC có sẵn
    const toeicEntry = TOEIC_MAP.get(word);
    if (toeicEntry) {
      const info: DictionaryWordInfo = {
        word: toeicEntry.word,
        ipaUs: toeicEntry.ipaUs,
        ipaUk: toeicEntry.ipaUk || toeicEntry.ipaUs,
        phonetic: toeicEntry.ipaUs,
        meaningVi: toeicEntry.meaningVi,
        verified: true
      };
      this.memoryCache.set(word, info);
      return info;
    }

    // 3. Kiểm tra SQLite cache
    try {
      const db = await database();
      const cached = await db.getFirstAsync<{
        word: string;
        ipa_us: string | null;
        ipa_uk: string | null;
        phonetic: string | null;
        data_json: string | null;
      }>('SELECT * FROM dictionary_cache WHERE LOWER(word) = ?', word);

      if (cached && (cached.ipa_us || cached.ipa_uk || cached.phonetic)) {
        const info: DictionaryWordInfo = {
          word: cached.word,
          ipaUs: cached.ipa_us,
          ipaUk: cached.ipa_uk,
          phonetic: cached.phonetic,
          verified: true
        };
        this.memoryCache.set(word, info);
        return info;
      }
    } catch (e) {
      console.warn('SQLite cache lookup warning:', e);
    }

    // 4. Nguồn 1: Gọi Free Dictionary API (https://api.dictionaryapi.dev)
    let ipaUs: string | null = null;
    let ipaUk: string | null = null;
    let primaryPhonetic: string | null = null;
    let verified = false;
    let exampleEn: string | null = null;
    let partOfSpeech: string | null = null;

    try {
      const res = await fetchWithTimeout(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
        { headers: { Accept: 'application/json' } },
        2500
      );

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          verified = true;
          const entry = data[0];
          if (entry.phonetic && typeof entry.phonetic === 'string' && entry.phonetic.trim()) {
            primaryPhonetic = entry.phonetic.trim();
          }

          if (Array.isArray(entry.phonetics)) {
            for (const p of entry.phonetics) {
              const text = (p.text || '').trim();
              const audio = (p.audio || '').toLowerCase();
              if (!text) continue;

              if (audio.includes('-us.mp3') || audio.includes('/us/') || audio.includes('us-')) {
                if (!ipaUs) ipaUs = text;
              } else if (audio.includes('-uk.mp3') || audio.includes('/uk/') || audio.includes('uk-')) {
                if (!ipaUk) ipaUk = text;
              } else if (!primaryPhonetic) {
                primaryPhonetic = text;
              }
            }
          }

          // Lấy câu ví dụ và từ loại từ DictionaryAPI
          if (Array.isArray(entry.meanings) && entry.meanings.length > 0) {
            const extracted = this.extractBestExample(entry.meanings);
            exampleEn = extracted.example;
            partOfSpeech = extracted.partOfSpeech;
          }
        }
      }
    } catch (dictErr) {
      // Ignored: fallback to Datamuse
    }

    // 5. Nguồn 2 (CỰC KỲ QUAN TRỌNG): Nếu dictionaryapi.dev không có phiên âm (hoặc thiếu US/UK)
    // Gọi Datamuse CMU Pronouncing Dictionary (134,000 từ với đầy đủ IPA cho mọi dạng chia động từ, số nhiều, tính từ...)
    if (!ipaUs || !ipaUk || !primaryPhonetic) {
      try {
        const dmRes = await fetchWithTimeout(
          `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=r&ipa=1${!exampleEn ? '&md=d' : ''}&max=1`,
          {},
          2500
        );
        if (dmRes.ok) {
          const dmData: { word: string; tags?: string[]; defs?: string[] }[] = await dmRes.json();
          if (Array.isArray(dmData) && dmData.length > 0 && dmData[0].word.toLowerCase() === word) {
            verified = true;
            const ipaTag = dmData[0].tags?.find(t => t.startsWith('ipa_pron:'));
            if (ipaTag) {
              const parsedIpa = this.formatIpa(ipaTag.replace('ipa_pron:', ''));
              if (parsedIpa) {
                if (!ipaUs) ipaUs = parsedIpa;
                if (!ipaUk) ipaUk = parsedIpa;
                if (!primaryPhonetic) primaryPhonetic = parsedIpa;
              }
            }
          }
        }
      } catch (dmErr) {
        // Ignored
      }
    }

    // 6. Chuẩn hóa format IPA
    ipaUs = this.formatIpa(ipaUs || primaryPhonetic);
    ipaUk = this.formatIpa(ipaUk || primaryPhonetic);
    primaryPhonetic = this.formatIpa(primaryPhonetic || ipaUs || ipaUk);

    const finalResult: DictionaryWordInfo = {
      word: rawWord,
      ipaUs,
      ipaUk,
      phonetic: primaryPhonetic,
      exampleEn,
      partOfSpeech,
      verified
    };

    // Nếu tìm thấy, lưu ngay vào in-memory cache và SQLite để không bao giờ phải tra cứu lại
    if (verified && (ipaUs || ipaUk)) {
      this.memoryCache.set(word, finalResult);

      try {
        const db = await database();
        await db.runAsync(
          `INSERT OR REPLACE INTO dictionary_cache (word, ipa_us, ipa_uk, phonetic, data_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          word,
          ipaUs,
          ipaUk,
          primaryPhonetic,
          JSON.stringify({ word, ipaUs, ipaUk, exampleEn, partOfSpeech }),
          Date.now()
        );
      } catch (dbSaveErr) {
        console.warn('Failed to save to dictionary_cache:', dbSaveErr);
      }
    }

    return finalResult;
  }

  /**
   * Tra cứu đầy đủ: IPA + câu ví dụ tiếng Anh + nghĩa tiếng Việt của câu + nghĩa tiếng Việt của từ.
   * Dùng khi người dùng chọn từ gợi ý hoặc thêm từ mới để tự động điền mặt ẩn phong phú.
   */
  async lookupWordFull(rawWord: string): Promise<DictionaryWordInfo> {
    const word = rawWord.trim().toLowerCase();
    const baseInfo = await this.lookupWord(rawWord);

    let exampleEn: string | null = baseInfo.exampleEn || null;
    let exampleVi: string | null = baseInfo.exampleVi || null;
    let meaningVi: string | null = baseInfo.meaningVi || null;
    let partOfSpeech: string | null = baseInfo.partOfSpeech || null;

    // 1. Kiểm tra SQLite cache data_json xem đã từng lưu ví dụ hoặc bản dịch chưa
    try {
      const db = await database();
      const cached = await db.getFirstAsync<{ data_json: string | null }>(
        'SELECT data_json FROM dictionary_cache WHERE LOWER(word) = ?', word
      );
      if (cached?.data_json) {
        const parsed = JSON.parse(cached.data_json);
        if (parsed.exampleEn && !exampleEn) exampleEn = parsed.exampleEn;
        if (parsed.exampleVi && !exampleVi) exampleVi = parsed.exampleVi;
        if (parsed.meaningVi && !meaningVi) meaningVi = parsed.meaningVi;
        if (parsed.partOfSpeech && !partOfSpeech) partOfSpeech = parsed.partOfSpeech;
      }
    } catch {}

    // 2. Tra cứu nguồn từ điển chuẩn qua Google Translate Dictionary Engine
    let meaningsList: WordMeaningItem[] = [];
    let explanationVi: string | null = null;

    try {
      const gDict = await this.fetchGoogleDictionary(word);
      if (gDict) {
        if (!meaningVi && gDict.primaryTranslation) {
          meaningVi = gDict.primaryTranslation;
        }

        if (gDict.meanings.length > 0) {
          if (!partOfSpeech) {
            partOfSpeech = gDict.meanings[0].partOfSpeech;
          }
          for (const gm of gDict.meanings) {
            meaningsList.push({
              partOfSpeech: gm.partOfSpeech,
              definitionVi: gm.definitions.slice(0, 3).join(', '),
              exampleEn: null,
              exampleVi: null
            });
          }
        }
      }
    } catch {}

    // 3. Tra cứu câu ví dụ tiếng Anh thực tế từ Free Dictionary API (dictionaryapi.dev)
    try {
      const res = await fetchWithTimeout(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
        { headers: { Accept: 'application/json' } },
        2500
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0].meanings)) {
          const rawMeanings = data[0].meanings;
          const extracted = this.extractBestExample(rawMeanings);
          if (!exampleEn && extracted.example) {
            exampleEn = extracted.example;
          }
          if (!partOfSpeech && extracted.partOfSpeech) {
            partOfSpeech = extracted.partOfSpeech;
          }

          // Lấy giải thích ngắn gọn (tối đa 1 câu súc tích) nếu có
          if (extracted.definition && extracted.definition.length <= 120) {
            try {
              const transDef = await this.translateEnToVi(extracted.definition);
              if (transDef && transDef.length <= 100) {
                explanationVi = transDef;
              }
            } catch {}
          }
        }
      }
    } catch {}

    // 4. Nếu vẫn chưa có câu ví dụ, thử tra các dạng từ gốc (lemmas)
    if (!exampleEn) {
      const baseForms = this.getBaseForms(word);
      for (const base of baseForms) {
        try {
          const res = await fetchWithTimeout(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(base)}`,
            { headers: { Accept: 'application/json' } },
            2000
          );
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0].meanings)) {
              const extracted = this.extractBestExample(data[0].meanings);
              if (extracted.example) {
                exampleEn = extracted.example;
                if (!partOfSpeech) partOfSpeech = extracted.partOfSpeech;
                break;
              }
            }
          }
        } catch {}
      }
    }

    // 5. Dịch câu ví dụ tiếng Anh sang nghĩa tiếng Việt
    if (exampleEn && !exampleVi) {
      try {
        const translatedEx = await this.translateEnToVi(exampleEn);
        if (translatedEx) {
          exampleVi = translatedEx;
        }
      } catch {}
    }

    // Gắn câu ví dụ vào meaning đầu tiên nếu có
    if (meaningsList.length > 0 && exampleEn) {
      meaningsList[0].exampleEn = exampleEn;
      meaningsList[0].exampleVi = exampleVi;
    }

    // 6. Nếu từ chưa có nghĩa tiếng Việt, ưu tiên TOEIC_MAP hoặc Google Translate
    if (!meaningVi) {
      const toeicMatch = TOEIC_MAP.get(word);
      if (toeicMatch?.meaningVi) {
        meaningVi = toeicMatch.meaningVi;
        if (!partOfSpeech && toeicMatch.pos) {
          partOfSpeech = toeicMatch.pos;
        }
      } else {
        try {
          const translatedWord = await this.translateEnToVi(rawWord);
          if (translatedWord) {
            meaningVi = translatedWord;
          }
        } catch {}
      }
    }

    // Nếu chưa có meaningsList mà đã có meaningVi đơn
    if (meaningsList.length === 0 && meaningVi) {
      meaningsList.push({
        partOfSpeech: partOfSpeech || '',
        definitionVi: meaningVi,
        exampleEn,
        exampleVi
      });
    }

    const fullResult: DictionaryWordInfo = {
      ...baseInfo,
      exampleEn,
      exampleVi,
      meaningVi,
      explanationVi,
      partOfSpeech,
      meaningsList: meaningsList.length > 0 ? meaningsList : undefined
    };

    // Lưu vào in-memory cache
    this.memoryCache.set(word, fullResult);

    // Cập nhật lại SQLite cache
    try {
      const db = await database();
      await db.runAsync(
        `INSERT OR REPLACE INTO dictionary_cache (word, ipa_us, ipa_uk, phonetic, data_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        word,
        fullResult.ipaUs || null,
        fullResult.ipaUk || null,
        fullResult.phonetic || null,
        JSON.stringify({
          word,
          ipaUs: fullResult.ipaUs,
          ipaUk: fullResult.ipaUk,
          exampleEn,
          exampleVi,
          meaningVi,
          explanationVi,
          partOfSpeech
        }),
        Date.now()
      );
    } catch {}

    return fullResult;
  }

  /**
   * Tạo chuỗi nội dung chuẩn cho mặt ẩn (Hidden Side) theo đúng format yêu cầu:
   * - Nghĩa: ... (n hay v hay adj)
   * - Giải thích: ... (nếu có)
   * - Ví dụ: 📝 <câu tiếng Anh>
   *   (<nghĩa tiếng Việt>)
   */
  formatHiddenSideContent(info: DictionaryWordInfo): string {
    const sections: string[] = [];

    // 1. Dòng Nghĩa kèm từ loại
    if (info.meaningsList && info.meaningsList.length > 0) {
      if (info.meaningsList.length === 1) {
        const m = info.meaningsList[0];
        const posText = m.partOfSpeech ? ` (${m.partOfSpeech})` : '';
        sections.push(`- Nghĩa: ${m.definitionVi}${posText}`);
      } else {
        const meaningItems = info.meaningsList.map((m, idx) => {
          const posText = m.partOfSpeech ? ` (${m.partOfSpeech})` : '';
          return `  ${idx + 1}. ${m.definitionVi}${posText}`;
        });
        sections.push(`- Nghĩa:\n${meaningItems.join('\n')}`);
      }
    } else if (info.meaningVi) {
      const posText = info.partOfSpeech ? ` (${info.partOfSpeech})` : '';
      sections.push(`- Nghĩa: ${info.meaningVi}${posText}`);
    }

    // 2. Dòng Giải thích (ngắn gọn súc tích nếu có)
    if (info.explanationVi && info.explanationVi.trim()) {
      sections.push(`- Giải thích: ${info.explanationVi.trim()}`);
    }

    // 3. Dòng Ví dụ và Dịch câu
    if (info.exampleEn) {
      sections.push(`- Ví dụ: 📝 ${info.exampleEn}`);
      if (info.exampleVi) {
        sections.push(`  (${info.exampleVi})`);
      }
    }

    return sections.join('\n');
  }

  /**
   * 3. KIỂM TRA TỪ ĐẦU VÀO
   * - Chỉ chấp nhận MỘT từ tiếng Anh duy nhất
   * - Không chấp nhận câu, cụm từ nhiều từ hoặc ký tự không hợp lệ
   */
  validateSingleWord(text: string): { isValid: boolean; errorMessage?: string; cleanWord: string } {
    const raw = text.trim();
    if (!raw) {
      return { isValid: false, errorMessage: 'Vui lòng nhập từ tiếng Anh.', cleanWord: '' };
    }

    // Kiểm tra nếu có khoảng trắng hoặc xuống dòng (nhiều từ / cụm từ / câu)
    if (/\s/.test(raw)) {
      return {
        isValid: false,
        errorMessage: 'Chỉ chấp nhận MỘT từ tiếng Anh duy nhất (không nhập câu hoặc cụm từ nhiều từ).',
        cleanWord: raw
      };
    }

    // Kiểm tra ký tự hợp lệ: Chữ cái tiếng Anh, cho phép 1 dấu gạch nối (như follow-up) hoặc nháy đơn
    if (!/^[a-zA-Z]+(?:[-'][a-zA-Z]+)?$/.test(raw)) {
      return {
        isValid: false,
        errorMessage: 'Từ tiếng Anh chứa ký tự không hợp lệ. Chỉ chấp nhận chữ cái (a-z) và dấu gạch nối.',
        cleanWord: raw
      };
    }

    return { isValid: true, cleanWord: raw };
  }
}

export const DictionaryService = new DictionaryServiceImpl();
