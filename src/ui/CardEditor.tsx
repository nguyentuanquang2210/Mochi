import React, { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
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
import { ImagePickerSection } from './components/ImagePickerSection';
import { MultiSenseSelector } from './components/MultiSenseSelector';
import type { CardSummary, Deck } from '../domain/types';
import { CardRepository } from '../data/repositories';
import { DictionaryService, AggregatedWordEntry } from '../services/dictionary';
import { ImageSearchService } from '../services/imageSearch';
import type { ImageItem } from '../domain/types';

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
  const initialSides = (card ? card.content || `${card.front}\n---\n${card.back || ''}` : '').split(/\n\s*---\s*\n/);
  const [quickFront, setQuickFront] = useState((initialSides[0] || '').trim());
  const [quickBack, setQuickBack] = useState(initialSides.slice(1).join('\n---\n').trim());
  const [showAdvancedEditor, setShowAdvancedEditor] = useState(Boolean(card));
  const [tagsInput, setTagsInput] = useState(card ? card.tags.join(' ') : '');
  const [isPinned, setIsPinned] = useState(card ? card.isPinned : false);
  const [reviewReverse, setReviewReverse] = useState(card ? card.reviewReverse : false);
  const [saving, setSaving] = useState(false);
  const [showDeckPicker, setShowDeckPicker] = useState(false);
  const [dictionaryEntry, setDictionaryEntry] = useState<AggregatedWordEntry | null>(null);
  const [selectedSenseIds, setSelectedSenseIds] = useState<Set<string>>(new Set());
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionImages, setSuggestionImages] = useState<ImageItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(
    card?.imageUrl ? { id: 'current', url: card.imageUrl, thumbnailUrl: card.thumbnailUrl || card.imageUrl, source: 'wikimedia' } : null
  );
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setIsKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Parse sides live for preview
  const previewSides = content
    .split(/\n\s*---\s*\n/)
    .map(s => s.trim())
    .filter(Boolean);

  const updateQuickFront = (value: string) => {
    setQuickFront(value);
    setContent(`${value}\n---\n${quickBack}`.trimEnd());
  };
  const updateQuickBack = (value: string) => {
    setQuickBack(value);
    setContent(`${quickFront}\n---\n${value}`.trimEnd());
  };

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

  const loadWordSuggestions = async () => {
    const word = previewSides[0] || '';
    const validation = DictionaryService.validateSingleWord(word);
    if (!validation.isValid) {
      Alert.alert('Gợi ý từ điển dành cho một từ', 'Bạn vẫn có thể lưu và học cụm từ hoặc đoạn tiếng Anh bình thường. Tính năng gợi ý nghĩa/câu ví dụ tự động hiện chỉ dùng khi mặt trước là một từ tiếng Anh.');
      return;
    }
    setSuggestionsLoading(true);
    try {
      const [entry, images] = await Promise.all([
        DictionaryService.lookupAggregatedWord(validation.cleanWord),
        ImageSearchService.searchImages(validation.cleanWord, previewSides[1] || '')
      ]);
      setDictionaryEntry(entry);
      const translated = entry.senses.filter(s => Boolean(s.meaningVi?.trim()));
      const matching = translated.filter(s => (previewSides[1] || '').toLowerCase().includes(s.meaningVi.toLowerCase()));
      setSelectedSenseIds(new Set((matching.length ? matching : translated.slice(0, 1)).map(s => s.id)));
      setSuggestionImages(images);
    } catch {
      Alert.alert('Chưa có gợi ý', 'Không thể tải từ điển hoặc ảnh lúc này. Bạn vẫn có thể tự nhập nội dung thẻ.');
    } finally { setSuggestionsLoading(false); }
  };

  const insertSelectedSenses = () => {
    const selected = dictionaryEntry?.senses.filter(s => selectedSenseIds.has(s.id)) || [];
    if (!selected.length) return;
    const hidden = DictionaryService.formatHiddenSideFromSenses(selected);
    setContent(prev => {
      const sides = prev.split(/\n\s*---\s*\n/);
      const front = (sides[0] || '').trim();
      return `${front}\n---\n${hidden}`;
    });
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
            ipaUs = DictionaryService.formatIpa(dictInfo.ipaUs) || null;
            ipaUk = DictionaryService.formatIpa(dictInfo.ipaUk) || null;
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
          ipaUk: ipaUk || card.ipaUk,
          imageUrl: selectedImage?.url || null,
          thumbnailUrl: selectedImage?.thumbnailUrl || null
        });
      } else {
        await CardRepository.create({
          deckId: selectedDeckId,
          content,
          tags,
          isPinned,
          reviewReverse,
          ipaUs,
          ipaUk,
          imageUrl: selectedImage?.url || null,
          thumbnailUrl: selectedImage?.thumbnailUrl || null
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

      {/* Formatting tools disappear temporarily while typing to preserve space. */}
      {!isKeyboardVisible && <View style={styles.toolbar}>
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
      </View>}

      <ScrollView
        contentContainerStyle={[styles.editorScroll, isKeyboardVisible && styles.editorScrollTyping]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Fast, keyboard-friendly form for new cards. Markdown remains optional. */}
        {!showAdvancedEditor ? <>
          <View style={styles.quickEditorIntro}>
            <Text style={styles.quickEditorTitle}>Thêm từ mới</Text>
            <Text style={styles.quickEditorSubtitle}>Nhập từ và nghĩa — không cần dùng dấu ---</Text>
          </View>
          <Text style={styles.quickLabel}>TỪ TIẾNG ANH</Text>
          <TextInput
            style={styles.quickFrontInput}
            placeholder="Ví dụ: purchase / make a purchase / A short English sentence"
            placeholderTextColor="#94A3B8"
            value={quickFront}
            onChangeText={updateQuickFront}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="next"
          />
          <Text style={styles.quickLabel}>NGHĨA / CÂU VÍ DỤ</Text>
          <TextInput
            style={[styles.quickBackInput, isKeyboardVisible && styles.quickBackInputTyping]}
            placeholder={'Ví dụ: mua hàng\n\n📝 I purchased a new book.\n(Tôi đã mua một cuốn sách mới.)'}
            placeholderTextColor="#94A3B8"
            value={quickBack}
            onChangeText={updateQuickBack}
            multiline
            textAlignVertical="top"
          />
          {!isKeyboardVisible && <TouchableOpacity style={styles.advancedLink} onPress={() => setShowAdvancedEditor(true)}>
            <Feather name="code" size={14} color="#64748B" style={{ marginRight: 5 }} />
            <Text style={styles.advancedLinkText}>Dùng Markdown / thêm nhiều mặt thẻ</Text>
          </TouchableOpacity>}
        </> : <>
        <View style={styles.editorLabelRow}>
          <Text style={styles.sectionLabel}>NỘI DUNG THẺ (MARKDOWN)</Text>
          {isKeyboardVisible && (
            <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.hideKeyboardBtn}>
              <Feather name="chevron-down" size={15} color="#475569" />
              <Text style={styles.hideKeyboardText}>Xong</Text>
            </TouchableOpacity>
          )}
        </View>
        <TextInput
          style={[styles.contentInput, isKeyboardVisible && styles.contentInputTyping]}
          multiline
          placeholder="Nhập câu hỏi hoặc mặt trước thẻ...&#10;---&#10;Nhập đáp án (mặt ẩn tiếp theo)..."
          placeholderTextColor="#9E9E9E"
          value={content}
          onChangeText={setContent}
          autoFocus={false}
        />
        </>}

        {!isKeyboardVisible && <TouchableOpacity
          style={[styles.suggestionBtn, suggestionsLoading && { opacity: 0.55 }]}
          disabled={suggestionsLoading}
          onPress={loadWordSuggestions}
        >
          <Ionicons name="sparkles-outline" size={17} color="#FFFFFF" style={{ marginRight: 7 }} />
          <Text style={styles.suggestionBtnText}>{suggestionsLoading ? 'Đang tìm nghĩa, ví dụ & ảnh...' : 'Gợi ý cho 1 từ: nghĩa, ví dụ & ảnh'}</Text>
        </TouchableOpacity>}

        {!isKeyboardVisible && dictionaryEntry && (
          <>
            <MultiSenseSelector
              senses={dictionaryEntry.senses}
              selectedSenseIds={selectedSenseIds}
              onToggleSense={(senseId) => setSelectedSenseIds(prev => { const next = new Set(prev); next.has(senseId) ? next.delete(senseId) : next.add(senseId); return next; })}
              onSelectAll={() => setSelectedSenseIds(new Set(dictionaryEntry.senses.filter(s => Boolean(s.meaningVi?.trim())).map(s => s.id)))}
              onDeselectAll={() => setSelectedSenseIds(new Set())}
              sources={dictionaryEntry.sources}
            />
            <TouchableOpacity style={styles.insertExamplesBtn} onPress={insertSelectedSenses}>
              <Feather name="plus-circle" size={16} color="#1D4ED8" style={{ marginRight: 7 }} />
              <Text style={styles.insertExamplesText}>Chèn nghĩa và câu ví dụ đã chọn</Text>
            </TouchableOpacity>
          </>
        )}

        {!isKeyboardVisible && <ImagePickerSection
          images={suggestionImages}
          selectedImageUrl={selectedImage?.url || null}
          loading={suggestionsLoading}
          onSelectImage={setSelectedImage}
          onRetrySearch={loadWordSuggestions}
        />}

        {/* Live Sides Preview */}
        {!isKeyboardVisible && previewSides.length > 0 && (
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
                  {index === 0 && <SpeakerButton text={side} size={15} />}
                </View>
                <Text style={styles.sideText}>{side}</Text>
              </View>
            ))}
          </View>
        )}

        {!isKeyboardVisible && <>
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
        </>}

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
  editorScrollTyping: {
    paddingTop: 10,
    paddingBottom: 12
  },
  editorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8
  },
  quickEditorIntro: {
    padding: 14,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginBottom: 16
  },
  quickEditorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E3A8A'
  },
  quickEditorSubtitle: {
    fontSize: 13,
    color: '#475569',
    marginTop: 3
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: '#64748B',
    marginBottom: 7,
    marginTop: 12
  },
  quickFrontInput: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A'
  },
  quickBackInput: {
    minHeight: 150,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    lineHeight: 24,
    color: '#0F172A'
  },
  quickBackInputTyping: {
    minHeight: 250,
    borderColor: '#2563EB'
  },
  advancedLink: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    paddingVertical: 12
  },
  advancedLinkText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600'
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
  contentInputTyping: {
    minHeight: 220,
    fontSize: 17,
    lineHeight: 26,
    borderColor: '#93C5FD'
  },
  hideKeyboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9'
  },
  hideKeyboardText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginLeft: 3
  },
  suggestionBtn: {
    marginTop: 10,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    minHeight: 42,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  suggestionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  insertExamplesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 2
  },
  insertExamplesText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700'
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

