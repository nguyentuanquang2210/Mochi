import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, Ionicons } from './Icons';

interface HeaderProps {
  onOpenDrawer: () => void;
  title: string;
  iconName?: string;
  onMorePress?: () => void;
  rightAction?: React.ReactNode;
}

export function Header({
  onOpenDrawer,
  title,
  iconName = 'folder',
  onMorePress,
  rightAction
}: HeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        onPress={onOpenDrawer}
        style={styles.iconButton}
      >
        <Feather name="menu" size={24} color="#333333" />
      </TouchableOpacity>

      <View style={styles.titleContainer}>
        {iconName === 'folder' ? (
          <Ionicons name="folder-sharp" size={17} color="#555555" style={styles.titleIcon} />
        ) : iconName === 'trending' ? (
          <Feather name="trending-up" size={18} color="#333333" style={styles.titleIcon} />
        ) : iconName === 'search' ? (
          <Feather name="search" size={18} color="#333333" style={styles.titleIcon} />
        ) : iconName === 'trash' ? (
          <Feather name="trash-2" size={18} color="#333333" style={styles.titleIcon} />
        ) : iconName === 'settings' ? (
          <Feather name="settings" size={18} color="#333333" style={styles.titleIcon} />
        ) : null}
        <Text numberOfLines={1} style={styles.titleText}>{title}</Text>
      </View>

      <View style={styles.rightContainer}>
        {rightAction ? (
          rightAction
        ) : onMorePress ? (
          <TouchableOpacity
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={onMorePress}
            style={styles.iconButton}
          >
            <Feather name="more-horizontal" size={24} color="#555555" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 28 }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E6E6'
  },
  iconButton: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  titleIcon: {
    marginRight: 8
  },
  titleText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#222222',
    letterSpacing: -0.2
  },
  rightContainer: {
    minWidth: 32,
    alignItems: 'flex-end',
    justifyContent: 'center'
  }
});

