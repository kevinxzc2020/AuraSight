import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Path,
  Defs,
  Polyline,
  LinearGradient as SvgGrad,
  Stop,
  Line,
  Text as SvgText,
} from "react-native-svg";
import {
  TrendingUp,
  TrendingDown,
  Crown,
  Check,
  Lock,
  Sparkles,
  ChevronRight,
  X,
} from "lucide-react-native";
import { Modal, Pressable, Share, Linking } from "react-native";
import { generateAIReport } from "../../lib/ai";
import {
  Colors,
  Gradients,
  Spacing,
  Radius,
  FontSize,
  Shadow,
  AcneColors,
} from "../../constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, router } from "expo-router";
import { getUserId } from "../../lib/userId";
import { SensitiveGate } from "../../lib/sensitiveGate";

const { width } = Dimensions.get("window");
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.59:3000";
const CHART_W = width - Spacing.xl * 2 - Spacing.lg * 2;

// ─── 类型定义 ─────────────────────────────────────────────
interface DailyScore {
  date: string;
  score: number;
  count: number;
}

interface ReportData {
  total_scans: number;
  avg_skin_score: number;
  score_change_pct: number;
  streak: number;
  daily_scores: DailyScore[];
  acne_breakdown: {
    pustule: number;
    broken: number;
    scab: number;
    redness: number;
  };
  first_scan: { image_uri: string | null; score: number; date: string } | null;
  latest_scan: { image_uri: string | null; score: number; date: string } | null;
  date_range: { from: string; to: string } | null;
}

// getUserId: 从 lib/userId.ts 导入（登录用户返回账号 id，游客返回本地 guest id）

// ─── 规则引擎：根据数据生成有温度的总结语 ────────────────
// 这是免费版的"AI感"核心：用规则生成个性化文字，让用户感受到被关注
function generateSummary(data: ReportData): string {
  const change = data.score_change_pct;
  const scans = data.total_scans;
  const avg = data.avg_skin_score;

  if (scans < 3)
    return "You're just getting started. Keep scanning daily — the data gets more meaningful every day.";
  if (change > 15)
    return `Your skin improved ${change}% over this period. Whatever you're doing, it's working. Keep it up.`;
  if (change > 5)
    return `A steady ${change}% improvement. Consistency is paying off — your skin is responding.`;
  if (change > 0)
    return `Slight improvement detected. Small changes add up — you're trending in the right direction.`;
  if (change === 0)
    return `Your skin score held steady. Stability is underrated — maintaining is also progress.`;
  if (change > -5)
    return `A small dip this period. Don't stress — skin goes through cycles. Check your diary notes for clues.`;
  return `Your score dropped ${Math.abs(change)}%. Life happens. Look at your diary entries to spot what might have triggered it.`;
}

// ─── Chapter 1: Before/After Hero ────────────────────────
// 放在最顶部，是情绪冲击最强的内容。
// 用户打开 Report 页面的第一个问题是："我变了多少？"
// 这个组件直接回答这个问题，不需要用户滚动去寻找。
function BeforeAfterHero({ data }: { data: ReportData }) {
  const isImproved = data.score_change_pct >= 0;
  const summary = generateSummary(data);

  return (
    <View style={st.heroCard}>
      {/* 前后对比图 */}
      <View style={st.compareRow}>
        {/* Before */}
        <View style={st.compareItem}>
          <View style={st.compareImgWrapper}>
            {data.first_scan?.image_uri ? (
              <Image
                source={{ uri: data.first_scan.image_uri }}
                style={st.compareImg}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={["#ffe4e6", "#fce7f3"]}
                style={st.compareImg}
              >
                <Text style={{ fontSize: 36 }}>👤</Text>
              </LinearGradient>
            )}
            <View style={[st.scoreChip, { backgroundColor: "#1a1a2e" }]}>
              <Text style={st.scoreChipText}>
                {data.first_scan?.score ?? "–"}
              </Text>
            </View>
          </View>
          <Text style={st.compareLabel}>Day 1</Text>
          {data.first_scan?.date && (
            <Text style={st.compareDate}>{data.first_scan.date}</Text>
          )}
        </View>

        {/* 中间变化指示器 */}
        <View style={st.changeIndicator}>
          <LinearGradient
            colors={
              isImproved
                ? [Colors.emerald, "#10b981"]
                : [Colors.rose400, "#fb7185"]
            }
            style={st.changeBubble}
          >
            <Text style={st.changeArrow}>{isImproved ? "↑" : "↓"}</Text>
            <Text style={st.changeNum}>{Math.abs(data.score_change_pct)}%</Text>
          </LinearGradient>
        </View>

        {/* After */}
        <View style={st.compareItem}>
          <View style={st.compareImgWrapper}>
            {data.latest_scan?.image_uri ? (
              <Image
                source={{ uri: data.latest_scan.image_uri }}
                style={st.compareImg}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={["#d1fae5", "#a7f3d0"]}
                style={st.compareImg}
              >
                <Text style={{ fontSize: 36 }}>👤</Text>
              </LinearGradient>
            )}
            <View
              style={[
                st.scoreChip,
                {
                  backgroundColor: isImproved ? Colors.emerald : Colors.rose400,
                },
              ]}
            >
              <Text style={st.scoreChipText}>
                {data.latest_scan?.score ?? "–"}
              </Text>
            </View>
          </View>
          <Text style={st.compareLabel}>Latest</Text>
          {data.latest_scan?.date && (
            <Text style={st.compareDate}>{data.latest_scan.date}</Text>
          )}
        </View>
      </View>

      {/* 总结语：规则引擎生成的个性化文字 */}
      <View style={st.summaryBox}>
        <Sparkles size={14} color={Colors.rose400} />
        <Text style={st.summaryText}>{summary}</Text>
      </View>
    </View>
  );
}

// ─── Chapter 2: 数据支撑 ─────────────────────────────────
// 折线图 + 三个关键数字
// 这部分是给"想看数字"的用户的，放在 Before/After 之后

