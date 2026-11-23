import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
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

  // Tách các mặt thẻ thành mảng có cấu trúc rõ ràng thay vì chuỗi Markdown thô
  const [sides, setSides] = useState<string[]>(() => {
    if (!card) return ['', ''];
    const raw = card.content || `${card.front}\n---\n${card.back || ''}`;
    const parsed = raw.split(/\n\s*---\s*\n/).map(s => s.trim());
    return parsed.length >= 2 ? parsed : [parsed[0] || card.front || '', parsed[1] || card.back || ''];
  });

  const [isRawMarkdown, setIsRawMarkdown] = useState(false);
  const [rawContent, setRawContent] = useState(
    card ? card.content || (card.back ? `${card.front}\n---\n${card.back}` : card.front) : ''
  );

  const [tagsInput, setTagsInput] = useState(card ? card.tags.join(' ') : '');
  const [isPinned, setIsPinned] = useState(card ? card.isPinned : false);
  const [reviewReverse, setReviewReverse] = useState(card ? card.reviewReverse : false);
  const [saving, setSaving] = useState(false);
  const [showDeckPickerModal, setShowDeckPickerModal] = useState(false);

  // Phiên âm IPA động
  const [liveIpa, setLiveIpa] = useState<{ us?: string | null; uk?: string | null }>({
    us: card?.ipaUs || null,
    uk: card?.ipaUk || null
  });

  // Dictionary suggestions & illustration
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

  // Tự động tra cứu phiên âm khi sửa từ ở mặt trước
  useEffect(() => {
    const word = (sides[0] || '').trim().toLowerCase();
    if (!word) {
      if (!card?.ipaUs && !card?.ipaUk) {
        setLiveIpa({ us: null, uk: null });
      }
      return;
    }
    const val = DictionaryService.validateSingleWord(word);
    if (val.isValid) {
      DictionaryService.lookupWord(val.cleanWord).then(info => {
        if (info.verified) {
          setLiveIpa({
            us: DictionaryService.formatIpa(info.ipaUs),
            uk: DictionaryService.formatIpa(info.ipaUk)
          });
        }
      }).catch(() => {});
    }
  }, [sides[0]]);

  const updateSide = (index: number, value: string) => {
    setSides(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addSide = () => {
    setSides(prev => [...prev, '']);
  };

  const removeSide = (index: number) => {
    if (sides.length <= 2) {
      Alert.alert('Lưu ý', 'Thẻ cần có ít nhất mặt trước và một mặt ẩn.');
      return;
    }
    setSides(prev => prev.filter((_, i) => i !== index));
  };

  const toggleRawMarkdownMode = () => {
    if (!isRawMarkdown) {
      // Chuyển từ structured sang raw markdown
      const compiled = sides.map(s => s.trim()).filter((s, idx) => idx === 0 || s.length > 0).join('\n---\n');
      setRawContent(compiled);
      setIsRawMarkdown(true);
    } else {
      // Chuyển từ raw markdown về structured
      const parsed = rawContent.split(/\n\s*---\s*\n/).map(s => s.trim());
      setSides(parsed.length >= 2 ? parsed : [parsed[0] || '', parsed[1] || '']);
      setIsRawMarkdown(false);
    }
  };

  const loadWordSuggestions = async () => {
    const word = (sides[0] || '').trim();
    if (!word) {
      Alert.alert('Chưa có từ', 'Vui lòng nhập từ tiếng Anh ở Mặt 1 để tra cứu gợi ý.');
      return;
    }
    const validation = DictionaryService.validateSingleWord(word);
    if (!validation.isValid) {
      Alert.alert(
        'Gợi ý từ điển dành cho một từ',
        'Tính năng gợi ý nghĩa và ảnh tự động chỉ áp dụng khi mặt trước là một từ tiếng Anh đơn lẻ.'
      );
      return;
    }
    setSuggestionsLoading(true);
    try {
      const [entry, images] = await Promise.all([
        DictionaryService.lookupAggregatedWord(validation.cleanWord),
        ImageSearchService.searchImages(validation.cleanWord, sides[1] || '')
      ]);
      setDictionaryEntry(entry);
      const translated = entry.senses.filter(s => Boolean(s.meaningVi?.trim()));
      const matching = translated.filter(s => (sides[1] || '').toLowerCase().includes(s.meaningVi.toLowerCase()));
      setSelectedSenseIds(new Set((matching.length ? matching : translated.slice(0, 1)).map(s => s.id)));
      setSuggestionImages(images);
    } catch {
      Alert.alert('Chưa có gợi ý', 'Không thể kết nối từ điển hoặc tìm ảnh lúc này. Bạn vẫn có thể tự nhập nội dung thẻ.');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const insertSelectedSenses = () => {
    const selected = dictionaryEntry?.senses.filter(s => selectedSenseIds.has(s.id)) || [];
    if (!selected.length) return;
    const hiddenFormatted = DictionaryService.formatHiddenSideFromSenses(selected);

    // Chèn vào mặt ẩn 1 (sides[1]) hoặc ghép thêm vào nếu đã có nội dung
    setSides(prev => {
      const next = [...prev];
      if (!next[1]?.trim()) {
        next[1] = hiddenFormatted;
      } else {
        next[1] = `${next[1]}\n\n${hiddenFormatted}`;
      }
      return next;
    });
    Alert.alert('Đã chèn', 'Đã thêm nghĩa và ví dụ vào Mặt ẩn 1 thành công!');
  };

  const handleSave = async () => {
    const frontText = (isRawMarkdown ? rawContent.split(/\n\s*---\s*\n/)[0] : sides[0])?.trim() || '';
    if (!frontText) {
      Alert.alert('Mặt trước trống', 'Vui lòng nhập nội dung cho mặt trước của thẻ.');
      return;
    }

    const cleanSides = sides.map(s => s.trim()).filter((s, idx) => idx === 0 || s.length > 0);
    const finalContent = isRawMarkdown ? rawContent.trim() : cleanSides.join('\n---\n');

    setSaving(true);
    try {
      const tags = tagsInput
        .split(/[\s,]+/)
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      let ipaUs: string | null = liveIpa.us || null;
      let ipaUk: string | null = liveIpa.uk || null;

      if (!ipaUs && !ipaUk) {
        const val = DictionaryService.validateSingleWord(frontText);
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
          content: finalContent,
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
          content: finalContent,
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

  const currentDeckName = decks.find(d => d.id === selectedDeckId)?.name || 'Bộ thẻ';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.cancelBtnText}>Hủy</Text>
        </TouchableOpacity>

        {/* Deck Selector Button */}
        <TouchableOpacity
          style={styles.deckSelectorBtn}
          onPress={() => setShowDeckPickerModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="folder-sharp" size={14} color="#444444" style={{ marginRight: 6 }} />
          <Text numberOfLines={1} style={styles.deckSelectorText}>{currentDeckName}</Text>
          <Feather name="chevron-down" size={13} color="#666666" style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          disabled={saving}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Đang lưu...' : 'Lưu'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.editorScroll, isKeyboardVisible && styles.editorScrollTyping]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Title bar with quick mode switch */}
        <View style={styles.topInfoBar}>
          <Text style={styles.screenHeading}>
            {card ? 'Chỉnh sửa thẻ' : 'Tạo thẻ mới'}
          </Text>
          <TouchableOpacity
            style={styles.modeToggleBtn}
            onPress={toggleRawMarkdownMode}
            activeOpacity={0.7}
          >
            <Feather name={isRawMarkdown ? 'layers' : 'code'} size={13} color="#444444" style={{ marginRight: 4 }} />
            <Text style={styles.modeToggleText}>
              {isRawMarkdown ? 'Chế độ từng mặt' : 'Markdown thô'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ============================================================== */}
        {/* STRUCTURED MULTI-SIDE CARD EDITOR (THE CLEAN, INTUITIVE LOGIC) */}
        {/* ============================================================== */}
        {!isRawMarkdown ? (
          <>
            {/* FRONT SIDE (MẶT 1 - TỪ TIẾNG ANH / CÂU HỎI) */}
            <View style={styles.sideCardBox}>
              <View style={styles.sideCardHeader}>
                <View style={styles.sideBadge}>
                  <Text style={styles.sideBadgeText}>MẶT 1 · MẶT TRƯỚC (CÂU HỎI / TỪ VỰNG)</Text>
                </View>

                {/* Auto Suggestion Button */}
                <TouchableOpacity
                  style={[styles.quickDictBtn, suggestionsLoading && { opacity: 0.6 }]}
                  disabled={suggestionsLoading}
                  onPress={loadWordSuggestions}
                  activeOpacity={0.7}
                >
                  <Ionicons name="sparkles" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.quickDictBtnText}>
                    {suggestionsLoading ? 'Đang tìm...' : 'Gợi ý từ điển & ảnh'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.frontInput}
                placeholder="Nhập từ tiếng Anh (ví dụ: purchase, accomplish...)"
                placeholderTextColor="#94A3B8"
                value={sides[0] || ''}
                onChangeText={(text) => updateSide(0, text)}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />

              {/* Pronunciation & Speaker preview */}
              {((sides[0] || '').trim().length > 0) && (
                <View style={styles.ipaRow}>
                  <SpeakerButton text={sides[0]} size={16} />
                  <View style={styles.ipaTextContainer}>
                    {liveIpa.us ? (
                      <Text style={styles.ipaText}>
                        <Text style={{ fontWeight: '600', color: '#64748B' }}>US:</Text> {liveIpa.us}
                      </Text>
                    ) : null}
                    {liveIpa.uk ? (
                      <Text style={[styles.ipaText, { marginLeft: 8 }]}>
                        <Text style={{ fontWeight: '600', color: '#64748B' }}>UK:</Text> {liveIpa.uk}
                      </Text>
                    ) : null}
                    {!liveIpa.us && !liveIpa.uk && (
                      <Text style={styles.ipaHint}>Chạm vào loa để nghe phát âm</Text>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* HIDDEN SIDES (MẶT ẨN 1, 2, 3...) */}
            {sides.slice(1).map((sideText, idx) => {
              const sideIndex = idx + 1;
              const isFirstHidden = sideIndex === 1;
              return (
                <View key={sideIndex} style={styles.sideCardBox}>
                  <View style={styles.sideCardHeader}>
                    <View style={styles.sideBadge}>
                      <Text style={styles.sideBadgeText}>
                        {isFirstHidden ? 'MẶT ẨN 1 · NGHĨA & GIẢI THÍCH' : `MẶT ẨN ${sideIndex} · CÂU VÍ DỤ / NGỮ CẢNH`}
                      </Text>
                    </View>

                    {/* Delete side button (when 2 or more hidden sides) */}
                    {sides.length > 2 && (
                      <TouchableOpacity
                        style={styles.deleteSideBtn}
                        onPress={() => removeSide(sideIndex)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="trash-2" size={14} color="#666666" />
                        <Text style={styles.deleteSideText}>Xóa mặt này</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <TextInput
                    style={styles.backInput}
                    placeholder={
                      isFirstHidden
                        ? 'Ví dụ: mua, tậu\n• to buy something'
                        : 'Ví dụ: She purchased a new car yesterday.\n(Cô ấy đã mua một chiếc xe mới hôm qua.)'
                    }
                    placeholderTextColor="#94A3B8"
                    value={sideText}
                    onChangeText={(text) => updateSide(sideIndex, text)}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              );
            })}

            {/* Button "+ Thêm mặt ẩn tiếp theo" */}
            <TouchableOpacity style={styles.addSideBtn} onPress={addSide} activeOpacity={0.7}>
              <Feather name="plus-circle" size={16} color="#262626" style={{ marginRight: 6 }} />
              <Text style={styles.addSideBtnText}>
                Thêm mặt ẩn tiếp theo (Mặt {sides.length + 1})
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          /* ============================================================== */
          /* RAW MARKDOWN MODE (FOR ADVANCED USERS) */
          /* ============================================================== */
          <View style={styles.rawMarkdownContainer}>
            <View style={styles.rawMarkdownHeader}>
              <Text style={styles.rawMarkdownLabel}>NỘI DUNG MARKDOWN (--- NGĂN CÁCH CÁC MẶT)</Text>
              {isKeyboardVisible && (
                <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.hideKeyboardBtn}>
                  <Feather name="chevron-down" size={14} color="#475569" />
                  <Text style={styles.hideKeyboardText}>Ẩn phím</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={styles.rawContentInput}
              multiline
              placeholder="Mặt trước từ vựng...&#10;---&#10;Mặt ẩn 1 (Nghĩa)...&#10;---&#10;Mặt ẩn 2 (Ví dụ)..."
              placeholderTextColor="#94A3B8"
              value={rawContent}
              onChangeText={setRawContent}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Selected Illustration Image Box */}
        {selectedImage && (
          <View style={styles.selectedImageBox}>
            <Image
              source={{ uri: selectedImage.thumbnailUrl || selectedImage.url }}
              style={styles.selectedImageThumb}
              resizeMode="cover"
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.selectedImageTitle} numberOfLines={1}>Ảnh minh họa của thẻ</Text>
              <Text style={styles.selectedImageSub}>Nguồn: Wikimedia Commons</Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedImage(null)}
              style={styles.removeImageBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="trash-2" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}

        {/* Multi-sense dictionary selection result */}
        {dictionaryEntry && (
          <View style={styles.dictEntryCard}>
            <MultiSenseSelector
              senses={dictionaryEntry.senses}
              selectedSenseIds={selectedSenseIds}
              onToggleSense={(senseId) => setSelectedSenseIds(prev => {
                const next = new Set(prev);
                next.has(senseId) ? next.delete(senseId) : next.add(senseId);
                return next;
              })}
              onSelectAll={() => setSelectedSenseIds(new Set(dictionaryEntry.senses.filter(s => Boolean(s.meaningVi?.trim())).map(s => s.id)))}
              onDeselectAll={() => setSelectedSenseIds(new Set())}
              sources={dictionaryEntry.sources}
            />
            <TouchableOpacity style={styles.insertSensesBtn} onPress={insertSelectedSenses} activeOpacity={0.8}>
              <Feather name="plus-circle" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.insertSensesBtnText}>Chèn các nghĩa & ví dụ đã chọn vào Mặt ẩn 1</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Image picker suggestions from Wikimedia */}
        {suggestionImages.length > 0 && (
          <ImagePickerSection
            images={suggestionImages}
            selectedImageUrl={selectedImage?.url || null}
            loading={suggestionsLoading}
            onSelectImage={setSelectedImage}
            onRetrySearch={loadWordSuggestions}
          />
        )}

        {/* ============================================================== */}
        {/* CARD SETTINGS & METADATA (DECK, TAGS, PIN, REVERSE) */}
        {/* ============================================================== */}
        <View style={styles.metaCard}>
          <Text style={styles.metaCardHeading}>CÀI ĐẶT THẺ</Text>

          {/* Current Deck Row */}
          <TouchableOpacity
            style={styles.metaRow}
            onPress={() => setShowDeckPickerModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.metaRowLeft}>
              <Ionicons name="folder-outline" size={17} color="#444444" style={{ marginRight: 10 }} />
              <Text style={styles.metaRowTitle}>Bộ thẻ chứa từ này</Text>
            </View>
            <View style={styles.metaRowRight}>
              <Text style={styles.metaRowValue}>{currentDeckName}</Text>
              <Feather name="chevron-right" size={14} color="#94A3B8" style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Tags Input */}
          <View style={styles.tagRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Feather name="hash" size={14} color="#64748B" style={{ marginRight: 6 }} />
              <Text style={styles.tagRowLabel}>Thẻ phân loại (Tags)</Text>
            </View>
            <TextInput
              style={styles.tagInput}
              placeholder="toeic #b2 #kinhte..."
              placeholderTextColor="#94A3B8"
              value={tagsInput}
              onChangeText={setTagsInput}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.divider} />

          {/* Pin Card Toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <MaterialCommunityIcons name="pin-outline" size={18} color="#475569" style={{ marginRight: 10 }} />
              <Text style={styles.toggleTitle}>Ghim thẻ lên đầu danh sách</Text>
            </View>
            <Switch
              value={isPinned}
              onValueChange={setIsPinned}
              trackColor={{ false: '#E0E0E0', true: '#262626' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          {/* Review Reverse Toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Ionicons name="swap-vertical" size={18} color="#475569" style={{ marginRight: 10 }} />
              <Text style={styles.toggleTitle}>Ôn tập đảo chiều (Mặt sau làm câu hỏi)</Text>
            </View>
            <Switch
              value={reviewReverse}
              onValueChange={setReviewReverse}
              trackColor={{ false: '#E0E0E0', true: '#262626' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* MODAL CHỌN BỘ THẺ */}
      <Modal
        visible={showDeckPickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeckPickerModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowDeckPickerModal(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.deckModalSheet}>
                <View style={styles.deckModalHeader}>
                  <Text style={styles.deckModalTitle}>Chọn bộ thẻ</Text>
                  <TouchableOpacity
                    style={styles.deckModalCloseBtn}
                    onPress={() => setShowDeckPickerModal(false)}
                  >
                    <Feather name="x" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 350 }}>
                  {decks.map(d => {
                    const isSelected = selectedDeckId === d.id;
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={[styles.deckModalItem, isSelected && styles.deckModalItemActive]}
                        onPress={() => {
                          setSelectedDeckId(d.id);
                          setShowDeckPickerModal(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="folder-sharp"
                          size={18}
                          color={isSelected ? '#262626' : '#64748B'}
                          style={{ marginRight: 10 }}
                        />
                        <Text style={[styles.deckModalItemText, isSelected && styles.deckModalItemTextActive]}>
                          {d.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={18} color="#262626" style={{ marginLeft: 'auto' }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0'
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4
  },
  cancelBtnText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500'
  },
  deckSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: 180,
    borderWidth: 1,
    borderColor: '#E5E5E5'
  },
  deckSelectorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222222'
  },
  saveBtn: {
    backgroundColor: '#262626',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  editorScroll: {
    padding: 16,
    paddingBottom: 40
  },
  editorScrollTyping: {
    paddingTop: 10
  },
  topInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  screenHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222222'
  },
  modeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5'
  },
  modeToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333'
  },
  // Structured Side Cards
  sideCardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  sideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  sideBadge: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  sideBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#555555',
    letterSpacing: 0.5
  },
  quickDictBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6
  },
  quickDictBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  frontInput: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D4D4D4',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#222222'
  },
  ipaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4
  },
  ipaTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    flexWrap: 'wrap'
  },
  ipaText: {
    fontSize: 13,
    color: '#333333',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },
  ipaHint: {
    fontSize: 12,
    color: '#888888'
  },
  backInput: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 100,
    fontSize: 15,
    lineHeight: 22,
    color: '#222222'
  },
  deleteSideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  deleteSideText: {
    fontSize: 11.5,
    color: '#666666',
    fontWeight: '600'
  },
  addSideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    borderStyle: 'dashed',
    marginBottom: 14
  },
  addSideBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#262626'
  },
  // Raw markdown mode
  rawMarkdownContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5'
  },
  rawMarkdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  rawMarkdownLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666666',
    letterSpacing: 0.5
  },
  hideKeyboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 6
  },
  hideKeyboardText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569'
  },
  rawContentInput: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D4D4D4',
    padding: 14,
    minHeight: 200,
    fontSize: 15,
    lineHeight: 24,
    color: '#222222'
  },
  // Image box
  selectedImageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5'
  },
  selectedImageThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F5F5F5'
  },
  selectedImageTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#222222'
  },
  selectedImageSub: {
    fontSize: 11.5,
    color: '#666666',
    marginTop: 2
  },
  removeImageBtn: {
    padding: 8
  },
  // Dict entry result card
  dictEntryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5'
  },
  insertSensesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#262626',
    borderRadius: 9,
    paddingVertical: 10,
    marginTop: 10
  },
  insertSensesBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600'
  },
  // Metadata Card
  metaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  metaCardHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666666',
    letterSpacing: 0.7,
    marginBottom: 12
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  metaRowLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  metaRowTitle: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#222222'
  },
  metaRowRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  metaRowValue: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#222222'
  },
  tagRow: {
    paddingVertical: 4
  },
  tagRowLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#222222'
  },
  tagInput: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingHorizontal: 10,
    height: 38,
    fontSize: 13,
    color: '#222222'
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  toggleTitle: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#222222'
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10
  },
  // Deck picker modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: 24
  },
  deckModalSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8
  },
  deckModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  deckModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222222'
  },
  deckModalCloseBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#F1F5F9'
  },
  deckModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4
  },
  deckModalItemActive: {
    backgroundColor: '#F0F0F0'
  },
  deckModalItemText: {
    fontSize: 14,
    color: '#444444'
  },
  deckModalItemTextActive: {
    fontWeight: '700',
    color: '#111111'
  }
});
