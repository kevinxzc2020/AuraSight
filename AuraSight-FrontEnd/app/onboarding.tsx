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
import Svg, {
  Path,
  Circle,
  Ellipse,
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Stop,
  Line,
  G,
} from "react-native-svg";

const { width, height } = Dimensions.get("window");
const SPRING = { tension: 180, friction: 12, useNativeDriver: true };
const DOT_SIZE = 7;
const DOT_GAP = 10;

// ═════════════════════════════════════════════════════════════
// PAGE CONTENT
// ═════════════════════════════════════════════════════════════
type PageDef = {
  id: string;
  eyebrow: string;
  titleLines: [string, string]; // plain + accent
  sub: string;
  hero: "hook" | "proof" | "progress" | "cta";
};

const PAGES: PageDef[] = [
  {
    id: "hook",
    eyebrow: "AI SKIN INTELLIGENCE",
    titleLines: ["See what", "mirrors miss."],
    sub: "Your skin tells a story. Our AI reads every word — in 30 seconds.",
    hero: "hook",
  },
  {
    id: "proof",
    eyebrow: "CLINICAL-GRADE DETECTION",
    titleLines: ["4 lesion types,", "counted."],
    sub: 'Not just "you have acne." Medical-level breakdown, tracked scan by scan.',
    hero: "proof",
  },
  {
    id: "progress",
    eyebrow: "PATTERNS THAT MATTER",
    titleLines: ["Your skin,", "day by day."],
    sub: "Scan daily. Watch trends emerge. Small changes add up to real ones.",
    hero: "progress",
  },
  {
    id: "cta",
    eyebrow: "",
    titleLines: ["Start with", "one scan."],
    sub: "",
    hero: "cta",
  },
];

// Color palette
const C = {
  ink: "#1a1530",
  inkSoft: "rgba(26,21,48,0.62)",
  inkMuted: "rgba(26,21,48,0.42)",
  accent: "#b77cff",
  accent2: "#ff9fc2",
  accent3: "#7ec8ff",
  glassBg: "rgba(255,255,255,0.55)",
  glassBr: "rgba(255,255,255,0.65)",
};

// ═════════════════════════════════════════════════════════════
// HERO COMPONENTS (one per page)
// ═════════════════════════════════════════════════════════════

