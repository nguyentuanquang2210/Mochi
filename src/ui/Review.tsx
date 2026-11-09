import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
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
import { Feather, Ionicons } from './components/Icons';
import { CardOptionsMenu } from './components/CardOptionsMenu';
import { MarkdownCard } from './components/MarkdownCard';
import { SpeakerButton, lastSpeakerPressTimestamp } from './components/SpeakerButton';
import { VoicePracticeModal } from './components/VoicePracticeModal';
import { ReviewExerciseView, ExerciseType } from './components/ReviewExerciseView';
import { SpeechService } from '../services/speech';
import { TOEIC_MAP } from '../data/toeicWordlist';
import { DictionaryService, normalizeToStandardIpa } from '../services/dictionary';
import type { CardSummary, Deck, FsrsState, Rating } from '../domain/types';
import { CardRepository } from '../data/repositories';

export type PracticeMode = 'mixed' | ExerciseType;

export const PRACTICE_MODES: { id: PracticeMode; label: string; icon: string; desc: string }[] = [
  { id: 'mixed', label: 'Trộn đa dạng (Mixed)', icon: 'shuffle', desc: 'Luân phiên 6 hình thức bài tập theo từng thẻ (Khuyên dùng)' },
  { id: 'fill_in_blank', label: 'Điền từ (Gạch chân)', icon: 'edit-3', desc: 'Nhìn nghĩa tiếng Việt → Viết từ tiếng Anh' },
  { id: 'memory_write', label: 'Nhớ & viết lại', icon: 'zap', desc: 'Xem từ 2s rồi che đi → Viết lại bằng trí nhớ' },
  { id: 'listening', label: 'Luyện nghe TOEIC', icon: 'headphones', desc: 'Nghe phát âm mà không nhìn chữ → Điền từ' },
  { id: 'speaking', label: 'Luyện phát âm', icon: 'mic', desc: 'Nhìn từ → Tự đọc to vào micro' },
  { id: 'sentence_cloze', label: 'Điền từ vào câu', icon: 'file-text', desc: 'Điền từ vào chỗ trống trong ngữ cảnh' },
  { id: 'word_family', label: 'Họ từ (Word Form)', icon: 'layers', desc: 'Biến thể từ loại: Danh, Động, Tính, Trạng từ' },
  { id: 'flashcard', label: 'Lật thẻ truyền thống', icon: 'copy', desc: 'Mặt trước / Mặt sau dạng flashcard' },
];

const MIXED_CYCLE: ExerciseType[] = [
  'fill_in_blank',
  'listening',
  'sentence_cloze',
  'speaking',
  'memory_write',
  'word_family',
  'flashcard'
];

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
}

