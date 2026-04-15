/**
 * AuraSight — API 服务层
 * 连接本地/Railway Express 后端
 * 离线时自动降级到 AsyncStorage 本地缓存
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { CONSENT_VERSION } from "./consent";

// ─── 类型定义 ──────────────────────────────────────────────

export type AcneType = "pustule" | "broken" | "scab" | "redness";
export type BodyZone =
  | "face_forehead"
  | "face_cheek_l"
  | "face_cheek_r"
  | "face_chin"
  | "face_nose"
  | "back"
  | "chest";
export type SkinStatus = "clear" | "mild" | "breakout" | "healing";

export interface Detection {
  acne_type: AcneType;
  confidence: number;
  bbox: {
    cx: number;
    cy: number;
    w: number;
    h: number;
  };
  lesion_id?: string;
}

export interface ScanRecord {
  _id?: string;
  user_id: string;
  scan_date: string;
  body_zone: BodyZone;
  image_uri?: string;
  detections: Detection[];
  skin_status: SkinStatus;
  total_count: number;
  skin_score: number;
  notes?: string;
  created_at: string;
}

export interface StatsResult {
  total_scans: number;
  streak: number;
  avg_skin_score: number;
  latest_count: number;
  latest_score: number;
  week_change: number;
  acne_breakdown: Record<AcneType, number>;
  calendar: {
    date: string;
    status: SkinStatus;
    count: number;
    score: number;
  }[];
}

// ─── 配置 ─────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const CACHE_SCANS_KEY = "@aurasight_scans";
const CACHE_PENDING_KEY = "@aurasight_pending";

// ─── HTTP 工具 ────────────────────────────────────────────

// fetch 默认没有超时——后端如果挂了或手机连不到 API_URL，
// 请求会一直 pending，调用端 setLoading(false) 永远不会被调用，
// 页面上的现象就是"一直在 loading"。
// 包一层 AbortController 超时，超时后抛错，上层 catch 走本地缓存兜底。
async function apiCall<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: object,
  timeoutMs = 8000,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${await response.text()}`);
    }

    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── 工具函数 ─────────────────────────────────────────────

export function calcSkinStatus(detections: Detection[]): SkinStatus {
  const total = detections.length;
  if (total === 0) return "clear";
  const scabCount = detections.filter(d => d.acne_type === "scab").length;
  const activeCount = total - scabCount;
  // Mostly scabs and few active spots = healing
  if (scabCount >= 1 && scabCount >= activeCount && activeCount <= 3) return "healing";
  if (total <= 5) return "mild";
  return "breakout";
}

export function calcSkinScore(detections: Detection[]): number {
  if (detections.length === 0) return 100;
  const weights: Record<AcneType, number> = {
    pustule: 4,
    broken: 5,
    redness: 2,
    scab: 1,
  };
  const deduction = detections.reduce((sum, d) => {
    return sum + (weights[d.acne_type] ?? 3) * d.confidence;
  }, 0);
  return Math.max(0, Math.round(100 - deduction));
}

// ─── API 函数 ─────────────────────────────────────────────

/**
 * 保存今日扫描
 */
export async function saveScan(
  scan: Omit<
    ScanRecord,
    "_id" | "created_at" | "total_count" | "skin_status" | "skin_score"
  >,
  imageBase64?: string,  // 可选：传 base64 让后端上传到 Cloudinary
): Promise<ScanRecord> {
  try {
    // 把 consent_version 一并发到后端——让后端在数据库里冻结用户签的是哪
    // 个版本的条款。camera.tsx 在调用 saveScan 之前已经 gated 过 hasConsent，
    // 这里只是把那一刻的版本号随记录一起持久化，方便事后审计。
    const record = await apiCall<ScanRecord>("POST", "/scans", {
      ...scan,
      consent_version: CONSENT_VERSION,
      ...(imageBase64 ? { image_base64: imageBase64 } : {}),
    });
    await _updateLocalCache(record);
    console.log("✅ Scan saved:", record._id);
    return record;
  } catch (err) {
    console.warn("⚠️ Offline, saving locally");
    const record: ScanRecord = {
      ...scan,
      total_count: scan.detections.length,
      skin_status: calcSkinStatus(scan.detections),
      skin_score: calcSkinScore(scan.detections),
      created_at: new Date().toISOString(),
    };
    await _savePending(record);
    await _updateLocalCache(record);
    return record;
  }
}

/**
 * 获取最近 N 天记录
 */
export async function getRecentScans(
  userId: string,
  days = 30,
): Promise<ScanRecord[]> {
  try {
    const scans = await apiCall<ScanRecord[]>(
      "GET",
      `/scans/${userId}?days=${days}`,
    );
    await AsyncStorage.setItem(CACHE_SCANS_KEY, JSON.stringify(scans));
    return scans;
  } catch {
    console.warn("⚠️ Offline, reading cache");
    return _readLocalCache();
  }
}

/**
 * 获取今日扫描
 */
export async function getTodayScan(userId: string): Promise<ScanRecord | null> {
  try {
    return await apiCall<ScanRecord | null>("GET", `/scans/${userId}/today`);
  } catch {
    const cache = await _readLocalCache();
    const today = new Date().toISOString().split("T")[0];
    return cache.find((s) => s.scan_date.startsWith(today)) ?? null;
  }
}

/**
 * 获取统计数据（首页用）
 */
export async function getStats(userId: string): Promise<StatsResult | null> {
  try {
    return await apiCall<StatsResult>("GET", `/scans/${userId}/stats`);
  } catch {
    return null;
  }
}

/**
 * 同步离线数据
 */
export async function syncPending(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PENDING_KEY);
    if (!raw) return;
    const pending: ScanRecord[] = JSON.parse(raw);
    if (pending.length === 0) return;

    for (const scan of pending) {
      await apiCall("POST", "/scans", scan);
    }
    await AsyncStorage.removeItem(CACHE_PENDING_KEY);
    console.log("✅ Sync complete");
  } catch (err) {
    console.warn("Sync failed:", err);
  }
}

// ─── 本地缓存 ─────────────────────────────────────────────

async function _readLocalCache(): Promise<ScanRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_SCANS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function _updateLocalCache(scan: ScanRecord): Promise<void> {
  const existing = await _readLocalCache();
  const filtered = existing.filter((s) => s.scan_date !== scan.scan_date);
  await AsyncStorage.setItem(
    CACHE_SCANS_KEY,
    JSON.stringify([scan, ...filtered].slice(0, 30)),
  );
}

async function _savePending(scan: ScanRecord): Promise<void> {
  const raw = await AsyncStorage.getItem(CACHE_PENDING_KEY);
  const pending = raw ? JSON.parse(raw) : [];
  pending.push(scan);
  await AsyncStorage.setItem(CACHE_PENDING_KEY, JSON.stringify(pending));
}
