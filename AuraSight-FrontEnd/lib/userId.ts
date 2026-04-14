/**
 * AuraSight — 唯一 user_id 取数点
 *
 * 历史上 6 个页面里各自 copy 了一份 getUserId()，都是"读 @aurasight_user_id
 * 否则生成 guest_xxx 随机串"。问题：
 *   1. 如果用户先拍了几张照片（以 guest_xxx 存到云端），之后再注册/登录，
 *      profile._saveUser() 会直接把 @aurasight_user_id 覆盖成服务器 id——
 *      之前那些 guest_xxx 的 scans 就彻底成为孤儿。
 *   2. 撤销同意时只能按当前 uid 通知后端，孤儿记录扫不到。
 *
 * 这里把取数逻辑集中在一个地方：
 *   - 登录/VIP：优先用 UserContext 里的 user.id（= 服务器账号 id）
 *   - 游客：读或生成 @aurasight_user_id（本地匿名 id）
 *
 * `migrateGuestScans(fromId, toId)` 在登录时调用，告诉后端把 fromId 的
 * 历史记录挂到 toId 上。
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_KEY = "@aurasight_user";        // UserContext 维护的 JSON blob
const GUEST_ID_KEY = "@aurasight_user_id"; // 独立保存的当前 uid（兼容旧代码）

function makeGuestId(): string {
  return "guest_" + Math.random().toString(36).slice(2, 10);
}

/**
 * 返回当前用户的 id。
 * 登录用户 → 服务器账号 id；否则 → 本地 guest id（首次调用生成）。
 * 返回的 id 也会写回 @aurasight_user_id，让仍在用该 key 的老代码保持一致。
 */
export async function getUserId(): Promise<string> {
  // 1) 若 UserContext 已经有登录态用户，用它的 id
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (raw) {
      const u = JSON.parse(raw) as { id?: string; mode?: string };
      if (u?.id && u.mode && u.mode !== "guest") {
        // 用登录 id 覆盖独立 key，保持两边一致
        await AsyncStorage.setItem(GUEST_ID_KEY, u.id);
        return u.id;
      }
      // 游客也可能把 id 写在了 USER_KEY 里——用它即可
      if (u?.id) {
        await AsyncStorage.setItem(GUEST_ID_KEY, u.id);
        return u.id;
      }
    }
  } catch {
    // 解析失败 fall through 到 guest key
  }

  // 2) 读独立 guest key
  const existing = await AsyncStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;

  // 3) 首次使用——生成新 guest id
  const fresh = makeGuestId();
  await AsyncStorage.setItem(GUEST_ID_KEY, fresh);
  return fresh;
}

/**
 * 把 fromId 名下的所有 scans 迁移到 toId。
 * 通常在注册/登录成功后调用：用户在匿名状态下的历史记录不会丢。
 * 后端失败只记日志，不阻塞登录流程。
 */
export async function migrateGuestScans(
  fromId: string,
  toId: string,
): Promise<void> {
  if (!fromId || !toId || fromId === toId) return;
  // 只迁 guest_ 开头的——避免意外把一个真实账号的数据挪到另一个账号名下
  if (!fromId.startsWith("guest_")) return;

  try {
    const API_URL =
      process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.59:3000";
    const res = await fetch(`${API_URL}/users/merge-scans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_user_id: fromId, to_user_id: toId }),
    });
    if (!res.ok) {
      console.warn("migrateGuestScans: backend returned", res.status);
    }
  } catch (err) {
    console.warn("migrateGuestScans: failed", err);
  }
}
