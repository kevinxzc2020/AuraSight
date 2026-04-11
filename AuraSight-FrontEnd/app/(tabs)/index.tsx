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
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import {
  Flame,
  User,
  CheckCircle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Lock,
} from "lucide-react-native";
import {
  Colors,
  Gradients,
  Spacing,
  Radius,
  FontSize,
  Shadow,
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
  if (hour < 12) return "Good morning ✨";
  if (hour < 18) return "Good afternoon ✨";
  return "Good evening ✨";
}

// ─── Milestones ───────────────────────────────────────────────
const MILESTONES = [
  { points: 100, label: "Trend Chart" },
  { points: 300, label: "Cause Report" },
  { points: 500, label: "PDF Export" },
  { points: 1000, label: "VIP Trial" },
];

// ─── Skin Score Hero Card ─────────────────────────────────────
// Combines score, today's pts, and milestone — one visual anchor
function SkinScoreHero({
  score,
  todayPts,
  totalPts,
  scoreChange,
}: {
  score: number;
  todayPts: number;
  totalPts: number;
  scoreChange: number | null;
}) {
  const next = MILESTONES.find((m) => totalPts < m.points);
  const prev = next ? MILESTONES[MILESTONES.indexOf(next) - 1] : null;
  const fromPts = prev?.points ?? 0;
  const progress = next
    ? Math.min((totalPts - fromPts) / (next.points - fromPts), 1)
    : 1;

  let condition = "Excellent condition";
  if (score < 70) condition = "Needs some care";
  else if (score < 85) condition = "Looking good";

  const changeText =
    scoreChange === null
      ? "Start scanning to track trends"
      : scoreChange > 0
        ? `↑ +${scoreChange} from last week`
        : scoreChange < 0
          ? `↓ ${scoreChange} from last week`
          : "No change from last week";

  return (
    <View style={styles.heroWrapper}>
      <LinearGradient
        colors={["#F43F8F", "#F472B6", "#FB9FBD"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.heroCard}
      >
        {/* Decorative glows */}
        <View style={styles.heroGlow1} />
        <View style={styles.heroGlow2} />

        <View style={styles.heroBody}>
          {/* Left: Score */}
          <View style={styles.heroLeft}>
            <View style={styles.heroLabelPill}>
              <Text style={styles.heroLabelText}>YOUR SKIN SCORE</Text>
            </View>
            <Text style={styles.heroScore}>{score}</Text>
            <View style={styles.heroConditionRow}>
              <View style={styles.heroConditionDot} />
              <Text style={styles.heroConditionText}>{condition}</Text>
            </View>
            <Text style={styles.heroChangeText}>{changeText}</Text>
          </View>

          {/* Right: Today's pts bubble */}
          <View style={styles.ptsBubble}>
            <View style={styles.ptsBubbleInner} />
            <Text style={styles.ptsBubbleVal}>{todayPts}</Text>
            <Text style={styles.ptsBubblePts}>pts</Text>
            <Text style={styles.ptsBubbleDay}>today</Text>
          </View>
        </View>

        {/* Milestone strip */}
        {next && (
          <View style={styles.milestoneStrip}>
            <Text style={styles.milestoneText}>
              ⭐&nbsp; Next: {next.label} &nbsp;·&nbsp; {totalPts} / {next.points} pts
            </Text>
            <View style={styles.milestoneTrack}>
              <View style={[styles.milestoneFill, { width: `${progress * 100}%` as any }]} />
            </View>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

// ─── Weekly Insight Card ──────────────────────────────────────
interface InsightData {
  scans_this_week: number;
  avg_score_this_week: number | null;
  avg_score_last_week: number | null;
  score_change: number | null;
  insight_text: string;
}

function WeeklyInsightCard({ insight }: { insight: InsightData | null }) {
  if (!insight) return null;
  const hasImproved = (insight.score_change ?? 0) > 0;
  const hasDeclined = (insight.score_change ?? 0) < 0;

  return (
    <View style={styles.insightCard}>
      <View style={styles.insightTop}>
        <LinearGradient
          colors={["#FCE7F3", "#FFE4F0"]}
          style={styles.insightIconBg}
        >
          <Sparkles size={18} color="#F472B6" />
        </LinearGradient>
        <View style={styles.insightTitleWrap}>
          <Text style={styles.insightTitle}>Weekly Insight</Text>
          <View style={styles.freePill}>
            <Text style={styles.freePillText}>✓ Free</Text>
          </View>
        </View>
        {insight.scans_this_week > 0 && (
          <View style={styles.scansBadge}>
            <Text style={styles.scansBadgeText}>{insight.scans_this_week}/7</Text>
          </View>
        )}
      </View>

      <Text style={styles.insightBody}>{insight.insight_text}</Text>

      {insight.avg_score_this_week !== null && (
        <View style={styles.insightStats}>
          <View style={styles.insightStat}>
            <Text style={styles.insightStatVal}>{insight.avg_score_this_week}</Text>
            <Text style={styles.insightStatLbl}>Avg score</Text>
          </View>
          {insight.score_change !== null && (
            <View style={styles.insightStat}>
              <View style={styles.insightChangeRow}>
                {hasImproved ? (
                  <TrendingUp size={12} color="#10B981" />
                ) : hasDeclined ? (
                  <TrendingDown size={12} color="#FB7185" />
                ) : null}
                <Text
                  style={[
                    styles.insightStatVal,
                    hasImproved ? { color: "#10B981" } : hasDeclined ? { color: "#FB7185" } : {},
                  ]}
                >
                  {insight.score_change > 0 ? "+" : ""}
                  {insight.score_change}
                </Text>
              </View>
              <Text style={styles.insightStatLbl}>vs last week</Text>
            </View>
          )}
          <View style={styles.insightStat}>
            <Text style={styles.insightStatVal}>{insight.scans_this_week}</Text>
            <Text style={styles.insightStatLbl}>Scans</Text>
          </View>
        </View>
      )}

      <TouchableOpacity onPress={() => router.push("/vip")} style={styles.insightCta}>
        <Text style={styles.insightCtaText}>Unlock full report → VIP ✦</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────
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
  const [insight, setInsight] = useState<InsightData | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    try {
      const id = await getUserId();
      const name = await AsyncStorage.getItem("@aurasight_user_name");
      const mode = await AsyncStorage.getItem("@aurasight_user_mode");
      setUserName(name ?? "");
      setIsGuest(mode !== "registered");

      const [statsData, ptsRes, scansRes, insightRes] = await Promise.all([
        getStats(id),
        fetch(`${API_URL}/points/${id}`).then((r) => r.json()),
        fetch(`${API_URL}/scans/${id}?days=2`).then((r) => r.json()),
        fetch(`${API_URL}/insights/${id}/weekly`)
          .then((r) => r.json())
          .catch(() => null),
      ]);

      setStats(statsData);
      setTotalPts(ptsRes.total_points ?? 0);
      setTodayPts(ptsRes.today_pts ?? 0);
      setStreak(ptsRes.streak ?? 0);
      setInsight(insightRes);
      setFaceDone(ptsRes.tasks_today?.face ?? false);
      setBodyDone(ptsRes.tasks_today?.body ?? false);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split("T")[0];
      const yScans = (scansRes as any[]).filter(
        (s) => new Date(s.scan_date).toISOString().split("T")[0] === yStr
      );
      setYesterdayFace(
        yScans.find((s) => !["back", "chest"].includes(s.body_zone))?.image_uri ?? null
      );
      setYesterdayBody(
        yScans.find((s) => ["back", "chest"].includes(s.body_zone))?.image_uri ?? null
      );
    } catch (err) {
      console.error("Failed to load:", err);
    }
  }

  const skinScore = stats?.latest_score ?? 100;
  const scoreChange = null; // TODO: wire up week-over-week delta from report endpoint

  return (
    <LinearGradient colors={["#FFF3F6", "#FFF9FB", "#FFFFFF"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Header ── */}
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
                  <User size={13} color={Colors.rose400} />
                  <Text style={styles.signInText}>Sign In</Text>
                </TouchableOpacity>
              )}
              <LinearGradient
                colors={["#FFE4E6", "#FCE7F3"]}
                style={styles.streakBadge}
              >
                <Flame size={13} color="#C0394B" />
                <Text style={styles.streakText}>{streak}d streak</Text>
              </LinearGradient>
            </View>
          </View>

          {/* ── Skin Score Hero ── */}
          <SkinScoreHero
            score={skinScore}
            todayPts={todayPts}
            totalPts={totalPts}
            scoreChange={scoreChange}
          />

          {/* ── Daily Check-in ── */}
          <View style={[styles.card, styles.checkinCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Daily Check-in</Text>
              <Text style={styles.cardHeaderPts}>{todayPts}/100 pts today</Text>
            </View>

            {/* Face Task */}
            <View style={styles.taskRow}>
              {yesterdayFace ? (
                <Image source={{ uri: yesterdayFace }} style={styles.taskThumb} />
              ) : (
                <LinearGradient colors={["#FFE4E6", "#FCE7F3"]} style={styles.taskThumb}>
                  <Text style={styles.taskThumbEmoji}>📸</Text>
                </LinearGradient>
              )}
              <View style={styles.taskInfo}>
                <Text style={[styles.taskName, faceDone && styles.taskNameDone]}>
                  {faceDone ? "Face checked in ✓" : "How's your skin today?"}
                </Text>
                <Text style={styles.taskSub}>+50 pts · 30-second face scan</Text>
              </View>
              {faceDone ? (
                <CheckCircle size={22} color="#10B981" />
              ) : (
                <TouchableOpacity onPress={() => router.push("/(tabs)/camera")}>
                  <LinearGradient colors={["#F43F8F", "#FB7185"]} style={styles.scanBtn}>
                    <Text style={styles.scanBtnText}>Scan</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.taskDivider} />

            {/* Body Task */}
            <View style={[styles.taskRow, { paddingBottom: 0 }]}>
              {yesterdayBody ? (
                <Image source={{ uri: yesterdayBody }} style={styles.taskThumb} />
              ) : (
                <LinearGradient colors={["#FCE7F3", "#FFDDE8"]} style={styles.taskThumb}>
                  <Text style={styles.taskThumbEmoji}>🧍</Text>
                </LinearGradient>
              )}
              <View style={styles.taskInfo}>
                <Text style={[styles.taskName, bodyDone && styles.taskNameDone]}>
                  {bodyDone ? "Body checked in ✓" : "Quick body check-in"}
                </Text>
                <Text style={styles.taskSub}>+50 pts · tracks shape & progress</Text>
              </View>
              {bodyDone ? (
                <CheckCircle size={22} color="#10B981" />
              ) : (
                <TouchableOpacity onPress={() => router.push("/(tabs)/camera")}>
                  <LinearGradient colors={["#F43F8F", "#FB7185"]} style={styles.scanBtn}>
                    <Text style={styles.scanBtnText}>Scan</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── Stats Row ── */}
          <View style={styles.statsRow}>
            {/* Spots */}
            <View style={[styles.statCard, styles.statSpots]}>
              <View style={[styles.statDot, { backgroundColor: "#FB7185" }]} />
              <Text style={[styles.statVal, { color: "#FB7185" }]}>
                {stats?.latest_count ?? 0}
              </Text>
              <Text style={styles.statLbl}>Spots</Text>
            </View>
            {/* Skin Score */}
            <View style={[styles.statCard, styles.statScore]}>
              <View style={[styles.statDot, { backgroundColor: "#F472B6" }]} />
              <Text style={[styles.statVal, { color: "#F472B6" }]}>
                {stats?.latest_score ?? 100}
              </Text>
              <Text style={styles.statLbl}>Skin Score</Text>
            </View>
            {/* Total Scans */}
            <View style={[styles.statCard, styles.statScans]}>
              <View style={[styles.statDot, { backgroundColor: "#10B981" }]} />
              <Text style={[styles.statVal, { color: "#10B981" }]}>
                {stats?.total_scans ?? 0}
              </Text>
              <Text style={styles.statLbl}>Total Scans</Text>
            </View>
          </View>

          {/* ── Weekly Insight ── */}
          <WeeklyInsightCard insight={insight} />

          {/* ── AI Analysis placeholder ── */}
          <LinearGradient
            colors={["#FFF0F6", "#FAFAFA"]}
            style={styles.aiCard}
          >
            <Text style={styles.aiEmoji}>🤖</Text>
            <View style={styles.aiInfo}>
              <Text style={styles.aiTitle}>AI Skin Analysis</Text>
              <Text style={styles.aiSub}>
                {Math.max(0, 7 - (stats?.total_scans ?? 0))} more scans to unlock
              </Text>
            </View>
            <View style={styles.lockBadge}>
              <Lock size={14} color="#9CA3AF" />
            </View>
          </LinearGradient>

          {/* ── Guest banner ── */}
          {isGuest && (
            <TouchableOpacity onPress={() => router.push("/(tabs)/profile")} activeOpacity={0.85}>
              <LinearGradient colors={["#FFF0F6", "#FFE4E6"]} style={styles.guestBanner}>
                <User size={13} color={Colors.rose400} />
                <Text style={styles.guestText}>Sign up to sync your data across devices</Text>
                <Text style={styles.guestArrow}>→</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ────────────────────────────────────────────────────
const sw = (width - 40 - 16) / 3;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },

  // ── Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    marginBottom: 14,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  greeting: { fontSize: 11, fontWeight: "500", color: "#F472B6", marginBottom: 3 },
  userName: { fontSize: 22, fontWeight: "700", color: "#1F2937", letterSpacing: -0.4 },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
  },
  streakText: { fontSize: 10, fontWeight: "600", color: "#C0394B" },
  signInBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF0F6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  signInText: { fontSize: 11, fontWeight: "600", color: Colors.rose400 },

  // ── Hero Card
  heroWrapper: { marginBottom: 14 },
  heroCard: {
    borderRadius: 26,
    overflow: "hidden",
    shadowColor: "#F472B6",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 10,
  },
  heroGlow1: {
    position: "absolute",
    width: 220, height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -70, right: -10,
  },
  heroGlow2: {
    position: "absolute",
    width: 100, height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.06)",
    bottom: 30, right: 60,
  },
  heroBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
  },
  heroLeft: { flex: 1 },
  heroLabelPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 8,
  },
  heroLabelText: { fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.95)", letterSpacing: 0.8 },
  heroScore: { fontSize: 64, fontWeight: "800", color: "#FFFFFF", lineHeight: 68, letterSpacing: -2, marginBottom: 10 },
  heroConditionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  heroConditionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.9)" },
  heroConditionText: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.95)" },
  heroChangeText: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 16 },

  // Today's pts bubble
  ptsBubble: {
    width: 72, height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    flexShrink: 0,
  },
  ptsBubbleInner: {
    position: "absolute",
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  ptsBubbleVal: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", lineHeight: 24 },
  ptsBubblePts: { fontSize: 8, fontWeight: "500", color: "rgba(255,255,255,0.7)" },
  ptsBubbleDay: { fontSize: 7, color: "rgba(255,255,255,0.55)" },

  // Milestone strip
  milestoneStrip: {
    backgroundColor: "rgba(0,0,0,0.16)",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  milestoneText: { fontSize: 9, fontWeight: "500", color: "rgba(255,255,255,0.88)", marginBottom: 6 },
  milestoneTrack: { height: 3, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 2, overflow: "hidden" },
  milestoneFill: { height: "100%", backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 2 },

  // ── Check-in Card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#F0ABCA",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  checkinCard: {},
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#1F2937" },
  cardHeaderPts: { fontSize: 10, color: "#B0B8C4" },

  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
  },
  taskThumb: {
    width: 42, height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  taskThumbEmoji: { fontSize: 18 },
  taskInfo: { flex: 1 },
  taskName: { fontSize: 13, fontWeight: "600", color: "#1F2937", marginBottom: 3 },
  taskNameDone: { textDecorationLine: "line-through", color: "#A0AABF" },
  taskSub: { fontSize: 10, color: "#A0AABF" },
  taskDivider: { height: 1, backgroundColor: "#F5F0F3", marginBottom: 12 },
  scanBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
  },
  scanBtnText: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },

  // ── Stats Row
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  statCard: {
    width: sw,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    position: "relative",
  },
  statSpots: {
    backgroundColor: "#FFF1F4",
    borderWidth: 1,
    borderColor: "rgba(251,113,133,0.15)",
    shadowColor: "#FB7185",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  statScore: {
    backgroundColor: "#FFF0F8",
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.15)",
    shadowColor: "#F472B6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  statScans: {
    backgroundColor: "#F0FDF8",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.15)",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  statDot: {
    position: "absolute",
    top: 12, right: 12,
    width: 7, height: 7,
    borderRadius: 3.5,
  },
  statVal: { fontSize: 26, fontWeight: "800", lineHeight: 30, marginBottom: 6 },
  statLbl: { fontSize: 9, fontWeight: "500", color: "#8C95A8" },

  // ── Weekly Insight
  insightCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#F9E0EE",
    shadowColor: "#F0ABCA",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation: 3,
  },
  insightTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  insightIconBg: {
    width: 40, height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  insightTitleWrap: { flex: 1 },
  insightTitle: { fontSize: 13, fontWeight: "600", color: "#1F2937", marginBottom: 4 },
  freePill: {
    alignSelf: "flex-start",
    backgroundColor: "#ECFDF5",
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  freePillText: { fontSize: 9, fontWeight: "600", color: "#059669" },
  scansBadge: {
    backgroundColor: "#FFF0F8",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scansBadgeText: { fontSize: 11, fontWeight: "700", color: "#F472B6" },
  insightBody: { fontSize: 12, color: "#6B7280", lineHeight: 18, marginBottom: 12 },
  insightStats: { flexDirection: "row", gap: 8, marginBottom: 12 },
  insightStat: {
    flex: 1,
    backgroundColor: "#FFF5F8",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
  },
  insightChangeRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  insightStatVal: { fontSize: 15, fontWeight: "800", color: "#1F2937" },
  insightStatLbl: { fontSize: 9, color: "#A0AABF", marginTop: 2 },
  insightCta: { alignItems: "flex-end" },
  insightCtaText: { fontSize: 10, fontWeight: "600", color: "#A855F7" },

  // ── AI Card
  aiCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#F9E0EE",
  },
  aiEmoji: { fontSize: 28 },
  aiInfo: { flex: 1 },
  aiTitle: { fontSize: 13, fontWeight: "600", color: "#1F2937", marginBottom: 4 },
  aiSub: { fontSize: 11, color: "#9CA3AF" },
  lockBadge: {
    width: 30, height: 30,
    borderRadius: 15,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // ── Guest Banner
  guestBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  guestText: { flex: 1, fontSize: 12, color: Colors.rose600 },
  guestArrow: { fontSize: 14, color: Colors.rose400, fontWeight: "700" },
});
