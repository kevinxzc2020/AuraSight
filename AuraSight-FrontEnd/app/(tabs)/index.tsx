import React, { useCallback, useState, useRef, useEffect } from "react";
import { AdBanner } from "../../lib/ads";
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
  ChevronDown,
  ChevronUp,
  Camera as CameraIcon,
} from "lucide-react-native";
import {
  Colors,
  Gradients,
  Spacing,
  Radius,
  FontSize,
  Shadow,
} from "../../constants/theme";
import { useAppTheme } from "../../lib/themeContext";
import { getStats, StatsResult, AcneType, ScanRecord } from "../../lib/mongodb";
import { AnnotatedSkinImage } from "../../components/AnnotatedSkinImage";
import { getDailyAdvice } from "../../lib/ai";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { getUserId } from "../../lib/userId";
import { useT } from "../../lib/i18n";
import { AnimatedPressable, FadeInComponent, StaggeredList } from "../../lib/animations";

const { width, height } = Dimensions.get("window");
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.59:3000";

type TFn = (key: string, vars?: Record<string, string>) => string;

function getGreeting(name: string | undefined, t: TFn): string {
  const hour = new Date().getHours();
  const n = name?.split(" ")[0];
  if (hour < 6) return n ? t("home.greet.nightOwl", { name: n }) : t("home.greet.nightOwlAnon");
  if (hour < 12) return n ? t("home.greet.morning", { name: n }) : t("home.greet.morningAnon");
  if (hour < 18) return n ? t("home.greet.afternoon", { name: n }) : t("home.greet.afternoonAnon");
  if (hour < 22) return n ? t("home.greet.evening", { name: n }) : t("home.greet.eveningAnon");
  return n ? t("home.greet.lateNight", { name: n }) : t("home.greet.lateNightAnon");
}

function getDayMessage(t: TFn): string {
  return t(`home.dayMsg.${new Date().getDay()}`);
}

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

// ─── Milestones ───────────────────────────────────────────────
const MILESTONES = [
  { points: 100, labelKey: "home.milestone.trendChart" },
  { points: 300, labelKey: "home.milestone.causeReport" },
  { points: 500, labelKey: "home.milestone.pdfExport" },
  { points: 1000, labelKey: "home.milestone.vipTrial" },
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
  labelKey: string;
  subKey: string;
  pts: number;
  btnLabelKey: string;
  action: TaskAction;
  vip?: boolean;
}

const EXTRA_TASKS: ExtraTask[] = [
  { id: "mood",      emoji: "😊", labelKey: "home.task.mood",     subKey: "home.task.moodSub",     pts: 10, btnLabelKey: "home.task.moodBtn",     action: { type: "mood" } },
  { id: "tip",       emoji: "💡", labelKey: "home.task.tip",      subKey: "home.task.tipSub",      pts: 5,  btnLabelKey: "home.task.tipBtn",      action: { type: "tip" } },
  { id: "trend",     emoji: "📊", labelKey: "home.task.trend",    subKey: "home.task.trendSub",    pts: 10, btnLabelKey: "home.task.trendBtn",    action: { type: "navigate", to: "/(tabs)/history" } },
  { id: "report",    emoji: "📋", labelKey: "home.task.report",   subKey: "home.task.reportSub",   pts: 10, btnLabelKey: "home.task.reportBtn",   action: { type: "navigate", to: "/(tabs)/report" } },
  { id: "ai_report", emoji: "🤖", labelKey: "home.task.aiReport", subKey: "home.task.aiReportSub", pts: 20, btnLabelKey: "home.task.aiReportBtn", action: { type: "navigate", to: "/(tabs)/report" }, vip: true },
  { id: "ai_chat",   emoji: "💬", labelKey: "home.task.aiChat",   subKey: "home.task.aiChatSub",   pts: 15, btnLabelKey: "home.task.aiChatBtn",   action: { type: "navigate", to: "/chat" }, vip: true },
];

const SKIN_TIP_COUNT = 15;