function ScoreLineChart({ data }: { data: DailyScore[] }) {
  const H = 80;

  if (data.length < 2) {
    return (
      <View
        style={{ height: H, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ fontSize: FontSize.xs, color: Colors.gray300 }}>
          Scan more days to see your trend
        </Text>
      </View>
    );
  }

  const scores = data.map((d) => d.score);
  const maxScore = Math.min(100, Math.max(...scores) + 10);
  const minScore = Math.max(0, Math.min(...scores) - 10);
  const range = maxScore - minScore || 20;

  const toX = (i: number) => (i / (data.length - 1)) * CHART_W;
  const toY = (score: number) => H - ((score - minScore) / range) * H;

  const points = data
    .map((d, i) => `${toX(i).toFixed(1)},${toY(d.score).toFixed(1)}`)
    .join(" ");

  const firstAvg =
    scores.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, scores.length);
  const lastAvg =
    scores.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, scores.length);
  const lineColor = lastAvg >= firstAvg ? Colors.emerald : Colors.rose400;

  // 构建渐变填充区域（折线下方到底部）
  const areaPath =
    `M${toX(0)},${toY(data[0].score)} ` +
    data
      .slice(1)
      .map((d, i) => `L${toX(i + 1)},${toY(d.score)}`)
      .join(" ") +
    ` L${CHART_W},${H} L0,${H} Z`;

  return (
    <Svg width={CHART_W} height={H + 16} style={{ overflow: "visible" }}>
      <Defs>
        <SvgGrad id="areaFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
          <Stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </SvgGrad>
      </Defs>

      {/* 参考线 */}
      {[0, 0.5, 1].map((r, i) => (
        <Line
          key={i}
          x1={0}
          y1={H * r}
          x2={CHART_W}
          y2={H * r}
          stroke={Colors.gray100}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      ))}

      {/* 填充区域 */}
      <Path d={areaPath} fill="url(#areaFill)" />

      {/* 折线 */}
      <Polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 数据点 */}
      {data.map((d, i) => (
        <Circle
          key={i}
          cx={toX(i)}
          cy={toY(d.score)}
          r={i === data.length - 1 ? 5 : 3}
          fill={i === data.length - 1 ? lineColor : "#fff"}
          stroke={lineColor}
          strokeWidth={2}
        />
      ))}

      {/* 最后一个点的分数标注 */}
      <SvgText
        x={Math.min(toX(data.length - 1), CHART_W - 16)}
        y={toY(data[data.length - 1].score) - 10}
        fontSize={11}
        fontWeight="700"
        fill={lineColor}
        textAnchor="middle"
      >
        {data[data.length - 1].score}
      </SvgText>
    </Svg>
  );
}

// ─── 甜甜圈图 ─────────────────────────────────────────────
const ACNE_TYPES = [
  { key: "pustule", label: "Pustule", color: AcneColors.pustule },
  { key: "broken", label: "Broken", color: AcneColors.broken },
  { key: "scab", label: "Scab", color: AcneColors.scab },
  { key: "redness", label: "Redness", color: AcneColors.redness },
];

