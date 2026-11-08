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
import { Feather, Ionicons } from './Icons';
import type { Deck } from '../../domain/types';

interface DrawerProps {
  visible: boolean;
  onClose: () => void;
  decks: Deck[];
  activeDeckId: string | null;
  activeView: string;
  inboxDueCount: number;
  trashCount: number;
  userName: string;
  onSelectDeck: (deckId: string) => void;
  onSelectView: (view: 'dashboard' | 'inbox' | 'import' | 'settings' | 'trash') => void;
  onCreateDeck: (name: string) => void;
}

export function Drawer({
  visible,
  onClose,
  decks,
  activeDeckId,
  activeView,
  inboxDueCount,
  trashCount,
  userName,
  onSelectDeck,
  onSelectView,
  onCreateDeck
}: DrawerProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [isCreatingDeck, setIsCreatingDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');

  const filteredDecks = decks.filter(d =>
    !searchFilter || d.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleCreateDeckSubmit = () => {
    if (!newDeckName.trim()) {
      setIsCreatingDeck(false);
      return;
    }
    onCreateDeck(newDeckName.trim());
    setNewDeckName('');
    setIsCreatingDeck(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.drawerContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.userRow} activeOpacity={0.7}>
              <Text style={styles.userName}>{userName}</Text>
              <Feather name="chevron-down" size={16} color="#444444" style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            <View style={styles.offlineRow}>
              <Feather name="wifi-off" size={14} color="#D9534F" style={{ marginRight: 5 }} />
              <Text style={styles.offlineText}>Ngoại tuyến</Text>
            </View>
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <Feather name="search" size={16} color="#888888" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm..."
              placeholderTextColor="#999999"
              value={searchFilter}
              onChangeText={setSearchFilter}
              autoCapitalize="none"
            />
          </View>

          <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
            {/* Dashboard */}
            <TouchableOpacity
              style={[styles.menuItem, activeView === 'dashboard' && styles.menuItemActive]}
              onPress={() => {
                onSelectView('dashboard');
                onClose();
              }}
            >
              <Feather name="trending-up" size={17} color="#555555" style={styles.menuIcon} />
              <Text style={styles.menuText}>Thống kê</Text>
            </TouchableOpacity>

            {/* Inbox */}
            <TouchableOpacity
              style={[styles.menuItem, activeView === 'inbox' && styles.menuItemActive]}
              onPress={() => {
                onSelectView('inbox');
                onClose();
              }}
            >
              <Ionicons name="file-tray-full-outline" size={18} color="#555555" style={styles.menuIcon} />
              <Text style={styles.menuText}>Hộp ôn tập</Text>
              {inboxDueCount > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{inboxDueCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* DECKS Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>BỘ THẺ</Text>
            </View>

            {filteredDecks.map(deck => {
              const isSelected = activeView === 'deck' && activeDeckId === deck.id;
              return (
                <TouchableOpacity
                  key={deck.id}
                  style={[styles.deckItem, isSelected && styles.deckItemActive]}
                  onPress={() => {
                    onSelectDeck(deck.id);
                    onClose();
                  }}
                >
                  <Feather name="chevron-right" size={14} color="#888888" style={{ marginRight: 6 }} />
                  <Ionicons
                    name="folder-sharp"
                    size={16}
                    color={isSelected ? '#444444' : '#888888'}
                    style={{ marginRight: 9 }}
                  />
                  <Text numberOfLines={1} style={[styles.deckName, isSelected && styles.deckNameActive]}>
                    {deck.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* + New Deck */}
            {isCreatingDeck ? (
              <View style={styles.newDeckInputRow}>
                <TextInput
                  style={styles.newDeckInput}
                  placeholder="Tên bộ thẻ..."
                  value={newDeckName}
                  onChangeText={setNewDeckName}
                  autoFocus
                  onSubmitEditing={handleCreateDeckSubmit}
                />
                <TouchableOpacity onPress={handleCreateDeckSubmit} style={styles.newDeckSaveButton}>
                  <Text style={styles.newDeckSaveText}>Thêm</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.newDeckButton}
                onPress={() => setIsCreatingDeck(true)}
              >
                <Feather name="plus" size={16} color="#888888" style={{ marginRight: 8 }} />
                <Text style={styles.newDeckText}>Tạo bộ thẻ mới</Text>
              </TouchableOpacity>
            )}

            <View style={styles.divider} />

            {/* Import */}
            <TouchableOpacity
              style={[styles.menuItem, activeView === 'import' && styles.menuItemActive]}
              onPress={() => {
                onSelectView('import');
                onClose();
              }}
            >
              <Feather name="download" size={17} color="#555555" style={styles.menuIcon} />
              <Text style={styles.menuText}>Nhập thẻ</Text>
            </TouchableOpacity>

            {/* Settings */}
            <TouchableOpacity
              style={[styles.menuItem, activeView === 'settings' && styles.menuItemActive]}
              onPress={() => {
                onSelectView('settings');
                onClose();
              }}
            >
              <Feather name="settings" size={17} color="#555555" style={styles.menuIcon} />
              <Text style={styles.menuText}>Cài đặt</Text>
            </TouchableOpacity>

            {/* Trash */}
            <TouchableOpacity
              style={[styles.menuItem, activeView === 'trash' && styles.menuItemActive]}
              onPress={() => {
                onSelectView('trash');
                onClose();
              }}
            >
              <Feather name="trash-2" size={17} color="#555555" style={styles.menuIcon} />
              <Text style={styles.menuText}>Thùng rác</Text>
              {trashCount > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{trashCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.25)'
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  },
  drawerContent: {
    width: '78%',
    maxWidth: 320,
    backgroundColor: '#FAFAFA',
    height: '100%',
    paddingTop: 52,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8
  },
  header: {
    marginBottom: 16
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222222'
  },
  offlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2
  },
  offlineText: {
    fontSize: 13,
    color: '#D9534F',
    fontWeight: '500'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFEFEF',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 38,
    marginBottom: 20
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#222222',
    paddingVertical: 0
  },
  menuScroll: {
    flex: 1
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2
  },
  menuItemActive: {
    backgroundColor: '#EBEBEB'
  },
  menuIcon: {
    marginRight: 12
  },
  menuText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2A2A2A',
    flex: 1
  },
  countBadge: {
    backgroundColor: '#DCDCDC',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center'
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555555'
  },
  sectionHeader: {
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 10
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999999',
    letterSpacing: 0.8
  },
  deckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2
  },
  deckItemActive: {
    backgroundColor: '#EBEBEB'
  },
  deckName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333333',
    flex: 1
  },
  deckNameActive: {
    fontWeight: '600',
    color: '#111111'
  },
  newDeckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginTop: 4
  },
  newDeckText: {
    fontSize: 15,
    color: '#888888',
    fontWeight: '500'
  },
  newDeckInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginVertical: 4
  },
  newDeckInput: {
    flex: 1,
    height: 36,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 14
  },
  newDeckSaveButton: {
    marginLeft: 8,
    backgroundColor: '#333333',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6
  },
  newDeckSaveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  divider: {
    height: 1,
    backgroundColor: '#EAEAEA',
    marginVertical: 14,
    marginHorizontal: 10
  }
});

