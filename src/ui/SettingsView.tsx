import React, { useEffect, useState } from 'react';
import * as Speech from 'expo-speech';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from './components/Icons';
import { Header } from './components/Header';
import type { Deck } from '../domain/types';
import { CardRepository } from '../data/repositories';
import { SpeechService, SpeechAccent, POPULAR_VOICES, PopularVoice } from '../services/speech';

interface SettingsViewProps {
  userName: string;
  decks: Deck[];
  onUpdateUserName: (name: string) => void;
  onOpenDrawer: () => void;
  onRefresh: () => void;
}

export function SettingsView({
  userName,
  decks,
  onUpdateUserName,
  onOpenDrawer,
  onRefresh
}: SettingsViewProps) {
  const [name, setName] = useState(userName);
  const [importText, setImportText] = useState('');
  const [selectedDeckForImport, setSelectedDeckForImport] = useState(decks[0]?.id || '');
  const [showImportBox, setShowImportBox] = useState(false);
  const [speechAccent, setSpeechAccent] = useState<SpeechAccent>('en-US');
  const [speechRate, setSpeechRate] = useState<number>(0.95);
  const [speechPitch, setSpeechPitch] = useState<number>(1.0);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [voiceCount, setVoiceCount] = useState<number>(0);
  const [deviceVoices, setDeviceVoices] = useState<Speech.Voice[]>([]);
  const [isTestingSpeech, setIsTestingSpeech] = useState(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);

  useEffect(() => {
    const loadSpeechSettings = async () => {
      await SpeechService.init();
      const s = SpeechService.getSettings();
      setSpeechAccent(s.accent);
      setSpeechRate(s.rate);
      setSpeechPitch(s.pitch);
      setSelectedVoice(s.voiceIdentifier || null);
      const voices = await SpeechService.getVoicesAsync();
      setDeviceVoices(voices);
      setVoiceCount(voices.length);
    };
    loadSpeechSettings();
  }, []);

  const handleChangeAccent = async (accent: SpeechAccent) => {
    setSpeechAccent(accent);
    // Khi đổi accent, tự động đặt lại voice mặc định tương ứng với accent đó nếu voice hiện tại không thuộc accent
    const currentVoiceMatch = POPULAR_VOICES.find(v => v.id === selectedVoice);
    let newVoice = selectedVoice;
    if (currentVoiceMatch && currentVoiceMatch.accent !== accent) {
      newVoice = accent === 'en-US' ? 'Samantha' : 'Daniel';
      setSelectedVoice(newVoice);
    }
    await SpeechService.updateSettings({ accent, voiceIdentifier: newVoice });
  };

  const handleChangeRate = async (rate: number) => {
    setSpeechRate(rate);
    await SpeechService.updateSettings({ rate });
  };

  const handleChangePitch = async (pitch: number) => {
    setSpeechPitch(pitch);
    await SpeechService.updateSettings({ pitch });
  };

  const handleSelectVoice = async (voiceId: string | null) => {
    setSelectedVoice(voiceId);
    await SpeechService.updateSettings({ voiceIdentifier: voiceId });
  };

  const handlePreviewDeviceVoice = async (voice: Speech.Voice) => {
    setPreviewingVoiceId(voice.identifier);
    const phrase = voice.language.toLowerCase().includes('gb')
      ? `Hello, I am ${voice.name}. Ready to practise your English?`
      : `Hi, I am ${voice.name}. Ready to practice your English?`;
    await SpeechService.speak(phrase, {
      voice: voice.identifier,
      accent: voice.language.toLowerCase().includes('gb') ? 'en-GB' : 'en-US',
      rate: speechRate,
      pitch: speechPitch
    });
    setTimeout(() => {
      setPreviewingVoiceId(null);
    }, 1200);
  };

  const handlePreviewVoice = async (voice: PopularVoice) => {
    setPreviewingVoiceId(voice.id);
    const phrase = voice.accent === 'en-US'
      ? `Hi, I am ${voice.name.split(' ')[0]}. Ready to practice your English?`
      : `Hello, I am ${voice.name.split(' ')[0]}. Ready to practise your English?`;
    await SpeechService.speak(phrase, {
      voice: voice.id,
      accent: voice.accent,
      rate: speechRate,
      pitch: speechPitch
    });
    setTimeout(() => {
      setPreviewingVoiceId(null);
    }, 1200);
  };

  const handleTestSpeech = async () => {
    setIsTestingSpeech(true);
    const testSentence = speechAccent === 'en-US'
      ? 'Hello! Welcome to Mochi flashcards. Ready to master new vocabulary?'
      : 'Hello! Welcome to Mochi flashcards. Ready to practise your English today?';
    await SpeechService.speak(testSentence, {
      accent: speechAccent,
      rate: speechRate,
      pitch: speechPitch,
      voice: selectedVoice
    });
    setTimeout(() => {
      setIsTestingSpeech(false);
    }, 1200);
  };

  const handleSaveName = () => {
    if (!name.trim()) return;
    onUpdateUserName(name.trim());
    Alert.alert('Đã lưu', `Đã cập nhật tên người dùng thành ${name.trim()}`);
  };

  const handleImportSubmit = async () => {
    if (!importText.trim() || !selectedDeckForImport) {
      Alert.alert('Thiếu thông tin', 'Vui lòng dán nội dung thẻ và chọn một bộ thẻ.');
      return;
    }
    // Cards can be separated by double newlines or '==='
    const cardBlocks = importText.split(/\n\s*===\s*\n|\n\n\n+/);
    let count = 0;
    for (const block of cardBlocks) {
      if (block.trim()) {
        await CardRepository.create({
          deckId: selectedDeckForImport,
          content: block.trim()
        });
        count++;
      }
    }
    Alert.alert('Nhập thẻ thành công', `Đã nhập thành công ${count} thẻ vào bộ thẻ!`);
    setImportText('');
    setShowImportBox(false);
    onRefresh();
  };

  return (
    <View style={styles.container}>
      <Header
        onOpenDrawer={onOpenDrawer}
        title="Cài đặt"
        iconName="settings"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <Text style={styles.sectionHeader}>TÀI KHOẢN</Text>
        <View style={styles.cardBox}>
          <Text style={styles.inputLabel}>TÊN HIỂN THỊ</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Tên của bạn"
            />
            <TouchableOpacity style={styles.actionBtn} onPress={handleSaveName}>
              <Text style={styles.actionBtnText}>Lưu</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Spaced Repetition Algorithm */}
        <Text style={styles.sectionHeader}>THUẬT TOÁN LẶP LẠI NGẮT QUÃNG (FSRS)</Text>
        <View style={styles.cardBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoTitle}>Thuật toán</Text>
            <Text style={styles.infoValue}>FSRS v6</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoTitle}>Tỉ lệ ghi nhớ mục tiêu</Text>
            <Text style={styles.infoValue}>90%</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoTitle}>Phản hồi ôn tập</Text>
            <Text style={styles.infoValue}>✕ (Quên) / ✓ (Nhớ)</Text>
          </View>
        </View>

        {/* English Pronunciation & System TTS */}
        <Text style={styles.sectionHeader}>PHÁT ÂM TIẾNG ANH (SYSTEM TTS)</Text>
        <View style={styles.cardBox}>
          {/* Accent selector */}
          <Text style={styles.inputLabel}>GIỌNG ĐỌC MẪU (ACCENT)</Text>
          <View style={styles.accentToggleRow}>
            <TouchableOpacity
              style={[styles.accentBtn, speechAccent === 'en-US' && styles.accentBtnActive]}
              onPress={() => handleChangeAccent('en-US')}
              activeOpacity={0.7}
            >
              <Text style={[styles.accentBtnText, speechAccent === 'en-US' && styles.accentBtnTextActive]}>
                Tiếng Anh - Mỹ (en-US)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.accentBtn, speechAccent === 'en-GB' && styles.accentBtnActive]}
              onPress={() => handleChangeAccent('en-GB')}
              activeOpacity={0.7}
            >
              <Text style={[styles.accentBtnText, speechAccent === 'en-GB' && styles.accentBtnTextActive]}>
                Tiếng Anh - Anh (en-GB)
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Voice Selector */}
          <Text style={styles.inputLabel}>CHỌN GIỌNG ĐỌC ({speechAccent === 'en-US' ? 'TIẾNG ANH - MỸ' : 'TIẾNG ANH - ANH'})</Text>
          <View style={styles.voicesList}>
            {/* Default System voice option */}
            <TouchableOpacity
              style={[styles.voiceItem, !selectedVoice && styles.voiceItemActive]}
              onPress={() => handleSelectVoice(null)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.voiceName, !selectedVoice && styles.voiceNameActive]}>
                  Giọng hệ thống mặc định (Tự động)
                </Text>
                <Text style={styles.voiceDesc}>Tối ưu và đồng bộ theo cài đặt hệ điều hành</Text>
              </View>
              {!selectedVoice && <Feather name="check" size={16} color="#2563EB" />}
            </TouchableOpacity>

            {/* Hiển thị danh sách giọng đọc thực tế của thiết bị */}
            {(() => {
              const matchingVoices = deviceVoices.filter(v => {
                const lang = v.language.toLowerCase();
                if (speechAccent === 'en-US') {
                  return lang.includes('us') || lang === 'en';
                }
                return lang.includes('gb') || lang.includes('uk');
              });

              const list = matchingVoices.length > 0 ? matchingVoices : deviceVoices;

              if (list.length > 0) {
                return list.map(v => {
                  const isSelected = selectedVoice === v.identifier || selectedVoice === v.name;
                  const isPreviewing = previewingVoiceId === v.identifier;
                  return (
                    <TouchableOpacity
                      key={v.identifier}
                      style={[styles.voiceItem, isSelected && styles.voiceItemActive]}
                      onPress={() => handleSelectVoice(v.identifier)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.voiceName, isSelected && styles.voiceNameActive]}>
                            {v.name}
                          </Text>
                          <View style={styles.langTag}>
                            <Text style={styles.langTagText}>{v.language}</Text>
                          </View>
                          {v.quality === 'Enhanced' && (
                            <View style={styles.enhancedTag}>
                              <Text style={styles.enhancedTagText}>HD</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.voiceDesc}>
                          {v.quality === 'Enhanced' ? 'Chất lượng âm thanh nâng cao (Enhanced HD)' : 'Giọng đọc chuẩn iOS'}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.miniPreviewBtn, isPreviewing && styles.miniPreviewBtnActive]}
                        onPress={(e) => {
                          if (e?.stopPropagation) e.stopPropagation();
                          handlePreviewDeviceVoice(v);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name={isPreviewing ? 'volume-2' : 'volume-1'} size={15} color={isPreviewing ? '#2563EB' : '#6B7280'} />
                      </TouchableOpacity>

                      {isSelected && <Feather name="check" size={16} color="#2563EB" style={{ marginLeft: 8 }} />}
                    </TouchableOpacity>
                  );
                });
              }

              // Dự phòng Popular Voices nếu máy chưa kịp nạp
              return POPULAR_VOICES.filter(v => v.accent === speechAccent).map(v => {
                const isSelected = selectedVoice === v.id;
                const isPreviewing = previewingVoiceId === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.voiceItem, isSelected && styles.voiceItemActive]}
                    onPress={() => handleSelectVoice(v.id)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.voiceName, isSelected && styles.voiceNameActive]}>
                          {v.name}
                        </Text>
                        <View style={styles.genderTag}>
                          <Text style={styles.genderTagText}>{v.gender === 'female' ? 'Nữ' : 'Nam'}</Text>
                        </View>
                      </View>
                      <Text style={styles.voiceDesc}>{v.desc}</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.miniPreviewBtn, isPreviewing && styles.miniPreviewBtnActive]}
                      onPress={(e) => {
                        if (e?.stopPropagation) e.stopPropagation();
                        handlePreviewVoice(v);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name={isPreviewing ? 'volume-2' : 'volume-1'} size={15} color={isPreviewing ? '#2563EB' : '#6B7280'} />
                    </TouchableOpacity>

                    {isSelected && <Feather name="check" size={16} color="#2563EB" style={{ marginLeft: 8 }} />}
                  </TouchableOpacity>
                );
              });
            })()}
          </View>

          {/* Hướng dẫn tải thêm nhiều giọng đọc tự nhiên trên iPhone */}
          <View style={styles.tipCard}>
            <Ionicons name="information-circle-outline" size={18} color="#2563EB" style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={styles.tipCardText}>
              <Text style={{ fontWeight: '700' }}>Mẹo trên iPhone:</Text> Vào <Text style={{ fontWeight: '600' }}>Cài đặt</Text> &gt; <Text style={{ fontWeight: '600' }}>Trợ năng</Text> &gt; <Text style={{ fontWeight: '600' }}>Đọc nội dung</Text> &gt; <Text style={{ fontWeight: '600' }}>Giọng nói</Text> &gt; <Text style={{ fontWeight: '600' }}>Tiếng Anh</Text> để tải thêm nhiều giọng Siri, Ava, Zoe, Oliver... tự nhiên và truyền cảm.
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Pitch selector */}
          <Text style={styles.inputLabel}>CAO ĐỘ GIỌNG ĐỌC (PITCH: {speechPitch}x)</Text>
          <View style={styles.ratePillsRow}>
            {[
              { label: '0.85x Trầm ấm', val: 0.85 },
              { label: '1.0x Tự nhiên', val: 1.0 },
              { label: '1.15x Trong trẻo', val: 1.15 }
            ].map(item => (
              <TouchableOpacity
                key={item.val}
                style={[styles.ratePill, Math.abs(speechPitch - item.val) < 0.05 && styles.ratePillActive]}
                onPress={() => handleChangePitch(item.val)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.ratePillText,
                    Math.abs(speechPitch - item.val) < 0.05 && styles.ratePillTextActive
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Speed selector */}
          <Text style={styles.inputLabel}>TỐC ĐỘ PHÁT ÂM ({speechRate}x)</Text>
          <View style={styles.ratePillsRow}>
            {[
              { label: '0.75x Chậm', val: 0.75 },
              { label: '0.9x Vừa', val: 0.9 },
              { label: '1.0x Chuẩn', val: 1.0 },
              { label: '1.25x Nhanh', val: 1.25 }
            ].map(item => (
              <TouchableOpacity
                key={item.val}
                style={[styles.ratePill, Math.abs(speechRate - item.val) < 0.05 && styles.ratePillActive]}
                onPress={() => handleChangeRate(item.val)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.ratePillText,
                    Math.abs(speechRate - item.val) < 0.05 && styles.ratePillTextActive
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Test Voice Button */}
          <TouchableOpacity
            style={[styles.testSpeechBtn, isTestingSpeech && styles.testSpeechBtnActive]}
            onPress={handleTestSpeech}
            activeOpacity={0.8}
          >
            <Feather
              name={isTestingSpeech ? 'volume-2' : 'volume-1'}
              size={18}
              color={isTestingSpeech ? '#FFFFFF' : '#2563EB'}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.testSpeechBtnText, isTestingSpeech && styles.testSpeechBtnTextActive]}>
              {isTestingSpeech ? 'Đang phát âm thử...' : 'Nghe thử giọng đọc'}
            </Text>
          </TouchableOpacity>

          {/* Voice status info */}
          <View style={styles.ttsStatusRow}>
            <Ionicons name="hardware-chip-outline" size={13} color="#888888" style={{ marginRight: 6 }} />
            <Text style={styles.ttsStatusText}>
              System TTS: {voiceCount > 0 ? `${voiceCount} giọng đọc tiếng Anh khả dụng trên máy` : 'Giọng đọc tích hợp sẵn trên thiết bị (iOS/Android)'}
            </Text>
          </View>
        </View>

        {/* Data & Import */}
        <Text style={styles.sectionHeader}>DỮ LIỆU & SAO LƯU</Text>
        <View style={styles.cardBox}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setShowImportBox(!showImportBox)}
          >
            <Feather name="download" size={17} color="#444444" style={{ marginRight: 10 }} />
            <Text style={styles.menuRowText}>Nhập thẻ từ Markdown</Text>
            <Feather name={showImportBox ? 'chevron-up' : 'chevron-down'} size={16} color="#888888" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          {showImportBox && (
            <View style={styles.importArea}>
              <Text style={styles.importHint}>
                Định dạng: Phân cách mặt trước và mặt ẩn bằng `---`. Phân cách giữa các thẻ bằng `===`.
              </Text>
              <TextInput
                style={styles.importInput}
                multiline
                placeholder={"Từ 1\n---\nNghĩa 1\n===\nTừ 2\n---\nNghĩa 2"}
                value={importText}
                onChangeText={setImportText}
              />
              <TouchableOpacity style={styles.importSubmitBtn} onPress={handleImportSubmit}>
                <Text style={styles.importSubmitText}>Nhập thẻ ngay</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* About */}
        <Text style={styles.sectionHeader}>GIỚI THIỆU</Text>
        <View style={styles.cardBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoTitle}>Ứng dụng</Text>
            <Text style={styles.infoValue}>Mochi Flashcards & Ghi chú</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoTitle}>Phiên bản</Text>
            <Text style={styles.infoValue}>2.0.0 (Offline-First SQLite)</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA'
  },
  scrollContent: {
    padding: 16
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 8,
    marginLeft: 4
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8
  },
  inputLabel: {
    fontSize: 11,
    color: '#999999',
    fontWeight: '700',
    marginBottom: 6
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  textInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#222222',
    marginRight: 10
  },
  actionBtn: {
    backgroundColor: '#262626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600'
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8
  },
  infoTitle: {
    fontSize: 14,
    color: '#444444'
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222222'
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 4
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6
  },
  menuRowText: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500'
  },
  importArea: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 10
  },
  importHint: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 8
  },
  importInput: {
    height: 100,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#222222',
    textAlignVertical: 'top',
    marginBottom: 10
  },
  importSubmitBtn: {
    backgroundColor: '#333333',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  importSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600'
  },
  accentToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4
  },
  accentBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent'
  },
  accentBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6'
  },
  accentBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#4B5563'
  },
  accentBtnTextActive: {
    color: '#1D4ED8',
    fontWeight: '700'
  },
  ratePillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 6,
    flexWrap: 'wrap'
  },
  ratePill: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  ratePillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB'
  },
  ratePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563'
  },
  ratePillTextActive: {
    color: '#FFFFFF'
  },
  testSpeechBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 6
  },
  testSpeechBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB'
  },
  testSpeechBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8'
  },
  testSpeechBtnTextActive: {
    color: '#FFFFFF'
  },
  ttsStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F3F4F6'
  },
  ttsStatusText: {
    fontSize: 11,
    color: '#6B7280'
  },
  voicesList: {
    marginVertical: 4,
    gap: 6
  },
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  voiceItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6'
  },
  voiceName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#374151'
  },
  voiceNameActive: {
    color: '#1D4ED8',
    fontWeight: '700'
  },
  voiceDesc: {
    fontSize: 11.5,
    color: '#6B7280',
    marginTop: 2
  },
  genderTag: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4
  },
  genderTagText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#4B5563'
  },
  miniPreviewBtn: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginLeft: 6
  },
  miniPreviewBtnActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6'
  },
  langTag: {
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4
  },
  langTagText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#4B5563'
  },
  enhancedTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4
  },
  enhancedTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#166534'
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  tipCardText: {
    flex: 1,
    fontSize: 11.5,
    color: '#1E40AF',
    lineHeight: 16.5
  }
});

