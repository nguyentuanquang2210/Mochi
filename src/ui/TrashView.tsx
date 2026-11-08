import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Feather } from './components/Icons';
import { Header } from './components/Header';
import type { CardSummary } from '../domain/types';
import { CardRepository } from '../data/repositories';

interface TrashViewProps {
  onOpenDrawer: () => void;
  onRefresh: () => void;
}

export function TrashView({ onOpenDrawer, onRefresh }: TrashViewProps) {
  const [trashedCards, setTrashedCards] = useState<CardSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrashed();
  }, []);

  const loadTrashed = async () => {
    setLoading(true);
    const list = await CardRepository.getTrashedCards();
    setTrashedCards(list);
    setLoading(false);
  };

  const handleRestore = async (cardId: string) => {
    await CardRepository.restoreFromTrash(cardId);
    await loadTrashed();
    onRefresh();
  };

  const handlePermanentDelete = (cardId: string) => {
    Alert.alert(
      'Xóa vĩnh viễn',
      'Thẻ này sẽ bị xóa vĩnh viễn và không thể khôi phục.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa vĩnh viễn',
          style: 'destructive',
          onPress: async () => {
            await CardRepository.permanentDelete(cardId);
            await loadTrashed();
            onRefresh();
          }
        }
      ]
    );
  };

  const handleEmptyTrash = () => {
    if (trashedCards.length === 0) return;
    Alert.alert(
      'Dọn sạch thùng rác',
      'Bạn có chắc muốn xóa vĩnh viễn tất cả thẻ trong thùng rác không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Dọn sạch',
          style: 'destructive',
          onPress: async () => {
            await CardRepository.emptyTrash();
            await loadTrashed();
            onRefresh();
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header
        onOpenDrawer={onOpenDrawer}
        title="Thùng rác"
        iconName="trash"
        rightAction={
          trashedCards.length > 0 ? (
            <TouchableOpacity onPress={handleEmptyTrash} style={styles.emptyTrashBtn}>
              <Text style={styles.emptyTrashBtnText}>Dọn sạch</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <FlatList
        data={trashedCards}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.trashCard}>
            <View style={styles.trashCardContent}>
              <Text numberOfLines={1} style={styles.trashFront}>{item.front}</Text>
              {item.back ? (
                <Text numberOfLines={1} style={styles.trashBack}>{item.back}</Text>
              ) : null}
            </View>

            <View style={styles.trashActions}>
              <TouchableOpacity
                style={styles.restoreBtn}
                onPress={() => handleRestore(item.id)}
              >
                <Feather name="rotate-ccw" size={15} color="#444444" style={{ marginRight: 4 }} />
                <Text style={styles.restoreBtnText}>Khôi phục</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handlePermanentDelete(item.id)}
              >
                <Feather name="trash-2" size={15} color="#D9534F" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Feather name="trash" size={40} color="#CCCCCC" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>Thùng rác trống</Text>
            <Text style={styles.emptySub}>Các thẻ bạn xóa sẽ xuất hiện ở đây.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA'
  },
  emptyTrashBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  emptyTrashBtnText: {
    fontSize: 14,
    color: '#D9534F',
    fontWeight: '600'
  },
  listContent: {
    padding: 16
  },
  trashCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8
  },
  trashCardContent: {
    flex: 1,
    marginRight: 10
  },
  trashFront: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333'
  },
  trashBack: {
    fontSize: 13,
    color: '#777777',
    marginTop: 2
  },
  trashActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  restoreBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333'
  },
  deleteBtn: {
    padding: 6
  },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 60
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#444444',
    marginBottom: 6
  },
  emptySub: {
    fontSize: 14,
    color: '#888888'
  }
});

