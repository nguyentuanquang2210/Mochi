import { Audio } from 'expo-av';

export type SoundEffectType =
  | 'praise3'          // đúng 3 câu liên tiếp: khen.mp3
  | 'cheer6'           // đúng 6 từ liên tiếp: roi co len em.mp3
  | 'master12'         // đúng 12 từ liên tiếp: khidung4lantrolen.mp3
  | 'streakLost'       // làm sai mất chuỗi đúng: ngẫu nhiên khongnho.mp3 hoặc lamsailan2trolon.mp3
  | 'forgot'           // khongnho.mp3
  | 'wrongAgain'       // lamsailan2trolon.mp3
  | 'reminderHoc'      // thongbaohoc.mp3
  | 'reminderThongBao'; // thongbao.mp3

const SOUND_ASSETS: Record<string, any> = {
  praise3: require('../../assets/sounds/khen.mp3'),
  cheer6: require('../../assets/sounds/roicolenem.mp3'),
  master12: require('../../assets/sounds/khidung4lantrolen.mp3'),
  forgot: require('../../assets/sounds/khongnho.mp3'),
  wrongAgain: require('../../assets/sounds/lamsailan2trolon.mp3'),
  reminderHoc: require('../../assets/sounds/thongbaohoc.mp3'),
  reminderThongBao: require('../../assets/sounds/thongbao.mp3'),
};

let currentSound: Audio.Sound | null = null;
let soundEnabled = true;
let isPlaying = false;
let lastPlayTime = 0;
const SPAM_COOLDOWN_MS = 2500; // Thời gian giãn cách tối thiểu 2.5s để chống spam dồn dập

export const SoundEffects = {
  setEnabled(enabled: boolean) {
    soundEnabled = enabled;
  },

  isEnabled() {
    return soundEnabled;
  },

  isCurrentlyPlaying() {
    return isPlaying;
  },

  async stopCurrent() {
    if (currentSound) {
      try {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
      } catch {
        // Safe ignore
      }
      currentSound = null;
      isPlaying = false;
    }
  },

  /**
   * Phát âm thanh với cơ chế:
   * 1. Max Volume: Ép phát qua loa ngoài chính, không bị ducking hay giảm âm.
   * 2. Anti-Spam: Nếu tiếng đang nói thì phát trọn vẹn hết câu, KHÔNG bị dừng cụt hay cắt ngang.
   * @param type Loại âm thanh
   * @param force Nếu true (khi bấm nghe thử trong Cài đặt), ngắt âm cũ và phát ngay
   */
  async play(type: SoundEffectType, force = false) {
    if (!soundEnabled) return;

    const now = Date.now();

    // CHỐNG SPAM & CHỐNG CẮT NGANG GIỌNG:
    // Nếu một voice đang nói dở và không có cờ force -> Để nói trọn vẹn câu, không ngắt cụt giữa chừng
    if (isPlaying && !force) {
      return;
    }

    // Giãn cách tối thiểu giữa 2 lần phát âm thanh tự động để tránh dồn dập
    if (!force && now - lastPlayTime < SPAM_COOLDOWN_MS) {
      return;
    }

    try {
      // Dừng âm cũ nếu có (hoặc khi người dùng chủ động bấm nghe thử âm thanh khác)
      if (currentSound) {
        try {
          await currentSound.stopAsync();
          await currentSound.unloadAsync();
        } catch {
          // Safe ignore
        }
        currentSound = null;
        isPlaying = false;
      }

      let assetSource: any;
      if (type === 'streakLost') {
        const pick = Math.random() < 0.5 ? 'forgot' : 'wrongAgain';
        assetSource = SOUND_ASSETS[pick];
      } else {
        assetSource = SOUND_ASSETS[type];
      }

      if (!assetSource) return;

      // CẤU HÌNH ÂM LƯỢNG LỚN NHẤT & PHÁT LOA NGOÀI:
      // - playThroughEarpieceAndroid: false -> Phát qua loa ngoài chính (không bị nhỏ như loa thoại)
      // - shouldDuckAndroid: false -> Không bị hệ điều hành tự động giảm nhỏ âm lượng
      // - playsInSilentModeIOS: true -> Hoạt động chuẩn cả khi gạt rung trên iOS
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      }).catch(() => {});

      isPlaying = true;
      lastPlayTime = now;

      const { sound } = await Audio.Sound.createAsync(
        assetSource,
        { shouldPlay: true, volume: 1.0 }
      );

      currentSound = sound;
      // Đảm bảo volume ở mức 100%
      await sound.setVolumeAsync(1.0).catch(() => {});

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            isPlaying = false;
            sound.unloadAsync().catch(() => {});
            if (currentSound === sound) {
              currentSound = null;
            }
          }
        } else if ((status as any).error) {
          isPlaying = false;
          currentSound = null;
        }
      });
    } catch (error) {
      isPlaying = false;
      currentSound = null;
      console.warn('SoundEffects playback error:', error);
    }
  },

  /**
   * Phát âm thanh khen thưởng theo cột mốc chuỗi câu đúng trong phiên ôn tập
   * @param streak Số câu trả lời đúng liên tiếp hiện tại
   */
  async playForStreak(streak: number) {
    if (streak === 3) {
      // Mốc 3 câu đúng: Khen ngợi khích lệ ban đầu
      await this.play('praise3', false);
    } else if (streak === 6) {
      // Mốc 6 câu đúng: Cổ vũ tinh thần
      await this.play('cheer6', false);
    } else if (streak === 12) {
      // Mốc 12 câu đúng: Cực kỳ xuất sắc
      await this.play('master12', false);
    } else if (streak > 12 && streak % 6 === 0) {
      // Các mốc tiếp theo cứ mỗi 6 câu (18, 24...)
      await this.play('cheer6', false);
    }
  },

  /**
   * Phát âm thanh khi mất chuỗi hoặc làm sai nhiều lần
   * @param prevStreak Chuỗi đúng trước khi sai
   * @param consecutiveWrong Số lần làm sai liên tiếp
   */
  async playStreakLost(prevStreak: number, consecutiveWrong: number) {
    // Chỉ phát nếu người học đang có chuỗi từ 3 câu đúng trở lên mà bị sai
    if (prevStreak >= 3) {
      await this.play('streakLost', false);
    } else if (consecutiveWrong >= 2) {
      // Hoặc khi làm sai liên tiếp 2 lần trở lên
      await this.play('wrongAgain', false);
    }
  }
};
