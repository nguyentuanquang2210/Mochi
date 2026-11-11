import { Platform } from 'react-native';

const REMINDER_MESSAGES = [
  'Ồ, hóa ra bạn vẫn dùng điện thoại à? Thế mà tôi cứ tưởng bạn bận lắm chứ.',
  'Học tiếng không làm bạn nghèo đi, nhưng bỏ học thì làm Duo buồn đấy.',
  'Bạn có thời gian lướt mạng xã hội nhưng không có 2 phút cho tôi sao?',
  'Cậu làm tôi buồn lắm đấy. Giờ thì làm bài đi!',
  'Hôm nay bạn bỏ bê tôi, ngày mai đừng trách tôi.',
  'Tôi thấy bạn đang phớt lờ thông báo của tôi đấy nhé...',
  "Cậu nghĩ bấm 'Tắt thông báo' là trốn được tôi sao?"
];

let handlerConfigured = false;

// Do not import the native module at application startup. This keeps the study
// app usable in Expo Go / an outdated development client while still allowing
// notifications in a rebuilt native app.
function notifications(): any {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require('expo-notifications');
  if (!handlerConfigured) {
    module.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false })
    });
    handlerConfigured = true;
  }
  return module;
}

/** Schedules gentle daytime reminders only: 09:15, 14:15 and 19:15 local time.
 * They deliberately avoid the common Vietnamese lunch/rest and night periods. */
export const StudyReminders = {
  async schedule(): Promise<boolean> {
    const Notifications = notifications();
    const current = await Notifications.getPermissionsAsync();
    // Expo's permission shape varies between SDK/native targets.
    const currentGranted = (current as any).granted === true || (current as any).status === 'granted';
    const permission = currentGranted ? current : await Notifications.requestPermissionsAsync();
    const granted = (permission as any).granted === true || (permission as any).status === 'granted';
    if (!granted) return false;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('study-reminders', {
        name: 'Nhắc học từ vựng', importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'study-reminder.mp3', vibrationPattern: [0, 180, 100, 180]
      });
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const [index, hour] of [9, 14, 19].entries()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Mochi nhắc bạn học', body: REMINDER_MESSAGES[index % REMINDER_MESSAGES.length],
          sound: 'study-reminder.mp3', ...(Platform.OS === 'android' ? { channelId: 'study-reminders' } : {})
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 15 }
      });
    }
    return true;
  },
  async cancel(): Promise<void> { await notifications().cancelAllScheduledNotificationsAsync(); }
};
