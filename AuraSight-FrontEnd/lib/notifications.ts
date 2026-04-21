// 每日提醒封装 + Expo 推送令牌注册
// 设计思路：
// - 单个 daily trigger（Expo 会自动每天同一时间触发）
// - 关闭时取消所有已调度通知
// - 换时间 = 先取消再重新 schedule
// - registerForPushNotifications() 获取 Expo 推送令牌并上传到后端
// - setupNotificationHandler() 监听通知点击并支持深链接导航
import * as Notifications from "expo-notifications";
import * as Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

const TIME_KEY = "@aurasight_reminder_time"; // 存 "HH:mm"
const ON_KEY = "@aurasight_reminder_on";
const NOTIF_ID_KEY = "@aurasight_reminder_notif_id";
const PUSH_TOKEN_KEY = "@aurasight_push_token";

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

// ── Expo Push Token Registration ───────────────────────
/**
 * 获取 Expo 推送令牌，上传到后端，并保存到本地
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  try {
    // 确保有通知权限
    const granted = await ensurePermission();
    if (!granted) {
      console.warn("Notification permission not granted");
      return null;
    }

    // 获取 Expo 推送令牌
    // projectId 只在 EAS Build 环境下可用；Expo Go / 本地开发时静默跳过
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId ??
      null;
    if (!projectId) {
      if (__DEV__) {
        console.log("[Push] Skipping push token registration — no EAS projectId (normal in Expo Go)");
      }
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushTokenString = token.data;

    // 上传到后端
    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.100:3000";
      const response = await fetch(`${API_URL}/user/push-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          pushToken: pushTokenString,
          platform: "expo",
        }),
      });

      if (!response.ok) {
        console.warn("Failed to register push token:", response.statusText);
      }
    } catch (err) {
      console.warn("Error uploading push token to backend:", err);
    }

    // 保存到本地
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushTokenString);
    return pushTokenString;
  } catch (err) {
    console.error("Failed to register for push notifications:", err);
    return null;
  }
}

/**
 * 获取本地保存的推送令牌
 */
export async function getPushToken(): Promise<string | null> {
  return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

// ── Notification Tap Handling (Deep Linking) ──────────
/**
 * 设置通知点击处理器，支持深链接导航
 * 期望通知数据格式：{ screen: "/report", params: { id: "xxx" } }
 *
 * 必须在 root _layout.tsx 中调用一次
 */
export function setupNotificationHandler(router: any) {
  // 监听用户点击通知时的事件
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as any;

    if (data?.screen) {
      // 支持带参数的深链接导航
      const params = data.params || {};
      const paramString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
        .join("&");

      const url = paramString ? `${data.screen}?${paramString}` : data.screen;
      router.push(url);
    }
  });

  return subscription;
}

// ── Notification Types ────────────────────────────────
/**
 * 支持的通知类型枚举和接口
 */
export type NotificationType =
  | "daily_reminder"
  | "scan_result_ready"
  | "community_reply"
  | "streak_reminder"
  | "weekly_summary";

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}
