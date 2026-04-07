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

async function getUserId(): Promise<string> {
  let id = await AsyncStorage.getItem("@aurasight_user_id");
  if (!id) {
    id = "guest_" + Math.random().toString(36).slice(2, 10);
    await AsyncStorage.setItem("@aurasight_user_id", id);
  }
  return id;
}

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
// 用规则引擎把日记标签和皮肤状态做简单关联，给用户"AI 在认识我"的感受
// 真正的机器学习关联分析是 VIP 功能，这里是规则版的免费预览
function DiaryInsightCard({ totalScans }: { totalScans: number }) {
  // 只有扫描次数足够多时才显示，避免数据不足时给出误导性结论
  if (totalScans < 5) return null;

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

      {/* 占位洞察 — 等皮肤日记数据积累后替换成真实关联分析 */}
      <View style={st.diaryInsightRow}>
        <Text style={st.diaryInsightEmoji}>💤</Text>
        <Text style={st.diaryInsightText}>
          Keep logging sleep quality — patterns usually emerge after 2 weeks of
          data.
        </Text>
      </View>
      <View style={st.diaryInsightRow}>
        <Text style={st.diaryInsightEmoji}>💧</Text>
        <Text style={st.diaryInsightText}>
          Water intake correlation will be visible once you have 10+ diary
          entries.
        </Text>
      </View>

      <View style={st.diaryFooter}>
        <Text style={st.diaryFooterText}>
          The more you log, the smarter the analysis gets.
        </Text>
      </View>
    </View>
  );
}

// ─── Chapter 4: VIP 升级区块 ─────────────────────────────
// 不是"扣押内容"的模糊墙，而是一个诱人的预览卡片
// 让用户看到真实的 VIP 功能样子，然后做出有知情权的付费决定
function VIPUpgradeSection({
  isVip,
  onUpgrade,
}: {
  isVip: boolean;
  onUpgrade: () => void;
}) {
  const mockInsights = [
    {
      icon: "🌤",
      title: "Weather Impact",
      desc: "High humidity days correlate with 40% more breakouts",
    },
    {
      icon: "💧",
      title: "Hydration",
      desc: "Skin clarity improved 23% on high-water intake days",
    },
    {
      icon: "📅",
      title: "Hormonal Cycle",
      desc: "Chin breakouts peak during days 21–25 of your cycle",
    },
    {
      icon: "🧴",
      title: "Product Analysis",
      desc: "Your new serum shows positive results after 7 days",
    },
  ];

  if (isVip) {
    return (
      <View style={[st.card, Shadow.card]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: Spacing.sm,
            marginBottom: Spacing.md,
          }}
        >
          <Crown size={16} color="#d97706" />
          <Text
            style={{
              fontSize: FontSize.base,
              fontWeight: "700",
              color: "#d97706",
            }}
          >
            VIP Features Unlocked
          </Text>
        </View>
        {[
          "Deep AI causal analysis",
          "Skincare ingredient recommendations",
          "Permanent cloud storage",
          "4K timelapse video",
          "Year-over-year comparison",
        ].map((f, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: Spacing.sm,
              marginBottom: 8,
            }}
          >
            <Check size={14} color={Colors.emerald} />
            <Text style={{ fontSize: FontSize.sm, color: Colors.gray600 }}>
              {f}
            </Text>
          </View>
        ))}
        <View
          style={{
            backgroundColor: "#fff7ed",
            borderRadius: Radius.lg,
            padding: Spacing.md,
            marginTop: Spacing.sm,
          }}
        >
          <Text
            style={{ fontSize: FontSize.xs, color: "#92400e", lineHeight: 18 }}
          >
            🚀 AI deep analysis is being trained on your data. Full report
            coming very soon!
          </Text>
        </View>
      </View>
    );
  }

  // 免费用户看到的是一个"功能预览"卡片，不是被遮住的内容
  // 设计逻辑：让用户看到真实价值，而不是制造人工的 FOMO
  return (
    <View style={st.vipPreviewCard}>
      {/* 深色 Hero 区 */}
      <LinearGradient colors={["#1a0a14", "#0d0d1a"]} style={st.vipPreviewHero}>
        <Lock size={16} color="rgba(255,255,255,0.4)" />
        <Text style={st.vipPreviewTitle}>Deep Analysis</Text>
        <Text style={st.vipPreviewSub}>
          Unlock AI-powered insights about what&apos;s driving your skin changes
        </Text>
      </LinearGradient>

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
      <LinearGradient colors={["#fff5f5", "#ffffff"]} style={st.center}>
        <ActivityIndicator size="large" color={Colors.rose400} />
      </LinearGradient>
    );
  }

  // 空状态：没有数据时引导用户去扫描
  if (!data || data.total_scans === 0) {
    return (
      <LinearGradient colors={["#fff5f5", "#ffffff"]} style={st.container}>
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
    );
  }

  const isImproved = data.score_change_pct >= 0;

  return (
    <LinearGradient colors={["#fff5f5", "#ffffff"]} style={st.container}>
      <SafeAreaView style={st.safeArea}>
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
          <DiaryInsightCard totalScans={data.total_scans} />

          {/* ── Chapter 4: VIP 深度分析 ── */}
          <Text style={st.chapterLabel}>Deep Analysis</Text>
          <VIPUpgradeSection
            isVip={isVip}
            onUpgrade={() => router.push("/vip")}
          />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── 样式 ──────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: 40 },

  // 标题
  titleArea: { marginBottom: Spacing.md },
  pageTitle: { fontSize: 28, fontWeight: "800", color: Colors.gray800 },
  dateRange: { fontSize: FontSize.sm, color: Colors.gray400, marginTop: 4 },

  // Before/After Hero 卡片
  heroCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadow.card,
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
    backgroundColor: "#fff5f5",
    borderRadius: 12,
    padding: Spacing.md,
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
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    alignItems: "center",
  },
  statVal: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.gray800 },
  statLbl: { fontSize: 10, color: Colors.gray500, marginTop: 2 },

  // 通用卡片
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
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
  vipPreviewHero: { padding: Spacing.lg, alignItems: "center", gap: 6 },
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
});
