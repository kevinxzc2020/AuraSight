/**
 * AuraSight — Data-use consent
 *
 * 用户首次使用 AI 检测或把照片上传到云端之前，必须先同意我们使用图片
 * 进行后续的数据分析和模型训练。同意后持久化到 AsyncStorage，下次不再询问。
 * 用户可以在 Settings 里随时撤销同意；撤销后再次触发相关动作会重新弹窗。
 *
 * Storage key: @aurasight_data_consent
 *   {
 *     accepted: boolean,
 *     acceptedAt: ISO string | null,
 *     version: number   // 同意书版本号——以后如果改了条款可以让旧用户重新签
 *   }
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const CONSENT_KEY = "@aurasight_data_consent";
export const CONSENT_VERSION = 1;

export interface ConsentState {
  accepted: boolean;
  acceptedAt: string | null;
  version: number;
}

const DEFAULT: ConsentState = {
  accepted: false,
  acceptedAt: null,
  version: CONSENT_VERSION,
};

export async function getConsent(): Promise<ConsentState> {
  try {
    const raw = await AsyncStorage.getItem(CONSENT_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as ConsentState;
    // 条款升版了——以前同意的不再有效
    if (parsed.version !== CONSENT_VERSION) return DEFAULT;
    return parsed;
  } catch {
    return DEFAULT;
  }
}

export async function hasConsent(): Promise<boolean> {
  const c = await getConsent();
  return c.accepted;
}

export async function acceptConsent(): Promise<void> {
  const next: ConsentState = {
    accepted: true,
    acceptedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify(next));
}

export async function revokeConsent(): Promise<void> {
  await AsyncStorage.removeItem(CONSENT_KEY);
}

/**
 * 完整撤销：清本地 flag + 通知后端把该用户的历史记录从训练集里剔除
 * （后端把所有 scans 打上 can_train=false）。
 *
 * 后端调用失败时（离线/服务挂了）本地状态照样清除，不向 UI 抛错——
 * 这样用户关掉开关的体感是"立刻生效"。失败只记日志，将来可以加离线重试队列。
 */
export async function revokeConsentEverywhere(userId: string): Promise<void> {
  await revokeConsent();
  try {
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
    await fetch(`${API_URL}/consent/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
  } catch (err) {
    console.warn("revokeConsent: backend call failed, local state cleared", err);
  }
}
