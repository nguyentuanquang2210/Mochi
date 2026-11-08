import React from 'react';
import {
  Modal,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from './Icons';
import type { Deck } from '../../domain/types';

interface DeckOptionsMenuProps {
  visible: boolean;
  deck: Deck;
  onClose: () => void;
  onCopyId: () => void;
  onExport: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onDeckSettings: () => void;
  onTemplate: () => void;
  onRename: () => void;
  isArchived: boolean;
  onToggleArchive: () => void;
  onResetHistory: () => void;
  onMoveToTrash: () => void;
}

export function DeckOptionsMenu({
  visible,
  deck,
  onClose,
  onCopyId,
  onExport,
  onDuplicate,
  onShare,
  onDeckSettings,
  onTemplate,
  onRename,
  isArchived,
  onToggleArchive,
  onResetHistory,
  onMoveToTrash
}: DeckOptionsMenuProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.menuContainer}>
              {/* Copy ID */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { onCopyId(); onClose(); }}
              >
                <Feather name="link" size={17} color="#555" style={styles.itemIcon} />
                <Text style={styles.itemText}>Sao chép ID</Text>
              </TouchableOpacity>

              {/* Export */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { onExport(); onClose(); }}
              >
                <Feather name="upload" size={17} color="#555" style={styles.itemIcon} />
                <Text style={styles.itemText}>Xuất dữ liệu (Markdown)</Text>
              </TouchableOpacity>

              {/* Duplicate */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { onDuplicate(); onClose(); }}
              >
                <Feather name="layers" size={17} color="#555" style={styles.itemIcon} />
                <Text style={styles.itemText}>Nhân bản bộ thẻ</Text>
              </TouchableOpacity>

              {/* Share */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { onShare(); onClose(); }}
              >
                <Feather name="share-2" size={17} color="#555" style={styles.itemIcon} />
                <Text style={styles.itemText}>Chia sẻ</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Deck settings */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { onDeckSettings(); onClose(); }}
              >
                <Feather name="sliders" size={17} color="#555" style={styles.itemIcon} />
                <Text style={styles.itemText}>Cài đặt bộ thẻ</Text>
              </TouchableOpacity>

              {/* Template */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { onTemplate(); onClose(); }}
              >
                <Feather name="box" size={17} color="#555" style={styles.itemIcon} />
                <Text style={styles.itemText}>Mẫu thẻ</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Rename */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { onRename(); onClose(); }}
              >
                <Feather name="edit-2" size={17} color="#555" style={styles.itemIcon} />
                <Text style={styles.itemText}>Đổi tên bộ thẻ</Text>
              </TouchableOpacity>

              {/* Archive Deck with switch */}
              <View style={styles.menuItemWithSwitch}>
                <View style={styles.switchLeft}>
                  <Feather name="archive" size={17} color="#555" style={styles.itemIcon} />
                  <Text style={styles.itemText}>Lưu trữ bộ thẻ</Text>
                </View>
                <Switch
                  value={isArchived}
                  onValueChange={onToggleArchive}
                  trackColor={{ false: '#E0E0E0', true: '#777777' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Reset Review History */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { onResetHistory(); onClose(); }}
              >
                <MaterialCommunityIcons name="cancel" size={18} color="#666" style={styles.itemIcon} />
                <Text style={styles.itemText}>Đặt lại lịch sử ôn tập</Text>
              </TouchableOpacity>

              {/* Move to Trash */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { onMoveToTrash(); onClose(); }}
              >
                <Feather name="trash-2" size={17} color="#D9534F" style={styles.itemIcon} />
                <Text style={[styles.itemText, { color: '#D9534F' }]}>Xóa bộ thẻ</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: 16
  },
  menuContainer: {
    width: 250,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16
  },
  menuItemWithSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 16
  },
  switchLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  itemIcon: {
    marginRight: 12
  },
  itemText: {
    fontSize: 14,
    color: '#262626',
    fontWeight: '500'
  },
  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 4
  }
});

