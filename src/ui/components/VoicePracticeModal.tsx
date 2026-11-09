import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { Audio } from 'expo-av';
import { Feather, Ionicons, MaterialCommunityIcons } from './Icons';
import { SpeechService } from '../../services/speech';
import { SpeechRecognitionService } from '../../services/speechRecognition';

interface VoicePracticeModalProps {
  visible: boolean;
  word: string;
  ipa?: string | null;
  meaning?: string | null;
  onClose: () => void;
}

// Cấu hình ghi âm siêu tốc: iOS ghi uncompressed WAV 16kHz, Android ghi AMR 8kHz
// Được tối ưu trực tiếp cho Google Speech API v2 (phản hồi trong 0.2s - 0.3s)
const FAST_RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
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

export function VoicePracticeModal({
  visible,
  word,
  ipa,
  meaning,
  onClose
}: VoicePracticeModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [status, setStatus] = useState<'idle' | 'recording' | 'evaluating' | 'correct' | 'incorrect' | 'recorded'>('idle');
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<any>(null);
  const autoStopTimeoutRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const resultPopAnim = useRef(new Animated.Value(0.7)).current;

  // Hiệu ứng nhịp đập khi đang thu âm
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (isRecording) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 450, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 450, useNativeDriver: true })
        ])
      );
      anim.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [isRecording]);

  // Hiệu ứng chữ vừa đọc nhảy lên màn hình khi có kết quả nhận dạng
  useEffect(() => {
    if (status === 'correct' || status === 'incorrect') {
      resultPopAnim.setValue(0.7);
      Animated.spring(resultPopAnim, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true
      }).start();
    }
  }, [status]);

  // Reset state khi mở/đóng modal
  useEffect(() => {
    if (visible) {
      setStatus('idle');
      setRecordedUri(null);
      setRecognizedText(null);
      setIsRecording(false);
      setRecordingSeconds(0);
      setErrorMessage(null);
    } else {
      stopRecordingAndCleanUp();
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    }
    return () => {
      clearAllTimers();
    };
  }, [visible]);

  const clearAllTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
  };

  const stopRecordingAndCleanUp = async () => {
    clearAllTimers();
    setIsRecording(false);
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      setRecognizedText(null);

      // Dừng âm thanh đang phát nếu có
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
        setIsPlayingRecording(false);
      }

      // Yêu cầu quyền Micro
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage('Ứng dụng cần quyền sử dụng Microphone để thu âm giọng nói của bạn.');
        return;
      }

      // Cài đặt cấu hình ghi âm tối ưu cho iOS & Android
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false
      });

      // Bắt đầu bản ghi âm với cấu hình siêu tốc FAST_RECORDING_OPTIONS
      let recordingInstance: Audio.Recording | null = null;
      try {
        const { recording } = await Audio.Recording.createAsync(FAST_RECORDING_OPTIONS);
        recordingInstance = recording;
      } catch (presetErr) {
        // Dự phòng: nếu thiết bị không hỗ trợ tùy chọn mở rộng thì dùng HIGH_QUALITY
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingInstance = recording;
      }

      recordingRef.current = recordingInstance;

      setIsRecording(true);
      setStatus('recording');
      setRecordingSeconds(0);

      // Đếm giây thu âm
      timerRef.current = setInterval(() => {
        setRecordingSeconds(sec => sec + 1);
      }, 1000);

      // Tự động dừng sau 5 giây (phù hợp với phát âm từ vựng đơn)
      autoStopTimeoutRef.current = setTimeout(() => {
        stopRecording();
      }, 5000);

    } catch (err: any) {
      console.warn('Lỗi khi bắt đầu thu âm:', err);
      setErrorMessage('Không thể khởi động bộ thu âm. Vui lòng kiểm tra quyền micro.');
      setIsRecording(false);
      setStatus('idle');
      clearAllTimers();
    }
  };

  const stopRecording = async () => {
    clearAllTimers();
    setIsRecording(false);

    if (!recordingRef.current) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      setRecordedUri(uri);
      recordingRef.current = null;

      // Chuyển chế độ âm thanh về phát loa ngoài để nghe lại rõ nét
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true
      });

      if (!uri) {
        setStatus('idle');
        return;
      }

      // Nhận diện giọng nói NGAY LẬP TỨC và phân tích đối chiếu với từ
      setStatus('evaluating');
      evaluateAudio(uri);

    } catch (err) {
      console.warn('Lỗi khi dừng thu âm:', err);
      setErrorMessage('Đã xảy ra lỗi khi lưu bản ghi âm.');
      setStatus('idle');
    }
  };

  const evaluateAudio = async (uri: string) => {
    try {
      const transcript = await SpeechRecognitionService.transcribeAudio(uri);

      if (!transcript) {
        setStatus('recorded');
        return;
      }

      setRecognizedText(transcript);
      const isCorrect = SpeechRecognitionService.isMatch(transcript, word);

      if (isCorrect) {
        setStatus('correct');
      } else {
        setStatus('incorrect');
      }
    } catch {
      setStatus('recorded');
    }
  };

  const playNativeSample = () => {
    SpeechService.speak(word);
  };

  const playUserRecording = async () => {
    if (!recordedUri) return;
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }

      setIsPlayingRecording(true);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: recordedUri },
        { shouldPlay: true }
      );
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((st: any) => {
        if (st.didJustFinish) {
          setIsPlayingRecording(false);
        }
      });
    } catch (err) {
      console.warn('Lỗi phát bản thu:', err);
      setIsPlayingRecording(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <Feather name="mic" size={18} color="#2563EB" style={{ marginRight: 6 }} />
                  <Text style={styles.title}>Luyện phát âm</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Thông tin từ vựng mục tiêu */}
              <View style={styles.wordBox}>
                <Text style={styles.targetWord}>{word}</Text>
                {ipa ? <Text style={styles.targetIpa}>{ipa}</Text> : null}
                {meaning ? (
                  <Text style={styles.targetMeaning} numberOfLines={2}>
                    {meaning.replace(/^[0-9.]+\s*/, '')}
                  </Text>
                ) : null}
              </View>

              {/* Khu vực trạng thái nhận dạng & chấm điểm */}
              <View style={styles.resultContainer}>
                {status === 'recording' && (
                  <View style={[styles.statusBox, styles.statusBoxRecording]}>
                    <View style={styles.recordingDot} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.recordingTitle}>
                        Đang lắng nghe... ({formatTime(recordingSeconds)})
                      </Text>
                      <Text style={styles.recordingSub}>
                        Hãy đọc từ "{word}", bấm nút đỏ khi nói xong
                      </Text>
                    </View>
                  </View>
                )}

                {status === 'evaluating' && (
                  <View style={[styles.statusBox, styles.statusBoxEvaluating]}>
                    <ActivityIndicator size="small" color="#2563EB" style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.evaluatingTitle}>Đang nhận dạng...</Text>
                      <Text style={styles.evaluatingSub}>Phân tích phát âm tức thì</Text>
                    </View>
                  </View>
                )}

                {status === 'correct' && (
                  <Animated.View
                    style={[
                      styles.statusBox,
                      styles.statusBoxCorrect,
                      { transform: [{ scale: resultPopAnim }] }
                    ]}
                  >
                    <Ionicons name="checkmark-circle" size={32} color="#059669" style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.correctTitle}>Phát âm CHÍNH XÁC! 🎉</Text>
                      <View style={styles.spokenBadgeCorrect}>
                        <Text style={styles.spokenBadgeLabel}>Chữ bạn vừa đọc:</Text>
                        <Text style={styles.spokenBadgeTextCorrect}>"{recognizedText}"</Text>
                      </View>
                    </View>
                  </Animated.View>
                )}

                {status === 'incorrect' && (
                  <Animated.View
                    style={[
                      styles.statusBox,
                      styles.statusBoxIncorrect,
                      { transform: [{ scale: resultPopAnim }] }
                    ]}
                  >
                    <Ionicons name="close-circle" size={32} color="#DC2626" style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.incorrectTitle}>Chưa chính xác</Text>
                      <View style={styles.spokenBadgeIncorrect}>
                        <Text style={styles.spokenBadgeLabel}>Máy nghe thấy:</Text>
                        <Text style={styles.spokenBadgeTextIncorrect}>"{recognizedText}"</Text>
                      </View>
                      <Text style={styles.incorrectHint}>Bấm "Nghe mẫu" rồi thử phát âm lại nhé!</Text>
                    </View>
                  </Animated.View>
                )}

                {status === 'recorded' && (
                  <View style={[styles.statusBox, styles.statusBoxRecorded]}>
                    <Ionicons name="checkmark-circle" size={26} color="#10B981" style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recordedTitle}>Đã thu âm xong!</Text>
                      <Text style={styles.recordedSub}>
                        Bấm "Nghe lại" để nghe giọng bạn, hoặc "Nghe mẫu" để so sánh.
                      </Text>
                    </View>
                  </View>
                )}

                {status === 'idle' && (
                  <View style={styles.statusBox}>
                    <Text style={styles.idleHint}>
                      {errorMessage || 'Bấm nút Micro màu xanh bên dưới và phát âm từ tiếng Anh.'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Các nút hành động */}
              <View style={styles.actionsRow}>
                {/* Nút nghe giọng mẫu của máy */}
                <TouchableOpacity
                  style={styles.auxBtn}
                  onPress={playNativeSample}
                  activeOpacity={0.7}
                >
                  <Ionicons name="volume-high-outline" size={22} color="#374151" />
                  <Text style={styles.auxBtnText}>Nghe mẫu</Text>
                </TouchableOpacity>

                {/* Nút Micro chính giữa (Thu / Dừng) */}
                <TouchableOpacity
                  style={[styles.micBtn, isRecording && styles.micBtnActive]}
                  onPress={isRecording ? stopRecording : startRecording}
                  activeOpacity={0.8}
                >
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <Feather
                      name={isRecording ? 'square' : 'mic'}
                      size={28}
                      color="#FFFFFF"
                    />
                  </Animated.View>
                </TouchableOpacity>

                {/* Nút nghe lại giọng người dùng vừa thu */}
                <TouchableOpacity
                  style={[styles.auxBtn, !recordedUri && styles.auxBtnDisabled]}
                  onPress={playUserRecording}
                  disabled={!recordedUri || isPlayingRecording}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={isPlayingRecording ? 'volume-2' : 'play-circle'}
                    size={22}
                    color={recordedUri ? '#2563EB' : '#9CA3AF'}
                  />
                  <Text style={[styles.auxBtnText, recordedUri && { color: '#2563EB', fontWeight: '700' }]}>
                    {isPlayingRecording ? 'Đang phát...' : 'Nghe lại'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    position: 'relative'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827'
  },
  closeBtn: {
    padding: 4
  },
  wordBox: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    marginBottom: 16
  },
  targetWord: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1F2937'
  },
  targetIpa: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
    letterSpacing: 0.5
  },
  targetMeaning: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 16
  },
  resultContainer: {
    minHeight: 82,
    marginBottom: 20
  },
  statusBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72
  },
  statusBoxRecording: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1.5,
    justifyContent: 'flex-start'
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444'
  },
  recordingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626'
  },
  recordingSub: {
    fontSize: 12,
    color: '#7F1D1D',
    marginTop: 2
  },
  statusBoxEvaluating: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1.5,
    justifyContent: 'flex-start'
  },
  evaluatingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8'
  },
  evaluatingSub: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2
  },
  statusBoxCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1.5,
    justifyContent: 'flex-start'
  },
  correctTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46'
  },
  spokenBadgeCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap'
  },
  spokenBadgeLabel: {
    fontSize: 12,
    color: '#4B5563',
    marginRight: 4
  },
  spokenBadgeTextCorrect: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669'
  },
  statusBoxIncorrect: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1.5,
    justifyContent: 'flex-start'
  },
  incorrectTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991B1B'
  },
  spokenBadgeIncorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap'
  },
  spokenBadgeTextIncorrect: {
    fontSize: 16,
    fontWeight: '800',
    color: '#DC2626'
  },
  incorrectHint: {
    fontSize: 11,
    color: '#7F1D1D',
    marginTop: 3
  },
  statusBoxRecorded: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1.5,
    justifyContent: 'flex-start'
  },
  recordedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46'
  },
  recordedSub: {
    fontSize: 12,
    color: '#047857',
    marginTop: 2
  },
  idleHint: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 4
  },
  auxBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 82,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#F3F4F6'
  },
  auxBtnDisabled: {
    opacity: 0.45
  },
  auxBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 4
  },
  micBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6
  },
  micBtnActive: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444'
  }
});
