import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ViewStyle
} from 'react-native';

interface UnderlineWordInputProps {
  targetWord: string;
  onComplete: (isCorrect: boolean, typedText: string) => void;
  hintLettersCount?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function UnderlineWordInput({
  targetWord,
  onComplete,
  hintLettersCount = 0,
  autoFocus = true,
  disabled = false,
  style
}: UnderlineWordInputProps) {
  const cleanTarget = targetWord.trim();
  const targetChars = cleanTarget.split('');

  // Số ký tự cần nhập (bỏ qua khoảng trắng giữa các từ)
  const lettersOnly = cleanTarget.replace(/\s+/g, '');
  
  // Khởi tạo chữ đã gõ (có thể có gợi ý N chữ cái đầu)
  const getInitialText = () => {
    if (hintLettersCount <= 0) return '';
    return lettersOnly.slice(0, hintLettersCount);
  };

  const [typedText, setTypedText] = useState(getInitialText);
  const [evaluation, setEvaluation] = useState<'pending' | 'correct' | 'incorrect'>('pending');
  const [isFocused, setIsFocused] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Reset khi đổi targetWord
  useEffect(() => {
    const initial = getInitialText();
    setTypedText(initial);
    setEvaluation('pending');
    if (autoFocus) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [cleanTarget, hintLettersCount]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  };

  const handleTextChange = (text: string) => {
    if (disabled || evaluation === 'correct') return;

    // Chỉ giữ lại chữ cái và số (bỏ khoảng trắng vì xử lý theo slot)
    const cleaned = text.replace(/[^a-zA-Z0-9]/g, '').slice(0, lettersOnly.length);
    setTypedText(cleaned);

    // Khi gõ đủ số ký tự, tiến hành kiểm tra
    if (cleaned.length === lettersOnly.length) {
      const isCorrect = cleaned.toLowerCase() === lettersOnly.toLowerCase();
      if (isCorrect) {
        setEvaluation('correct');
        Keyboard.dismiss();
        setTimeout(() => {
          onComplete(true, cleaned);
        }, 650);
      } else {
        setEvaluation('incorrect');
        triggerShake();
        onComplete(false, cleaned);
      }
    } else {
      setEvaluation('pending');
    }
  };

  const handleCardPress = () => {
    if (!disabled && evaluation !== 'correct') {
      inputRef.current?.focus();
    }
  };

  // Map ký tự target sang danh sách slot (bao gồm cả dấu cách giữa các từ)
  let letterIndex = 0;
  const slots = targetChars.map((char, index) => {
    if (char === ' ') {
      return { id: `space-${index}`, isSpace: true, char: ' ' };
    }
    const currentLetterIndex = letterIndex;
    letterIndex++;
    const typedChar = typedText[currentLetterIndex] || '';
    const isCurrentActive = currentLetterIndex === typedText.length && isFocused;
    return {
      id: `char-${index}`,
      isSpace: false,
      targetChar: char,
      typedChar,
      isFilled: typedChar.length > 0,
      isActive: isCurrentActive
    };
  });

  return (
    <TouchableWithoutFeedback onPress={handleCardPress}>
      <Animated.View
        style={[
          styles.containerCard,
          evaluation === 'correct' && styles.cardCorrect,
          evaluation === 'incorrect' && styles.cardIncorrect,
          { transform: [{ translateX: shakeAnim }] },
          style
        ]}
      >
        {/* Hidden TextInput bắt bàn phím ảo hệ thống */}
        <TextInput
          ref={inputRef}
          value={typedText}
          onChangeText={handleTextChange}
          maxLength={lettersOnly.length}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoFocus={autoFocus}
          editable={!disabled && evaluation !== 'correct'}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={styles.hiddenInput}
          keyboardType={Platform.OS === 'ios' ? 'ascii-capable' : 'email-address'}
        />

        {/* Khung hiển thị các chữ cái phía trên dấu gạch chân chuẩn theo ảnh mẫu */}
        <View style={styles.slotsRow}>
          {slots.map(slot => {
            if (slot.isSpace) {
              return <View key={slot.id} style={styles.spaceSlot} />;
            }

            const isCorrectChar =
              evaluation === 'correct' ||
              (evaluation === 'incorrect' &&
                (slot.typedChar || '').toLowerCase() === (slot.targetChar || '').toLowerCase());
            const isWrongChar = evaluation === 'incorrect' && !isCorrectChar && slot.isFilled;

            return (
              <View key={slot.id} style={styles.slotWrapper}>
                {/* Chữ cái phía trên gạch chân */}
                <Text
                  style={[
                    styles.slotLetter,
                    slot.isFilled && styles.slotLetterFilled,
                    evaluation === 'correct' && styles.slotLetterCorrect,
                    isWrongChar && styles.slotLetterWrong,
                    slot.isActive && styles.slotLetterActive
                  ]}
                >
                  {slot.typedChar || (slot.isActive ? '|' : ' ')}
                </Text>

                {/* Dấu gạch chân bên dưới chữ cái */}
                <View
                  style={[
                    styles.underline,
                    slot.isFilled && styles.underlineFilled,
                    slot.isActive && styles.underlineActive,
                    evaluation === 'correct' && styles.underlineCorrect,
                    isWrongChar && styles.underlineWrong
                  ]}
                />
              </View>
            );
          })}
        </View>

        {/* Nút bấm gợi ý / Thử lại khi sai */}
        {evaluation === 'incorrect' && (
          <View style={styles.feedbackRow}>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setTypedText('');
                setEvaluation('pending');
                inputRef.current?.focus();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.retryBtnText}>Xóa gõ lại</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.showAnswerBtn}
              onPress={() => {
                setTypedText(lettersOnly);
                setEvaluation('incorrect');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.showAnswerBtnText}>Xem đáp án ({cleanTarget})</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  containerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 20,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
    minWidth: 240,
    maxWidth: '92%',
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  cardCorrect: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4'
  },
  cardIncorrect: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2'
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0.01,
    color: 'transparent'
  },
  slotsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6
  },
  slotWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 24,
    minHeight: 44
  },
  spaceSlot: {
    width: 14
  },
  slotLetter: {
    fontSize: 22,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    marginBottom: 4,
    minHeight: 28
  },
  slotLetterFilled: {
    color: '#0F172A'
  },
  slotLetterActive: {
    color: '#2563EB',
    fontWeight: '300'
  },
  slotLetterCorrect: {
    color: '#059669',
    fontWeight: '700'
  },
  slotLetterWrong: {
    color: '#DC2626',
    fontWeight: '700'
  },
  underline: {
    width: 22,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#94A3B8'
  },
  underlineFilled: {
    backgroundColor: '#475569'
  },
  underlineActive: {
    backgroundColor: '#2563EB',
    height: 3
  },
  underlineCorrect: {
    backgroundColor: '#059669',
    height: 3
  },
  underlineWrong: {
    backgroundColor: '#DC2626',
    height: 3
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 10
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9'
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569'
  },
  showAnswerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEE2E2'
  },
  showAnswerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626'
  }
});