// Page 1: Portrait + layered scan rings (radial glow, rotating dashed outer,
// gradient middle, pulsing inner)
function HeroHook() {
  const pulseMid = useRef(new Animated.Value(1)).current;
  const pulseInner = useRef(new Animated.Value(1)).current;
  const rotOuter = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const sweepY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const mkPulse = (v: Animated.Value, delay: number, peak: number, dur: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: peak,
            duration: dur,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 1,
            duration: dur,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    mkPulse(pulseMid, 0, 1.05, 2200).start();
    mkPulse(pulseInner, 700, 1.035, 1800).start();

    // Glow fade in/out
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Slow rotation for outer dashed ring
    Animated.loop(
      Animated.timing(rotOuter, {
        toValue: 1,
        duration: 22000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Scan sweep
    Animated.loop(
      Animated.sequence([
        Animated.timing(sweepY, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sweepY, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const sweepTranslate = sweepY.interpolate({
    inputRange: [0, 1],
    outputRange: [-145, 145],
  });
  const sweepOpacity = sweepY.interpolate({
    inputRange: [0, 0.15, 0.85, 1],
    outputRange: [0, 1, 1, 0],
  });
  const rotate = rotOuter.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  });

  // Ring sizes (svg canvas 360x360 matches wrap)
  const C_ = 180; // center
  const R_OUTER = 170;
  const R_MID = 152;
  const R_INNER = 135;

  return (
    <View style={heroSt.wrap}>
      {/* Radial glow behind face */}
      <Animated.View style={[heroSt.glow, { opacity: glowOpacity }]} />

      {/* Outer dashed ring — slow rotating */}
      <Animated.View style={[heroSt.ringSvg, { transform: [{ rotate }] }]}>
        <Svg width={360} height={360}>
          <Defs>
            <SvgLinearGradient id="outerStroke" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#c9a4ff" stopOpacity="0.9" />
              <Stop offset="1" stopColor="#ff9fc2" stopOpacity="0.9" />
            </SvgLinearGradient>
          </Defs>
          <Circle
            cx={C_}
            cy={C_}
            r={R_OUTER}
            stroke="url(#outerStroke)"
            strokeWidth={1.5}
            strokeDasharray="4 8"
            fill="none"
            opacity={0.85}
          />
        </Svg>
      </Animated.View>

      {/* Middle gradient ring — gentle pulse */}
      <Animated.View style={[heroSt.ringSvg, { transform: [{ scale: pulseMid }] }]}>
        <Svg width={360} height={360}>
          <Defs>
            <SvgLinearGradient id="midStroke" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#b77cff" stopOpacity="1" />
              <Stop offset="1" stopColor="#ff5e8e" stopOpacity="0.9" />
            </SvgLinearGradient>
          </Defs>
          <Circle
            cx={C_}
            cy={C_}
            r={R_MID}
            stroke="url(#midStroke)"
            strokeWidth={1.4}
            fill="none"
            opacity={0.8}
          />
        </Svg>
      </Animated.View>

      {/* Inner ring hugging face — brighter pulse */}
      <Animated.View style={[heroSt.ringSvg, { transform: [{ scale: pulseInner }] }]}>
        <Svg width={360} height={360}>
          <Circle
            cx={C_}
            cy={C_}
            r={R_INNER}
            stroke="#ff6fa3"
            strokeWidth={1.8}
            fill="none"
            opacity={0.85}
          />
        </Svg>
      </Animated.View>

      {/* Portrait + scan sweep */}
      <View style={heroSt.faceOval}>
        <Image
          source={require("../assets/images/hero-portrait.png")}
          style={heroSt.faceImg}
          resizeMode="contain"
        />

        {/* Scan sweep bar */}
        <Animated.View
          style={[
            heroSt.sweep,
            {
              transform: [{ translateY: sweepTranslate }],
              opacity: sweepOpacity,
            },
          ]}
        />

        {/* Detection dots — positioned relative to face */}
        <View style={[heroSt.dot, { top: "28%", left: "55%" }]} />
        <View style={[heroSt.dot, { top: "48%", left: "35%" }]} />
        <View style={[heroSt.dot, { top: "52%", left: "68%" }]} />
        <View style={[heroSt.dot, { top: "68%", left: "48%" }]} />
      </View>
    </View>
  );
}

// Page 2: Proof — stack of 4 detection class cards with stagger entry + SVG glyphs
function LesionGlyph({ type, size = 20 }: { type: "comedone" | "papule" | "pustule" | "nodule"; size?: number }) {
  const c = "#ffffff";
  if (type === "comedone") {
    // Small dark dot in a ring — blackhead
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.6" fill="none" opacity="0.5" />
        <Circle cx="12" cy="12" r="3.5" fill={c} />
      </Svg>
    );
  }
  if (type === "papule") {
    // Raised bump
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M4 17 Q12 4 20 17" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <Circle cx="12" cy="11" r="3" fill={c} opacity="0.9" />
      </Svg>
    );
  }
  if (type === "pustule") {
    // Filled bump with center dot (pus)
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="7" fill={c} opacity="0.4" />
        <Circle cx="12" cy="12" r="4.5" fill={c} />
        <Circle cx="12" cy="12" r="1.5" fill="#ff5e8e" />
      </Svg>
    );
  }
  // nodule — deep, concentric
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.4" fill="none" opacity="0.55" />
      <Circle cx="12" cy="12" r="6" stroke={c} strokeWidth="1.4" fill="none" opacity="0.75" />
      <Circle cx="12" cy="12" r="3" fill={c} />
    </Svg>
  );
}

function HeroProof() {
  const classes = [
    {
      type: "comedone" as const,
      name: "Comedones",
      desc: "Blackheads & whiteheads",
      count: 12,
      total: 15,
      colors: ["#b77cff", "#9b6ee8"] as const,
    },
    {
      type: "papule" as const,
      name: "Papules",
      desc: "Red inflamed bumps",
      count: 5,
      total: 15,
      colors: ["#ff9fc2", "#ff7ba8"] as const,
    },
    {
      type: "pustule" as const,
      name: "Pustules",
      desc: "Pus-filled lesions",
      count: 2,
      total: 15,
      colors: ["#ff6b9d", "#ff3d81"] as const,
    },
    {
      type: "nodule" as const,
      name: "Nodules",
      desc: "Deep severe lesions",
      count: 0,
      total: 15,
      colors: ["#7ec8ff", "#5ba8e8"] as const,
    },
  ];

  // Stagger entry animation
  const anims = useRef(classes.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      90,
      anims.map((a) =>
        Animated.spring(a, { toValue: 1, tension: 120, friction: 11, useNativeDriver: true })
      )
    ).start();
  }, []);

  return (
    <View style={heroSt.proofStack}>
      {classes.map((c, i) => {
        const translateY = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        });
        const opacity = anims[i];
        const barWidth = `${Math.max(4, (c.count / c.total) * 100)}%` as const;
        return (
          <Animated.View
            key={i}
            style={[heroSt.proofCard, { opacity, transform: [{ translateY }] }]}
          >
            <LinearGradient
              colors={c.colors}
              style={heroSt.proofDot}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <LesionGlyph type={c.type} size={18} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={heroSt.proofName}>{c.name}</Text>
              <Text style={heroSt.proofDesc}>{c.desc}</Text>
              {/* Confidence / proportion bar */}
              <View style={heroSt.proofBarBg}>
                <LinearGradient
                  colors={c.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[heroSt.proofBarFg, { width: barWidth }]}
                />
              </View>
            </View>
            <View style={{ alignItems: "flex-end", minWidth: 44 }}>
              <Text style={heroSt.proofCount}>{c.count}</Text>
              <Text style={heroSt.proofUnit}>detected</Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

// Page 3: Progress — trend chart with animated path drawing + glowing endpoint
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const LINE_D = "M0,22 C30,30 50,18 80,40 C110,55 130,42 160,68 C190,85 210,78 260,100";
const LINE_LEN = 320; // approximate path length for stroke-dash animation

function HeroProgress() {
  const draw = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(draw, {
      toValue: 1,
      duration: 1600,
      delay: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const dashOffset = draw.interpolate({
    inputRange: [0, 1],
    outputRange: [LINE_LEN, 0],
  });
  const endR = pulse.interpolate({ inputRange: [0, 1], outputRange: [5, 8] });
  const endOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.15] });
  const areaOpacity = draw.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] });

  return (
    <View style={heroSt.progressCard}>
      <View style={heroSt.pcHeader}>
        <Text style={heroSt.pcLabel}>INFLAMMATION · 14 DAYS</Text>
        <View style={heroSt.winChip}>
          <Text style={heroSt.winChipText}>↓ 42%</Text>
        </View>
      </View>

      <View style={heroSt.chart}>
        <Svg width="100%" height="100%" viewBox="0 0 260 120" preserveAspectRatio="none">
          <Defs>
            <SvgLinearGradient id="areaG" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor="#b77cff" stopOpacity="0.45" />
              <Stop offset="1" stopColor="#b77cff" stopOpacity="0" />
            </SvgLinearGradient>
            <SvgLinearGradient id="lineG" x1="0" x2="1" y1="0" y2="0">
              <Stop offset="0" stopColor="#b77cff" />
              <Stop offset="1" stopColor="#ff9fc2" />
            </SvgLinearGradient>
          </Defs>

          {/* Grid lines */}
          <Line x1="0" y1="30" x2="260" y2="30" stroke="rgba(26,21,48,0.08)" strokeDasharray="2,4" />
          <Line x1="0" y1="60" x2="260" y2="60" stroke="rgba(26,21,48,0.08)" strokeDasharray="2,4" />
          <Line x1="0" y1="90" x2="260" y2="90" stroke="rgba(26,21,48,0.08)" strokeDasharray="2,4" />

          {/* Filled area appears after line draws */}
          <AnimatedPath
            d="M0,22 C30,30 50,18 80,40 C110,55 130,42 160,68 C190,85 210,78 260,100 L260,120 L0,120 Z"
            fill="url(#areaG)"
            opacity={areaOpacity as any}
          />

          {/* Animated line drawing */}
          <AnimatedPath
            d={LINE_D}
            fill="none"
            stroke="url(#lineG)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={LINE_LEN}
            strokeDashoffset={dashOffset as any}
          />

          {/* Start point */}
          <Circle cx="0" cy="22" r="4" fill="#b77cff" />

          {/* End point — pulsing glow halo + solid center */}
          <AnimatedCircle cx="260" cy="100" r={endR as any} fill="#ff9fc2" opacity={endOpacity as any} />
          <Circle cx="260" cy="100" r="5" fill="#ff9fc2" stroke="#fff" strokeWidth="2" />
        </Svg>
      </View>

      <View style={heroSt.pcStats}>
        <View style={heroSt.statCol}>
          <Text style={heroSt.statNum}>19</Text>
          <Text style={heroSt.statName}>Day 1</Text>
        </View>
        <View style={heroSt.statCol}>
          <Text style={[heroSt.statNum, { color: "#b77cff" }]}>14</Text>
          <Text style={heroSt.statName}>Day 7</Text>
        </View>
        <View style={heroSt.statCol}>
          <Text style={[heroSt.statNum, { color: "#10b981" }]}>11</Text>
          <Text style={heroSt.statName}>Today</Text>
        </View>
      </View>
    </View>
  );
}

