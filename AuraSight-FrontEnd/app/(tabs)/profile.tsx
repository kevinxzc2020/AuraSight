import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Modal,
  Pressable,
  Share,
  Switch,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useT } from "../../lib/i18n";
import { LinearGradient } from "expo-linear-gradient";
import { FadeInComponent, StaggeredList } from "../../lib/animations";
import Animated from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import {
  User,
  Mail,
  Lock,
  LogOut,
  ChevronRight,
  Crown,
  Settings,
  Flame,
  Camera as CameraIcon,
  Sparkles,
  Activity,
  Download,
  Trash2,
  Edit3,
  Bell,
  Gift,
  Info,
  Shield,
  FileText,
  X,
  Copy,
  Share2,
  Eye,
  EyeOff,
  Scan,
  BarChart3,
  MessageCircle,
  Star,
} from "lucide-react-native";
import {
  Colors,
  Gradients,
  Spacing,
  Radius,
  FontSize,
  Shadow,
} from "../../constants/theme";
import { useAppTheme } from "../../lib/themeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useUser } from "../../lib/userContext";
import { migrateGuestScans, getUserId } from "../../lib/userId";
import { getStats, getRecentScans, StatsResult, ScanRecord } from "../../lib/mongodb";
import {
  uploadAvatar,
  removeAvatar,
  fetchUser,
  updateProfile,
  changePassword,
  fetchHealthProfile,
  updateHealthProfile,
  fetchReferral,
  redeemReferral,
  HealthProfile,
  ReferralInfo,
  SkinType,
  SkinConcern,
  RoutineLevel,
  Climate,
} from "../../lib/userApi";
import {
  getReminderTime,
  isReminderOn,
  ensurePermission,
  scheduleDailyReminder,
  disableReminder,
  formatTime,
} from "../../lib/notifications";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.59:3000";

interface AppUser {
  id: string;
  name: string;
  email: string;
  mode: "guest" | "registered" | "vip";
}

interface BodyCompLatest {
  date: string;
  bodyFatPct: number;
}

interface ProfileMeta {
  stats: StatsResult | null;
  daysSinceJoined: number | null;
  latestBodyComp: BodyCompLatest | null;
}

const EMPTY_META: ProfileMeta = {
  stats: null,
  daysSinceJoined: null,
  latestBodyComp: null,
};

