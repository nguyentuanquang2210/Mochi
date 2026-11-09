import { describe, it, expect, vi } from 'vitest';

vi.mock('../data/database', () => ({
  database: vi.fn().mockResolvedValue({
    getAllAsync: vi.fn().mockResolvedValue([]),
    getFirstAsync: vi.fn().mockResolvedValue(null),
    runAsync: vi.fn().mockResolvedValue(null)
  })
}));

import { DictionaryService } from './dictionary';

describe('DictionaryService', () => {
  it('should validate single English word correctly', () => {
    // Valid words
    expect(DictionaryService.validateSingleWord('acquisition').isValid).toBe(true);
    expect(DictionaryService.validateSingleWord('follow-up').isValid).toBe(true);
    expect(DictionaryService.validateSingleWord('applied').isValid).toBe(true);

    // Invalid multi-word / sentence
    const multiWord = DictionaryService.validateSingleWord('this is a sentence');
    expect(multiWord.isValid).toBe(false);
    expect(multiWord.errorMessage).toContain('MỘT từ');

    // Invalid characters
    const withNumbers = DictionaryService.validateSingleWord('test123');
    expect(withNumbers.isValid).toBe(false);

    // Empty
    const empty = DictionaryService.validateSingleWord('');
    expect(empty.isValid).toBe(false);
  });

  it('should return TOEIC autocomplete suggestions with prefix priority', async () => {
    // Query "acqui"
    const suggestions = await DictionaryService.searchSuggestions('acqui');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(8);

    // acquire or acquisition should be among top results
    const words = suggestions.map(s => s.word.toLowerCase());
    expect(words).toContain('acquire');
    expect(words).toContain('acquisition');

    // First item should be a prefix match
    expect(words[0].startsWith('acqui')).toBe(true);

    // Query less than 2 characters should return empty
    const singleChar = await DictionaryService.searchSuggestions('a');
    expect(singleChar).toEqual([]);
  });

  it('should lookup TOEIC word and return correct IPA without AI hallucination', async () => {
    const info = await DictionaryService.lookupWord('acquisition');
    expect(info.verified).toBe(true);
    expect(info.word.toLowerCase()).toBe('acquisition');
    expect(info.ipaUs).toBeTruthy();
    expect(info.ipaUs).toMatch(/^\/.*\/$/);
  });

  it('should reliably return IPA for inflected English words via dual-engine fallback', async () => {
    // Tests words like 'interviews' or 'postponed' where dictionaryapi.dev often omits phonetics
    const info = await DictionaryService.lookupWord('interviews');
    expect(info.verified).toBe(true);
    expect(info.ipaUs || info.phonetic).toBeTruthy();
    expect((info.ipaUs || info.phonetic)!).toMatch(/^\/.*\/$/);

    // Test 'revised' as reported in user screenshot
    const revisedInfo = await DictionaryService.lookupWord('revised');
    expect(revisedInfo.verified).toBe(true);
    expect(revisedInfo.ipaUs || revisedInfo.phonetic).toBeTruthy();
    expect((revisedInfo.ipaUs || revisedInfo.phonetic)!).toMatch(/^\/.*\/$/);
  });

  it('should return full dictionary info with example sentence and Vietnamese translation', async () => {
    const full = await DictionaryService.lookupWordFull('acquisition');
    expect(full.verified).toBe(true);
    expect(full.meaningVi).toBeTruthy();
    expect(full.ipaUs || full.phonetic).toBeTruthy();
    // acquisition has example in DictionaryAPI
    if (full.exampleEn) {
      expect(typeof full.exampleEn).toBe('string');
      expect(full.exampleEn.length).toBeGreaterThan(5);
    }
  }, 10000);

  it('should translate single words and phrases for interactive tooltips', async () => {
    const phraseTrans = await DictionaryService.translateWordOrPhrase('your friends');
    expect(phraseTrans.toLowerCase()).toContain('bạn');

    const singleTrans = await DictionaryService.translateWordOrPhrase('come in');
    expect(singleTrans.toLowerCase()).toContain('vào');
  });

  describe('Multi-Sense Aggregation (Merriam-Webster & Free Dictionary)', () => {
    it('should aggregate multi-senses for "address" with distinct noun and verb senses', async () => {
      const entry = await DictionaryService.lookupAggregatedWord('address');
      expect(entry.word).toBe('address');
      expect(entry.senses.length).toBeGreaterThanOrEqual(2);

      // Verify noun sense (địa chỉ)
      const nounSense = entry.senses.find(s => s.partOfSpeech.toLowerCase().includes('noun'));
      expect(nounSense).toBeTruthy();
      expect(nounSense!.meaningVi).toContain('địa chỉ');

      // Verify verb sense (giải quyết hoặc phát biểu) with high TOEIC priority
      const verbSense = entry.senses.find(s => s.partOfSpeech.toLowerCase().includes('verb'));
      expect(verbSense).toBeTruthy();
      expect(verbSense!.toeicPriority).toBe('high');
      expect(verbSense!.exampleEn).toBeTruthy();
    });

    it('should aggregate multi-senses for "acquisition" with business sense prioritized', async () => {
      const entry = await DictionaryService.lookupAggregatedWord('acquisition');
      expect(entry.word).toBe('acquisition');
      expect(entry.senses.length).toBeGreaterThanOrEqual(2);

      // Top sense should be high priority business acquisition
      expect(entry.senses[0].toeicPriority).toBe('high');
      expect(entry.senses[0].meaningVi).toContain('mua lại');
      expect(entry.senses[0].exampleEn).toBeTruthy();
      expect(entry.senses[0].exampleVi).toBeTruthy();
    });

    it('should aggregate multi-senses for "conduct" (verb: tiến hành, noun: tư cách đạo đức)', async () => {
      const entry = await DictionaryService.lookupAggregatedWord('conduct');
      expect(entry.word).toBe('conduct');
      expect(entry.senses.length).toBeGreaterThanOrEqual(2);

      const verbSense = entry.senses.find(s => s.partOfSpeech === 'verb');
      expect(verbSense).toBeTruthy();
      expect(verbSense!.meaningVi).toContain('tiến hành');

      const nounSense = entry.senses.find(s => s.partOfSpeech === 'noun');
      expect(nounSense).toBeTruthy();
      expect(nounSense!.meaningVi).toContain('ứng xử');
    });

    it('should aggregate multi-senses for "issue", "offer", "charge", and "account"', async () => {
      for (const target of ['issue', 'offer', 'charge', 'account']) {
        const entry = await DictionaryService.lookupAggregatedWord(target);
        expect(entry.word).toBe(target);
        expect(entry.senses.length).toBeGreaterThanOrEqual(2);

        // Every sense must have clean separated fields
        for (const s of entry.senses) {
          expect(s.partOfSpeech).toBeTruthy();
          expect(s.definitionEn).toBeTruthy();
          expect(s.meaningVi).toBeTruthy();
          expect(s.toeicPriority).toBeTruthy();
        }
      }
    });

    it('should format hidden side content properly from selected senses', () => {
      const sampleSenses = [
        {
          id: 'test-1',
          partOfSpeech: 'verb',
          definitionEn: 'to deal with a problem',
          meaningVi: 'giải quyết, xử lý',
          exampleEn: 'We must address the issue.',
          exampleVi: 'Chúng ta phải giải quyết vấn đề.',
          toeicPriority: 'high' as const,
          synonyms: [],
          antonyms: [],
          source: 'merged' as const,
          sourceAttribution: 'Merriam-Webster & Free Dictionary'
        },
        {
          id: 'test-2',
          partOfSpeech: 'noun',
          definitionEn: 'location of a person or office',
          meaningVi: 'địa chỉ',
          exampleEn: 'What is your address?',
          exampleVi: 'Địa chỉ của bạn là gì?',
          toeicPriority: 'medium' as const,
          synonyms: [],
          antonyms: [],
          source: 'free_dictionary' as const,
          sourceAttribution: 'Free Dictionary'
        }
      ];

      const formatted = DictionaryService.formatHiddenSideFromSenses(sampleSenses);
      expect(formatted).toContain('- Nghĩa: giải quyết, xử lý (verb)');
      expect(formatted).toContain('- Câu ví dụ: 📝 We must address the issue.');
      expect(formatted).toContain('(Chúng ta phải giải quyết vấn đề.)');
      expect(formatted).toContain('- Nghĩa: địa chỉ (noun)');
      expect(formatted).toContain('- Câu ví dụ: 📝 What is your address?');
    });
  });
});
