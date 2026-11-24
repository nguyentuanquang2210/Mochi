import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  UIManager,
  View
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from './components/Icons';
import { CardOptionsMenu } from './components/CardOptionsMenu';
import { MarkdownCard } from './components/MarkdownCard';
import { SpeakerButton, lastSpeakerPressTimestamp } from './components/SpeakerButton';
import { VoicePracticeModal } from './components/VoicePracticeModal';
import { ReviewExerciseView, ExerciseType } from './components/ReviewExerciseView';
import { SpeechService } from '../services/speech';
import { SoundEffects } from '../services/soundEffects';
import { TOEIC_MAP } from '../data/toeicWordlist';
import { DictionaryService, normalizeToStandardIpa } from '../services/dictionary';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CardSummary, Deck, FsrsState, Rating, StudyQueueItem } from '../domain/types';
import { CardRepository, StudySessionRepository, UserSettingsRepository } from '../data/repositories';

export type PracticeMode = 'mixed' | ExerciseType;

export const EXERCISE_OPTIONS: { id: ExerciseType; label: string; icon: string; desc: string }[] = [
  { id: 'fill_in_blank', label: 'Điền từ (Gạch chân)', icon: 'edit-3', desc: 'Nhìn nghĩa tiếng Việt → Viết từ tiếng Anh' },
  { id: 'memory_write', label: 'Nhớ & viết lại', icon: 'zap', desc: 'Xem từ 2s rồi che đi → Viết lại bằng trí nhớ' },
  { id: 'listening', label: 'Luyện nghe TOEIC', icon: 'headphones', desc: 'Nghe phát âm mà không nhìn chữ → Điền từ' },
  { id: 'speaking', label: 'Luyện phát âm', icon: 'mic', desc: 'Nhìn từ → Tự đọc to vào micro' },
  { id: 'sentence_cloze', label: 'Điền từ vào câu', icon: 'file-text', desc: 'Điền từ vào chỗ trống trong ngữ cảnh' },
  { id: 'word_family', label: 'Họ từ (Word Form)', icon: 'layers', desc: 'Biến thể từ loại: Danh, Động, Tính, Trạng từ' },
  { id: 'flashcard', label: 'Ghi nhớ bằng thẻ', icon: 'cards-outline', desc: 'Mặt trước / Mặt sau dạng flashcard' },
];

export const ALL_EXERCISE_TYPES: ExerciseType[] = EXERCISE_OPTIONS.map(o => o.id);

export const PRACTICE_MODES: { id: PracticeMode; label: string; icon: string; desc: string }[] = [
  { id: 'mixed', label: 'Trộn đa dạng (Mixed)', icon: 'shuffle', desc: 'Luân phiên các hình thức bài tập đã chọn' },
  ...EXERCISE_OPTIONS
];

const MIXED_CYCLE: ExerciseType[] = ALL_EXERCISE_TYPES;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Thuật toán xáo trộn ngẫu nhiên Fisher-Yates (Đảo tung thẻ để kích thích trí nhớ, tránh học vẹt theo thứ tự)
function shuffleCards<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

interface ReviewProps {
  deck: Deck | null;
  reviewMode?: 'due' | 'new' | 'cram';
  onDone: () => void;
  onOpenDrawer: () => void;
  onEditCard: (card: CardSummary) => void;
  initialPracticeModes?: ExerciseType[];
  onPracticeModesChange?: (modes: ExerciseType[]) => void;
}

