import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Path,
  G,
  Defs,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Colors,
  Gradients,
  Spacing,
  Radius,
  FontSize,
} from "../constants/theme";

const { width, height } = Dimensions.get("window");

const WELCOME_SHOWN_KEY = "@aurasight_welcome_shown";

// ─── 装饰性背景气泡 ───────────────────────────────────────
function DecorBubbles() {
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id="b1" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#f472b6" stopOpacity="0.25" />
          <Stop offset="100%" stopColor="#f472b6" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="b2" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#fb7185" stopOpacity="0.2" />
          <Stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="b3" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#f9a8d4" stopOpacity="0.3" />
          <Stop offset="100%" stopColor="#f9a8d4" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={width * 0.85} cy={height * 0.1} r={120} fill="url(#b1)" />
      <Circle cx={width * 0.1} cy={height * 0.25} r={90} fill="url(#b2)" />
      <Circle cx={width * 0.9} cy={height * 0.6} r={100} fill="url(#b3)" />
      <Circle cx={width * 0.15} cy={height * 0.75} r={80} fill="url(#b1)" />
    </Svg>
  );
}

// ─── 功能特性列表 ─────────────────────────────────────────
const FEATURES = [
  { emoji: "📸", text: "Daily face & body scans" },
  { emoji: "🤖", text: "AI acne analysis & causes" },
  { emoji: "📊", text: "30-day transformation report" },
  { emoji: "🏆", text: "Daily tasks & points system" },
];

// ─── 主组件 ───────────────────────────────────────────────
export default function WelcomeScreen() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkIfSeen();
  }, []);

  // 开发阶段：每次都跳到 Onboarding
  async function checkIfSeen() {
    router.replace("/onboarding");

    // ── 上线前替换成正式逻辑 ────────────────────────────
    // const seen = await AsyncStorage.getItem(WELCOME_SHOWN_KEY)
    // if (seen === 'true') {
    //   router.replace('/(tabs)')
    // } else {
    //   setChecking(false)
    // }
  }

  async function handleSignUp() {
    await AsyncStorage.setItem(WELCOME_SHOWN_KEY, "true");
    router.replace("/(tabs)/profile");
  }

  async function handleGuest() {
    await AsyncStorage.setItem(WELCOME_SHOWN_KEY, "true");
    router.replace("/(tabs)");
  }

  if (checking) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={["#fff5f5", "#ffffff", "#fff0f6"]}
        style={StyleSheet.absoluteFillObject}
      />
      <DecorBubbles />

      <View style={styles.content}>
        {/* Logo 区域 */}
        <View style={styles.logoSection}>
          <LinearGradient colors={Gradients.roseMain} style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>✨</Text>
          </LinearGradient>
          <Text style={styles.appName}>AuraSight</Text>
          <Text style={styles.tagline}>
            Track your skin & body{"\n"}transformation journey
          </Text>
        </View>

        {/* 功能特性 */}
        <View style={styles.featuresCard}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureEmoji}>
                <Text style={styles.featureEmojiText}>{f.emoji}</Text>
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* 按钮区域 */}
        <View style={styles.buttonsSection}>
          {/* 注册/登录 */}
          <TouchableOpacity onPress={handleSignUp} activeOpacity={0.85}>
            <LinearGradient
              colors={Gradients.roseMain}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Create Account</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* 游客模式 */}
          <TouchableOpacity
            onPress={handleGuest}
            activeOpacity={0.8}
            style={styles.guestBtn}
          >
            <Text style={styles.guestBtnText}>Continue as Guest</Text>
            <Text style={styles.guestBtnSub}>
              No account needed · data stays on device
            </Text>
          </TouchableOpacity>

          {/* 已有账号 */}
          <TouchableOpacity
            onPress={() => router.replace("/(tabs)/profile")}
            activeOpacity={0.8}
          >
            <Text style={styles.signInLink}>
              Already have an account?{" "}
              <Text style={styles.signInLinkBold}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* 底部说明 */}
        <Text style={styles.legalText}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff5f5" },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: "space-between",
    paddingTop: height * 0.1,
    paddingBottom: Spacing.xxl,
  },

  // Logo
  logoSection: { alignItems: "center" },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  logoEmoji: { fontSize: 42 },
  appName: {
    fontSize: 36,
    fontWeight: "800",
    color: Colors.gray800,
    letterSpacing: -0.5,
    marginBottom: Spacing.sm,
  },
  tagline: {
    fontSize: FontSize.base,
    color: Colors.gray500,
    textAlign: "center",
    lineHeight: 22,
  },

  // Features
  featuresCard: {
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.rose100,
  },
  featureRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  featureEmoji: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff0f6",
    alignItems: "center",
    justifyContent: "center",
  },
  featureEmojiText: { fontSize: 20 },
  featureText: {
    fontSize: FontSize.base,
    color: Colors.gray700,
    fontWeight: "500",
    flex: 1,
  },

  // Buttons
  buttonsSection: { gap: Spacing.md },
  primaryBtn: {
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: FontSize.base,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  guestBtn: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: Radius.xl,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.rose100,
  },
  guestBtnText: {
    fontSize: FontSize.base,
    color: Colors.gray700,
    fontWeight: "600",
  },
  guestBtnSub: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 3 },

  signInLink: {
    textAlign: "center",
    fontSize: FontSize.sm,
    color: Colors.gray500,
    paddingVertical: Spacing.sm,
  },
  signInLinkBold: { color: Colors.rose400, fontWeight: "700" },

  legalText: {
    fontSize: 10,
    color: Colors.gray300,
    textAlign: "center",
    lineHeight: 14,
  },
});
