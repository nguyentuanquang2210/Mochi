import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from './Icons';

interface CreateActionSheetModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectNewCard: () => void;
  onSelectNewDiagramCard: () => void;
  onSelectNewDeck: () => void;
}

export function CreateActionSheetModal({
  visible,
  onClose,
  onSelectNewCard,
  onSelectNewDiagramCard,
  onSelectNewDeck
}: CreateActionSheetModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              {/* Option 1: New Card */}
              <TouchableOpacity
                style={styles.optionRow}
                activeOpacity={0.7}
                onPress={() => {
                  onClose();
                  onSelectNewCard();
                }}
              >
                <View style={styles.iconSlot}>
                  <MaterialCommunityIcons name="card-text-outline" size={24} color="#333333" />
                </View>
                <View style={styles.textColumn}>
                  <Text style={styles.titleText}>New Card</Text>
                  <Text style={styles.subtitleText}>Create a new note or flash card.</Text>
                </View>
              </TouchableOpacity>

              {/* Option 2: New Diagram card */}
              <TouchableOpacity
                style={styles.optionRow}
                activeOpacity={0.7}
                onPress={() => {
                  onClose();
                  onSelectNewDiagramCard();
                }}
              >
                <View style={styles.iconSlot}>
                  <MaterialCommunityIcons name="card-multiple-outline" size={24} color="#333333" />
                </View>
                <View style={styles.textColumn}>
                  <Text style={styles.titleText}>New Diagram card</Text>
                  <Text style={styles.subtitleText}>Hide and reveal parts of an image.</Text>
                </View>
              </TouchableOpacity>

              {/* Option 3: New Deck */}
              <TouchableOpacity
                style={styles.optionRow}
                activeOpacity={0.7}
                onPress={() => {
                  onClose();
                  onSelectNewDeck();
                }}
              >
                <View style={styles.iconSlot}>
                  <Ionicons name="folder-sharp" size={22} color="#555555" />
                </View>
                <View style={styles.textColumn}>
                  <Text style={styles.titleText}>New Deck</Text>
                  <Text style={styles.subtitleText}>Organize your cards with decks.</Text>
                </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    paddingBottom: 20,
    paddingHorizontal: 12
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14
  },
  iconSlot: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 10
  },
  textColumn: {
    flex: 1
  },
  titleText: {
    fontSize: 16.5,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 3
  },
  subtitleText: {
    fontSize: 13,
    color: '#777777',
    lineHeight: 18
  }
});