export function Review({
  deck,
  reviewMode = 'due',
  onDone,
  onOpenDrawer,
  onEditCard,
  initialPracticeModes,
  onPracticeModesChange
}: ReviewProps) {
  const [queue, setQueue] = useState<StudyQueueItem[]>([]);
  const [history, setHistory] = useState<{ card: CardSummary; state: FsrsState; previousState: FsrsState }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealedSideIndex, setRevealedSideIndex] = useState(0); // 0 = only front side, > 0 = revealed hidden sides
  const [loading, setLoading] = useState(true);
  const [showCardMenu, setShowCardMenu] = useState(false);
  const [showVoicePractice, setShowVoicePractice] = useState(false);
  const [selectedExerciseTypes, setSelectedExerciseTypes] = useState<ExerciseType[]>(() => {
    if (initialPracticeModes && initialPracticeModes.length > 0) return initialPracticeModes;
    return UserSettingsRepository.getCachedPracticeModes();
  });
  const [showModeModal, setShowModeModal] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Theo dõi số lần lật xem mặt ẩn của thẻ hiện tại chuẩn Mochi
  const [currentRevealCount, setCurrentRevealCount] = useState(0);
  const currentRevealCountRef = useRef(0);
  const hasRevealedInCurrentAttemptRef = useRef(false);
  // Theo dõi ngầm thời điểm xuất hiện của thẻ để tính thời gian phản hồi (Retrieval Latency)
  const cardStartTimeRef = useRef<number>(Date.now());

  // Khi chuyển sang một thẻ mới trong phiên:
  // Reset trạng thái "đã lật ở lượt này", ghi lại thời điểm bắt đầu xuất hiện thẻ và khởi tạo số lần lật tích lũy của thẻ đó
  useEffect(() => {
    hasRevealedInCurrentAttemptRef.current = false;
    cardStartTimeRef.current = Date.now();
    const initialReveals = queue[currentIndex]?.revealCount || 0;
    currentRevealCountRef.current = initialReveals;
    setCurrentRevealCount(initialReveals);
    setRevealedSideIndex(0);
  }, [currentIndex]);

  // Cập nhật khi prop initialPracticeModes thay đổi
  useEffect(() => {
    if (initialPracticeModes && initialPracticeModes.length > 0) {
      setSelectedExerciseTypes(initialPracticeModes);
    }
  }, [initialPracticeModes]);

  // Khởi tạo hình thức ôn tập từ kho lưu trữ bền vững (SQLite & AsyncStorage)
  useEffect(() => {
    UserSettingsRepository.getPracticeModes().then(modes => {
      if (modes && modes.length > 0) {
        setSelectedExerciseTypes(modes);
        onPracticeModesChange?.(modes);
      }
    }).catch(() => {});
  }, []);

  const toggleExerciseType = (type: ExerciseType) => {
    setSelectedExerciseTypes(prev => {
      let next: ExerciseType[];
      if (prev.includes(type)) {
        if (prev.length <= 1) {
          Alert.alert('Lưu ý', 'Bạn cần chọn ít nhất 1 hình thức ôn tập.');
          return prev;
        }
        next = prev.filter(t => t !== type);
      } else {
        next = [...prev, type];
      }
      UserSettingsRepository.setPracticeModes(next).catch(() => {});
      AsyncStorage.setItem('selected_practice_modes', JSON.stringify(next)).catch(() => {});
      onPracticeModesChange?.(next);
      return next;
    });
  };

  const handleSelectAll = () => {
    const next: ExerciseType[] = selectedExerciseTypes.length === ALL_EXERCISE_TYPES.length
      ? ['flashcard']
      : ALL_EXERCISE_TYPES;
    setSelectedExerciseTypes(next);
    UserSettingsRepository.setPracticeModes(next).catch(() => {});
    AsyncStorage.setItem('selected_practice_modes', JSON.stringify(next)).catch(() => {});
    onPracticeModesChange?.(next);
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Animation values for swipe physics and hidden side drop
  const pan = useRef(new Animated.ValueXY()).current;
  const dropAnim = useRef(new Animated.Value(0)).current;
  // Opacity cho hiệu ứng thẻ bay ra & thẻ mới fade-in
  const cardSwipeOpacity = useRef(new Animated.Value(1)).current;
  const cardFadeIn = useRef(new Animated.Value(1)).current;

  // Refs to avoid stale closure in PanResponder
  const queueRef = useRef<StudyQueueItem[]>([]);
  const currentIndexRef = useRef(0);
  const correctStreakRef = useRef(0);
  const consecutiveWrongRef = useRef(0);

  useEffect(() => {
    // Duy trì phần cứng Audio DAC luôn active trong suốt quá trình ôn tập thẻ
    // Giúp loại bỏ hoàn toàn hiện tượng khựng/giật khi bấm loa lần đầu và sau khi để yên
    SpeechService.startKeepAlive();
    return () => {
      SpeechService.stopKeepAlive();
      SoundEffects.stopCurrent();
    };
  }, []);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
    setCurrentRevealCount(0);
    currentRevealCountRef.current = 0;
  }, [currentIndex]);

  useEffect(() => {
    loadDueCards();
  }, [deck?.id, reviewMode]);

  useEffect(() => {
    if (!loading && queue.length > 0 && currentIndex >= queue.length) {
      StudySessionRepository.complete(sessionId).catch(() => {});
    }
  }, [loading, queue.length, currentIndex, sessionId]);

  const loadDueCards = async () => {
    setLoading(true);
    const saved = await StudySessionRepository.loadActive(deck?.id, reviewMode);
    if (saved) {
      // BẢO VỆ TUYỆT ĐỐI: Nếu đang ôn theo 1 bộ thẻ cụ thể, loại bỏ bất kỳ thẻ nào không thuộc bộ đó
      let validQueue = saved.queue;
      if (deck?.id) {
        validQueue = saved.queue.filter(item => item.card.deckId === deck.id);
      }
      if (validQueue.length > 0) {
        setQueue(validQueue);
        queueRef.current = validQueue;
        const validIdx = Math.min(saved.currentIndex, validQueue.length - 1);
        setCurrentIndex(validIdx);
        currentIndexRef.current = validIdx;
        setSessionId(saved.id);
        setLoading(false);
        return;
      }
    }
    let cards: StudyQueueItem[] = [];
    if (reviewMode === 'new') {
      cards = (await CardRepository.getNewCards(deck?.id)).map(item => ({ ...item, direction: 'meaning_en_vi' as const }));
    } else if (reviewMode === 'cram') {
      cards = (await CardRepository.getCramCards(deck ? deck.id : undefined)).map(item => ({ ...item, direction: 'meaning_en_vi' as const }));
    } else if (deck) {
      // 1. Chỉ lấy danh sách thẻ đến hạn ôn tập (Due) + thẻ mới của bộ thẻ
      // TUYỆT ĐỐI KHÔNG tự động chuyển sang cram (ôn cấp tốc) khi hết thẻ, vì sẽ làm tăng thời gian FSRS liên tục ngoài ý muốn
      cards = await CardRepository.getDueCards(deck.id) as StudyQueueItem[];
    } else {
      // Global Review: Chỉ lấy các thẻ đến hạn từ tất cả các bộ
      cards = await CardRepository.getDueCards() as StudyQueueItem[];
    }

    // BẢO VỆ TUYỆT ĐỐI CẤP 2: Nếu có deck?.id, đảm bảo 100% không thẻ nào của bộ khác lọt vào hàng đợi
    if (deck?.id) {
      cards = cards.filter(item => item.card.deckId === deck.id);
    }

    // Đảo tung thẻ ngẫu nhiên (Fisher-Yates Shuffle) chuẩn Spaced Repetition Mochi Cards
    const shuffled = shuffleCards(cards);
    setQueue(shuffled);
    queueRef.current = shuffled;
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    setRevealedSideIndex(0);
    pan.setValue({ x: 0, y: 0 });
    dropAnim.setValue(0);
    // Fade-in thẻ đầu tiên khi load xong
    cardFadeIn.setValue(0);
    Animated.timing(cardFadeIn, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    if (shuffled.length > 0) {
      const createdSession = await StudySessionRepository.save({ deckId: deck?.id, reviewMode, queue: shuffled, currentIndex: 0 });
      setSessionId(createdSession);
    } else {
      setSessionId(null);
    }
    setLoading(false);
  };

  const handleStartCram = async () => {
    setLoading(true);
    let cram = (await CardRepository.getCramCards(deck ? deck.id : undefined)).map(item => ({ ...item, direction: 'meaning_en_vi' as const }));
    if (deck?.id) {
      cram = cram.filter(item => item.card.deckId === deck.id);
    }
    const shuffled = shuffleCards(cram);
    setQueue(shuffled);
    queueRef.current = shuffled;
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    setRevealedSideIndex(0);
    if (shuffled.length > 0) {
      const createdSession = await StudySessionRepository.save({ deckId: deck?.id, reviewMode: 'cram', queue: shuffled, currentIndex: 0 });
      setSessionId(createdSession);
    } else {
      setSessionId(null);
    }
    setLoading(false);
  };

  const currentItem = queue[currentIndex] || null;
  const currentCard = currentItem?.card || null;
  const sides = currentCard ? currentCard.sides : [];

  const isReverseReview = Boolean(currentCard?.reviewReverse || currentCard?.objective === 'meaning_vi_en');
  const englishWord = (currentCard?.objective === 'meaning_vi_en'
    ? (sides[1] || currentCard?.back || '')
    : (sides[0] || currentCard?.front || '')
  ).trim();
  const vietnameseMeaning = (currentCard?.objective === 'meaning_vi_en'
    ? (sides[0] || currentCard?.front || '')
    : (sides[1] || currentCard?.back || '')
  ).trim();

  const activeTypes = selectedExerciseTypes.length > 0 ? selectedExerciseTypes : ALL_EXERCISE_TYPES;
  const effectiveExerciseType: ExerciseType = activeTypes[currentIndex % activeTypes.length];

  const getPracticeModePillInfo = () => {
    if (selectedExerciseTypes.length === 1) {
      const single = EXERCISE_OPTIONS.find(o => o.id === selectedExerciseTypes[0]);
      return {
        label: single?.label || 'Ôn tập',
        icon: single?.icon || 'check-circle',
        isMaterial: single?.id === 'flashcard'
      };
    }
    if (selectedExerciseTypes.length === ALL_EXERCISE_TYPES.length) {
      return {
        label: 'Trộn tất cả (7)',
        icon: 'shuffle',
        isMaterial: false
      };
    }
    return {
      label: `Đa dạng (${selectedExerciseTypes.length} hình thức)`,
      icon: 'shuffle',
      isMaterial: false
    };
  };

  // Lấy và tự động bổ sung phiên âm IPA cho thẻ hiện tại dựa trên Accent người dùng đã chọn
  const userAccent = SpeechService.getSettings().accent;
  const [liveCardIpa, setLiveCardIpa] = useState<string | null>(null);

  useEffect(() => {
    if (!currentCard) {
      setLiveCardIpa(null);
      return;
    }
    const clean = englishWord.trim().toLowerCase();
    const toeic = TOEIC_MAP.get(clean);
    const existingIpa = userAccent === 'en-GB'
      ? (currentCard.ipaUk || currentCard.ipaUs || toeic?.ipaUk || toeic?.ipaUs)
      : (currentCard.ipaUs || currentCard.ipaUk || toeic?.ipaUs || toeic?.ipaUk);

    if (existingIpa) {
      setLiveCardIpa(normalizeToStandardIpa(existingIpa));
    } else {
      setLiveCardIpa(null);
      // Tự động tra cứu và bổ sung IPA ngay lập tức cho các thẻ chưa có IPA
      if (clean) {
        DictionaryService.lookupWord(clean).then(info => {
          if (info.verified && (info.ipaUs || info.ipaUk)) {
            const fetched = userAccent === 'en-GB' ? (info.ipaUk || info.ipaUs) : (info.ipaUs || info.ipaUk);
            if (fetched) setLiveCardIpa(normalizeToStandardIpa(fetched));
            CardRepository.updateIpa(currentCard.id, normalizeToStandardIpa(info.ipaUs) || null, normalizeToStandardIpa(info.ipaUk) || null).catch(() => {});
          }
        }).catch(() => {});
      }
    }
  }, [currentCard?.id, englishWord, userAccent]);

  // Toggle reveal / hide with drop effect
  const handleToggleReveal = () => {
    if (Date.now() - lastSpeakerPressTimestamp < 450) {
      return;
    }
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (revealedSideIndex === 0) {
      // Chỉ tính +1 lần lật xem ở lần mở đầu tiên trong lượt học hiện tại của thẻ.
      // Nếu người dùng cứ lật đi lật lại ở cùng một thẻ trước khi đánh giá thì chỉ tính 1 lần.
      if (!hasRevealedInCurrentAttemptRef.current) {
        hasRevealedInCurrentAttemptRef.current = true;
        const initialCount = queue[currentIndex]?.revealCount || 0;
        const nextCount = initialCount + 1;
        currentRevealCountRef.current = nextCount;
        setCurrentRevealCount(nextCount);
      }
      setRevealedSideIndex(Math.max(1, sides.length - 1));
      dropAnim.setValue(0);
      Animated.spring(dropAnim, {
        toValue: 1,
        friction: 8,
        tension: 60,
        useNativeDriver: true
      }).start();
    } else {
      setRevealedSideIndex(0);
      dropAnim.setValue(0);
    }
  };

  const handleRate = async (rating: Rating) => {
    const curIdx = currentIndexRef.current;
    const curQueue = queueRef.current;
    if (!curQueue || curIdx >= curQueue.length) return;

    const item = curQueue[curIdx];

    // Dừng phát âm từ trước đó ngay lập tức khi chuyển thẻ
    SpeechService.stop();

    // Reset cử chỉ và mặt ẩn tức thời
    pan.setValue({ x: 0, y: 0 });
    dropAnim.setValue(0);
    // Fade-in thẻ đầu tiên khi load xong
    cardFadeIn.setValue(0);
    Animated.timing(cardFadeIn, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    setRevealedSideIndex(0);

    // Fade-in mượt mà cho thẻ tiếp theo (thẻ mới xuất hiện từ từ, không bật đột ngột)
    cardFadeIn.setValue(0);
    Animated.timing(cardFadeIn, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();

    // Đo thời gian nhận diện và phản hồi (Retrieval Latency / Response Time) chạy ngầm
    const responseTimeMs = Math.max(100, Date.now() - (cardStartTimeRef.current || Date.now()));
    const responseSeconds = responseTimeMs / 1000;

    // Ngưỡng thời gian khoa học (Retrieval Latency Benchmarks):
    // 1. Thẻ Flashcard thông thường:
    //    - <= 5.0s: Phản xạ nhanh, trí nhớ đã củng cố vững vàng -> 'good' / 'easy', không lặp lại.
    //    - > 5.0s đến <= 12.0s: Do dự, mất nhiều thời gian nhớ lại -> hạ 'hard', tự động chèn lại sau 3 thẻ.
    //    - > 12.0s: Quá lâu, suýt quên hoàn toàn -> hạ 'again', tự động chèn lại sau 3 thẻ.
    // 2. Các bài tập tương tác (fill_in_blank, memory_write, listening, speaking, sentence_cloze, word_family):
    //    - Cần thời gian đọc ngữ cảnh câu, nghe audio và gõ phím (ước tính thao tác gõ 3-5 giây)
    //    - <= 9.0s: Nhanh, phản xạ gõ tốt -> giữ nguyên 'good' / 'easy'.
    //    - > 9.0s đến <= 20.0s: Do dự, ngẫm nghĩ lâu mới gõ xong -> hạ 'hard', tự động chèn lại sau 3 thẻ.
    //    - > 20.0s: Chật vật hoặc gần như quên -> hạ 'again', tự động chèn lại sau 3 thẻ.
    const isInteractive = effectiveExerciseType !== 'flashcard';
    const hesitationThreshold = isInteractive ? 9.0 : 5.0;
    const lapseThreshold = isInteractive ? 20.0 : 12.0;

    const isHesitant = responseSeconds > hesitationThreshold;
    const isLapse = responseSeconds > lapseThreshold;

    // Khi ôn tập trong 1 tệp thẻ cụ thể (Boolean(deck)) hoặc ở chế độ cram:
    // TUYỆT ĐỐI KHÔNG ghi nhận lượt ôn FSRS, không tăng reps, không thay đổi due date.
    // Vì đây là người dùng tự bấm ôn tập tự do theo tệp thẻ.
    // CHỈ CÓ phiên ôn tập hằng ngày tại Inbox (!deck && reviewMode !== 'cram') mới ghi nhận FSRS.
    const isFreeDeckPractice = Boolean(deck) || reviewMode === 'cram';
    const reveals = currentRevealCountRef.current;
    let updatedItem = item;

    // Trong phiên ôn tập hằng ngày Inbox (chuẩn Mochi Spaced Repetition):
    // Căn cứ vào số lần người dùng phải lật xem lại mặt ẩn HOẶC thời gian ngẫm nghĩ để điều chỉnh mức độ nhớ:
    let effectiveRating: Rating = rating;
    if (!isFreeDeckPractice) {
      if (rating === 'good' || rating === 'easy') {
        if (reveals >= 3 || isLapse) {
          // Lật xem mặt ẩn >= 3 lần HOẶC nghĩ quá lâu (> 12s flashcard / > 20s bài tập) -> tính là 'again'
          effectiveRating = 'again';
        } else if (reveals >= 1 || isHesitant) {
          // Lật xem mặt ẩn 1-2 lần HOẶC do dự, nghĩ lâu (> 5s flashcard / > 9s bài tập) -> hạ thành 'hard'
          effectiveRating = 'hard';
        }
      }
    }

    try {
      if (!item.fsrsRecorded && !isFreeDeckPractice) {
        const oldState = item.state;
        const nextState = await CardRepository.review(item.card, oldState, effectiveRating, responseTimeMs);
        updatedItem = { ...item, state: nextState, fsrsRecorded: true };
        setHistory(prev => [...prev, { card: item.card, state: nextState, previousState: oldState }]);
      }
    } catch (e) {
      console.warn('Lỗi ghi nhận lượt ôn:', e);
    }

    // Vòng lặp học tập trong phiên (Intra-session learning loop chuẩn Mochi):
    // 1. Nếu trả lời sai ('again' hoặc bị giáng xuống 'again' do lật xem >= 3 lần hoặc thời gian quá lâu):
    // 2. HOẶC bấm 'good' nhưng trong phiên Inbox người dùng vẫn phải lật xem mặt ẩn (reveals >= 1) HOẶC mất nhiều thời gian do dự (isHesitant):
    // -> BẮT BUỘC chèn lại thẻ sau 3 thẻ nữa để người học tự kiểm tra lại trí nhớ mà không xem mặt ẩn với phản xạ nhanh hơn!
    const needsRepeat = effectiveRating === 'again' || (!isFreeDeckPractice && (reveals >= 1 || isHesitant));
    let nextQueue = [...curQueue];
    if (needsRepeat) {
      const insertAt = Math.min(nextQueue.length, curIdx + 1 + 3);
      nextQueue.splice(insertAt, 0, {
        ...updatedItem,
        reReviewCount: (item.reReviewCount || 0) + 1,
        revealCount: reveals,
        lastResponseTimeMs: responseTimeMs
      });
    }

    // Hiệu ứng âm thanh khi ôn tập theo mốc chuỗi đúng & khi mất chuỗi (đồng nhất cho mọi hình thức ôn tập)
    const isCorrect = effectiveRating === 'good' || effectiveRating === 'easy';
    if (isCorrect) {
      const newStreak = correctStreakRef.current + 1;
      correctStreakRef.current = newStreak;
      consecutiveWrongRef.current = 0;
      setTimeout(() => {
        void SoundEffects.playForStreak(newStreak);
      }, 200);
    } else {
      const prevStreak = correctStreakRef.current;
      const newWrong = consecutiveWrongRef.current + 1;
      consecutiveWrongRef.current = newWrong;
      correctStreakRef.current = 0;
      setTimeout(() => {
        void SoundEffects.playStreakLost(prevStreak, newWrong);
      }, 200);
    }

    // Reset bộ đếm lật mặt ẩn cho thẻ tiếp theo
    setCurrentRevealCount(0);
    currentRevealCountRef.current = 0;

    const nextIdx = curIdx + 1;
    queueRef.current = nextQueue; setQueue(nextQueue);
    currentIndexRef.current = nextIdx; setCurrentIndex(nextIdx);
    await StudySessionRepository.save({ id: sessionId || undefined, deckId: deck?.id, reviewMode, queue: nextQueue, currentIndex: nextIdx }).then(setSessionId);
  };

  // Button triggers with card flying animation — mượt mà, ease-in, 300ms
  const handlePressForgot = () => {
    Animated.parallel([
      Animated.timing(pan, {
        toValue: { x: -700, y: 0 },
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: false
      }),
      Animated.timing(cardSwipeOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true
      })
    ]).start(() => {
      cardSwipeOpacity.setValue(1);
      handleRate('again');
    });
  };

  const handlePressGood = () => {
    Animated.parallel([
      Animated.timing(pan, {
        toValue: { x: 700, y: 0 },
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: false
      }),
      Animated.timing(cardSwipeOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true
      })
    ]).start(() => {
      cardSwipeOpacity.setValue(1);
      handleRate('good');
    });
  };

  const handleUndo = async () => {
    if (history.length === 0 || currentIndexRef.current === 0) return;
    const lastAction = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    const prevIdx = Math.max(0, currentIndexRef.current - 1);
    currentIndexRef.current = prevIdx;
    setCurrentIndex(prevIdx);
    setRevealedSideIndex(0);
    cardStartTimeRef.current = Date.now();
    pan.setValue({ x: 0, y: 0 });
    dropAnim.setValue(0);
    // Fade-in thẻ đầu tiên khi load xong
    cardFadeIn.setValue(0);
    Animated.timing(cardFadeIn, { toValue: 1, duration: 220, useNativeDriver: true }).start();

    // Hoàn tác lại trạng thái FSRS của thẻ trong cơ sở dữ liệu nếu người dùng quẹt nhầm
    if (lastAction?.previousState) {
      try {
        await CardRepository.rollbackState(lastAction.previousState);
      } catch (e) {
        console.warn('Rollback state error:', e);
      }
    }
  };

  const handleSkip = () => {
    const curIdx = currentIndexRef.current;
    const curQueue = queueRef.current;
    if (!curQueue || curQueue.length <= 1 || curIdx >= curQueue.length) return;

    const nextQueue = [...curQueue];
    const skipped = nextQueue.splice(curIdx, 1)[0];
    nextQueue.push(skipped);
    queueRef.current = nextQueue;
    setQueue(nextQueue);
    setRevealedSideIndex(0);
    hasRevealedInCurrentAttemptRef.current = false;
    const nextInitialReveals = nextQueue[curIdx]?.revealCount || 0;
    currentRevealCountRef.current = nextInitialReveals;
    setCurrentRevealCount(nextInitialReveals);
    cardStartTimeRef.current = Date.now();
    pan.setValue({ x: 0, y: 0 });
    dropAnim.setValue(0);
    // Fade-in thẻ đầu tiên khi load xong
    cardFadeIn.setValue(0);
    Animated.timing(cardFadeIn, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  };

  // PanResponder for swiping left (Forgot / light red) & right (Good / light green)
  // Strictly horizontal swiping only, no vertical page dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gestureState) => {
        // Chỉ cho phép di chuyển ngang trái/phải, khoá cứng trục dọc y = 0
        pan.setValue({ x: gestureState.dx, y: 0 });
      },
      onPanResponderRelease: (_, gestureState) => {
        const SWIPE_THRESHOLD = 80;
        if (gestureState.dx < -SWIPE_THRESHOLD || (gestureState.dx < -30 && gestureState.vx < -0.6)) {
          // Gạt sang bên trái -> Xác nhận KHÔNG NHỚ (Again)
          Animated.parallel([
            Animated.timing(pan, {
              toValue: { x: -700, y: 0 },
              duration: 280,
              easing: Easing.in(Easing.ease),
              useNativeDriver: false
            }),
            Animated.timing(cardSwipeOpacity, {
              toValue: 0,
              duration: 230,
              useNativeDriver: true
            })
          ]).start(() => {
            cardSwipeOpacity.setValue(1);
            handleRate('again');
          });
        } else if (gestureState.dx > SWIPE_THRESHOLD || (gestureState.dx > 30 && gestureState.vx > 0.6)) {
          // Gạt sang bên phải -> Xác nhận ĐÃ NHỚ (Good)
          Animated.parallel([
            Animated.timing(pan, {
              toValue: { x: 700, y: 0 },
              duration: 280,
              easing: Easing.in(Easing.ease),
              useNativeDriver: false
            }),
            Animated.timing(cardSwipeOpacity, {
              toValue: 0,
              duration: 230,
              useNativeDriver: true
            })
          ]).start(() => {
            cardSwipeOpacity.setValue(1);
            handleRate('good');
          });
        } else {
          // Gạt mới 1 tí mà buông tay: Lập tức đàn hồi mượt mà về tâm
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            tension: 60,
            useNativeDriver: false
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 5,
          tension: 60,
          useNativeDriver: false
        }).start();
      }
    })
  ).current;

  // Visual interpolations for card swipe
  const rotate = pan.x.interpolate({
    inputRange: [-240, 0, 240],
    outputRange: ['-9deg', '0deg', '9deg'],
    extrapolate: 'clamp'
  });

  const cardBorderColor = pan.x.interpolate({
    inputRange: [-120, -20, 0, 20, 120],
    outputRange: ['#FCA5A5', '#FCA5A5', '#E6E6E6', '#BBEFBC', '#BBEFBC'],
    extrapolate: 'clamp'
  });

  const redBadgeOpacity = pan.x.interpolate({
    inputRange: [-100, -20, 0],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp'
  });

  const greenBadgeOpacity = pan.x.interpolate({
    inputRange: [0, 20, 100],
    outputRange: [0, 0.4, 1],
    extrapolate: 'clamp'
  });

  const forgotBtnBg = pan.x.interpolate({
    inputRange: [-120, -20, 0],
    outputRange: ['#FDE8E8', '#FDE8E8', '#EDEDED'],
    extrapolate: 'clamp'
  });

  const forgotBtnBorderColor = pan.x.interpolate({
    inputRange: [-120, -20, 0],
    outputRange: ['#F8B4B4', '#F8B4B4', '#EDEDED'],
    extrapolate: 'clamp'
  });

  const goodBtnBg = pan.x.interpolate({
    inputRange: [0, 20, 120],
    outputRange: ['#EDEDED', '#EAF8EC', '#EAF8EC'],
    extrapolate: 'clamp'
  });

  const goodBtnBorderColor = pan.x.interpolate({
    inputRange: [0, 20, 120],
    outputRange: ['#EDEDED', '#BBEFBC', '#BBEFBC'],
    extrapolate: 'clamp'
  });

  // Progress percentage
  const totalCards = queue.length || 1;
  const progressPercent = Math.min(100, Math.round(((currentIndex + 1) / totalCards) * 100));

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Đang tải thẻ học…</Text>
        </View>
      </View>
    );
  }

  // All cards finished
  if (!currentItem || currentIndex >= queue.length) {
    return (
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onOpenDrawer} style={styles.iconBtn}>
            <Feather name="menu" size={24} color="#333333" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name="file-tray-full-outline" size={17} color="#555555" style={{ marginRight: 6 }} />
            <Text style={styles.headerProgressText}>{queue.length} / {queue.length}</Text>
          </View>
          <TouchableOpacity onPress={onDone} style={styles.iconBtn}>
            <Feather name="x" size={22} color="#555555" />
          </TouchableOpacity>
        </View>

        <View style={[styles.progressTrack, { width: '100%' }]}>
          <View style={[styles.progressBar, { width: '100%' }]} />
        </View>

        <View style={styles.centerContainer}>
          <Ionicons name="checkmark-circle-outline" size={60} color="#2ECC71" style={{ marginBottom: 16 }} />
          <Text style={styles.doneTitle}>
            {queue.length === 0 ? 'Hôm nay không còn thẻ đến hạn!' : 'Đã hoàn thành ôn tập!'}
          </Text>
          <Text style={styles.doneSubtitle}>
            {deck
              ? `Bạn đã hoàn thành luyện tập các từ trong bộ "${deck.name}". Lịch ôn tập Spaced Repetition của các thẻ này vẫn được giữ nguyên cho buổi ôn hằng ngày.`
              : queue.length === 0
                ? 'Tất cả các thẻ trong hàng đợi đã được ghi nhận. Thuật toán Spaced Repetition sẽ nhắc bạn ôn lại khi đến thời điểm tối ưu của não bộ.'
                : 'Bạn đã ôn tập xong toàn bộ thẻ cần học hôm nay. Lịch ôn tiếp theo đã được cập nhật chuẩn xác.'}
          </Text>
          <TouchableOpacity style={styles.backHomeBtn} onPress={onDone}>
            <Text style={styles.backHomeText}>Quay về bộ thẻ</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cramOptionBtn} onPress={handleStartCram} activeOpacity={0.75}>
            <Feather name="zap" size={15} color="#475569" style={{ marginRight: 6 }} />
            <Text style={styles.cramOptionBtnText}>Ôn cấp tốc nếu muốn (Cram Mode)</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Xác định xem exercise hiện tại có cần bàn phím không (để ẩn header/controls khi mở keyboard)
  const exerciseNeedsKeyboard = effectiveExerciseType !== 'flashcard' && effectiveExerciseType !== 'speaking';
  const shouldCompactForKeyboard = isKeyboardVisible && exerciseNeedsKeyboard;

  return (
    <View style={styles.container}>
      {/* Top Header - Thu gọn khi bàn phím mở trên các exercise có input */}
      {!shouldCompactForKeyboard && (
        <View style={styles.header}>
          <TouchableOpacity onPress={onOpenDrawer} style={styles.iconBtn}>
            <Feather name="menu" size={24} color="#333333" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Ionicons name="file-tray-full-outline" size={17} color="#555555" style={{ marginRight: 6 }} />
            <Text style={styles.headerProgressText}>
              {currentIndex + 1} / {queue.length}
            </Text>
          </View>

          <TouchableOpacity onPress={() => setShowCardMenu(true)} style={styles.iconBtn}>
            <Feather name="more-horizontal" size={24} color="#555555" />
          </TouchableOpacity>
        </View>
      )}

      {/* Mini header khi bàn phím mở - chỉ hiện tiến trình */}
      {shouldCompactForKeyboard && (
        <View style={styles.headerCompact}>
          <Text style={styles.headerCompactText}>
            {currentIndex + 1} / {queue.length}
          </Text>
          <View style={[styles.progressTrack, { flex: 1, marginLeft: 10, marginRight: 10 }]}>
            <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
          </View>
          <TouchableOpacity onPress={() => setShowCardMenu(true)} style={styles.iconBtn}>
            <Feather name="more-horizontal" size={20} color="#555555" />
          </TouchableOpacity>
        </View>
      )}

      {/* Progress line - ẩn khi keyboard mở (đã tích hợp vào mini header) */}
      {!shouldCompactForKeyboard && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
        </View>
      )}

      {/* Sub-header: Deck indicator & Practice Mode Pill - ẩn khi keyboard mở */}
      {!shouldCompactForKeyboard && (
        <View style={styles.subHeaderRow}>
          <View style={styles.deckIndicator}>
            <Ionicons name="folder-sharp" size={14} color="#666666" style={{ marginRight: 5 }} />
            <Text style={styles.deckIndicatorText}>{deck?.name || 'Inbox'}</Text>
          </View>

          <TouchableOpacity
            style={styles.practiceModePill}
            onPress={() => setShowModeModal(true)}
            activeOpacity={0.7}
          >
            {getPracticeModePillInfo().isMaterial ? (
              <MaterialCommunityIcons name="cards-outline" size={15} color="#2563EB" style={{ marginRight: 5 }} />
            ) : (
              <Feather
                name={getPracticeModePillInfo().icon as any}
                size={12}
                color="#2563EB"
                style={{ marginRight: 5 }}
              />
            )}
            <Text style={styles.practiceModePillText}>
              {getPracticeModePillInfo().label}
            </Text>
            <Feather name="chevron-down" size={12} color="#64748B" style={{ marginLeft: 3 }} />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.cardArea, shouldCompactForKeyboard && styles.cardAreaCompact]}>
        {effectiveExerciseType === 'flashcard' ? (
          <ScrollView
            style={styles.flashcardOuterScroll}
            contentContainerStyle={styles.flashcardOuterContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Wrapper fade-out khi thẻ bay ra + fade-in khi thẻ mới vào */}
            <Animated.View style={{ opacity: cardFadeIn }}>
            {/* Animated Swipe Flashcard Component (chỉ gạt ngang trái/phải) */}
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.cardBox,
                {
                  transform: [
                    { translateX: pan.x },
                    { rotate }
                  ],
                  borderColor: cardBorderColor,
                  borderWidth: 1.5
                }
              ]}
            >
              {/* Light Green Checkmark badge on top left when swiping right (Image 3) */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.cornerBadgeLeft,
                  { opacity: greenBadgeOpacity }
                ]}
              >
                <Feather name="check" size={16} color="#3E7D48" />
              </Animated.View>

              {/* Light Red 'X' badge on top right when swiping left (Image 2) */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.cornerBadgeRight,
                  { opacity: redBadgeOpacity }
                ]}
              >
                <Feather name="x" size={15} color="#8A4A45" />
              </Animated.View>

              {/* Card status badge & Speaker button phát âm từ lập tức */}
              <View style={styles.badgeRow}>
                <View style={styles.badgeLabelContainer}>
                  <Feather
                    name={isReverseReview ? 'repeat' : 'circle'}
                    size={10}
                    color={isReverseReview ? '#262626' : '#999999'}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.badgeLabel, isReverseReview && { color: '#262626', fontWeight: '700' }]}>
                    {isReverseReview
                      ? (currentCard.isNew ? 'THẺ MỚI · ĐẢO CHIỀU' : 'ÔN TẬP · ĐẢO CHIỀU')
                      : (currentCard.isNew ? 'THẺ MỚI' : 'ÔN TẬP')}
                  </Text>
                </View>

                {/* Trong chế độ chuẩn: hiện loa & mic ở mặt trước. Trong chế độ đảo chiều: ẩn loa & mic ở mặt trước để không lộ đáp án */}
                {!isReverseReview && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      style={styles.micPracticeBtn}
                      onPress={() => setShowVoicePractice(true)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="mic" size={17} color="#262626" />
                    </TouchableOpacity>

                    <SpeakerButton
                      text={englishWord}
                      size={19}
                      color="#4B5563"
                      activeColor="#262626"
                    />
                  </View>
                )}
              </View>

              <TouchableOpacity
                activeOpacity={0.95}
                onPress={handleToggleReveal}
                style={styles.cardInnerTouchable}
              >
                {/* Front content */}
                <View style={styles.sideContent}>
                  {Boolean(currentCard.thumbnailUrl || currentCard.imageUrl) && (
                    <View style={styles.cardFrontCoverWrapper}>
                      <Image
                        source={{ uri: (currentCard.thumbnailUrl || currentCard.imageUrl) as string }}
                        style={styles.cardFrontCover}
                        resizeMode="contain"
                      />
                    </View>
                  )}
                  <MarkdownCard
                    content={isReverseReview ? (vietnameseMeaning || sides[1] || currentCard.back || sides[0]) : (englishWord || sides[0] || currentCard.front)}
                    isRevealed={revealedSideIndex > 0}
                    isTitle
                  />
                  {!isReverseReview && liveCardIpa ? (
                    <Text style={styles.frontIpaText}>{liveCardIpa}</Text>
                  ) : null}
                </View>

                {/* Revealed Hidden Sides with smooth drop animation */}
                {revealedSideIndex > 0 && (
                  <Animated.View
                    style={[
                      styles.revealedSection,
                      {
                        opacity: dropAnim,
                        transform: [
                          {
                            translateY: dropAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-10, 0]
                            })
                          }
                        ]
                      }
                    ]}
                  >
                    <View style={styles.dashedSeparator} />

                    {/* Khi ôn tập đảo chiều: hiển thị đáp án từ tiếng Anh, phát âm IPA và nút Loa/Mic khi lật mặt */}
                    {isReverseReview ? (
                      <View>
                        <View style={styles.reverseEnglishBox}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.reverseEnglishWord}>{englishWord}</Text>
                            {liveCardIpa ? (
                              <Text style={styles.frontIpaText}>{liveCardIpa}</Text>
                            ) : null}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity
                              style={styles.micPracticeBtn}
                              onPress={() => setShowVoicePractice(true)}
                              activeOpacity={0.7}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Feather name="mic" size={17} color="#262626" />
                            </TouchableOpacity>
                            <SpeakerButton
                              text={englishWord}
                              size={20}
                              color="#4B5563"
                              activeColor="#262626"
                            />
                          </View>
                        </View>

                        {/* Các mặt ẩn bổ sung (câu ví dụ, ngữ cảnh) nếu có */}
                        {sides.slice(2).map((sideText, idx) => (
                          <View key={idx} style={{ marginTop: 12 }}>
                            <View style={styles.dashedSeparator} />
                            <MarkdownCard content={sideText} isRevealed={true} />
                          </View>
                        ))}
                      </View>
                    ) : (
                      /* Chế độ thông thường: hiển thị các mặt ẩn nghĩa & ví dụ */
                      sides.slice(1, revealedSideIndex + 1).map((sideText, idx) => (
                        <View key={idx} style={{ marginTop: idx > 0 ? 12 : 0 }}>
                          {idx > 0 && <View style={styles.dashedSeparator} />}
                          <MarkdownCard content={sideText} isRevealed={true} />
                        </View>
                      ))
                    )}
                  </Animated.View>
                )}
              </TouchableOpacity>
            </Animated.View>
            </Animated.View>

            {/* Tap to reveal / hide prompt */}
            <TouchableOpacity style={styles.tapPrompt} onPress={handleToggleReveal}>
              <Ionicons
                name={revealedSideIndex > 0 ? 'eye-off-outline' : 'hand-left-outline'}
                size={16}
                color={currentRevealCount > 0 ? '#E11D48' : '#8E8E93'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tapPromptText, currentRevealCount > 0 && { color: '#E11D48' }]}>
                {revealedSideIndex > 0
                  ? `Chạm vào thẻ để ẩn lại ${currentRevealCount > 0 ? `(đã lật ${currentRevealCount} lần)` : ''}`
                  : currentRevealCount > 0
                    ? `Chạm để xem lại nghĩa (đã lật ${currentRevealCount} lần)`
                    : 'Chạm để xem nghĩa / mặt ẩn'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={shouldCompactForKeyboard ? 0 : 60}
          >
            <ScrollView
              style={styles.exerciseCardOuter}
              contentContainerStyle={[
                styles.exerciseCardContent,
                shouldCompactForKeyboard && { paddingBottom: 8 }
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[
                styles.exerciseCardBox,
                shouldCompactForKeyboard && { padding: 10 }
              ]}>
                <ReviewExerciseView
                  key={`${currentCard.id}-${currentCard.objective}-${effectiveExerciseType}`}
                  card={currentCard}
                  exerciseType={effectiveExerciseType}
                  ipa={liveCardIpa}
                  onAnswer={(rating) => handleRate(rating)}
                  onNext={handleSkip}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>

      {/* Review bottom controls - ẩn khi bàn phím mở để tiết kiệm diện tích */}
      {!shouldCompactForKeyboard && (
      <View style={styles.reviewControls}>
        {/* Previous / Undo */}
        <TouchableOpacity
          style={[styles.controlSmallBtn, history.length === 0 && { opacity: 0.35 }]}
          onPress={handleUndo}
          disabled={history.length === 0}
        >
          <Feather name="arrow-left" size={22} color="#555555" />
        </TouchableOpacity>

        {/* Skip to back */}
        <TouchableOpacity
          style={styles.controlSmallBtn}
          onPress={handleSkip}
        >
          <Feather name="arrow-right" size={22} color="#555555" />
        </TouchableOpacity>

        {/* Big circular Forgot / Again '✕' (Light red highlighted on swipe left, Image 2) */}
        <Animated.View
          style={[
            styles.rateCircleBtn,
            {
              backgroundColor: forgotBtnBg,
              borderColor: forgotBtnBorderColor,
              borderWidth: 1.5
            }
          ]}
        >
          <TouchableOpacity
            style={styles.circleTouchableInner}
            activeOpacity={0.7}
            onPress={handlePressForgot}
          >
            <Feather name="x" size={26} color="#333333" />
          </TouchableOpacity>
        </Animated.View>

        {/* Big circular Remembered / Good '✓' (Light green highlighted on swipe right, Image 3) */}
        <Animated.View
          style={[
            styles.rateCircleBtn,
            {
              backgroundColor: goodBtnBg,
              borderColor: goodBtnBorderColor,
              borderWidth: 1.5
            }
          ]}
        >
          <TouchableOpacity
            style={styles.circleTouchableInner}
            activeOpacity={0.7}
            onPress={handlePressGood}
          >
            <Feather name="check" size={26} color="#333333" />
          </TouchableOpacity>
        </Animated.View>

        {/* More options */}
        <TouchableOpacity
          style={styles.controlSmallBtn}
          onPress={() => setShowCardMenu(true)}
        >
          <Feather name="more-horizontal" size={22} color="#555555" />
        </TouchableOpacity>
      </View>
      )}

      {/* Card Options Menu (Screenshot 5) */}
      <CardOptionsMenu
        visible={showCardMenu}
        card={currentCard}
        onClose={() => setShowCardMenu(false)}
        onCopyId={() => {
          Alert.alert('Card ID', currentCard.id);
        }}
        onCopyMarkdown={() => {
          Alert.alert('Markdown', currentCard.content);
        }}
        onAddToReviews={async () => {
          await CardRepository.addToReviewQueue(currentCard.id);
          Alert.alert('Hàng đợi', 'Thẻ đã được ưu tiên trong hàng đợi ôn tập.');
        }}
        onResetHistory={async () => {
          await CardRepository.resetCardReviewHistory(currentCard.id);
          Alert.alert('Đặt lại lịch ôn tập', `Đã đặt lại lịch cho từ "${currentCard.front}".`);
        }}
        onDuplicate={async () => {
          await CardRepository.duplicate(currentCard.id);
          Alert.alert('Success', 'Card duplicated');
        }}
        onToggleArchive={async () => {
          await CardRepository.toggleArchive(currentCard.id);
          handleSkip();
        }}
        onToggleReviewReverse={async () => {
          const nextVal = await CardRepository.toggleReviewReverse(currentCard.id);
          setQueue(prevQueue =>
            prevQueue.map((item, idx) => {
              if (idx !== currentIndex) return item;
              return {
                ...item,
                card: { ...item.card, reviewReverse: nextVal },
                direction: nextVal ? 'meaning_vi_en' : 'meaning_en_vi'
              };
            })
          );
          setRevealedSideIndex(0);
        }}
        onTogglePin={async () => {
          await CardRepository.togglePin(currentCard.id);
        }}
        onMoveTo={() => {
          Alert.alert('Move to Deck', 'Deck relocation');
        }}
        onEdit={() => {
          setShowCardMenu(false);
          onEditCard(currentCard);
        }}
        onMoveToTrash={async () => {
          await CardRepository.moveToTrash(currentCard.id);
          handleSkip();
        }}
      />

      {/* Voice Practice Modal */}
      {currentCard && (
        <VoicePracticeModal
          visible={showVoicePractice}
          word={englishWord}
          ipa={liveCardIpa}
          meaning={vietnameseMeaning}
          onClose={() => setShowVoicePractice(false)}
        />
      )}

      {/* Practice Mode Selection Modal */}
      {/* Exercise Mode Selection Modal (Multi-select Checkbox) */}
      <Modal
        visible={showModeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModeModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowModeModal(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modeModalSheet}>
                <View style={styles.modeModalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modeModalTitle}>Hình thức ôn tập</Text>
                    <Text style={styles.modeModalSubtitle}>Tích chọn các hình thức bạn muốn luyện tập</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modeModalCloseBtn}
                    onPress={() => setShowModeModal(false)}
                  >
                    <Feather name="x" size={20} color="#666666" />
                  </TouchableOpacity>
                </View>

                {/* Quick actions bar: Count & Select All button */}
                <View style={styles.modeModalActionsBar}>
                  <Text style={styles.modeModalCountText}>
                    Đã chọn <Text style={{ fontWeight: '700', color: '#262626' }}>{selectedExerciseTypes.length}</Text>/{ALL_EXERCISE_TYPES.length} hình thức
                  </Text>
                  <TouchableOpacity
                    style={styles.selectAllBtn}
                    onPress={handleSelectAll}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.selectAllBtnText}>
                      {selectedExerciseTypes.length === ALL_EXERCISE_TYPES.length ? 'Bỏ chọn bớt' : 'Chọn tất cả'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modeListScroll} showsVerticalScrollIndicator={false}>
                  {EXERCISE_OPTIONS.map(mode => {
                    const isSelected = selectedExerciseTypes.includes(mode.id);
                    return (
                      <TouchableOpacity
                        key={mode.id}
                        style={[
                          styles.modeOptionItem,
                          isSelected && styles.modeOptionItemActive
                        ]}
                        activeOpacity={0.7}
                        onPress={() => toggleExerciseType(mode.id)}
                      >
                        {/* Checkbox box */}
                        <View style={[styles.checkboxBox, isSelected && styles.checkboxBoxActive]}>
                          {isSelected && <Feather name="check" size={13} color="#FFFFFF" />}
                        </View>

                        <View
                          style={[
                            styles.modeOptionIconBox,
                            isSelected && styles.modeOptionIconBoxActive
                          ]}
                        >
                          {mode.id === 'flashcard' ? (
                            <MaterialCommunityIcons
                              name="cards-outline"
                              size={18}
                              color={isSelected ? '#262626' : '#64748B'}
                            />
                          ) : (
                            <Feather
                              name={mode.icon as any}
                              size={18}
                              color={isSelected ? '#262626' : '#64748B'}
                            />
                          )}
                        </View>
                        <View style={styles.modeOptionInfo}>
                          <Text
                            style={[
                              styles.modeOptionLabel,
                              isSelected && styles.modeOptionLabelActive
                            ]}
                          >
                            {mode.label}
                          </Text>
                          <Text style={styles.modeOptionDesc}>{mode.desc}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Confirm Button */}
                <TouchableOpacity
                  style={styles.modeConfirmBtn}
                  onPress={() => setShowModeModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modeConfirmBtnText}>
                    Xong ({selectedExerciseTypes.length} hình thức)
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
    zIndex: 1
  },
  practiceModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE'
  },
  practiceModePillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#2563EB'
  },
  exerciseCardOuter: {
    flex: 1,
    width: '100%'
  },
  exerciseCardContent: {
    paddingBottom: 20
  },
  exerciseCardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end'
  },
  modeModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingTop: 18,
    paddingBottom: 32,
    paddingHorizontal: 18
  },
  modeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4
  },
  modeModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B'
  },
  modeModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2
  },
  modeModalCloseBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9'
  },
  modeModalActionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4
  },
  modeModalCountText: {
    fontSize: 13,
    color: '#64748B'
  },
  selectAllBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5'
  },
  selectAllBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#262626'
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#FFFFFF'
  },
  checkboxBoxActive: {
    backgroundColor: '#262626',
    borderColor: '#262626'
  },
  modeConfirmBtn: {
    marginTop: 14,
    backgroundColor: '#262626',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3
  },
  modeConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600'
  },
  modeListScroll: {
    maxHeight: 460
  },
  modeOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0'
  },
  modeOptionItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6'
  },
  modeOptionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  modeOptionIconBoxActive: {
    backgroundColor: '#DBEAFE'
  },
  modeOptionInfo: {
    flex: 1,
    marginRight: 8
  },
  modeOptionLabel: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#334155'
  },
  modeOptionLabelActive: {
    color: '#1D4ED8'
  },
  modeOptionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  micPracticeBtn: {
    padding: 6,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardFrontCoverWrapper: {
    alignSelf: 'center',
    width: 140,
    height: 95,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden'
  },
  cardFrontCover: {
    width: '100%',
    height: '100%'
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA'
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF'
  },
  headerCompact: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF'
  },
  headerCompactText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555555'
  },
  iconBtn: {
    padding: 6
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerProgressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333'
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#EBEBEB',
    width: '100%'
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#9E9E9E'
  },
  deckIndicator: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  deckIndicatorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555555'
  },
  cardArea: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24
  },
  cardAreaCompact: {
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 4
  },
  flashcardOuterScroll: {
    flex: 1,
    width: '100%'
  },
  flashcardOuterContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 10
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    minHeight: 180,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative'
  },
  cardInnerTouchable: {
    width: '100%'
  },
  cornerBadgeRight: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FADBD8',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10
  },
  cornerBadgeLeft: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#E1F5E1',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  badgeLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  badgeLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 0.6
  },
  sideContent: {
    paddingVertical: 8
  },
  frontIpaText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 4,
    letterSpacing: 0.3
  },
  frontText: {
    fontSize: 22,
    fontWeight: '500',
    color: '#222222',
    lineHeight: 30
  },
  revealedSection: {
    marginTop: 14
  },
  reverseEnglishBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  reverseEnglishWord: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 2
  },
  dashedSeparator: {
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E6E6',
    borderStyle: 'dashed',
    marginBottom: 16
  },
  backText: {
    fontSize: 17,
    color: '#444444',
    lineHeight: 25
  },
  tapPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22
  },
  tapPromptText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500'
  },
  reviewControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 18,
    backgroundColor: '#FAFAFA'
  },
  controlSmallBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rateCircleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2
  },
  circleTouchableInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  loadingText: {
    fontSize: 15,
    color: '#888888'
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 8
  },
  doneSubtitle: {
    fontSize: 15,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24
  },
  backHomeBtn: {
    backgroundColor: '#262626',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10
  },
  backHomeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600'
  },
  cramOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  cramOptionBtnText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600'
  }
});
