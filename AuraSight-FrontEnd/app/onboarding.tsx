import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
  StatusBar,
  Easing,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useT } from "../lib/i18n";
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from "react-native-svg";

const { width, height } = Dimensions.get("window");
const DOT_SIZE = 6;
const DOT_GAP = 12;

// ═══════════════════════════════════════════════════════════════
// PAGE CONTENT — 3 pages: Hook → Proof → CTA
// ═══════════════════════════════════════════════════════════════
type PageDef = {
  id: string;
  eyebrow: string;
  titleLines: [string, string];
  sub: string;
  hero: "hook" | "features" | "cta";
};

const PAGES: PageDef[] = [
  {
    id: "hook",
    eyebrow: "AI SKIN SCAN",
    titleLines: ["Snap a photo,", "get instant analysis."],
    sub: "Point your camera at any area of concern. Our AI identifies and locates acne in real time — no appointment needed.",
    hero: "hook",
  },
  {
    id: "features",
    eyebrow: "EVERYTHING YOU NEED",
    titleLines: ["Built for your", "skin journey."],
    sub: "",
    hero: "features",
  },
  {
    id: "cta",
    eyebrow: "",
    titleLines: ["Start with", "one scan."],
    sub: "Your first scan is free — no account required. Sign up to save your history and track progress over time.",
    hero: "cta",
  },
];

// Color palette — slightly refined for a calmer feel
const C = {
  ink: "#1a1530",
  inkSoft: "rgba(26,21,48,0.55)",
  inkMuted: "rgba(26,21,48,0.35)",
  accent: "#b77cff",
  accent2: "#ff9fc2",
  accent3: "#7ec8ff",
};

