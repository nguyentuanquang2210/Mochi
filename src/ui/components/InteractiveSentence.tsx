import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutRectangle,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { SpeakerButton } from './SpeakerButton';
import { DictionaryService } from '../../services/dictionary';
import { SpeechService } from '../../services/speech';

// Danh sách các cụm từ tiếng Anh thông dụng để gom nhóm dịch theo cụm
const KNOWN_PHRASES: string[] = [
  'your friends',
  'come in',
  'look forward to',
  'take care of',
  'as well as',
  'set up',
  'pick up',
  'deal with',
  'in order to',
  'point of view',
  'each other',
  'one another',
  'run out of',
  'give up',
  'turn on',
  'turn off',
  'find out',
  'sharp turn',
  'at least',
  'at all',
  'in front of',
  'next to',
  'according to',
  'due to',
  'because of',
  'instead of',
  'depend on',
  'pay attention to',
  'make sure'
];

interface InteractiveToken {
  id: string;
  rawText: string;     // Chữ hiển thị (kèm dấu câu)
  cleanText: string;   // Chữ dùng để tra từ điển
  isPhrase: boolean;   // Có phải cụm từ hay không
}

interface InteractiveSentenceProps {
  sentence: string;    // Câu tiếng Anh (ví dụ: "Come in, your friends are here!")
  translation?: string | null; // Bản dịch cả câu nếu có
}

