import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { database } from '../data/database';

export type SpeechAccent = 'en-US' | 'en-GB';

export interface PopularVoice {
  id: string; // Tên giọng hoặc mã định danh
  name: string;
  accent: SpeechAccent;
  desc: string;
  gender: 'female' | 'male';
}

export const POPULAR_VOICES: PopularVoice[] = [
  { id: 'Samantha', name: 'Samantha (Mỹ)', accent: 'en-US', desc: 'Giọng nữ Mỹ kinh điển của Siri, phát âm chuẩn và rõ ràng', gender: 'female' },
  { id: 'Ava', name: 'Ava (Mỹ)', accent: 'en-US', desc: 'Giọng nữ Mỹ thế hệ mới, tự nhiên, truyền cảm', gender: 'female' },
  { id: 'Allison', name: 'Allison (Mỹ)', accent: 'en-US', desc: 'Giọng nữ Mỹ thanh lịch, chuẩn mực bản xứ', gender: 'female' },
  { id: 'Susan', name: 'Susan (Mỹ)', accent: 'en-US', desc: 'Giọng nữ Mỹ ấm áp, truyền cảm', gender: 'female' },
  { id: 'Tom', name: 'Tom (Mỹ)', accent: 'en-US', desc: 'Giọng nam Mỹ dứt khoát, mạnh mẽ', gender: 'male' },
  { id: 'Daniel', name: 'Daniel (Anh)', accent: 'en-GB', desc: 'Giọng nam Anh - Anh chuẩn Oxford sang trọng', gender: 'male' },
  { id: 'Oliver', name: 'Oliver (Anh)', accent: 'en-GB', desc: 'Giọng nam Anh - Anh hiện đại, tự nhiên', gender: 'male' },
  { id: 'Stephanie', name: 'Stephanie (Anh)', accent: 'en-GB', desc: 'Giọng nữ Anh - Anh dịu dàng, phát âm chuẩn', gender: 'female' },
  { id: 'Serena', name: 'Serena (Anh)', accent: 'en-GB', desc: 'Giọng nữ Anh - Anh kinh điển', gender: 'female' }
];

export interface SpeechSettings {
  rate: number; // 0.75 (chậm), 0.9 (tự nhiên), 1.0 (chuẩn), 1.25 (nhanh)
  pitch: number; // 0.85 (trầm ấm), 1.0 (chuẩn), 1.15 (trong trẻo)
  accent: SpeechAccent;
  voiceIdentifier?: string | null;
}

class SpeechServiceImpl {
  private currentSettings: SpeechSettings = {
    rate: 0.95,
    pitch: 1.0,
    accent: 'en-US',
    voiceIdentifier: null
  };

  private availableVoices: Speech.Voice[] = [];
  private isInitialized = false;
  private isSpeaking = false;
  private audioModeConfigured = false;
  private keepAliveSound: Audio.Sound | null = null;

  constructor() {
    this.init();
  }