function getTodayTip(t: TFn): string {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return t(`home.tip.${dayOfYear % SKIN_TIP_COUNT}`);
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
  const { t } = useT();
  const next = MILESTONES.find((m) => totalPts < m.points);
  const prev = next ? MILESTONES[MILESTONES.indexOf(next) - 1] : null;
  const fromPts = prev?.points ?? 0;
  const progress = next
    ? Math.min((totalPts - fromPts) / (next.points - fromPts), 1)
    : 1;

  const hasScore = score !== null;
  let condition = hasScore ? (score >= 85 ? t("home.condition.excellent") : score >= 70 ? t("home.condition.good") : t("home.condition.needsCare")) : t("home.condition.noScan");

  const changeText =
    scoreChange === null
      ? t("home.change.startScan")
      : scoreChange > 0
        ? t("home.change.up", { n: String(scoreChange) })
        : scoreChange < 0
          ? t("home.change.down", { n: String(scoreChange) })
          : t("home.change.none");

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
              <Text style={styles.heroLabelText}>{t("home.yourSkinScore")}</Text>
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
            <Text style={styles.ptsBubblePts}>{t("home.pts")}</Text>
            <Text style={styles.ptsBubbleDay}>{t("home.today")}</Text>
          </View>
        </View>

        {/* Milestone strip */}
        {next && (
          <View style={styles.milestoneStrip}>
            <Text style={styles.milestoneText}>
              ⭐&nbsp; {t("home.next", { label: t(next.labelKey), cur: String(totalPts), max: String(next.points) })}
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
const ACNE_META: Record<AcneType, { labelKey: string; color: string; descKey: string }> = {
  pustule:  { labelKey: "acne.pustule",  color: "#F43F8F", descKey: "acne.pustuleDesc" },
  broken:   { labelKey: "acne.broken",   color: "#F97316", descKey: "acne.brokenDesc" },
  redness:  { labelKey: "acne.redness",  color: "#EF4444", descKey: "acne.rednessDesc" },
  scab:     { labelKey: "acne.scab",     color: "#A78BFA", descKey: "acne.scabDesc" },
};

function SpotsModal({
  visible,
  onClose,
  latestCount,
  breakdown,
  latestScan,
}: {
  visible: boolean;
  onClose: () => void;
  latestCount: number;
  breakdown: Record<AcneType, number> | null;
  latestScan: ScanRecord | null;
}) {
  const { t } = useT();
  const total = latestCount;
  const hasBreakdown = breakdown && Object.values(breakdown).some((v) => v > 0);
  const maxVal = hasBreakdown ? Math.max(...Object.values(breakdown!)) : 1;

  const severity = total === 0 ? t("home.severity.clear") : total <= 3 ? t("home.severity.mild") : total <= 8 ? t("home.severity.moderate") : t("home.severity.severe");
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
              <Text style={styles.modalTitle}>{t("home.spotAnalysis")}</Text>
              <Text style={styles.modalSub}>{t("home.latestResults")}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <X size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Hero count */}
          <LinearGradient colors={["#FFF1F4", "#FFF8FA"]} style={styles.modalHeroBox}>
            <Text style={styles.modalHeroNum}>{total}</Text>
            <Text style={styles.modalHeroLbl}>{t("home.totalSpots")}</Text>
            <View style={[styles.severityPill, { backgroundColor: severityColor + "20" }]}>
              <View style={[styles.severityDot, { backgroundColor: severityColor }]} />
              <Text style={[styles.severityText, { color: severityColor }]}>{severity}</Text>
            </View>
          </LinearGradient>

          {/* 最近一次扫描的照片 + 痘痘高亮框 */}
          {latestScan?.image_uri && latestScan.detections?.length > 0 && (
            <View style={styles.modalPhotoWrap}>
              <Text style={styles.modalPhotoLabel}>
                {t("home.lastScan", { date: new Date(latestScan.scan_date).toLocaleDateString() })}
              </Text>
              <AnnotatedSkinImage
                imageUri={latestScan.image_uri}
                detections={latestScan.detections}
                displayWidth={width - 48 - 32}
                displayHeight={(width - 48 - 32) * 0.9}
                borderRadius={14}
                showLabels={false}
              />
              <Text style={styles.modalPhotoHint}>
                {t("home.spotsDetected", { n: String(latestScan.detections.length), s: latestScan.detections.length === 1 ? "" : "s" })}
              </Text>
            </View>
          )}

          {/* Breakdown chart */}
          {hasBreakdown ? (
            <View style={styles.breakdownSection}>
              <Text style={styles.breakdownTitle}>{t("home.breakdownByType")}</Text>
              {(Object.keys(ACNE_META) as AcneType[]).map((type) => {
                const count = breakdown![type] ?? 0;
                const meta = ACNE_META[type];
                const pct = maxVal > 0 ? count / maxVal : 0;
                return (
                  <View key={type} style={styles.breakdownRow}>
                    <View style={styles.breakdownLeft}>
                      <Text style={styles.breakdownLabel}>{t(meta.labelKey)}</Text>
                      <Text style={styles.breakdownDesc}>{t(meta.descKey)}</Text>
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
              <Text style={styles.noDataText}>{t("home.noSpotData")}</Text>
              <Text style={styles.noDataSub}>{t("home.noSpotDataSub")}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.modalCta}
            onPress={() => { onClose(); router.push("/(tabs)/report"); }}
          >
            <LinearGradient colors={["#F43F8F", "#F472B6"]} style={styles.modalCtaGrad}>
              <Text style={styles.modalCtaText}>{t("home.viewFullReport")}</Text>
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
  { emoji: "😞", labelKey: "home.mood.bad",     id: "Bad",     color: "#EF4444" },
  { emoji: "😐", labelKey: "home.mood.meh",     id: "Meh",     color: "#F97316" },
  { emoji: "🙂", labelKey: "home.mood.okay",    id: "Okay",    color: "#F59E0B" },
  { emoji: "😊", labelKey: "home.mood.good",    id: "Good",    color: "#10B981" },
  { emoji: "🤩", labelKey: "home.mood.amazing", id: "Amazing", color: "#F472B6" },
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
  const { t } = useT();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { paddingBottom: 36 }]} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{t("home.moodTitle")}</Text>
              <Text style={styles.modalSub}>{t("home.moodSub")}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <X size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.moodRow}>
            {MOODS.map((m) => {
              const active = selected === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => setSelected(m.id)}
                  style={[styles.moodBtn, active && { backgroundColor: m.color + "20", borderColor: m.color, borderWidth: 2 }]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text style={[styles.moodLabel, active && { color: m.color, fontWeight: "700" }]}>{t(m.labelKey)}</Text>
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
              <Text style={styles.modalCtaText}>{t("home.moodSave")}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Daily Tip Modal ─────────────────────────────────────────
function TipModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useT();
  const tip = getTodayTip(t);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { paddingBottom: 36 }]} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{t("home.tipTitle")}</Text>
              <Text style={styles.modalSub}>{t("home.tipSub")}</Text>
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
              <Text style={styles.modalCtaText}>{t("home.tipGotIt")}</Text>
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

function WeeklyInsightCard({ insight, isVip }: { insight: InsightData | null; isVip: boolean }) {
  const { t } = useT();
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
          <Text style={styles.insightTitle}>{t("home.weeklyInsight")}</Text>
          {!isVip && (
            <View style={styles.freePill}>
              <Text style={styles.freePillText}>{t("home.free")}</Text>
            </View>
          )}
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
            <Text style={styles.insightStatLbl}>{t("home.avgScore")}</Text>
          </View>
          {insight.score_change !== null && (
            <View style={styles.insightStat}>
              <View style={styles.insightChangeRow}>
                {hasImproved ? <TrendingUp size={12} color="#10B981" /> : hasDeclined ? <TrendingDown size={12} color="#FB7185" /> : null}
                <Text style={[styles.insightStatVal, hasImproved ? { color: "#10B981" } : hasDeclined ? { color: "#FB7185" } : {}]}>
                  {insight.score_change > 0 ? "+" : ""}{insight.score_change}
                </Text>
              </View>
              <Text style={styles.insightStatLbl}>{t("home.vsLastWeek")}</Text>
            </View>
          )}
          <View style={styles.insightStat}>
            <Text style={styles.insightStatVal}>{insight.scans_this_week}</Text>
            <Text style={styles.insightStatLbl}>{t("home.scans")}</Text>
          </View>
        </View>
      )}

      {!isVip && (
        <TouchableOpacity onPress={() => router.push("/vip")} style={styles.insightCta}>
          <Text style={styles.insightCtaText}>{t("home.unlockFullReport")}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────
export default function HomeScreen() {
  const { t } = useT();
  const { colors: C, shadow: S, isDark, gradients: G } = useAppTheme();
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
  const [latestFaceScan, setLatestFaceScan] = useState<ScanRecord | null>(null);
  const [moodModalVisible, setMoodModalVisible] = useState(false);
  const [tipModalVisible, setTipModalVisible] = useState(false);

  // 今日数据——每天"清零"，鼓励用户每天扫一次
  const [todaySpots, setTodaySpots] = useState<number | null>(null);
  const [todayScore, setTodayScore] = useState<number | null>(null);
  const [todayScans, setTodayScans] = useState(0);
  const [dailyAdvice, setDailyAdvice] = useState<string>("");
  // Daily check-in 折叠态：默认收起（用户说"隐藏式"）。
  // 状态持久化到 AsyncStorage，避免每次刷新又被用户手动展开。
  const [checkinExpanded, setCheckinExpanded] = useState(false);

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

      // Load user's preferred check-in collapsed/expanded state
      const expandedRaw = await AsyncStorage.getItem("@aurasight_checkin_expanded");
      if (expandedRaw === "true") setCheckinExpanded(true);

      const [statsData, ptsRes, scansRes, insightRes] = await Promise.all([
        getStats(id),
        fetch(`${API_URL}/points/${id}`).then((r) => r.json()),
        // 拉 30 天是为了能在 SpotsModal 里显示最近一次有照片的扫描。
        // 只拉 2 天会导致今天没扫的用户看到空 state，即便他们 3 天前刚拍过。
        fetch(`${API_URL}/scans/${id}?days=30`).then((r) => r.json()),
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

      // 最近一次面部扫描（带照片+detections），喂给 SpotsModal 显示痘痘高亮
      const latestFace = (scansRes as ScanRecord[]).find(
        (s) => !["back", "chest"].includes(s.body_zone) && s.image_uri,
      ) ?? null;
      setLatestFaceScan(latestFace);

      // ── 今日统计（每日清零）──
      const todayStr = todayKey();
      const todayArr = (scansRes as ScanRecord[]).filter(
        (s) => new Date(s.scan_date).toISOString().split("T")[0] === todayStr,
      );
      setTodayScans(todayArr.length);
      if (todayArr.length > 0) {
        // 取今天最新的一次扫描作为 spots / score
        const latest = todayArr.reduce((a, b) =>
          new Date(a.scan_date) > new Date(b.scan_date) ? a : b,
        );
        setTodaySpots(latest.detections?.length ?? null);
        setTodayScore(latest.skin_score ?? null);
      } else {
        setTodaySpots(null);
        setTodayScore(null);
      }
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
    <LinearGradient colors={isDark ? [C.background, C.background] : ["#FFF3F6", "#FFF9FB", "#FFFFFF"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.greeting, isDark && { color: C.gray900 }]}>
                {getGreeting(userName || (isGuest ? "" : ""), t)} ✨
              </Text>
              <Text style={[styles.dayMessage, isDark && { color: C.gray400 }]}>{getDayMessage(t)}</Text>
            </View>
            <View style={styles.headerRight}>
              {/* Only show Sign In for actual guests (not registered, not VIP) */}
              {isGuest && (
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/profile")}
                  style={[styles.signInBtn, isDark && { backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.gray200 }]}
                >
                  <User size={13} color={Colors.rose400} />
                  <Text style={[styles.signInText, isDark && { color: C.gray400 }]}>{t("common.signIn")}</Text>
                </TouchableOpacity>
              )}
              <LinearGradient
                colors={streak >= 7 ? ["#FFF0E8", "#FFEADD"] : ["#FFE4E6", "#FCE7F3"]}
                style={styles.streakBadge}
              >
                <FlameIcon streak={streak} />
                <Text style={[styles.streakText, streak >= 30 && { color: "#DC2626" }, streak >= 7 && streak < 30 && { color: "#EA580C" }]}>
                  {t("home.streak", { n: String(streak) })}
                </Text>
              </LinearGradient>
            </View>
          </View>

          {/* ── Skin Score Hero ── */}
          <FadeInComponent delay={100} duration={400} from="bottom">
            <SkinScoreHero
              score={skinScore}
              todayPts={displayTodayPts}
              totalPts={totalPts}
              scoreChange={scoreChange}
            />
          </FadeInComponent>

          {/* ── Daily Check-in（隐藏式：默认收起，点击展开） ── */}
          {(() => {
            const mainDone = faceDone ? 1 : 0; // body hidden for now
            const extraDoneCount = Object.values(extraDone).filter(Boolean).length;
            const totalExtra = EXTRA_TASKS.length;
            const allMainDone = faceDone; // body hidden for now
            return (
          <View style={[styles.card, styles.checkinCard, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={async () => {
                const next = !checkinExpanded;
                setCheckinExpanded(next);
                await AsyncStorage.setItem("@aurasight_checkin_expanded", String(next));
              }}
              style={styles.checkinHeaderRow}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, isDark && { color: C.gray900 }]}>{t("home.dailyCheckin")}</Text>
                {/* 折叠态摘要行：一眼看完成进度 */}
                {!checkinExpanded && (
                  <Text style={[styles.checkinSummary, isDark && { color: C.gray400 }]}>
                    {allMainDone ? t("home.doneToday") : t("home.mainProgress", { done: String(mainDone) })}
                    {totalExtra > 0 ? ` · ${t("home.bonusProgress", { done: String(extraDoneCount), total: String(totalExtra) })}` : ""}
                    {" · "}{displayTodayPts} {t("home.pts")}
                  </Text>
                )}
              </View>
              {checkinExpanded ? (
                <ChevronUp size={18} color={isDark ? C.gray400 : Colors.gray400} />
              ) : (
                <ChevronDown size={18} color={isDark ? C.gray400 : Colors.gray400} />
              )}
            </TouchableOpacity>
            {checkinExpanded && (
              <View style={styles.cardHeader}>
                <Text style={[styles.cardHeaderPts, isDark && { color: C.gray500 }]}>{t("home.ptsToday", { pts: String(displayTodayPts) })}</Text>
              </View>
            )}

            {checkinExpanded && (
            <>

            {/* 完成时的庆祝横幅 */}
            {faceDone && (
              <LinearGradient
                colors={["#10B981", "#34D399"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.celebrateBanner}
              >
                <Text style={styles.celebrateEmoji}>🎉</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.celebrateTitle}>{t("home.checkinComplete")}</Text>
                  <Text style={styles.celebrateSub}>
                    {t("home.checkinReward")}
                  </Text>
                </View>
                <Text style={styles.celebrateCheck}>✓</Text>
              </LinearGradient>
            )}

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
                <Text style={[styles.taskName, faceDone && styles.taskNameDone, isDark && { color: C.gray900 }]}>
                  {faceDone ? t("home.faceChecked") : t("home.howsSkin")}
                </Text>
                <Text style={[styles.taskSub, isDark && { color: C.gray400 }]}>{t("home.faceScanSub")}</Text>
              </View>
              {faceDone ? (
                <CheckCircle size={22} color="#10B981" />
              ) : (
                <AnimatedPressable onPress={() => router.push("/(tabs)/camera")} scaleAmount={0.93}>
                  <LinearGradient colors={["#F43F8F", "#FB7185"]} style={styles.scanBtn}>
                    <Text style={styles.scanBtnText}>{t("common.scan")}</Text>
                  </LinearGradient>
                </AnimatedPressable>
              )}
            </View>

            <View style={styles.taskDivider} />

            {/* ── Body Task 暂时隐藏 ──
            <View style={styles.taskRow}>
              {yesterdayBody ? (
                <Image source={{ uri: yesterdayBody }} style={styles.taskThumb} />
              ) : (
                <LinearGradient colors={["#FCE7F3", "#FFDDE8"]} style={styles.taskThumb}>
                  <Text style={styles.taskThumbEmoji}>🧍</Text>
                </LinearGradient>
              )}
              <View style={styles.taskInfo}>
                <Text style={[styles.taskName, bodyDone && styles.taskNameDone, isDark && { color: C.gray900 }]}>
                  {bodyDone ? "Body checked in ✓" : "Quick body check-in"}
                </Text>
                <Text style={[styles.taskSub, isDark && { color: C.gray400 }]}>+50 pts · tracks shape & progress</Text>
              </View>
              {bodyDone ? (
                <CheckCircle size={22} color="#10B981" />
              ) : (
                <TouchableOpacity onPress={() => router.push("/(tabs)/camera")}>
                  <LinearGradient colors={["#F43F8F", "#FB7185"]} style={styles.scanBtn}>
                    <Text style={styles.scanBtnText}>{t("common.scan")}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.taskDivider} />
            ── end hidden body task ── */}

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
                        <Text style={[styles.taskName, done && styles.taskNameDone, locked && styles.taskNameLocked, isDark && { color: C.gray900 }]}>
                          {t(task.labelKey)}
                        </Text>
                        {task.vip && (
                          <View style={[styles.vipBadge, isDark && { backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.gray200 }]}>
                            <Text style={[styles.vipBadgeText, isDark && { color: C.gray400 }]}>👑 VIP</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.taskSub, isDark && { color: C.gray400 }]}>
                        {locked ? `${t(task.subKey)} · ${t("home.vipExclusive")}` : t(task.subKey)}
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
                        <Text style={styles.unlockBtnText}>{t("common.unlock")}</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleExtraTaskAction(task)}
                        style={styles.actionBtn}
                      >
                        <Text style={styles.actionBtnText}>{t(task.btnLabelKey)}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {!isLast && <View style={styles.taskDivider} />}
                </React.Fragment>
              );
            })}
            </>
            )}
          </View>
            );
          })()}

          {/* ── 广告横幅（仅免费用户） ── */}
          <AdBanner style={{ marginBottom: 4 }} />

          {/* ── Today's Stats Row ── */}
          <Text style={[styles.todayLabel, isDark && { color: C.gray500 }]}>{t("home.todayLabel")}</Text>
          {todayScans === 0 ? (
            <TouchableOpacity
              style={styles.todayCta}
              onPress={() => router.push("/(tabs)/camera")}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={isDark ? [C.cardBg, C.cardBg] : ["#FFF0F3", "#FCE7F3"]}
                style={[styles.todayCtaInner, isDark && { borderColor: C.gray200 }]}
              >
                <CameraIcon size={20} color={Colors.rose400} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.todayCtaTitle, isDark && { color: C.gray900 }]}>{t("home.noScanToday")}</Text>
                  <Text style={[styles.todayCtaSub, isDark && { color: C.gray400 }]}>
                    {t("home.noScanTodaySub")}
                  </Text>
                </View>
                <ChevronRight size={16} color={Colors.rose400} />
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <StaggeredList stagger={80} style={styles.statsRow} itemStyle={{ flex: 1 }}>
              {/* Spots — opens detail modal */}
              <TouchableOpacity
                style={[styles.statCard, styles.statSpots, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}
                onPress={() => setSpotsModalVisible(true)}
                activeOpacity={0.75}
              >
                <View style={[styles.statDot, { backgroundColor: "#FB7185" }]} />
                <Text style={[styles.statVal, { color: "#FB7185" }]}>
                  {todaySpots ?? "--"}
                </Text>
                <Text style={[styles.statLbl, isDark && { color: C.gray500 }]}>{t("home.spots")}</Text>
                <ChevronRight size={10} color="#FB7185" style={{ marginTop: 2 }} />
              </TouchableOpacity>

              {/* Skin Score — goes to report */}
              <TouchableOpacity
                style={[styles.statCard, styles.statScore, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}
                onPress={() => router.push("/(tabs)/report")}
                activeOpacity={0.75}
              >
                <View style={[styles.statDot, { backgroundColor: "#F472B6" }]} />
                <Text style={[styles.statVal, { color: "#F472B6" }]}>
                  {todayScore ?? "--"}
                </Text>
                <Text style={[styles.statLbl, isDark && { color: C.gray500 }]}>{t("home.skinScore")}</Text>
                <ChevronRight size={10} color="#F472B6" style={{ marginTop: 2 }} />
              </TouchableOpacity>

              {/* Today's Scans — goes to history */}
              <TouchableOpacity
                style={[styles.statCard, styles.statScans, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}
                onPress={() => router.push("/(tabs)/history")}
                activeOpacity={0.75}
              >
                <View style={[styles.statDot, { backgroundColor: "#10B981" }]} />
                <Text style={[styles.statVal, { color: "#10B981" }]}>
                  {todayScans}
                </Text>
                <Text style={[styles.statLbl, isDark && { color: C.gray500 }]}>{t("home.scans")}</Text>
                <ChevronRight size={10} color="#10B981" style={{ marginTop: 2 }} />
              </TouchableOpacity>
            </StaggeredList>
          )}

          {/* ── Weekly Insight ── */}
          <FadeInComponent delay={300} duration={400} from="bottom">
            <WeeklyInsightCard insight={insight} isVip={isVip} />
          </FadeInComponent>

          {/* ── AI Daily Advice ── */}
          <FadeInComponent delay={400} duration={400} from="bottom">
            <TouchableOpacity
              onPress={() => router.push("/chat")}
              activeOpacity={0.85}
            >
              <LinearGradient colors={isDark ? [C.cardBg, C.cardBg] : ["#FFF0F6", "#FFF5FB"]} style={[styles.aiCard, isDark && { borderColor: C.gray200 }]}>
                <LinearGradient colors={["#F43F8F", "#F472B6"]} style={styles.aiAvatarGrad}>
                  <Sparkles size={16} color="#fff" />
                </LinearGradient>
                <View style={styles.aiInfo}>
                  <View style={styles.aiTitleRow}>
                    <Text style={[styles.aiTitle, isDark && { color: C.gray900 }]}>{t("home.aiAdvisor")}</Text>
                    <View style={styles.aiLivePill}>
                      <Text style={styles.aiLiveDot}>●</Text>
                      <Text style={styles.aiLiveText}>{t("home.aiLive")}</Text>
                    </View>
                  </View>
                  <Text style={[styles.aiSub, isDark && { color: C.gray400 }]} numberOfLines={2}>
                    {dailyAdvice || t("home.aiDefault")}
                  </Text>
                </View>
                <ChevronRight size={16} color={Colors.rose400} />
              </LinearGradient>
            </TouchableOpacity>
          </FadeInComponent>

          {/* ── Guest banner ── */}
          {isGuest && (
            <FadeInComponent delay={500} duration={400} from="bottom">
              <TouchableOpacity onPress={() => router.push("/(tabs)/profile")} activeOpacity={0.85}>
                <LinearGradient colors={isDark ? [C.cardBg, C.cardBg] : ["#FFF0F6", "#FFE4E6"]} style={[styles.guestBanner, isDark && { borderWidth: 1, borderColor: C.gray200 }]}>
                  <User size={13} color={Colors.rose400} />
                  <Text style={[styles.guestText, isDark && { color: C.gray400 }]}>{t("home.guestBanner")}</Text>
                  <Text style={[styles.guestArrow, isDark && { color: C.gray400 }]}>→</Text>
                </LinearGradient>
              </TouchableOpacity>
            </FadeInComponent>
          )}

        </ScrollView>
      </SafeAreaView>

      {/* ── Spots Detail Modal ── */}
      <SpotsModal
        visible={spotsModalVisible}
        onClose={() => setSpotsModalVisible(false)}
        latestCount={stats?.latest_count ?? 0}
        breakdown={stats?.acne_breakdown ?? null}
        latestScan={latestFaceScan}
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
  greeting: { fontSize: FontSize.xxl, fontWeight: "700", color: Colors.gray800, letterSpacing: -0.4 },
  dayMessage: {
    fontSize: FontSize.sm,
    color: Colors.rose400,
    fontWeight: "600",
    marginTop: 4,
    lineHeight: 18,
  },
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
  checkinHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  checkinSummary: {
    fontSize: 12,
    color: Colors.gray500,
    marginTop: 2,
  },
  celebrateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 14,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  celebrateEmoji: { fontSize: 24 },
  celebrateTitle: { fontSize: 13, fontWeight: "700", color: "#fff" },
  celebrateSub: { fontSize: 11, color: "rgba(255,255,255,0.9)", marginTop: 1 },
  celebrateCheck: { fontSize: 22, color: "#fff", fontWeight: "800" },
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
  todayLabel: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    color: Colors.gray400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  todayCta: { marginBottom: 14 },
  todayCtaInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: "#F9D5E8",
  },
  todayCtaTitle: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.gray800,
  },
  todayCtaSub: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    marginTop: 2,
  },
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
  modalPhotoWrap: {
    marginHorizontal: 24,
    marginBottom: 20,
    alignItems: "center",
  },
  modalPhotoLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "600",
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  modalPhotoHint: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 8,
    textAlign: "center",
  },
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
