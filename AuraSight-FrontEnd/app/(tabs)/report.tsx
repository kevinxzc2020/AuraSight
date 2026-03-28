import { LinearGradient } from "expo-linear-gradient";
import {
  AlertCircle,
  Check,
  Crown,
  Droplets,
  TrendingUp,
} from "lucide-react-native";
import React from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Defs,
  Path,
  Stop,
  LinearGradient as SvgGrad,
} from "react-native-svg";
import {
  AcneColors,
  Colors,
  FontSize,
  Gradients,
  Radius,
  Shadow,
  Spacing,
} from "../../constants/theme";

const { width } = Dimensions.get("window");

// ─── 甜甜圈图 ─────────────────────────────────────────────
const acneBreakdown = [
  { type: "Pustule", count: 5, color: AcneColors.pustule, percent: 42 },
  { type: "Broken", count: 3, color: AcneColors.broken, percent: 25 },
  { type: "Scab", count: 2, color: AcneColors.scab, percent: 17 },
  { type: "Redness", count: 2, color: AcneColors.redness, percent: 16 },
];

function DonutChart() {
  const size = 112;
  const r = 40;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;

  return (
    <View style={{ position: "relative", width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        style={{ transform: [{ rotate: "-90deg" }] }}
      >
        {acneBreakdown.map((item, i) => {
          const dashArray = (item.percent / 100) * circumference;
          const dashOffset = -((cumulative / 100) * circumference);
          cumulative += item.percent;
          return (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={item.color}
              strokeWidth={14}
              strokeDasharray={`${dashArray} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutTotal}>12</Text>
        <Text style={styles.donutLabel}>Total</Text>
      </View>
    </View>
  );
}

// ─── 趋势折线图 ───────────────────────────────────────────
function TrendLine() {
  const W = width - Spacing.xl * 2 - Spacing.xxl * 2;
  const H = 80;

  return (
    <Svg width={W} height={H} viewBox={`0 0 300 80`} preserveAspectRatio="none">
      <Defs>
        <SvgGrad id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#f472b6" />
          <Stop offset="100%" stopColor="#fb7185" />
        </SvgGrad>
        <SvgGrad id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#f472b6" stopOpacity="0.25" />
          <Stop offset="100%" stopColor="#f472b6" stopOpacity="0" />
        </SvgGrad>
      </Defs>
      <Path
        d="M0,60 Q30,55 60,50 T120,45 T180,35 T240,25 T300,20"
        fill="none"
        stroke="url(#lineGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <Path
        d="M0,60 Q30,55 60,50 T120,45 T180,35 T240,25 T300,20 L300,80 L0,80 Z"
        fill="url(#areaGrad)"
      />
    </Svg>
  );
}

// ─── AI 洞察卡片 ──────────────────────────────────────────
const insights = [
  {
    Icon: Droplets,
    title: "Hydration Impact",
    desc: "Your skin clarity improved 23% on days you logged 8+ glasses of water.",
  },
  {
    Icon: AlertCircle,
    title: "Hormonal Pattern",
    desc: "Chin breakouts peaked during days 21-25 of your cycle. Consider targeted care.",
  },
  {
    Icon: TrendingUp,
    title: "Progress Milestone",
    desc: "You've reduced total acne count by 38% since day 1. Keep it up!",
  },
];

const vipFeatures = [
  "Personalized routine builder",
  "Product recommendations",
  "Dermatologist report export",
  "Unlimited history storage",
];

// ─── 主页面 ───────────────────────────────────────────────
export default function ReportScreen() {
  return (
    <LinearGradient colors={["#fff5f5", "#ffffff"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Your 30-Day Journey</Text>
            <Text style={styles.dateRange}>Feb 25 - Mar 27, 2026</Text>
          </View>

          {/* 皮肤评分趋势 */}
          <View style={[styles.card, Shadow.card]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Skin Score Trend</Text>
              <View style={styles.scoreRow}>
                <TrendingUp size={16} color={Colors.emerald} />
                <Text style={styles.scoreValue}>+12%</Text>
              </View>
            </View>
            <TrendLine />
          </View>

          {/* 甜甜圈图 */}
          <View style={[styles.card, Shadow.card]}>
            <Text style={styles.cardLabel}>Condition Breakdown</Text>
            <View style={styles.donutRow}>
              <DonutChart />
              <View style={styles.legendList}>
                {acneBreakdown.map((item, i) => (
                  <View key={i} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: item.color },
                      ]}
                    />
                    <Text style={styles.legendType}>{item.type}</Text>
                    <Text style={styles.legendCount}>{item.count}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* 前后对比 */}
          <View style={[styles.card, Shadow.card]}>
            <Text style={styles.cardLabel}>30-Day Comparison</Text>
            <View style={styles.compareRow}>
              <View style={styles.compareItem}>
                <LinearGradient
                  colors={["#ffe4e6", "#fce7f3"]}
                  style={styles.compareThumb}
                >
                  <Text style={{ fontSize: 28 }}>👤</Text>
                </LinearGradient>
                <Text style={styles.compareLabel}>Day 1</Text>
              </View>
              <View style={styles.compareDivider}>
                <View style={styles.dividerLine} />
                <LinearGradient
                  colors={Gradients.roseMain}
                  style={styles.dividerBadge}
                >
                  <Text style={styles.dividerBadgeText}>+22</Text>
                </LinearGradient>
                <View style={styles.dividerLine} />
              </View>
              <View style={styles.compareItem}>
                <LinearGradient
                  colors={["#d1fae5", "#a7f3d0"]}
                  style={styles.compareThumb}
                >
                  <Text style={{ fontSize: 28 }}>👤</Text>
                </LinearGradient>
                <Text style={styles.compareLabel}>Today</Text>
              </View>
            </View>
          </View>

          {/* AI 洞察 */}
          <Text style={[styles.cardLabel, { marginBottom: Spacing.sm }]}>
            Beauty Insights
          </Text>
          <View style={styles.insightList}>
            {insights.map((ins, i) => (
              <LinearGradient
                key={i}
                colors={["#fff0f6", "#fff5f5"]}
                style={[
                  styles.insightCard,
                  { borderColor: Colors.rose100, borderWidth: 1 },
                ]}
              >
                <LinearGradient
                  colors={Gradients.roseMain}
                  style={styles.insightIcon}
                >
                  <ins.Icon size={16} color="#fff" />
                </LinearGradient>
                <View style={styles.insightText}>
                  <Text style={styles.insightTitle}>{ins.title}</Text>
                  <Text style={styles.insightDesc}>{ins.desc}</Text>
                </View>
              </LinearGradient>
            ))}
          </View>

          {/* VIP 升级卡 */}
          <LinearGradient
            colors={["#f472b6", "#ec4899", "#fb7185"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.vipCard}
          >
            {/* 装饰圆 */}
            <View style={styles.vipDecorTopRight} />
            <View style={styles.vipDecorBottomLeft} />

            <View style={styles.vipHeader}>
              <View style={styles.crownIcon}>
                <Crown size={16} color="#fde68a" />
              </View>
              <View>
                <Text style={styles.vipTitle}>Unlock Pro Features</Text>
                <Text style={styles.vipSubtitle}>AuraSight Premium</Text>
              </View>
            </View>

            {vipFeatures.map((f, i) => (
              <View key={i} style={styles.vipFeature}>
                <Check size={14} color="#fff" />
                <Text style={styles.vipFeatureText}>{f}</Text>
              </View>
            ))}

            <TouchableOpacity activeOpacity={0.85} style={styles.vipButton}>
              <Text style={styles.vipButtonText}>Try 7 Days Free</Text>
            </TouchableOpacity>
          </LinearGradient>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },

  header: { marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: "600", color: Colors.gray800 },
  dateRange: { fontSize: FontSize.sm, color: Colors.gray500, marginTop: 2 },

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
  cardLabel: {
    fontSize: FontSize.sm,
    fontWeight: "500",
    color: Colors.gray600,
  },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  scoreValue: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.emerald,
  },

  donutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xl,
    marginTop: Spacing.md,
  },
  donutCenter: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  donutTotal: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    color: Colors.gray800,
  },
  donutLabel: { fontSize: 9, color: Colors.gray500 },

  legendList: { flex: 1, gap: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendType: { flex: 1, fontSize: FontSize.xs, color: Colors.gray600 },
  legendCount: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    color: Colors.gray800,
  },

  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  compareItem: { alignItems: "center", gap: 8 },
  compareThumb: {
    width: 64,
    height: 80,
    borderRadius: Radius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  compareLabel: { fontSize: 11, color: Colors.gray500 },
  compareDivider: { alignItems: "center", gap: 4 },
  dividerLine: { width: 32, height: 1, backgroundColor: Colors.rose200 },
  dividerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  dividerBadgeText: { color: "#fff", fontSize: FontSize.xs, fontWeight: "600" },

  insightList: { gap: Spacing.sm, marginBottom: Spacing.lg },
  insightCard: {
    flexDirection: "row",
    gap: Spacing.md,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    alignItems: "flex-start",
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  insightText: { flex: 1 },
  insightTitle: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.gray800,
    marginBottom: 2,
  },
  insightDesc: { fontSize: FontSize.xs, color: Colors.gray600, lineHeight: 18 },

  vipCard: {
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    overflow: "hidden",
    position: "relative",
  },
  vipDecorTopRight: {
    position: "absolute",
    top: -32,
    right: -32,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  vipDecorBottomLeft: {
    position: "absolute",
    bottom: -24,
    left: -24,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.1)",
  },

  vipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  crownIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  vipTitle: { color: "#fff", fontWeight: "600", fontSize: FontSize.base },
  vipSubtitle: { color: "rgba(255,255,255,0.7)", fontSize: FontSize.xs },

  vipFeature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  vipFeatureText: { color: "rgba(255,255,255,0.9)", fontSize: FontSize.xs },

  vipButton: {
    backgroundColor: "#fff",
    borderRadius: Radius.xl,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  vipButtonText: {
    color: Colors.rose400,
    fontWeight: "700",
    fontSize: FontSize.sm,
  },
});
