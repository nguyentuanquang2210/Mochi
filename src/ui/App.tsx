import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { CardRepository, DeckRepository } from '../data/repositories';
import type { CardSummary, Deck } from '../domain/types';
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

export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'deck' | 'dashboard' | 'search' | 'create' | 'edit' | 'review' | 'trash' | 'settings' | 'import'>('deck');
  const [reviewMode, setReviewMode] = useState<'due' | 'new' | 'cram'>('due');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [allCards, setAllCards] = useState<CardSummary[]>([]);
  const [inboxDueCount, setInboxDueCount] = useState(0);
  const [newCardsCount, setNewCardsCount] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [userName, setUserName] = useState('Quang');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<CardSummary | null>(null);

  // New states for the Plus button Action Sheet & modals
  const [showCreateActionSheet, setShowCreateActionSheet] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [showCreateDeckModal, setShowCreateDeckModal] = useState(false);
  const [newDeckInputName, setNewDeckInputName] = useState('');

  useEffect(() => {
    initApp();
  }, []);

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
    } else {
      setCards([]);
      setNewCardsCount(0);
    }

    const totalDue = await CardRepository.countDue();
    setInboxDueCount(totalDue);

    const totalTrashed = await CardRepository.countTrashed();
    setTrashCount(totalTrashed);

    const all = await CardRepository.search('');
    setAllCards(all);
  };

  const handleSelectDeck = async (deckId: string) => {
    setActiveDeckId(deckId);
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
      setCurrentView('review');
    } else {
      setCurrentView(view);
    }
  };

  const activeDeck = decks.find(d => d.id === activeDeckId) || decks[0] || null;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#262626" />
      </SafeAreaView>
    );
  }

  const renderCurrentScreen = () => {
    if (currentView === 'review') {
      return (
        <Review
          deck={activeDeck}
          reviewMode={reviewMode}
          onDone={() => {
            refreshData();
            setCurrentView('deck');
          }}
          onOpenDrawer={() => setDrawerVisible(true)}
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
          onOpenDrawer={() => setDrawerVisible(true)}
        />
      );
    }

    if (currentView === 'search') {
      return (
        <SearchView
          decks={decks}
          allCards={allCards}
          onOpenDrawer={() => setDrawerVisible(true)}
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
          onOpenDrawer={() => setDrawerVisible(true)}
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
          onOpenDrawer={() => setDrawerVisible(true)}
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
        dueCount={inboxDueCount}
        newCardsCount={newCardsCount}
        onOpenDrawer={() => setDrawerVisible(true)}
        onStartReview={(mode) => {
          setReviewMode(mode || 'due');
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

      {/* Main Screen Content */}
      <View style={styles.content}>
        {renderCurrentScreen()}
      </View>

      {/* Persistent Bottom Nav (Screenshot 1, 2, 3, 4) */}
      <BottomNav
        currentTab={getActiveTab()}
        inboxDueCount={inboxDueCount}
        onSelectTab={handleSelectTab}
      />

      {/* Sidebar Navigation Drawer (Screenshot 2) */}
      <Drawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        decks={decks}
        activeDeckId={activeDeckId}
        activeView={currentView}
        inboxDueCount={inboxDueCount}
        trashCount={trashCount}
        userName={userName}
        onSelectDeck={handleSelectDeck}
        onSelectView={handleSelectDrawerView}
        onCreateDeck={handleCreateDeck}
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
