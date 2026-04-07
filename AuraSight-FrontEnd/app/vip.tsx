import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ChevronLeft,
  Check,
  Sparkles,
  Camera,
  Video,
  Ban,
} from "lucide-react-native";
import {
  Colors,
  Gradients,
  Spacing,
  Radius,
  FontSize,
  Shadow,
} from "../constants/theme";

const { width } = Dimensions.get("window");

// ─── 功能列表 ─────────────────────────────────────────────
// 每一项都用"结果语言"而不是"功能语言"
// 用户买的不是功能，而是对自己皮肤的投资
const FEATURES = [
  {
    icon: "📊",
    title: "Deep AI skin report",
    sub: "Weekly cause analysis — weather, diet, hormones, sleep",
  },
  {
    icon: "📸",
    title: "Permanent photo storage",
    sub: "Your 30-day transformation, saved forever across devices",
  },
  {
    icon: "🎬",
    title: "4K timelapse video",
    sub: "Watch your transformation in 30 seconds — shareable",
  },
  {
    icon: "🚫",
    title: "Zero ads, ever",
    sub: "Pure experience, no interruptions",
  },
  {
    icon: "🔄",
    title: "Unlimited scan history",
    sub: "Free tier is 30 days — VIP keeps everything",
  },
];

// ─── 定价方案 ─────────────────────────────────────────────
// 三档结构：
//   - 30天挑战包：无试用，一次性低价，给不想订阅的用户
//   - 年订阅：试用 + 最优性价比，主推
//   - 月订阅：试用 + 灵活，给观望用户
const PLANS = [
  {
    id: "challenge",
    label: "30-Day Challenge",
    badge: "🎯 ONE-TIME",
    price: "$9.99",
    period: "one-time payment",
    sub: "Perfect for your first challenge",
    trial: false,
    featured: false,
  },
  {
    id: "annual",
    label: "Annual Plan",
    badge: "⭐ BEST VALUE",
    price: "$34.99",
    period: "per year  ·  $2.99/mo",
    sub: "Save 40% vs monthly",
    trial: true,
    featured: true, // 视觉上高亮这个选项，引导用户选它
  },
  {
    id: "monthly",
    label: "Monthly Plan",
    badge: null,
    price: "$4.99",
    period: "per month",
    sub: "Cancel anytime",
    trial: true,
    featured: false,
  },
];

