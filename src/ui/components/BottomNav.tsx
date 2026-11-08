import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, Ionicons } from './Icons';

export type TabId = 'dashboard' | 'search' | 'inbox' | 'create';

interface BottomNavProps {
  currentTab: string;
  inboxDueCount: number;
  onSelectTab: (tab: TabId) => void;
}

export function BottomNav({ currentTab, inboxDueCount, onSelectTab }: BottomNavProps) {
  return (
    <View style={styles.container}>
      {/* 1. Dashboard */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('dashboard')}
        activeOpacity={0.7}
      >
        <Feather
          name="trending-up"
          size={22}
          color={currentTab === 'dashboard' ? '#111111' : '#999999'}
        />
      </TouchableOpacity>

      {/* 2. Search */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('search')}
        activeOpacity={0.7}
      >
        <Feather
          name="search"
          size={22}
          color={currentTab === 'search' ? '#111111' : '#999999'}
        />
      </TouchableOpacity>

      {/* 3. Inbox / Due review */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('inbox')}
        activeOpacity={0.7}
      >
        <View style={styles.inboxWrapper}>
          <Ionicons
            name="file-tray-full-outline"
            size={23}
            color={currentTab === 'inbox' ? '#111111' : '#888888'}
          />
          {inboxDueCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{inboxDueCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* 4. New Card */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('create')}
        activeOpacity={0.7}
      >
        <Feather
          name="plus-square"
          size={24}
          color={currentTab === 'create' ? '#111111' : '#999999'}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EAEAEA',
    paddingBottom: 2
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%'
  },
  inboxWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center'
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#D9534F',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700'
  }
});

