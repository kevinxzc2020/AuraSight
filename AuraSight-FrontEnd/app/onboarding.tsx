import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
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

// 极致弹簧配置
const RAGE_SPRING = {
  tension: 180,
  friction: 12,
  useNativeDriver: true,
};

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

// --- 修复版进度预览 (不再报错，不再重叠) ---
function MilestonePreview({ active }: { active: boolean }) {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      Animated.spring(progressAnim, {
        toValue: 1,
        tension: 20,
        friction: 8,
        useNativeDriver: false, // 必须为 false 才能动画化 width
      }).start();
    } else {
      progressAnim.setValue(0);
    }
  }, [active]);

  const RenderMilestone = ({
    label,
    index,
  }: {
    label: string;
    index: number;
  }) => (
    <View style={ms.milestoneRow}>
      <View style={ms.lockIcon}>
        <Text style={{ fontSize: 12 }}>🔒</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ms.milestoneName}>{label}</Text>
        <View style={ms.progressTrack}>
          <Animated.View
            style={[
              ms.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", `${70 + index * 15}%`],
                }),
              },
            ]}
          />
        </View>
      </View>
    </View>
  );

  return (
    <View style={ms.container}>
      <RenderMilestone label="Trend Chart" index={0} />
      <RenderMilestone label="AI Report" index={1} />
    </View>
  );
}

// --- 单页组件 ---
function OnboardingPage({ page, isVisible, index, scrollX }: any) {
  const emojiScale = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.spring(emojiScale, { toValue: 1, ...RAGE_SPRING }),
        Animated.timing(contentFade, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(contentY, { toValue: 0, ...RAGE_SPRING }),
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
      style={[pg.container, { width, opacity, transform: [{ scale }] }]}
    >
      <Animated.Text style={[pg.emoji, { transform: [{ scale: emojiScale }] }]}>
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
        <Text style={pg.title}>{page.title}</Text>
        <Text style={pg.subtitle}>{page.subtitle}</Text>
        {page.showProgress && <MilestonePreview active={isVisible} />}
      </Animated.View>
    </Animated.View>
  );
}

// --- 主程序 ---
export default function OnboardingScreen() {
  const [currentPage, setCurrentPage] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    AsyncStorage.setItem("@aurasight_onboarding_done", "false");
    StatusBar.setBarStyle("light-content");
    StatusBar.setBackgroundColor("transparent");
    StatusBar.setTranslucent(true);
  }, []);

  const handleScroll = (e: any) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / width);
    if (page !== currentPage) {
      setCurrentPage(page);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const finish = async (target: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem("@aurasight_onboarding_done", "true");
    router.replace(target as any);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#030308", "#1a0a14", "#030308"]}
        style={StyleSheet.absoluteFillObject}
      />

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

      {/* 固定底部区域 */}
      <SafeAreaView style={styles.footer} pointerEvents="box-none">
        <View style={styles.dotContainer}>
          {PAGES.map((_, i) => {
            const dotWidth = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [8, 30, 8],
              extrapolate: "clamp",
            });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    backgroundColor:
                      i === currentPage ? "#f472b6" : "rgba(255,255,255,0.2)",
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.btnWrapper}>
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
                style={styles.btnMain}
              >
                <Text style={styles.btnTextMain}>Continue</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={styles.ctaGroup}>
              <TouchableOpacity
                onPress={() => finish("/(tabs)/profile")}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={["#f472b6", "#fb7185"]}
                  style={styles.btnMain}
                >
                  <Text style={styles.btnTextMain}>Create Account</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => finish("/(tabs)")}
                style={styles.btnSecondary}
              >
                <Text style={styles.btnTextSecondary}>Explore as Guest</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const pg = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingBottom: 180, // 核心修复：留出巨大的底部空间给指示器
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
  },
});

const ms = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 20,
    borderRadius: 24,
    gap: 15,
    marginTop: 25,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  milestoneRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  lockIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneName: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
    marginBottom: 4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#f472b6" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030308" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: 40,
  },
  dotContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 30,
    height: 10,
    alignItems: "center",
  },
  dot: { height: 8, borderRadius: 4 },
  btnWrapper: { height: 120, justifyContent: "center" },
  btnMain: {
    width: width - 80,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#f472b6",
    shadowRadius: 12,
    shadowOpacity: 0.3,
  },
  btnTextMain: { color: "#fff", fontSize: 18, fontWeight: "800" },
  ctaGroup: { gap: 10 },
  btnSecondary: { paddingVertical: 10, alignItems: "center" },
  btnTextSecondary: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 15,
    fontWeight: "600",
  },
});
