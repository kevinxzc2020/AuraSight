import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from "react-native-svg";
import { Flame, TrendingUp, TrendingDown, Sparkles } from "lucide-react-native";
import {
  Colors,
  Gradients,
  Spacing,
  Radius,
  FontSize,
  Shadow,
  AcneColors,
} from "../../constants/theme";
import { getStats, StatsResult } from "../../lib/mongodb";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

// ─── 游客 ID ──────────────────────────────────────────────
async function getUserId(): Promise<string> {
  let id = await AsyncStorage.getItem("@aurasight_user_id");
  if (!id) {
    id = "guest_" + Math.random().toString(36).slice(2, 10);
    await AsyncStorage.setItem("@aurasight_user_id", id);
  }
  return id;
}

// ─── 进度环 ───────────────────────────────────────────────
function ProgressRing({ percent }: { percent: number }) {
  const size = 160;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={styles.ringContainer}>
      <Svg
        width={size}
        height={size}
        style={{ transform: [{ rotate: "-90deg" }] }}
      >
        <Defs>
          <SvgGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#f472b6" />
            <Stop offset="100%" stopColor="#fb7185" />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={Colors.rose100}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#progressGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringPercent}>{percent}%</Text>
        <Text style={styles.ringLabel}>Complete</Text>
      </View>
    </View>
  );
}

