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

export const SoundEffects = {
  setEnabled(enabled: boolean) {
    soundEnabled = enabled;
  },

  isEnabled() {
    return soundEnabled;
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
    }
  },

  async play(type: SoundEffectType) {
    if (!soundEnabled) return;
    try {
      await this.stopCurrent();

      let assetSource: any;
      if (type === 'streakLost') {
        const pick = Math.random() < 0.5 ? 'forgot' : 'wrongAgain';
        assetSource = SOUND_ASSETS[pick];
      } else {
        assetSource = SOUND_ASSETS[type];
      }

      if (!assetSource) return;

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      }).catch(() => {});

      const { sound } = await Audio.Sound.createAsync(
        assetSource,
        { shouldPlay: true, volume: 1.0 }
      );

      currentSound = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          if (currentSound === sound) {
            currentSound = null;
          }
        }
      });
    } catch (error) {
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
      await this.play('praise3');
    } else if (streak === 6) {
      // Mốc 6 câu đúng: Cổ vũ tinh thần
      await this.play('cheer6');
    } else if (streak === 12) {
      // Mốc 12 câu đúng: Cực kỳ xuất sắc
      await this.play('master12');
    } else if (streak > 12 && streak % 6 === 0) {
      // Các mốc tiếp theo cứ mỗi 6 câu (18, 24...)
      await this.play('cheer6');
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
      await this.play('streakLost');
    } else if (consecutiveWrong >= 2) {
      // Hoặc khi làm sai liên tiếp 2 lần trở lên
      await this.play('wrongAgain');
    }
  }
};
