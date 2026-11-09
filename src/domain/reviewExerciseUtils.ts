import { TOEIC_MAP } from '../data/toeicWordlist';

export interface ExtractedMeanings {
  primaryMeaning: string;
  otherMeanings: string[];
}

/**
 * Trích xuất các nét nghĩa tiếng Việt cô đọng từ nội dung thẻ (bỏ qua giải thích dài và câu ví dụ)
 * Hỗ trợ tách nghĩa chính và các nghĩa phụ để hiển thị dạng dropdown gọn gàng không tràn màn hình
 */
export function extractMeanings(content: string, targetWord?: string): ExtractedMeanings {
  if (!content) {
    if (targetWord && TOEIC_MAP.has(targetWord.toLowerCase().trim())) {
      const t = TOEIC_MAP.get(targetWord.toLowerCase().trim())!;
      return {
        primaryMeaning: t.meaningVi + (t.pos ? ` (${t.pos})` : ''),
        otherMeanings: []
      };
    }
    return { primaryMeaning: 'Nghĩa từ vựng', otherMeanings: [] };
  }

  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Kiểm tra format chuẩn "- Nghĩa: ..."
  const nghiaLineIndex = lines.findIndex(l => /^-?\s*nghĩa\s*:/i.test(l));
  if (nghiaLineIndex !== -1) {
    const rawNghiaHeader = lines[nghiaLineIndex].replace(/^-?\s*nghĩa\s*:\s*/i, '').trim();
    const collected: string[] = [];

    if (rawNghiaHeader) {
      // Có thể là "- Nghĩa: cái xẻng (n), xúc bằng xẻng (v)"
      const parts = rawNghiaHeader.split(/[,;]/).map(p => p.trim()).filter(Boolean);
      collected.push(...parts);
    }

    // Quét các dòng danh sách tiếp theo: "1. cái xẻng (n)", "2. ..."
    for (let i = nghiaLineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('- ') || line.startsWith('📝')) break; // Sang mục khác (Giải thích, Ví dụ)
      const cleanLine = line.replace(/^[0-9.]+\s*/, '').replace(/^[-*•]\s*/, '').trim();
      if (cleanLine) {
        collected.push(cleanLine);
      }
    }

    if (collected.length > 0) {
      return {
        primaryMeaning: collected[0],
        otherMeanings: collected.slice(1)
      };
    }
  }

  // 2. Kiểm tra format danh sách số "1. (noun) ... \n 2. (verb) ..."
  const numberedMeanings: string[] = [];
  for (const line of lines) {
    if (line.startsWith('📝') || line.startsWith('(')) continue;
    if (/^[0-9]+\.\s*/.test(line)) {
      const cleanLine = line.replace(/^[0-9]+\.\s*/, '').trim();
      if (cleanLine) numberedMeanings.push(cleanLine);
    }
  }
  if (numberedMeanings.length > 0) {
    return {
      primaryMeaning: numberedMeanings[0],
      otherMeanings: numberedMeanings.slice(1)
    };
  }

  // 3. Nếu là thẻ cũ hoặc đoạn văn dài:
  const firstLine = lines.find(l => !l.startsWith('📝') && !l.startsWith('(') && !l.startsWith('- Giải thích') && !l.startsWith('- Ví dụ')) || lines[0];
  let cleaned = firstLine.replace(/^[0-9.]+\s*/, '').replace(/^[-*•]\s*/, '').trim();

  // Nếu đoạn văn giải thích quá dài (như ở thẻ shovel "tuyết và ngũ cốc từ nơi này sang nơi khác..."):
  if (cleaned.length > 45) {
    // Ưu tiên kiểm tra TOEIC_MAP trước
    if (targetWord) {
      const t = TOEIC_MAP.get(targetWord.toLowerCase().trim());
      if (t) {
        return {
          primaryMeaning: t.meaningVi + (t.pos ? ` (${t.pos})` : ''),
          otherMeanings: []
        };
      }
    }

    // Cắt vế đầu tiên trước dấu chấm/phẩy dài để không tràn màn hình
    const firstSentence = cleaned.split(/[.;]/)[0].trim();
    if (firstSentence && firstSentence.length <= 40) {
      cleaned = firstSentence;
    } else {
      cleaned = cleaned.slice(0, 38).trim() + '...';
    }
  }

  return {
    primaryMeaning: cleaned || 'Nghĩa từ vựng',
    otherMeanings: []
  };
}

// Trích xuất nghĩa tiếng Việt ngắn gọn, kèm từ loại nếu có
export function extractCleanMeaning(text: string, targetWord?: string): string {
  return extractMeanings(text, targetWord).primaryMeaning;
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

