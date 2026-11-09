import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Audio } from 'expo-av';
import { Feather, Ionicons } from './Icons';
import { UnderlineWordInput } from './UnderlineWordInput';
import { SpeakerButton } from './SpeakerButton';
import { SpeechService } from '../../services/speech';
import { SpeechRecognitionService } from '../../services/speechRecognition';
import { TOEIC_MAP } from '../../data/toeicWordlist';
import {
  extractCleanMeaning,
  extractExampleSentence,
  extractMeanings,
  getWordFamily
} from '../../domain/reviewExerciseUtils';
import type { CardSummary, Rating } from '../../domain/types';

const FAST_RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: false,
  android: {
    extension: '.amr',
    outputFormat: Audio.AndroidOutputFormat.AMR_NB,
    audioEncoder: Audio.AndroidAudioEncoder.AMR_NB,
    sampleRate: 8000,
    numberOfChannels: 1,
    bitRate: 12200
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.MAX,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000
  }
};

export type ExerciseType =
  | 'flashcard'      // Lật thẻ truyền thống
  | 'fill_in_blank'  // 1. Nhìn nghĩa tiếng Việt -> viết từ tiếng Anh (theo ảnh)
  | 'memory_write'   // 2. Viết lại từ bằng trí nhớ (che từ rồi viết)
  | 'listening'      // 3. Nghe âm thanh -> nhận diện từ
  | 'speaking'       // 4. Nhìn từ -> tự phát âm
  | 'sentence_cloze' // 5. Điền từ vào câu
  | 'word_family';   // 6. Nhận diện họ từ

interface ReviewExerciseViewProps {
  card: CardSummary;
  exerciseType: ExerciseType;
  ipa?: string | null;
  onAnswer: (rating: Rating) => void;
  onNext: () => void;
}

