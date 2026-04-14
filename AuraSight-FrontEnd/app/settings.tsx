import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Linking,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ChevronRight,
  Crown,
  Bell,
  Globe,
  Moon,
  Star,
  MessageSquare,
  Shield,
  FileText,
  Info,
  LogOut,
  Trash2,
  Lock,
  Check,
} from "lucide-react-native";
import {
  Colors,
  Gradients,
  Spacing,
  Radius,
  FontSize,
  Shadow,
} from "../constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser } from "../lib/userContext";
import { getConsent, acceptConsent, revokeConsentEverywhere } from "../lib/consent";
import { getUserId } from "../lib/userId";
import { ShieldCheck } from "lucide-react-native";

const { width } = Dimensions.get("window");
const APP_VERSION = "1.0.0";

const SKIN_GOALS = [
  { id: "acne", label: "Control breakouts", emoji: "🎯" },
  { id: "tone", label: "Even skin tone", emoji: "✨" },
  { id: "texture", label: "Improve texture", emoji: "🌿" },
  { id: "body", label: "Track body shape", emoji: "🧍" },
  { id: "aging", label: "Anti-aging", emoji: "💫" },
];

// ─── 设置行组件 ───────────────────────────────────────────
function Row({
  iconBg = "#fff0f6",
  iconEl,
  label,
  sub,
  value,
  onPress,
  rightEl,
  danger = false,
  isFirst = false,
  isLast = false,
}: {
  iconBg?: string;
  iconEl: React.ReactNode;
  label: string;
  sub?: string;
  value?: string;
  onPress?: () => void;
  rightEl?: React.ReactNode;
  danger?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  return (
    <>
      <TouchableOpacity
        style={[st.row, isFirst && st.rowFirst, isLast && st.rowLast]}
        onPress={onPress}
        activeOpacity={onPress ? 0.65 : 1}
        disabled={!onPress && !rightEl}
      >
        <View style={[st.rowIcon, { backgroundColor: iconBg }]}>{iconEl}</View>
        <View style={st.rowMid}>
          <Text style={[st.rowLabel, danger && st.rowLabelDanger]}>
            {label}
          </Text>
          {sub && <Text style={st.rowSub}>{sub}</Text>}
        </View>
        {value && <Text style={st.rowValue}>{value}</Text>}
        {rightEl}
        {onPress && !rightEl && (
          <ChevronRight size={15} color={Colors.gray200} />
        )}
      </TouchableOpacity>
      {!isLast && <View style={st.separator} />}
    </>
  );
}

export default function SettingsScreen() {
  const { user, setUser } = useUser();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userMode, setUserMode] = useState<"guest" | "registered" | "vip">(
    "guest",
  );
  const [reminderOn, setReminderOn] = useState(false);
  const [faceIdOn, setFaceIdOn] = useState(false);
  const [skinGoals, setSkinGoals] = useState<string[]>(["acne"]);
  const [dataConsentOn, setDataConsentOn] = useState(false);
  const [consentAcceptedAt, setConsentAcceptedAt] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const name = (await AsyncStorage.getItem("@aurasight_user_name")) ?? "";
    const email = (await AsyncStorage.getItem("@aurasight_user_email")) ?? "";
    const mode =
      (await AsyncStorage.getItem("@aurasight_user_mode")) ?? "guest";
    const goals = await AsyncStorage.getItem("@aurasight_skin_goals");
    const reminder = await AsyncStorage.getItem("@aurasight_reminder_on");
    const faceId = await AsyncStorage.getItem("@aurasight_faceid_on");
    setUserName(name);
    setUserEmail(email);
    setUserMode(mode as any);
    if (goals) setSkinGoals(JSON.parse(goals));
    setReminderOn(reminder === "true");
    setFaceIdOn(faceId === "true");
    const consent = await getConsent();
    setDataConsentOn(consent.accepted);
    setConsentAcceptedAt(consent.acceptedAt);
  }

  async function toggleDataConsent(val: boolean) {
    if (val) {
      // 打开 = 授予同意。用 Alert 让用户确认一下，条款详情在首次弹窗里已经看过。
      Alert.alert(
        "Allow data use",
        "By turning this on, you allow AuraSight to save your skin photos and use anonymized versions to improve our detection model.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "I agree",
            onPress: async () => {
              await acceptConsent();
              const c = await getConsent();
              setDataConsentOn(c.accepted);
              setConsentAcceptedAt(c.acceptedAt);
            },
          },
        ],
      );
    } else {
      // 关闭 = 撤销。撤销之后，新上传不会再被用于训练/云端保存，下次使用会重新弹窗征求同意。
      Alert.alert(
        "Revoke data consent?",
        "We'll stop using new photos for training and cloud save. You can re-enable this any time.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Revoke",
            style: "destructive",
            onPress: async () => {
              // 用集中版 getUserId——登录后拿账号 id，未登录拿 guest id。
              // 通知后端把该用户历史 scans 的 can_train 置 false。
              const uid = await getUserId();
              await revokeConsentEverywhere(uid);
              setDataConsentOn(false);
              setConsentAcceptedAt(null);
            },
          },
        ],
      );
    }
  }

  async function toggleReminder(val: boolean) {
    setReminderOn(val);
    await AsyncStorage.setItem("@aurasight_reminder_on", String(val));
    if (val)
      Alert.alert(
        "🔔 Coming soon",
        "Daily reminders will be enabled in the next update.",
        [{ text: "Got it" }],
      );
  }

  async function toggleFaceId(val: boolean) {
    setFaceIdOn(val);
    await AsyncStorage.setItem("@aurasight_faceid_on", String(val));
    if (val)
      Alert.alert(
        "🔒 Coming soon",
        "Biometric lock will be enabled in the next update.",
        [{ text: "Got it" }],
      );
  }

  async function toggleGoal(id: string) {
    const next = skinGoals.includes(id)
      ? skinGoals.filter((g) => g !== id)
      : [...skinGoals, id];
    setSkinGoals(next);
    await AsyncStorage.setItem("@aurasight_skin_goals", JSON.stringify(next));
  }

  async function handleLogout() {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove([
            "@aurasight_user_mode",
            "@aurasight_user_name",
            "@aurasight_user_email",
          ]);
          router.replace("/(tabs)/profile");
        },
      },
    ]);
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "⚠️ Delete Account",
      "This will permanently delete your account and all data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Are you absolutely sure?",
              "All photos and data will be lost forever.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, delete everything",
                  style: "destructive",
                  onPress: async () => {
                    await AsyncStorage.clear();
                    router.replace("/(tabs)/profile");
                  },
                },
              ],
            ),
        },
      ],
    );
  }

  const isLoggedIn = userMode !== "guest";
  const initials = userName ? userName.charAt(0).toUpperCase() : "?";
  const modeLabel =
    userMode === "vip" ? "VIP ✦" : userMode === "registered" ? "Free" : "Guest";
  const modeBg = userMode === "vip" ? "rgba(253,230,138,0.25)" : "rgba(255,255,255,0.25)";
  const modeColor = userMode === "vip" ? "#fde68a" : "#fff";

  return (
    <View style={st.root}>
      <LinearGradient
        colors={["#FFF3F6", "#FFF9FB", "#FFFFFF"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── HERO 顶部：玫瑰渐变，品牌一致 ── */}
      <LinearGradient colors={["#F43F8F", "#F472B6", "#FB9FBD"]} style={st.hero}>
        <SafeAreaView edges={["top"]}>
          <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
            <Text style={st.backText}>‹ Back</Text>
          </TouchableOpacity>

          <View style={st.heroBody}>
            {/* 头像圆 */}
            <View style={st.avatar}>
              <Text style={st.avatarText}>{initials}</Text>
            </View>

            {/* 名字 + 邮箱 */}
            <View style={st.heroInfo}>
              <Text style={st.heroName}>{isLoggedIn ? userName : "Guest"}</Text>
              <Text style={st.heroEmail}>
                {isLoggedIn ? userEmail : "Not signed in"}
              </Text>
            </View>

            {/* 账户类型徽章 */}
            <View style={[st.modeBadge, { backgroundColor: modeBg }]}>
              <Text style={[st.modeBadgeText, { color: modeColor }]}>
                {modeLabel}
              </Text>
            </View>
          </View>

          {/* VIP 升级条 — 只在非 VIP 时显示，放在 Hero 里视觉冲击更强 */}
          {userMode !== "vip" && (
            <TouchableOpacity
              onPress={() => router.push("/vip")}
              activeOpacity={0.85}
              style={st.vipBanner}
            >
              <Crown size={14} color="#fde68a" />
              <Text style={st.vipBannerText}>Try VIP free for 7 days</Text>
              <View style={st.vipBannerArrow}>
                <ChevronRight size={14} color="rgba(255,255,255,0.6)" />
              </View>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </LinearGradient>

      {/* ── 主体内容 ── */}
      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 皮肤目标 ── */}
        <Text style={st.sectionLabel}>SKIN GOALS</Text>
        <View style={[st.card, Shadow.card]}>
          <Text style={st.cardNote}>
            Tell AI what you care about most — it tailors your weekly reports.
          </Text>
          <View style={st.goalGrid}>
            {SKIN_GOALS.map((g) => {
              const on = skinGoals.includes(g.id);
              return (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => toggleGoal(g.id)}
                  activeOpacity={0.7}
                  style={[st.goalChip, on && st.goalChipOn]}
                >
                  {on && (
                    <View style={st.goalCheck}>
                      <Check size={9} color="#fff" />
                    </View>
                  )}
                  <Text style={st.goalEmoji}>{g.emoji}</Text>
                  <Text style={[st.goalLabel, on && st.goalLabelOn]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 通知 ── */}
        <Text style={st.sectionLabel}>NOTIFICATIONS</Text>
        <View style={[st.card, Shadow.card]}>
          <Row
            iconBg="#fff0f6"
            iconEl={<Bell size={15} color={Colors.rose400} />}
            label="Daily reminder"
            sub="Remind me to scan every day"
            isFirst
            isLast
            rightEl={
              <Switch
                value={reminderOn}
                onValueChange={toggleReminder}
                trackColor={{ false: Colors.gray200, true: Colors.rose300 }}
                thumbColor={reminderOn ? Colors.rose400 : "#fff"}
              />
            }
          />
        </View>

        {/* ── 隐私 & 安全 ── */}
        <Text style={st.sectionLabel}>PRIVACY & SECURITY</Text>
        <View style={[st.card, Shadow.card]}>
          <Row
            iconBg="#fff0f6"
            iconEl={<Lock size={15} color={Colors.rose400} />}
            label="Face ID / Touch ID"
            sub="Require biometrics to open"
            isFirst
            rightEl={
              <Switch
                value={faceIdOn}
                onValueChange={toggleFaceId}
                trackColor={{ false: Colors.gray200, true: Colors.rose300 }}
                thumbColor={faceIdOn ? Colors.rose400 : "#fff"}
              />
            }
          />
          <Row
            iconBg="#fdf2f8"
            iconEl={<ShieldCheck size={15} color={Colors.rose400} />}
            label="Allow photo data use"
            sub={
              dataConsentOn
                ? consentAcceptedAt
                  ? `Agreed ${new Date(consentAcceptedAt).toLocaleDateString()}`
                  : "Agreed"
                : "Needed for AI analysis & cloud save"
            }
            rightEl={
              <Switch
                value={dataConsentOn}
                onValueChange={toggleDataConsent}
                trackColor={{ false: Colors.gray200, true: Colors.rose300 }}
                thumbColor={dataConsentOn ? Colors.rose400 : "#fff"}
              />
            }
          />
          <Row
            iconBg="#f0f9ff"
            iconEl={<Shield size={15} color="#3b82f6" />}
            label="Privacy Policy"
            onPress={() => Linking.openURL("https://aurasight.app/privacy")}
          />
          <Row
            iconBg="#f0fdf4"
            iconEl={<FileText size={15} color={Colors.emerald} />}
            label="Terms of Service"
            onPress={() => Linking.openURL("https://aurasight.app/terms")}
            isLast
          />
        </View>

        {/* ── 个性化 ── */}
        <Text style={st.sectionLabel}>PERSONALIZATION</Text>
        <View style={[st.card, Shadow.card]}>
          <Row
            iconBg="#fff7ed"
            iconEl={<Globe size={15} color="#f97316" />}
            label="Language"
            value="English"
            sub="中文 coming soon"
            isFirst
          />
          <Row
            iconBg="#1f2937"
            iconEl={<Moon size={15} color="#e2e8f0" />}
            label="Appearance"
            value="Light"
            sub="Dark mode coming soon"
            isLast
          />
        </View>

        {/* ── 帮助 & 反馈 ── */}
        <Text style={st.sectionLabel}>HELP & FEEDBACK</Text>
        <View style={[st.card, Shadow.card]}>
          <Row
            iconBg="#fefce8"
            iconEl={<Star size={15} color="#eab308" />}
            label="Rate AuraSight ⭐"
            sub="Your review helps others find us"
            onPress={() => {
              const url =
                Platform.OS === "ios"
                  ? "https://apps.apple.com/app/idXXXXXXXXX?action=write-review"
                  : "https://play.google.com/store/apps/details?id=com.aurasight";
              Alert.alert("Rate AuraSight", "Opening App Store...", [
                { text: "Cancel", style: "cancel" },
                { text: "Open", onPress: () => Linking.openURL(url) },
              ]);
            }}
            isFirst
          />
          <Row
            iconBg="#f0fdf4"
            iconEl={<MessageSquare size={15} color={Colors.emerald} />}
            label="Send Feedback"
            sub="hello@aurasight.app"
            onPress={() =>
              Linking.openURL(
                "mailto:hello@aurasight.app?subject=AuraSight Feedback",
              )
            }
            isLast
          />
        </View>

        {/* ── 关于 ── */}
        <Text style={st.sectionLabel}>ABOUT</Text>
        <View style={[st.card, Shadow.card]}>
          <Row
            iconBg="#f5f3ff"
            iconEl={<Info size={15} color="#8b5cf6" />}
            label="Version"
            value={`v${APP_VERSION}`}
            isFirst
            isLast
          />
        </View>

        {/* ── 开发者测试 ── */}
        <Text style={st.sectionLabel}>DEV TOOLS</Text>
        <View style={[st.card, Shadow.card]}>
          <Row
            iconBg="#fef9c3"
            iconEl={<Crown size={15} color="#d97706" />}
            label="Switch to VIP (Test)"
            sub={`Current: ${userMode}`}
            onPress={async () => {
              const next = userMode === "vip" ? "registered" : "vip";
              // 通过 UserContext.setUser 双写两个 key，保证 useUser() 立刻拿到新 mode
              if (user) {
                await setUser({ ...user, mode: next });
              } else {
                await AsyncStorage.setItem("@aurasight_user_mode", next);
              }
              setUserMode(next as any);
              Alert.alert(next === "vip" ? "👑 VIP activated!" : "✓ Switched to Free", `Mode is now: ${next}`);
            }}
            isFirst
            isLast
          />
        </View>

        {/* ── 危险操作 — 放最底部，红色区分，防误操作 ── */}
        {isLoggedIn && (
          <>
            <Text style={st.sectionLabel}>ACCOUNT ACTIONS</Text>
            <View style={[st.card, Shadow.card]}>
              <Row
                iconBg="#fff1f2"
                iconEl={<LogOut size={15} color={Colors.red} />}
                label="Sign Out"
                onPress={handleLogout}
                danger
                isFirst
              />
              <Row
                iconBg="#fff1f2"
                iconEl={<Trash2 size={15} color={Colors.red} />}
                label="Delete Account"
                sub="Permanently removes all your data"
                onPress={handleDeleteAccount}
                danger
                isLast
              />
            </View>
          </>
        )}

        <Text style={st.footer}>AuraSight v{APP_VERSION} · Made with 💗</Text>
      </ScrollView>
    </View>
  );
}

// ─── 样式 ──────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1 },

  // Hero 顶部
  hero: { paddingBottom: 20 },
  backBtn: { paddingHorizontal: Spacing.xl, paddingTop: 8, paddingBottom: 12 },
  backText: {
    fontSize: FontSize.base,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "500",
  },
  heroBody: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  avatarText: { fontSize: 22, fontWeight: "800", color: "#fff" },
  heroInfo: { flex: 1 },
  heroName: { fontSize: FontSize.base, fontWeight: "700", color: "#fff" },
  heroEmail: {
    fontSize: FontSize.xs,
    color: "rgba(255,255,255,0.45)",
    marginTop: 2,
  },
  modeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  modeBadgeText: { fontSize: 11, fontWeight: "700" },

  // VIP 升级条
  vipBanner: {
    marginHorizontal: Spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  vipBannerText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: "#fff",
    fontWeight: "700",
  },
  vipBannerArrow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  // 主体
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.gray400,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
    paddingLeft: 2,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginBottom: Spacing.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F9E0EE",
  },
  cardNote: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    lineHeight: 17,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 4,
  },

  // 行
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  rowFirst: { paddingTop: 14 },
  rowLast: { paddingBottom: 14 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMid: { flex: 1 },
  rowLabel: { fontSize: FontSize.sm, fontWeight: "500", color: Colors.gray800 },
  rowLabelDanger: { color: Colors.red },
  rowSub: { fontSize: 11, color: Colors.gray400, marginTop: 1.5 },
  rowValue: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    fontWeight: "500",
    marginRight: 2,
  },
  separator: {
    height: 1,
    backgroundColor: "#f9f9f9",
    marginLeft: 16 + 34 + 12,
  },

  // 皮肤目标
  goalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: Spacing.md,
    paddingTop: Spacing.sm,
  },
  goalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#f3f4f6",
    position: "relative",
  },
  goalChipOn: { backgroundColor: "#fff0f6", borderColor: Colors.rose200 },
  goalCheck: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.rose400,
    alignItems: "center",
    justifyContent: "center",
  },
  goalEmoji: { fontSize: 13 },
  goalLabel: { fontSize: 12, color: Colors.gray500, fontWeight: "500" },
  goalLabelOn: { color: Colors.rose500 ?? Colors.rose400, fontWeight: "700" },

  footer: {
    textAlign: "center",
    fontSize: 11,
    color: Colors.gray300,
    marginTop: 8,
  },
});
