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
});
