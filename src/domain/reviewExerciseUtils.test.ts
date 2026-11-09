import { describe, expect, it } from 'vitest';
import {
  extractCleanMeaning,
  extractExampleSentence,
  extractMeanings,
  getWordFamily
} from './reviewExerciseUtils';

describe('ReviewExerciseUtils', () => {
  describe('extractMeanings & extractCleanMeaning', () => {
    it('should extract structured format with - Nghĩa: line', () => {
      const content = `- Nghĩa: cái xẻng (n), xúc bằng xẻng (v)\n- Giải thích: Dụng cụ dùng để xúc đào\n- Ví dụ: 📝 He used a shovel.`;
      const res = extractMeanings(content, 'shovel');
      expect(res.primaryMeaning).toBe('cái xẻng (n)');
      expect(res.otherMeanings).toEqual(['xúc bằng xẻng (v)']);
    });

    it('should extract multiline meanings under - Nghĩa:', () => {
      const content = `- Nghĩa:\n  1. cái xẻng (noun)\n  2. xúc bằng xẻng (verb)\n- Giải thích: Dụng cụ...`;
      const res = extractMeanings(content, 'shovel');
      expect(res.primaryMeaning).toBe('cái xẻng (noun)');
      expect(res.otherMeanings).toEqual(['xúc bằng xẻng (verb)']);
    });

    it('should strip numerical list prefixes for legacy cards', () => {
      expect(extractCleanMeaning('1. quyết định, lựa chọn')).toBe('quyết định, lựa chọn');
      expect(extractCleanMeaning('2. Người điều khiển (noun)')).toBe('Người điều khiển (noun)');
    });

    it('should strip dash and bullet prefixes', () => {
      expect(extractCleanMeaning('- từ chức')).toBe('từ chức');
      expect(extractCleanMeaning('* sa thải')).toBe('sa thải');
    });

    it('should truncate or clean long encyclopedic paragraphs so they do not overflow', () => {
      const longText = 'tuyết và ngũ cốc từ nơi này sang nơi khác, với một số dạng cũng được sử dụng để đào. Đừng nhầm lẫn với một cái thuổng...';
      const clean = extractCleanMeaning(longText);
      expect(clean.length).toBeLessThanOrEqual(45);
      expect(clean).not.toContain('Đừng nhầm lẫn với một cái thuổng');
    });

    it('should return fallback if empty string', () => {
      expect(extractCleanMeaning('')).toBe('Nghĩa từ vựng');
    });
  });

  describe('extractExampleSentence', () => {
    it('should extract example sentence and blank out the target word', () => {
      const content = `resign\n---\ntừ chức\n📝 The manager decided to resign from his position.\n(Người quản lý đã quyết định từ chức khỏi vị trí của mình.)`;
      const res = extractExampleSentence(content, 'resign');
      expect(res).not.toBeNull();
      expect(res?.clozeSentence).toBe('The manager decided to ______ from his position.');
      expect(res?.translation).toBe('Người quản lý đã quyết định từ chức khỏi vị trí của mình.');
    });

    it('should handle case insensitivity when blanking out word', () => {
      const content = `📝 Resign immediately when asked.\n(Hãy từ chức ngay khi được yêu cầu.)`;
      const res = extractExampleSentence(content, 'resign');
      expect(res?.clozeSentence).toBe('______ immediately when asked.');
    });

    it('should return null if no 📝 example sentence exists', () => {
      const content = `just a plain card front\n---\nplain back`;
      expect(extractExampleSentence(content, 'word')).toBeNull();
    });
  });

  describe('getWordFamily', () => {
    it('should return known TOEIC word families', () => {
      const families = getWordFamily('decide');
      expect(families).toHaveLength(3);
      expect(families[0]).toEqual({ pos: 'verb', word: 'decide', meaning: 'quyết định' });
      expect(families[1]).toEqual({ pos: 'noun', word: 'decision', meaning: 'sự quyết định' });
      expect(families[2]).toEqual({ pos: 'adj', word: 'decisive', meaning: 'mang tính quyết đoán' });
    });

    it('should fall back to generated family variants for other words', () => {
      const families = getWordFamily('test');
      expect(families.length).toBeGreaterThanOrEqual(3);
      expect(families[0].word).toBe('test');
      expect(families[1].word).toBe('testtion');
    });
  });
});
