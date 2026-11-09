import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Feather, Ionicons } from './Icons';
import { WordSense, DictionarySource } from '../../services/dictionary/types';

interface MultiSenseSelectorProps {
  senses: WordSense[];
  selectedSenseIds: Set<string>;
  onToggleSense: (senseId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  sources: DictionarySource[];
}

export function MultiSenseSelector({
  senses,
  selectedSenseIds,
  onToggleSense,
  onSelectAll,
  onDeselectAll,
  sources
}: MultiSenseSelectorProps) {
  if (!senses || senses.length === 0) return null;

  const allSelected = senses.length > 0 && senses.every(s => selectedSenseIds.has(s.id));

  const getSourceBadgeText = (src: DictionarySource) => {
    switch (src) {
      case 'merriam_webster':
        return 'Merriam-Webster';
      case 'free_dictionary':
        return 'Free Dictionary';
      case 'merged':
        return 'MW & Free Dict';
      default:
        return 'TOEIC Core';
    }
  };

  return (
    <View style={styles.container}>
      {/* Tiêu đề & Chọn tất cả */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <Ionicons name="book-outline" size={15} color="#2563EB" style={{ marginRight: 5 }} />
          <Text style={styles.titleText}>Ý NGHĨA TỪ ĐIỂN ({senses.length})</Text>
        </View>

        <TouchableOpacity
          onPress={allSelected ? onDeselectAll : onSelectAll}
          style={styles.toggleAllBtn}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.toggleAllText}>
            {allSelected ? 'Bỏ chọn hết' : 'Chọn tất cả'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.helperText}>
        Tích chọn các nét nghĩa bạn muốn đưa vào thẻ học (Ưu tiên nghĩa TOEIC ở trên):
      </Text>

      {/* Danh sách các senses */}
      <View style={styles.sensesList}>
        {senses.map((sense, index) => {
          const isSelected = selectedSenseIds.has(sense.id);
          const isHigh = sense.toeicPriority === 'high';

          return (
            <TouchableOpacity
              key={sense.id || index}
              style={[
                styles.senseCard,
                isSelected && styles.senseCardSelected,
                isHigh && !isSelected && styles.senseCardHighPriority
              ]}
              activeOpacity={0.75}
              onPress={() => onToggleSense(sense.id)}
            >
              {/* Cột checkbox bên trái */}
              <View style={styles.checkboxArea}>
                <Ionicons
                  name={isSelected ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={isSelected ? '#2563EB' : '#94A3B8'}
                />
              </View>

              {/* Thông tin chi tiết của Sense */}
              <View style={styles.senseContent}>
                {/* Dòng tags: Từ loại, TOEIC Priority, Nguồn */}
                <View style={styles.tagsRow}>
                  <View style={styles.posBadge}>
                    <Text style={styles.posBadgeText}>
                      {(sense.partOfSpeech || 'n').toUpperCase()}
                    </Text>
                  </View>

                  {isHigh && (
                    <View style={styles.toeicBadge}>
                      <Text style={styles.toeicBadgeText}>TOEIC Ưu tiên ⭐</Text>
                    </View>
                  )}

                  {sense.domain && sense.domain !== 'general' && (
                    <View style={styles.domainBadge}>
                      <Text style={styles.domainBadgeText}>{sense.domain.toUpperCase()}</Text>
                    </View>
                  )}

                  <View style={styles.sourceBadge}>
                    <Text style={styles.sourceBadgeText}>
                      {getSourceBadgeText(sense.source)}
                    </Text>
                  </View>
                </View>

                {/* Nghĩa tiếng Việt nổi bật */}
                <Text style={styles.meaningViText}>
                  {sense.meaningVi || sense.definitionEn}
                </Text>

                {/* Định nghĩa tiếng Anh nguyên bản */}
                {sense.definitionEn && sense.definitionEn !== sense.meaningVi ? (
                  <Text style={styles.definitionEnText} numberOfLines={2}>
                    {sense.definitionEn}
                  </Text>
                ) : null}

                {/* Câu ví dụ tiếng Anh + dịch nếu có */}
                {sense.exampleEn ? (
                  <View style={styles.exampleBox}>
                    <Text style={styles.exampleEnText}>
                      📝 {sense.exampleEn}
                    </Text>
                    {sense.exampleVi ? (
                      <Text style={styles.exampleViText}>
                        ({sense.exampleVi})
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Attribution chuẩn theo giấy phép của Merriam-Webster và Wiktionary */}
      <View style={styles.attributionFooter}>
        <Feather name="info" size={11} color="#94A3B8" style={{ marginRight: 4 }} />
        <Text style={styles.attributionText}>
          Dữ liệu từ điển: Merriam-Webster Learner's Dictionary & Free Dictionary API (Wiktionary CC BY-SA)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  titleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.5
  },
  toggleAllBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6
  },
  toggleAllText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600'
  },
  helperText: {
    fontSize: 11.5,
    color: '#64748B',
    marginBottom: 10
  },
  sensesList: {
    gap: 8
  },
  senseCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0'
  },
  senseCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#F0F7FF'
  },
  senseCardHighPriority: {
    borderColor: '#CBD5E1'
  },
  checkboxArea: {
    marginRight: 8,
    paddingTop: 2
  },
  senseContent: {
    flex: 1
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4
  },
  posBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  posBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569'
  },
  toeicBadge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  toeicBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309'
  },
  domainBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  domainBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#4338CA'
  },
  sourceBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4
  },
  sourceBadgeText: {
    fontSize: 9.5,
    color: '#64748B'
  },
  meaningViText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2
  },
  definitionEnText: {
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
    marginBottom: 4,
    lineHeight: 16
  },
  exampleBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 6,
    marginTop: 2,
    borderLeftWidth: 2.5,
    borderLeftColor: '#3B82F6'
  },
  exampleEnText: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '500'
  },
  exampleViText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    fontStyle: 'italic'
  },
  attributionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  attributionText: {
    fontSize: 10,
    color: '#94A3B8',
    flex: 1
  }
});
