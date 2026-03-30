import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Image,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Path,
  Defs,
  LinearGradient as SvgGrad,
  Stop,
} from "react-native-svg";
import {
  TrendingUp,
  TrendingDown,
  Crown,
  Check,
  Lock,
} from "lucide-react-native";
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

const { width } = Dimensions.get("window");
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.59:3000";
const CHART_W = width - Spacing.xl * 2 - Spacing.xxl * 2;

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

// ─── 工具函数 ─────────────────────────────────────────────
async function getUserId(): Promise<string> {
  let id = await AsyncStorage.getItem("@aurasight_user_id");
  if (!id) {
    id = "guest_" + Math.random().toString(36).slice(2, 10);
    await AsyncStorage.setItem("@aurasight_user_id", id);
  }
  return id;
}

// ─── 折线图 ───────────────────────────────────────────────
// 把 daily_scores 数组渲染成一条 SVG 折线，带渐变填充
function ScoreLineChart({ data }: { data: DailyScore[] }) {
  const H = 80;
  const W = CHART_W;

  if (data.length < 2) {
    return (
      <View style={[chart.empty]}>
        <Text style={chart.emptyText}>Scan more days to see your trend</Text>
      </View>
    );
  }

  const maxScore = Math.max(...data.map((d) => d.score), 100);
  const minScore = Math.min(...data.map((d) => d.score), 0);
  const range = maxScore - minScore || 1;

  // 将评分映射到 SVG 坐标
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.score - minScore) / range) * H;
    return { x, y };
  });

  // 构建折线路径
  const linePath = points
    .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
    .join(" ");

  // 构建填充区域路径（折线下方到底部）
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;

  return (
    <Svg width={W} height={H} style={{ overflow: "visible" }}>
      <Defs>
        <SvgGrad id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#f472b6" />
          <Stop offset="100%" stopColor="#fb7185" />
        </SvgGrad>
        <SvgGrad id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#f472b6" stopOpacity="0.2" />
          <Stop offset="100%" stopColor="#f472b6" stopOpacity="0" />
        </SvgGrad>
      </Defs>
      <Path d={areaPath} fill="url(#areaGrad)" />
      <Path
        d={linePath}
        fill="none"
        stroke="url(#lineGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const chart = StyleSheet.create({
  empty: { height: 80, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: FontSize.xs, color: Colors.gray300 },
});

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
      <View style={donut.empty}>
        <Text style={donut.emptyText}>No acne data yet</Text>
      </View>
    );
  }

  return (
    <View style={donut.row}>
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
        <View style={donut.center}>
          <Text style={donut.total}>{total}</Text>
          <Text style={donut.totalLabel}>Total</Text>
        </View>
      </View>

      <View style={donut.legend}>
        {ACNE_TYPES.map((item) => (
          <View key={item.key} style={donut.legendRow}>
            <View style={[donut.dot, { backgroundColor: item.color }]} />
            <Text style={donut.legendLabel}>{item.label}</Text>
            <Text style={donut.legendCount}>
              {breakdown[item.key as keyof typeof breakdown]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const donut = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.xl },
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  total: { fontSize: FontSize.xxl, fontWeight: "700", color: Colors.gray800 },
  totalLabel: { fontSize: 9, color: Colors.gray500 },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { flex: 1, fontSize: FontSize.xs, color: Colors.gray600 },
  legendCount: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    color: Colors.gray800,
  },
  empty: { height: 112, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: FontSize.xs, color: Colors.gray300 },
});

// ─── VIP 模糊遮罩卡片 ────────────────────────────────────
// 这个组件展示 VIP 功能的"样子"，但用渐变遮罩盖住内容，
// 让免费用户知道功能存在，但无法使用 → 付费转化关键设计
function VIPBlurCard({ onUpgrade }: { onUpgrade: () => void }) {
  const mockInsights = [
    {
      icon: "🌤",
      title: "Weather Impact",
      desc: "High humidity days correlate with 40% more breakouts",
    },
    {
      icon: "💧",
      title: "Hydration Pattern",
      desc: "Skin clarity improved 23% on days with 8+ glasses of water",
    },
    {
      icon: "📅",
      title: "Hormonal Cycle",
      desc: "Chin breakouts peak during days 21-25 of your cycle",
    },
  ];

  return (
    <View style={vip.wrapper}>
      {/* 内容（会被遮罩覆盖） */}
      <View style={vip.contentBehind}>
        {mockInsights.map((ins, i) => (
          <View key={i} style={vip.mockInsightRow}>
            <Text style={vip.mockEmoji}>{ins.icon}</Text>
            <View style={vip.mockText}>
              <Text style={vip.mockTitle}>{ins.title}</Text>
              <Text style={vip.mockDesc}>{ins.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* 渐变遮罩 — 从透明到白色，制造"内容被锁住"的视觉效果 */}
      <LinearGradient
        colors={[
          "rgba(255,255,255,0)",
          "rgba(255,255,255,0.92)",
          "rgba(255,255,255,1)",
        ]}
        style={vip.overlay}
        pointerEvents="none"
      />

      {/* 升级按钮 */}
      <View style={vip.cta}>
        <Lock size={16} color={Colors.rose400} />
        <Text style={vip.ctaTitle}>Deep Analysis — VIP Only</Text>
        <Text style={vip.ctaSub}>
          Weather, hormonal cycle & personalized skincare recommendations
        </Text>
        <TouchableOpacity onPress={onUpgrade} activeOpacity={0.85}>
          <LinearGradient
            colors={Gradients.roseMain}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={vip.ctaBtn}
          >
            <Crown size={14} color="#fde68a" />
            <Text style={vip.ctaBtnText}>Unlock with VIP</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const vip = StyleSheet.create({
  wrapper: {
    position: "relative",
    overflow: "hidden",
    borderRadius: Radius.xl,
    marginBottom: Spacing.lg,
  },
  contentBehind: { padding: Spacing.lg, gap: Spacing.md },
  mockInsightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  mockEmoji: { fontSize: 24 },
  mockText: { flex: 1 },
  mockTitle: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.gray800,
  },
  mockDesc: {
    fontSize: FontSize.xs,
    color: Colors.gray500,
    marginTop: 2,
    lineHeight: 16,
  },
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0, height: 160 },
  cta: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  ctaTitle: {
    fontSize: FontSize.base,
    fontWeight: "700",
    color: Colors.gray800,
  },
  ctaSub: {
    fontSize: FontSize.xs,
    color: Colors.gray500,
    textAlign: "center",
    lineHeight: 16,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  ctaBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
});

// ─── VIP 功能列表（已解锁时显示） ─────────────────────────
const VIP_FEATURES = [
  "Deep AI report (weather & cycle correlation)",
  "Skincare ingredient recommendations",
  "Permanent cloud storage",
  "4K timelapse video export",
  "Year-over-year comparison",
];

// ─── 主页面 ───────────────────────────────────────────────
export default function ReportScreen() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVip, setIsVip] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  async function loadData() {
    try {
      const id = await getUserId();
      const mode = await AsyncStorage.getItem("@aurasight_user_mode");
      setIsVip(mode === "vip");

      const res = await fetch(`${API_URL}/scans/${id}/report`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load report:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <LinearGradient colors={["#fff5f5", "#ffffff"]} style={styles.center}>
        <ActivityIndicator size="large" color={Colors.rose400} />
      </LinearGradient>
    );
  }

  // 没有任何扫描数据时显示空状态
  if (!data || data.total_scans === 0) {
    return (
      <LinearGradient colors={["#fff5f5", "#ffffff"]} style={styles.container}>
        <SafeAreaView style={styles.center}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptySub}>
            Complete at least one scan to generate your report
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/camera")}
            activeOpacity={0.85}
          >
            <LinearGradient colors={Gradients.roseMain} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Start Scanning</Text>
            </LinearGradient>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const changePct = data.score_change_pct;
  const isImproved = changePct >= 0;

  return (
    <LinearGradient colors={["#fff5f5", "#ffffff"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* ── 标题 ──────────────────────────────────────── */}
          <View style={styles.header}>
            <Text style={styles.title}>Your 30-Day Journey</Text>
            {data.date_range && (
              <Text style={styles.dateRange}>
                {data.date_range.from} — {data.date_range.to}
              </Text>
            )}
          </View>

          {/* ── 顶部数据卡（3个关键数字） ────────────────── */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, Shadow.card]}>
              <Text style={styles.statValue}>{data.total_scans}</Text>
              <Text style={styles.statLabel}>Scans</Text>
            </View>
            <View style={[styles.statCard, Shadow.card]}>
              <Text style={styles.statValue}>{data.avg_skin_score}</Text>
              <Text style={styles.statLabel}>Avg Score</Text>
            </View>
            <View style={[styles.statCard, Shadow.card]}>
              <Text style={styles.statValue}>{data.streak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
          </View>

          {/* ── 皮肤评分趋势折线图 ───────────────────────── */}
          <View style={[styles.card, Shadow.card]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Skin Score Trend</Text>
              <View style={styles.changeBadge}>
                {isImproved ? (
                  <TrendingUp size={14} color={Colors.emerald} />
                ) : (
                  <TrendingDown size={14} color={Colors.red} />
                )}
                <Text
                  style={[
                    styles.changeText,
                    { color: isImproved ? Colors.emerald : Colors.red },
                  ]}
                >
                  {isImproved ? "+" : ""}
                  {changePct}%
                </Text>
              </View>
            </View>
            <ScoreLineChart data={data.daily_scores} />
            <View style={styles.chartLabels}>
              <Text style={styles.chartLabel}>Day 1</Text>
              <Text style={styles.chartLabel}>Today</Text>
            </View>
          </View>

          {/* ── 痘痘类型甜甜圈图 ─────────────────────────── */}
          <View style={[styles.card, Shadow.card]}>
            <Text style={styles.cardTitle}>Condition Breakdown</Text>
            <DonutChart breakdown={data.acne_breakdown} />
          </View>

          {/* ── 前后对比 ─────────────────────────────────── */}
          <View style={[styles.card, Shadow.card]}>
            <Text style={styles.cardTitle}>Before & After</Text>
            <View style={styles.compareRow}>
              {/* 第一次扫描 */}
              <View style={styles.compareItem}>
                {data.first_scan?.image_uri ? (
                  <Image
                    source={{ uri: data.first_scan.image_uri }}
                    style={styles.compareImg}
                  />
                ) : (
                  <LinearGradient
                    colors={["#ffe4e6", "#fce7f3"]}
                    style={styles.compareImg}
                  >
                    <Text style={styles.compareEmoji}>👤</Text>
                  </LinearGradient>
                )}
                <Text style={styles.compareLabel}>Day 1</Text>
                <Text style={styles.compareScore}>
                  Score {data.first_scan?.score ?? "–"}
                </Text>
              </View>

              {/* 中间箭头 + 变化 */}
              <View style={styles.compareDivider}>
                <View style={styles.dividerLine} />
                <LinearGradient
                  colors={
                    isImproved
                      ? [Colors.emerald, "#10b981"]
                      : [Colors.red, Colors.rose400]
                  }
                  style={styles.dividerBadge}
                >
                  <Text style={styles.dividerBadgeText}>
                    {isImproved ? "↑" : "↓"} {Math.abs(changePct)}%
                  </Text>
                </LinearGradient>
                <View style={styles.dividerLine} />
              </View>

              {/* 最新扫描 */}
              <View style={styles.compareItem}>
                {data.latest_scan?.image_uri ? (
                  <Image
                    source={{ uri: data.latest_scan.image_uri }}
                    style={styles.compareImg}
                  />
                ) : (
                  <LinearGradient
                    colors={["#d1fae5", "#a7f3d0"]}
                    style={styles.compareImg}
                  >
                    <Text style={styles.compareEmoji}>👤</Text>
                  </LinearGradient>
                )}
                <Text style={styles.compareLabel}>Today</Text>
                <Text style={styles.compareScore}>
                  Score {data.latest_scan?.score ?? "–"}
                </Text>
              </View>
            </View>
          </View>

          {/* ── VIP 区块 ─────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Deep Analysis</Text>

          {isVip ? (
            // VIP 用户：显示真实功能（目前是占位，Phase 5 接真实 AI）
            <View style={[styles.card, Shadow.card]}>
              <View style={styles.vipActiveHeader}>
                <Crown size={16} color="#d97706" />
                <Text style={styles.vipActiveTitle}>VIP Features Unlocked</Text>
              </View>
              {VIP_FEATURES.map((f, i) => (
                <View key={i} style={styles.vipFeatureRow}>
                  <Check size={14} color={Colors.emerald} />
                  <Text style={styles.vipFeatureText}>{f}</Text>
                </View>
              ))}
              <View style={styles.vipComingSoon}>
                <Text style={styles.vipComingSoonText}>
                  🚀 AI deep analysis is being trained on your data. Full report
                  coming soon!
                </Text>
              </View>
            </View>
          ) : (
            // 免费用户：模糊遮罩 + 升级按钮
            <VIPBlurCard onUpgrade={() => router.push("/(tabs)/profile")} />
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── 样式 ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },

  // 空状态
  emptyEmoji: { fontSize: 56, marginBottom: Spacing.md },
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

  // 标题
  header: { marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: "700", color: Colors.gray800 },
  dateRange: { fontSize: FontSize.sm, color: Colors.gray400, marginTop: 4 },

  // 数据卡
  statsRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    alignItems: "center",
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.gray800,
  },
  statLabel: { fontSize: 10, color: Colors.gray500, marginTop: 2 },

  // 卡片
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: "600",
    color: Colors.gray800,
    marginBottom: Spacing.md,
  },
  changeBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  changeText: { fontSize: FontSize.base, fontWeight: "700" },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  chartLabel: { fontSize: 10, color: Colors.gray400 },

  // 对比
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
  },
  compareItem: { alignItems: "center", gap: 6 },
  compareImg: {
    width: 80,
    height: 100,
    borderRadius: Radius.xl,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  compareEmoji: { fontSize: 36 },
  compareLabel: { fontSize: FontSize.xs, color: Colors.gray500 },
  compareScore: { fontSize: 10, color: Colors.gray400 },
  compareDivider: { alignItems: "center", gap: 6 },
  dividerLine: { width: 24, height: 1, backgroundColor: Colors.gray200 },
  dividerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  dividerBadgeText: { color: "#fff", fontSize: FontSize.xs, fontWeight: "700" },

  // Section title
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: "600",
    color: Colors.gray800,
    marginBottom: Spacing.sm,
  },

  // VIP 已解锁
  vipActiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  vipActiveTitle: {
    fontSize: FontSize.base,
    fontWeight: "700",
    color: "#d97706",
  },
  vipFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 8,
  },
  vipFeatureText: { fontSize: FontSize.sm, color: Colors.gray600 },
  vipComingSoon: {
    backgroundColor: "#fff7ed",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  vipComingSoonText: {
    fontSize: FontSize.xs,
    color: "#92400e",
    lineHeight: 18,
  },
});
