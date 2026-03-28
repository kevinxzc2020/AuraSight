import React, { useState, useEffect, useCallback } from "react";
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
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react-native";
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
import { useFocusEffect } from "expo-router";
import { SwipeableScanCard } from "../../components/SwipeableScanCard";

const { width } = Dimensions.get("window");

async function getUserId(): Promise<string> {
  let id = await AsyncStorage.getItem("@aurasight_user_id");
  if (!id) {
    id = "guest_" + Math.random().toString(36).slice(2, 10);
    await AsyncStorage.setItem("@aurasight_user_id", id);
  }
  return id;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// 获取当月第一天是星期几
function getMonthStartDay(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

// 获取当月天数
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

const sparklineData = [18, 20, 19, 22, 20, 18, 17, 16, 15, 14, 14, 12];
const maxSparkline = Math.max(...sparklineData);
const barHeight = 56;

export default function HistoryScreen() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());

  const filters = ["Face", "Body", "All"];

  // 每次页面聚焦时刷新数据
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
        getRecentScans(userId, 30),
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

  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.59:3000";

  async function handleDelete(id: string) {
    try {
      await fetch(`${API_URL}/scans/${id}`, { method: "DELETE" });
      setScans((prev) => prev.filter((s) => s._id !== id));
    } catch {
      Alert.alert("Error", "Failed to delete scan.");
    }
  }
  const scanMap = scans.reduce(
    (acc, scan) => {
      const date = new Date(scan.scan_date).toISOString().split("T")[0];
      acc[date] = scan;
      return acc;
    },
    {} as Record<string, ScanRecord>,
  );

  // 日历数据
  const startDay = getMonthStartDay(currentYear, currentMonth);
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const monthName = new Date(currentYear, currentMonth).toLocaleString(
    "default",
    { month: "long" },
  );

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

  // 最近记录（按日期排序）
  const recentScans = [...scans]
    .sort(
      (a, b) =>
        new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime(),
    )
    .slice(0, 5);

  if (loading) {
    return (
      <LinearGradient
        colors={["#fff5f5", "#ffffff"]}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={Colors.rose400} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#fff5f5", "#ffffff"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>History</Text>
            <View style={styles.filterPill}>
              {filters.map((f) => (
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
                      style={styles.filterActive}
                    >
                      <Text style={styles.filterActiveText}>{f}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.filterInactive}>
                      <Text style={styles.filterInactiveText}>{f}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Calendar */}
          <View style={[styles.card, Shadow.card]}>
            <View style={styles.monthNav}>
              <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
                <ChevronLeft size={20} color={Colors.gray400} />
              </TouchableOpacity>
              <Text style={styles.monthText}>
                {monthName} {currentYear}
              </Text>
              <TouchableOpacity style={styles.navBtn} onPress={nextMonth}>
                <ChevronRight size={20} color={Colors.gray400} />
              </TouchableOpacity>
            </View>

            {/* 星期标题 */}
            <View style={styles.weekRow}>
              {WEEKDAYS.map((d, i) => (
                <Text key={i} style={styles.weekDay}>
                  {d}
                </Text>
              ))}
            </View>

            {/* 日历格子 */}
            <View style={styles.calendarGrid}>
              {/* 空白占位 */}
              {Array.from({ length: startDay }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.dayCell} />
              ))}

              {/* 日期 */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const scan = scanMap[dateStr];
                const isToday = dateStr === now.toISOString().split("T")[0];

                return (
                  <View key={day} style={styles.dayCell}>
                    <View
                      style={[
                        styles.dayNumWrapper,
                        isToday && styles.todayWrapper,
                      ]}
                    >
                      <Text style={[styles.dayNum, isToday && styles.todayNum]}>
                        {day}
                      </Text>
                    </View>
                    {scan && (
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: StatusColors[scan.skin_status] },
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </View>

            {/* 图例 */}
            <View style={styles.legend}>
              {[
                { label: "Clear", color: StatusColors.clear },
                { label: "Mild", color: StatusColors.mild },
                { label: "Breakout", color: StatusColors.breakout },
              ].map((l) => (
                <View key={l.label} style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: l.color }]}
                  />
                  <Text style={styles.legendText}>{l.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 30天趋势 */}
          <View style={[styles.card, Shadow.card]}>
            <View style={styles.trendHeader}>
              <Text style={styles.sectionLabel}>30-Day Trend</Text>
              <View style={styles.trendBadge}>
                {(stats?.week_change ?? 0) <= 0 ? (
                  <TrendingDown size={14} color={Colors.emerald} />
                ) : (
                  <TrendingUp size={14} color={Colors.red} />
                )}
                <Text
                  style={[
                    styles.trendValue,
                    {
                      color:
                        (stats?.week_change ?? 0) <= 0
                          ? Colors.emerald
                          : Colors.red,
                    },
                  ]}
                >
                  {stats?.total_scans ?? 0} scans
                </Text>
              </View>
            </View>
            <View style={styles.sparkline}>
              {sparklineData.map((v, i) => (
                <LinearGradient
                  key={i}
                  colors={Gradients.roseMain}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={[
                    styles.sparkBar,
                    { height: (v / maxSparkline) * barHeight },
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Recent Scans */}
          <Text style={[styles.sectionLabel, { marginBottom: Spacing.sm }]}>
            Recent Scans
          </Text>

          {recentScans.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📷</Text>
              <Text style={styles.emptyText}>No scans yet</Text>
              <Text style={styles.emptySubtext}>
                Take your first scan to start tracking!
              </Text>
            </View>
          ) : (
            <View style={styles.recentList}>
              {recentScans.map((scan) => (
                <SwipeableScanCard
                  key={scan._id}
                  scan={scan}
                  onDelete={handleDelete}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const cellSize = (width - Spacing.xl * 2 - Spacing.xxl * 2) / 7;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: { fontSize: FontSize.xl, fontWeight: "600", color: Colors.gray800 },
  filterPill: {
    flexDirection: "row",
    backgroundColor: "#fff0f6",
    borderRadius: Radius.full,
    padding: 4,
  },
  filterActive: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  filterActiveText: { color: "#fff", fontSize: FontSize.xs, fontWeight: "500" },
  filterInactive: { paddingHorizontal: 12, paddingVertical: 4 },
  filterInactiveText: { color: Colors.gray500, fontSize: FontSize.xs },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  navBtn: { padding: 4 },
  monthText: {
    fontSize: FontSize.base,
    fontWeight: "600",
    color: Colors.gray800,
  },

  weekRow: { flexDirection: "row", marginBottom: Spacing.sm },
  weekDay: {
    width: cellSize,
    textAlign: "center",
    fontSize: FontSize.xs,
    color: Colors.gray400,
    fontWeight: "500",
  },

  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: cellSize, alignItems: "center", paddingVertical: 4 },
  dayNumWrapper: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  todayWrapper: { backgroundColor: Colors.rose400 },
  dayNum: { fontSize: FontSize.xs, color: Colors.gray700, fontWeight: "500" },
  todayNum: { color: "#fff", fontWeight: "700" },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },

  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: Spacing.md,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: Colors.gray500 },

  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: "500",
    color: Colors.gray600,
  },
  trendBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  trendValue: { fontSize: FontSize.sm, fontWeight: "600" },
  sparkline: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: barHeight,
  },
  sparkBar: {
    flex: 1,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    minHeight: 4,
  },

  recentList: { gap: Spacing.sm },
  recentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.md,
  },
  recentThumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  recentInfo: { flex: 1 },
  recentDate: {
    fontSize: FontSize.sm,
    fontWeight: "500",
    color: Colors.gray800,
  },
  recentCount: { fontSize: FontSize.xs, color: Colors.gray500 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: "500",
    textTransform: "capitalize",
  },

  emptyState: { alignItems: "center", paddingVertical: Spacing.xxxl },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: {
    fontSize: FontSize.base,
    fontWeight: "600",
    color: Colors.gray600,
  },
  emptySubtext: { fontSize: FontSize.sm, color: Colors.gray400, marginTop: 4 },
});