// ─── 数据卡片 ─────────────────────────────────────────────
function StatCard({
  value,
  label,
  trend,
}: {
  value: string;
  label: string;
  trend: "up" | "down" | "none";
}) {
  return (
    <View style={[styles.statCard, Shadow.card]}>
      <View style={styles.statRow}>
        <Text style={styles.statValue}>{value}</Text>
        {trend === "down" && <TrendingDown size={14} color={Colors.emerald} />}
        {trend === "up" && <TrendingUp size={14} color={Colors.emerald} />}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── 主页面 ───────────────────────────────────────────────
export default function HomeScreen() {
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const id = await getUserId();
      setUserId(id);
      const data = await getStats(id);
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoading(false);
    }
  }

  // 计算进度百分比（30天中扫描了几天）
  const progressPercent = stats
    ? Math.round((stats.total_scans / 30) * 100)
    : 0;

  const acneTypes = [
    {
      label: "Pustule",
      count: stats?.acne_breakdown.pustule ?? 0,
      color: AcneColors.pustule,
      bg: "#fff0f6",
    },
    {
      label: "Broken",
      count: stats?.acne_breakdown.broken ?? 0,
      color: AcneColors.broken,
      bg: "#fffbeb",
    },
    {
      label: "Scab",
      count: stats?.acne_breakdown.scab ?? 0,
      color: AcneColors.scab,
      bg: "#ecfdf5",
    },
    {
      label: "Redness",
      count: stats?.acne_breakdown.redness ?? 0,
      color: AcneColors.redness,
      bg: "#fff1f2",
    },
  ];

  if (loading) {
    return (
      <LinearGradient
        colors={["#fff5f5", "#ffffff"]}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={Colors.rose400} />
        <Text style={styles.loadingText}>Loading...</Text>
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
            <View>
              <Text style={styles.greeting}>Good morning</Text>
              <Text style={styles.userName}>AuraSight</Text>
            </View>
            <LinearGradient
              colors={["#ffe4e6", "#fce7f3"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.streakBadge}
            >
              <Flame size={14} color={Colors.rose400} />
              <Text style={styles.streakText}>Day {stats?.streak ?? 0}</Text>
            </LinearGradient>
          </View>

          {/* Progress Ring */}
          <View style={styles.ringWrapper}>
            <ProgressRing percent={progressPercent} />
          </View>

          {/* Scan Today Card */}
          <View style={[styles.card, Shadow.card]}>
            <View style={styles.scanThumbnails}>
              <LinearGradient
                colors={["#ffe4e6", "#fce7f3"]}
                style={styles.thumbnail}
              >
                <Text style={styles.thumbnailEmoji}>👤</Text>
                <View style={styles.thumbnailBadge}>
                  <Text style={styles.thumbnailBadgeText}>Face</Text>
                </View>
              </LinearGradient>
              <LinearGradient
                colors={["#fce7f3", "#ffe4e6"]}
                style={styles.thumbnail}
              >
                <Text style={styles.thumbnailEmoji}>🧍</Text>
                <View style={styles.thumbnailBadge}>
                  <Text style={styles.thumbnailBadgeText}>Body</Text>
                </View>
              </LinearGradient>
            </View>
            <TouchableOpacity activeOpacity={0.85}>
              <LinearGradient
                colors={Gradients.roseMain}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.scanButton, Shadow.button]}
              >
                <Text style={styles.scanButtonText}>Scan Today</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Quick Stats */}
          <View style={styles.statsRow}>
            <StatCard
              value={String(stats?.latest_count ?? 0)}
              label="Total Spots"
              trend="down"
            />
            <StatCard
              value={
                stats?.week_change !== undefined
                  ? stats.week_change > 0
                    ? `+${stats.week_change}`
                    : String(stats.week_change)
                  : "0"
              }
              label="This Week"
              trend={
                stats?.week_change && stats.week_change < 0 ? "down" : "up"
              }
            />
            <StatCard
              value={String(stats?.latest_score ?? 100)}
              label="Skin Score"
              trend="up"
            />
          </View>

          {/* Acne Type Pills */}
          <View style={styles.acneGrid}>
            {acneTypes.map((item) => (
              <View
                key={item.label}
                style={[styles.acnePill, { backgroundColor: item.bg }]}
              >
                <LinearGradient
                  colors={[item.color, item.color + "cc"]}
                  style={styles.acneCount}
                >
                  <Text style={styles.acneCountText}>{item.count}</Text>
                </LinearGradient>
                <Text style={styles.acneLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* AI Insight */}
          <LinearGradient
            colors={["#fff0f6", "#fff5f5"]}
            style={[
              styles.insightCard,
              { borderColor: Colors.rose100, borderWidth: 1 },
            ]}
          >
            <View style={styles.insightHeader}>
              <LinearGradient
                colors={Gradients.roseMain}
                style={styles.insightIcon}
              >
                <Sparkles size={14} color="#fff" />
              </LinearGradient>
              <Text style={styles.insightTitle}>Beauty Insight</Text>
            </View>
            <Text style={styles.insightText}>
              {stats?.total_scans === 0
                ? "Start your first scan to get personalized insights!"
                : stats?.latest_count === 0
                  ? "Great job! Your skin looks clear today. Keep it up!"
                  : `${stats?.latest_count} spots detected. Tap Scan Today to track your progress.`}
            </Text>
          </LinearGradient>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── 样式 ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { color: Colors.gray400, fontSize: FontSize.sm },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  greeting: { fontSize: FontSize.sm, color: Colors.rose400 },
  userName: { fontSize: FontSize.xl, color: Colors.gray800, fontWeight: "600" },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  streakText: {
    fontSize: FontSize.sm,
    color: Colors.rose600,
    fontWeight: "600",
  },

  ringWrapper: { alignItems: "center", marginBottom: Spacing.xl },
  ringContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: { position: "absolute", alignItems: "center" },
  ringPercent: {
    fontSize: FontSize.xxxl,
    fontWeight: "700",
    color: Colors.gray800,
  },
  ringLabel: { fontSize: FontSize.xs, color: Colors.gray500 },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  scanThumbnails: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: Radius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailEmoji: { fontSize: 32 },
  thumbnailBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  thumbnailBadgeText: { fontSize: 9, color: Colors.rose600, fontWeight: "500" },
  scanButton: {
    borderRadius: Radius.xl,
    paddingVertical: 14,
    alignItems: "center",
  },
  scanButtonText: {
    color: Colors.white,
    fontSize: FontSize.base,
    fontWeight: "700",
  },

  statsRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.md,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.gray800,
  },
  statLabel: { fontSize: 10, color: Colors.gray500 },

  acneGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  acnePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    width: (width - Spacing.xl * 2 - Spacing.md) / 2,
  },
  acneCount: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  acneCountText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: "700",
  },
  acneLabel: {
    fontSize: FontSize.sm,
    color: Colors.gray700,
    fontWeight: "500",
  },

  insightCard: { borderRadius: Radius.xl, padding: Spacing.lg },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  insightIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  insightTitle: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.rose600,
  },
  insightText: { fontSize: FontSize.sm, color: Colors.gray600, lineHeight: 20 },
});
