/**
 * AuraSight — Free-tier quota tracking
 *
 * Free users get WEEKLY_AI_LIMIT AI scans per rolling 7-day window.
 * VIP users bypass all checks.
 *
 * Storage key: @aurasight_ai_quota
 *   { weekStart: ISO string, used: number }
 * When now - weekStart >= 7 days, the window resets.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const QUOTA_KEY = "@aurasight_ai_quota";
export const WEEKLY_AI_LIMIT = 1; // Free tier: 1 AI scan per week
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface QuotaState {
  weekStart: string; // ISO timestamp of window start
  used: number;
}

function isoNow(): string {
  return new Date().toISOString();
}

async function readQuota(): Promise<QuotaState> {
  try {
    const raw = await AsyncStorage.getItem(QUOTA_KEY);
    if (!raw) return { weekStart: isoNow(), used: 0 };
    const parsed = JSON.parse(raw) as QuotaState;
    // Reset window if expired
    const elapsed = Date.now() - new Date(parsed.weekStart).getTime();
    if (elapsed >= WEEK_MS || isNaN(elapsed)) {
      return { weekStart: isoNow(), used: 0 };
    }
    return parsed;
  } catch {
    return { weekStart: isoNow(), used: 0 };
  }
}

async function writeQuota(state: QuotaState): Promise<void> {
  await AsyncStorage.setItem(QUOTA_KEY, JSON.stringify(state));
}

/** Summary for UI display (remaining count, reset time). */
export interface QuotaSummary {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: Date; // when the current window resets
}

export async function getQuotaSummary(): Promise<QuotaSummary> {
  const q = await readQuota();
  const resetsAt = new Date(new Date(q.weekStart).getTime() + WEEK_MS);
  return {
    used: q.used,
    limit: WEEKLY_AI_LIMIT,
    remaining: Math.max(0, WEEKLY_AI_LIMIT - q.used),
    resetsAt,
  };
}

/**
 * 从 AsyncStorage 直接拉 mode——不依赖 React state。
 *
 * 为什么不用 useUser() 传进来的 isVIP？
 * 因为 camera 页初次 mount 时 UserContext 可能还在 isLoading=true，
 * 这一瞬间 user=null → isVIP=false → canUseAI 按免费用户算 → 已用过
 * 这周配额的 VIP 直接被 aiLocked。AsyncStorage 是实打实的持久层，
 * settings/profile/vip 页一改马上可见，不存在 state 时序问题。
 *
 * 读两个 key 都作对账（兼容老代码路径）：
 *   @aurasight_user_mode — settings/profile/vip 直接写的独立 key
 *   @aurasight_user     — UserContext 维护的 JSON blob，里面有 mode
 */
async function readIsVIPFromStorage(): Promise<boolean> {
  try {
    const [mode, userRaw] = await Promise.all([
      AsyncStorage.getItem("@aurasight_user_mode"),
      AsyncStorage.getItem("@aurasight_user"),
    ]);
    if (mode === "vip") return true;
    if (userRaw) {
      const u = JSON.parse(userRaw) as { mode?: string };
      if (u?.mode === "vip") return true;
    }
  } catch {
    // 忽略，按非 VIP 处理
  }
  return false;
}

/**
 * True if the user has at least 1 AI scan left this week.
 *
 * 参数 `isVIP` 是调用方的提示（UI 可能已经拿到了 React state），
 * 但我们会再从 AsyncStorage 对账一次——只要任一路径显示是 VIP，就放行。
 * 这样 React state 还没来得及 hydrate 的情况下也不会误判。
 */
export async function canUseAI(isVIP: boolean): Promise<boolean> {
  if (isVIP) return true;
  if (await readIsVIPFromStorage()) return true;
  const q = await readQuota();
  return q.used < WEEKLY_AI_LIMIT;
}

/**
 * Record a successful AI scan against the weekly quota. VIP is a no-op.
 * 同样从存储里再对账一次，防止 VIP 被错误地记到配额里。
 */
export async function consumeAI(isVIP: boolean): Promise<void> {
  if (isVIP) return;
  if (await readIsVIPFromStorage()) return;
  const q = await readQuota();
  await writeQuota({ weekStart: q.weekStart, used: q.used + 1 });
}

/** Admin/testing helper — clear the quota. */
export async function resetQuota(): Promise<void> {
  await AsyncStorage.removeItem(QUOTA_KEY);
}