// Page 4: CTA card — SVG camera icon with shimmer sweep
function HeroCTA() {
  const shimmer = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(shimmer, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(1600),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-90, 90] });
  const shimmerOpacity = shimmer.interpolate({
    inputRange: [0, 0.25, 0.75, 1],
    outputRange: [0, 0.9, 0.9, 0],
  });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  return (
    <View style={heroSt.ctaCard}>
      <Animated.View style={{ transform: [{ translateY: bobY }] }}>
        <LinearGradient
          colors={["#b77cff", "#ff9fc2"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={heroSt.ctaIcon}
        >
          {/* Shimmer sweep behind the icon glyph */}
          <Animated.View
            style={[
              heroSt.ctaShimmer,
              { opacity: shimmerOpacity, transform: [{ translateX: shimmerX }, { rotate: "20deg" }] },
            ]}
          />
          {/* Camera SVG */}
          <Svg width="38" height="38" viewBox="0 0 24 24">
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
        No signup needed to start.{"\n"}Your first scan is on us.
      </Text>
      <View style={heroSt.trustRow}>
        <Text style={heroSt.trustItem}>✓ On-device AI</Text>
        <Text style={heroSt.trustItem}>✓ No ads</Text>
        <Text style={heroSt.trustItem}>✓ Your data</Text>
      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════
// PAGE WRAPPER
// ═════════════════════════════════════════════════════════════
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
  const riseY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeIn, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(riseY, { toValue: 0, ...SPRING }),
      ]).start();
    } else {
      fadeIn.setValue(0);
      riseY.setValue(40);
    }
  }, [isVisible]);

  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
  const pageOpacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });
  const pageScale = scrollX.interpolate({
    inputRange,
    outputRange: [0.92, 1, 0.92],
    extrapolate: "clamp",
  });

  let hero: React.ReactNode = null;
  if (page.hero === "hook") hero = <HeroHook />;
  else if (page.hero === "proof") hero = <HeroProof />;
  else if (page.hero === "progress") hero = <HeroProgress />;
  else hero = <HeroCTA />;

  const centerText = page.hero === "cta";

  return (
    <Animated.View
      style={[
        st.page,
        {
          width,
          opacity: pageOpacity,
          transform: [{ scale: pageScale }],
        },
      ]}
    >
      <View style={st.heroArea}>{hero}</View>

      <Animated.View
        style={[
          st.textBlock,
          centerText && { alignItems: "center" },
          {
            opacity: fadeIn,
            transform: [{ translateY: riseY }],
          },
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
          <Text style={[st.sub, centerText && { textAlign: "center" }]}>
            {page.sub}
          </Text>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

// ═════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═════════════════════════════════════════════════════════════
export default function OnboardingScreen() {
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
      scrollRef.current?.scrollTo({
        x: (currentPage + 1) * width,
        animated: true,
      });
    }
  }

  const isLast = currentPage === PAGES.length - 1;

  return (
    <View style={st.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={["#FFF0F7", "#F3EEFF", "#EAF3FF"]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Soft blob layers for depth */}
      <View style={[st.blob, st.blobPink]} />
      <View style={[st.blob, st.blobLav]} />
      <View style={[st.blob, st.blobSky]} />

      {/* Skip */}
      <SafeAreaView style={st.skipWrap} pointerEvents="box-none">
        {!isLast && (
          <TouchableOpacity
            onPress={() => finish("/(tabs)")}
            activeOpacity={0.7}
            style={st.skipBtn}
          >
            <Text style={st.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>

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
          <OnboardingPage
            key={p.id}
            page={p}
            isVisible={currentPage === i}
            index={i}
            scrollX={scrollX}
          />
        ))}
      </Animated.ScrollView>

      {/* Footer: dots + CTA */}
      <SafeAreaView style={st.footer}>
        {/* Per-dot scaleX animation — active dot stretches into a capsule */}
        <View style={st.dotRow}>
          {PAGES.map((_, i) => {
            const inputRange = [
              (i - 1) * width,
              i * width,
              (i + 1) * width,
            ];
            const scaleX = scrollX.interpolate({
              inputRange,
              outputRange: [1, 3, 1],
              extrapolate: "clamp",
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: "clamp",
            });
            return (
              <Animated.View
                key={i}
                style={[
                  st.dotBase,
                  {
                    opacity,
                    transform: [{ scaleX }],
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={st.btnArea}>
          {!isLast ? (
            <TouchableOpacity
              onPress={handleContinue}
              activeOpacity={0.85}
              style={st.btnShadow}
            >
              <LinearGradient
                colors={["#b77cff", "#ff9fc2"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={st.btnMain}
              >
                <Text style={st.btnMainText}>Continue</Text>
                <Text style={st.btnArrow}>→</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={st.ctaGroup}>
              <TouchableOpacity
                onPress={() => finish("/(tabs)")}
                activeOpacity={0.85}
                style={st.btnShadow}
              >
                <LinearGradient
                  colors={["#b77cff", "#ff9fc2"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={st.btnMain}
                >
                  <Text style={st.btnMainText}>Start Free Scan</Text>
                  <Text style={st.btnArrow}>→</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => finish("/(tabs)/profile")}
                activeOpacity={0.7}
                style={st.btnSecondary}
              >
                <Text style={st.btnSecondaryText}>Create account later →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF0F7" },

  blob: {
    position: "absolute",
    borderRadius: 9999,
    opacity: 0.55,
  },
  blobPink: {
    width: 320,
    height: 320,
    backgroundColor: "#ff9fc2",
    top: -100,
    left: -90,
  },
  blobLav: {
    width: 240,
    height: 240,
    backgroundColor: "#b77cff",
    top: height * 0.56,
    right: -130,
    opacity: 0.35,
  },
  blobSky: {
    width: 240,
    height: 240,
    backgroundColor: "#7ec8ff",
    bottom: 80,
    left: -100,
    opacity: 0.3,
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
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  skipText: {
    fontSize: 13,
    color: C.inkMuted,
    fontWeight: "600",
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
    marginBottom: 20,
  },
  textBlock: {
    alignItems: "flex-start",
  },
  eyebrowWrap: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(183,124,255,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: C.accent,
  },
  headline: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1.2,
    color: C.ink,
    lineHeight: 40,
    marginBottom: 14,
  },
  headlineAccent: {
    color: C.accent,
  },
  sub: {
    fontSize: 16,
    lineHeight: 24,
    color: C.inkSoft,
    fontWeight: "500",
  },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: 30,
  },
  dotRow: {
    flexDirection: "row",
    marginBottom: 22,
    alignItems: "center",
    justifyContent: "center",
    height: DOT_SIZE + 4,
    position: "relative",
  },
  dotBase: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: "#b77cff",
    marginHorizontal: DOT_GAP / 2,
  },
  btnArea: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  btnShadow: {
    width: "100%",
    shadowColor: "#b77cff",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  btnMain: {
    height: 58,
    borderRadius: 29,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnMainText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  btnArrow: {
    color: "#fff",
    fontSize: 20,
    marginLeft: 10,
    fontWeight: "700",
  },
  ctaGroup: {
    width: "100%",
    gap: 6,
  },
  btnSecondary: {
    paddingVertical: 14,
    alignItems: "center",
  },
  btnSecondaryText: {
    color: C.inkSoft,
    fontSize: 14,
    fontWeight: "600",
  },
});

// ── Hero-specific styles ──
const heroSt = StyleSheet.create({
  wrap: {
    width: 360,
    height: 360,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ringSvg: {
    position: "absolute",
    width: 360,
    height: 360,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#e6d4ff",
    shadowColor: "#b77cff",
    shadowOpacity: 0.6,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
    // Android fallback — a translucent lavender disc
  },
  faceOval: {
    width: 290,
    height: 290,
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
    height: 30,
    backgroundColor: "rgba(183,124,255,0.5)",
    shadowColor: "#b77cff",
    shadowOpacity: 0.8,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  dot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ff5e8e",
    shadowColor: "#ff5e8e",
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },

  // Proof stack
  proofStack: {
    width: width - 64,
    maxWidth: 320,
    gap: 10,
  },
  proofCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    borderRadius: 18,
    padding: 14,
    paddingHorizontal: 16,
    shadowColor: "#b77cff",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  proofDot: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  proofDotText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  proofBarBg: {
    height: 4,
    backgroundColor: "rgba(26,21,48,0.08)",
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
  },
  proofBarFg: {
    height: 4,
    borderRadius: 2,
  },
  proofName: {
    fontSize: 14,
    fontWeight: "700",
    color: C.ink,
  },
  proofDesc: {
    fontSize: 11,
    color: C.inkMuted,
    marginTop: 2,
  },
  proofCount: {
    fontSize: 20,
    fontWeight: "800",
    color: C.ink,
  },
  proofUnit: {
    fontSize: 10,
    color: C.inkMuted,
  },

  // Progress card
  progressCard: {
    width: width - 64,
    maxWidth: 320,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    borderRadius: 24,
    padding: 22,
    shadowColor: "#b77cff",
    shadowOpacity: 0.15,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 16 },
    elevation: 4,
  },
  pcHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 20,
  },
  pcLabel: {
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: "700",
    color: C.inkMuted,
  },
  pcDelta: {
    fontSize: 13,
    fontWeight: "700",
    color: "#10b981",
  },
  winChip: {
    backgroundColor: "rgba(16,185,129,0.12)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  winChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#10b981",
    letterSpacing: 0.3,
  },
  chart: {
    height: 120,
    marginBottom: 14,
  },
  pcStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(26,21,48,0.08)",
  },
  statCol: {
    flex: 1,
    alignItems: "center",
  },
  statNum: {
    fontSize: 22,
    fontWeight: "800",
    color: C.ink,
  },
  statName: {
    fontSize: 10,
    color: C.inkMuted,
    letterSpacing: 0.5,
    marginTop: 2,
    textTransform: "uppercase",
    fontWeight: "600",
  },

  // CTA card
  ctaCard: {
    width: width - 64,
    maxWidth: 320,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    shadowColor: "#b77cff",
    shadowOpacity: 0.2,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: 20 },
    elevation: 6,
  },
  ctaIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#b77cff",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  ctaIconText: {
    fontSize: 30,
  },
  ctaShimmer: {
    position: "absolute",
    width: 28,
    height: 120,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderRadius: 14,
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: "800",
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
    gap: 12,
    marginTop: 16,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  trustItem: {
    fontSize: 10,
    color: C.inkMuted,
    fontWeight: "600",
  },
});