function DonutChart({
  breakdown,
}: {
  breakdown: ReportData["acne_breakdown"];
}) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const size = 112;
  const r = 40;
  const circ = 2 * Math.PI * r;
  let cumulative = 0;

  if (total === 0) {
    return (
      <View
        style={{ height: 112, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ fontSize: FontSize.xs, color: Colors.gray300 }}>
          No acne data yet
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xl }}
    >
      <View style={{ position: "relative", width: size, height: size }}>
        <Svg
          width={size}
          height={size}
          style={{ transform: [{ rotate: "-90deg" }] }}
        >
          {ACNE_TYPES.map((item, i) => {
            const count = breakdown[item.key as keyof typeof breakdown];
            const pct = count / total;
            const dash = pct * circ;
            const offset = -(cumulative / total) * circ;
            cumulative += count;
            return (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={item.color}
                strokeWidth={14}
                strokeDasharray={`${dash} ${circ}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: FontSize.xxl,
              fontWeight: "700",
              color: Colors.gray800,
            }}
          >
            {total}
          </Text>
          <Text style={{ fontSize: 9, color: Colors.gray500 }}>Total</Text>
        </View>
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        {ACNE_TYPES.map((item) => (
          <View
            key={item.key}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: item.color,
              }}
            />
            <Text
              style={{ flex: 1, fontSize: FontSize.xs, color: Colors.gray600 }}
            >
              {item.label}
            </Text>
            <Text
              style={{
                fontSize: FontSize.xs,
                fontWeight: "700",
                color: Colors.gray800,
              }}
            >
              {breakdown[item.key as keyof typeof breakdown]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Chapter 3: 皮肤日记关联提示卡 ──────────────────────
const TAG_EMOJI: Record<string, string> = {
  sleep_good: "😴", sleep_bad: "😩", lots_of_water: "💧", low_water: "🏜",
  healthy_diet: "🥗", junk_food: "🍔", stressed: "😤", relaxed: "😌",
  exercised: "🏃", no_exercise: "🛋", new_product: "🧴", period: "📅",
  alcohol: "🍷", dairy: "🥛", sugar: "🍰", outdoor: "🌤",
};

function DiaryInsightCard({ totalScans, userId }: { totalScans: number; userId: string }) {
  const [correlations, setCorrelations] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (totalScans < 5 || !userId) return;
    fetch(`${API_URL}/ai/diary-correlation/${userId}`)
      .then(r => r.json())
      .then(d => { setCorrelations(d.correlations ?? []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [userId, totalScans]);

  if (totalScans < 5) return null;

  const impactColor = (impact: number) => impact > 3 ? "#10b981" : impact < -3 ? "#f43f5e" : "#94a3b8";
  const impactLabel = (impact: number) => impact > 3 ? "↑ Better skin" : impact < -3 ? "↓ Worse skin" : "→ Neutral";

  return (
    <View style={st.diaryCard}>
      <View style={st.diaryHeader}>
        <View style={st.diaryIconBg}>
          <Text style={{ fontSize: 14 }}>📔</Text>
        </View>
        <View>
          <Text style={st.diaryTitle}>Diary Patterns</Text>
          <Text style={st.diarySub}>Based on your logged entries</Text>
        </View>
      </View>

      {!loaded ? (
        <View style={{ padding: Spacing.md, alignItems: "center" }}>
          <ActivityIndicator size="small" color={Colors.pink500} />
        </View>
      ) : correlations.length === 0 ? (
        <>
          <View style={st.diaryInsightRow}>
            <Text style={st.diaryInsightEmoji}>💤</Text>
            <Text style={st.diaryInsightText}>Keep logging — patterns emerge after a few diary entries.</Text>
          </View>
          <View style={st.diaryInsightRow}>
            <Text style={st.diaryInsightEmoji}>💧</Text>
            <Text style={st.diaryInsightText}>Water intake and sleep quality correlations will appear here.</Text>
          </View>
        </>
      ) : (
        correlations.slice(0, 5).map((c, i) => (
          <View key={i} style={st.diaryInsightRow}>
            <Text style={st.diaryInsightEmoji}>{TAG_EMOJI[c.tag] ?? "📌"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[st.diaryInsightText, { fontWeight: "600", color: Colors.gray700 }]}>
                {c.tag.replace(/_/g, " ")}
                <Text style={{ color: Colors.gray400 }}> ({c.count}×)</Text>
              </Text>
              <Text style={{ fontSize: FontSize.xs, color: impactColor(c.impact) }}>
                {impactLabel(c.impact)} · avg score {c.avg_score}
              </Text>
            </View>
          </View>
        ))
      )}

      <View style={st.diaryFooter}>
        <Text style={st.diaryFooterText}>
          The more you log, the smarter the analysis gets.
        </Text>
      </View>
    </View>
  );
}

// ─── Chapter 4: VIP 升级区块 ─────────────────────────────
// ─── Deep Analysis Card (VIP only) ───────────────────────
function DeepAnalysisCard({ userId }: { userId: string }) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/ai/deep-analysis/${userId}`, { method: "POST" });
      const json = await res.json();
      if (json.error === "not_enough_data") { setError(json.message); }
      else setAnalysis(json);
    } catch { setError("Unable to load deep analysis. Try again later."); }
    finally { setLoading(false); }
  }

  if (!analysis && !loading && !error) {
    return (
      <View style={[st.card, Shadow.card]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md }}>
          <Crown size={16} color="#d97706" />
          <Text style={{ fontSize: FontSize.base, fontWeight: "700", color: "#d97706" }}>Deep AI Analysis</Text>
        </View>
        <Text style={{ fontSize: FontSize.sm, color: Colors.gray600, marginBottom: Spacing.md, lineHeight: 20 }}>
          Uncover how your lifestyle habits — sleep, diet, hydration, stress — are affecting your skin.
        </Text>
        <TouchableOpacity onPress={load} style={{ backgroundColor: "#d97706", borderRadius: Radius.full, paddingVertical: 12, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: FontSize.sm }}>✨ Generate Deep Analysis</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) return (
    <View style={[st.card, Shadow.card, { alignItems: "center", paddingVertical: 32 }]}>
      <ActivityIndicator color="#d97706" />
      <Text style={{ color: Colors.gray400, fontSize: FontSize.sm, marginTop: 12 }}>Analyzing your lifestyle patterns…</Text>
    </View>
  );

  if (error) return (
    <View style={[st.card, Shadow.card]}>
      <Text style={{ color: Colors.gray500, fontSize: FontSize.sm, textAlign: "center", lineHeight: 20 }}>{error}</Text>
    </View>
  );

  const impactColor = (label: string) => label === "positive" ? "#10b981" : label === "negative" ? "#f43f5e" : "#94a3b8";

  return (
    <View style={[st.card, Shadow.card]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: 4 }}>
        <Crown size={16} color="#d97706" />
        <Text style={{ fontSize: FontSize.base, fontWeight: "700", color: "#d97706" }}>Deep AI Analysis</Text>
      </View>
      {/* 窗口副标题：诚实地反映这次分析基于多少数据 */}
      {(analysis.window_label || analysis.scan_count != null) && (
        <Text style={{ fontSize: FontSize.xs, color: Colors.gray500, marginBottom: Spacing.sm }}>
          Based on {analysis.scan_count ?? "?"} scan{analysis.scan_count === 1 ? "" : "s"}
          {analysis.window_label ? ` over ${analysis.window_label}` : ""}
          {analysis.data_confidence ? ` · confidence: ${analysis.data_confidence}` : ""}
        </Text>
      )}
      {analysis.limited_data && (
        <View style={{ backgroundColor: "#fff7ed", borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm, borderWidth: 1, borderColor: "#fed7aa" }}>
          <Text style={{ fontSize: FontSize.xs, color: "#9a3412", lineHeight: 18 }}>
            ⏳ Early read: only a few days of data so far. Treat findings as initial patterns — not conclusions. Scan daily to sharpen the analysis.
          </Text>
        </View>
      )}
      <Text style={{ fontSize: FontSize.lg, fontWeight: "700", color: Colors.gray800, marginBottom: Spacing.md, lineHeight: 24 }}>
        {analysis.headline}
      </Text>

      {/* Lifestyle insights */}
      {(analysis.lifestyle_insights ?? []).map((ins: any, i: number) => (
        <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: impactColor(ins.impact), paddingLeft: Spacing.sm, marginBottom: Spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: FontSize.sm, fontWeight: "600", color: Colors.gray800 }}>{ins.factor}</Text>
            <Text style={{ fontSize: FontSize.xs, color: impactColor(ins.impact), fontWeight: "600" }}>{ins.score_effect}</Text>
          </View>
          <Text style={{ fontSize: FontSize.xs, color: Colors.gray500, marginTop: 2, lineHeight: 18 }}>{ins.finding}</Text>
        </View>
      ))}

      {/* Best / Worst habit */}
      {analysis.best_habit && (
        <View style={{ backgroundColor: "#ecfdf5", borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm }}>
          <Text style={{ fontSize: FontSize.xs, fontWeight: "700", color: "#065f46" }}>✅ Best habit</Text>
          <Text style={{ fontSize: FontSize.xs, color: "#065f46", marginTop: 2 }}>{analysis.best_habit}</Text>
        </View>
      )}
      {analysis.worst_habit && (
        <View style={{ backgroundColor: "#fff1f2", borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm }}>
          <Text style={{ fontSize: FontSize.xs, fontWeight: "700", color: "#9f1239" }}>⚠️ Pattern to break</Text>
          <Text style={{ fontSize: FontSize.xs, color: "#9f1239", marginTop: 2 }}>{analysis.worst_habit}</Text>
        </View>
      )}

      {/* Prediction */}
      {analysis.prediction && (
        <View style={{ backgroundColor: "#fefce8", borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm }}>
          <Text style={{ fontSize: FontSize.xs, fontWeight: "700", color: "#854d0e" }}>🔮 Prediction</Text>
          <Text style={{ fontSize: FontSize.xs, color: "#854d0e", marginTop: 2 }}>{analysis.prediction}</Text>
        </View>
      )}

      {/* Next experiment */}
      {analysis.next_experiment && (
        <View style={{ backgroundColor: "#f0f9ff", borderRadius: Radius.md, padding: Spacing.sm }}>
          <Text style={{ fontSize: FontSize.xs, fontWeight: "700", color: "#0c4a6e" }}>🧪 Next experiment</Text>
          <Text style={{ fontSize: FontSize.xs, color: "#0c4a6e", marginTop: 2 }}>{analysis.next_experiment}</Text>
        </View>
      )}

      <TouchableOpacity onPress={load} style={{ marginTop: Spacing.md, alignItems: "center" }}>
        <Text style={{ fontSize: FontSize.xs, color: Colors.gray400 }}>↻ Refresh analysis</Text>
      </TouchableOpacity>
    </View>
  );
}

