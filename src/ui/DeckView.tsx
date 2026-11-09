import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from './components/Icons';
import { Header } from './components/Header';
import { CardOptionsMenu } from './components/CardOptionsMenu';
import { DeckOptionsMenu } from './components/DeckOptionsMenu';
import { QuickAddCardModal } from './components/QuickAddCardModal';
import { CardDetailBottomSheet } from './components/CardDetailBottomSheet';
import type { CardSummary, Deck } from '../domain/types';
import { CardRepository, DeckRepository } from '../data/repositories';
import { TOEIC_MAP } from '../data/toeicWordlist';
import { DictionaryService, normalizeToStandardIpa } from '../services/dictionary';

interface DeckViewProps {
  deck: Deck;
  allDecks: Deck[];
  cards: CardSummary[];
  dueCount: number;
  newCardsCount: number;
  onOpenDrawer: () => void;
  onStartReview: (mode?: 'due' | 'new' | 'cram') => void;
  onOpenCreateCard: () => void;
  onEditCard: (card: CardSummary) => void;
  onRefresh: () => void;
}

export function DeckView({
  deck,
  allDecks,
  cards,
  dueCount,
  newCardsCount,
  onOpenDrawer,
  onStartReview,
  onOpenCreateCard,
  onEditCard,
  onRefresh
}: DeckViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterMode, setFilterMode] = useState<'all' | 'new' | 'due' | 'learned' | 'pinned'>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showDeckMenuModal, setShowDeckMenuModal] = useState(false);
  const [showReviewDropdown, setShowReviewDropdown] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamedTitle, setRenamedTitle] = useState(deck.name);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [selectedCardForPreview, setSelectedCardForPreview] = useState<CardSummary | null>(null);
  const [selectedCardForOptions, setSelectedCardForOptions] = useState<CardSummary | null>(null);

  // Filter cards by query and filterMode
  const filteredCards = cards.filter(c => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = c.front.toLowerCase().includes(q) ||
                    c.back.toLowerCase().includes(q) ||
                    c.content.toLowerCase().includes(q) ||
                    c.tags.some(t => t.toLowerCase().includes(q));
      if (!match) return false;
    }

    if (filterMode === 'new') return c.isNew;
    if (filterMode === 'due') return c.isDue;
    if (filterMode === 'learned') return !c.isNew;
    if (filterMode === 'pinned') return c.isPinned;

    return true;
  });

  const handleDuplicate = async (card: CardSummary) => {
    await CardRepository.duplicate(card.id);
    onRefresh();
  };

  const handleTogglePin = async (card: CardSummary) => {
    await CardRepository.togglePin(card.id);
    onRefresh();
  };

  const handleToggleReviewReverse = async (card: CardSummary) => {
    await CardRepository.toggleReviewReverse(card.id);
    onRefresh();
  };

  const handleToggleArchive = async (card: CardSummary) => {
    await CardRepository.toggleArchive(card.id);
    onRefresh();
  };

  const handleMoveToTrash = async (card: CardSummary) => {
    await CardRepository.moveToTrash(card.id);
    onRefresh();
  };

  const handleRenameDeck = async () => {
    if (!renamedTitle.trim()) return;
    await DeckRepository.update(deck.id, renamedTitle.trim(), deck.description || undefined);
    setShowRenameModal(false);
    onRefresh();
  };

  const handleMoveCardToDeck = async (targetDeckId: string) => {
    const targetCard = selectedCardForPreview || selectedCardForOptions;
    if (!targetCard) return;
    await CardRepository.moveToDeck(targetCard.id, targetDeckId);
    setSelectedCardForPreview(null);
    setSelectedCardForOptions(null);
    onRefresh();
  };

  const handleResetHistory = async () => {
    Alert.alert(
      'Reset Review History',
      `Reset all cards in "${deck.name}" to new?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await CardRepository.resetDeckReviewHistory(deck.id);
            onRefresh();
          }
        }
      ]
    );
  };

  const handleDeleteDeck = () => {
    Alert.alert(
      'Delete Deck',
      `Are you sure you want to delete the deck "${deck.name}" and all its cards?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await DeckRepository.delete(deck.id);
            setShowDeckMenuModal(false);
            onRefresh();
          }
        }
      ]
    );
  };

  // Helper lấy phiên âm IPA tối ưu nhất của thẻ và tự động hoàn thiện nếu chưa có
  const getCardIpa = (card: CardSummary) => {
    if (card.ipaUs || card.ipaUk) {
      return normalizeToStandardIpa(card.ipaUs || card.ipaUk);
    }
    const clean = card.front.trim().toLowerCase();
    const toeic = TOEIC_MAP.get(clean);
    if (toeic?.ipaUs || toeic?.ipaUk) {
      return normalizeToStandardIpa(toeic.ipaUs || toeic.ipaUk);
    }
    // Tự động tra cứu và lưu bổ sung vào CSDL cho các thẻ cũ
    DictionaryService.lookupWord(clean).then(info => {
      if (info.verified && (info.ipaUs || info.ipaUk)) {
        CardRepository.updateIpa(card.id, info.ipaUs || null, info.ipaUk || null)
          .then(() => onRefresh())
          .catch(() => {});
      }
    }).catch(() => {});
    return null;
  };

  // Quick Add Card with dynamic hidden sides and IPA
  const handleQuickAddSave = async (
    sides: string[],
    ipaUs?: string | null,
    ipaUk?: string | null,
    imageUrl?: string | null,
    thumbnailUrl?: string | null
  ) => {
    const content = sides.join('\n---\n');

    await CardRepository.create({
      deckId: deck.id,
      content,
      isPinned: false,
      reviewReverse: false,
      ipaUs,
      ipaUk,
      imageUrl,
      thumbnailUrl
    });
    onRefresh();
  };

  const renderGridCardItem = (card: CardSummary) => {
    const ipa = getCardIpa(card);
    return (
      <TouchableOpacity
        key={card.id}
        style={styles.cardTile}
        activeOpacity={0.8}
        onPress={() => setSelectedCardForPreview(card)}
        onLongPress={() => setSelectedCardForOptions(card)}
      >
        <View style={styles.cardTileTop}>
          <Text numberOfLines={1} style={styles.cardTitleText}>
            {card.front}
          </Text>
          {ipa ? (
            <Text numberOfLines={1} style={styles.cardIpaText}>
              {ipa}
            </Text>
          ) : null}
          {card.isPinned && (
            <MaterialCommunityIcons
              name="pin"
              size={13}
              color="#555555"
              style={styles.pinnedIcon}
            />
          )}
        </View>

        <View style={styles.dashedDivider} />

        <View style={styles.cardTileBottom}>
          <Text style={styles.hiddenSideText}>
            + {card.hiddenSidesCount || 1} MẶT ẨN
          </Text>
          <View style={styles.statusRow}>
            {card.isNew ? (
              <>
                <Feather name="circle" size={10} color="#AAAAAA" style={{ marginRight: 4 }} />
                <Text style={styles.newBadgeText}>MỚI</Text>
              </>
            ) : card.isDue ? (
              <>
                <MaterialCommunityIcons name="clock-alert-outline" size={12} color="#E11D48" style={{ marginRight: 4 }} />
                <Text style={[styles.newBadgeText, { color: '#E11D48', fontWeight: '600' }]}>ĐẾN HẠN</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="circle-double" size={12} color="#AAAAAA" style={{ marginRight: 4 }} />
                <Text style={styles.newBadgeText}>{Math.round(card.intervalDays ?? 0)} NGÀY</Text>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListCardItem = (card: CardSummary) => {
    const ipa = getCardIpa(card);
    return (
      <TouchableOpacity
        key={card.id}
        style={styles.listCardItem}
        activeOpacity={0.7}
        onPress={() => setSelectedCardForPreview(card)}
        onLongPress={() => setSelectedCardForOptions(card)}
      >
        <View style={styles.listCardContent}>
          <View style={styles.listCardHeader}>
            <Text numberOfLines={1} style={styles.listCardTitle}>
              {card.front}
            </Text>
            {ipa ? (
              <Text numberOfLines={1} style={styles.listCardIpa}>
                {ipa}
              </Text>
            ) : null}
            {card.isPinned && (
              <MaterialCommunityIcons name="pin" size={13} color="#555555" style={{ marginLeft: 6 }} />
            )}
          </View>
          {card.back ? (
            <Text numberOfLines={1} style={styles.listCardSub}>
              {card.back}
            </Text>
          ) : null}
        </View>

        <View style={styles.listCardRight}>
          <View style={styles.statusRow}>
            {card.isNew ? (
              <>
                <Feather name="circle" size={9} color="#AAAAAA" style={{ marginRight: 4 }} />
                <Text style={styles.newBadgeText}>MỚI</Text>
              </>
            ) : card.isDue ? (
              <>
                <MaterialCommunityIcons name="clock-alert-outline" size={11} color="#E11D48" style={{ marginRight: 4 }} />
                <Text style={[styles.newBadgeText, { color: '#E11D48', fontWeight: '600' }]}>ĐẾN HẠN</Text>
              </>
            ) : (
              <>
                <Feather name="circle" size={9} color="#AAAAAA" style={{ marginRight: 4 }} />
                <Text style={styles.newBadgeText}>{Math.round(card.intervalDays ?? 0)} NGÀY</Text>
              </>
            )}
          </View>
          <Text style={styles.listHiddenSideText}>
            +{card.hiddenSidesCount || 1} mặt ẩn
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const reviewDueCount = dueCount;

  const handlePressReview = () => {
    if (reviewDueCount === 0) {
      Alert.alert(
        'Đã ôn xong hôm nay 🎉',
        `Bộ thẻ "${deck.name}" hiện không có từ nào đến hạn cần ôn theo Spaced Repetition.\n\nBạn có muốn vào chế độ "Ôn cấp tốc" (Cram Mode) để xem lại trước không?`,
        [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Ôn cấp tốc', onPress: () => onStartReview('cram') }
        ]
      );
      return;
    }
    onStartReview('due');
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <Header
        onOpenDrawer={onOpenDrawer}
        title={deck.name}
        iconName="folder"
        onMorePress={() => setShowDeckMenuModal(true)}
      />

      {/* Progress line */}
      <View style={styles.progressLine} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Dark Review banner matching Screenshot 1 & 2 */}
        <View style={styles.bannerWrapper}>
          <View style={styles.darkReviewBanner}>
            <TouchableOpacity
              style={styles.reviewBannerMain}
              activeOpacity={0.8}
              onPress={handlePressReview}
            >
              <Ionicons name="file-tray-full-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.reviewBannerText}>Ôn tập</Text>
              <View style={styles.reviewDarkBadge}>
                <Text style={styles.reviewDarkBadgeText}>{reviewDueCount}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.bannerDivider} />

            <TouchableOpacity
              style={styles.reviewBannerChevron}
              activeOpacity={0.7}
              onPress={() => setShowReviewDropdown(!showReviewDropdown)}
            >
              <Feather name="chevron-down" size={18} color="#CCCCCC" />
            </TouchableOpacity>
          </View>

          {/* Review Dropdown Popover matching Screenshot 2 */}
          {showReviewDropdown && (
            <View style={styles.reviewDropdownCard}>
              <TouchableOpacity
                style={styles.reviewDropdownItem}
                onPress={() => {
                  setShowReviewDropdown(false);
                  onStartReview('new');
                }}
              >
                <Feather name="circle" size={15} color="#555" style={{ marginRight: 10 }} />
                <Text style={styles.reviewDropdownLabel}>Thẻ mới</Text>
                <View style={styles.dropdownCountBadge}>
                  <Text style={styles.dropdownCountBadgeText}>{newCardsCount}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.reviewDropdownItem}
                onPress={() => {
                  setShowReviewDropdown(false);
                  onStartReview('cram');
                }}
              >
                <Feather name="zap" size={15} color="#555" style={{ marginRight: 10 }} />
                <Text style={styles.reviewDropdownLabel}>Ôn cấp tốc</Text>
                <View style={styles.dropdownCountBadge}>
                  <Text style={styles.dropdownCountBadgeText}>{cards.length}</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* View bar & Filter bar */}
        <View style={styles.subToolbar}>
          <TouchableOpacity
            style={styles.viewToggle}
            onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            <Ionicons
              name={viewMode === 'grid' ? 'grid-outline' : 'list-outline'}
              size={15}
              color="#555555"
              style={{ marginRight: 5 }}
            />
            <Text style={styles.viewToggleText}>
              {viewMode === 'grid' ? 'Xem lưới' : 'Xem danh sách'}
            </Text>
            <Feather name="chevron-down" size={14} color="#777777" style={{ marginLeft: 3 }} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.addViewButton} onPress={() => setShowQuickAddModal(true)}>
            <Feather name="plus" size={17} color="#777777" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Feather name="sliders" size={14} color="#666666" style={{ marginRight: 6 }} />
            <Text style={styles.filterButtonText}>
              {filterMode === 'all' ? 'Bộ lọc' : filterMode === 'new' ? 'THẺ MỚI' : filterMode === 'due' ? 'CẦN ÔN' : filterMode === 'learned' ? 'ĐÃ HỌC' : 'ĐÃ GHIM'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Cards input pill */}
        <View style={styles.searchBarContainer}>
          <Feather name="search" size={16} color="#999999" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm thẻ..."
            placeholderTextColor="#999999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={16} color="#888888" />
            </TouchableOpacity>
          )}
        </View>

        {/* Cards Layout: Grid vs List */}
        {viewMode === 'grid' ? (
          <View style={styles.gridContainer}>
            {/* First slot: + New Card tile */}
            <TouchableOpacity
              style={styles.newCardTile}
              activeOpacity={0.7}
              onPress={() => setShowQuickAddModal(true)}
            >
              <View style={styles.newCardContent}>
                <Feather name="plus" size={18} color="#A8A8A8" style={{ marginRight: 6 }} />
                <Text style={styles.newCardText}>Thẻ mới</Text>
              </View>
            </TouchableOpacity>

            {/* Cards tiles */}
            {filteredCards.map(renderGridCardItem)}
          </View>
        ) : (
          <View style={styles.listContainer}>
            <TouchableOpacity
              style={styles.listNewCardBtn}
              activeOpacity={0.7}
              onPress={() => setShowQuickAddModal(true)}
            >
              <Feather name="plus" size={16} color="#777777" style={{ marginRight: 8 }} />
              <Text style={styles.listNewCardText}>Tạo thẻ mới</Text>
            </TouchableOpacity>

            {filteredCards.map(renderListCardItem)}
          </View>
        )}

        {filteredCards.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Chưa có thẻ nào trong bộ thẻ này.</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => setShowQuickAddModal(true)}>
              <Text style={styles.emptyButtonText}>+ Tạo thẻ</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Quick Add Card Modal with "+ Add hidden side" matching Screenshot 4 */}
      <QuickAddCardModal
        visible={showQuickAddModal}
        deckName={deck.name}
        onClose={() => setShowQuickAddModal(false)}
        onSaveCard={handleQuickAddSave}
      />

      {/* Card Detail Bottom Sheet Modal matching Screenshot 1 */}
      <CardDetailBottomSheet
        visible={Boolean(selectedCardForPreview)}
        card={selectedCardForPreview}
        deck={deck}
        allDecks={allDecks}
        onClose={() => setSelectedCardForPreview(null)}
        onEdit={() => {
          if (selectedCardForPreview) {
            const card = selectedCardForPreview;
            setSelectedCardForPreview(null);
            onEditCard(card);
          }
        }}
        onMore={() => {
          if (selectedCardForPreview) {
            const card = selectedCardForPreview;
            setSelectedCardForPreview(null);
            setSelectedCardForOptions(card);
          }
        }}
        onMoveToDeck={handleMoveCardToDeck}
      />

      {/* Deck Options Menu matching Screenshot 3 */}
      <DeckOptionsMenu
        visible={showDeckMenuModal}
        deck={deck}
        onClose={() => setShowDeckMenuModal(false)}
        onCopyId={() => {
          Alert.alert('Deck ID', deck.id);
        }}
        onExport={() => {
          Alert.alert('Export', `Deck "${deck.name}" exported to Markdown.`);
        }}
        onDuplicate={async () => {
          await DeckRepository.create(`${deck.name} (Copy)`, deck.description || undefined);
          onRefresh();
        }}
        onShare={() => {
          Alert.alert('Share', `Share link for "${deck.name}"`);
        }}
        onDeckSettings={() => {
          Alert.alert('Deck Settings', `Settings for "${deck.name}"`);
        }}
        onTemplate={() => {
          Alert.alert('Templates', 'Choose a template for new cards in this deck.');
        }}
        onRename={() => {
          setRenamedTitle(deck.name);
          setShowRenameModal(true);
        }}
        isArchived={false}
        onToggleArchive={() => {
          Alert.alert('Archived', `Deck "${deck.name}" status updated.`);
        }}
        onResetHistory={handleResetHistory}
        onMoveToTrash={handleDeleteDeck}
      />

      {/* Rename Deck Modal */}
      <Modal visible={showRenameModal} transparent animationType="fade" onRequestClose={() => setShowRenameModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowRenameModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.renameContainer}>
                <Text style={styles.renameHeading}>Đổi tên bộ thẻ</Text>
                <TextInput
                  style={styles.renameInput}
                  value={renamedTitle}
                  onChangeText={setRenamedTitle}
                  placeholder="Tên bộ thẻ..."
                  autoFocus
                />
                <View style={styles.renameActionsRow}>
                  <TouchableOpacity
                    style={styles.renameCancelBtn}
                    onPress={() => setShowRenameModal(false)}
                  >
                    <Text style={styles.renameCancelText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.renameSaveBtn}
                    onPress={handleRenameDeck}
                  >
                    <Text style={styles.renameSaveText}>Lưu</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Filter Mode Modal */}
      <Modal visible={showFilterModal} transparent animationType="fade" onRequestClose={() => setShowFilterModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowFilterModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.filterMenuContainer}>
                <Text style={styles.filterMenuHeading}>Lọc danh sách thẻ</Text>
                {([
                  { key: 'all', label: 'TẤT CẢ' },
                  { key: 'new', label: 'THẺ MỚI' },
                  { key: 'due', label: 'CẦN ÔN' },
                  { key: 'learned', label: 'ĐÃ HỌC' },
                  { key: 'pinned', label: 'ĐÃ GHIM' }
                ] as const).map(item => (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.filterChoice, filterMode === item.key && styles.filterChoiceActive]}
                    onPress={() => {
                      setFilterMode(item.key as any);
                      setShowFilterModal(false);
                    }}
                  >
                    <Text style={[styles.filterChoiceText, filterMode === item.key && styles.filterChoiceTextActive]}>
                      {item.label}
                    </Text>
                    {filterMode === item.key && <Feather name="check" size={16} color="#222222" />}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Card Options Menu (Screenshot 5) */}
      <CardOptionsMenu
        visible={Boolean(selectedCardForOptions)}
        card={selectedCardForOptions}
        onClose={() => setSelectedCardForOptions(null)}
        onCopyId={() => {
          Alert.alert('Card ID', selectedCardForOptions?.id);
        }}
        onCopyMarkdown={() => {
          Alert.alert('Markdown Copied', selectedCardForOptions?.content);
        }}
        onAddToReviews={async () => {
          Alert.alert('Reviews', 'Card added to review queue.');
        }}
        onDuplicate={() => {
          if (selectedCardForOptions) handleDuplicate(selectedCardForOptions);
        }}
        onToggleArchive={() => {
          if (selectedCardForOptions) handleToggleArchive(selectedCardForOptions);
        }}
        onToggleReviewReverse={() => {
          if (selectedCardForOptions) handleToggleReviewReverse(selectedCardForOptions);
        }}
        onTogglePin={() => {
          if (selectedCardForOptions) handleTogglePin(selectedCardForOptions);
        }}
        onMoveTo={() => {
          Alert.alert('Move to Deck', 'Select deck');
        }}
        onEdit={() => {
          if (selectedCardForOptions) onEditCard(selectedCardForOptions);
        }}
        onMoveToTrash={() => {
          if (selectedCardForOptions) handleMoveToTrash(selectedCardForOptions);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA'
  },
  progressLine: {
    height: 3,
    backgroundColor: '#EBEBEB',
    width: '100%'
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24
  },
  bannerWrapper: {
    position: 'relative',
    marginBottom: 16,
    zIndex: 10
  },
  darkReviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#353535',
    borderRadius: 12,
    height: 48,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  reviewBannerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    height: '100%'
  },
  reviewBannerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8
  },
  reviewDarkBadge: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center'
  },
  reviewDarkBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  bannerDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#4E4E4E'
  },
  reviewBannerChevron: {
    width: 48,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  reviewDropdownCard: {
    position: 'absolute',
    top: 54,
    right: 0,
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 20
  },
  reviewDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16
  },
  reviewDropdownLabel: {
    fontSize: 14,
    color: '#262626',
    fontWeight: '500',
    flex: 1
  },
  dropdownCountBadge: {
    backgroundColor: '#EEEEEE',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  dropdownCountBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555555'
  },
  subToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14
  },
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333'
  },
  addViewButton: {
    marginLeft: 12,
    padding: 4
  },
  filterButton: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555555'
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFEFEF',
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 40,
    marginBottom: 16
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#222222',
    paddingVertical: 0
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  newCardTile: {
    width: '48.5%',
    height: 130,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D4D4D4',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    marginBottom: 12
  },
  newCardContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  newCardText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#888888'
  },
  cardTile: {
    width: '48.5%',
    height: 130,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1
  },
  cardTileTop: {
    flex: 1,
    position: 'relative'
  },
  cardGridThumb: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#F3F4F6'
  },
  cardTitleText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#222222',
    lineHeight: 21
  },
  cardIpaText: {
    fontSize: 11.5,
    color: '#6B7280',
    marginTop: 2
  },
  pinnedIcon: {
    position: 'absolute',
    top: 0,
    right: 0
  },
  dashedDivider: {
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    borderStyle: 'dashed',
    marginVertical: 6
  },
  cardTileBottom: {},
  hiddenSideText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#AAAAAA',
    letterSpacing: 0.5
  },
  listContainer: {
    gap: 8
  },
  listNewCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CCCCCC',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 8
  },
  listNewCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666'
  },
  listCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 10,
    padding: 14,
    marginBottom: 6
  },
  listCardContent: {
    flex: 1,
    marginRight: 10
  },
  listCardHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  listCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222222'
  },
  listCardIpa: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8
  },
  listCardSub: {
    fontSize: 13,
    color: '#777777',
    marginTop: 3
  },
  listCardRight: {
    alignItems: 'flex-end',
    gap: 4
  },
  listHiddenSideText: {
    fontSize: 10,
    color: '#999999',
    fontWeight: '500'
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyText: {
    fontSize: 15,
    color: '#888888',
    marginBottom: 12
  },
  emptyButton: {
    backgroundColor: '#262626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  renameContainer: {
    width: '85%',
    maxWidth: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18
  },
  renameHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 14
  },
  renameInput: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 15,
    marginBottom: 16
  },
  renameActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10
  },
  renameCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  renameCancelText: {
    fontSize: 14,
    color: '#666666'
  },
  renameSaveBtn: {
    backgroundColor: '#222222',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16
  },
  renameSaveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  filterMenuContainer: {
    width: '80%',
    maxWidth: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14
  },
  filterMenuHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EAEAEA',
    paddingBottom: 6
  },
  filterChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  filterChoiceActive: {
    backgroundColor: '#F2F2F2'
  },
  filterChoiceText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#444444'
  },
  filterChoiceTextActive: {
    fontWeight: '700',
    color: '#111111'
  }
});
