import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
  inboxNewCount: number;
  deckCardCounts: Record<string, number>;
  trashCount: number;
  userName: string;
  onSelectDeck: (deckId: string) => void;
  onSelectView: (view: 'dashboard' | 'inbox' | 'import' | 'settings' | 'trash') => void;
  onStartInboxReview: (mode: 'due' | 'new') => void;
  onCreateDeck: (name: string) => void;
  onLogout: () => void;
}

export function Drawer({
  visible,
  onClose,
  decks,
  activeDeckId,
  activeView,
  inboxDueCount,
  inboxNewCount,
  deckCardCounts,
  trashCount,
  userName,
  onSelectDeck,
  onSelectView,
  onStartInboxReview,
  onCreateDeck,
  onLogout
}: DrawerProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [isCreatingDeck, setIsCreatingDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  useEffect(() => {
    if (!visible) setShowAccountMenu(false);
  }, [visible]);

  const closeDrawer = () => {
    setShowAccountMenu(false);
    onClose();
  };

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
    <View style={styles.drawerContent}>
      {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.userRow}
              activeOpacity={0.7}
              onPress={() => setShowAccountMenu(open => !open)}
              accessibilityRole="button"
              accessibilityLabel="Mở menu tài khoản"
            >
              <Text style={styles.userName}>{userName}</Text>
              <Feather name="chevron-down" size={16} color="#444444" style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            <View style={styles.offlineRow}>
              <Feather name="wifi" size={14} color="#16A34A" style={{ marginRight: 5 }} />
              <Text style={styles.offlineText}>Trực tuyến</Text>
            </View>

            {showAccountMenu && (
              <View style={styles.accountMenu}>
                <TouchableOpacity
                  style={styles.accountMenuItem}
                  onPress={() => {
                    setShowAccountMenu(false);
                    closeDrawer();
                    onLogout();
                  }}
                  accessibilityRole="button"
                >
                  <Feather name="log-out" size={16} color="#C2410C" />
                  <Text style={styles.accountMenuText}>Đăng xuất</Text>
                </TouchableOpacity>
              </View>
            )}
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
              onFocus={() => setShowAccountMenu(false)}
              autoCapitalize="none"
            />
          </View>

          <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false} onTouchStart={() => setShowAccountMenu(false)}>
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
            <TouchableOpacity style={styles.inboxChild} onPress={() => { onStartInboxReview('due'); onClose(); }}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#888" style={styles.menuIcon} />
              <Text style={styles.menuText}>Cần ôn hôm nay</Text>
              <View style={styles.countBadge}><Text style={styles.countBadgeText}>{inboxDueCount}</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.inboxChild} onPress={() => { onStartInboxReview('new'); onClose(); }}>
              <Feather name="circle" size={17} color="#999" style={styles.menuIcon} />
              <Text style={styles.menuText}>Thẻ mới</Text>
              <View style={styles.countBadge}><Text style={styles.countBadgeText}>{inboxNewCount}</Text></View>
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
                  <View style={styles.countBadge}><Text style={styles.countBadgeText}>{deckCardCounts[deck.id] || 0}</Text></View>
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
  );
}

const styles = StyleSheet.create({
  drawerContent: {
    width: '100%',
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingTop: 52,
    paddingHorizontal: 16
  },
  header: {
    marginBottom: 16
  },
  accountMenu: {
    width: 150,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8
  },
  accountMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  accountMenuText: {
    color: '#C2410C',
    fontSize: 14,
    fontWeight: '600'
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
    color: '#16A34A',
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
  inboxChild: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingLeft: 26, paddingRight: 10, borderRadius: 8
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