export function InteractiveSentence({ sentence, translation }: InteractiveSentenceProps) {
  // Loại bỏ tiền tố 📝 nếu có
  const cleanSentence = sentence.replace(/^📝\s*/, '').trim();

  // State quản lý Tooltip khi ấn vào từ/cụm từ
  const [selectedToken, setSelectedToken] = useState<InteractiveToken | null>(null);
  const [tokenMeaning, setTokenMeaning] = useState<string | null>(null);
  const [loadingMeaning, setLoadingMeaning] = useState(false);

  // Lưu tọa độ vị trí layout của từng từ trong câu
  const [wordLayouts, setWordLayouts] = useState<Record<string, LayoutRectangle>>({});
  const [containerWidth, setContainerWidth] = useState(320);
  const [popoverWidth, setPopoverWidth] = useState(180);

  // Phân tích câu thành các token từ đơn và cụm từ
  const tokens = parseSentenceTokens(cleanSentence);

  const handlePressToken = async (token: InteractiveToken) => {
    // 1. TỰ ĐỘNG PHÁT ÂM NGAY TỪ ĐÓ bằng System TTS (không cần bấm nút loa)
    SpeechService.speak(token.cleanText).catch(() => {});

    // Nếu ấn lại đúng token đang mở, đóng tooltip
    if (selectedToken?.id === token.id) {
      setSelectedToken(null);
      setTokenMeaning(null);
      return;
    }

    setSelectedToken(token);
    setLoadingMeaning(true);
    setTokenMeaning(null);

    try {
      const meaning = await DictionaryService.translateWordOrPhrase(token.cleanText);
      setTokenMeaning(meaning || 'Không tìm thấy nghĩa');
    } catch {
      setTokenMeaning(token.cleanText);
    } finally {
      setLoadingMeaning(false);
    }
  };

  const handleDismissTooltip = () => {
    setSelectedToken(null);
    setTokenMeaning(null);
  };

  // Tính toán vị trí nổi tuyệt đối (absolute floating) để:
  // 1. Mũi tên tam giác trỏ CHÍNH XÁC VÀO GIỮA CHÂN TỪ vừa bấm
  // 2. Nổi lên trên các dòng khác mà KHÔNG làm dịch chuyển hay xô lệch layout của thẻ
  let popoverTop = 0;
  let popoverLeft = 0;
  let arrowLeft = 0;

  if (selectedToken && wordLayouts[selectedToken.id]) {
    const layout = wordLayouts[selectedToken.id];
    // Tọa độ tương đối trong container (bubbleContainer có paddingHorizontal: 12, paddingVertical: 10, speakerBtn: 34px)
    const targetX = 12 + 34 + layout.x;
    const targetY = 10 + layout.y;
    const wordCenterX = targetX + layout.width / 2;
    const wordBottomY = targetY + layout.height;

    // Chiều rộng popup tự động giới hạn vừa vặn trong màn hình
    const pWidth = Math.max(150, Math.min(260, popoverWidth));
    popoverLeft = Math.max(8, Math.min(containerWidth - pWidth - 8, wordCenterX - pWidth / 2));
    popoverTop = wordBottomY + 4; // Ngay sát dưới chân từ
    arrowLeft = Math.max(14, Math.min(pWidth - 28, wordCenterX - popoverLeft - 7));
  }

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Khối bong bóng câu ví dụ với nút loa phát âm */}
      <View style={styles.bubbleContainer}>
        {/* Nút loa phát âm cả câu màu xanh chuẩn như ảnh mẫu */}
        <SpeakerButton
          text={cleanSentence}
          size={18}
          color="#3B82F6"
          activeColor="#2563EB"
          style={styles.speakerBtn}
        />

        {/* Danh sách các từ/cụm từ có đường gạch đứt đoạn bên dưới */}
        <View style={styles.wordsRow}>
          {tokens.map(token => (
            <TouchableOpacity
              key={token.id}
              activeOpacity={0.65}
              onLayout={(e) => {
                const l = e.nativeEvent.layout;
                setWordLayouts(prev => ({ ...prev, [token.id]: l }));
              }}
              onPress={() => handlePressToken(token)}
              style={styles.wordTouchable}
            >
              <Text
                style={[
                  styles.wordText,
                  selectedToken?.id === token.id && styles.wordTextActive
                ]}
              >
                {token.rawText}
              </Text>
              {/* Đường gạch đứt đoạn chấm chấm ở dưới chân từ */}
              <View
                style={[
                  styles.dashedLine,
                  selectedToken?.id === token.id && styles.dashedLineActive
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Popover Tooltip NỔI HOÀN TOÀN TRÊN CÁC DÒNG (position: absolute) KHÔNG LÀM XÔ LỆCH LAYOUT */}
      {selectedToken && (
        <View
          style={[
            styles.floatingOverlay,
            { top: popoverTop, left: popoverLeft }
          ]}
          onLayout={(e) => setPopoverWidth(e.nativeEvent.layout.width)}
        >
          {/* Mũi tên tam giác trỏ CHÍNH XÁC vào giữa chân từ vừa bấm */}
          <View style={[styles.triangleArrow, { marginLeft: arrowLeft }]} />

          {/* Khung nội dung Popover nền tối bo góc (ấn vào để đóng) */}
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.popoverCard}
            onPress={handleDismissTooltip}
          >
            <Text style={styles.popoverEnglishText}>{selectedToken.cleanText}</Text>
            {loadingMeaning ? (
              <ActivityIndicator size="small" color="#9CA3AF" style={{ marginTop: 4 }} />
            ) : (
              <Text style={styles.popoverVietnameseText}>{tokenMeaning}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Bản dịch nghĩa tiếng Việt cả câu bên dưới nếu có - NẰM NGUYÊN VỊ TRÍ, KHÔNG BỊ ĐẨY */}
      {translation && (
        <Text style={styles.fullTranslationText}>
          {translation.startsWith('(') ? translation : `(${translation})`}
        </Text>
      )}
    </View>
  );
}

/**
 * Hàm phân tích câu tiếng Anh thành danh sách token từ đơn & cụm từ
 */
function parseSentenceTokens(sentence: string): InteractiveToken[] {
  const lowerSentence = sentence.toLowerCase();
  const tokens: InteractiveToken[] = [];

  // Tìm các cụm từ đã biết trong câu
  const phraseMatches: { start: number; end: number; phrase: string }[] = [];
  for (const phrase of KNOWN_PHRASES) {
    let searchStart = 0;
    while (searchStart < lowerSentence.length) {
      const idx = lowerSentence.indexOf(phrase, searchStart);
      if (idx === -1) break;

      // Đảm bảo khớp nguyên vẹn ranh giới từ (word boundary)
      const isStartWordBoundary = idx === 0 || /\s|[^\w]/.test(lowerSentence[idx - 1]);
      const isEndWordBoundary =
        idx + phrase.length === lowerSentence.length ||
        /\s|[^\w]/.test(lowerSentence[idx + phrase.length]);

      if (isStartWordBoundary && isEndWordBoundary) {
        phraseMatches.push({
          start: idx,
          end: idx + phrase.length,
          phrase: sentence.slice(idx, idx + phrase.length)
        });
      }
      searchStart = idx + phrase.length;
    }
  }

  // Sắp xếp các cụm từ theo vị trí xuất hiện
  phraseMatches.sort((a, b) => a.start - b.start);

  // Lọc các cụm từ không bị trùng lặp vị trí
  const nonOverlappingPhrases: typeof phraseMatches = [];
  let lastEnd = 0;
  for (const pm of phraseMatches) {
    if (pm.start >= lastEnd) {
      nonOverlappingPhrases.push(pm);
      lastEnd = pm.end;
    }
  }

  // Tách câu dựa trên các cụm từ đã tìm được
  let cursor = 0;
  let tokenId = 0;

  for (const pm of nonOverlappingPhrases) {
    // Phần trước cụm từ: tách thành các từ đơn
    if (pm.start > cursor) {
      const segment = sentence.slice(cursor, pm.start);
      tokenizeSingleWords(segment, tokens, tokenId);
      tokenId = tokens.length;
    }

    // Đưa cụm từ vào làm 1 token
    tokens.push({
      id: `token-${tokenId++}`,
      rawText: pm.phrase + ' ',
      cleanText: pm.phrase.trim(),
      isPhrase: true
    });

    cursor = pm.end;
  }

  // Phần còn lại sau cụm từ cuối cùng
  if (cursor < sentence.length) {
    const remaining = sentence.slice(cursor);
    tokenizeSingleWords(remaining, tokens, tokenId);
  }

  return tokens;
}

function tokenizeSingleWords(segment: string, tokens: InteractiveToken[], startId: number) {
  const rawWords = segment.split(/(\s+)/);
  let id = startId;

  for (const w of rawWords) {
    if (!w || /^\s+$/.test(w)) continue;
    const clean = w.replace(/^[^\w]+|[^\w]+$/g, '');
    if (clean) {
      tokens.push({
        id: `token-${id++}`,
        rawText: w + ' ',
        cleanText: clean,
        isPhrase: false
      });
    }
  }
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    width: '100%',
    position: 'relative',
    zIndex: 9999
  },
  bubbleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3
  },
  speakerBtn: {
    marginRight: 8,
    padding: 3,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 12
  },
  wordsRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  wordTouchable: {
    marginRight: 4,
    marginVertical: 3,
    alignItems: 'center'
  },
  wordText: {
    fontSize: 16,
    color: '#F8FAFC',
    lineHeight: 22,
    fontWeight: '500',
    letterSpacing: 0.2
  },
  wordTextActive: {
    color: '#60A5FA',
    fontWeight: '700'
  },
  dashedLine: {
    width: '100%',
    height: 1,
    borderBottomWidth: 1.5,
    borderBottomColor: '#64748B',
    borderStyle: 'dashed',
    marginTop: 2
  },
  dashedLineActive: {
    borderBottomColor: '#60A5FA',
    borderBottomWidth: 2
  },
  floatingOverlay: {
    position: 'absolute',
    zIndex: 99999,
    elevation: 20
  },
  triangleArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#0F172A'
  },
  popoverCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 150,
    maxWidth: 260,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10
  },
  popoverEnglishText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    marginBottom: 3
  },
  popoverVietnameseText: {
    fontSize: 14,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 20
  },
  fullTranslationText: {
    fontSize: 14,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 4,
    paddingLeft: 4
  }
});

