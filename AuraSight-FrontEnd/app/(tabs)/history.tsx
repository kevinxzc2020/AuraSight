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
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.59:3000";
const BAR_H = 56;
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

async function getUserId(): Promise<string> {
  let id = await AsyncStorage.getItem("@aurasight_user_id");
  if (!id) {
    id = "guest_" + Math.random().toString(36).slice(2, 10);
    await AsyncStorage.setItem("@aurasight_user_id", id);
  }
  return id;
}

function getMonthStartDay(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export default function HistoryScreen() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());

  const filters = ["Face", "Body", "All"];

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

  async function handleDelete(id: string) {
    try {
      await fetch(`${API_URL}/scans/${id}`, { method: "DELETE" });
      setScans((prev) => prev.filter((s) => s._id !== id));
    } catch {
      Alert.alert("Error", "Failed to delete scan.");
    }
  }

  // 日历数据
  const scanMap = scans.reduce(
    (acc, scan) => {
      const date = new Date(scan.scan_date).toISOString().split("T")[0];
      if (!acc[date]) acc[date] = scan;
      return acc;
    },
    {} as Record<string, ScanRecord>,
  );

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

  // 趋势图：最近30天每天扫描次数
  const days30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const key = d.toISOString().split("T")[0];
    return scans.filter(
      (s) => new Date(s.scan_date).toISOString().split("T")[0] === key,
    ).length;
  });
  const maxDay = Math.max(...days30, 1);

  // 最近扫描记录
  const recentScans = [...scans]
    .sort(
      (a, b) =>
        new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime(),
    )
    .slice(0, 10);

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

            <View style={styles.weekRow}>
              {WEEKDAYS.map((d, i) => (
                <Text key={i} style={styles.weekDay}>
                  {d}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {Array.from({ length: startDay }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.dayCell} />
              ))}
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

          {/* 30天趋势图 */}
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

            {scans.length === 0 ? (
              <View style={styles.sparklineEmpty}>
                <Text style={styles.sparklineEmptyText}>
                  Scan daily to see your 30-day trend
                </Text>
              </View>
            ) : (
              <View style={styles.sparkline}>
                {days30.map((v, i) =>
                  v > 0 ? (
                    <LinearGradient
                      key={i}
                      colors={Gradients.roseMain}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={[
                        styles.sparkBar,
                        { height: Math.max((v / maxDay) * BAR_H, 6) },
                      ]}
                    />
                  ) : (
                    <View
                      key={i}
                      style={[
                        styles.sparkBar,
                        { height: 4, backgroundColor: Colors.gray100 },
                      ]}
                    />
                  ),
                )}
              </View>
            )}
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
              {recentScans.map((scan, i) => (
                <SwipeableScanCard
                  key={scan._id ?? `scan-${i}`}
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
    gap: 2,
    height: BAR_H,
  },
  sparkBar: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  sparklineEmpty: {
    height: BAR_H,
    alignItems: "center",
    justifyContent: "center",
  },
  sparklineEmptyText: {
    fontSize: FontSize.xs,
    color: Colors.gray300,
    textAlign: "center",
  },

  recentList: { gap: Spacing.sm },
  emptyState: { alignItems: "center", paddingVertical: Spacing.xxxl },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: {
    fontSize: FontSize.base,
    fontWeight: "600",
    color: Colors.gray600,
  },
  emptySubtext: { fontSize: FontSize.sm, color: Colors.gray400, marginTop: 4 },
});
