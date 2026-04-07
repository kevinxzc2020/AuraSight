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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

const { width, height } = Dimensions.get("window");

const SPRING = { tension: 180, friction: 12, useNativeDriver: true };

const PAGES = [
  {
    id: "welcome",
    emoji: "✨",
    title: "30 Days.\nReal Change.",
    subtitle: "Track daily. Transform daily.\nYour journey starts now.",
  },
  {
    id: "scan",
    emoji: "📷",
    title: "30 Seconds.\nAI Analysis.",
    subtitle: "Scan face & body.\nAI detects every shift.",
  },
  {
    id: "points",
    emoji: "🏆",
    title: "Scan. Earn.\nUnlock.",
    subtitle: "Hit milestones.\nUnlock VIP insights.",
    showProgress: true,
  },
  {
    id: "start",
    emoji: "🚀",
    title: "The 30-Day\nChallenge.",
    subtitle: "Show up daily.\nLet data tell your story.",
    showCTA: true,
  },
];

// 进度条用静态 View 而不是 Animated.View，避免和父级
// Animated.ScrollView 的 useNativeDriver: true 产生冲突
function MilestonePreview() {
  const milestones = [
    { label: "Trend Chart", pct: 65 },
    { label: "AI Report", pct: 80 },
  ];

  return (
    <View style={st.msBox}>
      <View style={st.msTodayRow}>
        <Text style={st.msTodayLabel}>DAILY GOAL</Text>
        <View style={st.msBadge}>
          <Text style={st.msBadgeText}>📸 +50 pts</Text>
        </View>
      </View>
      {milestones.map((m, i) => (
        <View key={i} style={st.msRow}>
          <View style={st.msLock}>
            <Text style={{ fontSize: 12 }}>🔒</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.msName}>{m.label}</Text>
            <View style={st.msTrack}>
              <View style={[st.msFill, { width: `${m.pct}%` }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function OnboardingPage({ page, isVisible, index, scrollX }: any) {
  const emojiScale = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.spring(emojiScale, { toValue: 1, ...SPRING }),
        Animated.timing(contentFade, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(contentY, { toValue: 0, ...SPRING }),
      ]).start();
    } else {
      emojiScale.setValue(0);
      contentFade.setValue(0);
      contentY.setValue(40);
    }
  }, [isVisible]);

  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });
  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.9, 1, 0.9],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      style={[st.page, { width, opacity, transform: [{ scale }] }]}
    >
      <Animated.Text style={[st.emoji, { transform: [{ scale: emojiScale }] }]}>
        {page.emoji}
      </Animated.Text>
      <Animated.View
        style={{
          opacity: contentFade,
          transform: [{ translateY: contentY }],
          width: "100%",
          alignItems: "center",
        }}
      >
        <Text style={st.title}>{page.title}</Text>
        <Text style={st.subtitle}>{page.subtitle}</Text>
        {page.showProgress && <MilestonePreview />}
      </Animated.View>
    </Animated.View>
  );
}

export default function OnboardingScreen() {
  const [currentPage, setCurrentPage] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<any>(null);

  useEffect(() => {
    StatusBar.setBarStyle("light-content");
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

  return (
    <View style={st.container}>
      <LinearGradient
        colors={["#030308", "#1a0a14", "#030308"]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={st.glowTop} />
      <View style={st.glowBottom} />

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
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

      <SafeAreaView style={st.footer}>
        <View style={st.dotRow}>
          {PAGES.map((_, i) => {
            // scaleX 是 transform 属性，完全支持 useNativeDriver: true
            // 视觉效果和 width 动画一样，但不会产生冲突
            const scaleX = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [1, 3.5, 1], // 3.5x 宽度放大，视觉上等同于从8px变成28px
              extrapolate: "clamp",
            });
            return (
              <Animated.View
                key={i}
                style={[
                  st.dot,
                  {
                    transform: [{ scaleX }],
                    backgroundColor:
                      i === currentPage ? "#f472b6" : "rgba(255,255,255,0.2)",
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={st.btnArea}>
          {currentPage < PAGES.length - 1 ? (
            <TouchableOpacity
              onPress={() =>
                scrollRef.current?.scrollTo({
                  x: (currentPage + 1) * width,
                  animated: true,
                })
              }
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#f472b6", "#fb7185"]}
                style={st.btnMain}
              >
                <Text style={st.btnMainText}>Continue</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={st.ctaGroup}>
              <TouchableOpacity
                onPress={() => finish("/(tabs)/profile")}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={["#f472b6", "#fb7185"]}
                  style={st.btnMain}
                >
                  <Text style={st.btnMainText}>Create Account</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => finish("/(tabs)")}
                style={st.btnSecondary}
              >
                <Text style={st.btnSecondaryText}>Explore as Guest</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030308" },
  glowTop: {
    position: "absolute",
    top: -60,
    left: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(244,114,182,0.1)",
  },
  glowBottom: {
    position: "absolute",
    bottom: 100,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(251,113,133,0.07)",
  },

  page: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingBottom: 180,
  },
  emoji: { fontSize: 100, marginBottom: 20, textAlign: "center" },
  title: {
    fontSize: 42,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    lineHeight: 48,
    letterSpacing: -1.5,
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 17,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 20,
  },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: 40,
  },
  dotRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 28,
    alignItems: "center",
    height: 10,
  },
  dot: { height: 8, borderRadius: 4 },
  btnArea: { height: 130, justifyContent: "center" },

  btnMain: {
    width: width - 80,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  btnMainText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  ctaGroup: { gap: 10 },
  btnSecondary: { paddingVertical: 10, alignItems: "center" },
  btnSecondaryText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 15,
    fontWeight: "600",
  },

  msBox: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 20,
    borderRadius: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  msTodayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  msTodayLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "800",
  },
  msBadge: {
    backgroundColor: "rgba(244,114,182,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  msBadgeText: { fontSize: 10, color: "#f472b6", fontWeight: "800" },
  msRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  msLock: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  msName: { fontSize: 14, color: "#fff", fontWeight: "600", marginBottom: 4 },
  msTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  msFill: { height: "100%", backgroundColor: "#f472b6", borderRadius: 3 },
});
