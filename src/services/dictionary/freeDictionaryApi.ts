/**
 * Free Dictionary API Adapter
 * Documentation: https://freedictionaryapi.com/api/v1
 * Base URL: https://freedictionaryapi.com/api/v1
 * License: Wiktionary / Creative Commons Attribution-ShareAlike (CC BY-SA)
 */

import { WordSense } from './types';

export interface FreeDictionaryParsedResult {
  word: string;
  ipaUs?: string | null;
  ipaUk?: string | null;
  audioUsUrl?: string | null;
  audioUkUrl?: string | null;
  inflections: string[];
  senses: WordSense[];
  attribution: string;
}

export class FreeDictionaryApi {
  private static BASE_URL = 'https://freedictionaryapi.com/api/v1';

  /**
   * Tra cứu từ vựng từ Free Dictionary API (freedictionaryapi.com/api/v1)
   * Tự động dự phòng sang api.dictionaryapi.dev nếu dịch vụ v1 quá tải
   */
  static async lookup(rawWord: string, timeoutMs = 3500): Promise<FreeDictionaryParsedResult | null> {
    const word = rawWord.trim().toLowerCase();
    if (!word) return null;

    // 1. Thử gọi nguồn chính thức: freedictionaryapi.com/api/v1
    const v1Result = await this.fetchV1(word, timeoutMs);
    if (v1Result && v1Result.senses.length > 0) {
      return v1Result;
    }

    // 2. Dự phòng an toàn sang api.dictionaryapi.dev nếu v1 không có kết quả
    return await this.fetchDictionaryApiDev(word, timeoutMs);
  }