  /**
    * Cấu hình AudioSession cho iOS để phát âm thanh ngay cả khi gạt nút im lặng (Silent Mode).
    * QUAN TRỌNG: Chỉ cấu hình một lần duy nhất lúc khởi động, không gọi lại lặp đi lặp lại
    * vì việc gọi lại sẽ gây gián đoạn Audio Subsystem làm khựng/giật âm thanh ("khực").
    */
  async configureAudioSession() {
    if (this.audioModeConfigured) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false
      });
      this.audioModeConfigured = true;
    } catch (e) {
      console.warn('Audio.setAudioModeAsync error:', e);
    }
  }

  /**
   * Giữ cấu hình Audio luôn sẵn sàng trong suốt quá trình ôn tập thẻ.
   */
  async startKeepAlive() {
    try {
      await this.configureAudioSession();
    } catch (e) {
      // Gracefully ignore
    }
  }

  /**
   * Dọn dẹp khi rời khỏi màn hình ôn tập
   */
  async stopKeepAlive() {
    // Giữ nguyên AudioSession để không gây gián đoạn DAC
  }

  /**
   * Làm nóng bộ tổng hợp giọng nói lúc khởi động app
   * Prime TTS engine ngay lúc app khởi động để phát âm từ đầu tiên mượt mà, không bị khựng giật
   */
  async warmup() {
    try {
      await this.configureAudioSession();
      await this.getVoicesAsync();
      try {
        Speech.speak(' ', {
          language: this.currentSettings.accent,
          rate: 2.0,
          volume: 0,
          onDone: () => {},
          onError: () => {}
        });
      } catch {}
    } catch {}
  }

  /**
   * Khởi tạo: Cấu hình audio session, tải voice có sẵn trên thiết bị & nạp cấu hình đã lưu từ SQLite
   */
  async init() {
    if (this.isInitialized) return;
    try {
      // 1. Kích hoạt chế độ phát âm thanh bỏ qua nút gạt im lặng trên iPhone (chỉ gọi 1 lần)
      await this.configureAudioSession();

      // 2. Quét danh sách giọng đọc tiếng Anh của hệ điều hành
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        this.availableVoices = voices.filter(v => v.language.toLowerCase().startsWith('en'));
      } catch (voiceErr) {
        console.warn('getAvailableVoicesAsync warning:', voiceErr);
      }
      
      // 3. Tải cấu hình tốc độ, cao độ & chất giọng từ SQLite user_settings
      const db = await database();
      const rateRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM user_settings WHERE key = 'speechRate'"
      );
      const pitchRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM user_settings WHERE key = 'speechPitch'"
      );
      const accentRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM user_settings WHERE key = 'speechAccent'"
      );
      const voiceRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM user_settings WHERE key = 'speechVoice'"
      );

      if (rateRow?.value) {
        const parsedRate = parseFloat(rateRow.value);
        if (!isNaN(parsedRate) && parsedRate >= 0.5 && parsedRate <= 2.0) {
          this.currentSettings.rate = parsedRate;
        }
      }

      if (pitchRow?.value) {
        const parsedPitch = parseFloat(pitchRow.value);
        if (!isNaN(parsedPitch) && parsedPitch >= 0.5 && parsedPitch <= 2.0) {
          this.currentSettings.pitch = parsedPitch;
        }
      }

      if (accentRow?.value === 'en-US' || accentRow?.value === 'en-GB') {
        this.currentSettings.accent = accentRow.value;
      }

      if (voiceRow?.value) {
        this.currentSettings.voiceIdentifier = voiceRow.value;
      }

      this.isInitialized = true;
    } catch (e) {
      console.warn('SpeechService init warning:', e);
      this.isInitialized = true;
    }
  }

  /**
   * Lấy cấu hình phát âm hiện tại
   */
  getSettings(): SpeechSettings {
    return { ...this.currentSettings };
  }

  /**
   * Lưu cấu hình phát âm vào CSDL SQLite
   */
  async updateSettings(newSettings: Partial<SpeechSettings>) {
    if (newSettings.rate !== undefined) {
      this.currentSettings.rate = Math.max(0.5, Math.min(1.5, newSettings.rate));
    }
    if (newSettings.pitch !== undefined) {
      this.currentSettings.pitch = Math.max(0.5, Math.min(1.5, newSettings.pitch));
    }
    if (newSettings.accent !== undefined) {
      this.currentSettings.accent = newSettings.accent;
    }
    if (newSettings.voiceIdentifier !== undefined) {
      this.currentSettings.voiceIdentifier = newSettings.voiceIdentifier;
    }

    try {
      const db = await database();
      await db.runAsync(
        "INSERT OR REPLACE INTO user_settings (key, value) VALUES ('speechRate', ?)",
        String(this.currentSettings.rate)
      );
      await db.runAsync(
        "INSERT OR REPLACE INTO user_settings (key, value) VALUES ('speechPitch', ?)",
        String(this.currentSettings.pitch)
      );
      await db.runAsync(
        "INSERT OR REPLACE INTO user_settings (key, value) VALUES ('speechAccent', ?)",
        this.currentSettings.accent
      );
      await db.runAsync(
        "INSERT OR REPLACE INTO user_settings (key, value) VALUES ('speechVoice', ?)",
        this.currentSettings.voiceIdentifier || ''
      );
    } catch (e) {
      console.warn('Could not persist speech settings:', e);
    }
  }

  /**
   * Lọc bỏ các ký tự Markdown, Cloze, liên kết để giọng đọc phát âm chuẩn xác từ/câu
   */
  cleanText(rawText: string): string {
    if (!rawText) return '';
    return rawText
      .replace(/<<([^>]+)>>/g, '$1') // <<cloze>> -> cloze
      .replace(/\[\[([^\]]+)\]\]/g, '$1') // [[link]] -> link
      .replace(/[*_#>`~]/g, '') // bold, italic, headers, quotes
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Phát âm từ hoặc câu ngay lập tức, phản hồi siêu mượt, không giật khực.
   */
  async speak(text: string, customOptions?: {
    rate?: number;
    pitch?: number;
    accent?: SpeechAccent;
    voice?: string | null;
  }) {
    const textToSpeak = this.cleanText(text);
    if (!textToSpeak) return;

    try {
      // 1. Chỉ cấu hình Audio Session nếu chưa từng cấu hình (Không gọi lặp lại để tránh giật lag)
      if (!this.audioModeConfigured) {
        await this.configureAudioSession();
      }

      // 2. Dừng từ đang đọc trước đó nếu đang phát âm
      if (this.isSpeaking) {
        try {
          Speech.stop();
          await new Promise(r => setTimeout(r, 35));
        } catch {}
      }

      const accent = customOptions?.accent || this.currentSettings.accent;
      const rate = customOptions?.rate || this.currentSettings.rate;
      const pitch = customOptions?.pitch || this.currentSettings.pitch;
      const chosenVoice = customOptions?.voice !== undefined ? customOptions.voice : this.currentSettings.voiceIdentifier;

      this.isSpeaking = true;

      // Tìm voice identifier tối ưu nếu người dùng chọn giọng cụ thể
      let voiceToUse: Speech.Voice | undefined = undefined;
      if (chosenVoice) {
        voiceToUse = this.availableVoices.find(
          v => v.identifier === chosenVoice ||
               v.name.toLowerCase() === chosenVoice.toLowerCase() ||
               v.identifier.toLowerCase().includes(chosenVoice.toLowerCase())
        );
      }

      const speechOptions: Speech.SpeechOptions = {
        rate,
        pitch,
        onDone: () => {
          this.isSpeaking = false;
        },
        onStopped: () => {
          this.isSpeaking = false;
        },
        onError: (err) => {
          this.isSpeaking = false;
          console.warn('Speech playback error, attempting fallback:', err);
          // Dự phòng: Nếu voice identifier gây lỗi trên iOS, tự động đọc lại bằng language chuẩn
          if (voiceToUse) {
            Speech.speak(textToSpeak, {
              language: accent,
              rate,
              pitch
            });
          }
        }
      };

      if (voiceToUse) {
        speechOptions.voice = voiceToUse.identifier;
        speechOptions.language = voiceToUse.language;
      } else {
        speechOptions.language = accent;
      }

      Speech.speak(textToSpeak, speechOptions);
    } catch (e) {
      console.warn('Speech playback failed:', e);
      this.isSpeaking = false;
    }
  }

  /**
   * Dừng phát âm ngay lập tức
   */
  async stop() {
    try {
      Speech.stop();
      this.isSpeaking = false;
    } catch {
      this.isSpeaking = false;
    }
  }

  /**
   * Trả về danh sách giọng đọc tiếng Anh tìm thấy trên thiết bị
   */
  getVoices(): Speech.Voice[] {
    return this.availableVoices;
  }

  async getVoicesAsync(): Promise<Speech.Voice[]> {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      this.availableVoices = voices.filter(v => v.language.toLowerCase().startsWith('en'));
      return this.availableVoices;
    } catch {
      return this.availableVoices;
    }
  }
}

export const SpeechService = new SpeechServiceImpl();
