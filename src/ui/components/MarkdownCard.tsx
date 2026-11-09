import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { InteractiveSentence } from './InteractiveSentence';

interface MarkdownCardProps {
  content: string;
  isRevealed?: boolean;
  isTitle?: boolean;
}

export function MarkdownCard({ content, isRevealed = true, isTitle = false }: MarkdownCardProps) {
  if (!content) return null;

  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let skipNextLine = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    if (skipNextLine) {
      skipNextLine = false;
      continue;
    }

    const line = lines[lineIndex];
    const trimmed = line.trim();

    // 1. Nhận diện mục "- Giải thích:"
    if (trimmed.startsWith('- Giải thích:') || trimmed.startsWith('Giải thích:')) {
      const explainText = trimmed.replace(/^-?\s*giải thích\s*:\s*/i, '');
      renderedElements.push(
        <View key={`exp-${lineIndex}`} style={styles.explanationBox}>
          <Text style={styles.explanationTitle}>💡 Giải thích: </Text>
          <Text style={styles.explanationBody}>{explainText}</Text>
        </View>
      );
      continue;
    }

    // 2. Nhận diện mục "- Nghĩa:"
    if (trimmed.startsWith('- Nghĩa:') || trimmed.startsWith('Nghĩa:')) {
      const meaningContent = trimmed.replace(/^-?\s*nghĩa\s*:\s*/i, '').trim();
      renderedElements.push(
        <View key={`nghia-${lineIndex}`} style={styles.meaningHeaderRow}>
          <Text style={styles.meaningHeaderTitle}>📖 Nghĩa: </Text>
          {meaningContent ? (
            <Text style={styles.meaningHeaderText}>{meaningContent}</Text>
          ) : null}
        </View>
      );
      continue;
    }

    // 3. Nhận diện câu ví dụ tiếng Anh bắt đầu bằng 📝 -> Chuyển thành InteractiveSentence có chạm tra từ/cụm từ
    if (trimmed.startsWith('📝') || trimmed.startsWith('- Ví dụ: 📝') || trimmed.startsWith('- Ví dụ:')) {
      const cleanedSentence = trimmed.replace(/^-?\s*ví dụ\s*:\s*/i, '').trim();
      let translation: string | null = null;
      if (lineIndex + 1 < lines.length) {
        const nextTrimmed = lines[lineIndex + 1].trim();
        if (nextTrimmed.startsWith('(') && nextTrimmed.endsWith(')')) {
          translation = nextTrimmed;
          skipNextLine = true;
        }
      }

      renderedElements.push(
        <InteractiveSentence
          key={`ex-${lineIndex}`}
          sentence={cleanedSentence.startsWith('📝') ? cleanedSentence : `📝 ${cleanedSentence}`}
          translation={translation}
        />
      );
      continue;
    }

    // Dòng trống
    if (!trimmed) {
      renderedElements.push(<View key={`empty-${lineIndex}`} style={{ height: 6 }} />);
      continue;
    }

    // Bullet list
    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
    const displayLine = isBullet ? trimmed.substring(2) : line;

    renderedElements.push(
      <View key={lineIndex} style={[styles.lineRow, isBullet && styles.bulletRow]}>
        {isBullet && <Text style={styles.bulletDot}>•</Text>}
        <Text style={[styles.text, isTitle && styles.titleText]}>
          {renderFormattedSpans(displayLine, isRevealed)}
        </Text>
      </View>
    );
  }

  return <View style={styles.container}>{renderedElements}</View>;
}

function renderFormattedSpans(text: string, isRevealed: boolean) {
  // Regex to match cloze <<...>>, bold **...**, inline code `...`, and italic *...*
  const pattern = /(<<[^>]+>>|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    if (!part) return null;

    // Cloze deletion <<word>>
    if (part.startsWith('<<') && part.endsWith('>>')) {
      const clozeWord = part.slice(2, -2);
      if (!isRevealed) {
        return (
          <Text key={index} style={styles.clozeHidden}>
            {' [...] '}
          </Text>
        );
      }
      return (
        <Text key={index} style={styles.clozeRevealed}>
          {` [${clozeWord}] `}
        </Text>
      );
    }

    // Bold **text**
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={index} style={styles.bold}>
          {part.slice(2, -2)}
        </Text>
      );
    }

    // Inline code `text`
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <Text key={index} style={styles.code}>
          {part.slice(1, -1)}
        </Text>
      );
    }

    // Italic *text*
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <Text key={index} style={styles.italic}>
          {part.slice(1, -1)}
        </Text>
      );
    }

    return <Text key={index}>{part}</Text>;
  });
}

const styles = StyleSheet.create({
  container: {
    width: '100%'
  },
  lineRow: {
    marginBottom: 4,
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  bulletRow: {
    paddingLeft: 6
  },
  bulletDot: {
    fontSize: 16,
    color: '#555555',
    marginRight: 6
  },
  text: {
    fontSize: 16,
    color: '#242424',
    lineHeight: 24
  },
  titleText: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28
  },
  bold: {
    fontWeight: '700',
    color: '#111111'
  },
  italic: {
    fontStyle: 'italic',
    color: '#333333'
  },
  code: {
    backgroundColor: '#EEEEEE',
    color: '#B03A2E',
    fontFamily: 'monospace',
    paddingHorizontal: 4,
    borderRadius: 4
  },
  clozeHidden: {
    backgroundColor: '#E8E8E8',
    color: '#777777',
    fontWeight: '700',
    paddingHorizontal: 6,
    borderRadius: 4
  },
  clozeRevealed: {
    backgroundColor: '#E2F0D9',
    color: '#276A3C',
    fontWeight: '700',
    paddingHorizontal: 6,
    borderRadius: 4
  },
  meaningHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 6
  },
  meaningHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B'
  },
  meaningHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB'
  },
  explanationBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginVertical: 4
  },
  explanationTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B'
  },
  explanationBody: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 19
  }
});

