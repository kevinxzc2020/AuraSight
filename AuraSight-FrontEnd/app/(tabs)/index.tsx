import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from "react-native-svg";
import { Flame, User, Trophy, CheckCircle, Star } from "lucide-react-native";
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
import { router, useFocusEffect } from "expo-router";

const { width } = Dimensions.get("window");
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.59:3000";

async function getUserId(): Promise<string> {
  let id = await AsyncStorage.getItem("@aurasight_user_id");
  if (!id) {
    id = "guest_" + Math.random().toString(36).slice(2, 10);
    await AsyncStorage.setItem("@aurasight_user_id", id);
  }
  return id;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// ─── 今日积分进度环 ───────────────────────────────────────
function TaskRing({ todayPts }: { todayPts: number }) {
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
          <SvgGradient id="taskGrad" x1="0%" y1="0%" x2="100%" y2="0%">
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
          stroke="url(#taskGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - todayPts / 100)}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringPts}>{todayPts}</Text>
        <Text style={styles.ringPtsLabel}>/ 100 pts</Text>
        <Text style={styles.ringSubLabel}>Today</Text>
      </View>
    </View>
  );
}

// ─── 下一个里程碑进度条 ───────────────────────────────────
const MILESTONES = [
  { points: 100, label: "Trend Chart" },
  { points: 300, label: "Cause Report" },
  { points: 500, label: "PDF Export" },
  { points: 1000, label: "VIP Trial" },
];

function MilestoneBar({ total }: { total: number }) {
  const next = MILESTONES.find((m) => total < m.points);
  if (!next) return null;

  const prev = MILESTONES[MILESTONES.indexOf(next) - 1];
  const fromPts = prev?.points ?? 0;
  const progress = Math.min((total - fromPts) / (next.points - fromPts), 1);

  return (
    <View style={styles.milestoneBar}>
      <View style={styles.milestoneHeader}>
        <Star size={11} color={Colors.rose400} />
        <Text style={styles.milestoneLabel}>
          Next: <Text style={styles.milestoneName}>{next.label}</Text> at{" "}
          {next.points} pts
        </Text>
      </View>
      <View style={styles.milestoneTrack}>
        <LinearGradient
          colors={Gradients.roseMain}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.milestoneFill, { width: `${progress * 100}%` }]}
        />
      </View>
      <Text style={styles.milestoneProgress}>
        {total} / {next.points}
      </Text>
    </View>
  );
}

