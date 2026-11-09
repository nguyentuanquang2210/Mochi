import React, { useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Feather, Ionicons } from './components/Icons';
import { Header } from './components/Header';
import type { CardSummary, Deck } from '../domain/types';
import { CardOptionsMenu } from './components/CardOptionsMenu';
import { CardRepository } from '../data/repositories';

interface SearchViewProps {
  decks: Deck[];
  allCards: CardSummary[];
  onOpenDrawer: () => void;
  onEditCard: (card: CardSummary) => void;
  onRefresh: () => void;
}

export function SearchView({
  decks,
  allCards,
  onOpenDrawer,
  onEditCard,
  onRefresh
}: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [selectedDeckFilter, setSelectedDeckFilter] = useState<string | null>(null);
  const [selectedCardForOptions, setSelectedCardForOptions] = useState<CardSummary | null>(null);

  const filteredCards = allCards.filter(c => {
    if (selectedDeckFilter && c.deckId !== selectedDeckFilter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      c.front.toLowerCase().includes(q) ||
      c.back.toLowerCase().includes(q) ||
      c.content.toLowerCase().includes(q) ||
      c.tags.some(t => t.toLowerCase().includes(q))
    );
  });

  const getDeckName = (deckId: string) => decks.find(d => d.id === deckId)?.name || 'Chung';

  return (
    <View style={styles.container}>
      <Header
        onOpenDrawer={onOpenDrawer}
        title="Tìm kiếm"
        iconName="search"
      />

      <View style={styles.searchHeaderArea}>
        <View style={styles.searchBar}>
          <Feather name="search" size={17} color="#888888" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm tất cả thẻ & ghi chú…"
            placeholderTextColor="#999999"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Feather name="x" size={16} color="#888888" />
            </TouchableOpacity>
          )}
        </View>

        {/* Deck filter chips */}
        <View style={styles.chipsRow}>
          <TouchableOpacity
            style={[styles.chip, !selectedDeckFilter && styles.chipActive]}
            onPress={() => setSelectedDeckFilter(null)}
          >
            <Text style={[styles.chipText, !selectedDeckFilter && styles.chipTextActive]}>Tất cả bộ thẻ</Text>
          </TouchableOpacity>
          {decks.map(d => (
            <TouchableOpacity
              key={d.id}
              style={[styles.chip, selectedDeckFilter === d.id && styles.chipActive]}
              onPress={() => setSelectedDeckFilter(selectedDeckFilter === d.id ? null : d.id)}
            >
              <Text style={[styles.chipText, selectedDeckFilter === d.id && styles.chipTextActive]}>{d.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filteredCards}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.cardItem}
            activeOpacity={0.7}
            onPress={() => onEditCard(item)}
            onLongPress={() => setSelectedCardForOptions(item)}
          >
            <View style={styles.cardTop}>
              <Text numberOfLines={2} style={styles.cardFront}>{item.front}</Text>
              <View style={styles.deckTag}>
                <Text style={styles.deckTagText}>{getDeckName(item.deckId)}</Text>
              </View>
            </View>

            {item.back ? (
              <Text numberOfLines={2} style={styles.cardBack}>{item.back}</Text>
            ) : null}

            <View style={styles.cardFooter}>
              <Text style={styles.footerSides}>
                + {item.hiddenSidesCount || 1} MẶT ẨN
              </Text>
              <Text style={styles.footerStatus}>
                {item.isNew ? 'MỚI' : item.isDue ? 'ĐẾN HẠN' : 'ĐÃ ÔN'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {query ? `Không tìm thấy thẻ phù hợp với "${query}"` : 'Chưa có thẻ nào'}
            </Text>
          </View>
        }
      />

      <CardOptionsMenu
        visible={Boolean(selectedCardForOptions)}
        card={selectedCardForOptions}
        onClose={() => setSelectedCardForOptions(null)}
        onCopyId={() => {}}
        onCopyMarkdown={() => {}}
        onAddToReviews={async () => {
          if (selectedCardForOptions) {
            await CardRepository.addToReviewQueue(selectedCardForOptions.id);
            onRefresh();
          }
        }}
        onResetHistory={async () => {
          if (selectedCardForOptions) {
            await CardRepository.resetCardReviewHistory(selectedCardForOptions.id);
            onRefresh();
          }
        }}
        onDuplicate={() => { onRefresh(); }}
        onToggleArchive={() => { onRefresh(); }}
        onToggleReviewReverse={() => { onRefresh(); }}
        onTogglePin={() => { onRefresh(); }}
        onMoveTo={() => {}}
        onEdit={() => {
          if (selectedCardForOptions) onEditCard(selectedCardForOptions);
        }}
        onMoveToTrash={() => { onRefresh(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA'
  },
  searchHeaderArea: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E6E6'
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#222222',
    paddingVertical: 0
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F2F2F2'
  },
  chipActive: {
    backgroundColor: '#333333'
  },
  chipText: {
    fontSize: 12,
    color: '#555555',
    fontWeight: '500'
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  listContent: {
    padding: 16
  },
  cardItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    padding: 14,
    marginBottom: 10
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6
  },
  cardFront: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
    flex: 1,
    marginRight: 8
  },
  deckTag: {
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  deckTagText: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '500'
  },
  cardBack: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 8
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 8,
    marginTop: 4
  },
  footerSides: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999999',
    letterSpacing: 0.5
  },
  footerStatus: {
    fontSize: 10,
    fontWeight: '600',
    color: '#AAAAAA'
  },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 40
  },
  emptyText: {
    fontSize: 15,
    color: '#888888'
  }
});