function VIPUpgradeSection({
  isVip,
  userId,
  onUpgrade,
}: {
  isVip: boolean;
  userId: string;
  onUpgrade: () => void;
}) {
  if (isVip) {
    return <DeepAnalysisCard userId={userId} />;
  }

  // 免费用户看到的是一个"功能预览"卡片，不是被遮住的内容
  // 设计逻辑：让用户看到真实价值，而不是制造人工的 FOMO
  return (
    <View style={st.vipPreviewCard}>
      {/* 深色 Hero 区 */}
      <View style={st.vipPreviewHero}>
        <Lock size={16} color="rgba(255,255,255,0.4)" />
        <Text style={st.vipPreviewTitle}>Deep Analysis</Text>
        <Text style={st.vipPreviewSub}>
          Unlock AI-powered insights about what&apos;s driving your skin changes
        </Text>
      </View>

      {/* 功能预览列表 */}
      <View style={st.vipPreviewList}>
        {mockInsights.map((ins, i) => (
          <View
            key={i}
            style={[
              st.vipPreviewRow,
              i < mockInsights.length - 1 && st.vipPreviewRowBorder,
            ]}
          >
            <View style={st.vipPreviewEmojiBg}>
              <Text style={{ fontSize: 16 }}>{ins.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.vipPreviewItemTitle}>{ins.title}</Text>
              {/* 内容用模糊遮罩处理：标题可见，描述模糊 */}
              <Text style={st.vipPreviewItemDesc} numberOfLines={1}>
                {ins.desc}
              </Text>
            </View>
            <Lock size={12} color={Colors.gray200} />
          </View>
        ))}
      </View>

      {/* CTA 按钮 */}
      <View style={st.vipPreviewCta}>
        <TouchableOpacity onPress={onUpgrade} activeOpacity={0.85}>
          <LinearGradient
            colors={Gradients.roseMain}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={st.vipPreviewBtn}
          >
            <Crown size={14} color="#fde68a" />
            <Text style={st.vipPreviewBtnText}>Try VIP free for 7 days ✦</Text>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={st.vipPreviewBtnSub}>Then $4.99/mo · Cancel anytime</Text>
      </View>
    </View>
  );
}

