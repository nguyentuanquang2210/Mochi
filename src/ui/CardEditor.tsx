import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from './components/Icons';
import { SpeakerButton } from './components/SpeakerButton';
import type { CardSummary, Deck } from '../domain/types';
import { CardRepository } from '../data/repositories';
import { DictionaryService } from '../services/dictionary';

interface CardEditorProps {
  card?: CardSummary | null;
  decks: Deck[];
  currentDeckId: string;
  onSave: () => void;
  onCancel: () => void;
}

export function CardEditor({
  card,
  decks,
  currentDeckId,
  onSave,
  onCancel
}: CardEditorProps) {
  const [selectedDeckId, setSelectedDeckId] = useState(card?.deckId || currentDeckId || decks[0]?.id || '');
  const [content, setContent] = useState(
    card ? card.content || (card.back ? `${card.front}\n---\n${card.back}` : card.front) : ''
  );
  const [tagsInput, setTagsInput] = useState(card ? card.tags.join(' ') : '');
  const [isPinned, setIsPinned] = useState(card ? card.isPinned : false);
  const [reviewReverse, setReviewReverse] = useState(card ? card.reviewReverse : false);
  const [saving, setSaving] = useState(false);
  const [showDeckPicker, setShowDeckPicker] = useState(false);

  // Parse sides live for preview
  const previewSides = content
    .split(/\n\s*---\s*\n/)
    .map(s => s.trim())
    .filter(Boolean);

  const insertHelper = (syntax: string) => {
    if (syntax === '---') {
      setContent(prev => (prev.endsWith('\n') ? `${prev}---\n` : `${prev}\n---\n`));
    } else if (syntax === 'cloze') {
      setContent(prev => `${prev}<<cloze>>`);
    } else if (syntax === 'bold') {
      setContent(prev => `${prev}**bold text**`);
    } else if (syntax === 'link') {
      setContent(prev => `${prev}[[Linked Card]]`);
    } else if (syntax === 'tag') {
      setTagsInput(prev => `${prev} #`);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Nội dung trống', 'Vui lòng nhập nội dung cho thẻ của bạn.');
      return;
    }
    setSaving(true);
    try {
      const tags = tagsInput
        .split(/[\s,]+/)
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const sides = content.split(/\n\s*---\s*\n/).map(s => s.trim()).filter(Boolean);
      const front = sides[0] || '';
      let ipaUs: string | null = null;
      let ipaUk: string | null = null;

      if (front) {
        const val = DictionaryService.validateSingleWord(front);
        if (val.isValid) {
          const dictInfo = await DictionaryService.lookupWord(val.cleanWord);
          if (dictInfo.verified) {
            ipaUs = dictInfo.ipaUs || null;
            ipaUk = dictInfo.ipaUk || null;
          }
        }
      }

      if (card) {
        await CardRepository.update(card.id, {
          deckId: selectedDeckId,
          content,
          tags,
          isPinned,
          reviewReverse,
          ipaUs: ipaUs || card.ipaUs,
          ipaUk: ipaUk || card.ipaUk
        });
      } else {
        await CardRepository.create({
          deckId: selectedDeckId,
          content,
          tags,
          isPinned,
          reviewReverse,
          ipaUs,
          ipaUk
        });
      }
      onSave();
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể lưu thẻ.');
    } finally {
      setSaving(false);
    }
  };

  const currentDeckName = decks.find(d => d.id === selectedDeckId)?.name || 'Chọn bộ thẻ';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>Hủy</Text>
        </TouchableOpacity>

        {/* Deck dropdown button */}
        <TouchableOpacity
          style={styles.deckSelectorBtn}
          onPress={() => setShowDeckPicker(!showDeckPicker)}
        >
          <Ionicons name="folder-sharp" size={14} color="#555555" style={{ marginRight: 5 }} />
          <Text numberOfLines={1} style={styles.deckSelectorText}>{currentDeckName}</Text>
          <Feather name="chevron-down" size={14} color="#666666" style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          disabled={saving}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Đang lưu...' : 'Lưu'}</Text>
        </TouchableOpacity>
      </View>

      {/* Deck Picker Dropdown */}
      {showDeckPicker && (
        <View style={styles.deckDropdownMenu}>
          {decks.map(d => (
            <TouchableOpacity
              key={d.id}
              style={[styles.deckDropdownItem, selectedDeckId === d.id && styles.deckDropdownItemActive]}
              onPress={() => {
                setSelectedDeckId(d.id);
                setShowDeckPicker(false);
              }}
            >
              <Text style={[styles.deckDropdownItemText, selectedDeckId === d.id && styles.deckDropdownItemTextActive]}>
                {d.name}
              </Text>
              {selectedDeckId === d.id && <Feather name="check" size={15} color="#222" />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Formatting Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolBtn} onPress={() => insertHelper('---')}>
          <Text style={styles.toolBtnText}>+ Thêm mặt (---)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={() => insertHelper('cloze')}>
          <Text style={styles.toolBtnText}>{'<<ẩn chữ>>'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={() => insertHelper('bold')}>
          <Text style={styles.toolBtnText}>**Đậm**</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={() => insertHelper('link')}>
          <Text style={styles.toolBtnText}>[[Liên kết]]</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={() => insertHelper('tag')}>
          <Text style={styles.toolBtnText}>#Tag</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.editorScroll} showsVerticalScrollIndicator={false}>
        {/* Editor Area */}
        <Text style={styles.sectionLabel}>GHI CHÚ & NỘI DUNG THẺ (MARKDOWN)</Text>
        <TextInput
          style={styles.contentInput}
          multiline
          placeholder="Nhập câu hỏi hoặc mặt trước thẻ...&#10;---&#10;Nhập đáp án (mặt ẩn tiếp theo)..."
          placeholderTextColor="#9E9E9E"
          value={content}
          onChangeText={setContent}
          autoFocus={!card}
        />

        {/* Live Sides Preview */}
        {previewSides.length > 0 && (
          <View style={styles.previewContainer}>
            <Text style={styles.previewHeading}>
              XEM TRƯỚC CÁC MẶT ({previewSides.length} MẶT)
            </Text>
            {previewSides.map((side, index) => (
              <View key={index} style={styles.previewSideBox}>
                <View style={styles.previewSideHeader}>
                  <Text style={styles.sideBadge}>
                    {index === 0 ? 'MẶT 1 (MẶT TRƯỚC)' : `MẶT ${index + 1} (MẶT ẨN)`}
                  </Text>
                  <SpeakerButton text={side} size={15} />
                </View>
                <Text style={styles.sideText}>{side}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Tags input */}
        <Text style={styles.sectionLabel}>THẺ PHÂN LOẠI (TAGS)</Text>
        <View style={styles.tagInputBox}>
          <Feather name="hash" size={16} color="#888888" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.tagTextInput}
            placeholder="tuvung #tienganh #nguphap"
            placeholderTextColor="#999999"
            value={tagsInput}
            onChangeText={setTagsInput}
            autoCapitalize="none"
          />
        </View>

        {/* Toggles */}
        <View style={styles.togglesCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <MaterialCommunityIcons name="pin-outline" size={18} color="#444444" style={{ marginRight: 10 }} />
              <Text style={styles.toggleTitle}>Ghim thẻ lên đầu danh sách</Text>
            </View>
            <Switch
              value={isPinned}
              onValueChange={setIsPinned}
              trackColor={{ false: '#E0E0E0', true: '#555555' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Ionicons name="swap-vertical" size={18} color="#444444" style={{ marginRight: 10 }} />
              <Text style={styles.toggleTitle}>Ôn tập đảo chiều (mặt sau làm câu hỏi)</Text>
            </View>
            <Switch
              value={reviewReverse}
              onValueChange={setReviewReverse}
              trackColor={{ false: '#E0E0E0', true: '#555555' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA'
  },
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
  cancelBtn: {
    padding: 6
  },
  cancelBtnText: {
    fontSize: 15,
    color: '#666666',
    fontWeight: '500'
  },
  deckSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: 160
  },
  deckSelectorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333'
  },
  saveBtn: {
    backgroundColor: '#262626',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  deckDropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E6E6E6',
    paddingHorizontal: 16,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3
  },
  deckDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  deckDropdownItemActive: {
    backgroundColor: '#F5F5F5'
  },
  deckDropdownItemText: {
    fontSize: 14,
    color: '#444444'
  },
  deckDropdownItemTextActive: {
    fontWeight: '700',
    color: '#111111'
  },
  toolbar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EAEAEA',
    gap: 8,
    flexWrap: 'wrap'
  },
  toolBtn: {
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6
  },
  toolBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444444'
  },
  editorScroll: {
    padding: 16
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8
  },
  contentInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 16,
    minHeight: 180,
    fontSize: 16,
    lineHeight: 24,
    color: '#222222',
    textAlignVertical: 'top'
  },
  previewContainer: {
    marginTop: 18
  },
  previewHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.8,
    marginBottom: 8
  },
  previewSideBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8
  },
  previewSideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  sideBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999999',
    letterSpacing: 0.6
  },
  sideText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333333'
  },
  tagInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16
  },
  tagTextInput: {
    flex: 1,
    fontSize: 14,
    color: '#222222',
    paddingVertical: 0
  },
  togglesCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 6
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333'
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0'
  }
});

