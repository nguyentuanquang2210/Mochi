import { describe, expect, it } from 'vitest';
import {
  extractCleanMeaning,
  extractExampleSentence,
  getWordFamily
} from './reviewExerciseUtils';

describe('ReviewExerciseUtils', () => {
  describe('extractCleanMeaning', () => {
    it('should strip numerical list prefixes', () => {
      expect(extractCleanMeaning('1. quyết định, lựa chọn')).toBe('quyết định, lựa chọn');
      expect(extractCleanMeaning('2. Người điều khiển (noun)')).toBe('Người điều khiển (noun)');
    });

    it('should strip dash and bullet prefixes', () => {
      expect(extractCleanMeaning('- từ chức')).toBe('từ chức');
      expect(extractCleanMeaning('* sa thải')).toBe('sa thải');
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