  /**
   * Gọi freedictionaryapi.com/api/v1/entries/en/{word}?translations=true
   */
  private static async fetchV1(word: string, timeoutMs: number): Promise<FreeDictionaryParsedResult | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${this.BASE_URL}/entries/en/${encodeURIComponent(word)}?translations=true`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) return null;
      const data = await res.json();

      if (!data || !Array.isArray(data.entries) || data.entries.length === 0) {
        return null;
      }

      let ipaUs: string | null = null;
      let ipaUk: string | null = null;
      let audioUsUrl: string | null = null;
      let audioUkUrl: string | null = null;
      const inflections: string[] = [];
      const senses: WordSense[] = [];

      let senseCounter = 1;

      for (const entry of data.entries) {
        const pos = (entry.partOfSpeech || 'từ vựng').toLowerCase();

        // 1. Phiên âm IPA & Audio
        if (Array.isArray(entry.pronunciations)) {
          for (const pr of entry.pronunciations) {
            const isUs = Array.isArray(pr.tags) && pr.tags.some((t: string) => /us|american/i.test(t));
            const isUk = Array.isArray(pr.tags) && pr.tags.some((t: string) => /uk|british/i.test(t));

            if (pr.type === 'ipa' || (pr.text && pr.text.includes('/'))) {
              const text = pr.text.trim();
              if (isUk && !ipaUk) {
                ipaUk = text;
              } else if (!ipaUs || isUs) {
                ipaUs = text;
              }
            } else if (pr.url && typeof pr.url === 'string') {
              if (isUk && !audioUkUrl) {
                audioUkUrl = pr.url;
              } else if (!audioUsUrl || isUs) {
                audioUsUrl = pr.url;
              }
            }
          }
        }

        // 2. Forms / Inflections
        if (Array.isArray(entry.forms)) {
          for (const form of entry.forms) {
            if (form.word && typeof form.word === 'string') {
              const cleanForm = form.word.trim();
              if (cleanForm && !inflections.includes(cleanForm)) {
                inflections.push(cleanForm);
              }
            }
          }
        }

        // 3. Senses
        if (Array.isArray(entry.senses)) {
          for (const senseItem of entry.senses) {
            if (!senseItem.definition) continue;
            const defEn = senseItem.definition.trim();
            if (defEn.length < 3) continue;

            const examples = Array.isArray(senseItem.examples)
              ? senseItem.examples.filter((e: any) => typeof e === 'string' && e.trim().length > 5)
              : [];
            const exampleEn = examples.length > 0 ? examples[0].trim() : null;

            const synonyms = Array.isArray(senseItem.synonyms)
              ? senseItem.synonyms.filter((s: any) => typeof s === 'string').slice(0, 5)
              : [];
            const antonyms = Array.isArray(senseItem.antonyms)
              ? senseItem.antonyms.filter((a: any) => typeof a === 'string').slice(0, 5)
              : [];

            // Kiểm tra xem Wiktionary có sẵn bản dịch tiếng Việt cho nét nghĩa này không
            let directViTranslation = '';
            if (Array.isArray(senseItem.translations)) {
              const viTrans = senseItem.translations.find(
                (t: any) => t.language === 'vi' || t.language === 'vie'
              );
              if (viTrans?.word) {
                directViTranslation = viTrans.word.trim();
              }
            }

            senses.push({
              id: `fd-${word}-${pos.slice(0, 1)}-${senseCounter++}`,
              partOfSpeech: pos,
              definitionEn: defEn,
              meaningVi: directViTranslation,
              exampleEn,
              exampleVi: null,
              toeicPriority: 'medium',
              synonyms,
              antonyms,
              source: 'free_dictionary',
              sourceAttribution: 'Wiktionary via Free Dictionary API v1'
            });
          }
        }
      }

      return {
        word,
        ipaUs,
        ipaUk,
        audioUsUrl,
        audioUkUrl,
        inflections,
        senses,
        attribution: data.source?.name ? `${data.source.name} via Free Dictionary API` : 'Free Dictionary API (Wiktionary)'
      };
    } catch {
      clearTimeout(timer);
      return null;
    }
  }

  /**
   * Dự phòng cho dictionaryapi.dev (chuẩn OpenAPI)
   */
  private static async fetchDictionaryApiDev(word: string, timeoutMs: number): Promise<FreeDictionaryParsedResult | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;

      const first = data[0];
      let ipaUs: string | null = null;
      let ipaUk: string | null = null;
      let audioUsUrl: string | null = null;
      let audioUkUrl: string | null = null;
      const senses: WordSense[] = [];
      let senseCounter = 1;

      if (Array.isArray(first.phonetics)) {
        for (const p of first.phonetics) {
          if (p.text && !ipaUs) {
            ipaUs = p.text;
          }
          if (p.audio && typeof p.audio === 'string') {
            if (p.audio.includes('-uk') && !audioUkUrl) {
              audioUkUrl = p.audio;
            } else if (!audioUsUrl) {
              audioUsUrl = p.audio;
            }
          }
        }
      }

      if (Array.isArray(first.meanings)) {
        for (const m of first.meanings) {
          const pos = (m.partOfSpeech || 'từ vựng').toLowerCase();
          const defs = Array.isArray(m.definitions) ? m.definitions : [];

          for (const d of defs) {
            if (!d.definition) continue;
            const defEn = d.definition.trim();
            const exEn = d.example ? d.example.trim() : null;
            const syns = Array.isArray(d.synonyms) ? d.synonyms.slice(0, 5) : [];
            const ants = Array.isArray(d.antonyms) ? d.antonyms.slice(0, 5) : [];

            senses.push({
              id: `fd-dev-${word}-${pos.slice(0, 1)}-${senseCounter++}`,
              partOfSpeech: pos,
              definitionEn: defEn,
              meaningVi: '',
              exampleEn: exEn,
              exampleVi: null,
              toeicPriority: 'medium',
              synonyms: syns,
              antonyms: ants,
              source: 'free_dictionary',
              sourceAttribution: 'Free Dictionary API'
            });
          }
        }
      }

      return {
        word,
        ipaUs,
        ipaUk,
        audioUsUrl,
        audioUkUrl,
        inflections: [],
        senses,
        attribution: 'Free Dictionary API'
      };
    } catch {
      clearTimeout(timer);
      return null;
    }
  }
}
