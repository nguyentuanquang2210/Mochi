import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system/legacy', () => ({
  uploadAsync: vi.fn(),
  FileSystemUploadType: { BINARY_CONTENT: 0 }
}));

import { SpeechRecognitionService } from './speechRecognition';

describe('SpeechRecognitionService', () => {
  it('should normalize text properly', () => {
    expect(SpeechRecognitionService.normalizeText('Hello, World!')).toBe('hello world');
    expect(SpeechRecognitionService.normalizeText('  Contract... ')).toBe('contract');
  });

  it('should accurately match target words', () => {
    expect(SpeechRecognitionService.isMatch('contract', 'contract')).toBe(true);
    expect(SpeechRecognitionService.isMatch('Contract.', 'contract')).toBe(true);
    expect(SpeechRecognitionService.isMatch('I said contract', 'contract')).toBe(true);
    expect(SpeechRecognitionService.isMatch('apple', 'contract')).toBe(false);
  });
});
