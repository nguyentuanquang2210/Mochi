import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Feather } from './Icons';
import type { SuggestionItem } from '../../services/dictionary';

interface AutocompleteDropdownProps {
  visible: boolean;
  suggestions: SuggestionItem[];
  loading: boolean;
  query: string;
  onSelectWord: (item: SuggestionItem) => void;
  onClose?: () => void;
}

export function AutocompleteDropdown({
  visible,
  suggestions,
  loading,
  query,
  onSelectWord,
  onClose
}: AutocompleteDropdownProps) {
  if (!visible || query.trim().length < 2) return null;

  return (
    <View style={styles.container}>
      {/* Header bar with title and close button */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="search" size={13} color="#6B7280" style={{ marginRight: 5 }} />
          <Text style={styles.headerTitle}>GỢI Ý TỪ TIẾNG ANH</Text>
        </View>

        {loading && <ActivityIndicator size="small" color="#2563EB" style={styles.loader} />}

        {onClose && (
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={14} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Suggestions List */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.scrollList}
        showsVerticalScrollIndicator={false}
      >
        {suggestions.length > 0 ? (
          suggestions.map((item, index) => (
            <TouchableOpacity
              key={`${item.word}-${index}`}
              style={[styles.itemRow, index < suggestions.length - 1 && styles.itemBorder]}
              activeOpacity={0.65}
              onPress={() => onSelectWord(item)}
            >
              <View style={styles.wordInfo}>
                <View style={styles.wordTitleRow}>
                  <Text style={styles.wordText}>{item.word}</Text>
                  {item.isToeic && (
                    <View style={styles.toeicBadge}>
                      <Text style={styles.toeicBadgeText}>TOEIC</Text>
                    </View>
                  )}
                </View>

                {item.ipa ? (
                  <Text style={styles.ipaText}>{item.ipa}</Text>
                ) : null}

                {item.meaningVi ? (
                  <Text style={styles.meaningText} numberOfLines={1}>
                    {item.meaningVi}
                  </Text>
                ) : null}
              </View>

              <Feather name="arrow-up-left" size={15} color="#9CA3AF" style={styles.selectIcon} />
            </TouchableOpacity>
          ))
        ) : !loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Không tìm thấy từ gợi ý phù hợp</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 6,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    maxHeight: 220,
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.6
  },
  loader: {
    marginRight: 6
  },
  scrollList: {
    maxHeight: 180
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  itemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6'
  },
  wordInfo: {
    flex: 1
  },
  wordTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  wordText: {
    fontSize: 15.5,
    fontWeight: '600',
    color: '#111827'
  },
  toeicBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#BFDBFE'
  },
  toeicBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#2563EB'
  },
  ipaText: {
    fontSize: 12.5,
    color: '#6B7280',
    marginTop: 1,
    fontFamily: undefined
  },
  meaningText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2
  },
  selectIcon: {
    marginLeft: 10
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF'
  }
});

