import React, { useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from './Icons';
import { SpeakerButton } from './SpeakerButton';
import { VoicePracticeModal } from './VoicePracticeModal';
import { TOEIC_MAP } from '../../data/toeicWordlist';
import type { CardSummary, Deck } from '../../domain/types';

interface CardDetailBottomSheetProps {
  visible: boolean;
  card: CardSummary | null;
  deck: Deck;
  allDecks: Deck[];
  onClose: () => void;
  onEdit: () => void;
  onMore: () => void;
  onMoveToDeck: (targetDeckId: string) => void;
}

export function CardDetailBottomSheet({
  visible,
  card,
  deck,
  allDecks,
  onClose,
  onEdit,
  onMore,
  onMoveToDeck
}: CardDetailBottomSheetProps) {
  const [showDeckPicker, setShowDeckPicker] = React.useState(false);
  const [showVoicePractice, setShowVoicePractice] = useState(false);

  if (!card) return null;

  const sides = card.sides && card.sides.length > 0 ? card.sides : [card.front, card.back].filter(Boolean);
  const intervalDays = card.intervalDays ?? 0;
  const reps = card.reps ?? 0;
  const cardImg = card.thumbnailUrl || card.imageUrl;

  const cardIpa = (() => {
    if (card.ipaUs || card.ipaUk) return card.ipaUs || card.ipaUk;
    const clean = (sides[0] || card.front || '').trim().toLowerCase();
    const toeic = TOEIC_MAP.get(clean);
    return toeic?.ipaUs || toeic?.ipaUk || null;
  })();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.sheetContainer}>
          {/* Header Row matching Screenshot 1 */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity
              style={styles.deckSelectorBtn}
              onPress={() => setShowDeckPicker(!showDeckPicker)}
              activeOpacity={0.7}
            >
              <Ionicons name="folder-sharp" size={16} color="#666666" style={{ marginRight: 6 }} />
              <Text style={styles.deckSelectorText}>{deck.name}</Text>
              <Feather name="chevron-down" size={14} color="#666666" style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={onEdit}
                style={styles.actionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="edit-2" size={18} color="#444444" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onMore}
                style={styles.actionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="more-horizontal" size={20} color="#444444" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Deck Picker Dropdown if opened */}
          {showDeckPicker && (
            <View style={styles.deckPickerDropdown}>
              {allDecks.map(d => (
                <TouchableOpacity
                  key={d.id}
                  style={styles.deckPickerItem}
                  onPress={() => {
                    onMoveToDeck(d.id);
                    setShowDeckPicker(false);
                  }}
                >
                  <Ionicons name="folder-sharp" size={15} color="#555555" style={{ marginRight: 8 }} />
                  <Text style={styles.deckPickerItemText}>{d.name}</Text>
                  {d.id === deck.id && <Feather name="check" size={14} color="#222" style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Card Content with all sides separated by dashed lines */}
          <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            {cardImg ? (
              <View style={styles.sheetCoverWrapper}>
                <Image source={{ uri: cardImg as string }} style={styles.sheetCoverImage} resizeMode="contain" />
              </View>
            ) : null}
            {sides.map((sideText, idx) => (
              <View key={idx}>
                {idx > 0 && <View style={styles.dashedDivider} />}
                <View style={styles.sideRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sideText, idx === 0 && styles.frontSideText]}>
                      {sideText}
                    </Text>
                    {idx === 0 && cardIpa ? (
                      <Text style={styles.sheetIpaText}>{cardIpa}</Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {idx === 0 && (
                      <TouchableOpacity
                        style={styles.sheetMicBtn}
                        onPress={() => setShowVoicePractice(true)}
                        activeOpacity={0.7}
                      >
                        <Feather name="mic" size={16} color="#2563EB" />
                      </TouchableOpacity>
                    )}
                    {idx === 0 && (
                      <SpeakerButton text={sideText} size={17} style={styles.speakerBtn} />
                    )}
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Voice Practice Modal */}
          <VoicePracticeModal
            visible={showVoicePractice}
            word={sides[0] || card.front}
            ipa={cardIpa}
            meaning={sides[1] || ''}
            onClose={() => setShowVoicePractice(false)}
          />

          {/* Footer status matching Screenshot 1 */}
          <View style={styles.sheetFooter}>
            <View style={styles.footerRow}>
              <MaterialCommunityIcons name="circle-double" size={16} color="#888888" style={{ marginRight: 6 }} />
              <Text style={styles.footerText}>
                {card.isNew ? 'MỚI' : `${intervalDays} NGÀY`}
              </Text>
            </View>

            <View style={styles.footerRow}>
              <Feather name="check" size={15} color="#555555" style={{ marginRight: 6 }} />
              <Text style={styles.footerText}>
                {reps} Lượt ôn
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEEEEE'
  },
  deckSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  deckSelectorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333'
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  actionBtn: {
    padding: 2
  },
  deckPickerDropdown: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#EAEAEA'
  },
  deckPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8
  },
  deckPickerItemText: {
    fontSize: 14,
    color: '#333333'
  },
  bodyScroll: {
    paddingVertical: 16
  },
  sheetCoverWrapper: {
    alignSelf: 'center',
    width: 140,
    height: 95,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden'
  },
  sheetCoverImage: {
    width: '100%',
    height: '100%'
  },
  sheetMicBtn: {
    padding: 6,
    marginRight: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF'
  },
  sideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6
  },
  speakerBtn: {
    marginLeft: 8
  },
  sideText: {
    flex: 1,
    fontSize: 17,
    color: '#333333',
    lineHeight: 25
  },
  frontSideText: {
    fontSize: 19,
    fontWeight: '500',
    color: '#111111'
  },
  sheetIpaText: {
    fontSize: 13.5,
    color: '#6B7280',
    marginTop: 2
  },
  dashedDivider: {
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E4',
    borderStyle: 'dashed',
    marginVertical: 8
  },
  sheetFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEEEEE',
    paddingTop: 14,
    gap: 8
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#777777',
    letterSpacing: 0.5
  }
});

