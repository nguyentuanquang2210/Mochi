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
import { WebView } from 'react-native-webview';
import { Audio } from 'expo-av';
import { Feather, Ionicons, MaterialCommunityIcons } from './Icons';
import { SpeechService } from '../../services/speech';

interface VoicePracticeModalProps {
  visible: boolean;
  word: string;
  ipa?: string | null;
  meaning?: string | null;
  onClose: () => void;
}

const WEBVIEW_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body>
    <script>
      var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      var recognition = null;
      var isRecognizing = false;

      function sendToApp(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      function initRecognition() {
        if (!SpeechRecognition) {
          sendToApp({ type: 'error', message: 'SpeechRecognition not supported in WebView' });
          return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;

        recognition.onstart = function() {
          isRecognizing = true;
          sendToApp({ type: 'start' });
        };

        recognition.onresult = function(event) {
          var transcript = '';
          var isFinal = false;
          for (var i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              isFinal = true;
            }
          }
          sendToApp({ type: 'result', transcript: transcript, isFinal: isFinal });
        };

        recognition.onerror = function(event) {
          isRecognizing = false;
          sendToApp({ type: 'error', error: event.error });
        };

        recognition.onend = function() {
          isRecognizing = false;
          sendToApp({ type: 'end' });
        };
      }

      window.addEventListener('message', function(event) {
        try {
          var data = JSON.parse(event.data);
          if (data.action === 'start') {
            if (!recognition) initRecognition();
            if (recognition) {
              try { recognition.start(); } catch(e) {}
            }
          } else if (data.action === 'stop') {
            if (recognition && isRecognizing) {
              try { recognition.stop(); } catch(e) {}
            }
          }
        } catch(e) {}
      });

      initRecognition();
    </script>
  </body>
</html>
`;

export function VoicePracticeModal({
  visible,
  word,
  ipa,
  meaning,
  onClose
}: VoicePracticeModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isFinal, setIsFinal] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'evaluating' | 'correct' | 'incorrect'>('idle');
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);

  const webViewRef = useRef<WebView>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Hiệu ứng nhịp đập khi đang thu âm
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (isListening) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true })
        ])
      );
      anim.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [isListening]);

  // Reset state khi mở modal
  useEffect(() => {
    if (visible) {
      setTranscript('');
      setIsFinal(false);
      setStatus('idle');
      setRecordedUri(null);
      setIsListening(false);
    } else {
      stopListening();
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    }
  }, [visible]);

  const cleanText = (str: string) => {
    return (str || '')
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, '')
      .trim();
  };

  const startListening = async () => {
    try {
      setTranscript('');
      setIsFinal(false);
      setStatus('listening');
      setIsListening(true);

      // Yêu cầu quyền Micro & chuẩn bị Audio recording
      const permission = await Audio.requestPermissionsAsync();
      if (permission.granted) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true
        });
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
      }

      // Kích hoạt SpeechRecognition trong WebView
      webViewRef.current?.postMessage(JSON.stringify({ action: 'start' }));
    } catch (err) {
      console.warn('Start listening error:', err);
      setIsListening(false);
      setStatus('idle');
    }
  };

  const stopListening = async () => {
    setIsListening(false);
    webViewRef.current?.postMessage(JSON.stringify({ action: 'stop' }));

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        setRecordedUri(uri);
        recordingRef.current = null;
      } catch (err) {
        console.warn('Stop recording error:', err);
      }
    }
  };

  const evaluateTranscript = (spoken: string) => {
    const cleanSpoken = cleanText(spoken);
    const targetWord = cleanText(word);

    if (!cleanSpoken) {
      setStatus('idle');
      return;
    }

    // So khớp từ vựng: nếu khớp hoàn toàn hoặc chứa từ mục tiêu
    const spokenTokens = cleanSpoken.split(/\s+/);
    const isMatch = cleanSpoken === targetWord || spokenTokens.includes(targetWord);

    if (isMatch) {
      setStatus('correct');
    } else {
      setStatus('incorrect');
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'start') {
        setIsListening(true);
      } else if (data.type === 'result') {
        const text = data.transcript || '';
        setTranscript(text);
        if (data.isFinal) {
          setIsFinal(true);
          stopListening();
          evaluateTranscript(text);
        }
      } else if (data.type === 'end') {
        setIsListening(false);
        if (transcript) {
          evaluateTranscript(transcript);
        } else if (status === 'listening') {
          setStatus('idle');
        }
      } else if (data.type === 'error') {
        console.warn('Speech recognition error:', data.error);
        setIsListening(false);
      }
    } catch (e) {}
  };

  const playNativeSample = () => {
    SpeechService.speak(word);
  };

  const playUserRecording = async () => {
    if (!recordedUri) return;
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      setIsPlayingRecording(true);
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
      console.warn('Play recording error:', err);
      setIsPlayingRecording(false);
    }
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
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Từ mục tiêu & IPA */}
              <View style={styles.wordBox}>
                <Text style={styles.targetWord}>{word}</Text>
                {ipa && <Text style={styles.targetIpa}>{ipa}</Text>}
                {meaning && (
                  <Text style={styles.targetMeaning} numberOfLines={2}>
                    {meaning}
                  </Text>
                )}
              </View>

              {/* Khu vực kết quả nhận diện */}
              <View style={styles.resultContainer}>
                {status === 'listening' ? (
                  <View style={styles.statusBox}>
                    <Text style={styles.listeningHint}>
                      {transcript ? `"${transcript}"` : 'Đang lắng nghe... hãy nói tiếng Anh'}
                    </Text>
                  </View>
                ) : status === 'correct' ? (
                  <View style={[styles.statusBox, styles.statusBoxCorrect]}>
                    <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.correctTitle}>Phát âm chuẩn xác! 🎉</Text>
                      <Text style={styles.transcriptText}>"{transcript}"</Text>
                    </View>
                  </View>
                ) : status === 'incorrect' ? (
                  <View style={[styles.statusBox, styles.statusBoxIncorrect]}>
                    <Ionicons name="alert-circle" size={24} color="#EF4444" />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.incorrectTitle}>Chưa khớp với từ mẫu</Text>
                      <Text style={styles.transcriptText}>
                        Máy nghe được: <Text style={{ fontWeight: '700' }}>"{transcript || '(chưa rõ)'}"</Text>
                      </Text>
                      <Text style={styles.retryHint}>Hãy thử nghe phát âm mẫu và nói lại nhé!</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.statusBox}>
                    <Text style={styles.idleHint}>Nhấn vào biểu tượng Micro bên dưới để bắt đầu nói</Text>
                  </View>
                )}
              </View>

              {/* Các nút hành động */}
              <View style={styles.actionsRow}>
                {/* Nút nghe mẫu */}
                <TouchableOpacity
                  style={styles.auxBtn}
                  onPress={playNativeSample}
                  activeOpacity={0.7}
                >
                  <Ionicons name="volume-high-outline" size={20} color="#374151" />
                  <Text style={styles.auxBtnText}>Nghe mẫu</Text>
                </TouchableOpacity>

                {/* Nút Micro chính giữa */}
                <TouchableOpacity
                  style={[styles.micBtn, isListening && styles.micBtnActive]}
                  onPress={isListening ? stopListening : startListening}
                  activeOpacity={0.8}
                >
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <Feather
                      name={isListening ? 'square' : 'mic'}
                      size={28}
                      color="#FFFFFF"
                    />
                  </Animated.View>
                </TouchableOpacity>

                {/* Nút nghe lại giọng của tôi */}
                <TouchableOpacity
                  style={[styles.auxBtn, !recordedUri && styles.auxBtnDisabled]}
                  onPress={playUserRecording}
                  disabled={!recordedUri || isPlayingRecording}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={isPlayingRecording ? 'volume-2' : 'play-circle'}
                    size={20}
                    color={recordedUri ? '#2563EB' : '#9CA3AF'}
                  />
                  <Text style={[styles.auxBtnText, recordedUri && { color: '#2563EB' }]}>
                    {isPlayingRecording ? 'Đang phát...' : 'Nghe lại'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Hidden WebView để chạy Web Speech API native */}
              <View style={styles.hiddenWebView}>
                <WebView
                  ref={webViewRef}
                  source={{ html: WEBVIEW_HTML }}
                  originWhitelist={['*']}
                  javaScriptEnabled
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={false}
                  onMessage={handleWebViewMessage}
                />
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
    minHeight: 76,
    marginBottom: 20
  },
  statusBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64
  },
  statusBoxCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1.5,
    justifyContent: 'flex-start'
  },
  statusBoxIncorrect: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1.5,
    justifyContent: 'flex-start'
  },
  listeningHint: {
    fontSize: 15,
    color: '#2563EB',
    fontWeight: '600',
    fontStyle: 'italic'
  },
  idleHint: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center'
  },
  correctTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46'
  },
  incorrectTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991B1B'
  },
  transcriptText: {
    fontSize: 13,
    color: '#374151',
    marginTop: 2
  },
  retryHint: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4
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
    width: 80,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F3F4F6'
  },
  auxBtnDisabled: {
    opacity: 0.5
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
  },
  hiddenWebView: {
    width: 0,
    height: 0,
    opacity: 0,
    position: 'absolute'
  }
});

