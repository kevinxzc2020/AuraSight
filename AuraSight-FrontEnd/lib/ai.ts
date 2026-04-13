/**
 * AuraSight — AI Service Layer
 * All Claude API calls go through the backend proxy (never expose API key in app)
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.59:3000";

export interface AcneDetection {
  acne_type: "pustule" | "broken" | "redness" | "scab";
  confidence: number;
  bbox: { cx: number; cy: number; w: number; h: number };
}

export interface AnalyzeResult {
  detections: AcneDetection[];
  summary: string;
  severity: "clear" | "mild" | "moderate" | "severe";
  positive: string;
  tips: string[];
}

export interface AIReportResult {
  report: string;
  generated_at: string;
  scan_count: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Analyze skin image with Claude Vision ────────────────────
export async function analyzeImage(
  imageBase64: string,
  mediaType: string = "image/jpeg"
): Promise<AnalyzeResult> {
  const res = await fetch(`${API_URL}/ai/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageBase64, media_type: mediaType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `AI analyze failed: ${res.status}`);
  }
  return res.json();
}

// ─── Generate personalized 30-day AI report ──────────────────
export async function generateAIReport(userId: string): Promise<AIReportResult> {
  const res = await fetch(`${API_URL}/ai/report/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `AI report failed: ${res.status}`);
  }
  return res.json();
}

// ─── Get today's personalized advice ─────────────────────────
export async function getDailyAdvice(userId: string): Promise<string> {
  const res = await fetch(`${API_URL}/ai/advice/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) return "";
  const data = await res.json();
  return data.advice ?? "";
}

// ─── AI skin consultant chat ──────────────────────────────────
export async function sendChatMessage(
  messages: ChatMessage[],
  userId?: string
): Promise<string> {
  const res = await fetch(`${API_URL}/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Chat failed: ${res.status}`);
  }
  const data = await res.json();
  return data.reply;
}