export function Review({ deck, reviewMode = 'due', onDone, onOpenDrawer, onEditCard }: ReviewProps) {
  const [queue, setQueue] = useState<{ card: CardSummary; state: FsrsState }[]>([]);
  const [history, setHistory] = useState<{ card: CardSummary; state: FsrsState; previousState: FsrsState }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealedSideIndex, setRevealedSideIndex] = useState(0); // 0 = only front side, > 0 = revealed hidden sides
  const [loading, setLoading] = useState(true);
  const [showCardMenu, setShowCardMenu] = useState(false);
  const [showVoicePractice, setShowVoicePractice] = useState(false);
  const [selectedPracticeMode, setSelectedPracticeMode] = useState<PracticeMode>('mixed');
  const [showModeModal, setShowModeModal] = useState(false);

  // Animation values for swipe physics and hidden side drop
  const pan = useRef(new Animated.ValueXY()).current;
  const dropAnim = useRef(new Animated.Value(0)).current;

  // Refs to avoid stale closure in PanResponder
  const queueRef = useRef<{ card: CardSummary; state: FsrsState }[]>([]);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    // Duy trì phần cứng Audio DAC luôn active trong suốt quá trình ôn tập thẻ
    // Giúp loại bỏ hoàn toàn hiện tượng khựng/giật khi bấm loa lần đầu và sau khi để yên
    SpeechService.startKeepAlive();
    return () => {
      SpeechService.stopKeepAlive();
    };
  }, []);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    loadDueCards();
  }, [deck?.id, reviewMode]);

  const loadDueCards = async () => {
    setLoading(true);
    let cards: { card: CardSummary; state: FsrsState }[] = [];
    if (reviewMode === 'new' && deck) {
      cards = await CardRepository.getNewCards(deck.id);
    } else if (reviewMode === 'cram' && deck) {
      cards = await CardRepository.getCramCards(deck.id);
    } else if (deck) {
      // 1. Lấy danh sách thẻ đến hạn ôn tập (Due) + thẻ mới của bộ thẻ
      const dueCards = await CardRepository.getDueCards(deck.id);
      if (dueCards.length > 0) {
        cards = dueCards;
      } else {
        // Nếu không có thẻ đến hạn, kiểm tra thẻ mới
        const newCards = await CardRepository.getNewCards(deck.id);
        if (newCards.length > 0) {
          cards = newCards;
        } else {
          // Đã hoàn thành hết thẻ cần học, chuyển sang ôn cấp tốc toàn bộ thẻ
          cards = await CardRepository.getCramCards(deck.id);
        }
      }
    } else {
      // Global Review (Hộp ôn tập tổng hợp): Trộn đều thẻ đến hạn từ tất cả các bộ thẻ
      cards = await CardRepository.getDueCards();
      if (cards.length === 0) {
        cards = await CardRepository.getCramCards('');
      }
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
    setLoading(false);
  };

  const currentItem = queue[currentIndex] || null;
  const currentCard = currentItem?.card || null;
  const sides = currentCard ? currentCard.sides : [];

  const effectiveExerciseType: ExerciseType =
    selectedPracticeMode === 'mixed'
      ? MIXED_CYCLE[currentIndex % MIXED_CYCLE.length]
      : selectedPracticeMode;

  // Lấy và tự động bổ sung phiên âm IPA cho thẻ hiện tại dựa trên Accent người dùng đã chọn
  const userAccent = SpeechService.getSettings().accent;
  const [liveCardIpa, setLiveCardIpa] = useState<string | null>(null);

  useEffect(() => {
    if (!currentCard) {
      setLiveCardIpa(null);
      return;
    }
    const clean = (sides[0] || currentCard.front || '').trim().toLowerCase();
    const toeic = TOEIC_MAP.get(clean);
    const existingIpa = userAccent === 'en-GB'
      ? (currentCard.ipaUk || currentCard.ipaUs || toeic?.ipaUk || toeic?.ipaUs)
      : (currentCard.ipaUs || currentCard.ipaUk || toeic?.ipaUs || toeic?.ipaUk);

    if (existingIpa) {
      setLiveCardIpa(normalizeToStandardIpa(existingIpa));
    } else {
      setLiveCardIpa(null);
      // Tự động tra cứu và bổ sung IPA ngay lập tức cho các thẻ chưa có IPA
      DictionaryService.lookupWord(clean).then(info => {
        if (info.verified && (info.ipaUs || info.ipaUk)) {
          const fetched = userAccent === 'en-GB' ? (info.ipaUk || info.ipaUs) : (info.ipaUs || info.ipaUk);
          setLiveCardIpa(normalizeToStandardIpa(fetched));
          CardRepository.updateIpa(currentCard.id, normalizeToStandardIpa(info.ipaUs) || null, normalizeToStandardIpa(info.ipaUk) || null).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [currentCard?.id, userAccent]);

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
    setRevealedSideIndex(0);

    // VÒNG LẶP HỌC LẠI KHI QUÊN (Intra-session learning loop chuẩn Mochi Cards & Duolingo):
    // Nếu người dùng trả lời sai hoặc bấm 'again' (Quên / ✕):
    // Chèn thẻ này vào CUỐI CÙNG hàng đợi để người học bắt buộc phải làm lại ở cuối phiên học cho đến khi thuộc
    if (rating === 'again') {
      const nextQueue = [...curQueue];
      nextQueue.push(item);
      queueRef.current = nextQueue;
      setQueue(nextQueue);
    }

    // Chuyển sang thẻ tiếp theo trong bộ thẻ và cập nhật tiến trình NGAY LẬP TỨC
    const nextIdx = curIdx + 1;
    currentIndexRef.current = nextIdx;
    setCurrentIndex(nextIdx);

    // Lưu vào cơ sở dữ liệu SQLite dưới nền mà không làm chặn giao diện
    try {
      const oldState = item.state;
      const nextState = await CardRepository.review(item.card, oldState, rating);
      setHistory(prev => [...prev, { card: item.card, state: nextState, previousState: oldState }]);
    } catch (e) {
      console.warn('Lỗi ghi nhận lượt ôn:', e);
    }
  };

  // Button triggers with card flying animation
  const handlePressForgot = () => {
    Animated.timing(pan, {
      toValue: { x: -600, y: 0 },
      duration: 160,
      useNativeDriver: false
    }).start(() => {
      handleRate('again');
    });
  };

  const handlePressGood = () => {
    Animated.timing(pan, {
      toValue: { x: 600, y: 0 },
      duration: 160,
      useNativeDriver: false
    }).start(() => {
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
    pan.setValue({ x: 0, y: 0 });
    dropAnim.setValue(0);

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
    pan.setValue({ x: 0, y: 0 });
    dropAnim.setValue(0);
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
          Animated.timing(pan, {
            toValue: { x: -600, y: 0 },
            duration: 160,
            useNativeDriver: false
          }).start(() => {
            handleRate('again');
          });
        } else if (gestureState.dx > SWIPE_THRESHOLD || (gestureState.dx > 30 && gestureState.vx > 0.6)) {
          // Gạt sang bên phải -> Xác nhận ĐÃ NHỚ (Good)
          Animated.timing(pan, {
            toValue: { x: 600, y: 0 },
            duration: 160,
            useNativeDriver: false
          }).start(() => {
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
          <Text style={styles.doneTitle}>Đã hoàn thành ôn tập!</Text>
          <Text style={styles.doneSubtitle}>
            Bạn đã ôn tập xong tất cả các thẻ trong {deck?.name ? `bộ "${deck.name}"` : 'hàng đợi'}.
          </Text>
          <TouchableOpacity style={styles.backHomeBtn} onPress={onDone}>
            <Text style={styles.backHomeText}>Quay về bộ thẻ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header matching Screenshot 4 */}
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

      {/* Progress line */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
      </View>

      {/* Sub-header: Deck indicator & Practice Mode Pill */}
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
          <Feather
            name={PRACTICE_MODES.find(m => m.id === selectedPracticeMode)?.icon as any || 'shuffle'}
            size={12}
            color="#2563EB"
            style={{ marginRight: 5 }}
          />
          <Text style={styles.practiceModePillText}>
            {PRACTICE_MODES.find(m => m.id === selectedPracticeMode)?.label || 'Ôn tập'}
          </Text>
          <Feather name="chevron-down" size={12} color="#64748B" style={{ marginLeft: 3 }} />
        </TouchableOpacity>
      </View>

      <View style={styles.cardArea}>
        {effectiveExerciseType === 'flashcard' ? (
          <ScrollView
            style={styles.flashcardOuterScroll}
            contentContainerStyle={styles.flashcardOuterContent}
            showsVerticalScrollIndicator={false}
          >
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
                  <Feather name="circle" size={10} color="#999999" style={{ marginRight: 5 }} />
                  <Text style={styles.badgeLabel}>
                    {currentCard.isNew ? 'THẺ MỚI' : 'ÔN TẬP'}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    style={styles.micPracticeBtn}
                    onPress={() => setShowVoicePractice(true)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="mic" size={17} color="#2563EB" />
                  </TouchableOpacity>

                  <SpeakerButton
                    text={sides[0] || currentCard.front}
                    size={19}
                    color="#4B5563"
                    activeColor="#2563EB"
                  />
                </View>
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
                  <MarkdownCard content={sides[0] || currentCard.front} isRevealed={revealedSideIndex > 0} isTitle />
                  {liveCardIpa ? (
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
                    {sides.slice(1, revealedSideIndex + 1).map((sideText, idx) => (
                      <View key={idx} style={{ marginTop: idx > 0 ? 12 : 0 }}>
                        {idx > 0 && <View style={styles.dashedSeparator} />}
                        <MarkdownCard content={sideText} isRevealed={true} />
                      </View>
                    ))}
                  </Animated.View>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Tap to reveal / hide prompt */}
            <TouchableOpacity style={styles.tapPrompt} onPress={handleToggleReveal}>
              <Ionicons
                name={revealedSideIndex > 0 ? 'eye-off-outline' : 'hand-left-outline'}
                size={16}
                color="#8E8E93"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.tapPromptText}>
                {revealedSideIndex > 0 ? 'Chạm vào thẻ để ẩn lại' : 'Chạm để xem nghĩa / mặt ẩn'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.exerciseCardOuter}
            contentContainerStyle={styles.exerciseCardContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.exerciseCardBox}>
              <ReviewExerciseView
                key={`${currentCard.id}-${effectiveExerciseType}`}
                card={currentCard}
                exerciseType={effectiveExerciseType}
                ipa={liveCardIpa}
                onAnswer={(rating) => handleRate(rating)}
                onNext={handleSkip}
              />
            </View>
          </ScrollView>
        )}
      </View>

      {/* Review bottom controls matching Screenshot 4 & dynamically highlights on swipe */}
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
        onAddToReviews={() => {
          Alert.alert('Reviews', 'Card kept in review queue.');
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
          await CardRepository.toggleReviewReverse(currentCard.id);
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
          word={sides[0] || currentCard.front}
          ipa={liveCardIpa}
          meaning={sides[1] || ''}
          onClose={() => setShowVoicePractice(false)}
        />
      )}

      {/* Practice Mode Selection Modal */}
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
                  <View>
                    <Text style={styles.modeModalTitle}>Hình thức ôn tập</Text>
                    <Text style={styles.modeModalSubtitle}>Chọn cách luyện tập phù hợp với bạn</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modeModalCloseBtn}
                    onPress={() => setShowModeModal(false)}
                  >
                    <Feather name="x" size={20} color="#666666" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modeListScroll} showsVerticalScrollIndicator={false}>
                  {PRACTICE_MODES.map(mode => {
                    const isSelected = selectedPracticeMode === mode.id;
                    return (
                      <TouchableOpacity
                        key={mode.id}
                        style={[
                          styles.modeOptionItem,
                          isSelected && styles.modeOptionItemActive
                        ]}
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedPracticeMode(mode.id);
                          setShowModeModal(false);
                        }}
                      >
                        <View
                          style={[
                            styles.modeOptionIconBox,
                            isSelected && styles.modeOptionIconBoxActive
                          ]}
                        >
                          <Feather
                            name={mode.icon as any}
                            size={18}
                            color={isSelected ? '#2563EB' : '#64748B'}
                          />
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
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE'
  },
  practiceModePillText: {
    fontSize: 12.5,
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
  }
});
