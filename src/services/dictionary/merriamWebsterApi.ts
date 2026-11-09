/**
 * Merriam-Webster Learner's Dictionary API Adapter
 * Documentation: https://dictionaryapi.com/products/api-learners-dictionary
 * Endpoint: https://www.dictionaryapi.com/api/v3/references/learners/json/{word}?key={KEY}
 */

import { WordSense } from './types';

export interface MwParsedResult {
  word: string;
  ipaUs?: string | null;
  audioUsUrl?: string | null;
  inflections: string[];
  senses: WordSense[];
  attribution: string;
}

export class MerriamWebsterApi {
  private static apiKey: string | null =
    (typeof process !== 'undefined' && (process.env?.EXPO_PUBLIC_MERRIAM_WEBSTER_KEY || process.env?.MERRIAM_WEBSTER_KEY)) || null;

  /**
   * Cấu hình API key động nếu người dùng nhập trong cài đặt
   */
  static setApiKey(key: string | null) {
    this.apiKey = key ? key.trim() : null;
  }

  static getApiKey(): string | null {
    return this.apiKey;
  }

  /**
   * Tạo URL âm thanh chuẩn theo quy tắc phân thư mục của Merriam-Webster
   */
  static constructAudioUrl(audioFilename: string): string {
    if (!audioFilename) return '';
    let subdir = audioFilename[0];
    if (audioFilename.startsWith('bix')) {
      subdir = 'bix';
    } else if (audioFilename.startsWith('gg')) {
      subdir = 'gg';
    } else if (/^[0-9\W]/.test(audioFilename)) {
      subdir = 'number';
    }
    return `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdir}/${audioFilename}.mp3`;
  }

  /**
   * Làm sạch các thẻ định dạng đặc thù của Merriam-Webster ({bc}, {wi}, {it}, {a_link}...)
   */
  static cleanMwMarkup(text: string): string {
    if (!text) return '';
    return text
      .replace(/\{bc\}/g, '')
      .replace(/\{wi\}(.*?)\{\/wi\}/g, '$1')
      .replace(/\{it\}(.*?)\{\/it\}/g, '$1')
      .replace(/\{b\}(.*?)\{\/b\}/g, '$1')
      .replace(/\{phrase\}(.*?)\{\/phrase\}/g, '$1')
      .replace(/\{qword\}(.*?)\{\/qword\}/g, '$1')
      .replace(/\{gloss\}(.*?)\{\/gloss\}/g, '$1')
      .replace(/\{d_link\|([^|}]+)[^}]*\}/g, '$1')
      .replace(/\{sx\|([^|}]+)[^}]*\}/g, '$1')
      .replace(/\{a_link\|([^|}]+)[^}]*\}/g, '$1')
      .replace(/\{dxt\|([^|}]+)[^}]*\}/g, '$1')
      .replace(/\{dx_def\}(.*?)\{\/dx_def\}/g, '')
      .replace(/\{dx\}.*?\{\/dx\}/g, '')
      .replace(/\{[a-z_]+(?::[0-9]+)?\|?([^}]*)\}/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tra cứu từ vựng từ Merriam-Webster Learner's Dictionary
   */
  static async lookup(rawWord: string, timeoutMs = 3500): Promise<MwParsedResult | null> {
    const word = rawWord.trim().toLowerCase();
    if (!word) return null;

    const key = this.getApiKey();
    if (!key) {
      // Không có API key được cấu hình -> trả về null để fallback sang Free Dictionary API
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `https://www.dictionaryapi.com/api/v3/references/learners/json/${encodeURIComponent(word)}?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        return null;
      }

      // Nếu từ không tồn tại, MW trả về mảng chuỗi gợi ý (spelling suggestions)
      if (typeof data[0] === 'string') {
        return null;
      }

      let ipaUs: string | null = null;
      let audioUsUrl: string | null = null;
      const inflections: string[] = [];
      const senses: WordSense[] = [];

      let senseCounter = 1;

      for (const entry of data) {
        if (!entry || typeof entry !== 'object') continue;

        // 1. Headword & IPA & Audio
        if (entry.hwi) {
          if (!ipaUs && Array.isArray(entry.hwi.prs)) {
            for (const pr of entry.hwi.prs) {
              if (pr.ipa) {
                ipaUs = `/${pr.ipa}/`;
              }
              if (pr.sound?.audio && !audioUsUrl) {
                audioUsUrl = this.constructAudioUrl(pr.sound.audio);
              }
              if (ipaUs && audioUsUrl) break;
            }
          }
        }

        // 2. Từ loại (Part of Speech)
        const pos = (entry.fl || 'từ vựng').toLowerCase();

        // 3. Inflections
        if (Array.isArray(entry.ins)) {
          for (const inf of entry.ins) {
            if (inf.if) {
              const cleanIf = inf.if.replace(/\*/g, '').trim();
              if (cleanIf && !inflections.includes(cleanIf)) {
                inflections.push(cleanIf);
              }
            }
          }
        }

        // 4. Các định nghĩa & ví dụ (Definitions & Examples)
        if (Array.isArray(entry.def)) {
          for (const defObj of entry.def) {
            if (!Array.isArray(defObj.sseq)) continue;

            for (const sseqItem of defObj.sseq) {
              if (!Array.isArray(sseqItem)) continue;

              for (const subItem of sseqItem) {
                if (!Array.isArray(subItem) || subItem.length < 2) continue;
                const type = subItem[0];
                const content = subItem[1];

                // Xử lý sense trực tiếp hoặc bs (binding sense)
                const targetSenses: any[] = [];
                if (type === 'sense') {
                  targetSenses.push(content);
                } else if (type === 'bs' && content?.sense) {
                  targetSenses.push(content.sense);
                }

                for (const s of targetSenses) {
                  if (!Array.isArray(s.dt)) continue;

                  let rawDefText = '';
                  let rawExample = '';

                  for (const dtItem of s.dt) {
                    if (!Array.isArray(dtItem) || dtItem.length < 2) continue;
                    const dtType = dtItem[0];
                    const dtVal = dtItem[1];

                    if (dtType === 'text' && typeof dtVal === 'string') {
                      rawDefText += ' ' + dtVal;
                    } else if (dtType === 'vis' && Array.isArray(dtVal) && dtVal.length > 0) {
                      const firstEx = dtVal[0]?.t;
                      if (firstEx && typeof firstEx === 'string' && !rawExample) {
                        rawExample = firstEx;
                      }
                    }
                  }

                  const cleanDef = this.cleanMwMarkup(rawDefText);
                  const cleanEx = rawExample ? this.cleanMwMarkup(rawExample) : null;

                  if (cleanDef && cleanDef.length >= 3) {
                    senses.push({
                      id: `mw-${word}-${pos.slice(0, 1)}-${senseCounter++}`,
                      partOfSpeech: pos,
                      definitionEn: cleanDef,
                      meaningVi: '', // Sẽ được dịch và điền bởi dictionaryAggregator
                      exampleEn: cleanEx,
                      exampleVi: null,
                      toeicPriority: 'medium',
                      synonyms: [],
                      antonyms: [],
                      source: 'merriam_webster',
                      sourceAttribution: 'Merriam-Webster Learner\'s Dictionary'
                    });
                  }
                }
              }
            }
          }
        }
      }

      return {
        word,
        ipaUs,
        audioUsUrl,
        inflections,
        senses,
        attribution: 'Merriam-Webster Learner\'s Dictionary'
      };
    } catch {
      clearTimeout(timer);
      return null;
    }
  }
}