// ─── AI 报告正文渲染 ─────────────────────────────────────
// 把 Claude 返回的 plain text 或带 `## 标题` 的 markdown-lite 切成章节卡片。
// 不引入完整 markdown 库 —— 只处理 `## heading` 和段落。
function AIReportBody({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  if (!text) return null;
  // 按 `## ` 切块。若全文没有 heading，就整个当一个无标题块。
  const blocks: { title?: string; body: string }[] = [];
  const lines = text.split("\n");
  let current: { title?: string; body: string } = { body: "" };
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      if (current.body.trim() || current.title) blocks.push(current);
      current = { title: m[1].trim(), body: "" };
    } else {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current.body.trim() || current.title) blocks.push(current);

  return (
    <View>
      {blocks.map((b, i) => (
        <View key={i} style={st.aiBlock}>
          {b.title && <Text style={st.aiBlockTitle}>{b.title}</Text>}
          <Text style={st.aiReportText}>
            {b.body.trim()}
            {streaming && i === blocks.length - 1 ? (
              <Text style={st.aiCaret}>▋</Text>
            ) : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Share Progress Modal ────────────────────────────────
// 4 种分享/导出形态：
//   before_after — 首末扫描并排对比（露脸）
//   streak       — 坚持天数打卡，鼓励晒坚持（不露脸）
//   invite       — 拉新邀请（系统 Share sheet 发文案）
//   doctor       — VIP PDF 发给皮肤科医生（Linking 打开后端 PDF）
// 统一的分享卡：一张图包含所有关键信息（skin score、streak、before/after 缩略图、邀请码）。
// 用户可截屏发送——不引入 react-native-view-shot 这种 native 依赖。
// Share 按钮走系统 share sheet 分享带邀请码的文案（文字层面）。
function ShareProgressModal({
  visible,
  onClose,
  data,
  userId,
}: {
  visible: boolean;
  onClose: () => void;
  data: ReportData;
  userId: string;
  // 旧参数 isVip / onUpgrade 已不再需要（PDF 功能移除后没有升级入口了）
  isVip?: boolean;
  onUpgrade?: () => void;
}) {
  const improved = data.score_change_pct >= 0;
  // 占位推荐码：userId 首 6 位大写。后端接真实 referral table 再替换。
  const referralCode = (userId || "AURASIGHT").slice(0, 6).toUpperCase();

  async function handleShare() {
    try {
      await Share.share({
        message:
          `${data.streak ? `🔥 Day ${data.streak} of my skin journey — ` : ""}` +
          `${data.total_scans} scans, skin score ${improved ? "up" : "at"} ${Math.abs(
            data.score_change_pct,
          )}% 🌸\n\n` +
          `Tracking with AuraSight. Use my code ${referralCode} for 1 month free VIP: https://aurasight.app/invite/${referralCode}`,
      });
    } catch {
      /* 用户取消，忽略 */
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.shareOverlay} onPress={onClose}>
        <Pressable style={st.shareSheet} onPress={() => {}}>
          <TouchableOpacity onPress={onClose} style={st.shareClose}>
            <X size={18} color="#fff" />
          </TouchableOpacity>

          {/* ── 一张统一的总结卡 ── */}
          <LinearGradient
            colors={["#FB923C", "#F43F8F", "#A855F7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={st.summaryCard}
          >
            {/* 顶部：品牌 + streak 徽章 */}
            <View style={st.summaryHeader}>
              <Text style={st.summaryBrand}>AuraSight</Text>
              {data.streak > 0 && (
                <View style={st.summaryStreakPill}>
                  <Text style={{ fontSize: 12 }}>🔥</Text>
                  <Text style={st.summaryStreakPillText}>{data.streak} days</Text>
                </View>
              )}
            </View>

            {/* 中部：skin score 大数字 + 变化 */}
            <View style={st.summaryScoreWrap}>
              <Text style={st.summaryScoreBig}>
                {data.latest_scan?.score ?? "–"}
              </Text>
              <Text style={st.summaryScoreLbl}>Skin Score</Text>
              <View style={st.summaryDeltaRow}>
                {improved ? (
                  <TrendingUp size={14} color="#fff" />
                ) : (
                  <TrendingDown size={14} color="#fff" />
                )}
                <Text style={st.summaryDeltaText}>
                  {improved ? "+" : ""}
                  {data.score_change_pct}% over {data.total_scans} scan
                  {data.total_scans === 1 ? "" : "s"}
                </Text>
              </View>
            </View>

            {/* Before / After 缩略图（有照片才显示，没有就保持卡片简洁） */}
            {(data.first_scan?.image_uri || data.latest_scan?.image_uri) && (
              <View style={st.summaryBARow}>
                <View style={st.summaryBACell}>
                  {data.first_scan?.image_uri ? (
                    <Image
                      source={{ uri: data.first_scan.image_uri }}
                      style={st.summaryBAImg}
                    />
                  ) : (
                    <View style={[st.summaryBAImg, st.summaryBAEmpty]} />
                  )}
                  <Text style={st.summaryBALbl}>Day 1</Text>
                </View>
                <Text style={{ fontSize: 16, color: "rgba(255,255,255,0.85)", marginHorizontal: 4 }}>
                  →
                </Text>
                <View style={st.summaryBACell}>
                  {data.latest_scan?.image_uri ? (
                    <Image
                      source={{ uri: data.latest_scan.image_uri }}
                      style={st.summaryBAImg}
                    />
                  ) : (
                    <View style={[st.summaryBAImg, st.summaryBAEmpty]} />
                  )}
                  <Text style={st.summaryBALbl}>Today</Text>
                </View>
              </View>
            )}

            {/* 底部：邀请码水印 */}
            <View style={st.summaryInviteBox}>
              <Text style={st.summaryInviteLbl}>1 month VIP for a friend</Text>
              <Text style={st.summaryInviteCode}>{referralCode}</Text>
              <Text style={st.summaryInviteUrl}>aurasight.app/invite</Text>
            </View>
          </LinearGradient>

          <Text style={st.shareHint}>
            📱 Screenshot this card to share the visual. The button below sends
            a text summary with your invite code.
          </Text>

          <TouchableOpacity
            onPress={handleShare}
            activeOpacity={0.85}
            style={st.summaryShareBtn}
          >
            <Text style={st.summaryShareBtnText}>Share text + invite code</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ShareOption({
  emoji,
  title,
  sub,
  onPress,
  locked,
}: {
  emoji: string;
  title: string;
  sub: string;
  onPress: () => void;
  locked?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={st.sharePickerRow}
    >
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={st.sharePickerRowTitle}>{title}</Text>
        <Text style={st.sharePickerRowSub}>{sub}</Text>
      </View>
      {locked ? (
        <Crown size={16} color="#d97706" />
      ) : (
        <ChevronRight size={16} color="#9CA3AF" />
      )}
    </TouchableOpacity>
  );
}

// ─── 主页面 ───────────────────────────────────────────────
export default function ReportScreen() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVip, setIsVip] = useState(false);
  const [aiReport, setAiReport] = useState<string>("");
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [userId, setUserId] = useState<string>("");
  // 打字机效果：逐字揭示 AI 文本，营造"现场生成"感
  const [displayedAi, setDisplayedAi] = useState("");
  const [shareVisible, setShareVisible] = useState(false);

  // 每当 aiReport 变化，从头开始打字。为避免长文本把 JS 线程榨干：
  // ≤500 字每 tick 1 字；>500 一次 2 字；>1500 一次 4 字。
  useEffect(() => {
    if (!aiReport) {
      setDisplayedAi("");
      return;
    }
    setDisplayedAi("");
    let i = 0;
    const step = aiReport.length > 1500 ? 4 : aiReport.length > 500 ? 2 : 1;
    const id = setInterval(() => {
      i = Math.min(i + step, aiReport.length);
      setDisplayedAi(aiReport.slice(0, i));
      if (i >= aiReport.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [aiReport]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  async function loadData() {
    // 加超时，后端挂了也不要让 loading 永远转圈
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const id = await getUserId();
      setUserId(id);
      const mode = await AsyncStorage.getItem("@aurasight_user_mode");
      setIsVip(mode === "vip");

      const res = await fetch(`${API_URL}/scans/${id}/report`, {
        signal: ctrl.signal,
      });
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load report:", err);
      // 超时或报错也给个 empty shape，让页面渲染 empty state 而不是 loading
      setData((prev) => prev ?? ({} as ReportData));
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  async function handleGenerateAIReport() {
    setAiReportLoading(true);
    setAiModalVisible(true);
    try {
      const result = await generateAIReport(userId);
      setAiReport(result.report);
    } catch {
      setAiReport("Unable to generate report right now. Please try again later.");
    } finally {
      setAiReportLoading(false);
    }
  }

  if (loading) {
    return (
      <SensitiveGate>
        <LinearGradient colors={["#FFF3F6", "#FFF9FB", "#FFFFFF"]} style={st.center}>
          <ActivityIndicator size="large" color={Colors.rose400} />
        </LinearGradient>
      </SensitiveGate>
    );
  }

  // 空状态：没有数据时引导用户去扫描
  if (!data || data.total_scans === 0) {
    return (
      <SensitiveGate>
      <LinearGradient colors={["#FFF3F6", "#FFF9FB", "#FFFFFF"]} style={st.container}>
        <SafeAreaView style={st.center}>
          <View style={st.emptyIconWrapper}>
            <Text style={{ fontSize: 40 }}>📊</Text>
          </View>
          <Text style={st.emptyTitle}>Your report is waiting</Text>
          <Text style={st.emptySub}>
            Complete your first scan to start building your 30-day journey
            report.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/camera")}
            activeOpacity={0.85}
          >
            <LinearGradient colors={Gradients.roseMain} style={st.emptyBtn}>
              <Text style={st.emptyBtnText}>Take my first scan</Text>
            </LinearGradient>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
      </SensitiveGate>
    );
  }

  const isImproved = data.score_change_pct >= 0;

  return (
    <SensitiveGate>
    <LinearGradient colors={["#FFF3F6", "#FFF9FB", "#FFFFFF"]} style={st.container}>
      <SafeAreaView style={st.safeArea} edges={["top"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={st.scroll}
        >
          {/* 标题区 */}
          <View style={st.titleArea}>
            <Text style={st.pageTitle}>Your Report</Text>
            {data.date_range && (
              <Text style={st.dateRange}>
                {data.date_range.from} — {data.date_range.to}
              </Text>
            )}
          </View>

          {/* ── Chapter 1: Before/After Hero ── */}
          {/* 放最顶部，最高情绪冲击力 */}
          <BeforeAfterHero data={data} />

          {/* ── Chapter 2: 数据支撑 ── */}
          {/* 三个关键数字 */}
          <View style={st.statsRow}>
            <View style={[st.statCard, Shadow.card]}>
              <Text style={st.statVal}>{data.total_scans}</Text>
              <Text style={st.statLbl}>Scans</Text>
            </View>
            <View style={[st.statCard, Shadow.card]}>
              <Text style={st.statVal}>{data.avg_skin_score}</Text>
              <Text style={st.statLbl}>Avg Score</Text>
            </View>
            <View style={[st.statCard, Shadow.card]}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                {isImproved ? (
                  <TrendingUp size={14} color={Colors.emerald} />
                ) : (
                  <TrendingDown size={14} color={Colors.rose400} />
                )}
                <Text
                  style={[
                    st.statVal,
                    { color: isImproved ? Colors.emerald : Colors.rose400 },
                  ]}
                >
                  {isImproved ? "+" : ""}
                  {data.score_change_pct}%
                </Text>
              </View>
              <Text style={st.statLbl}>Change</Text>
            </View>
          </View>

          {/* 折线图卡片 */}
          <View style={[st.card, Shadow.card]}>
            <View style={st.cardHeaderRow}>
              <Text style={st.cardTitle}>Score Trend</Text>
              <Text style={st.cardSub}>{data.streak} day streak 🔥</Text>
            </View>
            <ScoreLineChart data={data.daily_scores} />
            <View style={st.chartAxisRow}>
              <Text style={st.chartAxisLabel}>Day 1</Text>
              <Text style={st.chartAxisLabel}>Today</Text>
            </View>
          </View>

          {/* 痘痘分布卡片 */}
          {Object.values(data.acne_breakdown).reduce((a, b) => a + b, 0) >
            0 && (
            <View style={[st.card, Shadow.card]}>
              <Text style={st.cardTitle}>Condition Breakdown</Text>
              <DonutChart breakdown={data.acne_breakdown} />
            </View>
          )}

          {/* ── Chapter 3: 皮肤日记关联 ── */}
          <DiaryInsightCard totalScans={data.total_scans} userId={userId} />

          {/* ── AI Report Card ── */}
          <TouchableOpacity onPress={handleGenerateAIReport} activeOpacity={0.85}>
            <LinearGradient colors={["#F43F8F", "#F472B6", "#FB9FBD"]} style={st.aiReportCard}>
              <View style={st.aiReportIconBg}>
                <Sparkles size={20} color="#fff" />
              </View>
              <View style={st.aiReportInfo}>
                <Text style={st.aiReportTitle}>Generate AI Report</Text>
                <Text style={st.aiReportSub}>Personalized analysis by Claude AI</Text>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.8)" />
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Share progress card（免费功能，反哺拉新） ── */}
          <TouchableOpacity
            onPress={() => setShareVisible(true)}
            activeOpacity={0.85}
            style={st.shareCard}
          >
            <View style={st.shareIconBg}>
              <Text style={{ fontSize: 20 }}>📸</Text>
            </View>
            <View style={st.shareInfo}>
              <Text style={st.shareTitle}>Share my progress</Text>
              <Text style={st.shareSub}>
                Get a shareable image to post (no face shown)
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.gray400} />
          </TouchableOpacity>

          {/* ── Chapter 4: VIP 深度分析 ── */}
          <Text style={st.chapterLabel}>Deep Analysis</Text>
          <VIPUpgradeSection
            isVip={isVip}
            userId={userId}
            onUpgrade={() => router.push("/vip")}
          />
        </ScrollView>
      </SafeAreaView>

      {/* ── Share progress modal ── */}
      {data && (
        <ShareProgressModal
          visible={shareVisible}
          onClose={() => setShareVisible(false)}
          data={data}
          userId={userId}
          isVip={isVip}
          onUpgrade={() => {
            setShareVisible(false);
            router.push("/vip");
          }}
        />
      )}

      {/* ── AI Report Modal ── */}
      <Modal visible={aiModalVisible} transparent animationType="slide" onRequestClose={() => setAiModalVisible(false)}>
        <Pressable style={st.aiModalOverlay} onPress={() => setAiModalVisible(false)}>
          <Pressable style={st.aiModalSheet} onPress={() => {}}>
            <View style={st.aiModalHandle} />
            <View style={st.aiModalHeader}>
              <LinearGradient colors={["#F43F8F", "#F472B6"]} style={st.aiModalAvatar}>
                <Sparkles size={16} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={st.aiModalTitle}>Your AI Skin Report</Text>
                <Text style={st.aiModalSub}>Generated by Claude · {new Date().toLocaleDateString()}</Text>
              </View>
              <TouchableOpacity onPress={() => setAiModalVisible(false)} style={st.aiModalClose}>
                <X size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={st.aiModalBody} showsVerticalScrollIndicator={false}>
              {aiReportLoading && !displayedAi ? (
                <View style={st.aiLoadingBox}>
                  <ActivityIndicator size="large" color="#F43F8F" />
                  <Text style={st.aiLoadingText}>
                    Claude is analyzing your skin journey...
                  </Text>
                </View>
              ) : (
                <AIReportBody text={displayedAi} streaming={displayedAi.length < aiReport.length} />
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
    </SensitiveGate>
  );
}

// ─── 样式 ──────────────────────────────────────────────────
const { height: screenHeight } = Dimensions.get("window");
const st = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

  // AI Report Card
  aiReportCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    padding: 16,
    marginBottom: Spacing.lg,
    shadowColor: "#F43F8F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  aiReportIconBg: {
    width: 44, height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  aiReportInfo: { flex: 1 },
  aiReportTitle: { fontSize: 15, fontWeight: "700", color: "#fff", marginBottom: 3 },
  aiReportSub: { fontSize: 11, color: "rgba(255,255,255,0.75)" },

  // AI Report Modal
  aiModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  aiModalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: screenHeight * 0.85,
    paddingBottom: 40,
  },
  aiModalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginTop: 12 },
  aiModalHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 20, borderBottomWidth: 1, borderBottomColor: "#F9E0EE" },
  aiModalAvatar: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  aiModalTitle: { fontSize: 16, fontWeight: "700", color: "#1F2937" },
  aiModalSub: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  aiModalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  aiModalBody: { paddingHorizontal: 24, paddingTop: 16 },
  aiLoadingBox: { alignItems: "center", paddingVertical: 40, gap: 16 },
  aiLoadingText: { fontSize: 13, color: "#9CA3AF", textAlign: "center" },
  aiReportText: { fontSize: 14, color: "#374151", lineHeight: 24, paddingBottom: 20 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: 40 },

  // 标题
  titleArea: { marginBottom: Spacing.md },
  pageTitle: { fontSize: 28, fontWeight: "800", color: "#1F2937", letterSpacing: -0.5 },
  dateRange: { fontSize: FontSize.sm, color: Colors.gray400, marginTop: 4 },

  // Before/After Hero 卡片
  heroCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowColor: "#F0ABCA",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  compareRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 0,
    marginBottom: Spacing.lg,
  },
  compareItem: { alignItems: "center", gap: 6, flex: 1 },
  compareImgWrapper: { position: "relative" },
  compareImg: {
    width: 100,
    height: 128,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  scoreChip: {
    position: "absolute",
    bottom: 6,
    right: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  scoreChipText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  compareLabel: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    color: Colors.gray600,
  },
  compareDate: { fontSize: 10, color: Colors.gray400 },
  changeIndicator: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
    paddingHorizontal: 8,
  },
  changeBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  changeArrow: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "800",
    lineHeight: 18,
  },
  changeNum: { fontSize: 11, color: "#fff", fontWeight: "800" },
  // 总结语区域 — 规则引擎生成的个性化文字
  summaryBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFF0F8",
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "#FCE7F3",
  },
  summaryText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.gray700,
    lineHeight: 20,
  },

  // 数据卡
  statsRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: "#FFF0F8",
    borderRadius: Radius.xl,
    padding: Spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.15)",
    shadowColor: "#F472B6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  statVal: { fontSize: FontSize.xl, fontWeight: "800", color: "#F472B6" },
  statLbl: { fontSize: 10, color: "#9CA3AF", marginTop: 2 },

  // 通用卡片
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowColor: "#F0ABCA",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: "700",
    color: Colors.gray800,
    marginBottom: Spacing.md,
  },
  cardSub: { fontSize: FontSize.xs, color: Colors.gray400 },
  chartAxisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  chartAxisLabel: { fontSize: 10, color: Colors.gray400 },

  // 章节标签
  chapterLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.gray400,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },

  // 皮肤日记关联卡
  diaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginBottom: Spacing.lg,
    overflow: "hidden",
    ...Shadow.card,
  },
  diaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  diaryIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#fff0f6",
    alignItems: "center",
    justifyContent: "center",
  },
  diaryTitle: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.gray800,
  },
  diarySub: { fontSize: 10, color: Colors.gray400, marginTop: 1 },
  diaryInsightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  diaryInsightEmoji: { fontSize: 16, marginTop: 1 },
  diaryInsightText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.gray500,
    lineHeight: 17,
  },
  diaryFooter: {
    backgroundColor: "#fff5f5",
    padding: Spacing.md,
    margin: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: 10,
  },
  diaryFooterText: {
    fontSize: 11,
    color: Colors.rose400,
    textAlign: "center",
    fontWeight: "600",
  },

  // VIP 预览卡
  vipPreviewCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: Spacing.lg,
    ...Shadow.card,
  },
  vipPreviewHero: { padding: Spacing.lg, alignItems: "center", gap: 6, backgroundColor: "#1A0814" },
  vipPreviewTitle: {
    fontSize: FontSize.base,
    fontWeight: "800",
    color: "#fff",
    marginTop: 4,
  },
  vipPreviewSub: {
    fontSize: FontSize.xs,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 18,
  },
  vipPreviewList: { padding: Spacing.md },
  vipPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 10,
  },
  vipPreviewRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray50,
  },
  vipPreviewEmojiBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fff0f6",
    alignItems: "center",
    justifyContent: "center",
  },
  vipPreviewItemTitle: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.gray800,
  },
  // 描述文字用低对比度表示"被锁住"而不是硬性模糊
  vipPreviewItemDesc: {
    fontSize: FontSize.xs,
    color: Colors.gray200,
    marginTop: 1,
  },
  vipPreviewCta: {
    padding: Spacing.lg,
    paddingTop: 0,
    alignItems: "center",
    gap: 8,
  },
  vipPreviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: Radius.full,
  },
  vipPreviewBtnText: {
    color: "#fff",
    fontSize: FontSize.base,
    fontWeight: "800",
  },
  vipPreviewBtnSub: { fontSize: 11, color: Colors.gray400 },

  // 空状态
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff0f6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.gray800,
    marginBottom: Spacing.sm,
  },
  emptySub: {
    fontSize: FontSize.sm,
    color: Colors.gray400,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  emptyBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: Radius.full,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },

  // AI 正文块（章节化渲染）
  aiBlock: { marginBottom: Spacing.lg },
  aiBlockTitle: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: "#F43F8F",
    marginBottom: 6,
  },
  aiCaret: {
    color: "#F43F8F",
    fontWeight: "700",
    opacity: 0.7,
  },

  // Share 入口卡片（报告页里那个按钮）
  shareCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: "#fff",
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: "#F9E0EE",
    shadowColor: "#f472b6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  shareIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF3F6",
    alignItems: "center",
    justifyContent: "center",
  },
  shareInfo: { flex: 1 },
  shareTitle: {
    fontSize: FontSize.base,
    fontWeight: "700",
    color: Colors.gray800,
  },
  shareSub: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    marginTop: 2,
  },

  // Share modal
  shareOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  shareSheet: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  shareClose: {
    alignSelf: "flex-end",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  shareImage: {
    width: "100%",
    aspectRatio: 9 / 16,
    borderRadius: Radius.xxl,
    padding: Spacing.xxl,
    justifyContent: "center",
    alignItems: "center",
  },
  shareBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    marginBottom: Spacing.xxl,
  },
  shareBadgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  shareBigNum: {
    fontSize: 72,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -2,
  },
  shareBigLbl: {
    fontSize: FontSize.md,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
    marginTop: 4,
    marginBottom: Spacing.xxl,
    textAlign: "center",
  },
  shareStats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  shareStat: { alignItems: "center", minWidth: 56 },
  shareStatVal: { color: "#fff", fontSize: FontSize.lg, fontWeight: "700" },
  shareStatLbl: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    marginTop: 2,
  },
  shareStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  shareTag: {
    position: "absolute",
    bottom: Spacing.lg,
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "500",
  },
  shareHint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: FontSize.xs,
    textAlign: "center",
    marginTop: Spacing.lg,
    lineHeight: 18,
    paddingHorizontal: Spacing.md,
  },

  // Picker (4 选 1)
  sharePicker: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
  },
  sharePickerTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.gray800,
    marginBottom: 4,
  },
  sharePickerSub: {
    fontSize: FontSize.sm,
    color: Colors.gray400,
    marginBottom: Spacing.lg,
  },
  sharePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#F3E8FF",
  },
  sharePickerRowTitle: {
    fontSize: FontSize.base,
    fontWeight: "600",
    color: Colors.gray800,
  },
  sharePickerRowSub: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    marginTop: 2,
  },

  // Before / After card
  shareBACard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    alignItems: "center",
  },
  shareBATitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.gray800,
  },
  shareBASub: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  shareBARow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  shareBACell: { alignItems: "center", flex: 1 },
  shareBAImg: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: Radius.lg,
    backgroundColor: "#FCE7F3",
  },
  shareBAEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  shareBAEmptyText: { color: "#be185d", fontSize: 11 },
  shareBAScore: {
    fontSize: FontSize.xxl,
    fontWeight: "800",
    color: Colors.gray800,
    marginTop: Spacing.sm,
  },
  shareBALabel: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    marginTop: 2,
  },
  shareBAArrow: { paddingHorizontal: 2 },
  shareBADelta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.lg,
    backgroundColor: "#FDF2F8",
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  shareBADeltaText: { fontSize: FontSize.base, fontWeight: "700" },
  shareBATag: {
    marginTop: Spacing.lg,
    color: Colors.gray400,
    fontSize: 11,
    fontWeight: "500",
  },

  // Streak card
  shareStreakCard: {
    width: "100%",
    aspectRatio: 9 / 16,
    borderRadius: Radius.xxl,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xxl,
  },
  shareStreakEmoji: { fontSize: 64, marginBottom: Spacing.sm },
  shareStreakBig: {
    fontSize: 96,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -4,
    lineHeight: 100,
  },
  shareStreakLbl: {
    fontSize: FontSize.lg,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
    marginBottom: Spacing.xxl,
  },
  shareStreakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
  },
  shareStreakCell: { alignItems: "center" },
  shareStreakCellVal: {
    color: "#fff",
    fontSize: FontSize.xl,
    fontWeight: "700",
  },
  shareStreakCellLbl: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    marginTop: 2,
  },
  shareStreakCellDiv: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  shareStreakMotto: {
    color: "rgba(255,255,255,0.95)",
    fontSize: FontSize.md,
    fontWeight: "600",
    marginTop: Spacing.xxl,
    textAlign: "center",
  },
  shareStreakTag: {
    position: "absolute",
    bottom: Spacing.lg,
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "600",
  },

  // Invite card
  shareInviteCard: {
    width: "100%",
    borderRadius: Radius.xxl,
    alignItems: "center",
    padding: Spacing.xxl,
  },
  shareInviteTitle: {
    color: "#fff",
    fontSize: FontSize.xl,
    fontWeight: "700",
    marginTop: Spacing.md,
  },
  shareInviteSub: {
    color: "rgba(255,255,255,0.9)",
    fontSize: FontSize.sm,
    textAlign: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  shareInviteCodeBox: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    alignItems: "center",
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderStyle: "dashed",
  },
  shareInviteCodeLbl: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  shareInviteCode: {
    color: "#fff",
    fontSize: FontSize.xxxl,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 4,
  },
  shareInviteBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: Spacing.xxl,
    paddingVertical: 12,
    borderRadius: Radius.full,
  },
  shareInviteBtnText: {
    color: "#EC4899",
    fontSize: FontSize.base,
    fontWeight: "700",
  },

  // Doctor card
  shareDoctorCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: Radius.xxl,
    alignItems: "center",
    padding: Spacing.xxl,
  },
  shareDoctorTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.gray800,
    marginTop: Spacing.md,
    textAlign: "center",
  },
  shareDoctorSub: {
    fontSize: FontSize.sm,
    color: Colors.gray500,
    textAlign: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  shareDoctorVipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fef9c3",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    marginBottom: Spacing.lg,
  },
  shareDoctorVipText: {
    color: "#92400e",
    fontSize: FontSize.xs,
    fontWeight: "600",
  },
  shareDoctorBtn: {
    backgroundColor: "#F43F8F",
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: 14,
    borderRadius: Radius.full,
  },
  shareDoctorBtnLocked: {
    backgroundColor: "#d97706",
  },
  shareDoctorBtnText: {
    color: "#fff",
    fontSize: FontSize.base,
    fontWeight: "700",
  },

  // ── 统一总结卡（share progress 新版） ──
  summaryCard: {
    width: "100%",
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    alignItems: "center",
  },
  summaryHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  summaryBrand: {
    color: "#fff",
    fontSize: FontSize.lg,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  summaryStreakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  summaryStreakPillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  summaryScoreWrap: {
    alignItems: "center",
    marginVertical: Spacing.md,
  },
  summaryScoreBig: {
    fontSize: 72,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -2,
    lineHeight: 78,
  },
  summaryScoreLbl: {
    color: "rgba(255,255,255,0.9)",
    fontSize: FontSize.sm,
    fontWeight: "600",
    marginTop: 2,
  },
  summaryDeltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.sm,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  summaryDeltaText: {
    color: "#fff",
    fontSize: FontSize.xs,
    fontWeight: "700",
  },
  summaryBARow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    width: "100%",
  },
  summaryBACell: {
    alignItems: "center",
    flex: 1,
  },
  summaryBAImg: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  summaryBAEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  summaryBALbl: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  summaryInviteBox: {
    width: "100%",
    marginTop: Spacing.lg,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: "center",
  },
  summaryInviteLbl: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "600",
  },
  summaryInviteCode: {
    color: "#fff",
    fontSize: FontSize.xl,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 2,
  },
  summaryInviteUrl: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    marginTop: 2,
  },
  summaryShareBtn: {
    marginTop: Spacing.lg,
    backgroundColor: "#fff",
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: 14,
    borderRadius: Radius.full,
  },
  summaryShareBtnText: {
    color: "#F43F8F",
    fontSize: FontSize.base,
    fontWeight: "700",
  },
});
