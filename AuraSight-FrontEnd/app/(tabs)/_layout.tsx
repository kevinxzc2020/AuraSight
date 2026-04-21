import { Tabs, router } from "expo-router";
import { Camera, FileText, Home, User, Settings, Users } from "lucide-react-native";
import { useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Colors, Gradients } from "../../constants/theme";
import { useAppTheme } from "../../lib/themeContext";
import { useT } from "../../lib/i18n";

// ─── 普通 tab 图标——带"激活态胶囊"指示 ─────────────────────
function TabIcon({
  Icon,
  focused,
}: {
  Icon: React.ComponentType<{ color: string; size: number; strokeWidth?: number }>;
  focused: boolean;
}) {
  return (
    <View style={styles.tabIconWrap}>
      {focused && <View style={styles.activePill} />}
      <Icon
        color={focused ? Colors.rose400 : Colors.gray400}
        size={focused ? 22 : 20}
        strokeWidth={focused ? 2.4 : 2}
      />
    </View>
  );
}

// ─── 中间相机按钮——按下缩放+渐变圆+白色描边 ─────────────────
function CameraTabButton() {
  const scale = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();
  // tab bar 上下 padding 不对称（top: 8, bottom: insets.bottom + 6），
  // 用 marginTop 把按钮往下推到屏幕底边和 tab bar 顶边的几何中心
  const centerOffset = (insets.bottom + 6 - 8) / 2;

  const onIn = () =>
    Animated.spring(scale, {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  const onOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();

  return (
    <Pressable
      onPressIn={onIn}
      onPressOut={onOut}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        router.push("/(tabs)/camera");
      }}
      style={styles.cameraBtnWrap}
      hitSlop={10}
    >
      <Animated.View style={[styles.cameraBtnShadow, { marginTop: centerOffset, transform: [{ scale }] }]}>
        {/* 光晕底环 */}
        <View style={styles.cameraHalo} />
        <LinearGradient
          colors={["#FF7AB0", "#F472B6", "#EC4899"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cameraBtn}
        >
          {/* 内部高光——给渐变加立体感 */}
          <LinearGradient
            colors={["rgba(255,255,255,0.35)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.cameraInnerGloss}
          />
          <Camera color="#fff" size={22} strokeWidth={2.4} />
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors: C, isDark } = useAppTheme();
  const { t } = useT();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            paddingBottom: insets.bottom || 0,
            height: 56 + (insets.bottom || 0),
          },
          isDark && {
            backgroundColor: "rgba(26,26,46,0.97)",
            shadowColor: "#000",
            shadowOpacity: 0.3,
          },
        ],
        tabBarActiveTintColor: Colors.rose400,
        tabBarInactiveTintColor: C.gray400,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ focused }) => <TabIcon Icon={Home} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: t("community.title"),
          tabBarIcon: ({ focused }) => <TabIcon Icon={Users} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: "",
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: () => <CameraTabButton />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: t("tabs.report"),
          tabBarIcon: ({ focused }) => <TabIcon Icon={FileText} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ focused }) => <TabIcon Icon={User} focused={focused} />,
        }}
      />
      {/* History、Settings 隐藏在 tab bar 外 */}
      <Tabs.Screen
        name="history"
        options={{ href: null, title: t("tabs.history") }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          title: t("settings.title"),
          tabBarIcon: ({ focused }) => <TabIcon Icon={Settings} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Tab bar 本体——白色半透明、圆角顶、柔和粉色阴影
  // 注意：不要用 position: "absolute"，否则页面内容（如相机快门）会被 tab bar 盖住
  tabBar: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
    paddingTop: 8,
    paddingHorizontal: 4,
    shadowColor: "#F472B6",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: 0.2,
  },

  // 普通 tab 图标 + 激活态小胶囊
  tabIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
  },
  activePill: {
    position: "absolute",
    top: 0,
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.rose400,
  },

  // 中间相机按钮
  cameraBtnWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBtnShadow: {
    shadowColor: "#EC4899",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  cameraHalo: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 30,
    backgroundColor: "rgba(244, 114, 182, 0.15)",
  },
  cameraBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    overflow: "hidden",
  },
  cameraInnerGloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "55%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
});
