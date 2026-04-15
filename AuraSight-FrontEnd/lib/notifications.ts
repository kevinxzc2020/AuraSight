// 每日提醒封装
// 设计思路：
// - 单个 daily trigger（Expo 会自动每天同一时间触发）
// - 关闭时取消所有已调度通知
// - 换时间 = 先取消再重新 schedule
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TIME_KEY = "@aurasight_reminder_time"; // 存 "HH:mm"
const ON_KEY = "@aurasight_reminder_on";
const NOTIF_ID_KEY = "@aurasight_reminder_notif_id";

// 前台也显示通知（否则 App 在前台时系统会静默）
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function getReminderTime(): Promise<{ hour: number; minute: number }> {
  const raw = await AsyncStorage.getItem(TIME_KEY);
  if (raw && /^\d{1,2}:\d{1,2}$/.test(raw)) {
    const [h, m] = raw.split(":").map(Number);
    return { hour: h, minute: m };
  }
  return { hour: 20, minute: 0 }; // 默认晚上 8 点
}

export async function setReminderTime(hour: number, minute: number) {
  await AsyncStorage.setItem(TIME_KEY, `${hour}:${minute}`);
}

export async function isReminderOn(): Promise<boolean> {
  return (await AsyncStorage.getItem(ON_KEY)) === "true";
}

export async function ensurePermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

async function cancelExisting() {
  const id = await AsyncStorage.getItem(NOTIF_ID_KEY);
  if (id) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
    await AsyncStorage.removeItem(NOTIF_ID_KEY);
  }
  // 兜底：如果之前状态残留，把该 app 下所有 scheduled 清一遍
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}

export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  title: string,
  body: string,
): Promise<string | null> {
  await cancelExisting();
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      } as any,
    });
    await AsyncStorage.setItem(NOTIF_ID_KEY, id);
    await AsyncStorage.setItem(ON_KEY, "true");
    return id;
  } catch (err) {
    console.error("Failed to schedule reminder:", err);
    return null;
  }
}

export async function disableReminder() {
  await cancelExisting();
  await AsyncStorage.setItem(ON_KEY, "false");
}

export function formatTime(hour: number, minute: number): string {
  const h = hour.toString().padStart(2, "0");
  const m = minute.toString().padStart(2, "0");
  return `${h}:${m}`;
}
