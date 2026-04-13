import React, { useCallback, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  Animated,
  Easing,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Flame,
  User,
  CheckCircle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Lock,
  X,
  Star,
  ChevronRight,
} from "lucide-react-native";
import {
  Colors,
  Gradients,
  Spacing,
  Radius,
  FontSize,
  Shadow,
} from "../../constants/theme";
import { getStats, StatsResult, AcneType } from "../../lib/mongodb";
import { getDailyAdvice } from "../../lib/ai";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";

const { width, height } = Dimensions.get("window");
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

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

// ─── Milestones ───────────────────────────────────────────────
const MILESTONES = [
  { points: 100, label: "Trend Chart" },
  { points: 300, label: "Cause Report" },
  { points: 500, label: "PDF Export" },
  { points: 1000, label: "VIP Trial" },
];

// ─── In-app interactive daily tasks ──────────────────────────
// All tasks can be completed and verified INSIDE the app.
// "action" tells the app what to do when the user taps the button.
type TaskAction =
  | { type: "navigate"; to: string }
  | { type: "mood" }
  | { type: "tip" };

interface ExtraTask {
  id: string;
  emoji: string;
  label: string;
  sub: string;
  pts: number;
  btnLabel: string;
  action: TaskAction;
  vip?: boolean;   // VIP-locked task
}

const EXTRA_TASKS: ExtraTask[] = [
  {
    id: "mood",
    emoji: "😊",
    label: "Rate your skin mood",
    sub: "+10 pts · takes 5 seconds",
    pts: 10,
    btnLabel: "Rate",
    action: { type: "mood" },
  },
  {
    id: "tip",
    emoji: "💡",
    label: "Read today's skin tip",
    sub: "+5 pts · new tip every day",
    pts: 5,
    btnLabel: "Read",
    action: { type: "tip" },
  },
  {
    id: "trend",
    emoji: "📊",
    label: "Check your 7-day trend",
    sub: "+10 pts · see how you're progressing",
    pts: 10,
    btnLabel: "View",
    action: { type: "navigate", to: "/(tabs)/history" },
  },
  {
    id: "report",
    emoji: "📋",
    label: "Review last scan report",
    sub: "+10 pts · understand your results",
    pts: 10,
    btnLabel: "Open",
    action: { type: "navigate", to: "/(tabs)/report" },
  },
  {
    id: "ai_report",
    emoji: "🤖",
    label: "Generate AI skin analysis",
    sub: "+20 pts · deep dive into your skin health",
    pts: 20,
    btnLabel: "Unlock",
    action: { type: "navigate", to: "/(tabs)/report" },
    vip: true,
  },
  {
    id: "ai_chat",
    emoji: "💬",
    label: "Chat with your skin advisor",
    sub: "+15 pts · personalized advice just for you",
    pts: 15,
    btnLabel: "Unlock",
    action: { type: "navigate", to: "/chat" },
    vip: true,
  },
];

// ─── Daily skin tips (rotates by day of year) ─────────────────
const SKIN_TIPS = [
  "Cleanse twice daily — morning removes overnight oils, evening removes pollutants and makeup.",
  "SPF 30+ every morning, even on cloudy days. UV rays penetrate clouds and windows.",
  "Touching your face transfers bacteria. Keep hands away between cleansing routines.",
  "Pillowcases collect oil and bacteria. Change them at least once a week.",
  "Lukewarm water is ideal for washing. Hot water strips your skin's natural barrier.",
  "Stress triggers cortisol, which increases oil production and breakouts.",
  "Retinol at night, vitamin C in the morning — they work best at different times.",
  "Hydration shows in your skin. Dehydrated skin overproduces oil to compensate.",
  "Pat dry, don't rub. Rubbing with a towel creates micro-tears in skin.",
  "Always apply skincare to slightly damp skin — it absorbs actives better.",
  "Spot treatments work best applied to a clean face before moisturiser.",
  "Exfoliate 1-2x per week max. Over-exfoliation weakens your skin barrier.",
  "Antioxidants in your diet (berries, green tea) help fight skin-damaging free radicals.",
  "The skin around your eyes is thinnest — use a dedicated eye cream, gently.",
  "Consistency beats intensity. A simple routine done daily beats an elaborate one done rarely.",
];

function getTodayTip(): string {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return SKIN_TIPS[dayOfYear % SKIN_TIPS.length];
}

