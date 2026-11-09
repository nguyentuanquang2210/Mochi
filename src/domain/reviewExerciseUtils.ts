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
): { clozeSentence: string; translation: string | null; originalSentence: string } | null {
  if (!content) return null;
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Bắt các tiền tố ví dụ: "📝", "- Câu ví dụ: 📝", "- Câu ví dụ:", "- Ví dụ: 📝", "- Ví dụ:"
    if (
      line.startsWith('📝') ||
      /^-?\s*câu ví dụ\s*:\s*/i.test(line) ||
      /^-?\s*ví dụ\s*:\s*/i.test(line)
    ) {
      const sentence = line
        .replace(/^-?\s*(câu ví dụ|ví dụ)\s*:\s*/i, '')
        .replace(/^📝\s*/, '')
        .trim();

      if (!sentence) continue;

      let translation: string | null = null;
      // Tìm dòng bản dịch trong ngoặc đơn (...) ở ngay sau
      for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
        const next = lines[j].trim();
        if (next.startsWith('(') && next.endsWith(')')) {
          translation = next.slice(1, -1).trim();
          break;
        }
      }

      // Thay thế từ mục tiêu bằng chỗ trống ______
      const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      let clozeSentence = sentence.replace(regex, '______');
      if (clozeSentence === sentence) {
        // Dự phòng nếu không khớp ranh giới từ \b (ví dụ từ chia đuôi)
        const simpleRegex = new RegExp(escaped, 'gi');
        clozeSentence = sentence.replace(simpleRegex, '______');
      }

      return { clozeSentence, translation, originalSentence: sentence };
    }
  }
  return null;
}

// Bảng từ điển họ từ (Word Family) TOEIC chuẩn xác 100%, không sinh từ giả
export function getWordFamily(
  word: string
): { pos: string; word: string; meaning: string }[] {
  const clean = word.toLowerCase().trim();

  // Bảng Word Form phong phú chuẩn đề thi TOEIC Part 5
  const knownFamilies: Record<string, { pos: string; word: string; meaning: string }[]> = {
    deny: [
      { pos: 'verb', word: 'deny', meaning: 'phủ nhận, từ chối' },
      { pos: 'noun', word: 'denial', meaning: 'sự phủ nhận' },
      { pos: 'adj', word: 'deniable', meaning: 'có thể phủ nhận' }
    ],
    decide: [
      { pos: 'verb', word: 'decide', meaning: 'quyết định' },
      { pos: 'noun', word: 'decision', meaning: 'sự quyết định' },
      { pos: 'adj', word: 'decisive', meaning: 'mang tính quyết đoán' }
    ],
    apply: [
      { pos: 'verb', word: 'apply', meaning: 'nộp đơn, áp dụng' },
      { pos: 'noun', word: 'application', meaning: 'đơn xin, sự ứng dụng' },
      { pos: 'noun', word: 'applicant', meaning: 'người nộp đơn, ứng viên' },
      { pos: 'adj', word: 'applicable', meaning: 'có thể áp dụng' }
    ],
    acquire: [
      { pos: 'verb', word: 'acquire', meaning: 'đạt được, thâu tóm' },
      { pos: 'noun', word: 'acquisition', meaning: 'sự mua lại, thâu tóm' },
      { pos: 'adj', word: 'acquired', meaning: 'đạt được' }
    ],
    manage: [
      { pos: 'verb', word: 'manage', meaning: 'quản lý, xoay xở' },
      { pos: 'noun', word: 'management', meaning: 'ban quản lý, sự quản lý' },
      { pos: 'noun', word: 'manager', meaning: 'người quản lý, trưởng phòng' },
      { pos: 'adj', word: 'managerial', meaning: 'thuộc về quản lý' }
    ],
    compete: [
      { pos: 'verb', word: 'compete', meaning: 'cạnh tranh, thi đấu' },
      { pos: 'noun', word: 'competition', meaning: 'cuộc thi, sự cạnh tranh' },
      { pos: 'adj', word: 'competitive', meaning: 'có tính cạnh tranh' }
    ],
    satisfy: [
      { pos: 'verb', word: 'satisfy', meaning: 'làm hài lòng, thỏa mãn' },
      { pos: 'noun', word: 'satisfaction', meaning: 'sự hài lòng' },
      { pos: 'adj', word: 'satisfactory', meaning: 'thỏa đáng, vừa ý' }
    ],
    produce: [
      { pos: 'verb', word: 'produce', meaning: 'sản xuất' },
      { pos: 'noun', word: 'production', meaning: 'sự sản xuất' },
      { pos: 'noun', word: 'product', meaning: 'sản phẩm' },
      { pos: 'adj', word: 'productive', meaning: 'có năng suất cao' }
    ],
    inform: [
      { pos: 'verb', word: 'inform', meaning: 'thông báo, báo tin' },
      { pos: 'noun', word: 'information', meaning: 'thông tin' },
      { pos: 'adj', word: 'informative', meaning: 'cung cấp nhiều tin tức hữu ích' }
    ],
    contract: [
      { pos: 'noun', word: 'contract', meaning: 'hợp đồng' },
      { pos: 'verb', word: 'contract', meaning: 'ký kết hợp đồng, co lại' },
      { pos: 'adj', word: 'contractual', meaning: 'thuộc về hợp đồng' }
    ],
    invest: [
      { pos: 'verb', word: 'invest', meaning: 'đầu tư' },
      { pos: 'noun', word: 'investment', meaning: 'khoản đầu tư' },
      { pos: 'noun', word: 'investor', meaning: 'nhà đầu tư' }
    ],
    employ: [
      { pos: 'verb', word: 'employ', meaning: 'thuê, tuyển dụng' },
      { pos: 'noun', word: 'employment', meaning: 'việc làm, sự tuyển dụng' },
      { pos: 'noun', word: 'employee', meaning: 'nhân viên' },
      { pos: 'noun', word: 'employer', meaning: 'người tuyển dụng' }
    ],
    expand: [
      { pos: 'verb', word: 'expand', meaning: 'mở rộng, phát triển' },
      { pos: 'noun', word: 'expansion', meaning: 'sự mở rộng' },
      { pos: 'adj', word: 'expansive', meaning: 'rộng rãi, bao la' }
    ],
    promote: [
      { pos: 'verb', word: 'promote', meaning: 'thăng chức, quảng bá' },
      { pos: 'noun', word: 'promotion', meaning: 'sự thăng chức, khuyến mãi' },
      { pos: 'adj', word: 'promotional', meaning: 'dùng để quảng cáo' }
    ],
    succeed: [
      { pos: 'verb', word: 'succeed', meaning: 'thành công, kế vị' },
      { pos: 'noun', word: 'success', meaning: 'sự thành công' },
      { pos: 'adj', word: 'successful', meaning: 'thành công' }
    ],
    flyer: [
      { pos: 'noun', word: 'flyer', meaning: 'tờ rơi quảng cáo / phi công' },
      { pos: 'verb', word: 'fly', meaning: 'bay' },
      { pos: 'noun', word: 'flight', meaning: 'chuyến bay' }
    ]
  };

  if (knownFamilies[clean]) {
    return knownFamilies[clean];
  }

  // Nếu không có trong danh sách Word Family: chỉ trả về thông tin từ gốc chuẩn, TUYỆT ĐỐI không sinh đuôi giả
  const toeic = TOEIC_MAP.get(clean);
  if (toeic) {
    return [
      { pos: toeic.pos || 'từ vựng', word: clean, meaning: toeic.meaningVi }
    ];
  }

  return [
    { pos: 'từ vựng', word: clean, meaning: 'từ gốc' }
  ];
}

