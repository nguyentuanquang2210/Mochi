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

    // Nhận diện câu ví dụ tiếng Anh bắt đầu bằng 📝 -> Chuyển thành InteractiveSentence có chạm tra từ/cụm từ
    if (trimmed.startsWith('📝')) {
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
          sentence={trimmed}
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
  }
});