// ─── Animated Flame ──────────────────────────────────────────
function FlameIcon({ streak }: { streak: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (streak < 3) return;

    const duration = streak >= 30 ? 500 : streak >= 7 ? 800 : 1200;
    const toScale = streak >= 30 ? 1.4 : streak >= 7 ? 1.25 : 1.15;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: toScale, duration, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(opacity, { toValue: 0.75, duration, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [streak]);

  const flameColor = streak >= 30 ? "#FF4500" : streak >= 7 ? "#F97316" : "#C0394B";

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <Flame size={13} color={flameColor} />
    </Animated.View>
  );
}

// ─── Skin Score Hero Card ─────────────────────────────────────
function SkinScoreHero({
  score,
  todayPts,
  totalPts,
  scoreChange,
}: {
  score: number | null;
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

  const hasScore = score !== null;
  let condition = hasScore ? (score >= 85 ? "Excellent condition" : score >= 70 ? "Looking good" : "Needs some care") : "No scan yet";

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
        <View style={styles.heroGlow1} />
        <View style={styles.heroGlow2} />

        <View style={styles.heroBody}>
          {/* Left: Score */}
          <View style={styles.heroLeft}>
            <View style={styles.heroLabelPill}>
              <Text style={styles.heroLabelText}>YOUR SKIN SCORE</Text>
            </View>
            <Text style={styles.heroScore}>
              {hasScore ? score : "--"}
            </Text>
            <View style={styles.heroConditionRow}>
              <View style={[styles.heroConditionDot, !hasScore && { backgroundColor: "rgba(255,255,255,0.5)" }]} />
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

// ─── Spots Detail Modal ───────────────────────────────────────
const ACNE_META: Record<AcneType, { label: string; color: string; desc: string }> = {
  pustule:  { label: "Pustules",   color: "#F43F8F", desc: "Inflamed, pus-filled lesions" },
  broken:   { label: "Wound",      color: "#F97316", desc: "Picked or burst pimple, open wound" },
  redness:  { label: "Redness",    color: "#EF4444", desc: "Inflammatory redness patches" },
  scab:     { label: "Scabs",      color: "#A78BFA", desc: "Healing or dried lesions" },
};

function SpotsModal({
  visible,
  onClose,
  latestCount,
  breakdown,
}: {
  visible: boolean;
  onClose: () => void;
  latestCount: number;
  breakdown: Record<AcneType, number> | null;
}) {
  const total = latestCount;
  const hasBreakdown = breakdown && Object.values(breakdown).some((v) => v > 0);
  const maxVal = hasBreakdown ? Math.max(...Object.values(breakdown!)) : 1;

  const severity = total === 0 ? "Clear" : total <= 3 ? "Mild" : total <= 8 ? "Moderate" : "Severe";
  const severityColor = total === 0 ? "#10B981" : total <= 3 ? "#F59E0B" : total <= 8 ? "#F97316" : "#EF4444";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          {/* Handle */}
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Spot Analysis</Text>
              <Text style={styles.modalSub}>Latest scan results</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <X size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Hero count */}
          <LinearGradient colors={["#FFF1F4", "#FFF8FA"]} style={styles.modalHeroBox}>
            <Text style={styles.modalHeroNum}>{total}</Text>
            <Text style={styles.modalHeroLbl}>Total Spots</Text>
            <View style={[styles.severityPill, { backgroundColor: severityColor + "20" }]}>
              <View style={[styles.severityDot, { backgroundColor: severityColor }]} />
              <Text style={[styles.severityText, { color: severityColor }]}>{severity}</Text>
            </View>
          </LinearGradient>

          {/* Breakdown chart */}
          {hasBreakdown ? (
            <View style={styles.breakdownSection}>
              <Text style={styles.breakdownTitle}>Breakdown by Type</Text>
              {(Object.keys(ACNE_META) as AcneType[]).map((type) => {
                const count = breakdown![type] ?? 0;
                const meta = ACNE_META[type];
                const pct = maxVal > 0 ? count / maxVal : 0;
                return (
                  <View key={type} style={styles.breakdownRow}>
                    <View style={styles.breakdownLeft}>
                      <Text style={styles.breakdownLabel}>{meta.label}</Text>
                      <Text style={styles.breakdownDesc}>{meta.desc}</Text>
                    </View>
                    <View style={styles.breakdownBar}>
                      <View style={[styles.breakdownFill, { width: `${pct * 100}%` as any, backgroundColor: meta.color }]} />
                    </View>
                    <Text style={[styles.breakdownCount, { color: meta.color }]}>{count}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.noDataBox}>
              <Text style={styles.noDataEmoji}>📸</Text>
              <Text style={styles.noDataText}>No spot data yet</Text>
              <Text style={styles.noDataSub}>Do your first face scan to see breakdown</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.modalCta}
            onPress={() => { onClose(); router.push("/(tabs)/report"); }}
          >
            <LinearGradient colors={["#F43F8F", "#F472B6"]} style={styles.modalCtaGrad}>
              <Text style={styles.modalCtaText}>View Full Report</Text>
              <ChevronRight size={14} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Mood Picker Modal ───────────────────────────────────────
const MOODS = [
  { emoji: "😞", label: "Bad",     color: "#EF4444" },
  { emoji: "😐", label: "Meh",     color: "#F97316" },
  { emoji: "🙂", label: "Okay",    color: "#F59E0B" },
  { emoji: "😊", label: "Good",    color: "#10B981" },
  { emoji: "🤩", label: "Amazing", color: "#F472B6" },
];

function MoodModal({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (mood: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { paddingBottom: 36 }]} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>How's your skin today?</Text>
              <Text style={styles.modalSub}>Tap to rate · earns +10 pts</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <X size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.moodRow}>
            {MOODS.map((m) => {
              const active = selected === m.label;
              return (
                <TouchableOpacity
                  key={m.label}
                  onPress={() => setSelected(m.label)}
                  style={[styles.moodBtn, active && { backgroundColor: m.color + "20", borderColor: m.color, borderWidth: 2 }]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text style={[styles.moodLabel, active && { color: m.color, fontWeight: "700" }]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={() => selected && onPick(selected)}
            style={[styles.modalCta, !selected && { opacity: 0.4 }]}
            disabled={!selected}
          >
            <LinearGradient colors={["#F43F8F", "#F472B6"]} style={styles.modalCtaGrad}>
              <Star size={14} color="#fff" />
              <Text style={styles.modalCtaText}>Save & earn 10 pts</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Daily Tip Modal ─────────────────────────────────────────
function TipModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const tip = getTodayTip();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { paddingBottom: 36 }]} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Today's Skin Tip 💡</Text>
              <Text style={styles.modalSub}>Earn +5 pts for reading</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <X size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <LinearGradient colors={["#FFF3F6", "#FFF9FB"]} style={styles.tipBox}>
            <Text style={styles.tipEmoji}>💡</Text>
            <Text style={styles.tipText}>{tip}</Text>
          </LinearGradient>

          <TouchableOpacity onPress={onClose} style={styles.modalCta}>
            <LinearGradient colors={["#F43F8F", "#F472B6"]} style={styles.modalCtaGrad}>
              <CheckCircle size={14} color="#fff" />
              <Text style={styles.modalCtaText}>Got it! +5 pts</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
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
        <LinearGradient colors={["#FCE7F3", "#FFE4F0"]} style={styles.insightIconBg}>
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
                {hasImproved ? <TrendingUp size={12} color="#10B981" /> : hasDeclined ? <TrendingDown size={12} color="#FB7185" /> : null}
                <Text style={[styles.insightStatVal, hasImproved ? { color: "#10B981" } : hasDeclined ? { color: "#FB7185" } : {}]}>
                  {insight.score_change > 0 ? "+" : ""}{insight.score_change}
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
  const [isVip, setIsVip] = useState(false);
  const [totalPts, setTotalPts] = useState(0);
  const [todayPts, setTodayPts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [faceDone, setFaceDone] = useState(false);
  const [bodyDone, setBodyDone] = useState(false);
  const [yesterdayFace, setYesterdayFace] = useState<string | null>(null);
  const [yesterdayBody, setYesterdayBody] = useState<string | null>(null);
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [extraDone, setExtraDone] = useState<Record<string, boolean>>({});
  const [spotsModalVisible, setSpotsModalVisible] = useState(false);
  const [moodModalVisible, setMoodModalVisible] = useState(false);
  const [tipModalVisible, setTipModalVisible] = useState(false);
  const [dailyAdvice, setDailyAdvice] = useState<string>("");

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
      // Fix: VIP and registered both count as signed in
      setIsGuest(mode !== "registered" && mode !== "vip");
      setIsVip(mode === "vip");

      // Load extra task completions for today
      const extraRaw = await AsyncStorage.getItem(`@aurasight_extra_tasks_${todayKey()}`);
      if (extraRaw) setExtraDone(JSON.parse(extraRaw));

      const [statsData, ptsRes, scansRes, insightRes] = await Promise.all([
        getStats(id),
        fetch(`${API_URL}/points/${id}`).then((r) => r.json()),
        fetch(`${API_URL}/scans/${id}?days=2`).then((r) => r.json()),
        fetch(`${API_URL}/insights/${id}/weekly`).then((r) => r.json()).catch(() => null),
      ]);

      setStats(statsData);
      setTotalPts(ptsRes.total_points ?? 0);
      setTodayPts(ptsRes.today_pts ?? 0);
      setStreak(ptsRes.streak ?? 0);
      setInsight(insightRes);

      // Fetch AI daily advice (non-blocking)
      getDailyAdvice(id).then(setDailyAdvice).catch(() => {});
      setFaceDone(ptsRes.tasks_today?.face ?? false);
      setBodyDone(ptsRes.tasks_today?.body ?? false);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split("T")[0];
      const yScans = (scansRes as any[]).filter(
        (s) => new Date(s.scan_date).toISOString().split("T")[0] === yStr
      );
      setYesterdayFace(yScans.find((s) => !["back", "chest"].includes(s.body_zone))?.image_uri ?? null);
      setYesterdayBody(yScans.find((s) => ["back", "chest"].includes(s.body_zone))?.image_uri ?? null);
    } catch (err) {
      console.error("Failed to load:", err);
    }
  }

  async function completeExtraTask(id: string) {
    if (extraDone[id]) return;
    const next = { ...extraDone, [id]: true };
    setExtraDone(next);
    await AsyncStorage.setItem(`@aurasight_extra_tasks_${todayKey()}`, JSON.stringify(next));
  }

  function handleExtraTaskAction(task: ExtraTask) {
    if (task.action.type === "mood") {
      setMoodModalVisible(true);
    } else if (task.action.type === "tip") {
      setTipModalVisible(true);
    } else if (task.action.type === "navigate") {
      completeExtraTask(task.id);
      router.push(task.action.to as any);
    }
  }

  // Fix: no misleading 100 default when there's no scan data
  const skinScore: number | null = stats ? (stats.latest_score ?? null) : null;
  const scoreChange = stats?.week_change ?? null;

  const totalExtraPts = EXTRA_TASKS.filter((t) => extraDone[t.id]).reduce((s, t) => s + t.pts, 0);
  const displayTodayPts = todayPts + totalExtraPts;

  return (
    <LinearGradient colors={["#FFF3F6", "#FFF9FB", "#FFFFFF"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName}>
                {userName || (isGuest ? "Guest" : "User")}
              </Text>
            </View>
            <View style={styles.headerRight}>
              {/* Only show Sign In for actual guests (not registered, not VIP) */}
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
                colors={streak >= 7 ? ["#FFF0E8", "#FFEADD"] : ["#FFE4E6", "#FCE7F3"]}
                style={styles.streakBadge}
              >
                <FlameIcon streak={streak} />
                <Text style={[styles.streakText, streak >= 30 && { color: "#DC2626" }, streak >= 7 && streak < 30 && { color: "#EA580C" }]}>
                  {streak}d streak
                </Text>
              </LinearGradient>
            </View>
          </View>

          {/* ── Skin Score Hero ── */}
          <SkinScoreHero
            score={skinScore}
            todayPts={displayTodayPts}
            totalPts={totalPts}
            scoreChange={scoreChange}
          />

          {/* ── Daily Check-in ── */}
          <View style={[styles.card, styles.checkinCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Daily Check-in</Text>
              <Text style={styles.cardHeaderPts}>{displayTodayPts} pts today</Text>
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
            <View style={styles.taskRow}>
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

            <View style={styles.taskDivider} />

            {/* Extra in-app interactive tasks */}
            {EXTRA_TASKS.map((task, idx) => {
              const done = !!extraDone[task.id];
              const isLast = idx === EXTRA_TASKS.length - 1;
              const locked = !!task.vip && !isVip;

              return (
                <React.Fragment key={task.id}>
                  <View style={[styles.taskRow, isLast && { paddingBottom: 0 }]}>
                    {/* Thumb */}
                    <LinearGradient
                      colors={
                        locked
                          ? ["#F5F3FF", "#EDE9FE"]
                          : done
                            ? ["#ECFDF5", "#D1FAE5"]
                            : ["#FFF5F8", "#FFF0F6"]
                      }
                      style={styles.taskThumb}
                    >
                      <Text style={styles.taskThumbEmoji}>{locked ? "🔒" : task.emoji}</Text>
                    </LinearGradient>

                    {/* Info */}
                    <View style={styles.taskInfo}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[styles.taskName, done && styles.taskNameDone, locked && styles.taskNameLocked]}>
                          {task.label}
                        </Text>
                        {task.vip && (
                          <View style={styles.vipBadge}>
                            <Text style={styles.vipBadgeText}>👑 VIP</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.taskSub}>
                        {locked ? `${task.sub} · VIP exclusive` : task.sub}
                      </Text>
                    </View>

                    {/* Action */}
                    {!locked && done ? (
                      <CheckCircle size={22} color="#10B981" />
                    ) : locked ? (
                      <TouchableOpacity
                        onPress={() => router.push("/vip")}
                        style={styles.unlockBtn}
                      >
                        <Lock size={11} color="#7C3AED" />
                        <Text style={styles.unlockBtnText}>Unlock</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleExtraTaskAction(task)}
                        style={styles.actionBtn}
                      >
                        <Text style={styles.actionBtnText}>{task.btnLabel}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {!isLast && <View style={styles.taskDivider} />}
                </React.Fragment>
              );
            })}
          </View>

          {/* ── Stats Row ── */}
          <View style={styles.statsRow}>
            {/* Spots — opens detail modal */}
            <TouchableOpacity
              style={[styles.statCard, styles.statSpots]}
              onPress={() => setSpotsModalVisible(true)}
              activeOpacity={0.75}
            >
              <View style={[styles.statDot, { backgroundColor: "#FB7185" }]} />
              <Text style={[styles.statVal, { color: "#FB7185" }]}>
                {stats?.latest_count ?? "--"}
              </Text>
              <Text style={styles.statLbl}>Spots</Text>
              <ChevronRight size={10} color="#FB7185" style={{ marginTop: 2 }} />
            </TouchableOpacity>

            {/* Skin Score — goes to report */}
            <TouchableOpacity
              style={[styles.statCard, styles.statScore]}
              onPress={() => router.push("/(tabs)/report")}
              activeOpacity={0.75}
            >
              <View style={[styles.statDot, { backgroundColor: "#F472B6" }]} />
              <Text style={[styles.statVal, { color: "#F472B6" }]}>
                {stats?.latest_score ?? "--"}
              </Text>
              <Text style={styles.statLbl}>Skin Score</Text>
              <ChevronRight size={10} color="#F472B6" style={{ marginTop: 2 }} />
            </TouchableOpacity>

            {/* Total Scans — goes to history */}
            <TouchableOpacity
              style={[styles.statCard, styles.statScans]}
              onPress={() => router.push("/(tabs)/history")}
              activeOpacity={0.75}
            >
              <View style={[styles.statDot, { backgroundColor: "#10B981" }]} />
              <Text style={[styles.statVal, { color: "#10B981" }]}>
                {stats?.total_scans ?? 0}
              </Text>
              <Text style={styles.statLbl}>Total Scans</Text>
              <ChevronRight size={10} color="#10B981" style={{ marginTop: 2 }} />
            </TouchableOpacity>
          </View>

          {/* ── Weekly Insight ── */}
          <WeeklyInsightCard insight={insight} />

          {/* ── AI Daily Advice ── */}
          <TouchableOpacity
            onPress={() => router.push("/chat")}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#FFF0F6", "#FFF5FB"]} style={styles.aiCard}>
              <LinearGradient colors={["#F43F8F", "#F472B6"]} style={styles.aiAvatarGrad}>
                <Sparkles size={16} color="#fff" />
              </LinearGradient>
              <View style={styles.aiInfo}>
                <View style={styles.aiTitleRow}>
                  <Text style={styles.aiTitle}>AI Skin Advisor</Text>
                  <View style={styles.aiLivePill}>
                    <Text style={styles.aiLiveDot}>●</Text>
                    <Text style={styles.aiLiveText}>Live</Text>
                  </View>
                </View>
                <Text style={styles.aiSub} numberOfLines={2}>
                  {dailyAdvice || "Tap to get personalized advice from your AI consultant"}
                </Text>
              </View>
              <ChevronRight size={16} color={Colors.rose400} />
            </LinearGradient>
          </TouchableOpacity>

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

      {/* ── Spots Detail Modal ── */}
      <SpotsModal
        visible={spotsModalVisible}
        onClose={() => setSpotsModalVisible(false)}
        latestCount={stats?.latest_count ?? 0}
        breakdown={stats?.acne_breakdown ?? null}
      />

      {/* ── Mood Picker Modal ── */}
      <MoodModal
        visible={moodModalVisible}
        onClose={() => setMoodModalVisible(false)}
        onPick={async () => {
          setMoodModalVisible(false);
          await completeExtraTask("mood");
        }}
      />

      {/* ── Daily Tip Modal ── */}
      <TipModal
        visible={tipModalVisible}
        onClose={async () => {
          setTipModalVisible(false);
          await completeExtraTask("tip");
        }}
      />
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
    borderWidth: 1,
    borderColor: "#F9E0EE",
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
  taskNameLocked: { color: "#7C3AED" },
  taskSub: { fontSize: 10, color: "#A0AABF" },
  vipBadge: {
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  vipBadgeText: { fontSize: 9, fontWeight: "700", color: "#7C3AED" },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  unlockBtnText: { fontSize: 11, fontWeight: "700", color: "#7C3AED" },
  taskDivider: { height: 1, backgroundColor: "#F5F0F3", marginBottom: 12 },
  scanBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
  },
  scanBtnText: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },
  actionBtn: {
    backgroundColor: "#FFF0F6",
    borderWidth: 1,
    borderColor: "#F9D5E8",
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 12,
  },
  actionBtnText: { fontSize: 11, fontWeight: "700", color: "#F43F8F" },

  // Mood modal
  moodRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  moodBtn: {
    alignItems: "center",
    padding: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "#F9FAFB",
    width: 58,
  },
  moodEmoji: { fontSize: 28, marginBottom: 4 },
  moodLabel: { fontSize: 10, fontWeight: "500", color: "#6B7280" },

  // Tip modal
  tipBox: {
    marginHorizontal: 24,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 24,
    gap: 12,
  },
  tipEmoji: { fontSize: 36 },
  tipText: { fontSize: 14, color: "#374151", lineHeight: 22, textAlign: "center", fontWeight: "500" },

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
  statVal: { fontSize: 26, fontWeight: "800", lineHeight: 30, marginBottom: 4 },
  statLbl: { fontSize: 9, fontWeight: "500", color: "#8C95A8" },

  // ── Spots Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
    maxHeight: height * 0.85,
  },
  modalHandle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937" },
  modalSub: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  modalClose: {
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeroBox: {
    marginHorizontal: 24,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  modalHeroNum: { fontSize: 56, fontWeight: "800", color: "#FB7185", lineHeight: 60 },
  modalHeroLbl: { fontSize: 13, color: "#9CA3AF", marginBottom: 10 },
  severityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  severityDot: { width: 7, height: 7, borderRadius: 3.5 },
  severityText: { fontSize: 12, fontWeight: "700" },
  breakdownSection: { paddingHorizontal: 24, marginBottom: 20 },
  breakdownTitle: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 14 },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  breakdownLeft: { width: 80 },
  breakdownLabel: { fontSize: 11, fontWeight: "600", color: "#374151" },
  breakdownDesc: { fontSize: 9, color: "#9CA3AF" },
  breakdownBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    overflow: "hidden",
  },
  breakdownFill: { height: "100%", borderRadius: 4 },
  breakdownCount: { width: 24, fontSize: 13, fontWeight: "700", textAlign: "right" },
  noDataBox: { alignItems: "center", paddingVertical: 30, paddingHorizontal: 24 },
  noDataEmoji: { fontSize: 40, marginBottom: 10 },
  noDataText: { fontSize: 15, fontWeight: "600", color: "#374151", marginBottom: 4 },
  noDataSub: { fontSize: 12, color: "#9CA3AF", textAlign: "center" },
  modalCta: { marginHorizontal: 24, marginTop: 4 },
  modalCtaGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 16,
    paddingVertical: 14,
  },
  modalCtaText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },

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
    shadowColor: "#F0ABCA",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  aiAvatarGrad: {
    width: 42, height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  aiInfo: { flex: 1 },
  aiTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  aiTitle: { fontSize: 13, fontWeight: "700", color: "#1F2937" },
  aiLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  aiLiveDot: { fontSize: 7, color: "#10B981" },
  aiLiveText: { fontSize: 9, fontWeight: "700", color: "#10B981" },
  aiSub: { fontSize: 11, color: "#6B7280", lineHeight: 16 },

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
