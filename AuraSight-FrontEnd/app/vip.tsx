import React, { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { ChevronLeft, Check, Sparkles, Crown, Star } from "lucide-react-native";
import { Colors, Gradients, Spacing, Radius, FontSize } from "../constants/theme";
import { useUser } from "../lib/userContext";

const { width } = Dimensions.get("window");

// ─── Features ─────────────────────────────────────────────────
const FEATURES = [
  { icon: "📊", title: "Deep AI skin report", sub: "Weekly cause analysis — weather, diet, hormones, sleep", color: "#FFF0F8", dot: "#F472B6" },
  { icon: "📸", title: "Permanent photo storage", sub: "30-day transformation saved forever across devices", color: "#FFF4F0", dot: "#FB923C" },
  { icon: "🎬", title: "4K timelapse video", sub: "Watch your skin journey in 30 seconds — shareable", color: "#F0FDF8", dot: "#10B981" },
  { icon: "🚫", title: "Zero ads, ever", sub: "Clean experience with zero interruptions", color: "#FFF0FB", dot: "#C084FC" },
  { icon: "🔄", title: "Unlimited history", sub: "Free tier is 30 days — VIP keeps everything forever", color: "#F0F8FF", dot: "#60A5FA" },
];

// ─── Plans ────────────────────────────────────────────────────
const PLANS = [
  {
    id: "annual",
    label: "Annual Plan",
    badge: "BEST VALUE",
    price: "$34.99",
    period: "/year",
    perMonth: "$2.99/mo",
    sub: "Save 40% vs monthly",
    trial: true,
    featured: true,
  },
  {
    id: "monthly",
    label: "Monthly",
    badge: null,
    price: "$4.99",
    period: "/month",
    perMonth: null,
    sub: "Cancel anytime",
    trial: true,
    featured: false,
  },
  {
    id: "challenge",
    label: "30-Day Challenge",
    badge: "ONE-TIME",
    price: "$9.99",
    period: "one-time",
    perMonth: null,
    sub: "Perfect for your first challenge",
    trial: false,
    featured: false,
  },
];

export default function VIPScreen() {
  const [selected, setSelected] = useState("annual");
  const selectedPlan = PLANS.find((p) => p.id === selected)!;
  const { user, setUser } = useUser();

  async function handleSubscribe() {
    // 模拟购买成功 → 写入 VIP 身份（同步到 UserContext + legacy 键）
    await AsyncStorage.setItem("@aurasight_user_mode", "vip");
    if (user) {
      await setUser({ ...user, mode: "vip" });
    }
    Alert.alert(
      "🎉 Welcome to VIP!",
      "Your account has been upgraded. Enjoy unlimited access.",
      [{ text: "Let's go!", onPress: () => router.back() }],
    );
  }

  return (
    <View style={styles.container}>

      {/* ── Hero ─────────────────────────────────────────────── */}
      {/* Rich rose-burgundy gradient: premium but still on-brand */}
      <LinearGradient
        colors={["#C0174D", "#E8336F", "#F472B6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        {/* Decorative glows */}
        <View style={styles.heroGlow1} />
        <View style={styles.heroGlow2} />

        <SafeAreaView edges={["top"]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <View style={styles.backBtnInner}>
              <ChevronLeft size={20} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Crown icon */}
          <View style={styles.crownWrap}>
            <LinearGradient colors={["rgba(255,255,255,0.25)", "rgba(255,255,255,0.1)"]} style={styles.crownBg}>
              <Crown size={28} color="#FDE68A" />
            </LinearGradient>
            {/* Gold sparkle dots */}
            <View style={[styles.sparkle, { top: -4, right: -4 }]}>
              <Text style={styles.sparkleDot}>✦</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>AuraSight VIP</Text>
          <Text style={styles.heroTagline}>
            Your skin transformation,{"\n"}powered by real data.
          </Text>

          {/* Trial pill */}
          <View style={styles.trialPill}>
            <Sparkles size={11} color="#FDE68A" />
            <Text style={styles.trialPillText}>7-day free trial · Cancel anytime</Text>
          </View>

          {/* Social proof */}
          <View style={styles.socialProof}>
            <View style={styles.avatarStack}>
              {["#F472B6", "#C084FC", "#60A5FA"].map((c, i) => (
                <View key={i} style={[styles.proofAvatar, { backgroundColor: c, marginLeft: i > 0 ? -10 : 0, zIndex: 3 - i }]}>
                  <Text style={styles.proofAvatarText}>✦</Text>
                </View>
              ))}
            </View>
            <Text style={styles.socialProofText}>
              Join 2,400+ users transforming their skin
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── Content ───────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}
      >

        {/* ── Plan selector ── */}
        <Text style={styles.sectionLabel}>CHOOSE YOUR PLAN</Text>

        {PLANS.map((plan) => {
          const isSelected = selected === plan.id;
          const isFeatured = plan.featured;

          if (isFeatured) {
            return (
              <TouchableOpacity
                key={plan.id}
                onPress={() => setSelected(plan.id)}
                activeOpacity={0.9}
                style={styles.featuredPlanWrap}
              >
                <LinearGradient
                  colors={isSelected ? ["#F43F8F", "#F472B6"] : ["#F9E0EE", "#FCE7F3"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.featuredPlanGradient}
                >
                  {/* Badge */}
                  <View style={styles.featuredBadge}>
                    <Star size={9} color={isSelected ? "#F43F8F" : "#9CA3AF"} fill={isSelected ? "#F43F8F" : "none"} />
                    <Text style={[styles.featuredBadgeText, !isSelected && { color: "#9CA3AF" }]}>BEST VALUE</Text>
                  </View>

                  <View style={styles.featuredPlanRow}>
                    <View style={styles.featuredPlanLeft}>
                      <Text style={[styles.featuredPlanName, !isSelected && { color: "#6B7280" }]}>Annual Plan</Text>
                      <Text style={[styles.featuredPlanTrial, !isSelected && { color: "#9CA3AF" }]}>
                        ✓ 7-day free trial included
                      </Text>
                      <Text style={[styles.featuredPlanSub, !isSelected && { color: "#9CA3AF" }]}>
                        Save 40% vs monthly
                      </Text>
                    </View>
                    <View style={styles.featuredPlanRight}>
                      <Text style={[styles.featuredPlanPrice, !isSelected && { color: "#1F2937" }]}>$34.99</Text>
                      <Text style={[styles.featuredPlanPeriod, !isSelected && { color: "#9CA3AF" }]}>/year</Text>
                      <Text style={[styles.featuredPlanPerMonth, !isSelected && { color: "#9CA3AF" }]}>$2.99/mo</Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={plan.id}
              onPress={() => setSelected(plan.id)}
              activeOpacity={0.85}
              style={[styles.planCard, isSelected && styles.planCardSelected]}
            >
              {plan.badge && (
                <View style={[styles.planBadge, isSelected && styles.planBadgeActive]}>
                  <Text style={[styles.planBadgeText, isSelected && styles.planBadgeTextActive]}>
                    {plan.badge}
                  </Text>
                </View>
              )}
              <View style={styles.planRow}>
                <View style={styles.planLeft}>
                  <Text style={[styles.planName, isSelected && styles.planNameSelected]}>{plan.label}</Text>
                  {plan.trial && (
                    <Text style={[styles.planTrial, isSelected && { color: "#F472B6" }]}>
                      7-day free trial
                    </Text>
                  )}
                  <Text style={styles.planSub}>{plan.sub}</Text>
                </View>
                <View style={styles.planRight}>
                  <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>{plan.price}</Text>
                  <Text style={styles.planPeriod}>{plan.period}</Text>
                </View>
              </View>
              {/* Radio */}
              <View style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* ── Features ── */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>EVERYTHING INCLUDED</Text>

        <View style={styles.featuresCard}>
          {FEATURES.map((f, i) => (
            <View
              key={i}
              style={[styles.featureRow, i < FEATURES.length - 1 && styles.featureDivider]}
            >
              <View style={[styles.featureIconWrap, { backgroundColor: f.color }]}>
                <Text style={styles.featureEmoji}>{f.icon}</Text>
                <View style={[styles.featureDot, { backgroundColor: f.dot }]} />
              </View>
              <View style={styles.featureTextWrap}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureSub}>{f.sub}</Text>
              </View>
              <View style={styles.featureCheck}>
                <Check size={13} color="#10B981" strokeWidth={3} />
              </View>
            </View>
          ))}
        </View>

        {/* ── CTA ── */}
        <TouchableOpacity onPress={handleSubscribe} activeOpacity={0.88} style={styles.ctaWrap}>
          <LinearGradient
            colors={["#C0174D", "#F43F8F", "#F472B6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaBtn}
          >
            <Crown size={16} color="#FDE68A" />
            <Text style={styles.ctaText}>
              {selectedPlan.trial ? "Start 7-day free trial" : "Start my 30-day challenge"}
            </Text>
            <Text style={styles.ctaArrow}>→</Text>
          </LinearGradient>
          {selectedPlan.trial ? (
            <Text style={styles.ctaDisclaimer}>
              Free for 7 days · then {selectedPlan.price}{selectedPlan.period} · auto-renews · cancel anytime
            </Text>
          ) : (
            <Text style={styles.ctaDisclaimer}>One-time payment · no subscription</Text>
          )}
        </TouchableOpacity>

        {/* ── Legal ── */}
        <View style={styles.legalRow}>
          <TouchableOpacity><Text style={styles.legalLink}>Restore purchase</Text></TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity><Text style={styles.legalLink}>Terms</Text></TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity><Text style={styles.legalLink}>Privacy</Text></TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          Subscriptions auto-renew unless cancelled at least 24 hours before the renewal date.
          Manage in App Store settings.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF5F8" },

  // ── Hero
  hero: {
    paddingBottom: 28,
    overflow: "hidden",
    position: "relative",
  },
  heroGlow1: {
    position: "absolute",
    width: 260, height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255,255,255,0.07)",
    top: -80, right: -60,
  },
  heroGlow2: {
    position: "absolute",
    width: 140, height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.05)",
    bottom: -20, left: 20,
  },

  backBtn: { paddingHorizontal: 20, paddingTop: 10, marginBottom: 16 },
  backBtnInner: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },

  crownWrap: { marginLeft: 24, marginBottom: 14, position: "relative", alignSelf: "flex-start" },
  crownBg: {
    width: 60, height: 60,
    borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  sparkle: { position: "absolute" },
  sparkleDot: { fontSize: 12, color: "#FDE68A" },

  heroTitle: {
    fontSize: 30, fontWeight: "800", color: "#fff",
    paddingHorizontal: 24, letterSpacing: -0.5, marginBottom: 6,
  },
  heroTagline: {
    fontSize: 14, color: "rgba(255,255,255,0.75)",
    paddingHorizontal: 24, lineHeight: 21, marginBottom: 16,
  },

  trialPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: 24,
    backgroundColor: "rgba(253,230,138,0.2)",
    borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.3)",
    marginBottom: 16,
  },
  trialPillText: { fontSize: 11, color: "#FDE68A", fontWeight: "700" },

  socialProof: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 24 },
  avatarStack: { flexDirection: "row" },
  proofAvatar: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)",
  },
  proofAvatarText: { fontSize: 8, color: "#fff" },
  socialProofText: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: "500" },

  // ── Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 10, fontWeight: "700", color: "#9CA3AF",
    letterSpacing: 1.2, marginBottom: 12,
  },

  // ── Featured Plan Card
  featuredPlanWrap: { marginBottom: 8, borderRadius: 20, overflow: "hidden" },
  featuredPlanGradient: { borderRadius: 20, padding: 18 },
  featuredBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
    marginBottom: 12,
  },
  featuredBadgeText: { fontSize: 9, fontWeight: "800", color: "#F43F8F", letterSpacing: 0.5 },
  featuredPlanRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  featuredPlanLeft: { flex: 1 },
  featuredPlanName: { fontSize: 16, fontWeight: "700", color: "#fff", marginBottom: 4 },
  featuredPlanTrial: { fontSize: 11, color: "rgba(255,255,255,0.9)", fontWeight: "600", marginBottom: 2 },
  featuredPlanSub: { fontSize: 11, color: "rgba(255,255,255,0.7)" },
  featuredPlanRight: { alignItems: "flex-end" },
  featuredPlanPrice: { fontSize: 28, fontWeight: "800", color: "#fff", lineHeight: 30 },
  featuredPlanPeriod: { fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 1 },
  featuredPlanPerMonth: { fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 },

  // ── Regular Plan Cards
  planCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "#F3F4F6",
    position: "relative",
    shadowColor: "#F0ABCA",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  planCardSelected: { borderColor: "#F472B6", backgroundColor: "#FFF8FC" },
  planBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F3F4F6",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
    marginBottom: 8,
  },
  planBadgeActive: { backgroundColor: "#FFF0F8" },
  planBadgeText: { fontSize: 9, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.5 },
  planBadgeTextActive: { color: "#F472B6" },
  planRow: { flexDirection: "row", alignItems: "flex-start", paddingRight: 32 },
  planLeft: { flex: 1 },
  planName: { fontSize: 14, fontWeight: "600", color: "#6B7280", marginBottom: 2 },
  planNameSelected: { color: "#1F2937" },
  planTrial: { fontSize: 10, color: "#9CA3AF", fontWeight: "600", marginBottom: 2 },
  planSub: { fontSize: 10, color: "#9CA3AF" },
  planRight: { alignItems: "flex-end" },
  planPrice: { fontSize: 20, fontWeight: "800", color: "#1F2937" },
  planPriceSelected: { color: "#F472B6" },
  planPeriod: { fontSize: 10, color: "#9CA3AF", marginTop: 1 },

  radio: {
    position: "absolute", right: 14, top: "50%",
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: "#D1D5DB",
    alignItems: "center", justifyContent: "center",
  },
  radioSelected: { borderColor: "#F472B6" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#F472B6" },

  // ── Features Card
  featuresCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#F0ABCA",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F9E0EE",
  },
  featureRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10,
  },
  featureDivider: { borderBottomWidth: 1, borderBottomColor: "#FFF0F8" },
  featureIconWrap: {
    width: 40, height: 40,
    borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0, position: "relative",
  },
  featureEmoji: { fontSize: 18 },
  featureDot: {
    position: "absolute", top: 4, right: 4,
    width: 6, height: 6, borderRadius: 3,
  },
  featureTextWrap: { flex: 1 },
  featureTitle: { fontSize: 13, fontWeight: "600", color: "#1F2937", marginBottom: 2 },
  featureSub: { fontSize: 10, color: "#9CA3AF", lineHeight: 14 },
  featureCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#ECFDF5",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },

  // ── CTA
  ctaWrap: { marginBottom: 20 },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10,
    borderRadius: 100,
    paddingVertical: 17,
    marginBottom: 10,
    shadowColor: "#F43F8F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  ctaText: { fontSize: 15, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },
  ctaArrow: { fontSize: 16, color: "#fff", fontWeight: "700" },
  ctaDisclaimer: { fontSize: 10, color: "#9CA3AF", textAlign: "center", lineHeight: 15 },

  // ── Legal
  legalRow: {
    flexDirection: "row", justifyContent: "center",
    alignItems: "center", gap: 8, marginBottom: 10,
  },
  legalLink: { fontSize: 11, color: "#9CA3AF" },
  legalDot: { fontSize: 11, color: "#D1D5DB" },
  disclaimer: { fontSize: 10, color: "#C4C9D4", textAlign: "center", lineHeight: 14 },
});
