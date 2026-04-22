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
  Modal,
  Pressable,
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
  MessageSquare,
  Shield,
  FileText,
  Info,
  Lock,
  Check,
  ShieldCheck,
  Clock,
} from "lucide-react-native";
import {
  Colors,
  Spacing,
  Radius,
  FontSize,
  Shadow,
} from "../constants/theme";
import { useAppTheme, ThemeMode } from "../lib/themeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser } from "../lib/userContext";
import { getConsent, acceptConsent, revokeConsentEverywhere } from "../lib/consent";
import { getUserId } from "../lib/userId";
import { useT, Lang } from "../lib/i18n";
import {
  ensurePermission,
  scheduleDailyReminder,
  disableReminder,
  getReminderTime,
  setReminderTime as persistReminderTime,
  formatTime,
} from "../lib/notifications";
import {
  checkBiometric,
  setFaceIdOn as persistFaceIdOn,
  authenticate,
} from "../lib/biometric";
import DateTimePicker from "@react-native-community/datetimepicker";

const APP_VERSION = "1.0.0";

// SKIN_GOALS 已合并到 Profile → Skin Profile（concerns 字段），不再在 settings 中维护

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
  const { colors: RC, isDark: dk } = useAppTheme();
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
          <Text style={[st.rowLabel, danger && st.rowLabelDanger, dk && { color: RC.gray900 }]}>
            {label}
          </Text>
          {sub && <Text style={[st.rowSub, dk && { color: RC.gray400 }]}>{sub}</Text>}
        </View>
        {value && <Text style={[st.rowValue, dk && { color: RC.gray400 }]}>{value}</Text>}
        {rightEl}
        {onPress && !rightEl && (
          <ChevronRight size={15} color={RC.gray300} />
        )}
      </TouchableOpacity>
      {!isLast && <View style={[st.separator, dk && { backgroundColor: RC.gray200 }]} />}
    </>
  );
}