// ═══════════════════════════════════════════════════════════════
// HERO: Hook — portrait with scan rings
// ═══════════════════════════════════════════════════════════════
function HeroHook() {
  const pulseRing = useRef(new Animated.Value(1)).current;
  const rotOuter = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const sweepY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRing, {
          toValue: 1.04,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseRing, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotOuter, {
        toValue: 1,
        duration: 24000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(sweepY, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sweepY, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const sweepTranslate = sweepY.interpolate({ inputRange: [0, 1], outputRange: [-130, 130] });
  const sweepOpacity = sweepY.interpolate({ inputRange: [0, 0.12, 0.88, 1], outputRange: [0, 1, 1, 0] });
  const rotate = rotOuter.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] });

  const CENTER = 160;
  const R_OUTER = 150;
  const R_INNER = 134;

  return (
    <View style={heroSt.wrap}>
      <Animated.View style={[heroSt.glow, { opacity: glowOpacity }]} />

      {/* Outer dashed ring */}
      <Animated.View style={[heroSt.ringSvg, { transform: [{ rotate }] }]}>
        <Svg width={320} height={320}>
          <Defs>
            <SvgLinearGradient id="outerStroke" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#c9a4ff" stopOpacity="0.7" />
              <Stop offset="1" stopColor="#ff9fc2" stopOpacity="0.7" />
            </SvgLinearGradient>
          </Defs>
          <Circle cx={CENTER} cy={CENTER} r={R_OUTER} stroke="url(#outerStroke)" strokeWidth={1.2} strokeDasharray="4 10" fill="none" />
        </Svg>
      </Animated.View>

      {/* Inner ring — gentle pulse */}
      <Animated.View style={[heroSt.ringSvg, { transform: [{ scale: pulseRing }] }]}>
        <Svg width={320} height={320}>
          <Defs>
            <SvgLinearGradient id="innerStroke" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#b77cff" stopOpacity="0.8" />
              <Stop offset="1" stopColor="#ff5e8e" stopOpacity="0.6" />
            </SvgLinearGradient>
          </Defs>
          <Circle cx={CENTER} cy={CENTER} r={R_INNER} stroke="url(#innerStroke)" strokeWidth={1.2} fill="none" />
        </Svg>
      </Animated.View>

      {/* Portrait + scan sweep */}
      <View style={heroSt.faceOval}>
        <Image
          source={require("../assets/images/hero-portrait.png")}
          style={heroSt.faceImg}
          resizeMode="contain"
        />
        <Animated.View
          style={[
            heroSt.sweep,
            { transform: [{ translateY: sweepTranslate }], opacity: sweepOpacity },
          ]}
        />
        <View style={[heroSt.dot, { top: "30%", left: "55%" }]} />
        <View style={[heroSt.dot, { top: "50%", left: "34%" }]} />
        <View style={[heroSt.dot, { top: "65%", left: "50%" }]} />
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// HERO: Features — multi-feature showcase cards
// ═══════════════════════════════════════════════════════════════
const FEATURES = [
  {
    icon: "🔬",
    title: "Clinical-Grade Detection",
    desc: "Identifies 4 acne types: comedones, papules, pustules & nodules",
    colors: ["#b77cff", "#9b6ee8"] as const,
  },
  {
    icon: "📊",
    title: "Progress Tracking",
    desc: "Scan daily — watch trends emerge and see real improvement over time",
    colors: ["#ff9fc2", "#ff7ba8"] as const,
  },
  {
    icon: "💬",
    title: "Community",
    desc: "Share tips, ask questions, and learn from others on the same journey",
    colors: ["#7ec8ff", "#5ba8e8"] as const,
  },
  {
    icon: "📝",
    title: "Skin Diary",
    desc: "Log triggers like diet, sleep & stress — discover what affects your skin",
    colors: ["#6ee8a0", "#4dc882"] as const,
  },
];

function HeroFeatures() {
  const anims = useRef(FEATURES.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      100,
      anims.map((a) =>
        Animated.spring(a, { toValue: 1, tension: 120, friction: 12, useNativeDriver: true })
      )
    ).start();
  }, []);

  return (
    <View style={heroSt.featuresGrid}>
      {FEATURES.map((f, i) => {
        const translateY = anims[i].interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
        return (
          <Animated.View key={i} style={[heroSt.featureCard, { opacity: anims[i], transform: [{ translateY }] }]}>
            <LinearGradient colors={f.colors} style={heroSt.featureIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={{ fontSize: 20 }}>{f.icon}</Text>
            </LinearGradient>
            <Text style={heroSt.featureTitle}>{f.title}</Text>
            <Text style={heroSt.featureDesc}>{f.desc}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// HERO: CTA — clean camera icon card
// ═══════════════════════════════════════════════════════════════
function HeroCTA() {
  const shimmer = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(shimmer, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(2000),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-90, 90] });
  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 0.25, 0.75, 1], outputRange: [0, 0.85, 0.85, 0] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  return (
    <View style={heroSt.ctaCard}>
      <Animated.View style={{ transform: [{ translateY: bobY }] }}>
        <LinearGradient
          colors={["#b77cff", "#ff9fc2"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={heroSt.ctaIcon}
        >
          <Animated.View
            style={[
              heroSt.ctaShimmer,
              { opacity: shimmerOpacity, transform: [{ translateX: shimmerX }, { rotate: "20deg" }] },
            ]}
          />
          <Svg width="36" height="36" viewBox="0 0 24 24">
            <Path
              d="M6.5 7 L8.2 4.8 H15.8 L17.5 7 H20 A2 2 0 0 1 22 9 V18 A2 2 0 0 1 20 20 H4 A2 2 0 0 1 2 18 V9 A2 2 0 0 1 4 7 Z"
              fill="#fff"
              opacity="0.97"
            />
            <Circle cx="12" cy="13.5" r="3.8" fill="none" stroke="#b77cff" strokeWidth="1.6" />
            <Circle cx="12" cy="13.5" r="1.9" fill="#b77cff" opacity="0.9" />
            <Circle cx="18.5" cy="10" r="0.9" fill="#ff9fc2" />
          </Svg>
        </LinearGradient>
      </Animated.View>

      <Text style={heroSt.ctaTitle}>Try it in 30 seconds</Text>
      <Text style={heroSt.ctaSub}>
        No signup needed to scan.{"\n"}Your first analysis is free.
      </Text>
      <View style={heroSt.trustRow}>
        <Text style={heroSt.trustItem}>On-device AI</Text>
        <View style={heroSt.trustDot} />
        <Text style={heroSt.trustItem}>No ads</Text>
        <View style={heroSt.trustDot} />
        <Text style={heroSt.trustItem}>Private by default</Text>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE WRAPPER
// ═══════════════════════════════════════════════════════════════
function OnboardingPage({
  page,
  isVisible,
  index,
  scrollX,
}: {
  page: PageDef;
  isVisible: boolean;
  index: number;
  scrollX: Animated.Value;
}) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const riseY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(riseY, { toValue: 0, tension: 160, friction: 12, useNativeDriver: true }),
      ]).start();
    } else {
      fadeIn.setValue(0);
      riseY.setValue(30);
    }
  }, [isVisible]);

  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
  const pageOpacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: "clamp" });
  const pageScale = scrollX.interpolate({ inputRange, outputRange: [0.94, 1, 0.94], extrapolate: "clamp" });

  let hero: React.ReactNode = null;
  if (page.hero === "hook") hero = <HeroHook />;
  else if (page.hero === "features") hero = <HeroFeatures />;
  else hero = <HeroCTA />;

  const centerText = page.hero === "cta";

  return (
    <Animated.View
      style={[st.page, { width, opacity: pageOpacity, transform: [{ scale: pageScale }] }]}
    >
      <View style={st.heroArea}>{hero}</View>

      <Animated.View
        style={[
          st.textBlock,
          centerText && { alignItems: "center" },
          { opacity: fadeIn, transform: [{ translateY: riseY }] },
        ]}
      >
        {page.eyebrow ? (
          <View style={st.eyebrowWrap}>
            <Text style={st.eyebrow}>{page.eyebrow}</Text>
          </View>
        ) : null}
        <Text style={[st.headline, centerText && { textAlign: "center" }]}>
          {page.titleLines[0]}
          {"\n"}
          <Text style={st.headlineAccent}>{page.titleLines[1]}</Text>
        </Text>
        {page.sub ? (
          <Text style={[st.sub, centerText && { textAlign: "center" }]}>{page.sub}</Text>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════
export default function OnboardingScreen() {
  const { t } = useT();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    StatusBar.setBarStyle("dark-content");
    if (Platform.OS === "android") {
      StatusBar.setBackgroundColor("transparent");
      StatusBar.setTranslucent(true);
    }
  }, []);

  function handleScroll(e: any) {
    const page = Math.round(e.nativeEvent.contentOffset.x / width);
    if (page !== currentPage) {
      setCurrentPage(page);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  async function finish(target: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem("@aurasight_onboarding_done", "true");
    router.replace(target as any);
  }

  function handleContinue() {
    if (currentPage < PAGES.length - 1) {
      scrollRef.current?.scrollTo({ x: (currentPage + 1) * width, animated: true });
    }
  }

  const isLast = currentPage === PAGES.length - 1;

  return (
    <View style={st.container}>
      {/* Background — clean subtle gradient */}
      <LinearGradient
        colors={["#FEFAFF", "#F6F0FF", "#F0F4FF"]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Minimal ambient blobs */}
      <View style={[st.blob, st.blobPink]} />
      <View style={[st.blob, st.blobLav]} />

      {/* Skip (only on non-last pages) */}
      {!isLast && (
        <SafeAreaView style={st.skipWrap} pointerEvents="box-none">
          <TouchableOpacity
            onPress={() => finish("/(tabs)")}
            activeOpacity={0.7}
            style={st.skipBtn}
          >
            <Text style={st.skipText}>{t("onboarding.skip")}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}

      {/* Pages */}
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {PAGES.map((p, i) => (
          <OnboardingPage key={p.id} page={p} isVisible={currentPage === i} index={i} scrollX={scrollX} />
        ))}
      </Animated.ScrollView>

      {/* Footer: dots + buttons */}
      <SafeAreaView style={st.footer}>
        {/* Dot indicators */}
        <View style={st.dotRow}>
          {PAGES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const scaleX = scrollX.interpolate({ inputRange, outputRange: [1, 3, 1], extrapolate: "clamp" });
            const opacity = scrollX.interpolate({ inputRange, outputRange: [0.25, 1, 0.25], extrapolate: "clamp" });
            return (
              <Animated.View
                key={i}
                style={[st.dotBase, { opacity, transform: [{ scaleX }] }]}
              />
            );
          })}
        </View>

        <View style={st.btnArea}>
          {!isLast ? (
            /* Non-last: single "Next" button */
            <TouchableOpacity onPress={handleContinue} activeOpacity={0.85} style={st.btnShadow}>
              <LinearGradient
                colors={["#b77cff", "#ff9fc2"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={st.btnMain}
              >
                <Text style={st.btnMainText}>{t("onboarding.next")}</Text>
                <Text style={st.btnArrow}>→</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            /* Last page: Get Started + Continue as Guest */
            <View style={st.ctaGroup}>
              <TouchableOpacity
                onPress={() => finish("/(tabs)/profile")}
                activeOpacity={0.85}
                style={st.btnShadow}
              >
                <LinearGradient
                  colors={["#b77cff", "#ff9fc2"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={st.btnMain}
                >
                  <Text style={st.btnMainText}>{t("onboarding.getStarted")}</Text>
                  <Text style={st.btnArrow}>→</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => finish("/(tabs)")}
                activeOpacity={0.7}
                style={st.btnSecondary}
              >
                <Text style={st.btnSecondaryText}>Continue as Guest</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLES — cleaner, more whitespace, Apple/Calm aesthetic
// ═══════════════════════════════════════════════════════════════
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FEFAFF" },

  blob: {
    position: "absolute",
    borderRadius: 9999,
  },
  blobPink: {
    width: 280,
    height: 280,
    backgroundColor: "#ff9fc2",
    top: -120,
    left: -100,
    opacity: 0.12,
  },
  blobLav: {
    width: 220,
    height: 220,
    backgroundColor: "#b77cff",
    bottom: 100,
    right: -100,
    opacity: 0.1,
  },

  skipWrap: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 10,
  },
  skipBtn: {
    marginTop: 12,
    marginRight: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(26,21,48,0.04)",
  },
  skipText: {
    fontSize: 14,
    color: C.inkMuted,
    fontWeight: "500",
  },

  page: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 200,
    justifyContent: "space-between",
  },
  heroArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  textBlock: {
    alignItems: "flex-start",
  },
  eyebrowWrap: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(183,124,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 14,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.4,
    color: C.accent,
  },
  headline: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    color: C.ink,
    lineHeight: 40,
    marginBottom: 12,
  },
  headlineAccent: {
    color: C.accent,
  },
  sub: {
    fontSize: 16,
    lineHeight: 24,
    color: C.inkSoft,
    fontWeight: "400",
  },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: 32,
  },
  dotRow: {
    flexDirection: "row",
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
    height: DOT_SIZE + 4,
    gap: DOT_GAP,
  },
  dotBase: {
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: C.accent,
  },
  btnArea: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  btnShadow: {
    width: "100%",
    shadowColor: "#b77cff",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  btnMain: {
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnMainText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  btnArrow: {
    color: "#fff",
    fontSize: 18,
    marginLeft: 8,
    fontWeight: "600",
  },
  ctaGroup: {
    width: "100%",
    gap: 4,
  },
  btnSecondary: {
    paddingVertical: 14,
    alignItems: "center",
  },
  btnSecondaryText: {
    color: C.inkSoft,
    fontSize: 15,
    fontWeight: "500",
  },
});

// ── Hero styles ──
const heroSt = StyleSheet.create({
  wrap: {
    width: 320,
    height: 320,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ringSvg: {
    position: "absolute",
    width: 320,
    height: 320,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#ece0ff",
    shadowColor: "#b77cff",
    shadowOpacity: 0.4,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: 0 },
  },
  faceOval: {
    width: 260,
    height: 260,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  faceImg: {
    width: "100%",
    height: "100%",
  },
  sweep: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: "rgba(183,124,255,0.35)",
    shadowColor: "#b77cff",
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  dot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ff5e8e",
    shadowColor: "#ff5e8e",
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },

  // Features grid (2x2)
  featuresGrid: {
    width: width - 48,
    maxWidth: 340,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  featureCard: {
    width: (width - 48 - 10) / 2,
    maxWidth: 165,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    borderRadius: 18,
    padding: 16,
    shadowColor: "rgba(0,0,0,0.05)",
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: C.ink,
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 11,
    color: C.inkMuted,
    lineHeight: 15,
  },

  // CTA card
  ctaCard: {
    width: width - 72,
    maxWidth: 300,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "rgba(0,0,0,0.05)",
    shadowOpacity: 1,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  ctaIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ctaShimmer: {
    position: "absolute",
    width: 24,
    height: 100,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 12,
  },
  ctaTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.ink,
    marginBottom: 6,
    textAlign: "center",
  },
  ctaSub: {
    fontSize: 13,
    color: C.inkSoft,
    lineHeight: 19,
    textAlign: "center",
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
  },
  trustItem: {
    fontSize: 11,
    color: C.inkMuted,
    fontWeight: "500",
  },
  trustDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: C.inkMuted,
  },
});
