import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
  PanResponder,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { database } from '../data/database';
import { CardRepository, DeckRepository, UserSettingsRepository } from '../data/repositories';
import type { CardSummary, Deck, ExerciseType } from '../domain/types';
import { BottomNav, TabId } from './components/BottomNav';
import { Drawer } from './components/Drawer';
import { DeckView } from './DeckView';
import { Review } from './Review';
import { Dashboard } from './Dashboard';
import { CardEditor } from './CardEditor';
import { SearchView } from './SearchView';
import { TrashView } from './TrashView';
import { SettingsView } from './SettingsView';
import { CreateActionSheetModal } from './components/CreateActionSheetModal';
import { QuickAddCardModal } from './components/QuickAddCardModal';
import { SpeechService } from '../services/speech';
import { AuthScreen } from './AuthScreen';
import { logout, subscribeToAuth, type AuthUser } from '../services/auth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(Math.round(SCREEN_WIDTH * 0.82), 320);

export default function App() {
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [currentView, setCurrentView] = useState<'deck' | 'dashboard' | 'search' | 'create' | 'edit' | 'review' | 'trash' | 'settings' | 'import'>('deck');
  const currentViewRef = useRef(currentView);
  currentViewRef.current = currentView;
  const [reviewMode, setReviewMode] = useState<'due' | 'new' | 'cram'>('due');
  // Inbox is global; a review launched from a deck remains scoped to that deck.
  const [reviewDeckId, setReviewDeckId] = useState<string | null | undefined>(undefined);
  const [reviewVersion, setReviewVersion] = useState(0);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [allCards, setAllCards] = useState<CardSummary[]>([]);
  const [inboxDueCount, setInboxDueCount] = useState(0);
  const [inboxNewCount, setInboxNewCount] = useState(0);
  const [deckCardCounts, setDeckCardCounts] = useState<Record<string, number>>({});
  const [deckDueCount, setDeckDueCount] = useState(0);
  const [newCardsCount, setNewCardsCount] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [userName, setUserName] = useState('Quang');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isDrawerOpenRef = useRef(false);
  const drawerProgress = useRef(new Animated.Value(0)).current;
  const currentProgressRef = useRef(0);
  const [cardToEdit, setCardToEdit] = useState<CardSummary | null>(null);
  const [practiceModes, setPracticeModes] = useState<ExerciseType[]>(
    UserSettingsRepository.getCachedPracticeModes()
  );

  useEffect(() => {
    UserSettingsRepository.getPracticeModes().then(modes => {
      if (modes && modes.length > 0) {
        setPracticeModes(modes);
      }
    });
  }, []);

  useEffect(() => {
    const listener = drawerProgress.addListener(({ value }) => {
      currentProgressRef.current = value;
    });
    return () => drawerProgress.removeListener(listener);
  }, [drawerProgress]);

  const openDrawer = () => {
    setIsDrawerOpen(true);
    isDrawerOpenRef.current = true;
    Animated.timing(drawerProgress, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerProgress, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start(() => {
      setIsDrawerOpen(false);
      isDrawerOpenRef.current = false;
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        // If drawer is closed, only capture horizontal swipe strictly from the far-left screen bezel edge
        if (!isDrawerOpenRef.current) {
          const pageX = evt?.nativeEvent?.pageX ?? gestureState?.moveX ?? 0;
          const dx = gestureState?.dx ?? 0;
          const dy = gestureState?.dy ?? 0;
          // Tọa độ X điểm chạm ban đầu khi người dùng đặt ngón tay xuống màn hình
          const startX = pageX - dx;

          const isReview = currentViewRef.current === 'review';
          // Khi đang ở Review, thẻ bắt đầu từ x = 18px (paddingHorizontal: 18).
          // Ngưỡng mép viền ngoài màn hình phải <= 14px và điểm chạm pageX phải <= 40px.
          // Bất kỳ thao tác vuốt nào trên thẻ (startX >= 18px) sẽ trả về false để thẻ nhận diện cử chỉ gạt (Good/Again).
          const edgeThreshold = isReview ? 14 : 20;
          const isEdgeSwipe = startX > 0 && startX <= edgeThreshold && pageX <= (edgeThreshold + 25);
          const isSwipeRight = dx > 10;
          const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
          return isEdgeSwipe && isSwipeRight && isHorizontal;
        }
        // If drawer is open, capture horizontal swipe to the left
        const isSwipeLeft = gestureState.dx < -8;
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.3;
        return isSwipeLeft && isHorizontal;
      },
      onPanResponderGrant: () => {
        if (!isDrawerOpenRef.current) {
          setIsDrawerOpen(true);
        }
      },
      onPanResponderMove: (_, gestureState) => {
        const startVal = isDrawerOpenRef.current ? 1 : 0;
        const deltaProgress = gestureState.dx / DRAWER_WIDTH;
        const newProgress = Math.max(0, Math.min(1, startVal + deltaProgress));
        drawerProgress.setValue(newProgress);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!isDrawerOpenRef.current) {
          if (gestureState.dx > DRAWER_WIDTH * 0.25 || gestureState.vx > 0.3) {
            openDrawer();
          } else {
            closeDrawer();
          }
        } else {
          if (gestureState.dx < -DRAWER_WIDTH * 0.25 || gestureState.vx < -0.3) {
            closeDrawer();
          } else {
            openDrawer();
          }
        }
      },
      onPanResponderTerminate: () => {
        if (currentProgressRef.current > 0.4) {
          openDrawer();
        } else {
          closeDrawer();
        }
      }
    })
  ).current;

  const drawerTranslateX = drawerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-DRAWER_WIDTH, 0]
  });

  const mainScreenTranslateX = drawerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, DRAWER_WIDTH]
  });

  const overlayOpacity = drawerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.2]
  });

  // New states for the Plus button Action Sheet & modals
  const [showCreateActionSheet, setShowCreateActionSheet] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [showCreateDeckModal, setShowCreateDeckModal] = useState(false);
  const [newDeckInputName, setNewDeckInputName] = useState('');

  useEffect(() => subscribeToAuth(user => {
    setAuthUser(user);
    setAuthReady(true);
  }), []);

  useEffect(() => {
    if (!authUser) {
      setLoading(false);
      return;
    }
    setUserName(authUser.displayName || authUser.email?.split('@')[0] || 'Người học');
    setLoading(true);
    initApp();
  }, [authUser?.uid]);

  const initApp = async () => {
    try {
      await database();
      await SpeechService.init();
      await SpeechService.warmup();
      await refreshData();
    } catch (e: any) {
      console.error('Init error', e);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async (preferredDeckId?: string) => {
    const allDecks = await DeckRepository.all();
    setDecks(allDecks);
    const perDeckCounts = await Promise.all(allDecks.map(async deck => [deck.id, await CardRepository.countActive(deck.id)] as const));
    setDeckCardCounts(Object.fromEntries(perDeckCounts));

    // Default to 'When' deck if available, else first deck
    let targetDeckId = preferredDeckId || activeDeckId;
    if (!targetDeckId || !allDecks.some(d => d.id === targetDeckId)) {
      const whenDeck = allDecks.find(d => d.name.toLowerCase() === 'when');
      targetDeckId = whenDeck ? whenDeck.id : allDecks[0]?.id || null;
    }
    setActiveDeckId(targetDeckId);

    if (targetDeckId) {
      const deckCards = await CardRepository.search('', targetDeckId);
      setCards(deckCards);
      const newCount = await CardRepository.countNew(targetDeckId);
      setNewCardsCount(newCount);
      const deckDue = await CardRepository.countDue(targetDeckId);
      setDeckDueCount(deckDue);
    } else {
      setCards([]);
      setNewCardsCount(0);
      setDeckDueCount(0);
    }

    const totalDue = await CardRepository.countReviewsDue();
    setInboxDueCount(totalDue);
    setInboxNewCount(await CardRepository.countNew());

    const totalTrashed = await CardRepository.countTrashed();
    setTrashCount(totalTrashed);

    const all = await CardRepository.search('');
    setAllCards(all);
    setReviewVersion(v => v + 1);
  };

  const handleSelectDeck = async (deckId: string) => {
    setActiveDeckId(deckId);
    setReviewDeckId(deckId);
    setCurrentView('deck');
    await refreshData(deckId);
  };

  const handleCreateDeck = async (name: string) => {
    const newDeck = await DeckRepository.create(name);
    await refreshData(newDeck.id);
    setCurrentView('deck');
  };

  const handleSelectTab = (tab: TabId) => {
    if (tab === 'dashboard') {
      setCurrentView('dashboard');
    } else if (tab === 'search') {
      setCurrentView('search');
    } else if (tab === 'inbox') {
      setReviewMode('due');
      setReviewDeckId(null);
      setReviewVersion(v => v + 1);
      setCurrentView('review');
    } else if (tab === 'create') {
      // Khi ấn dấu cộng ở thanh dashboard dưới, mở Action Sheet tùy chọn như ảnh mẫu
      setShowCreateActionSheet(true);
    }
  };

  const handleSaveQuickCard = async (
    sides: string[],
    ipaUs?: string | null,
    ipaUk?: string | null,
    imageUrl?: string | null,
    thumbnailUrl?: string | null
  ) => {
    if (!activeDeckId) return;
    const content = sides.join('\n---\n');
    await CardRepository.create({
      deckId: activeDeckId,
      content,
      ipaUs,
      ipaUk,
      imageUrl,
      thumbnailUrl
    });
    await refreshData(activeDeckId);
  };

  const handleSubmitCreateDeck = async () => {
    if (!newDeckInputName.trim()) {
      setShowCreateDeckModal(false);
      return;
    }
    const created = await DeckRepository.create(newDeckInputName.trim());
    setNewDeckInputName('');
    setShowCreateDeckModal(false);
    await refreshData(created.id);
    setCurrentView('deck');
  };

  const handleSelectDrawerView = (view: 'dashboard' | 'inbox' | 'import' | 'settings' | 'trash') => {
    if (view === 'inbox') {
      setReviewMode('due');
      setReviewDeckId(null);
      setReviewVersion(v => v + 1);
      setCurrentView('review');
    } else {
      setCurrentView(view);
    }
  };

  const activeDeck = decks.find(d => d.id === activeDeckId) || decks[0] || null;

  if (!authReady || (authUser && loading)) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#262626" />
      </SafeAreaView>
    );
  }

  if (!authUser) return <AuthScreen />;

  const renderCurrentScreen = () => {
    if (currentView === 'review') {
      const currentReviewDeck = reviewDeckId === null ? null : (decks.find(d => d.id === reviewDeckId) || activeDeck);
      return (
        <Review
          key={`${reviewDeckId === null ? 'all' : (reviewDeckId || activeDeck?.id || 'all')}-${reviewMode}-${reviewVersion}`}
          deck={currentReviewDeck}
          reviewMode={reviewMode}
          initialPracticeModes={practiceModes}
          onPracticeModesChange={(modes) => setPracticeModes(modes)}
          onDone={() => {
            refreshData(reviewDeckId || activeDeckId || undefined);
            setCurrentView('deck');
          }}
          onOpenDrawer={openDrawer}
          onEditCard={(c) => {
            setCardToEdit(c);
            setCurrentView('edit');
          }}
        />
      );
    }

    if (currentView === 'create' || currentView === 'edit') {
      return (
        <CardEditor
          card={cardToEdit}
          decks={decks}
          currentDeckId={activeDeckId || ''}
          onSave={() => {
            refreshData();
            setCurrentView('deck');
          }}
          onCancel={() => {
            setCurrentView('deck');
          }}
        />
      );
    }

    if (currentView === 'dashboard') {
      return (
        <Dashboard
          decks={decks}
          onOpenDrawer={openDrawer}
        />
      );
    }

    if (currentView === 'search') {
      return (
        <SearchView
          decks={decks}
          allCards={allCards}
          onOpenDrawer={openDrawer}
          onEditCard={(c) => {
            setCardToEdit(c);
            setCurrentView('edit');
          }}
          onRefresh={refreshData}
        />
      );
    }

    if (currentView === 'trash') {
      return (
        <TrashView
          onOpenDrawer={openDrawer}
          onRefresh={refreshData}
        />
      );
    }

    if (currentView === 'settings' || currentView === 'import') {
      return (
        <SettingsView
          userName={userName}
          decks={decks}
          onUpdateUserName={setUserName}
          onOpenDrawer={openDrawer}
          onRefresh={refreshData}
        />
      );
    }

    // Default Deck View
    if (!activeDeck) {
      return (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator size="small" color="#555" />
        </View>
      );
    }

    return (
      <DeckView
        deck={activeDeck}
        allDecks={decks}
        cards={cards}
        dueCount={deckDueCount}
        newCardsCount={newCardsCount}
        onOpenDrawer={openDrawer}
        onStartReview={(mode, targetDeckId) => {
          const finalDeckId = targetDeckId || activeDeck.id;
          setReviewMode(mode || 'due');
          setReviewDeckId(finalDeckId);
          setActiveDeckId(finalDeckId);
          setReviewVersion(v => v + 1);
          setCurrentView('review');
        }}
        onOpenCreateCard={() => {
          setCardToEdit(null);
          setCurrentView('create');
        }}
        onEditCard={(c) => {
          setCardToEdit(c);
          setCurrentView('edit');
        }}
        onRefresh={refreshData}
      />
    );
  };

  const getActiveTab = (): TabId | '' => {
    if (currentView === 'dashboard') return 'dashboard';
    if (currentView === 'search') return 'search';
    if (currentView === 'review') return 'inbox';
    if (currentView === 'create') return 'create';
    return '';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Push-Drawer Stage */}
      <View style={styles.stage} {...panResponder.panHandlers}>
        {/* Sidebar Drawer panel behind / alongside */}
        <Animated.View
          style={[
            styles.drawerWrapper,
            {
              width: DRAWER_WIDTH,
              transform: [{ translateX: drawerTranslateX }]
            }
          ]}
        >
          <Drawer
            visible={isDrawerOpen}
            onClose={closeDrawer}
            decks={decks}
            activeDeckId={activeDeckId}
            activeView={currentView}
            inboxDueCount={inboxDueCount}
            inboxNewCount={inboxNewCount}
            deckCardCounts={deckCardCounts}
            trashCount={trashCount}
            userName={userName}
            onSelectDeck={(deckId) => {
              closeDrawer();
              handleSelectDeck(deckId);
            }}
            onSelectView={(view) => {
              closeDrawer();
              handleSelectDrawerView(view);
            }}
            onStartInboxReview={(mode) => {
              closeDrawer();
              setReviewMode(mode);
              setReviewDeckId(null);
              setCurrentView('review');
            }}
            onCreateDeck={handleCreateDeck}
            onLogout={() => {
              closeDrawer();
              void logout();
            }}
          />
        </Animated.View>

        {/* Main Screen Content pushed to the right */}
        <Animated.View
          style={[
            styles.mainWrapper,
            {
              transform: [{ translateX: mainScreenTranslateX }]
            }
          ]}
        >
          <View style={styles.content}>
            {renderCurrentScreen()}
          </View>

          {/* Tap-to-close overlay on pushed main screen */}
          {isDrawerOpen && (
            <TouchableWithoutFeedback onPress={closeDrawer}>
              <Animated.View
                style={[
                  styles.mainOverlay,
                  { opacity: overlayOpacity }
                ]}
              />
            </TouchableWithoutFeedback>
          )}
        </Animated.View>
      </View>

      {/* Persistent Bottom Nav (Screenshot 1, 2, 3, 4) */}
      <BottomNav
        currentTab={getActiveTab()}
        inboxDueCount={inboxDueCount}
        onSelectTab={(tab) => {
          if (isDrawerOpen) closeDrawer();
          handleSelectTab(tab);
        }}
      />

      {/* Action Sheet when clicking "+" on Bottom Nav (matching user screenshot) */}
      <CreateActionSheetModal
        visible={showCreateActionSheet}
        onClose={() => setShowCreateActionSheet(false)}
        onSelectNewCard={() => setShowQuickAddModal(true)}
        onSelectNewDiagramCard={() => {
          setCardToEdit(null);
          setCurrentView('create');
        }}
        onSelectNewDeck={() => {
          setNewDeckInputName('');
          setShowCreateDeckModal(true);
        }}
      />

      {/* Quick Add Card Modal with unlimited hidden sides */}
      <QuickAddCardModal
        visible={showQuickAddModal}
        deckName={activeDeck?.name || 'When'}
        onClose={() => setShowQuickAddModal(false)}
        onSaveCard={handleSaveQuickCard}
      />

      {/* Create New Deck Modal */}
      <Modal
        visible={showCreateDeckModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateDeckModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowCreateDeckModal(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.deckModalBox}>
                <Text style={styles.deckModalTitle}>Tạo bộ thẻ mới</Text>
                <TextInput
                  style={styles.deckModalInput}
                  placeholder="Tên bộ thẻ..."
                  placeholderTextColor="#999999"
                  value={newDeckInputName}
                  onChangeText={setNewDeckInputName}
                  autoFocus
                />
                <View style={styles.deckModalActions}>
                  <TouchableOpacity
                    style={styles.deckModalCancelBtn}
                    onPress={() => setShowCreateDeckModal(false)}
                  >
                    <Text style={styles.deckModalCancelText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deckModalSaveBtn, !newDeckInputName.trim() && { opacity: 0.5 }]}
                    disabled={!newDeckInputName.trim()}
                    onPress={handleSubmitCreateDeck}
                  >
                    <Text style={styles.deckModalSaveText}>Tạo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  stage: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#FAFAFA'
  },
  drawerWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
    backgroundColor: '#FAFAFA'
  },
  mainWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: -3, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#E5E5E5'
  },
  mainOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 10
  },
  content: {
    flex: 1
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  deckModalBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  deckModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 14
  },
  deckModalInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 15,
    color: '#222222',
    marginBottom: 18
  },
  deckModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12
  },
  deckModalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8
  },
  deckModalCancelText: {
    fontSize: 15,
    color: '#666666',
    fontWeight: '500'
  },
  deckModalSaveBtn: {
    backgroundColor: '#262626',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8
  },
  deckModalSaveText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600'
  }
});
