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
import type { CardSummary } from '../../domain/types';

interface CardOptionsMenuProps {
  visible: boolean;
  card: CardSummary | null;
  onClose: () => void;
  onCopyId: () => void;
  onCopyMarkdown: () => void;
  onAddToReviews: () => void;
  onDuplicate: () => void;
  onToggleArchive: () => void;
  onToggleReviewReverse: () => void;
  onTogglePin: () => void;
  onMoveTo: () => void;
  onEdit: () => void;
  onMoveToTrash: () => void;
}

export function CardOptionsMenu({
  visible,
  card,
  onClose,
  onCopyId,
  onCopyMarkdown,
  onAddToReviews,
  onDuplicate,
  onToggleArchive,
  onToggleReviewReverse,
  onTogglePin,
  onMoveTo,
  onEdit,
  onMoveToTrash
}: CardOptionsMenuProps) {
  if (!card) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.menuContainer}>
              {/* Copy ID */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onCopyId();
                  onClose();
                }}
              >
                <Feather name="link" size={18} color="#555555" style={styles.itemIcon} />
                <Text style={styles.itemText}>Sao chép ID</Text>
              </TouchableOpacity>

              {/* Copy as Markdown */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onCopyMarkdown();
                  onClose();
                }}
              >
                <Feather name="copy" size={18} color="#555555" style={styles.itemIcon} />
                <Text style={styles.itemText}>Sao chép Markdown</Text>
              </TouchableOpacity>

              {/* Add to reviews */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onAddToReviews();
                  onClose();
                }}
              >
                <Feather name="calendar" size={18} color="#555555" style={styles.itemIcon} />
                <Text style={styles.itemText}>Thêm vào hàng đợi</Text>
              </TouchableOpacity>

              {/* Duplicate */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onDuplicate();
                  onClose();
                }}
              >
                <Feather name="layers" size={18} color="#555555" style={styles.itemIcon} />
                <Text style={styles.itemText}>Nhân bản thẻ</Text>
              </TouchableOpacity>

              {/* Templates */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={onClose}
              >
                <Feather name="box" size={18} color="#555555" style={styles.itemIcon} />
                <Text style={styles.itemText}>Mẫu thẻ</Text>
                <Feather name="chevron-right" size={16} color="#888888" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Archived toggle */}
              <View style={styles.menuItemWithSwitch}>
                <View style={styles.switchLeft}>
                  <Feather name="archive" size={18} color="#555555" style={styles.itemIcon} />
                  <Text style={styles.itemText}>Lưu trữ</Text>
                </View>
                <Switch
                  value={Boolean(card.archivedAt)}
                  onValueChange={onToggleArchive}
                  trackColor={{ false: '#E0E0E0', true: '#777777' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Review reverse toggle */}
              <View style={styles.menuItemWithSwitch}>
                <View style={styles.switchLeft}>
                  <Ionicons name="swap-vertical" size={18} color="#555555" style={styles.itemIcon} />
                  <Text style={styles.itemText}>Ôn tập đảo chiều</Text>
                </View>
                <Switch
                  value={card.reviewReverse}
                  onValueChange={onToggleReviewReverse}
                  trackColor={{ false: '#E0E0E0', true: '#777777' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Pin card */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onTogglePin();
                  onClose();
                }}
              >
                <MaterialCommunityIcons
                  name="pin-outline"
                  size={19}
                  color={card.isPinned ? '#222222' : '#555555'}
                  style={styles.itemIcon}
                />
                <Text style={[styles.itemText, card.isPinned && { fontWeight: '700' }]}>
                  {card.isPinned ? 'Bỏ ghim thẻ' : 'Ghim thẻ lên đầu'}
                </Text>
              </TouchableOpacity>

              {/* Move to */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onMoveTo();
                  onClose();
                }}
              >
                <Feather name="corner-up-right" size={18} color="#555555" style={styles.itemIcon} />
                <Text style={styles.itemText}>Chuyển tới bộ thẻ...</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Edit */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onEdit();
                  onClose();
                }}
              >
                <Feather name="edit-2" size={18} color="#555555" style={styles.itemIcon} />
                <Text style={styles.itemText}>Chỉnh sửa</Text>
              </TouchableOpacity>

              {/* Move to Trash */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onMoveToTrash();
                  onClose();
                }}
              >
                <Feather name="trash-2" size={18} color="#D9534F" style={styles.itemIcon} />
                <Text style={[styles.itemText, { color: '#D9534F' }]}>Chuyển vào thùng rác</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  menuContainer: {
    width: '90%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8
  },
  menuItemWithSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 14
  },
  switchLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  itemIcon: {
    marginRight: 14
  },
  itemText: {
    fontSize: 15,
    color: '#262626',
    fontWeight: '500'
  },
  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 6,
    marginHorizontal: 10
  }
});