export default function ProfileScreen() {
  const { colors: C, shadow: S, isDark } = useAppTheme();
  const { t } = useT();
  const { setUser: setCtxUser, clearUser: clearCtxUser } = useUser();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotResult, setForgotResult] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [meta, setMeta] = useState<ProfileMeta>(EMPTY_META);

  // 新增状态
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [health, setHealth] = useState<HealthProfile>({});
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [reminderOn, setReminderOn] = useState(false);
  const [reminderLabel, setReminderLabel] = useState("20:00");

  useEffect(() => {
    loadUser();
  }, []);

  // Profile tab 每次聚焦都刷新 meta（用户可能刚扫完/改过 settings）
  useFocusEffect(
    React.useCallback(() => {
      loadMeta();
    }, []),
  );

  async function loadMeta() {
    try {
      const uid = await getUserId();
      const [stats, scans, bcRaw] = await Promise.all([
        getStats(uid).catch(() => null),
        getRecentScans(uid, 100).catch(() => [] as ScanRecord[]),
        AsyncStorage.getItem("@aurasight_body_comp_history"),
      ]);

      // 入伙天数：从最早一次扫描算起（没有就 null）
      let daysSinceJoined: number | null = null;
      if (scans.length > 0) {
        const earliest = scans.reduce((min, s) =>
          new Date(s.scan_date) < new Date(min.scan_date) ? s : min,
        );
        const diff =
          (Date.now() - new Date(earliest.scan_date).getTime()) /
          (1000 * 60 * 60 * 24);
        daysSinceJoined = Math.max(1, Math.floor(diff) + 1);
      }

      let latestBodyComp: BodyCompLatest | null = null;
      if (bcRaw) {
        try {
          const arr = JSON.parse(bcRaw) as Array<{
            date: string;
            bodyFatPct: number;
          }>;
          if (arr.length > 0) {
            latestBodyComp = {
              date: arr[0].date,
              bodyFatPct: arr[0].bodyFatPct,
            };
          }
        } catch {}
      }

      setMeta({
        stats,
        daysSinceJoined,
        latestBodyComp,
      });
    } catch (err) {
      console.warn("loadMeta failed", err);
    }
  }

  async function handleExportData() {
    // V1：提示 + 未来接后端 export endpoint
    Alert.alert(
      "Export your data",
      "We'll email a JSON export of all your scans and diary entries. This may take up to 24 hours.",
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: "Request Export",
          onPress: () =>
            Alert.alert("✅ Request sent", "Check your email in 24 hours."),
        },
      ],
    );
  }

  async function handleDeleteAccount() {
    // 双重确认，防误触。第二次确认后 AsyncStorage 清空 + 返回未登录态。
    // 后端账号删除的 API 以后接上（contact support@aurasight.app as fallback）。
    Alert.alert(
      "⚠️ Delete Account",
      "This will permanently delete your account and all local data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Are you absolutely sure?",
              "All photos, scans and diary entries will be lost forever.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, delete everything",
                  style: "destructive",
                  onPress: async () => {
                    await AsyncStorage.clear();
                    await clearCtxUser();
                    setUser(null);
                  },
                },
              ],
            ),
        },
      ],
    );
  }

  async function loadUser() {
    try {
      const mode = await AsyncStorage.getItem("@aurasight_user_mode");
      if (mode === "registered" || mode === "vip") {
        const id = (await AsyncStorage.getItem("@aurasight_user_id")) ?? "";
        const uname =
          (await AsyncStorage.getItem("@aurasight_user_name")) ?? "";
        const uemail =
          (await AsyncStorage.getItem("@aurasight_user_email")) ?? "";
        setUser({ id, name: uname, email: uemail, mode: mode as any });
        // 并行拉远端数据，失败不阻塞页面
        loadRemoteProfile(id);
        loadReminderState();
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadRemoteProfile(userId: string) {
    if (!userId) return;
    try {
      const [u, h, r] = await Promise.all([
        fetchUser(userId).catch(() => null),
        fetchHealthProfile(userId).catch(() => ({})),
        fetchReferral(userId).catch(() => null),
      ]);
      if (u?.avatar_url) setAvatarUrl(u.avatar_url);
      if (h) setHealth(h);
      if (r) setReferral(r);
    } catch (err) {
      console.warn("loadRemoteProfile failed", err);
    }
  }

  async function loadReminderState() {
    try {
      const on = await isReminderOn();
      const { hour, minute } = await getReminderTime();
      setReminderOn(on);
      setReminderLabel(formatTime(hour, minute));
    } catch {}
  }

  // ─── Avatar ─────────────────────────────────────────────
  async function handleAvatarTap() {
    if (!user) return;
    Alert.alert("Profile photo", undefined, [
      { text: "Take photo", onPress: () => pickAvatar("camera") },
      { text: "Choose from library", onPress: () => pickAvatar("library") },
      ...(avatarUrl
        ? [
            {
              text: "Remove photo",
              style: "destructive" as const,
              onPress: handleRemoveAvatar,
            },
          ]
        : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  async function pickAvatar(source: "camera" | "library") {
    try {
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission needed", "Camera access is required.");
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission needed", "Photo library access is required.");
          return;
        }
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
              base64: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
              base64: true,
            });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert("Error", "Could not read image.");
        return;
      }

      setAvatarUploading(true);
      const { avatar_url } = await uploadAvatar(user!.id, asset.base64);
      setAvatarUrl(avatar_url);
    } catch (err: any) {
      Alert.alert("Upload failed", err.message ?? "Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleRemoveAvatar() {
    if (!user) return;
    try {
      setAvatarUploading(true);
      await removeAvatar(user.id);
      setAvatarUrl(null);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setAvatarUploading(false);
    }
  }

  // ─── Edit profile / password ────────────────────────────
  async function handleSaveProfile(newName: string, newEmail: string) {
    if (!user) return;
    try {
      const patch: { name?: string; email?: string } = {};
      if (newName && newName !== user.name) patch.name = newName;
      if (newEmail && newEmail !== user.email) patch.email = newEmail.toLowerCase();
      if (!Object.keys(patch).length) {
        setEditProfileOpen(false);
        return;
      }
      const updated = await updateProfile(user.id, patch);
      const merged = {
        ...user,
        name: updated.name,
        email: updated.email,
      };
      setUser(merged);
      await AsyncStorage.setItem("@aurasight_user_name", updated.name);
      await AsyncStorage.setItem("@aurasight_user_email", updated.email);
      await setCtxUser({ ...merged });
      setEditProfileOpen(false);
    } catch (err: any) {
      Alert.alert("Update failed", err.message);
    }
  }

  async function handleChangePassword(oldPw: string, newPw: string) {
    if (!user) return;
    try {
      await changePassword(user.id, oldPw, newPw);
      setChangePwOpen(false);
      Alert.alert("✅ Password updated", "Use your new password next time.");
    } catch (err: any) {
      Alert.alert("Failed", err.message);
    }
  }

  // ─── Health profile ─────────────────────────────────────
  async function handleSaveHealth(patch: HealthProfile) {
    if (!user) return;
    try {
      const updated = await updateHealthProfile(user.id, patch);
      setHealth(updated);
      setHealthOpen(false);
    } catch (err: any) {
      Alert.alert("Save failed", err.message);
    }
  }

  // ─── Notifications ──────────────────────────────────────
  async function handleToggleReminder(next: boolean) {
    if (next) {
      const ok = await ensurePermission();
      if (!ok) {
        Alert.alert(
          "Notifications disabled",
          "Enable notifications in system settings to receive reminders.",
        );
        return;
      }
      const { hour, minute } = await getReminderTime();
      await scheduleDailyReminder(hour, minute, "Time to scan!", "Take a quick photo to track your skin today.");
      setReminderOn(true);
    } else {
      await disableReminder();
      setReminderOn(false);
    }
  }

  // ─── Referral ───────────────────────────────────────────
  async function handleShareReferral() {
    if (!referral) return;
    await Share.share({
      message: `Track your skin with AuraSight. Use my code ${referral.code} for 1 month free VIP: https://aurasight.app/invite/${referral.code}`,
    });
  }

  async function handleRedeemCode(code: string) {
    if (!user) return;
    try {
      const { vip_days_added } = await redeemReferral(user.id, code);
      Alert.alert("🎉 VIP activated", `+${vip_days_added} days added.`);
      // 刷新 user（mode 可能已升为 vip）
      const fresh = await fetchUser(user.id);
      const next = { ...user, mode: fresh.mode };
      setUser(next);
      await AsyncStorage.setItem("@aurasight_user_mode", fresh.mode);
      await setCtxUser(next);
      setInviteOpen(false);
    } catch (err: any) {
      Alert.alert("Redeem failed", err.message);
    }
  }

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed");

      await _saveUser(data);
      Alert.alert("✅ Welcome!", `Account created for ${name}`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter email and password.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");

      await _saveUser(data);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function _saveUser(data: any) {
    // 迁移：用户在匿名状态（guest_xxx）拍过的照片，登录后要挂到新账号下，
    // 否则会变成后端的孤儿记录（撤销同意、History、report 都看不到）。
    // 在覆盖 @aurasight_user_id 之前读出旧值，调用后端 merge。
    const prevId = await AsyncStorage.getItem("@aurasight_user_id");
    if (prevId && prevId !== data.id) {
      await migrateGuestScans(prevId, data.id);
    }
    await AsyncStorage.setItem("@aurasight_user_id", data.id);
    await AsyncStorage.setItem("@aurasight_user_name", data.name);
    await AsyncStorage.setItem("@aurasight_user_email", data.email);
    setUser({
      id: data.id,
      name: data.name,
      email: data.email,
      mode: "vip",
    });
    // 同步到全局 UserContext，让 camera 等页面立刻看到 VIP
    await setCtxUser({
      id: data.id,
      name: data.name,
      email: data.email,
      mode: "vip",
    });
  }

  async function handleLogout() {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove([
            "@aurasight_user_name",
            "@aurasight_user_email",
          ]);
          await clearCtxUser();
          setUser(null);
        },
      },
    ]);
  }

  async function handleForgotPassword() {
    if (!forgotEmail.trim()) {
      Alert.alert("Error", "Please enter your email.");
      return;
    }
    setForgotLoading(true);
    setForgotResult(null);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.temp_password) {
        setForgotResult(data.temp_password);
      } else {
        // 安全提示（不暴露邮箱是否存在）
        Alert.alert("Check your email", data.message ?? "If that email is registered, instructions have been sent.");
        setForgotOpen(false);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Something went wrong.");
    } finally {
      setForgotLoading(false);
    }
  }

  if (loading) {
    return (
      <LinearGradient colors={isDark ? [C.background, C.background, C.cardBg] : ["#FFF3F6", "#FFF9FB", "#FFFFFF"]} style={styles.center}>
        <ActivityIndicator size="large" color={Colors.rose400} />
      </LinearGradient>
    );
  }

  // ─── 已登录 ───────────────────────────────────────────────
  if (user) {
    const stats = meta.stats;
    const isVip = user.mode === "vip";
    const skinScore = stats?.avg_skin_score ?? null;
    const scoreLabel = skinScore !== null
      ? skinScore >= 80 ? "Excellent" : skinScore >= 60 ? "Good" : skinScore >= 40 ? "Fair" : "Needs care"
      : null;
    const scoreColor = skinScore !== null
      ? skinScore >= 80 ? "#10B981" : skinScore >= 60 ? "#3B82F6" : skinScore >= 40 ? "#F59E0B" : "#EF4444"
      : Colors.gray400;

    return (
      <LinearGradient colors={isDark ? [C.background, C.background, C.cardBg] : ["#FFF3F6", "#FFF9FB", "#FFFFFF"]} style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          {/* ── Top bar ── */}
          <View style={styles.topNav}>
            <Text style={[styles.topNavTitle, isDark && { color: C.gray900 }]}>{t("profile.title")}</Text>
            <TouchableOpacity
              onPress={() => router.push("/settings")}
              style={[styles.settingsBtn, isDark && { backgroundColor: C.cardBg }]}
            >
              <Settings size={20} color={isDark ? C.gray400 : Colors.gray500} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

            {/* ══════ HERO HEADER ══════ */}
            <FadeInComponent delay={0} duration={500} from="bottom">
              <LinearGradient
                colors={isDark ? ["#2A1F35", "#1E1528"] : ["#F43F8F", "#F472B6", "#FB9FBD"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroHeader}
              >
                {/* Decorative glows */}
                <View style={styles.heroGlow1} />
                <View style={styles.heroGlow2} />

                {/* Avatar */}
                <TouchableOpacity
                  onPress={handleAvatarTap}
                  activeOpacity={0.85}
                  style={styles.avatarWrap}
                >
                  <View style={styles.avatarRing}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                    ) : (
                      <LinearGradient
                        colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0.1)"]}
                        style={styles.avatar}
                      >
                        <Text style={styles.avatarText}>
                          {user.name.charAt(0).toUpperCase()}
                        </Text>
                      </LinearGradient>
                    )}
                  </View>
                  <View style={styles.avatarEditBadge}>
                    {avatarUploading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <CameraIcon size={11} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>

                <Text style={styles.heroName}>{user.name}</Text>
                <Text style={styles.heroEmail}>{user.email}</Text>

                {isVip && (
                  <View style={styles.vipTag}>
                    <Crown size={11} color="#fde68a" />
                    <Text style={styles.vipTagText}>{t("profile.vipBadge")}</Text>
                  </View>
                )}

                {/* Skin Score mini badge */}
                {skinScore !== null && (
                  <View style={styles.heroScoreBadge}>
                    <View style={[styles.heroScoreDot, { backgroundColor: scoreColor }]} />
                    <Text style={styles.heroScoreVal}>{skinScore}</Text>
                    <Text style={styles.heroScoreLbl}>{scoreLabel}</Text>
                  </View>
                )}
              </LinearGradient>
            </FadeInComponent>

            {/* ══════ STATS ROW ══════ */}
            <FadeInComponent delay={80} duration={400} from="bottom">
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
                  <LinearGradient colors={["#EFF6FF", "#DBEAFE"]} style={styles.statIconBg}>
                    <Text style={{ fontSize: 14 }}>📅</Text>
                  </LinearGradient>
                  <Text style={[styles.statVal, isDark && { color: C.gray900 }]}>
                    {meta.daysSinceJoined ?? "—"}
                  </Text>
                  <Text style={[styles.statLbl, isDark && { color: C.gray400 }]}>Days</Text>
                </View>
                <View style={[styles.statCard, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
                  <LinearGradient colors={["#FFF0F6", "#FCE7F3"]} style={styles.statIconBg}>
                    <Text style={{ fontSize: 14 }}>📸</Text>
                  </LinearGradient>
                  <Text style={[styles.statVal, isDark && { color: C.gray900 }]}>{stats?.total_scans ?? 0}</Text>
                  <Text style={[styles.statLbl, isDark && { color: C.gray400 }]}>{t("profile.totalScans")}</Text>
                </View>
                <View style={[styles.statCard, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
                  <LinearGradient colors={["#FFF7ED", "#FFEDD5"]} style={styles.statIconBg}>
                    <Flame size={14} color="#fb923c" />
                  </LinearGradient>
                  <Text style={[styles.statVal, { color: "#fb923c" }]}>
                    {stats?.streak ?? 0}
                  </Text>
                  <Text style={[styles.statLbl, isDark && { color: C.gray400 }]}>{t("profile.streak")}</Text>
                </View>
                <View style={[styles.statCard, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
                  <LinearGradient colors={["#ECFDF5", "#D1FAE5"]} style={styles.statIconBg}>
                    <Text style={{ fontSize: 14 }}>💯</Text>
                  </LinearGradient>
                  <Text style={[styles.statVal, isDark && { color: C.gray900 }]}>
                    {stats?.avg_skin_score ?? "—"}
                  </Text>
                  <Text style={[styles.statLbl, isDark && { color: C.gray400 }]}>{t("profile.avgScore")}</Text>
                </View>
              </View>
            </FadeInComponent>

            {/* ══════ VIP UPGRADE (non-VIP only) ══════ */}
            {!isVip && (
              <FadeInComponent delay={120} duration={400} from="bottom">
                <TouchableOpacity
                  onPress={() => router.push("/vip")}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={["#7C3AED", "#A855F7", "#C084FC"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.vipCard}
                  >
                    <View style={styles.vipCardGlow} />
                    <View style={styles.vipIconBg}>
                      <Crown size={18} color="#fde68a" />
                    </View>
                    <View style={styles.vipCardText}>
                      <Text style={styles.vipCardTitle}>Upgrade to VIP</Text>
                      <Text style={styles.vipCardSub}>
                        Free 7-day trial · then $4.99/mo
                      </Text>
                    </View>
                    <ChevronRight size={18} color="rgba(255,255,255,0.7)" />
                  </LinearGradient>
                </TouchableOpacity>
              </FadeInComponent>
            )}

            {/* ══════ QUICK ACTIONS ══════ */}
            <FadeInComponent delay={160} duration={400} from="bottom">
              <Text style={[styles.groupLabel, isDark && { color: C.gray400 }]}>Quick actions</Text>
              <View style={[styles.section, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
                <TouchableOpacity
                  style={styles.rowBtn}
                  onPress={() => router.push("/(tabs)/report")}
                  activeOpacity={0.7}
                >
                  <LinearGradient colors={["#FFF0F6", "#FCE7F3"]} style={styles.rowIconBg}>
                    <Sparkles size={15} color={Colors.rose400} />
                  </LinearGradient>
                  <View style={styles.rowBtnText}>
                    <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>{t("report.title")}</Text>
                    <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>
                      Trends, correlations, AI summary
                    </Text>
                  </View>
                  <ChevronRight size={15} color={isDark ? C.gray400 : Colors.gray300} />
                </TouchableOpacity>
                <View style={[styles.divider, isDark && { backgroundColor: C.gray200 }]} />
                <TouchableOpacity
                  style={styles.rowBtn}
                  onPress={() => router.push("/(tabs)/history")}
                  activeOpacity={0.7}
                >
                  <LinearGradient colors={["#EFF6FF", "#DBEAFE"]} style={styles.rowIconBg}>
                    <CameraIcon size={15} color="#3B82F6" />
                  </LinearGradient>
                  <View style={styles.rowBtnText}>
                    <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Scan history</Text>
                    <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>
                      {`${stats?.total_scans ?? 0} ${t("profile.totalScans")}`}
                    </Text>
                  </View>
                  <ChevronRight size={15} color={isDark ? C.gray400 : Colors.gray300} />
                </TouchableOpacity>
              </View>
            </FadeInComponent>

            {/* ══════ ACCOUNT SETTINGS ══════ */}
            <FadeInComponent delay={200} duration={400} from="bottom">
              <Text style={[styles.groupLabel, isDark && { color: C.gray400 }]}>Account</Text>
              <View style={[styles.section, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
                <TouchableOpacity
                  style={styles.rowBtn}
                  onPress={() => setEditProfileOpen(true)}
                  activeOpacity={0.7}
                >
                  <LinearGradient colors={["#F5F3FF", "#EDE9FE"]} style={styles.rowIconBg}>
                    <Edit3 size={15} color="#7C3AED" />
                  </LinearGradient>
                  <View style={styles.rowBtnText}>
                    <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Edit profile</Text>
                    <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>{`${user.name} · ${user.email}`}</Text>
                  </View>
                  <ChevronRight size={15} color={isDark ? C.gray400 : Colors.gray300} />
                </TouchableOpacity>
                <View style={[styles.divider, isDark && { backgroundColor: C.gray200 }]} />
                <TouchableOpacity
                  style={styles.rowBtn}
                  onPress={() => setChangePwOpen(true)}
                  activeOpacity={0.7}
                >
                  <LinearGradient colors={["#FEF3C7", "#FDE68A"]} style={styles.rowIconBg}>
                    <Lock size={15} color="#D97706" />
                  </LinearGradient>
                  <View style={styles.rowBtnText}>
                    <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Change password</Text>
                    <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>Keep your account secure</Text>
                  </View>
                  <ChevronRight size={15} color={isDark ? C.gray400 : Colors.gray300} />
                </TouchableOpacity>
                <View style={[styles.divider, isDark && { backgroundColor: C.gray200 }]} />
                <TouchableOpacity
                  style={styles.rowBtn}
                  onPress={() => setHealthOpen(true)}
                  activeOpacity={0.7}
                >
                  <LinearGradient colors={["#FFF0F6", "#FCE7F3"]} style={styles.rowIconBg}>
                    <Sparkles size={15} color={Colors.rose400} />
                  </LinearGradient>
                  <View style={styles.rowBtnText}>
                    <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>{t("profile.skinProfile")}</Text>
                    <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>
                      {formatHealthSummary(health, t)}
                    </Text>
                  </View>
                  <ChevronRight size={15} color={isDark ? C.gray400 : Colors.gray300} />
                </TouchableOpacity>
                <View style={[styles.divider, isDark && { backgroundColor: C.gray200 }]} />
                <View style={styles.rowBtn}>
                  <LinearGradient colors={["#ECFDF5", "#D1FAE5"]} style={styles.rowIconBg}>
                    <Bell size={15} color="#10B981" />
                  </LinearGradient>
                  <View style={styles.rowBtnText}>
                    <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Daily reminder</Text>
                    <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>
                      {reminderOn ? `On · ${reminderLabel}` : "Off"}
                    </Text>
                  </View>
                  <Switch
                    value={reminderOn}
                    onValueChange={handleToggleReminder}
                    trackColor={{ true: Colors.rose400, false: isDark ? C.gray200 : Colors.gray200 }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            </FadeInComponent>

            {/* ══════ INVITE FRIENDS ══════ */}
            <FadeInComponent delay={240} duration={400} from="bottom">
              <Text style={[styles.groupLabel, isDark && { color: C.gray400 }]}>Invite friends</Text>
              <TouchableOpacity
                onPress={() => setInviteOpen(true)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#FB923C", "#F43F8F"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.inviteCard}
                >
                  <View style={styles.inviteGlow} />
                  <View style={styles.inviteIconBg}>
                    <Gift size={18} color="#FB923C" />
                  </View>
                  <View style={styles.inviteCardText}>
                    <Text style={styles.inviteCardTitle}>
                      Give 30 days, get 30 days
                    </Text>
                    <Text style={styles.inviteCardSub}>
                      {referral
                        ? `Code: ${referral.code}${
                            referral.redemptions > 0
                              ? ` · ${referral.redemptions} friends joined`
                              : ""
                          }`
                        : "Tap to get your referral code"}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="rgba(255,255,255,0.7)" />
                </LinearGradient>
              </TouchableOpacity>
            </FadeInComponent>

            {/* ══════ ABOUT & DATA ══════ */}
            <FadeInComponent delay={280} duration={400} from="bottom">
              <Text style={[styles.groupLabel, isDark && { color: C.gray400 }]}>More</Text>
              <View style={[styles.section, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
                <TouchableOpacity
                  style={styles.rowBtn}
                  onPress={() => {
                    const url =
                      Platform.OS === "ios"
                        ? "https://apps.apple.com/app/idXXXXXXXXX?action=write-review"
                        : "https://play.google.com/store/apps/details?id=com.aurasight";
                    Alert.alert(t("settings.rate.alertTitle"), t("settings.rate.alertMsg"), [
                      { text: t("common.cancel"), style: "cancel" },
                      { text: t("common.open"), onPress: () => Linking.openURL(url) },
                    ]);
                  }}
                  activeOpacity={0.7}
                >
                  <LinearGradient colors={["#FEFCE8", "#FEF3C7"]} style={styles.rowIconBg}>
                    <Star size={15} color="#EAB308" />
                  </LinearGradient>
                  <View style={styles.rowBtnText}>
                    <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Rate AuraSight</Text>
                    <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>
                      Leave a review on app store
                    </Text>
                  </View>
                  <ChevronRight size={15} color={isDark ? C.gray400 : Colors.gray300} />
                </TouchableOpacity>
                <View style={[styles.divider, isDark && { backgroundColor: C.gray200 }]} />
                <TouchableOpacity
                  style={styles.rowBtn}
                  onPress={handleExportData}
                  activeOpacity={0.7}
                >
                  <LinearGradient colors={["#EFF6FF", "#DBEAFE"]} style={styles.rowIconBg}>
                    <Download size={15} color="#3B82F6" />
                  </LinearGradient>
                  <View style={styles.rowBtnText}>
                    <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Export my data</Text>
                    <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>
                      JSON copy of scans & diary
                    </Text>
                  </View>
                  <ChevronRight size={15} color={isDark ? C.gray400 : Colors.gray300} />
                </TouchableOpacity>
                <View style={[styles.divider, isDark && { backgroundColor: C.gray200 }]} />
                <View style={styles.rowBtn}>
                  <LinearGradient colors={["#F3F4F6", "#E5E7EB"]} style={styles.rowIconBg}>
                    <Info size={15} color={Colors.gray500} />
                  </LinearGradient>
                  <View style={styles.rowBtnText}>
                    <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Version</Text>
                    <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>
                      {Constants.expoConfig?.version ?? "—"}
                    </Text>
                  </View>
                </View>
                <View style={[styles.divider, isDark && { backgroundColor: C.gray200 }]} />
                <TouchableOpacity
                  style={styles.rowBtn}
                  onPress={() => router.push("/privacy")}
                  activeOpacity={0.7}
                >
                  <LinearGradient colors={["#ECFDF5", "#D1FAE5"]} style={styles.rowIconBg}>
                    <Shield size={15} color="#10B981" />
                  </LinearGradient>
                  <View style={styles.rowBtnText}>
                    <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Privacy policy</Text>
                  </View>
                  <ChevronRight size={15} color={isDark ? C.gray400 : Colors.gray300} />
                </TouchableOpacity>
                <View style={[styles.divider, isDark && { backgroundColor: C.gray200 }]} />
                <TouchableOpacity
                  style={styles.rowBtn}
                  onPress={() => router.push("/terms")}
                  activeOpacity={0.7}
                >
                  <LinearGradient colors={["#F3F4F6", "#E5E7EB"]} style={styles.rowIconBg}>
                    <FileText size={15} color={Colors.gray500} />
                  </LinearGradient>
                  <View style={styles.rowBtnText}>
                    <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Terms of service</Text>
                  </View>
                  <ChevronRight size={15} color={isDark ? C.gray400 : Colors.gray300} />
                </TouchableOpacity>
              </View>
            </FadeInComponent>

            {/* ── Danger zone ── */}
            <FadeInComponent delay={320} duration={400} from="bottom">
              <View style={[styles.section, styles.dangerSection, isDark && { backgroundColor: C.cardBg, borderColor: "rgba(239,68,68,0.15)" }]}>
                <TouchableOpacity
                  style={styles.rowBtn}
                  onPress={handleDeleteAccount}
                  activeOpacity={0.7}
                >
                  <View style={styles.dangerIconBg}>
                    <Trash2 size={15} color="#EF4444" />
                  </View>
                  <View style={styles.rowBtnText}>
                    <Text style={[styles.rowBtnTitle, { color: "#EF4444" }]}>
                      Delete account
                    </Text>
                    <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>Permanent, can't be undone</Text>
                  </View>
                  <ChevronRight size={15} color="rgba(239,68,68,0.3)" />
                </TouchableOpacity>
              </View>
            </FadeInComponent>

            {/* ── Sign out ── */}
            <FadeInComponent delay={350} duration={400} from="none">
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
                <LogOut size={15} color={Colors.gray400} />
                <Text style={[styles.logoutText, isDark && { color: C.gray400 }]}>{t("common.signOut")}</Text>
              </TouchableOpacity>
            </FadeInComponent>

            {/* ── Modals ── */}
            <EditProfileModal
              visible={editProfileOpen}
              onClose={() => setEditProfileOpen(false)}
              initialName={user.name}
              initialEmail={user.email}
              onSave={handleSaveProfile}
            />
            <ChangePasswordModal
              visible={changePwOpen}
              onClose={() => setChangePwOpen(false)}
              onSubmit={handleChangePassword}
            />
            <HealthProfileModal
              visible={healthOpen}
              onClose={() => setHealthOpen(false)}
              initial={health}
              onSave={handleSaveHealth}
            />
            <InviteModal
              visible={inviteOpen}
              onClose={() => setInviteOpen(false)}
              referral={referral}
              onShare={handleShareReferral}
              onRedeem={handleRedeemCode}
            />
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ─── 未登录 ───────────────────────────────────────────────
  return (
    <LinearGradient colors={isDark ? [C.background, C.background, C.cardBg] : ["#FFF3F6", "#FFF9FB", "#FFFFFF"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* ── Hero 卖点区 ── */}
            <LinearGradient
              colors={["#F472B6", "#FB923C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <Text style={styles.heroBrand}>AuraSight</Text>
              <Text style={styles.heroTitle}>
                Your skin journey{"\n"}starts here
              </Text>
              <View style={styles.heroFeatures}>
                <View style={styles.heroFeatureRow}>
                  <Scan size={16} color="#fff" />
                  <Text style={styles.heroFeatureText}>AI-powered acne scan in seconds</Text>
                </View>
                <View style={styles.heroFeatureRow}>
                  <BarChart3 size={16} color="#fff" />
                  <Text style={styles.heroFeatureText}>Track progress with daily skin scores</Text>
                </View>
                <View style={styles.heroFeatureRow}>
                  <MessageCircle size={16} color="#fff" />
                  <Text style={styles.heroFeatureText}>Personalized skincare advice</Text>
                </View>
              </View>
            </LinearGradient>

            {/* ── Tab 切换 ── */}
            <View style={styles.tabRow}>
              {(["login", "register"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={styles.tabItem}
                  onPress={() => {
                    setTab(t);
                    setShowPassword(false);
                  }}
                >
                  <Text
                    style={[styles.tabText, tab === t && styles.tabTextActive]}
                  >
                    {t === "login" ? "Sign In" : "Sign Up"}
                  </Text>
                  {tab === t && <View style={styles.tabUnderline} />}
                </TouchableOpacity>
              ))}
            </View>

            {/* ── 表单 ── */}
            <View style={[styles.form, S.card, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
              {tab === "register" && (
                <View style={[styles.inputWrap, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
                  <User size={16} color={Colors.gray400} />
                  <TextInput
                    style={[styles.input, isDark && { color: C.gray900 }]}
                    placeholder="Your name"
                    placeholderTextColor={isDark ? C.gray400 : Colors.gray300}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              )}

              <View style={[styles.inputWrap, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
                <Mail size={16} color={Colors.gray400} />
                <TextInput
                  style={[styles.input, isDark && { color: C.gray900 }]}
                  placeholder="Email address"
                  placeholderTextColor={isDark ? C.gray400 : Colors.gray300}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={[styles.inputWrap, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
                <Lock size={16} color={Colors.gray400} />
                <TextInput
                  style={[styles.input, { flex: 1 }, isDark && { color: C.gray900 }]}
                  placeholder="Password"
                  placeholderTextColor={isDark ? C.gray400 : Colors.gray300}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={Colors.gray400} />
                  ) : (
                    <Eye size={18} color={Colors.gray400} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Forgot password (登录时才显示) */}
              {tab === "login" && (
                <TouchableOpacity
                  onPress={() => {
                    setForgotEmail(email);
                    setForgotResult(null);
                    setForgotOpen(true);
                  }}
                  style={styles.forgotBtn}
                >
                  <Text style={[styles.forgotText, isDark && { color: Colors.rose400 }]}>Forgot password?</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={tab === "login" ? handleLogin : handleRegister}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={Gradients.roseMain}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitBtn}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>
                      {tab === "login" ? "Sign In" : "Create Account"}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* ── Continue as guest 按钮 ── */}
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/camera")}
              style={styles.guestBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.guestBtnText}>Continue as guest</Text>
            </TouchableOpacity>
            <Text style={styles.guestHint}>
              Your data stays on this device only
            </Text>

            {/* ── Privacy / Terms ── */}
            <View style={styles.legalRow}>
              <TouchableOpacity onPress={() => router.push("/privacy")}>
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text style={styles.legalDot}>·</Text>
              <TouchableOpacity onPress={() => router.push("/terms")}>
                <Text style={styles.legalLink}>Terms of Service</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ── Forgot Password Modal ── */}
      <Modal visible={forgotOpen} transparent animationType="fade" onRequestClose={() => setForgotOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setForgotOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset password</Text>
              <TouchableOpacity onPress={() => setForgotOpen(false)} style={styles.modalCloseBtn}>
                <X size={18} color={Colors.gray500} />
              </TouchableOpacity>
            </View>

            {forgotResult ? (
              <View style={styles.forgotResultWrap}>
                <Text style={styles.forgotResultLabel}>Your temporary password</Text>
                <Text style={styles.forgotResultCode}>{forgotResult}</Text>
                <Text style={styles.forgotResultHint}>
                  Use this to sign in, then change your password in Profile → Account settings.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setPassword(forgotResult);
                    setForgotOpen(false);
                    setTab("login");
                  }}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={Gradients.roseMain} style={styles.submitBtn}>
                    <Text style={styles.submitText}>Go to Sign In</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.modalHint}>
                  Enter your email and we'll generate a temporary password.
                </Text>
                <View style={styles.inputWrap}>
                  <Mail size={16} color={Colors.gray400} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email address"
                    placeholderTextColor={Colors.gray300}
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <TouchableOpacity onPress={handleForgotPassword} disabled={forgotLoading} activeOpacity={0.85}>
                  <LinearGradient colors={Gradients.roseMain} style={styles.submitBtn}>
                    {forgotLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitText}>Reset password</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

// ─── 辅助 ───────────────────────────────────────────────

function formatHealthSummary(h: HealthProfile, t: ReturnType<typeof useT>["t"]): string {
  const parts: string[] = [];
  if (h.skin_type) parts.push(t(`profile.sp.${h.skin_type}`));
  if (h.concerns?.length) parts.push(`${h.concerns.length} concern${h.concerns.length > 1 ? "s" : ""}`);
  if (h.routine_level) parts.push(h.routine_level);
  if (h.gender) parts.push(h.gender);
  return parts.length ? parts.join(" · ") : "Tap to set up";
}

// ─── Modals ──────────────────────────────────────────────

function ModalShell({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const { colors: C, isDark } = useAppTheme();
  const { t } = useT();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalSheet, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200, borderWidth: 1 }]}
          onPress={() => {}}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDark && { color: C.gray900 }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalCloseBtn, isDark && { backgroundColor: C.gray200 }]}>
              <X size={18} color={isDark ? C.gray400 : Colors.gray500} />
            </TouchableOpacity>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function EditProfileModal({
  visible,
  onClose,
  initialName,
  initialEmail,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  initialName: string;
  initialEmail: string;
  onSave: (name: string, email: string) => void;
}) {
  const { colors: C, isDark } = useAppTheme();
  const { t } = useT();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  useEffect(() => {
    if (visible) {
      setName(initialName);
      setEmail(initialEmail);
    }
  }, [visible, initialName, initialEmail]);

  return (
    <ModalShell visible={visible} onClose={onClose} title="Edit profile">
      <View style={[styles.inputWrap, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
        <User size={16} color={Colors.gray400} />
        <TextInput
          style={[styles.input, isDark && { color: C.gray900 }]}
          placeholder="Your name"
          placeholderTextColor={isDark ? C.gray400 : Colors.gray300}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      </View>
      <View style={[styles.inputWrap, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
        <Mail size={16} color={Colors.gray400} />
        <TextInput
          style={[styles.input, isDark && { color: C.gray900 }]}
          placeholder="Email address"
          placeholderTextColor={isDark ? C.gray400 : Colors.gray300}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
      <TouchableOpacity
        onPress={() => onSave(name.trim(), email.trim())}
        activeOpacity={0.85}
      >
        <LinearGradient colors={Gradients.roseMain} style={styles.submitBtn}>
          <Text style={styles.submitText}>{t("common.save")}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ModalShell>
  );
}

function ChangePasswordModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (oldPw: string, newPw: string) => void;
}) {
  const { colors: C, isDark } = useAppTheme();
  const { t } = useT();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  useEffect(() => {
    if (visible) {
      setOldPw("");
      setNewPw("");
      setConfirm("");
    }
  }, [visible]);

  function submit() {
    if (newPw.length < 6) {
      Alert.alert("Too short", "Password must be at least 6 characters.");
      return;
    }
    if (newPw !== confirm) {
      Alert.alert("Mismatch", "New passwords don't match.");
      return;
    }
    onSubmit(oldPw, newPw);
  }

  return (
    <ModalShell visible={visible} onClose={onClose} title="Change password">
      <View style={[styles.inputWrap, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
        <Lock size={16} color={Colors.gray400} />
        <TextInput
          style={[styles.input, isDark && { color: C.gray900 }]}
          placeholder="Current password"
          placeholderTextColor={isDark ? C.gray400 : Colors.gray300}
          value={oldPw}
          onChangeText={setOldPw}
          secureTextEntry
        />
      </View>
      <View style={[styles.inputWrap, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
        <Lock size={16} color={Colors.gray400} />
        <TextInput
          style={[styles.input, isDark && { color: C.gray900 }]}
          placeholder="New password"
          placeholderTextColor={isDark ? C.gray400 : Colors.gray300}
          value={newPw}
          onChangeText={setNewPw}
          secureTextEntry
        />
      </View>
      <View style={[styles.inputWrap, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
        <Lock size={16} color={Colors.gray400} />
        <TextInput
          style={[styles.input, isDark && { color: C.gray900 }]}
          placeholder="Confirm new password"
          placeholderTextColor={isDark ? C.gray400 : Colors.gray300}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />
      </View>
      <TouchableOpacity onPress={submit} activeOpacity={0.85}>
        <LinearGradient colors={Gradients.roseMain} style={styles.submitBtn}>
          <Text style={styles.submitText}>Update password</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ModalShell>
  );
}

const SKIN_TYPES: { id: SkinType; emoji: string; label: string }[] = [
  { id: "oily",        emoji: "💧", label: "Oily" },
  { id: "dry",         emoji: "🏜️", label: "Dry" },
  { id: "combination", emoji: "🔄", label: "Combination" },
  { id: "sensitive",   emoji: "🌸", label: "Sensitive" },
  { id: "normal",      emoji: "✨", label: "Normal" },
];

const CONCERN_OPTIONS: { id: SkinConcern; emoji: string; label: string }[] = [
  { id: "acne",       emoji: "🔴", label: "Acne" },
  { id: "dark_spots", emoji: "🟤", label: "Dark spots" },
  { id: "wrinkles",   emoji: "〰️", label: "Wrinkles" },
  { id: "redness",    emoji: "🩷", label: "Redness" },
  { id: "pores",      emoji: "🔍", label: "Large pores" },
  { id: "dryness",    emoji: "🥀", label: "Dryness" },
  { id: "oiliness",   emoji: "🫧", label: "Excess oil" },
];

const ROUTINE_LEVELS: { id: RoutineLevel; emoji: string; label: string; desc: string }[] = [
  { id: "none",     emoji: "🚫", label: "None",     desc: "I don't have a skincare routine" },
  { id: "simple",   emoji: "🧴", label: "Simple",   desc: "Just cleanser + moisturizer" },
  { id: "moderate", emoji: "🧪", label: "Moderate", desc: "Cleanser, serum, SPF & moisturizer" },
  { id: "complex",  emoji: "💎", label: "Complex",  desc: "Full multi-step with actives & treatments" },
];

const CLIMATE_OPTIONS: { id: Climate; emoji: string; label: string; desc: string }[] = [
  { id: "humid",     emoji: "🌊", label: "Humid",      desc: "Hot & muggy, skin feels sticky" },
  { id: "dry",       emoji: "☀️", label: "Dry / Arid",  desc: "Low humidity, skin feels tight" },
  { id: "temperate", emoji: "🌤️", label: "Temperate",   desc: "Mild seasons, moderate humidity" },
  { id: "tropical",  emoji: "🌴", label: "Tropical",    desc: "Year-round heat & humidity" },
  { id: "cold",      emoji: "❄️", label: "Cold",        desc: "Long winters, dry indoor heating" },
];

function HealthProfileModal({
  visible,
  onClose,
  initial,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  initial: HealthProfile;
  onSave: (patch: HealthProfile) => void;
}) {
  const { colors: C, isDark } = useAppTheme();
  const { t } = useT();
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [birthday, setBirthday] = useState("");
  const [skinType, setSkinType] = useState<SkinType | "">("");
  const [concerns, setConcerns] = useState<SkinConcern[]>([]);
  const [routineLevel, setRoutineLevel] = useState<RoutineLevel | "">("");
  const [allergies, setAllergies] = useState("");
  const [climate, setClimate] = useState<Climate | "">("");

  useEffect(() => {
    if (visible) {
      setGender(initial.gender ?? "");
      setBirthday(initial.birthday ?? "");
      setSkinType(initial.skin_type ?? "");
      setConcerns(initial.concerns ?? []);
      setRoutineLevel(initial.routine_level ?? "");
      setAllergies(initial.allergies ?? "");
      setClimate(initial.climate ?? "");
    }
  }, [visible, initial]);

  function toggleConcern(c: SkinConcern) {
    setConcerns(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  function submit() {
    const patch: HealthProfile = {};
    if (gender) patch.gender = gender as "male" | "female" | "other";
    if (birthday && /^\d{4}-\d{2}-\d{2}$/.test(birthday)) patch.birthday = birthday;
    if (skinType) patch.skin_type = skinType as SkinType;
    if (concerns.length) patch.concerns = concerns;
    if (routineLevel) patch.routine_level = routineLevel as RoutineLevel;
    if (allergies.trim()) patch.allergies = allergies.trim();
    if (climate) patch.climate = climate as Climate;
    onSave(patch);
  }

  const dkCard = isDark ? { backgroundColor: C.cardBg, borderColor: C.gray200 } : {};
  const dkTxt  = isDark ? { color: C.gray400 } : {};
  const dkTxt2 = isDark ? { color: C.gray900 } : {};

  // chip helper
  const Chip = ({ active, label, emoji, onPress, wide }: {
    active: boolean; label: string; emoji: string; onPress: () => void; wide?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.genderBtn,
        wide ? { flex: 0, paddingHorizontal: 14 } : {},
        active && styles.genderBtnActive,
        !active && dkCard,
      ]}
    >
      <Text style={[styles.genderBtnText, active && styles.genderBtnTextActive, !active && dkTxt]}>
        {emoji} {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ModalShell visible={visible} onClose={onClose} title={t("profile.skinProfile")}>
      <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
        {/* ── 提示语 ── */}
        <Text style={[styles.modalHint, dkTxt, { marginBottom: 10 }]}>
          The more we know, the better our AI can tailor scan results and recommendations to your unique skin.
        </Text>

        {/* ── 肤质 ── */}
        <Text style={[spStyles.sectionTitle, dkTxt2]}>{t("profile.sp.skinType")}</Text>
        <Text style={[spStyles.sectionDesc, dkTxt]}>Not sure? If your T-zone gets oily but cheeks feel dry, you're likely "Combination."</Text>
        <View style={spStyles.chipWrap}>
          {SKIN_TYPES.map(st => (
            <Chip key={st.id} active={skinType === st.id} emoji={st.emoji} label={st.label}
              onPress={() => setSkinType(skinType === st.id ? "" : st.id)} wide />
          ))}
        </View>

        {/* ── 关注点（多选） ── */}
        <Text style={[spStyles.sectionTitle, dkTxt2]}>{t("profile.sp.concerns")} <Text style={spStyles.sectionHint}>(select all that apply)</Text></Text>
        <View style={spStyles.chipWrap}>
          {CONCERN_OPTIONS.map(co => (
            <Chip key={co.id} active={concerns.includes(co.id)} emoji={co.emoji} label={co.label}
              onPress={() => toggleConcern(co.id)} wide />
          ))}
        </View>

        {/* ── 护肤习惯 ── */}
        <Text style={[spStyles.sectionTitle, dkTxt2]}>{t("profile.sp.routine")}</Text>
        <Text style={[spStyles.sectionDesc, dkTxt]}>Your routine level helps AI gauge which products and ingredients to recommend.</Text>
        <View style={spStyles.chipWrap}>
          {ROUTINE_LEVELS.map(rl => (
            <Chip key={rl.id} active={routineLevel === rl.id} emoji={rl.emoji} label={`${rl.label} — ${rl.desc}`}
              onPress={() => setRoutineLevel(routineLevel === rl.id ? "" : rl.id)} wide />
          ))}
        </View>

        {/* ── 气候 ── */}
        <Text style={[spStyles.sectionTitle, dkTxt2]}>{t("profile.sp.climate")}</Text>
        <Text style={[spStyles.sectionDesc, dkTxt]}>Climate affects oil production, hydration, and how your skin reacts — AI adjusts advice accordingly.</Text>
        <View style={spStyles.chipWrap}>
          {CLIMATE_OPTIONS.map(cl => (
            <Chip key={cl.id} active={climate === cl.id} emoji={cl.emoji} label={`${cl.label} — ${cl.desc}`}
              onPress={() => setClimate(climate === cl.id ? "" : cl.id)} wide />
          ))}
        </View>

        {/* ── 过敏 ── */}
        <Text style={[spStyles.sectionTitle, dkTxt2]}>{t("profile.sp.allergies")}</Text>
        <View style={[styles.inputWrap, dkCard]}>
          <TextInput
            style={[styles.input, isDark && { color: C.gray900 }]}
            placeholder="e.g. niacinamide, fragrance, retinol…"
            placeholderTextColor={isDark ? C.gray400 : Colors.gray300}
            value={allergies}
            onChangeText={setAllergies}
            autoCapitalize="none"
          />
        </View>

        {/* ── 性别 & 生日 ── */}
        <Text style={[spStyles.sectionTitle, dkTxt2]}>{t("profile.sp.aboutYou")} <Text style={spStyles.sectionHint}>(optional)</Text></Text>
        <View style={styles.genderRow}>
          {(["male", "female", "other"] as const).map((g) => (
            <TouchableOpacity
              key={g}
              onPress={() => setGender(gender === g ? "" : g)}
              style={[styles.genderBtn, gender === g && styles.genderBtnActive, gender !== g && dkCard]}
            >
              <Text style={[styles.genderBtnText, gender === g && styles.genderBtnTextActive, gender !== g && dkTxt]}>
                {g === "male" ? "♂️" : g === "female" ? "♀️" : "⚧️"} {g}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={[styles.inputWrap, dkCard, { marginTop: 8 }]}>
          <Text style={[styles.inputPrefix, dkTxt]}>{t("profile.sp.birthday")}</Text>
          <TextInput
            style={[styles.input, isDark && { color: C.gray900 }]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={isDark ? C.gray400 : Colors.gray300}
            value={birthday}
            onChangeText={(raw) => {
              // Strip non-digits
              const digits = raw.replace(/\D/g, "").slice(0, 8);
              let formatted = digits;
              if (digits.length > 4) formatted = digits.slice(0, 4) + "-" + digits.slice(4);
              if (digits.length > 6) formatted = digits.slice(0, 4) + "-" + digits.slice(4, 6) + "-" + digits.slice(6);
              setBirthday(formatted);
            }}
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>

        <View style={{ height: 12 }} />
      </ScrollView>

      {/* ── Save ── */}
      <TouchableOpacity onPress={submit} activeOpacity={0.85}>
        <LinearGradient colors={Gradients.roseMain} style={styles.submitBtn}>
          <Text style={styles.submitText}>{t("common.save")}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ModalShell>
  );
}

const spStyles = StyleSheet.create({
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.gray700,
    marginTop: 14,
    marginBottom: 6,
  },
  sectionHint: {
    fontWeight: "400",
    fontSize: FontSize.xs,
    color: Colors.gray400,
  },
  sectionDesc: {
    fontSize: 12,
    color: Colors.gray400,
    lineHeight: 17,
    marginBottom: 8,
    marginTop: -2,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});

function InviteModal({
  visible,
  onClose,
  referral,
  onShare,
  onRedeem,
}: {
  visible: boolean;
  onClose: () => void;
  referral: ReferralInfo | null;
  onShare: () => void;
  onRedeem: (code: string) => void;
}) {
  const { colors: C, isDark } = useAppTheme();
  const { t } = useT();
  const [code, setCode] = useState("");

  return (
    <ModalShell visible={visible} onClose={onClose} title="Invite & redeem">
      <LinearGradient
        colors={["#FB923C", "#F43F8F", "#A855F7"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.referralCard}
      >
        <Text style={styles.referralLbl}>Your code</Text>
        <Text style={styles.referralCode}>
          {referral?.code ?? "— — —"}
        </Text>
        <Text style={styles.referralSub}>
          {referral
            ? `${referral.redemptions} friends joined · you both get 30 days VIP`
            : "Loading..."}
        </Text>
        <TouchableOpacity
          onPress={onShare}
          style={styles.referralShareBtn}
          activeOpacity={0.85}
        >
          <Share2 size={14} color="#F43F8F" />
          <Text style={styles.referralShareBtnText}>Share code</Text>
        </TouchableOpacity>
      </LinearGradient>

      <Text style={[styles.modalHint, isDark && { color: C.gray400 }]}>Got a code from a friend?</Text>
      <View style={[styles.inputWrap, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
        <Gift size={16} color={Colors.gray400} />
        <TextInput
          style={[styles.input, isDark && { color: C.gray900 }]}
          placeholder="Enter referral code"
          placeholderTextColor={isDark ? C.gray400 : Colors.gray300}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          autoCapitalize="characters"
          maxLength={10}
        />
      </View>
      <TouchableOpacity
        onPress={() => code.trim() && onRedeem(code.trim())}
        activeOpacity={0.85}
      >
        <LinearGradient colors={Gradients.roseMain} style={styles.submitBtn}>
          <Text style={styles.submitText}>Redeem</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ModalShell>
  );
}

/* ── Skin Profile 选项定义 ── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  // SafeAreaView edges applied inline
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },

  // ══════ HERO HEADER ══════
  heroHeader: {
    borderRadius: 28,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 16,
    overflow: "hidden",
    position: "relative",
  },
  heroGlow1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -60,
    right: -30,
  },
  heroGlow2: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.06)",
    bottom: -20,
    left: -20,
  },
  heroName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },
  heroEmail: {
    fontSize: FontSize.sm,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  heroScoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 12,
  },
  heroScoreDot: { width: 8, height: 8, borderRadius: 4 },
  heroScoreVal: { fontSize: 15, fontWeight: "800", color: "#fff" },
  heroScoreLbl: { fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: "600" },

  avatarWrap: {
    position: "relative",
    marginBottom: 12,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.35)",
    padding: 3,
  },
  avatar: {
    width: "100%" as any,
    height: "100%" as any,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 32, color: "#fff", fontWeight: "700" },
  avatarEditBadge: {
    position: "absolute",
    right: 0,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.rose400,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },

  vipTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(253,230,138,0.2)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.3)",
  },
  vipTagText: { fontSize: 11, color: "#fde68a", fontWeight: "700" },

  // ══════ VIP CARD ══════
  vipCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    overflow: "hidden",
    position: "relative",
  },
  vipCardGlow: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -40,
    right: -20,
  },
  vipIconBg: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  vipCardText: { flex: 1 },
  vipCardTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  vipCardSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    marginTop: 3,
  },

  // ══════ SECTIONS ══════
  section: {
    backgroundColor: Colors.white,
    borderRadius: 22,
    padding: 6,
    marginBottom: 16,
    shadowColor: "#F0ABCA",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F9E0EE",
  },
  dangerSection: {
    borderColor: "rgba(239,68,68,0.12)",
    shadowColor: "#EF4444",
    shadowOpacity: 0.04,
    marginBottom: 4,
  },
  dangerIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sectionItem: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  sectionLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.gray500 },
  sectionValue: {
    fontSize: FontSize.sm,
    color: Colors.gray800,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#F5F0F3",
    marginHorizontal: 12,
  },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
    marginBottom: 8,
  },
  logoutText: { color: Colors.gray400, fontSize: FontSize.sm, fontWeight: "600" },

  // 未登录 — Hero
  heroCard: {
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    marginTop: Spacing.md,
  },
  heroBrand: {
    color: "rgba(255,255,255,0.85)",
    fontSize: FontSize.xs,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: Spacing.lg,
  },
  heroFeatures: { gap: 10 },
  heroFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroFeatureText: {
    color: "rgba(255,255,255,0.95)",
    fontSize: FontSize.sm,
    fontWeight: "600",
  },

  tabRow: { flexDirection: "row", marginBottom: Spacing.xl },
  tabItem: { flex: 1, alignItems: "center", paddingBottom: Spacing.sm },
  tabText: {
    fontSize: FontSize.base,
    color: Colors.gray400,
    fontWeight: "500",
  },
  tabTextActive: { color: Colors.rose400, fontWeight: "700" },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    left: "20%",
    right: "20%",
    height: 2,
    backgroundColor: Colors.rose400,
    borderRadius: 1,
  },

  form: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    shadowColor: "#F0ABCA",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F9E0EE",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: "#F9E0EE",
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: "#FFFBFD",
  },
  input: { flex: 1, fontSize: FontSize.base, color: Colors.gray800 },
  submitBtn: {
    borderRadius: Radius.xl,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  submitText: { color: "#fff", fontSize: FontSize.base, fontWeight: "700" },

  // Forgot password
  forgotBtn: { alignSelf: "flex-end", marginTop: -4 },
  forgotText: { fontSize: FontSize.xs, color: Colors.rose400, fontWeight: "600" },
  forgotResultWrap: { alignItems: "center", gap: Spacing.md },
  forgotResultLabel: { fontSize: FontSize.sm, color: Colors.gray500, fontWeight: "600" },
  forgotResultCode: {
    fontSize: 36,
    fontWeight: "800",
    color: Colors.gray800,
    letterSpacing: 4,
  },
  forgotResultHint: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    textAlign: "center",
    lineHeight: 18,
  },

  // Guest + legal
  guestBtn: {
    alignSelf: "center",
    borderWidth: 1,
    borderColor: Colors.gray300,
    borderRadius: Radius.lg,
    paddingVertical: 11,
    paddingHorizontal: Spacing.xxxl,
    marginBottom: Spacing.sm,
  },
  guestBtnText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.gray500,
  },
  guestHint: {
    textAlign: "center",
    fontSize: FontSize.xs,
    color: Colors.gray400,
    marginBottom: Spacing.lg,
  },
  legalRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: Spacing.xl,
  },
  legalLink: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    textDecorationLine: "underline",
  },
  legalDot: { fontSize: FontSize.xs, color: Colors.gray300 },
  topNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  topNavTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.gray800,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#FFF0F6",
    alignItems: "center",
    justifyContent: "center",
  },

  groupLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.gray400,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
    marginLeft: 4,
  },

  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F9E0EE",
    shadowColor: "#F0ABCA",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statVal: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.gray800,
    lineHeight: 22,
  },
  statLbl: {
    fontSize: 9,
    color: Colors.gray400,
    marginTop: 2,
    fontWeight: "500",
  },

  rowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  rowIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowBtnText: { flex: 1 },
  rowBtnTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.gray800,
  },
  rowBtnSub: {
    fontSize: 11,
    color: Colors.gray400,
    marginTop: 2,
  },

  // ── Invite card ──
  inviteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    overflow: "hidden",
    position: "relative",
  },
  inviteGlow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -30,
    right: -10,
  },
  inviteIconBg: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  inviteCardText: { flex: 1 },
  inviteCardTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  inviteCardSub: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: 3,
  },

  // ── Modals ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  modalSheet: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#fff",
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.gray800,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gray100,
  },
  modalHint: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    marginBottom: 4,
  },
  inputPrefix: {
    fontSize: FontSize.sm,
    color: Colors.gray500,
    fontWeight: "600",
    minWidth: 56,
  },

  // ── Gender 三选 ──
  genderRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "#F9E0EE",
    alignItems: "center",
    backgroundColor: "#FFFBFD",
  },
  genderBtnActive: {
    backgroundColor: Colors.rose400,
    borderColor: Colors.rose400,
  },
  genderBtnText: {
    fontSize: FontSize.sm,
    color: Colors.gray500,
    textTransform: "capitalize",
    fontWeight: "600",
  },
  genderBtnTextActive: { color: "#fff" },

  // ── Invite modal 里的 referral card ──
  referralCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    gap: 4,
  },
  referralLbl: {
    color: "rgba(255,255,255,0.85)",
    fontSize: FontSize.xs,
    fontWeight: "600",
  },
  referralCode: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 4,
  },
  referralSub: {
    color: "rgba(255,255,255,0.9)",
    fontSize: FontSize.xs,
    textAlign: "center",
  },
  referralShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    marginTop: Spacing.sm,
  },
  referralShareBtnText: {
    color: "#F43F8F",
    fontSize: FontSize.xs,
    fontWeight: "700",
  },
});
