import React, { useRef, useState, useCallback } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from './Icons';
import { SpeakerButton } from './SpeakerButton';
import { AutocompleteDropdown } from './AutocompleteDropdown';
import { DictionaryService, SuggestionItem } from '../../services/dictionary';
import { CardRepository } from '../../data/repositories';
import { TOEIC_MAP } from '../../data/toeicWordlist';

interface QuickAddCardModalProps {
  visible: boolean;
  deckName: string;
  onClose: () => void;
  onSaveCard: (sides: string[], ipaUs?: string | null, ipaUk?: string | null) => Promise<void>;
}

export function QuickAddCardModal({
  visible,
  deckName,
  onClose,
  onSaveCard
}: QuickAddCardModalProps) {
  // sides[0] = Front, sides[1...] = Hidden sides
  const [sides, setSides] = useState<string[]>(['']);
  const [activeSideIndex, setActiveSideIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  // Autocomplete & IPA state
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIpaUs, setSelectedIpaUs] = useState<string | null>(null);
  const [selectedIpaUk, setSelectedIpaUk] = useState<string | null>(null);

  const debounceTimerRef = useRef<any>(null);
  // Index của mặt ẩn được auto-fill khi chọn gợi ý (để ẩn SpeakerButton)
  const autoFilledSideIndexRef = useRef<number | null>(null);
  // Track để force re-render khi autoFilledSideIndex thay đổi
  const [autoFilledSideIndex, setAutoFilledSideIndex] = useState<number | null>(null);

  const resetState = () => {
    setSides(['']);
    setActiveSideIndex(0);
    setSaving(false);
    setSuggestions([]);
    setSuggestionsLoading(false);
    setShowSuggestions(false);
    setSelectedIpaUs(null);
    setSelectedIpaUk(null);
    autoFilledSideIndexRef.current = null;
    setAutoFilledSideIndex(null);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleAddHiddenSide = () => {
    setSides(prev => [...prev, '']);
    setActiveSideIndex(sides.length);
  };

  const handleRemoveSide = (index: number) => {
    if (sides.length <= 1) return;
    setSides(prev => prev.filter((_, i) => i !== index));
    if (activeSideIndex >= index && activeSideIndex > 0) {
      setActiveSideIndex(activeSideIndex - 1);
    }
  };

  const handleTextChange = (text: string, index: number) => {
    setSides(prev => {
      const next = [...prev];
      next[index] = text;
      return next;
    });

    // Chỉ thực hiện Autocomplete cho Mặt 1 (Từ vựng tiếng Anh)
    if (index === 0) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      const trimmed = text.trim();
      const lower = trimmed.toLowerCase();

      // Kiểm tra ngay trong kho từ vựng TOEIC cục bộ (phản hồi tức thì 0ms)
      const toeicMatch = TOEIC_MAP.get(lower);
      if (toeicMatch) {
        setSelectedIpaUs(toeicMatch.ipaUs || null);
        setSelectedIpaUk(toeicMatch.ipaUk || toeicMatch.ipaUs || null);
      } else {
        setSelectedIpaUs(null);
        setSelectedIpaUk(null);
      }

      if (trimmed.length >= 2) {
        setShowSuggestions(true);
        setSuggestionsLoading(true);

        debounceTimerRef.current = setTimeout(async () => {
          try {
            const items = await DictionaryService.searchSuggestions(trimmed);
            setSuggestions(items);

            // Nếu người dùng đã gõ xong một từ hợp lệ và chưa có IPA, tự động tra cứu để hiển thị ngay
            if (!toeicMatch && DictionaryService.validateSingleWord(trimmed).isValid) {
              const info = await DictionaryService.lookupWord(trimmed);
              if (info.verified && (info.ipaUs || info.ipaUk)) {
                setSelectedIpaUs(info.ipaUs || null);
                setSelectedIpaUk(info.ipaUk || null);
              }
            }
          } finally {
            setSuggestionsLoading(false);
          }
        }, 250);
      } else {
        setShowSuggestions(false);
        setSuggestions([]);
        setSuggestionsLoading(false);
      }
    }
  };

  const handleSelectSuggestion = (item: SuggestionItem) => {
    setSides(prev => {
      const next = [...prev];
      next[0] = item.word;
      return next;
    });

    const ipa = item.ipaUs || item.ipa || item.ipaUk || null;
    setSelectedIpaUs(ipa);
    setSelectedIpaUk(item.ipaUk || ipa);
    setShowSuggestions(false);
    setSuggestions([]);

    // Tra cứu đầy đủ: IPA chính xác + đa nghĩa + câu ví dụ của từng nghĩa
    DictionaryService.lookupWordFull(item.word).then(info => {
      // Cập nhật IPA nếu có kết quả tốt hơn
      if (info.verified && (info.ipaUs || info.ipaUk)) {
        setSelectedIpaUs(info.ipaUs || null);
        setSelectedIpaUk(info.ipaUk || null);
      }

      // Xây dựng nội dung mặt ẩn: tất cả các nghĩa + câu ví dụ của từng nghĩa
      const autoContent = DictionaryService.formatHiddenSideContent(info);

      if (autoContent && autoContent.trim().length > 0) {
        setSides(prev => {
          const next = [...prev];
          // Chỉ điền mặt ẩn nếu chưa có nội dung (tránh ghi đè nội dung người dùng đã nhập)
          if (next.length === 1) {
            next.push(autoContent);
          } else if (!next[1].trim()) {
            next[1] = autoContent;
          } else {
            // Mặt ẩn đã có nội dung → không ghi đè
            return prev;
          }
          return next;
        });
        // Đánh dấu mặt ẩn index 1 là được auto-fill (ẩn SpeakerButton)
        autoFilledSideIndexRef.current = 1;
        setAutoFilledSideIndex(1);
      }
    }).catch(() => {
      // Nếu API lỗi, chỉ dùng meaningVi từ gợi ý TOEIC (nếu có)
      if (item.meaningVi) {
        setSides(prev => {
          const next = [...prev];
          if (next.length === 1) {
            next.push(item.meaningVi!);
          } else if (!next[1].trim()) {
            next[1] = item.meaningVi!;
          } else {
            return prev;
          }
          return next;
        });
        autoFilledSideIndexRef.current = 1;
        setAutoFilledSideIndex(1);
      }
    });

    // Nếu chưa có IPA, tra cứu tức thì ngay (đã được xử lý ở lookupWordFull trên)
    if (!ipa) {
      DictionaryService.lookupWord(item.word).then(info => {
        if (info.verified && (info.ipaUs || info.ipaUk)) {
          setSelectedIpaUs(info.ipaUs || null);
          setSelectedIpaUk(info.ipaUk || null);
        }
      }).catch(() => {});
    }
  };

  const handleSave = async () => {
    const frontText = (sides[0] || '').trim();
    if (!frontText) {
      Alert.alert('Chưa nhập từ', 'Vui lòng nhập từ tiếng Anh cần thêm.');
      return;
    }

    // 1. Kiểm tra từ đầu vào: Chỉ chấp nhận 1 từ tiếng Anh duy nhất
    const validation = DictionaryService.validateSingleWord(frontText);
    if (!validation.isValid) {
      Alert.alert('Từ không hợp lệ', validation.errorMessage);
      return;
    }

    // 2. Kiểm tra từ đã tồn tại trong danh sách học chưa
    try {
      const duplicate = await CardRepository.findByFront(validation.cleanWord);
      if (duplicate) {
        Alert.alert(
          'Từ đã tồn tại',
          `Từ "${validation.cleanWord}" đã có trong danh sách học của bạn.`
        );
        return;
      }
    } catch (e) {
      // Continue if duplicate check fails
    }

    // 3. Tự động lấy phiên âm IPA & xác minh chính tả qua API từ điển
    setSaving(true);
    try {
      let ipaUs = selectedIpaUs;
      let ipaUk = selectedIpaUk;

      // Luôn tra cứu đảm bảo có IPA chuẩn 100% (cả khi người dùng gõ tay hoặc chọn gợi ý mà chưa kịp nạp)
      let currentSides = [...sides];
      if (!ipaUs && !ipaUk) {
        const dictInfo = await DictionaryService.lookupWord(validation.cleanWord);
        if (dictInfo.verified && (dictInfo.ipaUs || dictInfo.ipaUk)) {
          ipaUs = dictInfo.ipaUs || null;
          ipaUk = dictInfo.ipaUk || null;
        } else if (!dictInfo.verified) {
          // Từ sai chính tả hoặc không tìm thấy trong từ điển
          setSaving(false);
          Alert.alert(
            'Từ chưa được xác minh',
            `Từ "${validation.cleanWord}" không tìm thấy trong từ điển hoặc có thể bị sai chính tả.\n\nBạn có muốn kiểm tra lại chính tả không?`,
            [
              { text: 'Kiểm tra lại', style: 'cancel' },
              {
                text: 'Vẫn lưu từ này',
                onPress: async () => {
                  setSaving(true);
                  try {
                    await onSaveCard(currentSides, null, null);
                    handleClose();
                  } finally {
                    setSaving(false);
                  }
                }
              }
            ]
          );
          return;
        }
      }

      // Nếu mặt ẩn vẫn trống, tự động tra cứu để bổ sung đa nghĩa và các câu ví dụ tương ứng
      if (currentSides.length <= 1 || !currentSides[1]?.trim()) {
        try {
          const fullInfo = await DictionaryService.lookupWordFull(validation.cleanWord);
          if (fullInfo.verified) {
            if (!ipaUs && !ipaUk) {
              ipaUs = fullInfo.ipaUs || null;
              ipaUk = fullInfo.ipaUk || null;
            }
            const autoContent = DictionaryService.formatHiddenSideContent(fullInfo);
            if (autoContent && autoContent.trim().length > 0) {
              if (currentSides.length === 1) {
                currentSides.push(autoContent);
              } else if (!currentSides[1]?.trim()) {
                currentSides[1] = autoContent;
              }
            }
          }
        } catch {}
      }

      await onSaveCard(currentSides, ipaUs, ipaUk);
      handleClose();
    } catch (err: any) {
      Alert.alert('Lỗi lưu thẻ', err?.message || 'Không thể lưu thẻ.');
    } finally {
      setSaving(false);
    }
  };

  // Helper formatting for current active side
  const applyFormatting = (type: 'h1' | 'bold' | 'italic' | 'quote' | 'cloze') => {
    const current = sides[activeSideIndex] || '';
    let updated = current;
    if (type === 'h1') {
      updated = current ? `# ${current}` : '# ';
    } else if (type === 'bold') {
      updated = `${current}**bold**`;
    } else if (type === 'italic') {
      updated = `${current}*italic*`;
    } else if (type === 'quote') {
      updated = current ? `> ${current}` : '> ';
    } else if (type === 'cloze') {
      updated = `${current}<<cloze>>`;
    }
    handleTextChange(updated, activeSideIndex);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          {/* Main White Card Box matching Screenshot 4 */}
          <View style={styles.cardContainer}>
            {/* Header: Cancel - Save */}
            <View style={styles.cardHeader}>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.cancelText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.saveText, saving && { opacity: 0.5 }]}>
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Inputs Scroll Area */}
            <ScrollView
              style={styles.inputsScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {sides.map((sideText, index) => (
                <View key={index} style={styles.sideBlock}>
                  {index > 0 && (
                    <View style={styles.dividerRow}>
                      <View style={styles.dashedDivider} />
                      <TouchableOpacity
                        onPress={() => handleRemoveSide(index)}
                        style={styles.removeSideBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="x" size={14} color="#999999" />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.sideInputContainer}>
                    <TextInput
                      style={styles.sideInput}
                      multiline
                      autoFocus={index === 0}
                      placeholder={index === 0 ? 'Mặt trước (nhập từ tiếng Anh)...' : `Mặt ẩn ${index}...`}
                      placeholderTextColor="#B0B0B0"
                      value={sideText}
                      onChangeText={txt => handleTextChange(txt, index)}
                      onFocus={() => setActiveSideIndex(index)}
                    />
                    {/* Chỉ hiển thị nút phát âm cho mặt trước (từ tiếng Anh). Mặt ẩn (nghĩa tiếng Việt) không hiển thị nút phát âm */}
                    {sideText.trim().length > 0 && index === 0 && (
                      <SpeakerButton
                        text={sideText}
                        size={16}
                        style={styles.sideSpeakerBtn}
                      />
                    )}
                  </View>

                  {/* Hiển thị phiên âm IPA chuẩn ngay bên dưới chữ tiếng Anh */}
                  {index === 0 && (selectedIpaUs || selectedIpaUk) ? (
                    <Text style={styles.liveIpaSubtext}>
                      {selectedIpaUs || selectedIpaUk}
                    </Text>
                  ) : null}

                  {/* Danh sách gợi ý từ Autocomplete xuất hiện ngay dưới ô nhập từ tiếng Anh */}
                  {index === 0 && showSuggestions && (
                    <AutocompleteDropdown
                      visible={showSuggestions}
                      suggestions={suggestions}
                      loading={suggestionsLoading}
                      query={sides[0] || ''}
                      onSelectWord={handleSelectSuggestion}
                      onClose={() => setShowSuggestions(false)}
                    />
                  )}
                </View>
              ))}

              {/* + Add hidden side button matching Screenshot 4 */}
              <TouchableOpacity
                style={styles.addHiddenSideBtn}
                onPress={handleAddHiddenSide}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={16} color="#9E9E9E" style={{ marginRight: 6 }} />
                <Text style={styles.addHiddenSideText}>Add hidden side</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Formatting Toolbar above Keyboard matching Screenshot 4 */}
          <View style={styles.toolbar}>
            <TouchableOpacity style={styles.toolIconBtn}>
              <Feather name="paperclip" size={17} color="#555555" />
            </TouchableOpacity>

            {activeSideIndex === 0 && (
              <SpeakerButton
                text={sides[0] || ''}
                size={17}
                color="#A3A3A3"
                activeColor="#60A5FA"
                style={styles.toolSpeakerBtn}
              />
            )}

            <TouchableOpacity style={styles.toolTextBtn} onPress={() => applyFormatting('h1')}>
              <Text style={styles.toolTextFormat}>H1</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolTextBtn} onPress={() => applyFormatting('bold')}>
              <Text style={[styles.toolTextFormat, { fontWeight: '700' }]}>B</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolTextBtn} onPress={() => applyFormatting('italic')}>
              <Text style={[styles.toolTextFormat, { fontStyle: 'italic' }]}>i</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolTextBtn} onPress={() => applyFormatting('quote')}>
              <Text style={styles.toolTextFormat}>”</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.hideTextBtn} onPress={() => applyFormatting('cloze')}>
              <Text style={styles.hideTextLabel}>Hide text</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolIconBtn, { marginLeft: 'auto' }]}
              onPress={() => Keyboard.dismiss()}
            >
              <MaterialCommunityIcons name="keyboard-close" size={19} color="#666666" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject
  },
  keyboardContainer: {
    width: '100%',
    alignItems: 'center'
  },
  cardContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 16,
    maxHeight: 380,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEEEEE'
  },
  cancelText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '400'
  },
  saveText: {
    fontSize: 16,
    color: '#111111',
    fontWeight: '600'
  },
  inputsScroll: {
    paddingTop: 12,
    maxHeight: 300
  },
  sideBlock: {
    marginVertical: 4
  },
  sideInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  sideSpeakerBtn: {
    marginLeft: 8,
    marginTop: 4,
    backgroundColor: '#F3F4F6'
  },
  toolSpeakerBtn: {
    padding: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10
  },
  dashedDivider: {
    flex: 1,
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E2E2',
    borderStyle: 'dashed'
  },
  removeSideBtn: {
    marginLeft: 8,
    padding: 2
  },
  sideInput: {
    flex: 1,
    fontSize: 18,
    color: '#222222',
    lineHeight: 26,
    minHeight: 44,
    textAlignVertical: 'top',
    padding: 0
  },
  liveIpaSubtext: {
    fontSize: 14.5,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 6,
    letterSpacing: 0.3
  },
  addHiddenSideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 8
  },
  addHiddenSideText: {
    fontSize: 15,
    color: '#9E9E9E',
    fontWeight: '500'
  },
  toolbar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    gap: 12
  },
  toolIconBtn: {
    padding: 4
  },
  toolTextBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3
  },
  toolTextFormat: {
    color: '#FFFFFF',
    fontSize: 15
  },
  hideTextBtn: {
    backgroundColor: '#383838',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  hideTextLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500'
  }
});