export default function VIPScreen() {
  // 默认选中年订阅，性价比最高，引导用户往这里走
  const [selected, setSelected] = useState("annual");

  const selectedPlan = PLANS.find((p) => p.id === selected)!;

  function handleSubscribe() {
    // Phase 2：接入 RevenueCat 或 Stripe 真实付款
    // 现在先用 Alert 占位，让 UI 流程完整
    const trialText = selectedPlan.trial ? "7-day free trial, then " : "";
    Alert.alert(
      "Coming Soon",
      `${trialText}${selectedPlan.price} ${selectedPlan.period}.\n\nIn-app purchases will be available in the next update.`,
      [{ text: "Got it", style: "cancel" }],
    );
  }

  return (
    <View style={styles.container}>
      {/* Hero 区域：深色背景，和首页的 Weekly Insight 卡片同一视觉语言
          这让用户感受到"进入了一个更高级的区域" */}
      <LinearGradient colors={["#0d0d1a", "#1a0a14"]} style={styles.hero}>
        <SafeAreaView>
          {/* 返回按钮 */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <ChevronLeft size={24} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>

          {/* 品牌图标 */}
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>✦</Text>
          </View>

          <Text style={styles.heroTitle}>AuraSight VIP</Text>
          <Text style={styles.heroSub}>
            Your skin deserves more than guesswork.{"\n"}Let data lead the way.
          </Text>

          {/* 7天试用标注 — 放在 Hero 里，第一眼就看到，大幅降低心理门槛 */}
          <View style={styles.trialBadge}>
            <Sparkles size={12} color="#f472b6" />
            <Text style={styles.trialBadgeText}>
              Try free for 7 days · Cancel anytime
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 功能列表 */}
        <View style={[styles.card, Shadow.card]}>
          <Text style={styles.sectionLabel}>Everything included</Text>
          {FEATURES.map((f, i) => (
            <View
              key={i}
              style={[
                styles.featureRow,
                i < FEATURES.length - 1 && styles.featureRowBorder,
              ]}
            >
              <View style={styles.featureIcon}>
                <Text style={styles.featureEmoji}>{f.icon}</Text>
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureSub}>{f.sub}</Text>
              </View>
              <Check size={16} color={Colors.emerald} />
            </View>
          ))}
        </View>

        {/* 定价选择区 */}
        <Text style={styles.sectionLabel}>Choose your plan</Text>

        {PLANS.map((plan) => {
          const isSelected = selected === plan.id;
          return (
            <TouchableOpacity
              key={plan.id}
              onPress={() => setSelected(plan.id)}
              activeOpacity={0.85}
              style={[
                styles.planCard,
                isSelected && styles.planCardSelected,
                plan.featured && isSelected && styles.planCardFeatured,
              ]}
            >
              {/* 徽章：BEST VALUE / 🎯 ONE-TIME */}
              {plan.badge && (
                <View
                  style={[
                    styles.planBadge,
                    plan.featured
                      ? styles.planBadgeFeatured
                      : styles.planBadgeNeutral,
                  ]}
                >
                  <Text
                    style={[
                      styles.planBadgeText,
                      plan.featured
                        ? styles.planBadgeTextFeatured
                        : styles.planBadgeTextNeutral,
                    ]}
                  >
                    {plan.badge}
                  </Text>
                </View>
              )}

              <View style={styles.planRow}>
                {/* 左边：名称 + 描述 */}
                <View style={styles.planLeft}>
                  <Text
                    style={[
                      styles.planLabel,
                      isSelected && styles.planLabelSelected,
                    ]}
                  >
                    {plan.label}
                  </Text>
                  <Text style={styles.planSub}>{plan.sub}</Text>
                  {/* 7天试用提示 — 只在有试用的方案里显示 */}
                  {plan.trial && (
                    <Text style={styles.planTrial}>
                      7-day free trial included
                    </Text>
                  )}
                </View>

                {/* 右边：价格 */}
                <View style={styles.planRight}>
                  <Text
                    style={[
                      styles.planPrice,
                      isSelected && styles.planPriceSelected,
                    ]}
                  >
                    {plan.price}
                  </Text>
                  <Text style={styles.planPeriod}>{plan.period}</Text>
                </View>
              </View>

              {/* 选中状态指示器 */}
              <View
                style={[
                  styles.planRadio,
                  isSelected && styles.planRadioSelected,
                ]}
              >
                {isSelected && <View style={styles.planRadioDot} />}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* 动态 CTA 按钮 — 文案根据选中方案变化，让用户清楚知道自己在做什么 */}
        <TouchableOpacity
          onPress={handleSubscribe}
          activeOpacity={0.85}
          style={styles.ctaWrapper}
        >
          <LinearGradient
            colors={Gradients.roseMain}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaBtn}
          >
            <Text style={styles.ctaText}>
              {selectedPlan.trial
                ? "Start 7-day free trial ✦"
                : "Start my 30-day challenge ✦"}
            </Text>
            {selectedPlan.trial && (
              <Text style={styles.ctaSub}>
                Free for 7 days · then {selectedPlan.price}{" "}
                {selectedPlan.period} · auto-renews · cancel anytime
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* 法律文字 + 恢复购买 */}
        <View style={styles.legal}>
          <TouchableOpacity>
            <Text style={styles.legalLink}>Restore purchase</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity>
            <Text style={styles.legalLink}>Terms</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity>
            <Text style={styles.legalLink}>Privacy</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          Subscriptions auto-renew unless cancelled at least 24 hours before the
          renewal date. Manage subscriptions in App Store settings.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff5f5" },

  // Hero
  hero: { paddingBottom: 28 },
  backBtn: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(244,114,182,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.xl,
    marginBottom: Spacing.md,
  },
  heroIconText: { fontSize: 26, color: "#f472b6" },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    paddingHorizontal: Spacing.xl,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: FontSize.sm,
    color: "rgba(255,255,255,0.5)",
    paddingHorizontal: Spacing.xl,
    lineHeight: 20,
    marginBottom: 16,
  },
  trialBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: Spacing.xl,
    backgroundColor: "rgba(244,114,182,0.15)",
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  trialBadgeText: {
    fontSize: FontSize.xs,
    color: "#f472b6",
    fontWeight: "700",
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    color: Colors.gray400,
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },

  // Features card
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  featureRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray50 },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fff0f6",
    alignItems: "center",
    justifyContent: "center",
  },
  featureEmoji: { fontSize: 18 },
  featureText: { flex: 1 },
  featureTitle: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.gray800,
  },
  featureSub: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    marginTop: 2,
    lineHeight: 16,
  },

  // Plan cards
  planCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.gray100,
    position: "relative",
  },
  planCardSelected: { borderColor: Colors.rose300 },
  planCardFeatured: { borderColor: Colors.rose400, borderWidth: 2 },
  planBadge: {
    position: "absolute",
    top: -10,
    left: 16,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  planBadgeFeatured: { backgroundColor: Colors.rose400 },
  planBadgeNeutral: {
    backgroundColor: "#fff0f6",
    borderWidth: 1,
    borderColor: Colors.rose200,
  },
  planBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  planBadgeTextFeatured: { color: "#fff" },
  planBadgeTextNeutral: { color: Colors.rose400 },

  planRow: { flexDirection: "row", alignItems: "flex-start", paddingRight: 28 },
  planLeft: { flex: 1 },
  planLabel: {
    fontSize: FontSize.base,
    fontWeight: "600",
    color: Colors.gray700,
  },
  planLabelSelected: { color: Colors.gray900 },
  planSub: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 2 },
  planTrial: {
    fontSize: FontSize.xs,
    color: Colors.rose400,
    fontWeight: "600",
    marginTop: 4,
  },
  planRight: { alignItems: "flex-end" },
  planPrice: {
    fontSize: FontSize.xl,
    fontWeight: "800",
    color: Colors.gray600,
  },
  planPriceSelected: { color: Colors.rose400 },
  planPeriod: {
    fontSize: 10,
    color: Colors.gray400,
    marginTop: 2,
    textAlign: "right",
  },

  planRadio: {
    position: "absolute",
    right: 14,
    top: "50%",
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.gray200,
    alignItems: "center",
    justifyContent: "center",
  },
  planRadioSelected: { borderColor: Colors.rose400 },
  planRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.rose400,
  },

  // CTA
  ctaWrapper: { marginTop: Spacing.md, marginBottom: Spacing.lg },
  ctaBtn: {
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: "center",
  },
  ctaText: {
    fontSize: FontSize.base,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  },
  ctaSub: { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 4 },

  // Legal
  legal: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: Spacing.md,
  },
  legalLink: { fontSize: 12, color: Colors.gray400 },
  legalDot: { fontSize: 12, color: Colors.gray300 },
  disclaimer: {
    fontSize: 10,
    color: Colors.gray300,
    textAlign: "center",
    lineHeight: 15,
  },
});