export default function SettingsScreen() {
  const { user, setUser } = useUser();
  const { t, lang, setLang } = useT();
  const { mode: themeMode, setMode: setThemeMode, colors: C, shadow: S, isDark } = useAppTheme();
  const [showThemeSheet, setShowThemeSheet] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userMode, setUserMode] = useState<"guest" | "registered" | "vip">(
    "guest",
  );
  const [reminderOn, setReminderOn] = useState(false);
  const [reminderHour, setReminderHour] = useState(20);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [faceIdOn, setFaceIdOn] = useState(false);
  // skinGoals 已迁移到 Profile → Skin Profile
  const [dataConsentOn, setDataConsentOn] = useState(false);
  const [consentAcceptedAt, setConsentAcceptedAt] = useState<string | null>(null);
  const [showLangSheet, setShowLangSheet] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const name = (await AsyncStorage.getItem("@aurasight_user_name")) ?? "";
    const email = (await AsyncStorage.getItem("@aurasight_user_email")) ?? "";
    const mode =
      (await AsyncStorage.getItem("@aurasight_user_mode")) ?? "guest";
    const reminder = await AsyncStorage.getItem("@aurasight_reminder_on");
    const faceId = await AsyncStorage.getItem("@aurasight_faceid_on");
    const { hour, minute } = await getReminderTime();
    setUserName(name);
    setUserEmail(email);
    setUserMode(mode as any);
    setReminderOn(reminder === "true");
    setReminderHour(hour);
    setReminderMinute(minute);
    setFaceIdOn(faceId === "true");
    const consent = await getConsent();
    setDataConsentOn(consent.accepted);
    setConsentAcceptedAt(consent.acceptedAt);
  }

  async function toggleDataConsent(val: boolean) {
    if (val) {
      Alert.alert(
        t("settings.consent.allowTitle"),
        t("settings.consent.allowMsg"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.iAgree"),
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
      Alert.alert(
        t("settings.consent.revokeTitle"),
        t("settings.consent.revokeMsg"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.revoke"),
            style: "destructive",
            onPress: async () => {
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
    if (val) {
      // 先请求系统通知权限
      const ok = await ensurePermission();
      if (!ok) {
        Alert.alert("🔔", t("notif.permissionDenied"), [
          { text: t("common.gotIt") },
        ]);
        return;
      }
      const id = await scheduleDailyReminder(
        reminderHour,
        reminderMinute,
        t("notif.title"),
        t("notif.body"),
      );
      if (id) {
        setReminderOn(true);
        await AsyncStorage.setItem("@aurasight_reminder_on", "true");
      } else {
        Alert.alert("🔔", "Failed to schedule reminder.");
      }
    } else {
      await disableReminder();
      setReminderOn(false);
      await AsyncStorage.setItem("@aurasight_reminder_on", "false");
    }
  }

  async function handleTimeChange(_event: any, date?: Date) {
    // Android 弹窗会在选完后自动关；iOS 的 spinner 留在页面上
    if (Platform.OS === "android") setShowTimePicker(false);
    if (!date) return;
    const h = date.getHours();
    const m = date.getMinutes();
    setReminderHour(h);
    setReminderMinute(m);
    await persistReminderTime(h, m);
    // 如果开关已经打开，立刻重新 schedule 到新时间
    if (reminderOn) {
      await scheduleDailyReminder(h, m, t("notif.title"), t("notif.body"));
    }
  }

  async function toggleFaceId(val: boolean) {
    if (val) {
      const cap = await checkBiometric();
      if (cap === "no_hardware") {
        Alert.alert("🔒", t("faceId.unavailable"), [{ text: t("common.gotIt") }]);
        return;
      }
      if (cap === "not_enrolled") {
        Alert.alert("🔒", t("faceId.notEnrolled"), [{ text: t("common.gotIt") }]);
        return;
      }
      // 让用户先做一次验证，证明他们真的能用 → 避免锁死自己
      const ok = await authenticate(t("faceId.prompt"));
      if (!ok) return;
      await persistFaceIdOn(true);
      setFaceIdOn(true);
    } else {
      await persistFaceIdOn(false);
      setFaceIdOn(false);
    }
  }

  function handlePickLang(next: Lang) {
    setLang(next);
    setShowLangSheet(false);
  }

  // Dark mode helper for card overrides
  const dkCard = { backgroundColor: C.cardBg, borderColor: C.gray200 } as const;

  const isLoggedIn = userMode !== "guest";
  const initials = userName ? userName.charAt(0).toUpperCase() : "?";
  const modeLabel =
    userMode === "vip" ? "VIP ✦" : userMode === "registered" ? "Free" : "Guest";
  const modeBg = userMode === "vip" ? "rgba(253,230,138,0.25)" : "rgba(255,255,255,0.25)";
  const modeColor = userMode === "vip" ? "#fde68a" : "#fff";

  return (
    <View style={st.root}>
      <LinearGradient
        colors={isDark ? [C.background, C.background, C.cardBg] : ["#FFF3F6", "#FFF9FB", "#FFFFFF"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── HERO 顶部：玫瑰渐变，品牌一致 ── */}
      <LinearGradient colors={["#F43F8F", "#F472B6", "#FB9FBD"]} style={st.hero}>
        <SafeAreaView edges={["top"]}>
          <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
            <Text style={st.backText}>{t("common.back")}</Text>
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
              <Text style={st.vipBannerText}>{t("settings.vipBanner")}</Text>
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
        {/* ── skin goals 已合并到 Profile → Skin Profile ── */}

        {/* ── 通知 ── */}
        <Text style={[st.sectionLabel, isDark && { color: C.gray400 }]}>{t("settings.section.notifications")}</Text>
        <View style={[st.card, S.card, isDark && dkCard]}>
          <Row
            iconBg={isDark ? C.gray200 : "#fff0f6"}
            iconEl={<Bell size={15} color={Colors.rose400} />}
            label={t("settings.dailyReminder")}
            sub={t("settings.dailyReminder.sub")}
            isFirst
            isLast={!reminderOn}
            rightEl={
              <Switch
                value={reminderOn}
                onValueChange={toggleReminder}
                trackColor={{ false: C.gray200, true: Colors.rose300 }}
                thumbColor={reminderOn ? Colors.rose400 : (isDark ? C.gray300 : "#fff")}
              />
            }
          />
          {/* 提醒时间 — 只在开启时显示 */}
          {reminderOn && (
            <Row
              iconBg={isDark ? C.gray200 : "#fff0f6"}
              iconEl={<Clock size={15} color={Colors.rose400} />}
              label={t("settings.reminderTime")}
              value={formatTime(reminderHour, reminderMinute)}
              onPress={() => setShowTimePicker(true)}
              isLast
            />
          )}
        </View>

        {/* 时间选择器 — 统一用 modal 底部弹出 */}
        {Platform.OS === "android" && showTimePicker && (
          <DateTimePicker
            value={(() => {
              const d = new Date();
              d.setHours(reminderHour);
              d.setMinutes(reminderMinute);
              return d;
            })()}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}

        {/* ── 隐私 & 安全 ── */}
        <Text style={[st.sectionLabel, isDark && { color: C.gray400 }]}>{t("settings.section.privacy")}</Text>
        <View style={[st.card, S.card, isDark && dkCard]}>
          <Row
            iconBg={isDark ? C.gray200 : "#fff0f6"}
            iconEl={<Lock size={15} color={Colors.rose400} />}
            label={t("settings.faceId")}
            sub={t("settings.faceId.sub")}
            isFirst
            rightEl={
              <Switch
                value={faceIdOn}
                onValueChange={toggleFaceId}
                trackColor={{ false: C.gray200, true: Colors.rose300 }}
                thumbColor={faceIdOn ? Colors.rose400 : (isDark ? C.gray300 : "#fff")}
              />
            }
          />
          <Row
            iconBg={isDark ? C.gray200 : "#fdf2f8"}
            iconEl={<ShieldCheck size={15} color={Colors.rose400} />}
            label={t("settings.photoDataUse")}
            sub={
              dataConsentOn
                ? consentAcceptedAt
                  ? `${t("settings.consent.agreed")} ${new Date(consentAcceptedAt).toLocaleDateString()}`
                  : t("settings.consent.agreed")
                : t("settings.consent.needed")
            }
            rightEl={
              <Switch
                value={dataConsentOn}
                onValueChange={toggleDataConsent}
                trackColor={{ false: C.gray200, true: Colors.rose300 }}
                thumbColor={dataConsentOn ? Colors.rose400 : (isDark ? C.gray300 : "#fff")}
              />
            }
          />
          <Row
            iconBg={isDark ? C.gray200 : "#f0f9ff"}
            iconEl={<Shield size={15} color="#3b82f6" />}
            label={t("settings.privacyPolicy")}
            onPress={() => router.push("/privacy")}
          />
          <Row
            iconBg={isDark ? C.gray200 : "#f0fdf4"}
            iconEl={<FileText size={15} color={Colors.emerald} />}
            label={t("settings.terms")}
            onPress={() => router.push("/terms")}
            isLast
          />
        </View>

        {/* ── 个性化 ── */}
        <Text style={[st.sectionLabel, isDark && { color: C.gray400 }]}>{t("settings.section.personalization")}</Text>
        <View style={[st.card, S.card, isDark && dkCard]}>
          <Row
            iconBg={isDark ? C.gray200 : "#fff7ed"}
            iconEl={<Globe size={15} color="#f97316" />}
            label={t("settings.language")}
            value={lang === "zh" ? "中文" : lang === "es" ? "Español" : "English"}
            onPress={() => { setShowLangSheet(p => !p); setShowThemeSheet(false); }}
            isFirst
          />
          <Row
            iconBg={isDark ? "#2a2a3a" : "#1f2937"}
            iconEl={<Moon size={15} color={isDark ? "#fbbf24" : "#e2e8f0"} />}
            label={t("settings.appearance")}
            value={themeMode === "light" ? t("settings.appearance.light") : themeMode === "dark" ? t("settings.appearance.dark") : t("settings.appearance.system")}
            onPress={() => { setShowThemeSheet(p => !p); setShowLangSheet(false); }}
            isLast
          />
        </View>

        {/* 语言选择器 — 简易 inline sheet */}
        {showLangSheet && (
          <View style={[st.card, S.card, isDark && dkCard, { marginTop: -8 }]}>
            {(["en", "zh", "es"] as const).map((l, i, arr) => (
              <React.Fragment key={l}>
                <TouchableOpacity
                  onPress={() => handlePickLang(l)}
                  style={[st.row, i === 0 && st.rowFirst, i === arr.length - 1 && st.rowLast]}
                  activeOpacity={0.7}
                >
                  <View style={[st.rowIcon, { backgroundColor: isDark ? C.gray200 : "#fff7ed" }]}>
                    <Text style={{ fontSize: 14 }}>
                      {l === "en" ? "🇺🇸" : l === "zh" ? "🇨🇳" : "🇪🇸"}
                    </Text>
                  </View>
                  <View style={st.rowMid}>
                    <Text style={[st.rowLabel, isDark && { color: C.gray900 }]}>
                      {l === "en" ? "English" : l === "zh" ? "中文" : "Español"}
                    </Text>
                  </View>
                  {lang === l && <Check size={16} color={Colors.rose400} />}
                </TouchableOpacity>
                {i < arr.length - 1 && <View style={[st.separator, isDark && { backgroundColor: C.gray200 }]} />}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* 主题选择器 — inline sheet */}
        {showThemeSheet && (
          <View style={[st.card, S.card, isDark && dkCard, { marginTop: -8 }]}>
            {([
              { key: "light" as ThemeMode, labelKey: "settings.appearance.light", icon: "☀️" },
              { key: "dark" as ThemeMode, labelKey: "settings.appearance.dark", icon: "🌙" },
              { key: "system" as ThemeMode, labelKey: "settings.appearance.system", icon: "📱" },
            ]).map((item, i) => (
              <React.Fragment key={item.key}>
                <TouchableOpacity
                  onPress={() => { setThemeMode(item.key); setShowThemeSheet(false); }}
                  style={[st.row, i === 0 && st.rowFirst, i === 2 && st.rowLast]}
                  activeOpacity={0.7}
                >
                  <View style={[st.rowIcon, { backgroundColor: isDark ? C.gray200 : "#f5f3ff" }]}>
                    <Text style={{ fontSize: 14 }}>{item.icon}</Text>
                  </View>
                  <View style={st.rowMid}>
                    <Text style={[st.rowLabel, isDark && { color: C.gray900 }]}>{t(item.labelKey)}</Text>
                  </View>
                  {themeMode === item.key && <Check size={16} color={Colors.rose400} />}
                </TouchableOpacity>
                {i < 2 && <View style={[st.separator, isDark && { backgroundColor: C.gray200 }]} />}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* ── 帮助 & 反馈 ── */}
        <Text style={[st.sectionLabel, isDark && { color: C.gray400 }]}>{t("settings.section.help")}</Text>
        <View style={[st.card, S.card, isDark && dkCard]}>
          <Row
            iconBg={isDark ? C.gray200 : "#f0fdf4"}
            iconEl={<MessageSquare size={15} color={Colors.emerald} />}
            label={t("settings.sendFeedback")}
            sub={t("settings.sendFeedback.sub")}
            onPress={() =>
              Linking.openURL(
                "mailto:hello@aurasight.app?subject=AuraSight Feedback",
              )
            }
            isFirst
            isLast
          />
        </View>

        {/* ── 关于 ── */}
        <Text style={[st.sectionLabel, isDark && { color: C.gray400 }]}>{t("settings.section.about")}</Text>
        <View style={[st.card, S.card, isDark && dkCard]}>
          <Row
            iconBg={isDark ? C.gray200 : "#f5f3ff"}
            iconEl={<Info size={15} color="#8b5cf6" />}
            label={t("settings.version")}
            value={`v${APP_VERSION}`}
            onPress={() => router.push("/about")}
            isFirst
            isLast
          />
        </View>

        {/* ── 开发者测试 ── */}
        <Text style={[st.sectionLabel, isDark && { color: C.gray400 }]}>{t("settings.section.dev")}</Text>
        <View style={[st.card, S.card, isDark && dkCard]}>
          <Row
            iconBg={isDark ? C.gray200 : "#fef9c3"}
            iconEl={<Crown size={15} color="#d97706" />}
            label={t("settings.devTools.switchVip")}
            sub={`${t("settings.devTools.current")}: ${userMode}`}
            onPress={async () => {
              const next = userMode === "vip" ? "registered" : "vip";
              // 通过 UserContext.setUser 双写两个 key，保证 useUser() 立刻拿到新 mode
              if (user) {
                await setUser({ ...user, mode: next });
              } else {
                await AsyncStorage.setItem("@aurasight_user_mode", next);
              }
              setUserMode(next as any);
              Alert.alert(next === "vip" ? "VIP activated!" : "✓ Switched to Free", `Mode is now: ${next}`);
            }}
            isFirst
            isLast
          />
        </View>

        {/* Sign Out / Delete Account 不放这里 —— 归 Profile 页 */}

        <Text style={[st.footer, isDark && { color: C.gray400 }]}>AuraSight v{APP_VERSION} · Made with 💗</Text>
      </ScrollView>

      {/* ── iOS time picker modal ── */}
      {Platform.OS === "ios" && (
        <Modal visible={showTimePicker} transparent animationType="slide">
          <Pressable style={st.tpOverlay} onPress={() => setShowTimePicker(false)}>
            <Pressable style={[st.tpSheet, isDark && { backgroundColor: C.cardBg }]} onPress={() => {}}>
              <View style={[st.tpHeader, isDark && { borderBottomColor: C.gray200 }]}>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text style={[st.tpCancel, isDark && { color: C.gray400 }]}>{t("common.cancel")}</Text>
                </TouchableOpacity>
                <Text style={[st.tpTitle, isDark && { color: C.gray900 }]}>{t("settings.reminderTime")}</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text style={st.tpDone}>{t("common.done")}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={(() => {
                  const d = new Date();
                  d.setHours(reminderHour);
                  d.setMinutes(reminderMinute);
                  return d;
                })()}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                themeVariant={isDark ? "dark" : "light"}
                style={{ height: 200 }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
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
  // time picker modal (iOS)
  tpOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  tpSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // safe area 底部
  },
  tpHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  tpCancel: { fontSize: FontSize.sm, color: Colors.gray400, fontWeight: "600" },
  tpTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.gray800 },
  tpDone: { fontSize: FontSize.sm, color: Colors.rose400, fontWeight: "700" },
});
