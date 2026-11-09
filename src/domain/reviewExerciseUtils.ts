import { TOEIC_MAP } from '../data/toeicWordlist';

// Trích xuất nghĩa tiếng Việt ngắn gọn, kèm từ loại nếu có
export function extractCleanMeaning(text: string): string {
  if (!text) return 'Nghĩa từ vựng';
  const firstLine = text.split('\n')[0].trim();
  // Loại bỏ các tiền tố như "1. ", "- "
  const cleaned = firstLine.replace(/^[0-9.]+\s*/, '').replace(/^[-*]\s*/, '');
  return cleaned || firstLine;
}

// Trích xuất câu ví dụ và thay từ vựng bằng gạch trống ______
export function extractExampleSentence(
  content: string,
  targetWord: string
): { clozeSentence: string; translation: string | null } | null {
  if (!content) return null;
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('📝')) {
      const sentence = line.replace(/^📝\s*/, '').trim();
      let translation: string | null = null;
      if (i + 1 < lines.length) {
        const next = lines[i + 1].trim();
        if (next.startsWith('(') && next.endsWith(')')) {
          translation = next.slice(1, -1);
        }
      }
      // Thay thế từ mục tiêu bằng chỗ trống
      const regex = new RegExp(`\\b${targetWord}\\b`, 'gi');
      const clozeSentence = sentence.replace(regex, '______');
      return { clozeSentence, translation };
    }
  }
  return null;
}

// Lấy danh sách họ từ mô phỏng TOEIC
export function getWordFamily(
  word: string
): { pos: string; word: string; meaning: string }[] {
  const clean = word.toLowerCase().trim();
  const toeic = TOEIC_MAP.get(clean);

  // Mẫu word families phong phú chuẩn đề thi TOEIC
  const knownFamilies: Record<string, { pos: string; word: string; meaning: string }[]> = {
    decide: [
      { pos: 'verb', word: 'decide', meaning: 'quyết định' },
      { pos: 'noun', word: 'decision', meaning: 'sự quyết định' },
      { pos: 'adj', word: 'decisive', meaning: 'mang tính quyết đoán' }
    ],
    contract: [
      { pos: 'noun', word: 'contract', meaning: 'hợp đồng' },
      { pos: 'verb', word: 'contract', meaning: 'ký kết hợp đồng, thu nhỏ' },
      { pos: 'adj', word: 'contractual', meaning: 'thuộc về hợp đồng' }
    ],
    compete: [
      { pos: 'verb', word: 'compete', meaning: 'cạnh tranh, thi đua' },
      { pos: 'noun', word: 'competition', meaning: 'sự cạnh tranh, cuộc thi' },
      { pos: 'adj', word: 'competitive', meaning: 'có tính cạnh tranh' }
    ],
    satisfy: [
      { pos: 'verb', word: 'satisfy', meaning: 'làm hài lòng, thỏa mãn' },
      { pos: 'noun', word: 'satisfaction', meaning: 'sự hài lòng' },
      { pos: 'adj', word: 'satisfactory', meaning: 'thỏa đáng, vừa ý' }
    ],
    inform: [
      { pos: 'verb', word: 'inform', meaning: 'thông báo, báo tin' },
      { pos: 'noun', word: 'information', meaning: 'thông tin' },
      { pos: 'adj', word: 'informative', meaning: 'cung cấp nhiều tin tức hữu ích' }
    ]
  };

  if (knownFamilies[clean]) {
    return knownFamilies[clean];
  }

  // Tự động suy luận dạng cơ bản
  return [
    { pos: toeic?.pos || 'word', word: clean, meaning: toeic?.meaningVi || 'từ gốc' },
    { pos: 'noun', word: `${clean}tion`, meaning: 'dạng danh từ' },
    { pos: 'adj', word: `${clean}ive`, meaning: 'dạng tính từ' }
  ];
}
