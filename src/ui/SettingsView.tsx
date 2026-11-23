import React, { useEffect, useState } from 'react';
import * as Speech from 'expo-speech';
import {
  Alert,
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
import { Header } from './components/Header';
import type { Deck, ExerciseType } from '../domain/types';
import { AdaptiveLearningRepository, CardRepository, UserSettingsRepository, DEFAULT_PRACTICE_MODES } from '../data/repositories';
import { SpeechService, SpeechAccent, POPULAR_VOICES, PopularVoice } from '../services/speech';
import { StudyReminders } from '../services/studyReminders';
import { MochiFile } from '../services/mochiFile';

const SETTINGS_PRACTICE_OPTIONS: { id: ExerciseType; label: string; desc: string }[] = [
  { id: 'flashcard', label: 'Lật thẻ truyền thống', desc: 'Chạm để lật mở xem mặt sau / mặt ẩn' },
  { id: 'fill_in_blank', label: 'Điền từ (Gạch chân)', desc: 'Nhìn nghĩa tiếng Việt → Viết từ tiếng Anh' },
  { id: 'memory_write', label: 'Nhớ & viết lại', desc: 'Xem từ 2s rồi che đi → Viết lại bằng trí nhớ' },
  { id: 'listening', label: 'Luyện nghe TOEIC', desc: 'Nghe phát âm mà không nhìn chữ → Điền từ' },
  { id: 'speaking', label: 'Luyện phát âm', desc: 'Nhìn từ → Tự đọc to vào micro' },
  { id: 'sentence_cloze', label: 'Điền vào câu ngữ cảnh', desc: 'Đọc câu ví dụ chứa ô trống → Điền từ phù hợp' },
  { id: 'word_family', label: 'Họ từ vựng (Word Family)', desc: 'Nhận diện danh từ/động từ/tính từ cùng họ' }
];

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
  const [isEditingName, setIsEditingName] = useState(false);
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
  const [adaptiveEnabled, setAdaptiveEnabled] = useState(true);
  const [dailyNewLimit, setDailyNewLimit] = useState('10');
  const [targetMinutes, setTargetMinutes] = useState('15');
  const [remindersEnabled, setRemindersEnabled] = useState(false);

  // Modal chọn giọng đọc dạng dropdown sheet
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');

  // Hình thức ôn tập mặc định (đồng bộ cùng SQLite user_settings)
  const [practiceModes, setPracticeModes] = useState<ExerciseType[]>(
    UserSettingsRepository.getCachedPracticeModes()
  );

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
    AdaptiveLearningRepository.getSettings().then(s => {
      setAdaptiveEnabled(s.enabled);
      setDailyNewLimit(String(s.dailyNewLimit));
      setTargetMinutes(String(s.targetMinutes));
    });
    UserSettingsRepository.getPracticeModes().then(modes => {
      if (modes && modes.length > 0) {
        setPracticeModes(modes);
      }
    });
  }, []);

  const handleTogglePracticeMode = (modeId: ExerciseType) => {
    let next: ExerciseType[];
    if (practiceModes.includes(modeId)) {
      if (practiceModes.length <= 1) {
        Alert.alert('Lưu ý', 'Bạn cần chọn ít nhất 1 hình thức ôn tập.');
        return;
      }
      next = practiceModes.filter(m => m !== modeId);
    } else {
      next = [...practiceModes, modeId];
    }
    setPracticeModes(next);
    UserSettingsRepository.setPracticeModes(next).catch(() => {});
  };

  const handleSelectAllPracticeModes = () => {
    const next: ExerciseType[] = practiceModes.length === DEFAULT_PRACTICE_MODES.length
      ? ['flashcard']
      : [...DEFAULT_PRACTICE_MODES];
    setPracticeModes(next);
    UserSettingsRepository.setPracticeModes(next).catch(() => {});
  };

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
    setShowVoiceModal(false);
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
    setIsEditingName(false);
    Alert.alert('Đã lưu', `Đã cập nhật tên người dùng thành ${name.trim()}`);
  };

  const saveAdaptive = async (
    enabled = adaptiveEnabled,
    customNewLimit?: number,
    customMinutes?: number
  ) => {
    const dailyNew = customNewLimit !== undefined
      ? customNewLimit
      : Math.max(0, Math.min(50, Number(dailyNewLimit) || 0));
    const minutes = customMinutes !== undefined
      ? customMinutes
      : Math.max(5, Math.min(180, Number(targetMinutes) || 15));

    await AdaptiveLearningRepository.saveSettings({ enabled, dailyNewLimit: dailyNew, targetMinutes: minutes });
    setAdaptiveEnabled(enabled);
    setDailyNewLimit(String(dailyNew));
    setTargetMinutes(String(minutes));
    onRefresh();
  };

  const toggleReminders = async (val: boolean) => {
    try {
      if (!val) {
        await StudyReminders.cancel();
        setRemindersEnabled(false);
        Alert.alert('Đã tắt nhắc học', 'Các thông báo nhắc học đã được hủy.');
      } else {
        const enabled = await StudyReminders.schedule();
        setRemindersEnabled(enabled);
        Alert.alert(
          enabled ? 'Đã bật nhắc học' : 'Cần cấp quyền',
          enabled
            ? 'Mochi sẽ gửi thông báo lúc 09:15, 14:15 và 19:15 hằng ngày.'
            : 'Hãy cho phép gửi thông báo trong cài đặt thiết bị để nhận nhắc học.'
        );
      }
    } catch {
      Alert.alert('Chưa thể bật nhắc học', 'Hãy cập nhật Expo Go hoặc dùng bản ứng dụng đã build lại để bật thông báo. Phần học vẫn hoạt động bình thường.');
    }
  };

  const handleImportSubmit = async () => {
    if (!importText.trim() || !selectedDeckForImport) {
      Alert.alert('Thiếu thông tin', 'Vui lòng dán nội dung thẻ và chọn một bộ thẻ.');
      return;
    }
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

  const handleMochiImport = async () => {
    try {
      const result = await MochiFile.importFromPicker();
      if (result.cards) {
        await onRefresh();
        Alert.alert('Nhập Mochi hoàn tất', `Đã nhập ${result.cards} thẻ trong ${result.decks} bộ thẻ.`);
      }
    } catch (error: any) {
      Alert.alert('Không thể nhập file Mochi', error?.message || 'File không đúng định dạng .mochi.');
    }
  };

  const handleMochiExport = async () => {
    try {
      await MochiFile.exportAll();
    } catch {
      Alert.alert('Không thể xuất file', 'Thiết bị này chưa hỗ trợ chia sẻ file.');
    }
  };

  // Lấy thông tin hiển thị của giọng đọc hiện tại
  const getSelectedVoiceDisplay = () => {
    if (!selectedVoice) {
      return {
        name: 'Giọng hệ thống mặc định',
        sub: 'Tự động theo cài đặt của thiết bị',
        badge: null
      };
    }
    const deviceMatch = deviceVoices.find(v => v.identifier === selectedVoice || v.name === selectedVoice);
    if (deviceMatch) {
      return {
        name: deviceMatch.name,
        sub: deviceMatch.language,
        badge: deviceMatch.quality === 'Enhanced' ? 'HD' : null
      };
    }
    const popularMatch = POPULAR_VOICES.find(v => v.id === selectedVoice);
    if (popularMatch) {
      return {
        name: popularMatch.name,
        sub: popularMatch.desc,
        badge: popularMatch.gender === 'female' ? 'Nữ' : 'Nam'
      };
    }
    return {
      name: selectedVoice,
      sub: 'Giọng đọc đã chọn',
      badge: null
    };
  };

  const currentVoiceInfo = getSelectedVoiceDisplay();

  // Danh sách giọng đọc khả dụng theo accent và tìm kiếm
  const matchingDeviceVoices = deviceVoices.filter(v => {
    const lang = v.language.toLowerCase();
    if (speechAccent === 'en-US') {
      return lang.includes('us') || lang === 'en';
    }
    return lang.includes('gb') || lang.includes('uk');
  });

  const baseDeviceList = matchingDeviceVoices.length > 0 ? matchingDeviceVoices : deviceVoices;
  const filteredDeviceVoices = baseDeviceList.filter(v =>
    !voiceSearchQuery.trim() ||
    v.name.toLowerCase().includes(voiceSearchQuery.toLowerCase()) ||
    v.language.toLowerCase().includes(voiceSearchQuery.toLowerCase())
  );

  const filteredPopularVoices = POPULAR_VOICES.filter(v =>
    v.accent === speechAccent &&
    (!voiceSearchQuery.trim() || v.name.toLowerCase().includes(voiceSearchQuery.toLowerCase()))
  );

  return (
    <View style={styles.container}>
      <Header
        onOpenDrawer={onOpenDrawer}
        title="Cài đặt"
        iconName="settings"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <Text style={styles.sectionHeader}>TÀI KHOẢN</Text>
        <View style={styles.cardBox}>
          <View style={styles.profileRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>{(name.trim() || 'Q')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              {isEditingName ? (
                <View style={styles.nameEditRow}>
                  <TextInput
                    style={styles.nameInput}
                    value={name}
                    onChangeText={setName}
                    placeholder="Nhập tên..."
                    autoFocus
                  />
                  <TouchableOpacity style={styles.saveNameBtn} onPress={handleSaveName}>
                    <Text style={styles.saveNameBtnText}>Lưu</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelNameBtn}
                    onPress={() => {
                      setName(userName);
                      setIsEditingName(false);
                    }}
                  >
                    <Feather name="x" size={16} color="#666666" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.nameDisplayRow}>
                  <View>
                    <Text style={styles.profileName}>{name || 'Người học'}</Text>
                    <Text style={styles.profileSub}>Học viên Mochi · Trực tuyến</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editNameBtn}
                    onPress={() => setIsEditingName(true)}
                    activeOpacity={0.7}
                  >
                    <Feather name="edit-2" size={14} color="#444444" />
                    <Text style={styles.editNameBtnText}>Đổi tên</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Pronunciation & Voice (TTS) - REDESIGNED COMPACT DROPDOWN */}
        <Text style={styles.sectionHeader}>PHÁT ÂM TIẾNG ANH & GIỌNG ĐỌC</Text>
        <View style={styles.cardBox}>
          {/* Accent Segmented Control */}
          <Text style={styles.inputLabel}>GIỌNG ĐỌC MẪU (ACCENT)</Text>
          <View style={styles.segmentedRow}>
            <TouchableOpacity
              style={[styles.segmentBtn, speechAccent === 'en-US' && styles.segmentBtnActive]}
              onPress={() => handleChangeAccent('en-US')}
              activeOpacity={0.7}
            >
              <Text style={styles.flagIcon}>🇺🇸</Text>
              <Text style={[styles.segmentBtnText, speechAccent === 'en-US' && styles.segmentBtnTextActive]}>
                Tiếng Anh - Mỹ (en-US)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, speechAccent === 'en-GB' && styles.segmentBtnActive]}
              onPress={() => handleChangeAccent('en-GB')}
              activeOpacity={0.7}
            >
              <Text style={styles.flagIcon}>🇬🇧</Text>
              <Text style={[styles.segmentBtnText, speechAccent === 'en-GB' && styles.segmentBtnTextActive]}>
                Tiếng Anh - Anh (en-GB)
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Voice Dropdown Picker Row (Replaced endless vertical list) */}
          <Text style={styles.inputLabel}>GIỌNG ĐỌC PHÁT ÂM</Text>
          <TouchableOpacity
            style={styles.voiceDropdownRow}
            onPress={() => setShowVoiceModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.voiceDropdownIconBox}>
              <Feather name="mic" size={17} color="#444444" />
            </View>
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.voiceDropdownName} numberOfLines={1}>
                  {currentVoiceInfo.name}
                </Text>
                {currentVoiceInfo.badge && (
                  <View style={styles.enhancedTag}>
                    <Text style={styles.enhancedTagText}>{currentVoiceInfo.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.voiceDropdownDesc} numberOfLines={1}>
                {currentVoiceInfo.sub}
              </Text>
            </View>

            <View style={styles.voiceDropdownAction}>
              <View style={styles.changePill}>
                <Text style={styles.changePillText}>Đổi</Text>
                <Feather name="chevron-right" size={13} color="#444444" />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Pitch & Speed Controls */}
          <Text style={styles.inputLabel}>TỐC ĐỘ ĐỌC ({speechRate}x)</Text>
          <View style={styles.chipsRow}>
            {[
              { label: '0.75x Chậm', val: 0.75 },
              { label: '0.9x Vừa', val: 0.9 },
              { label: '1.0x Chuẩn', val: 1.0 },
              { label: '1.25x Nhanh', val: 1.25 }
            ].map(item => (
              <TouchableOpacity
                key={item.val}
                style={[styles.chipPill, Math.abs(speechRate - item.val) < 0.05 && styles.chipPillActive]}
                onPress={() => handleChangeRate(item.val)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipPillText,
                    Math.abs(speechRate - item.val) < 0.05 && styles.chipPillTextActive
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />

          <Text style={styles.inputLabel}>CAO ĐỘ GIỌNG (PITCH: {speechPitch}x)</Text>
          <View style={styles.chipsRow}>
            {[
              { label: '0.85x Trầm ấm', val: 0.85 },
              { label: '1.0x Tự nhiên', val: 1.0 },
              { label: '1.15x Trong trẻo', val: 1.15 }
            ].map(item => (
              <TouchableOpacity
                key={item.val}
                style={[styles.chipPill, Math.abs(speechPitch - item.val) < 0.05 && styles.chipPillActive]}
                onPress={() => handleChangePitch(item.val)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipPillText,
                    Math.abs(speechPitch - item.val) < 0.05 && styles.chipPillTextActive
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Test Speech Button */}
          <TouchableOpacity
            style={[styles.testSpeechBtn, isTestingSpeech && styles.testSpeechBtnActive]}
            onPress={handleTestSpeech}
            activeOpacity={0.8}
          >
            <Feather
              name={isTestingSpeech ? 'volume-2' : 'volume-1'}
              size={17}
              color="#FFFFFF"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.testSpeechBtnText}>
              {isTestingSpeech ? 'Đang phát âm thử...' : 'Nghe thử câu mẫu phát âm'}
            </Text>
          </TouchableOpacity>

          {/* Tip Card */}
          <View style={styles.tipCard}>
            <Ionicons name="information-circle-outline" size={18} color="#444444" style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={styles.tipCardText}>
              <Text style={{ fontWeight: '700' }}>Mẹo giọng đọc:</Text> Bạn có thể tải thêm giọng Siri, Ava, Zoe, Oliver tự nhiên trong <Text style={{ fontWeight: '600' }}>Cài đặt thiết bị &gt; Trợ năng &gt; Đọc nội dung &gt; Giọng nói</Text>.
            </Text>
          </View>
        </View>

        {/* Goals & Reminders */}
        <Text style={styles.sectionHeader}>MỤC TIÊU & NHẮC NHỞ HỌC TẬP</Text>
        <View style={styles.cardBox}>
          {/* Reminders Switch */}
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather name="bell" size={15} color="#444444" />
                <Text style={styles.switchTitle}>Nhắc học từ vựng</Text>
              </View>
              <Text style={styles.switchDesc}>Thông báo lúc 09:15 · 14:15 · 19:15</Text>
            </View>
            <Switch
              value={remindersEnabled}
              onValueChange={toggleReminders}
              trackColor={{ false: '#E2E8F0', true: '#262626' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          {/* Adaptive Learning Switch */}
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="brain" size={16} color="#444444" />
                <Text style={styles.switchTitle}>Tự động điều chỉnh theo năng lực</Text>
              </View>
              <Text style={styles.switchDesc}>
                {adaptiveEnabled ? 'Tự động đề xuất số từ mới theo tốc độ học' : 'Dùng giới hạn từ mới và thời gian thủ công'}
              </Text>
            </View>
            <Switch
              value={adaptiveEnabled}
              onValueChange={(val) => saveAdaptive(val)}
              trackColor={{ false: '#E2E8F0', true: '#262626' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Manual limits */}
          <View style={styles.limitsBox}>
            <View style={styles.limitItem}>
              <Text style={styles.limitLabel}>TỪ MỚI / NGÀY</Text>
              <View style={styles.presetChipsRow}>
                {[5, 10, 15, 20].map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.presetChip, dailyNewLimit === String(n) && styles.presetChipActive]}
                    onPress={() => {
                      setDailyNewLimit(String(n));
                      void saveAdaptive(adaptiveEnabled, n, Number(targetMinutes) || 15);
                    }}
                  >
                    <Text style={[styles.presetChipText, dailyNewLimit === String(n) && styles.presetChipTextActive]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.limitItem, { marginTop: 12 }]}>
              <Text style={styles.limitLabel}>MỤC TIÊU THỜI GIAN (PHÚT / NGÀY)</Text>
              <View style={styles.presetChipsRow}>
                {[10, 15, 20, 30].map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.presetChip, targetMinutes === String(m) && styles.presetChipActive]}
                    onPress={() => {
                      setTargetMinutes(String(m));
                      void saveAdaptive(adaptiveEnabled, Number(dailyNewLimit) || 10, m);
                    }}
                  >
                    <Text style={[styles.presetChipText, targetMinutes === String(m) && styles.presetChipTextActive]}>
                      {m}p
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Default Practice Modes */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>HÌNH THỨC ÔN TẬP MẶC ĐỊNH</Text>
          <TouchableOpacity onPress={handleSelectAllPracticeModes} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.sectionHeaderAction}>
              {practiceModes.length === DEFAULT_PRACTICE_MODES.length ? 'Bỏ chọn bớt' : 'Chọn tất cả (7)'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardBox}>
          <Text style={styles.practiceModeIntro}>
            Các hình thức được tích chọn dưới đây sẽ được ghi nhớ và tự động áp dụng cho mọi phiên ôn tập hằng ngày và ôn theo bộ thẻ cho đến khi bạn thay đổi:
          </Text>
          <View style={{ marginTop: 8 }}>
            {SETTINGS_PRACTICE_OPTIONS.map((opt, idx) => {
              const isSelected = practiceModes.includes(opt.id);
              return (
                <View key={opt.id}>
                  {idx > 0 && <View style={styles.divider} />}
                  <TouchableOpacity
                    style={styles.practiceModeItem}
                    onPress={() => handleTogglePracticeMode(opt.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkboxSquare, isSelected && styles.checkboxSquareActive]}>
                      {isSelected && <Feather name="check" size={13} color="#FFFFFF" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.practiceModeTitle, isSelected && styles.practiceModeTitleActive]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.practiceModeDesc}>{opt.desc}</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {/* FSRS Algorithm Info */}
        <Text style={styles.sectionHeader}>THUẬT TOÁN LẶP LẠI NGẮT QUÃNG</Text>
        <View style={styles.cardBox}>
          <View style={styles.infoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="cpu" size={15} color="#444444" />
              <Text style={styles.infoTitle}>Mô hình thuật toán</Text>
            </View>
            <Text style={styles.infoValue}>FSRS v6</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="target" size={15} color="#444444" />
              <Text style={styles.infoTitle}>Tỉ lệ ghi nhớ mục tiêu</Text>
            </View>
            <Text style={styles.infoValue}>90%</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="repeat" size={15} color="#444444" />
              <Text style={styles.infoTitle}>Cơ chế phản hồi</Text>
            </View>
            <Text style={styles.infoValue}>Quên / Nhớ + Đếm số lần lật</Text>
          </View>
        </View>

        {/* Data & Backup */}
        <Text style={styles.sectionHeader}>DỮ LIỆU & SAO LƯU</Text>
        <View style={styles.cardBox}>
          <TouchableOpacity style={styles.menuRow} onPress={handleMochiImport} activeOpacity={0.7}>
            <View style={[styles.menuIconBox, { backgroundColor: '#F5F5F5' }]}>
              <Feather name="upload" size={16} color="#262626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuRowText}>Nhập bộ thẻ Mochi (.mochi)</Text>
              <Text style={styles.menuRowDesc}>Bảo toàn toàn bộ thẻ, tag và lịch ôn tập</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuRow} onPress={handleMochiExport} activeOpacity={0.7}>
            <View style={[styles.menuIconBox, { backgroundColor: '#F5F5F5' }]}>
              <Feather name="share-2" size={16} color="#262626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuRowText}>Xuất bản sao lưu (.mochi)</Text>
              <Text style={styles.menuRowDesc}>Tạo file ZIP data.json tương thích chuẩn Mochi</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setShowImportBox(!showImportBox)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#F5F5F5' }]}>
              <Feather name="download" size={16} color="#262626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuRowText}>Nhập thẻ nhanh từ Markdown</Text>
              <Text style={styles.menuRowDesc}>Dán văn bản phân cách bằng dấu gạch ngang ---</Text>
            </View>
            <Feather name={showImportBox ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
          </TouchableOpacity>

          {showImportBox && (
            <View style={styles.importArea}>
              {decks.length > 1 && (
                <View style={styles.deckSelectContainer}>
                  <Text style={styles.deckSelectLabel}>Chọn bộ thẻ cần nhập vào:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deckChipsScroll}>
                    {decks.map(d => (
                      <TouchableOpacity
                        key={d.id}
                        style={[styles.deckChip, selectedDeckForImport === d.id && styles.deckChipActive]}
                        onPress={() => setSelectedDeckForImport(d.id)}
                      >
                        <Text style={[styles.deckChipText, selectedDeckForImport === d.id && styles.deckChipTextActive]}>
                          {d.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              <Text style={styles.importHint}>
                Định dạng: Mặt trước và mặt ẩn phân cách bằng `---`. Giữa các thẻ bằng `===`.
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
        <Text style={styles.sectionHeader}>THÔNG TIN ỨNG DỤNG</Text>
        <View style={styles.cardBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoTitle}>Ứng dụng</Text>
            <Text style={styles.infoValue}>Mochi Spaced Repetition</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoTitle}>Phiên bản</Text>
            <Text style={styles.infoValue}>2.0.0 (Offline-First SQLite)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoTitle}>Giọng đọc khả dụng trên máy</Text>
            <Text style={styles.infoValue}>{voiceCount} giọng TTS</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL DROPDOWN CHỌN GIỌNG ĐỌC */}
      <Modal
        visible={showVoiceModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowVoiceModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowVoiceModal(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.voiceModalSheet}>
                {/* Modal Header */}
                <View style={styles.voiceModalHeader}>
                  <View>
                    <Text style={styles.voiceModalTitle}>Chọn giọng đọc phát âm</Text>
                    <Text style={styles.voiceModalSubtitle}>
                      {speechAccent === 'en-US' ? 'Tiếng Anh - Mỹ (en-US)' : 'Tiếng Anh - Anh (en-GB)'} · {baseDeviceList.length} giọng
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setShowVoiceModal(false)}
                  >
                    <Feather name="x" size={20} color="#666666" />
                  </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchBarBox}>
                  <Feather name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchBarInput}
                    placeholder="Tìm theo tên giọng đọc (Samantha, Ava, Daniel...)"
                    placeholderTextColor="#94A3B8"
                    value={voiceSearchQuery}
                    onChangeText={setVoiceSearchQuery}
                  />
                  {voiceSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setVoiceSearchQuery('')}>
                      <Feather name="x-circle" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Voice List Scroll */}
                <ScrollView style={styles.voiceModalList} showsVerticalScrollIndicator={false}>
                  {/* Default system voice item */}
                  <TouchableOpacity
                    style={[styles.voiceModalItem, !selectedVoice && styles.voiceModalItemActive]}
                    onPress={() => handleSelectVoice(null)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.voiceModalItemIcon}>
                      <Feather name="smartphone" size={18} color={!selectedVoice ? '#262626' : '#64748B'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.voiceModalItemName, !selectedVoice && styles.voiceModalItemNameActive]}>
                        Giọng hệ thống mặc định
                      </Text>
                      <Text style={styles.voiceModalItemDesc}>Tự động đồng bộ theo cài đặt hệ điều hành</Text>
                    </View>
                    {!selectedVoice && (
                      <Ionicons name="checkmark-circle" size={20} color="#262626" />
                    )}
                  </TouchableOpacity>

                  {/* Device voices list */}
                  {filteredDeviceVoices.map(v => {
                    const isSelected = selectedVoice === v.identifier || selectedVoice === v.name;
                    const isPreviewing = previewingVoiceId === v.identifier;
                    return (
                      <TouchableOpacity
                        key={v.identifier}
                        style={[styles.voiceModalItem, isSelected && styles.voiceModalItemActive]}
                        onPress={() => handleSelectVoice(v.identifier)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.voiceModalItemIcon}>
                          <Feather name="mic" size={17} color={isSelected ? '#262626' : '#64748B'} />
                        </View>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.voiceModalItemName, isSelected && styles.voiceModalItemNameActive]}>
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
                          <Text style={styles.voiceModalItemDesc}>
                            {v.quality === 'Enhanced' ? 'Chất lượng cao (Enhanced HD)' : 'Giọng chuẩn hệ điều hành'}
                          </Text>
                        </View>

                        {/* Preview speaker button */}
                        <TouchableOpacity
                          style={[styles.previewVoiceBtn, isPreviewing && styles.previewVoiceBtnActive]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handlePreviewDeviceVoice(v);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Feather
                            name={isPreviewing ? 'volume-2' : 'volume-1'}
                            size={16}
                            color={isPreviewing ? '#FFFFFF' : '#444444'}
                          />
                        </TouchableOpacity>

                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color="#262626" style={{ marginLeft: 8 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {/* Fallback to Popular Voices if no device voices matched search */}
                  {filteredDeviceVoices.length === 0 && filteredPopularVoices.map(v => {
                    const isSelected = selectedVoice === v.id;
                    const isPreviewing = previewingVoiceId === v.id;
                    return (
                      <TouchableOpacity
                        key={v.id}
                        style={[styles.voiceModalItem, isSelected && styles.voiceModalItemActive]}
                        onPress={() => handleSelectVoice(v.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.voiceModalItemIcon}>
                          <Feather name="mic" size={17} color={isSelected ? '#262626' : '#64748B'} />
                        </View>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.voiceModalItemName, isSelected && styles.voiceModalItemNameActive]}>
                              {v.name}
                            </Text>
                            <View style={styles.langTag}>
                              <Text style={styles.langTagText}>{v.gender === 'female' ? 'Nữ' : 'Nam'}</Text>
                            </View>
                          </View>
                          <Text style={styles.voiceModalItemDesc}>{v.desc}</Text>
                        </View>

                        <TouchableOpacity
                          style={[styles.previewVoiceBtn, isPreviewing && styles.previewVoiceBtnActive]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handlePreviewVoice(v);
                          }}
                        >
                          <Feather name={isPreviewing ? 'volume-2' : 'volume-1'} size={16} color={isPreviewing ? '#FFFFFF' : '#444444'} />
                        </TouchableOpacity>

                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color="#262626" style={{ marginLeft: 8 }} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  sectionHeader: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4
  },
  sectionHeaderTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.8
  },
  sectionHeaderAction: {
    fontSize: 12,
    fontWeight: '600',
    color: '#262626'
  },
  practiceModeIntro: {
    fontSize: 12.5,
    color: '#666666',
    lineHeight: 18,
    marginBottom: 4
  },
  practiceModeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#FFFFFF'
  },
  checkboxSquareActive: {
    backgroundColor: '#262626',
    borderColor: '#262626'
  },
  practiceModeTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333'
  },
  practiceModeTitleActive: {
    fontWeight: '700',
    color: '#111111'
  },
  practiceModeDesc: {
    fontSize: 12,
    color: '#777777',
    marginTop: 2
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#EAEAEA'
  },
  // Profile styles
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700'
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222222'
  },
  profileSub: {
    fontSize: 12.5,
    color: '#666666',
    marginTop: 2
  },
  nameDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  editNameBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5'
  },
  editNameBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#222222'
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  nameInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    color: '#222222',
    borderWidth: 1,
    borderColor: '#E5E5E5'
  },
  saveNameBtn: {
    backgroundColor: '#262626',
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveNameBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13
  },
  cancelNameBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center'
  },
  // Segmented control
  inputLabel: {
    fontSize: 11,
    color: '#888888',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5'
  },
  segmentBtnActive: {
    backgroundColor: '#262626',
    borderColor: '#262626'
  },
  flagIcon: {
    fontSize: 15,
    marginRight: 6
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555555'
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  // Voice Dropdown Button
  voiceDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginVertical: 4
  },
  voiceDropdownIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  voiceDropdownName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222222'
  },
  voiceDropdownDesc: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2
  },
  voiceDropdownAction: {
    marginLeft: 'auto'
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 3
  },
  changePillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#222222'
  },
  // Chips row (pitch & speed)
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 4,
    flexWrap: 'wrap'
  },
  chipPill: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5'
  },
  chipPillActive: {
    backgroundColor: '#262626',
    borderColor: '#262626'
  },
  chipPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444444'
  },
  chipPillTextActive: {
    color: '#FFFFFF'
  },
  testSpeechBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#262626',
    borderRadius: 8,
    paddingVertical: 11,
    marginTop: 10
  },
  testSpeechBtnActive: {
    backgroundColor: '#1E1E1E'
  },
  testSpeechBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5'
  },
  tipCardText: {
    flex: 1,
    fontSize: 11.5,
    color: '#555555',
    lineHeight: 16.5
  },
  // Switch row
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6
  },
  switchInfo: {
    flex: 1,
    marginRight: 12
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222222'
  },
  switchDesc: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2
  },
  limitsBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEEEEE'
  },
  limitItem: {},
  limitLabel: {
    fontSize: 10.5,
    color: '#888888',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  presetChipsRow: {
    flexDirection: 'row',
    gap: 8
  },
  presetChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5'
  },
  presetChipActive: {
    backgroundColor: '#262626',
    borderColor: '#262626'
  },
  presetChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#444444'
  },
  presetChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  // Common info rows & divider
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 10
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6
  },
  infoTitle: {
    fontSize: 13.5,
    color: '#444444'
  },
  infoValue: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#222222'
  },
  // Data & Menu rows
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6
  },
  menuIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  menuRowText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#222222'
  },
  menuRowDesc: {
    fontSize: 11.5,
    color: '#666666',
    marginTop: 2
  },
  importArea: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 12
  },
  deckSelectContainer: {
    marginBottom: 10
  },
  deckSelectLabel: {
    fontSize: 12,
    color: '#555555',
    marginBottom: 6,
    fontWeight: '600'
  },
  deckChipsScroll: {
    gap: 6
  },
  deckChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5'
  },
  deckChipActive: {
    backgroundColor: '#262626',
    borderColor: '#262626'
  },
  deckChipText: {
    fontSize: 12,
    color: '#444444',
    fontWeight: '600'
  },
  deckChipTextActive: {
    color: '#FFFFFF'
  },
  importHint: {
    fontSize: 11.5,
    color: '#666666',
    marginBottom: 8
  },
  importInput: {
    height: 90,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#222222',
    textAlignVertical: 'top',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5'
  },
  importSubmitBtn: {
    backgroundColor: '#262626',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  importSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600'
  },
  // Modal styles for Voice Selector
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end'
  },
  voiceModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '82%',
    paddingTop: 18,
    paddingBottom: 32,
    paddingHorizontal: 18
  },
  voiceModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  voiceModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222222'
  },
  voiceModalSubtitle: {
    fontSize: 12.5,
    color: '#666666',
    marginTop: 2
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5'
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5'
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#222222'
  },
  voiceModalList: {
    maxHeight: 460
  },
  voiceModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#EAEAEA'
  },
  voiceModalItemActive: {
    backgroundColor: '#F5F5F5',
    borderColor: '#262626'
  },
  voiceModalItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  voiceModalItemName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#222222'
  },
  voiceModalItemNameActive: {
    color: '#000000',
    fontWeight: '700'
  },
  voiceModalItemDesc: {
    fontSize: 11.5,
    color: '#666666',
    marginTop: 2
  },
  previewVoiceBtn: {
    padding: 7,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginLeft: 6
  },
  previewVoiceBtnActive: {
    backgroundColor: '#262626',
    borderColor: '#262626'
  },
  langTag: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4
  },
  langTagText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#555555'
  },
  enhancedTag: {
    backgroundColor: '#EFEFEF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4
  },
  enhancedTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#222222'
  }
});
