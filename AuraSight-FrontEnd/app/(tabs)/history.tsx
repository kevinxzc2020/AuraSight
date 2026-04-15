import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Polyline, Circle, Line, Text as SvgText } from "react-native-svg";
import { ChevronLeft, ChevronRight, Flame, Camera, Lock, Sparkles } from "lucide-react-native";
import { useUser } from "../../lib/userContext";
import {
  Colors,
  Gradients,
  Spacing,
  Radius,
  FontSize,
  Shadow,
  StatusColors,
} from "../../constants/theme";
import {
  getRecentScans,
  getStats,
  ScanRecord,
  StatsResult,
} from "../../lib/mongodb";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { SwipeableScanCard } from "../../components/SwipeableScanCard";
import { getUserId } from "../../lib/userId";
import { SensitiveGate } from "../../lib/sensitiveGate";

const { width } = Dimensions.get("window");
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.59:3000";
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// ─── 折线图组件 ───────────────────────────────────────────
// 用皮肤分数（而不是扫描次数）画趋势折线，更能体现"是否在变好"
// 只显示有数据的点，没有扫描的天用虚线连接
function SkinScoreLineChart({ scans }: { scans: ScanRecord[] }) {
  const chartW = width - Spacing.xl * 2 - Spacing.lg * 2;
  const chartH = 80;

  if (scans.length === 0) {
    return (
      <View
        style={{
          height: chartH + 24,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={st.emptyChartText}>
          Scan daily to see your score trend
        </Text>
      </View>
    );
  }

  // 按日期排序，取最近14天有数据的扫描记录（不是每天都有，所以不填0）
  const sorted = [...scans]
    .sort(
      (a, b) =>
        new Date(a.scan_date).getTime() - new Date(b.scan_date).getTime(),
    )
    .slice(-14);

  const scores = sorted.map((s) => s.skin_score ?? 100);
  const minScore = Math.max(0, Math.min(...scores) - 10);
  const maxScore = Math.min(100, Math.max(...scores) + 10);
  const range = maxScore - minScore || 20;

  // 将分数映射到 Y 坐标（上小下大，所以要翻转）
  const toY = (score: number) => chartH - ((score - minScore) / range) * chartH;

  // 将索引映射到 X 坐标
  const toX = (i: number) =>
    sorted.length === 1 ? chartW / 2 : (i / (sorted.length - 1)) * chartW;

  // 构建折线的点集合（SVG Polyline 格式）
  const points = sorted
    .map(
      (s, i) => `${toX(i).toFixed(1)},${toY(s.skin_score ?? 100).toFixed(1)}`,
    )
    .join(" ");

  // 最后一个点（用于高亮显示当前分数）
  const lastX = toX(sorted.length - 1);
  const lastY = toY(sorted[sorted.length - 1].skin_score ?? 100);
  const lastScore = sorted[sorted.length - 1].skin_score ?? 100;

  // 判断整体趋势：最后3个点的均值 vs 最前3个点的均值
  const firstAvg =
    scores.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, scores.length);
  const lastAvg =
    scores.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, scores.length);
  const improving = lastAvg >= firstAvg;

  const lineColor = improving ? Colors.emerald : Colors.rose400;

  return (
    <View>
      {/* 趋势说明行 */}
      <View style={st.chartHeader}>
        <Text style={st.chartLabel}>Skin Score Trend</Text>
        <View
          style={[
            st.trendBadge,
            { backgroundColor: improving ? "#ecfdf5" : "#fff0f6" },
          ]}
        >
          <Text
            style={[
              st.trendBadgeText,
              { color: improving ? Colors.emerald : Colors.rose400 },
            ]}
          >
            {improving ? "↗ Improving" : "↘ Declining"}
          </Text>
        </View>
      </View>

      {/* SVG 折线图 */}
      <Svg width={chartW} height={chartH + 24}>
        {/* Y 轴参考线（淡灰色水平线） */}
        {[0, 0.5, 1].map((ratio, i) => {
          const y = chartH * ratio;
          const score = Math.round(maxScore - ratio * range);
          return (
            <React.Fragment key={i}>
              <Line
                x1={0}
                y1={y}
                x2={chartW}
                y2={y}
                stroke={Colors.gray100}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <SvgText
                x={chartW}
                y={y - 2}
                textAnchor="end"
                fontSize={9}
                fill={Colors.gray300}
              >
                {score}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* 折线本身 */}
        <Polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 每个数据点的圆点 */}
        {sorted.map((s, i) => (
          <Circle
            key={i}
            cx={toX(i)}
            cy={toY(s.skin_score ?? 100)}
            r={i === sorted.length - 1 ? 5 : 3}
            fill={i === sorted.length - 1 ? lineColor : "#fff"}
            stroke={lineColor}
            strokeWidth={2}
          />
        ))}

        {/* 最后一个点的分数标注 */}
        <SvgText
          x={Math.min(lastX + 6, chartW - 20)}
          y={lastY - 8}
          fontSize={11}
          fontWeight="700"
          fill={lineColor}
          textAnchor="middle"
        >
          {lastScore}
        </SvgText>
      </Svg>

      <Text style={st.chartSubLabel}>Last {sorted.length} scans</Text>
    </View>
  );
}

// ─── 月度总览 Hero 卡片 ───────────────────────────────────
// 这是页面最顶部的核心数据展示区
// 让用户一眼就看到本月的成就感：扫描了多少天、平均分、最长连续天数
function MonthHero({
  scans,
  stats,
  currentYear,
  currentMonth,
  isVIP,
}: {
  scans: ScanRecord[];
  stats: StatsResult | null;
  currentYear: number;
  currentMonth: number;
  isVIP: boolean;
}) {
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // 计算本月扫描天数（去重，同一天多次只算一天）
  const scannedDaysThisMonth = new Set(
    scans
      .filter((s) => {
        const d = new Date(s.scan_date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      })
      .map((s) => new Date(s.scan_date).toISOString().split("T")[0]),
  ).size;

  // 本月平均分
  const monthScans = scans.filter((s) => {
    const d = new Date(s.scan_date);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });
  const avgScore =
    monthScans.length > 0
      ? Math.round(
          monthScans.reduce((sum, s) => sum + (s.skin_score ?? 100), 0) /
            monthScans.length,
        )
      : null;

  const monthPct = Math.round((scannedDaysThisMonth / daysInMonth) * 100);

  return (
    <LinearGradient colors={["#F43F8F", "#F472B6", "#FB9FBD"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.hero}>
      {/* 本月进度环 + 天数 */}
      <View style={st.heroLeft}>
        <View style={st.heroRingWrapper}>
          {/* 背景环 */}
          <View style={st.heroRingBg} />
          {/* 前景弧（用简单的渐变矩形模拟，真实实现需要 SVG arc） */}
          <View style={st.heroRingCenter}>
            <Text style={st.heroRingNum}>{scannedDaysThisMonth}</Text>
            <Text style={st.heroRingLabel}>/ {daysInMonth} days</Text>
          </View>
        </View>
        <Text style={st.heroRingDesc}>
          {monthPct >= 80
            ? "🔥 Incredible!"
            : monthPct >= 50
              ? "💪 Great work!"
              : monthPct >= 20
                ? "📸 Keep going!"
                : "✨ Just started"}
        </Text>
      </View>

      {/* 右侧统计数字 */}
      <View style={st.heroRight}>
        <View style={st.heroStat}>
          {isVIP ? (
            <Text style={st.heroStatVal}>{avgScore ?? "—"}</Text>
          ) : (
            <Lock size={18} color="#fff" style={{ marginBottom: 2 }} />
          )}
          <Text style={st.heroStatLabel}>Avg score</Text>
        </View>
        <View style={st.heroStatDivider} />
        <View style={st.heroStat}>
          <Text style={st.heroStatVal}>{stats?.total_scans ?? 0}</Text>
          <Text style={st.heroStatLabel}>Total scans</Text>
        </View>
        <View style={st.heroStatDivider} />
        <View style={st.heroStat}>
          <Text style={st.heroStatVal}>{stats?.streak ?? 0}</Text>
          <Text style={st.heroStatLabel}>Day streak</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

// ─── 主页面 ───────────────────────────────────────────────
export default function HistoryScreen() {
  const { user } = useUser();
  const isVIP = user?.mode === "vip";
  const [activeFilter, setActiveFilter] = useState("All");
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  async function loadData() {
    try {
      setLoading(true);
      const userId = await getUserId();
      const [scanData, statsData] = await Promise.all([
        getRecentScans(userId, 60), // 多取一些，用于折线图
        getStats(userId),
      ]);
      setScans(scanData);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`${API_URL}/scans/${id}`, { method: "DELETE" });
      setScans((prev) => prev.filter((s) => s._id !== id));
    } catch {
      Alert.alert("Error", "Failed to delete scan.");
    }
  }

  // 日历数据：建立"日期字符串 → 扫描记录"的映射
  const scanMap = scans.reduce(
    (acc, scan) => {
      const date = new Date(scan.scan_date).toISOString().split("T")[0];
      // 同一天有多次扫描时，保留分数最低的（最差状态，更有参考价值）
      if (
        !acc[date] ||
        (scan.skin_score ?? 100) < (acc[date].skin_score ?? 100)
      ) {
        acc[date] = scan;
      }
      return acc;
    },
    {} as Record<string, ScanRecord>,
  );

  const startDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthName = new Date(currentYear, currentMonth).toLocaleString(
    "default",
    { month: "long" },
  );
  const todayStr = now.toISOString().split("T")[0];

  // Build calendar as explicit week rows — avoids flexWrap alignment bugs
  const calendarWeeks: (number | null)[][] = [];
  let cWeek: (number | null)[] = Array(startDay).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cWeek.push(day);
    if (cWeek.length === 7) { calendarWeeks.push(cWeek); cWeek = []; }
  }
  if (cWeek.length > 0) {
    while (cWeek.length < 7) cWeek.push(null);
    calendarWeeks.push(cWeek);
  }

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else setCurrentMonth((m) => m - 1);
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else setCurrentMonth((m) => m + 1);
  }

  // 根据筛选条件过滤扫描记录
  const filteredScans = [...scans]
    .filter((s) => {
      if (activeFilter === "Face")
        return !["back", "chest"].includes(s.body_zone);
      if (activeFilter === "Body")
        return ["back", "chest"].includes(s.body_zone);
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime(),
    )
    .slice(0, 15);

  // Card has marginHorizontal:20 + padding:16 on each side → inner width = width - 72
  const calInnerW = width - Spacing.xl * 2 - Spacing.lg * 2;
  const cellW = calInnerW / 7;
  const cellSize = Math.floor(cellW); // cell height = cell width → square cells

  if (loading) {
    return (
      <SensitiveGate>
        <LinearGradient
          colors={["#FFF3F6", "#FFF9FB", "#FFFFFF"]}
          style={st.loadingContainer}
        >
          <ActivityIndicator size="large" color={Colors.rose400} />
        </LinearGradient>
      </SensitiveGate>
    );
  }

  return (
    <SensitiveGate>
    <LinearGradient colors={["#FFF3F6", "#FFF9FB", "#FFFFFF"]} style={st.container}>
      <SafeAreaView style={st.safeArea} edges={["top"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={st.scroll}
        >
          {/* ── 标题行 ── */}
          <View style={st.titleRow}>
            <Text style={st.pageTitle}>History</Text>
            {/* 筛选胶囊 */}
            <View style={st.filterPill}>
              {["Face", "Body", "All"].map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setActiveFilter(f)}
                  activeOpacity={0.8}
                >
                  {activeFilter === f ? (
                    <LinearGradient
                      colors={Gradients.roseMain}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={st.filterOn}
                    >
                      <Text style={st.filterOnText}>{f}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={st.filterOff}>
                      <Text style={st.filterOffText}>{f}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── 月度成就 Hero ── */}
          <MonthHero
            scans={scans}
            stats={stats}
            currentYear={currentYear}
            currentMonth={currentMonth}
            isVIP={isVIP}
          />

          {/* ── 日历卡片 ── */}
          <View style={[st.card, Shadow.card]}>
            {/* 月份导航 */}
            <View style={st.monthNav}>
              <TouchableOpacity onPress={prevMonth} style={st.navBtn}>
                <ChevronLeft size={18} color={Colors.gray400} />
              </TouchableOpacity>
              <Text style={st.monthText}>
                {monthName} {currentYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={st.navBtn}>
                <ChevronRight size={18} color={Colors.gray400} />
              </TouchableOpacity>
            </View>

            {/* 星期标题行 */}
            <View style={st.weekRow}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                <Text key={i} style={[st.weekDay, { width: cellW }]}>{d}</Text>
              ))}
            </View>

            {/* 日历格子 — 逐行渲染，避免 flexWrap 错位 */}
            <View style={st.calendarGrid}>
              {calendarWeeks.map((week, wi) => (
                <View key={wi} style={st.weekRow2}>
                  {week.map((day, di) => {
                    if (day === null) {
                      return <View key={`e-${di}`} style={{ width: cellW, height: cellSize }} />;
                    }
                    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const scan = scanMap[dateStr];
                    const isToday = dateStr === todayStr;
                    const score = scan?.skin_score;
                    const isFuture = dateStr > todayStr;

                    const scoreColor =
                      !isVIP ? Colors.rose300
                      : score == null ? null
                      : score >= 90 ? Colors.emerald
                      : score >= 70 ? "#F59E0B"
                      : Colors.rose400;

                    return (
                      <TouchableOpacity
                        key={day}
                        style={[st.dayCell, { width: cellW, height: cellSize }]}
                        onPress={() => scan && router.push(`/scan/${scan._id}` as any)}
                        activeOpacity={scan ? 0.65 : 1}
                        disabled={!scan}
                      >
                        {/* Scanned day: filled tinted background */}
                        {scan && !isToday && (
                          <View style={[st.scanBg, { backgroundColor: (scoreColor ?? "#aaa") + "22" }]} />
                        )}

                        {/* Day number circle */}
                        <View style={[
                          st.dayNumWrapper,
                          isToday && st.todayWrapper,
                        ]}>
                          <Text style={[
                            st.dayNum,
                            isToday && st.todayNum,
                            isFuture && st.futureNum,
                            scan && !isToday && { color: scoreColor ?? Colors.gray600, fontWeight: "700" },
                          ]}>
                            {day}
                          </Text>
                        </View>

                        {/* Score indicator below date — only for VIP */}
                        {scan && isVIP && score != null && (
                          <Text style={[st.dayScore, { color: scoreColor ?? Colors.gray400 }]}>
                            {score}
                          </Text>
                        )}
                        {scan && isVIP && score == null && (
                          <View style={[st.statusDot, { backgroundColor: StatusColors[scan.skin_status] }]} />
                        )}
                        {scan && !isVIP && (
                          <View style={[st.statusDot, { backgroundColor: Colors.rose300 }]} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* 图例：保留原来的颜色说明，但精简 */}
            <View style={st.legend}>
              <View style={st.legendItem}>
                <View
                  style={[st.legendDot, { backgroundColor: Colors.emerald }]}
                />
                <Text style={st.legendText}>90+</Text>
              </View>
              <View style={st.legendItem}>
                <View style={[st.legendDot, { backgroundColor: "#f59e0b" }]} />
                <Text style={st.legendText}>70–89</Text>
              </View>
              <View style={st.legendItem}>
                <View
                  style={[st.legendDot, { backgroundColor: Colors.rose400 }]}
                />
                <Text style={st.legendText}>{"<70"}</Text>
              </View>
              <Text style={st.legendHint}>Tap a day to view scan</Text>
            </View>
          </View>

          {/* ── 皮肤分数折线图 (VIP only) ── */}
          {isVIP ? (
            <View style={[st.card, Shadow.card]}>
              <SkinScoreLineChart scans={scans} />
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/vip")}
              style={[st.card, Shadow.card, st.paywallChart]}
            >
              <View style={st.paywallChartIcon}>
                <Sparkles size={22} color={Colors.rose400} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.paywallChartTitle}>Unlock your skin trend</Text>
                <Text style={st.paywallChartSub}>
                  Get AI scoring and a weekly progress chart with VIP.
                </Text>
              </View>
              <LinearGradient
                colors={Gradients.roseMain}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={st.paywallChartCTA}
              >
                <Text style={st.paywallChartCTAText}>Upgrade</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* ── 最近扫描记录 ── */}
          <Text style={st.sectionTitle}>Recent Scans</Text>

          {filteredScans.length === 0 ? (
            <View style={st.emptyState}>
              <View style={st.emptyIconWrapper}>
                <Camera size={28} color={Colors.rose200} />
              </View>
              <Text style={st.emptyText}>No scans yet</Text>
              <Text style={st.emptySub}>
                Take your first scan to start tracking!
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/camera")}
                activeOpacity={0.85}
              >
                <LinearGradient colors={Gradients.roseMain} style={st.emptyBtn}>
                  <Text style={st.emptyBtnText}>Take a scan now</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={st.recentList}>
              {filteredScans.map((scan, i) => (
                <SwipeableScanCard
                  key={scan._id ?? `scan-${i}`}
                  scan={scan}
                  onDelete={handleDelete}
                  isVIP={isVIP}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
    </SensitiveGate>
  );
}

// ─── 样式 ──────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: Spacing.xxl, paddingTop: Spacing.sm },

  // 标题行
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  pageTitle: { fontSize: 28, fontWeight: "800", color: "#1F2937", letterSpacing: -0.5 },
  filterPill: {
    flexDirection: "row",
    backgroundColor: "#fff0f6",
    borderRadius: Radius.full,
    padding: 3,
  },
  filterOn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  filterOnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  filterOff: { paddingHorizontal: 12, paddingVertical: 5 },
  filterOffText: { color: Colors.gray500, fontSize: 12 },

  // Hero 卡片
  hero: {
    marginHorizontal: Spacing.xl,
    borderRadius: 24,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    shadowColor: "#F472B6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
  heroLeft: { alignItems: "center", gap: 6 },
  heroRingWrapper: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  heroRingBg: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 6,
    borderColor: "rgba(255,255,255,0.25)",
  },
  heroRingCenter: { alignItems: "center" },
  heroRingNum: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 26,
  },
  heroRingLabel: { fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 1 },
  heroRingDesc: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "600",
  },
  heroRight: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  heroStat: { alignItems: "center", gap: 3 },
  heroStatVal: { fontSize: 22, fontWeight: "800", color: "#fff" },
  heroStatLabel: {
    fontSize: 9,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.25)",
  },

  // 卡片通用
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.lg,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    shadowColor: "#F0ABCA",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },

  // 日历
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  navBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: Colors.gray50,
  },
  monthText: {
    fontSize: FontSize.base,
    fontWeight: "700",
    color: Colors.gray800,
  },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekDay: {
    textAlign: "center",
    fontSize: 10,
    color: Colors.gray400,
    fontWeight: "600",
    paddingVertical: 4,
  },

  calendarGrid: { gap: 2 },
  weekRow2: { flexDirection: "row" },
  dayCell: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    gap: 1,
  },
  scanBg: {
    position: "absolute",
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: 10,
  },
  dayNumWrapper: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  todayWrapper: {
    backgroundColor: Colors.rose400,
    shadowColor: Colors.rose400,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  dayNum: { fontSize: 12, color: Colors.gray600, fontWeight: "500" },
  todayNum: { color: "#fff", fontWeight: "800" },
  futureNum: { color: Colors.gray300 },
  dayScore: { fontSize: 9, fontWeight: "700", lineHeight: 10 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },

  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: Spacing.md,
    flexWrap: "wrap",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: Colors.gray500, fontWeight: "600" },
  legendHint: { fontSize: 10, color: Colors.gray300, marginLeft: "auto" },

  // 折线图
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  chartLabel: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.gray700,
  },
  trendBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  trendBadgeText: { fontSize: 11, fontWeight: "700" },
  chartSubLabel: {
    fontSize: 10,
    color: Colors.gray300,
    marginTop: 6,
    textAlign: "right",
  },
  emptyChartText: {
    fontSize: FontSize.xs,
    color: Colors.gray300,
    textAlign: "center",
  },

  // 最近扫描
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: "700",
    color: Colors.gray700,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  recentList: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },

  // 空状态 — 更有设计感，加了一个跳转按钮
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff0f6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.base,
    fontWeight: "700",
    color: Colors.gray600,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: FontSize.sm,
    color: Colors.gray400,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Radius.full,
  },
  emptyBtnText: { color: "#fff", fontSize: FontSize.sm, fontWeight: "700" },

  // Paywall chart teaser (free users)
  paywallChart: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  paywallChartIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff0f6",
    alignItems: "center",
    justifyContent: "center",
  },
  paywallChartTitle: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.gray800,
  },
  paywallChartSub: {
    fontSize: FontSize.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  paywallChartCTA: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  paywallChartCTAText: {
    color: "#fff",
    fontSize: FontSize.xs,
    fontWeight: "700",
  },
});
