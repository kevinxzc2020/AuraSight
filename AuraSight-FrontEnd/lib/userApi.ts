// Profile 页新增的后端接口的 thin client。
// 注意：API_URL fallback IP 过期的高频 bug 见 auto-memory project_aurasight_dev_api_url.md
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.59:3000";

// 统一的 fetch 包装，8 秒超时兜底，和 report.tsx / index.tsx 保持一致
async function apiFetch(path: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data;
  } finally {
    clearTimeout(t);
  }
}

// ─── Avatar ────────────────────────────────────────────────

export async function uploadAvatar(
  userId: string,
  imageBase64: string,
): Promise<{ avatar_url: string }> {
  return apiFetch("/user/avatar", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, image_base64: imageBase64 }),
  });
}

export async function removeAvatar(userId: string): Promise<void> {
  await apiFetch("/user/avatar", {
    method: "DELETE",
    body: JSON.stringify({ user_id: userId }),
  });
}

// ─── User profile ──────────────────────────────────────────

export interface RemoteUser {
  id: string;
  name: string;
  email: string;
  mode: "registered" | "vip" | "guest";
  avatar_url?: string;
  vip_expires_at?: string;
  health_profile?: HealthProfile;
}

export async function fetchUser(userId: string): Promise<RemoteUser> {
  return apiFetch(`/user/${userId}`);
}

export async function updateProfile(
  userId: string,
  patch: { name?: string; email?: string },
): Promise<RemoteUser> {
  return apiFetch("/user/profile", {
    method: "PATCH",
    body: JSON.stringify({ user_id: userId, ...patch }),
  });
}

export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  await apiFetch("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      old_password: oldPassword,
      new_password: newPassword,
    }),
  });
}

// ─── Health profile ────────────────────────────────────────

export type SkinType = "oily" | "dry" | "combination" | "sensitive" | "normal";
export type SkinConcern = "acne" | "dark_spots" | "wrinkles" | "redness" | "pores" | "dryness" | "oiliness";
export type RoutineLevel = "none" | "simple" | "moderate" | "complex";
export type Climate = "humid" | "dry" | "temperate" | "tropical" | "cold";

export interface HealthProfile {
  height_cm?: number;
  weight_kg?: number;
  gender?: "male" | "female" | "other";
  birthday?: string; // yyyy-mm-dd
  // ── Skin Profile fields ──
  skin_type?: SkinType;
  concerns?: SkinConcern[];
  routine_level?: RoutineLevel;
  allergies?: string;       // free-text known allergens
  climate?: Climate;
}

export async function fetchHealthProfile(userId: string): Promise<HealthProfile> {
  return apiFetch(`/user/health-profile/${userId}`);
}

export async function updateHealthProfile(
  userId: string,
  patch: HealthProfile,
): Promise<HealthProfile> {
  return apiFetch("/user/health-profile", {
    method: "PATCH",
    body: JSON.stringify({ user_id: userId, ...patch }),
  });
}

// ─── Referral ──────────────────────────────────────────────

export interface ReferralInfo {
  code: string;
  redemptions: number;
}

export async function fetchReferral(userId: string): Promise<ReferralInfo> {
  return apiFetch(`/user/referral/${userId}`);
}

export async function redeemReferral(
  userId: string,
  code: string,
): Promise<{ success: boolean; vip_days_added: number }> {
  return apiFetch("/user/referral/redeem", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, code: code.toUpperCase() }),
  });
}