export function ReviewExerciseView({
  card,
  exerciseType,
  ipa,
  onAnswer,
  onNext
}: ReviewExerciseViewProps) {
  const sides = card.sides && card.sides.length > 0 ? card.sides : [card.front, card.back].filter(Boolean);
  const targetWord = (sides[0] || card.front || '').trim();
  const coverImage = card.thumbnailUrl || card.imageUrl;

  // Trích xuất nghĩa tiếng Việt cô đọng kèm các nghĩa khác nếu có
  const rawMeaning = sides[1] || card.back || '';
  const meaningData = extractMeanings(rawMeaning, targetWord);
  const cleanMeaning = meaningData.primaryMeaning;
  const otherMeanings = meaningData.otherMeanings;
  const [showAllMeanings, setShowAllMeanings] = useState(false);

  // Trích xuất câu ví dụ nếu có (dòng bắt đầu bằng 📝)
  const exampleInfo = extractExampleSentence(card.content || '', targetWord);

  // State cho từng dạng bài tập
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // State riêng cho dạng "2. Viết lại từ bằng trí nhớ"
  const [memoryRevealed, setMemoryRevealed] = useState(true);
  const [memoryCountdown, setMemoryCountdown] = useState(2);

  // State riêng cho dạng "4. Luyện phát âm"
  const [isRecording, setIsRecording] = useState(false);
  const [isEvaluatingSpeech, setIsEvaluatingSpeech] = useState(false);
  const [spokenText, setSpokenText] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const autoStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dọn dẹp recording khi unmount hoặc đổi card
  const stopRecordingAndCleanup = async () => {
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }
    setIsRecording(false);
  };

  // Reset khi đổi card hoặc exerciseType
  useEffect(() => {
    setIsAnswered(false);
    setIsCorrect(false);
    setSpokenText(null);
    setIsRecording(false);
    setIsEvaluatingSpeech(false);
    setShowAllMeanings(false);
    stopRecordingAndCleanup();

    // Xử lý đếm ngược che từ của dạng Memory Write
    if (exerciseType === 'memory_write') {
      setMemoryRevealed(true);
      setMemoryCountdown(2);
      SpeechService.speak(targetWord);
      const timer = setInterval(() => {
        setMemoryCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setMemoryRevealed(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        clearInterval(timer);
        stopRecordingAndCleanup();
      };
    }

    // Tự động phát âm khi vào dạng Listening
    if (exerciseType === 'listening') {
      SpeechService.speak(targetWord);
    }

    return () => {
      stopRecordingAndCleanup();
    };
  }, [card.id, exerciseType]);

  const handleInputComplete = (correct: boolean, _typedText: string) => {
    setIsAnswered(true);
    setIsCorrect(correct);
    if (correct) {
      SpeechService.speak(targetWord);
      // Ghi nhận lượt học tốt vào FSRS
      setTimeout(() => {
        onAnswer('good');
      }, 1200);
    } else {
      // Khi trả lời sai: phát âm từ chuẩn xác để người dùng nghe và ghi nhớ
      SpeechService.speak(targetWord);
      // Giữ hiển thị khung kết quả kèm nút "Đã hiểu & Ôn lại ở cuối phiên"
    }
  };

  // Khung phản hồi kết quả trực quan (chuẩn Mochi / Duolingo)
  const renderFeedbackSection = (overrideTarget?: string, overrideMeaning?: string) => {
    const finalWord = overrideTarget || targetWord;
    const finalMeaning = overrideMeaning || cleanMeaning;

    if (!isAnswered) return null;

    if (isCorrect) {
      return (
        <View style={styles.successFeedbackBanner}>
          <Ionicons name="checkmark-circle" size={24} color="#059669" />
          <Text style={styles.successFeedbackTitle}>Chính xác! 🎉</Text>
        </View>
      );
    }

    return (
      <View style={styles.errorFeedbackCard}>
        <View style={styles.errorFeedbackHeader}>
          <Ionicons name="close-circle" size={22} color="#DC2626" />
          <Text style={styles.errorFeedbackTitle}>Chưa chính xác!</Text>
        </View>
        <Text style={styles.errorCorrectWordText}>
          Đáp án đúng: <Text style={styles.errorCorrectWordHighlight}>{finalWord}</Text>
        </Text>
        <Text style={styles.errorMeaningText}>Nghĩa: {finalMeaning}</Text>
        <TouchableOpacity
          style={styles.errorContinueBtn}
          onPress={() => onAnswer('again')}
          activeOpacity={0.8}
        >
          <Text style={styles.errorContinueBtnText}>Đã hiểu & Ôn lại ở cuối phiên →</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const handleStartSpeaking = async () => {
    try {
      setSpokenText(null);
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false
      });

      let rec: Audio.Recording;
      try {
        const result = await Audio.Recording.createAsync(FAST_RECORDING_OPTIONS);
        rec = result.recording;
      } catch {
        const result = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        rec = result.recording;
      }

      recordingRef.current = rec;
      setIsRecording(true);

      autoStopTimeoutRef.current = setTimeout(() => {
        handleStopSpeaking();
      }, 5000);
    } catch (e) {
      console.warn('Lỗi thu âm speaking:', e);
      setIsRecording(false);
    }
  };

  const handleStopSpeaking = async () => {
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
    setIsRecording(false);
    if (!recordingRef.current) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true
      });

      if (!uri) return;

      setIsEvaluatingSpeech(true);
      const transcript = await SpeechRecognitionService.transcribeAudio(uri);
      setIsEvaluatingSpeech(false);

      if (!transcript) {
        setSpokenText('(không nghe rõ, hãy thử lại)');
        setIsCorrect(false);
        return;
      }

      setSpokenText(transcript);
      const match = SpeechRecognitionService.isMatch(transcript, targetWord);
      setIsCorrect(match);
      setIsAnswered(true);

      if (match) {
        SpeechService.speak(targetWord);
        setTimeout(() => {
          onAnswer('good');
        }, 1200);
      } else {
        // Phát âm chuẩn để người dùng nghe đối chiếu, hiển thị feedback chờ bấm "Đã hiểu"
        SpeechService.speak(targetWord);
      }
    } catch (e) {
      console.warn('Lỗi phân tích giọng nói:', e);
      setIsEvaluatingSpeech(false);
    }
  };

  // 1 & 2. GIAO DIỆN ĐIỀN TỪ / VIẾT LẠI TRÍ NHỚ CHUẨN THEO ẢNH
  if (exerciseType === 'fill_in_blank' || exerciseType === 'memory_write') {
    const isMemoryMode = exerciseType === 'memory_write';
    return (
      <View style={styles.container}>
        {/* Tiêu đề dạng bài */}
        <Text style={styles.topLabel}>
          {isMemoryMode ? 'Viết lại bằng trí nhớ' : 'Điền từ'}
        </Text>

        {/* Nghĩa tiếng Việt ở giữa to rõ */}
        <Text style={styles.meaningPrompt}>
          {cleanMeaning}
        </Text>

        {/* Nút dropdown mở rộng nếu từ có nhiều nghĩa khác */}
        {otherMeanings.length > 0 && (
          <View style={styles.meaningsDropdownWrapper}>
            <TouchableOpacity
              style={styles.meaningsDropdownBtn}
              onPress={() => setShowAllMeanings(!showAllMeanings)}
              activeOpacity={0.7}
            >
              <Text style={styles.meaningsDropdownBtnText}>
                {showAllMeanings ? 'Thu gọn' : `+${otherMeanings.length} nghĩa khác`}
              </Text>
              <Feather
                name={showAllMeanings ? 'chevron-up' : 'chevron-down'}
                size={13}
                color="#2563EB"
                style={{ marginLeft: 3 }}
              />
            </TouchableOpacity>

            {showAllMeanings && (
              <View style={styles.meaningsDropdownList}>
                {otherMeanings.map((m, idx) => (
                  <View key={idx} style={styles.meaningDropdownItem}>
                    <Text style={styles.meaningDropdownBullet}>•</Text>
                    <Text style={styles.meaningDropdownText}>{m}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Ảnh minh họa nhỏ gọn nếu có */}
        {Boolean(coverImage) && (
          <View style={styles.imageThumbWrapper}>
            <Image source={{ uri: coverImage as string }} style={styles.imageThumb} resizeMode="contain" />
          </View>
        )}

        {/* Nếu ở chế độ nhớ: hiển thị từ thoáng qua 2s rồi che đi */}
        {isMemoryMode && memoryRevealed ? (
          <View style={styles.memoryCardBox}>
            <Text style={styles.memoryWordText}>{targetWord}</Text>
            {ipa ? <Text style={styles.ipaText}>{ipa}</Text> : null}
            <Text style={styles.countdownHint}>Che lại sau {memoryCountdown}s...</Text>
          </View>
        ) : (
          <View style={styles.inputArea}>
            <UnderlineWordInput
              targetWord={targetWord}
              onComplete={handleInputComplete}
              hintLettersCount={0}
              autoFocus
            />
          </View>
        )}

        {/* Phản hồi kết quả đúng / sai & Học lại ở cuối phiên */}
        {renderFeedbackSection()}

        {/* Gợi ý âm thanh */}
        <View style={styles.audioHintRow}>
          <SpeakerButton text={targetWord} size={22} color="#475569" activeColor="#2563EB" />
          <Text style={styles.audioHintText}>Nghe gợi ý phát âm</Text>
        </View>
      </View>
    );
  }

  // 3. GIAO DIỆN LUYỆN NGHE (LISTENING TOEIC)
  if (exerciseType === 'listening') {
    return (
      <View style={styles.container}>
        <Text style={styles.topLabel}>Nghe & Nhận diện từ</Text>
        <Text style={styles.subInstruction}>Nghe âm thanh và viết lại từ bạn nghe được:</Text>

        {/* Nút loa to ở giữa để nghe phát âm */}
        <View style={styles.bigSpeakerContainer}>
          <TouchableOpacity
            style={styles.bigSpeakerBtn}
            onPress={() => SpeechService.speak(targetWord)}
            activeOpacity={0.8}
          >
            <Ionicons name="volume-high" size={42} color="#2563EB" />
          </TouchableOpacity>
          <Text style={styles.bigSpeakerHint}>Chạm vào loa để nghe lại</Text>
        </View>

        {/* Ô điền từ theo gạch chân */}
        <View style={styles.inputArea}>
          <UnderlineWordInput
            targetWord={targetWord}
            onComplete={handleInputComplete}
            autoFocus
          />
        </View>

        {/* Phản hồi kết quả đúng / sai & Học lại ở cuối phiên */}
        {renderFeedbackSection()}

        {/* Gợi ý nghĩa nếu người dùng gặp khó */}
        <Text style={styles.listeningMeaningHint}>
          Gợi ý nghĩa: {cleanMeaning}
        </Text>
      </View>
    );
  }

  // 4. GIAO DIỆN NHÌN TỪ -> TỰ PHÁT ÂM (SPEAKING)
  if (exerciseType === 'speaking') {
    return (
      <View style={styles.container}>
        <Text style={styles.topLabel}>Luyện phát âm</Text>
        <Text style={styles.subInstruction}>Nhìn từ và tự đọc to trước khi nghe máy phát âm:</Text>

        <View style={styles.wordDisplayBox}>
          <Text style={styles.speakingWord}>{targetWord}</Text>
          {ipa ? <Text style={styles.speakingIpa}>{ipa}</Text> : null}
          <Text style={styles.speakingMeaning}>{cleanMeaning}</Text>
        </View>

        {/* Khu vực trạng thái nói */}
        {spokenText ? (
          <View style={[styles.spokenResultBox, isCorrect ? styles.resultBoxCorrect : styles.resultBoxIncorrect]}>
            <Ionicons
              name={isCorrect ? 'checkmark-circle' : 'close-circle'}
              size={24}
              color={isCorrect ? '#059669' : '#DC2626'}
            />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Text style={isCorrect ? styles.resultTitleCorrect : styles.resultTitleIncorrect}>
                {isCorrect ? 'Phát âm CHÍNH XÁC! 🎉' : 'Chưa chính xác'}
              </Text>
              <Text style={styles.spokenTextDetail}>Máy nghe thấy: "{spokenText}"</Text>
            </View>
          </View>
        ) : null}

        {/* Phản hồi đúng / sai & Nút học lại */}
        {renderFeedbackSection()}

        {/* Nút Mic đọc to */}
        <View style={styles.speakingActionsRow}>
          <TouchableOpacity
            style={[styles.micBigBtn, isRecording && styles.micBigBtnActive]}
            onPress={() => {
              if (isRecording) {
                handleStopSpeaking();
              } else {
                handleStartSpeaking();
              }
            }}
            activeOpacity={0.8}
          >
            {isEvaluatingSpeech ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Feather name={isRecording ? 'square' : 'mic'} size={32} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.micHintText}>
          {isRecording ? 'Đang lắng nghe... Bấm nút đỏ để dừng' : 'Bấm micro để đọc từ này'}
        </Text>

        {/* Nút nghe mẫu đối chiếu */}
        <TouchableOpacity
          style={styles.sampleAudioBtn}
          onPress={() => SpeechService.speak(targetWord)}
        >
          <Ionicons name="volume-medium-outline" size={18} color="#4B5563" style={{ marginRight: 6 }} />
          <Text style={styles.sampleAudioBtnText}>Nghe phát âm chuẩn của máy</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 5. GIAO DIỆN ĐIỀN TỪ VÀO CÂU (SENTENCE CLOZE)
  if (exerciseType === 'sentence_cloze') {
    const clozeSentence = exampleInfo ? exampleInfo.clozeSentence : `Từ cần điền là ________.`;
    const sentenceTranslation = exampleInfo ? exampleInfo.translation : null;

    return (
      <View style={styles.container}>
        <Text style={styles.topLabel}>Điền từ vào câu</Text>
        <Text style={styles.subInstruction}>Đọc câu ngữ cảnh và điền từ thích hợp vào chỗ trống:</Text>

        {/* Khối câu ví dụ khuyết từ */}
        <View style={styles.sentenceBox}>
          <Text style={styles.clozeSentenceText}>
            {clozeSentence}
          </Text>
          {sentenceTranslation ? (
            <Text style={styles.sentenceTranslationText}>
              ({sentenceTranslation})
            </Text>
          ) : null}
        </View>

        {/* Nghĩa của từ cần điền ngay bên dưới câu */}
        <View style={styles.sentenceHintMeaningBadge}>
          <Text style={styles.sentenceHintMeaningLabel}>Nghĩa của từ:</Text>
          <Text style={styles.sentenceHintMeaningVal}>{cleanMeaning}</Text>
        </View>

        {/* Ô điền từ theo gạch chân */}
        <View style={styles.inputArea}>
          <UnderlineWordInput
            targetWord={targetWord}
            onComplete={handleInputComplete}
            autoFocus
          />
        </View>

        {/* Phản hồi đúng / sai & Học lại ở cuối phiên */}
        {renderFeedbackSection()}
      </View>
    );
  }

  // 6. GIAO DIỆN HỌ TỪ (WORD FAMILY)
  if (exerciseType === 'word_family') {
    const families = getWordFamily(targetWord);
    // Chọn dạng từ loại phái sinh để kiểm tra (ví dụ deny -> denial), không hiển thị chữ tiếng Anh để tránh lộ bài
    const testItem = families.find(f => f.word.toLowerCase() !== targetWord.toLowerCase()) || families[0];
    const isDerived = testItem.word.toLowerCase() !== targetWord.toLowerCase();
    const familyTarget = isDerived ? testItem.word : targetWord;

    return (
      <View style={styles.container}>
        <Text style={styles.topLabel}>Họ từ (Word Form - TOEIC)</Text>
        <Text style={styles.subInstruction}>
          {isDerived
            ? `Hãy viết dạng ${testItem.pos.toUpperCase()} của từ "${targetWord}":`
            : `Hãy viết từ vựng có nghĩa sau:`}
        </Text>

        {/* Khung hiển thị câu hỏi từ loại mà KHÔNG làm lộ từ cần viết */}
        <View style={styles.wordFamilyPromptCard}>
          <View style={styles.posBadgeHighlight}>
            <Text style={styles.posBadgeHighlightText}>{testItem.pos.toUpperCase()}</Text>
          </View>
          <Text style={styles.wordFamilyPromptMeaning}>
            "{testItem.meaning}"
          </Text>
          {isDerived && (
            <Text style={styles.wordFamilyPromptHint}>
              Từ gốc: <Text style={{ fontWeight: '700', color: '#1E293B' }}>{targetWord}</Text>
            </Text>
          )}
        </View>

        {/* Ô điền từ theo gạch chân cho từ cần kiểm tra */}
        <View style={styles.inputArea}>
          <UnderlineWordInput
            key={`wf-${card.id}-${familyTarget}`}
            targetWord={familyTarget}
            onComplete={handleInputComplete}
            autoFocus
          />
        </View>

        {/* Sau khi đã hoàn thành hoặc trả lời, hiển thị trọn bộ họ từ đầy đủ */}
        {isAnswered && (
          <View style={styles.wordFamilyCard}>
            <Text style={styles.fullFamilyTitle}>Trọn bộ họ từ của "{targetWord}":</Text>
            {families.map((item, index) => (
              <View key={index} style={[styles.familyRow, index > 0 && styles.familyRowDivider]}>
                <View style={styles.posBadge}>
                  <Text style={styles.posBadgeText}>{item.pos}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.familyWordText}>{item.word}</Text>
                  <Text style={styles.familyMeaningText}>{item.meaning}</Text>
                </View>
                <SpeakerButton text={item.word} size={18} color="#64748B" activeColor="#2563EB" />
              </View>
            ))}
          </View>
        )}

        {/* Phản hồi đúng / sai & Học lại ở cuối phiên */}
        {renderFeedbackSection(familyTarget, testItem.meaning)}
      </View>
    );
  }

  // Mặc định: Lật thẻ thông thường
  return null;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16
  },
  topLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3
  },
  subInstruction: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16
  },
  meaningPrompt: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 25,
    marginBottom: 6,
    paddingHorizontal: 8
  },
  meaningsDropdownWrapper: {
    alignItems: 'center',
    marginBottom: 10
  },
  meaningsDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE'
  },
  meaningsDropdownBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB'
  },
  meaningsDropdownList: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxWidth: '90%'
  },
  meaningDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2
  },
  meaningDropdownBullet: {
    fontSize: 12,
    color: '#64748B',
    marginRight: 6
  },
  meaningDropdownText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500'
  },
  imageThumbWrapper: {
    width: 120,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    overflow: 'hidden'
  },
  imageThumb: {
    width: '100%',
    height: '100%'
  },
  inputArea: {
    width: '100%',
    marginVertical: 12
  },
  audioHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20
  },
  audioHintText: {
    fontSize: 12.5,
    color: '#475569',
    marginLeft: 6,
    fontWeight: '500'
  },
  memoryCardBox: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: '#EFF6FF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    marginVertical: 16,
    minWidth: 220
  },
  memoryWordText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1D4ED8'
  },
  ipaText: {
    fontSize: 15,
    color: '#3B82F6',
    marginTop: 4
  },
  countdownHint: {
    fontSize: 12,
    color: '#60A5FA',
    marginTop: 8,
    fontStyle: 'italic'
  },
  bigSpeakerContainer: {
    alignItems: 'center',
    marginVertical: 18
  },
  bigSpeakerBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    shadowColor: '#2563EB',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4
  },
  bigSpeakerHint: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 8,
    fontWeight: '500'
  },
  listeningMeaningHint: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 10,
    textAlign: 'center'
  },
  wordDisplayBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 16,
    width: '100%'
  },
  speakingWord: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A'
  },
  speakingIpa: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 4
  },
  speakingMeaning: {
    fontSize: 14,
    color: '#334155',
    marginTop: 6,
    textAlign: 'center'
  },
  spokenResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 14,
    width: '100%'
  },
  resultBoxCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  resultBoxIncorrect: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA'
  },
  resultTitleCorrect: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46'
  },
  resultTitleIncorrect: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B'
  },
  spokenTextDetail: {
    fontSize: 13,
    color: '#334155',
    marginTop: 2
  },
  speakingActionsRow: {
    alignItems: 'center',
    marginVertical: 10
  },
  micBigBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  micBigBtnActive: {
    backgroundColor: '#DC2626'
  },
  micHintText: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '500'
  },
  sampleAudioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9'
  },
  sampleAudioBtnText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600'
  },
  sentenceBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
    width: '100%'
  },
  clozeSentenceText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 25,
    textAlign: 'center'
  },
  sentenceTranslationText: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    fontStyle: 'italic'
  },
  sentenceHintMeaning: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8
  },
  wordFamilyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    width: '100%',
    marginBottom: 12
  },
  familyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8
  },
  familyRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  posBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    marginRight: 10
  },
  posBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    textTransform: 'uppercase'
  },
  familyWordText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A'
  },
  familyMeaningText: {
    fontSize: 12.5,
    color: '#64748B'
  },
  successFeedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    width: '100%',
    gap: 8
  },
  successFeedbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065F46'
  },
  errorFeedbackCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    width: '100%'
  },
  errorFeedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6
  },
  errorFeedbackTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991B1B'
  },
  errorCorrectWordText: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 4
  },
  errorCorrectWordHighlight: {
    fontWeight: '800',
    color: '#DC2626',
    fontSize: 15
  },
  errorMeaningText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12
  },
  errorContinueBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorContinueBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700'
  },
  sentenceHintMeaningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
    gap: 6
  },
  sentenceHintMeaningLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569'
  },
  sentenceHintMeaningVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B'
  },
  wordFamilyPromptCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 14,
    width: '100%'
  },
  posBadgeHighlight: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8
  },
  posBadgeHighlightText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5
  },
  wordFamilyPromptMeaning: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4
  },
  wordFamilyPromptHint: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4
  },
  fullFamilyTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8
  }
});