// ─── 主页面 ───────────────────────────────────────────────
export default function HomeScreen() {
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [userName, setUserName] = useState("");
  const [isGuest, setIsGuest] = useState(true);
  const [totalPts, setTotalPts] = useState(0);
  const [todayPts, setTodayPts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [faceDone, setFaceDone] = useState(false);
  const [bodyDone, setBodyDone] = useState(false);
  const [yesterdayFace, setYesterdayFace] = useState<string | null>(null);
  const [yesterdayBody, setYesterdayBody] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  async function loadData() {
    try {
      const id = await getUserId();
      const name = await AsyncStorage.getItem("@aurasight_user_name");
      const mode = await AsyncStorage.getItem("@aurasight_user_mode");
      setUserName(name ?? "");
      setIsGuest(mode !== "registered");

      const [statsData, ptsRes, scansRes] = await Promise.all([
        getStats(id),
        fetch(`${API_URL}/points/${id}`).then((r) => r.json()),
        fetch(`${API_URL}/scans/${id}?days=2`).then((r) => r.json()),
      ]);

      setStats(statsData);
      setTotalPts(ptsRes.total_points ?? 0);
      setTodayPts(ptsRes.today_pts ?? 0);
      setStreak(ptsRes.streak ?? 0);

      const faceDoneVal = ptsRes.tasks_today?.face ?? false;
      const bodyDoneVal = ptsRes.tasks_today?.body ?? false;
      setFaceDone(faceDoneVal);
      setBodyDone(bodyDoneVal);
      setAllDone(faceDoneVal && bodyDoneVal);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      const yesterdayScans = (scansRes as any[]).filter(
        (s) =>
          new Date(s.scan_date).toISOString().split("T")[0] === yesterdayStr,
      );
      const yFace = yesterdayScans.find(
        (s) => !["back", "chest"].includes(s.body_zone),
      );
      const yBody = yesterdayScans.find((s) =>
        ["back", "chest"].includes(s.body_zone),
      );
      setYesterdayFace(yFace?.image_uri ?? null);
      setYesterdayBody(yBody?.image_uri ?? null);
    } catch (err) {
      console.error("Failed to load:", err);
    }
  }

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
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName}>
                {userName || (isGuest ? "Guest" : "User")}
              </Text>
            </View>
            <View style={styles.headerRight}>
              {isGuest && (
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/profile")}
                  style={styles.signInBtn}
                >
                  <User size={14} color={Colors.rose400} />
                  <Text style={styles.signInText}>Sign In</Text>
                </TouchableOpacity>
              )}
              <LinearGradient
                colors={["#ffe4e6", "#fce7f3"]}
                style={styles.streakBadge}
              >
                <Flame size={14} color={Colors.rose400} />
                <Text style={styles.streakText}>{streak}d streak</Text>
              </LinearGradient>
            </View>
          </View>

          {/* 积分总览卡 */}
          <View style={[styles.ptsCard, Shadow.card]}>
            <View style={styles.ptsLeft}>
              <Trophy size={22} color={Colors.rose400} />
              <View>
                <Text style={styles.ptsTotal}>{totalPts.toLocaleString()}</Text>
                <Text style={styles.ptsTotalLabel}>Total Points</Text>
              </View>
            </View>
            <MilestoneBar total={totalPts} />
          </View>

          {/* 今日积分进度环 */}
          <View style={styles.ringWrapper}>
            <TaskRing todayPts={todayPts} />
            {allDone && (
              <LinearGradient
                colors={Gradients.roseMain}
                style={styles.allDoneBanner}
              >
                <Text style={styles.allDoneText}>
                  🎉 All tasks done for today!
                </Text>
              </LinearGradient>
            )}
          </View>

          {/* 今日任务 */}
          <View style={[styles.card, Shadow.card]}>
            <View style={styles.taskHeader}>
              <Text style={styles.sectionTitle}>Daily Tasks</Text>
              <Text style={styles.taskHeaderPts}>{todayPts}/100 pts today</Text>
            </View>

            <View style={styles.taskRow}>
              {yesterdayFace ? (
                <Image
                  source={{ uri: yesterdayFace }}
                  style={styles.yesterdayThumb}
                />
              ) : (
                <LinearGradient
                  colors={["#ffe4e6", "#fce7f3"]}
                  style={styles.yesterdayThumb}
                >
                  <Text style={styles.thumbEmoji}>📸</Text>
                </LinearGradient>
              )}
              <View style={styles.taskInfo}>
                <Text
                  style={[styles.taskLabel, faceDone && styles.taskLabelDone]}
                >
                  Scan your face
                </Text>
                <Text style={styles.taskPts}>
                  +50 pts{yesterdayFace ? " · yesterday ✓" : ""}
                </Text>
              </View>
              {faceDone ? (
                <CheckCircle size={24} color={Colors.emerald} />
              ) : (
                <TouchableOpacity onPress={() => router.push("/(tabs)/camera")}>
                  <LinearGradient
                    colors={Gradients.roseMain}
                    style={styles.taskBtn}
                  >
                    <Text style={styles.taskBtnText}>Go</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.taskDivider} />

            <View style={styles.taskRow}>
              {yesterdayBody ? (
                <Image
                  source={{ uri: yesterdayBody }}
                  style={styles.yesterdayThumb}
                />
              ) : (
                <LinearGradient
                  colors={["#fce7f3", "#ffe4e6"]}
                  style={styles.yesterdayThumb}
                >
                  <Text style={styles.thumbEmoji}>🧍</Text>
                </LinearGradient>
              )}
              <View style={styles.taskInfo}>
                <Text
                  style={[styles.taskLabel, bodyDone && styles.taskLabelDone]}
                >
                  Scan your body
                </Text>
                <Text style={styles.taskPts}>
                  +50 pts{yesterdayBody ? " · yesterday ✓" : ""}
                </Text>
              </View>
              {bodyDone ? (
                <CheckCircle size={24} color={Colors.emerald} />
              ) : (
                <TouchableOpacity onPress={() => router.push("/(tabs)/camera")}>
                  <LinearGradient
                    colors={Gradients.roseMain}
                    style={styles.taskBtn}
                  >
                    <Text style={styles.taskBtnText}>Go</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 皮肤数据 */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, Shadow.card]}>
              <Text style={styles.statValue}>{stats?.latest_count ?? 0}</Text>
              <Text style={styles.statLabel}>Spots</Text>
            </View>
            <View style={[styles.statCard, Shadow.card]}>
              <Text style={styles.statValue}>{stats?.latest_score ?? 100}</Text>
              <Text style={styles.statLabel}>Skin Score</Text>
            </View>
            <View style={[styles.statCard, Shadow.card]}>
              <Text style={styles.statValue}>{stats?.total_scans ?? 0}</Text>
              <Text style={styles.statLabel}>Total Scans</Text>
            </View>
          </View>

          {/* 痘痘分析 */}
          {(stats?.acne_breakdown.pustule ?? 0) +
            (stats?.acne_breakdown.broken ?? 0) +
            (stats?.acne_breakdown.scab ?? 0) +
            (stats?.acne_breakdown.redness ?? 0) >
          0 ? (
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
          ) : (
            <LinearGradient
              colors={["#fff0f6", "#fff5f5"]}
              style={[
                styles.aiPlaceholder,
                { borderColor: Colors.rose100, borderWidth: 1 },
              ]}
            >
              <Text style={styles.aiPlaceholderEmoji}>🤖</Text>
              <View style={styles.aiPlaceholderText}>
                <Text style={styles.aiPlaceholderTitle}>AI Skin Analysis</Text>
                <Text style={styles.aiPlaceholderSub}>
                  Complete {Math.max(0, 7 - (stats?.total_scans ?? 0))} more
                  scans to unlock acne detection
                </Text>
              </View>
            </LinearGradient>
          )}

          {isGuest && (
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/profile")}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#fff0f6", "#ffe4e6"]}
                style={styles.guestBanner}
              >
                <User size={14} color={Colors.rose400} />
                <Text style={styles.guestText}>
                  Sign up to sync your data across devices
                </Text>
                <Text style={styles.guestArrow}>→</Text>
              </LinearGradient>
            </TouchableOpacity>
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
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
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
    fontSize: FontSize.xs,
    color: Colors.rose600,
    fontWeight: "600",
  },
  signInBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff0f6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  signInText: {
    fontSize: FontSize.xs,
    color: Colors.rose400,
    fontWeight: "600",
  },
  ptsCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  ptsLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  ptsTotal: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    color: Colors.gray800,
  },
  ptsTotalLabel: { fontSize: FontSize.xs, color: Colors.gray400 },
  milestoneBar: { flex: 1 },
  milestoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  milestoneLabel: { fontSize: 10, color: Colors.gray500 },
  milestoneName: { color: Colors.rose400, fontWeight: "600" },
  milestoneTrack: {
    height: 6,
    backgroundColor: Colors.gray100,
    borderRadius: 3,
    overflow: "hidden",
  },
  milestoneFill: { height: "100%", borderRadius: 3 },
  milestoneProgress: {
    fontSize: 10,
    color: Colors.gray400,
    marginTop: 4,
    textAlign: "right",
  },
  ringWrapper: { alignItems: "center", marginBottom: Spacing.lg },
  ringContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: { position: "absolute", alignItems: "center" },
  ringPts: {
    fontSize: FontSize.xxxl,
    fontWeight: "700",
    color: Colors.gray800,
  },
  ringPtsLabel: { fontSize: FontSize.xs, color: Colors.gray500 },
  ringSubLabel: { fontSize: 10, color: Colors.gray400 },
  allDoneBanner: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  allDoneText: { fontSize: FontSize.sm, color: "#fff", fontWeight: "600" },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: "600",
    color: Colors.gray800,
  },
  taskHeaderPts: { fontSize: FontSize.xs, color: Colors.gray400 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  yesterdayThumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbEmoji: { fontSize: 22 },
  taskInfo: { flex: 1 },
  taskLabel: {
    fontSize: FontSize.base,
    fontWeight: "500",
    color: Colors.gray800,
  },
  taskLabelDone: { textDecorationLine: "line-through", color: Colors.gray400 },
  taskPts: {
    fontSize: FontSize.xs,
    color: Colors.rose400,
    fontWeight: "600",
    marginTop: 2,
  },
  taskBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  taskBtnText: { color: "#fff", fontSize: FontSize.sm, fontWeight: "700" },
  taskDivider: {
    height: 1,
    backgroundColor: Colors.gray100,
    marginVertical: Spacing.xs,
  },
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
  aiPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  aiPlaceholderEmoji: { fontSize: 32 },
  aiPlaceholderText: { flex: 1 },
  aiPlaceholderTitle: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.gray800,
  },
  aiPlaceholderSub: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    marginTop: 3,
    lineHeight: 16,
  },
  guestBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  guestText: { flex: 1, fontSize: FontSize.xs, color: Colors.rose600 },
  guestArrow: {
    fontSize: FontSize.sm,
    color: Colors.rose400,
    fontWeight: "700",
  },
});
