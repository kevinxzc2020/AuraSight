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

// Privacy / Terms 暂时指向占位 URL，后端部署落地后换成正式 URL
const PRIVACY_URL = "https://aurasight.app/privacy";
const TERMS_URL = "https://aurasight.app/terms";

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
    return (
      <LinearGradient colors={isDark ? [C.background, C.background, C.cardBg] : ["#FFF3F6", "#FFF9FB", "#FFFFFF"]} style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <View style={styles.topNav}>
            <Text style={[styles.topNavTitle, isDark && { color: C.gray900 }]}>{t("profile.title")}</Text>
            <TouchableOpacity
              onPress={() => router.push("/settings")}
              style={styles.settingsBtn}
            >
              <Settings size={22} color={isDark ? C.gray400 : Colors.gray500} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* ── 头像 + 名字 ── */}
            <View style={styles.avatarSection}>
              <TouchableOpacity
                onPress={handleAvatarTap}
                activeOpacity={0.85}
                style={styles.avatarWrap}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <LinearGradient
                    colors={Gradients.roseMain}
                    style={styles.avatar}
                  >
                    <Text style={styles.avatarText}>
                      {user.name.charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                )}
                {/* 右下角小相机图标提示可点 */}
                <View style={styles.avatarEditBadge}>
                  {avatarUploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <CameraIcon size={12} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>
              <Text style={[styles.profileName, isDark && { color: C.gray900 }]}>{user.name}</Text>
              <Text style={[styles.profileEmail, isDark && { color: C.gray400 }]}>{user.email}</Text>
              {user.mode === "vip" && (
                <View style={styles.vipTag}>
                  <Crown size={12} color="#fde68a" />
                  <Text style={styles.vipTagText}>{t("profile.vipBadge")}</Text>
                </View>
              )}
            </View>

            {/* ── VIP 升级卡（非 VIP 才显示） ── */}
            {user.mode !== "vip" && (
              <TouchableOpacity
                onPress={() => router.push("/vip")}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={["#f472b6", "#fb7185"]}
                  style={styles.vipCard}
                >
                  <Crown size={20} color="#fde68a" />
                  <View style={styles.vipCardText}>
                    <Text style={styles.vipCardTitle}>{t("common.upgrade")}</Text>
                    <Text style={styles.vipCardSub}>
                      Try free 7 days · then $4.99/mo or $34.99/yr
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* ── Your Journey 数据卡 ── */}
            <Text style={[styles.groupLabel, isDark && { color: C.gray400 }]}>Your Journey</Text>
            <StaggeredList stagger={50} from="bottom" style={styles.statsGrid} itemStyle={{ flexGrow: 1, flexBasis: "22%", minWidth: 72 }}>
              <View style={[styles.statCard, S.card, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
                <Text style={[styles.statVal, isDark && { color: C.gray900 }]}>
                  {meta.daysSinceJoined ?? "—"}
                </Text>
                <Text style={[styles.statLbl, isDark && { color: C.gray400 }]}>Days in</Text>
              </View>
              <View style={[styles.statCard, S.card, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
                <Text style={[styles.statVal, isDark && { color: C.gray900 }]}>{stats?.total_scans ?? 0}</Text>
                <Text style={[styles.statLbl, isDark && { color: C.gray400 }]}>{t("profile.totalScans")}</Text>
              </View>
              <View style={[styles.statCard, S.card, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
                <View style={styles.statInline}>
                  <Flame size={14} color="#fb923c" />
                  <Text style={[styles.statVal, { color: "#fb923c" }]}>
                    {stats?.streak ?? 0}
                  </Text>
                </View>
                <Text style={[styles.statLbl, isDark && { color: C.gray400 }]}>{t("profile.streak")}</Text>
              </View>
              <View style={[styles.statCard, S.card, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
                <Text style={[styles.statVal, isDark && { color: C.gray900 }]}>
                  {stats?.avg_skin_score ?? "—"}
                </Text>
                <Text style={[styles.statLbl, isDark && { color: C.gray400 }]}>{t("profile.avgScore")}</Text>
              </View>
            </StaggeredList>

            {/* ── 快捷操作 ── */}
            <Text style={[styles.groupLabel, isDark && { color: C.gray400 }]}>Quick actions</Text>
            <View style={[styles.section, S.card, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={() => router.push("/(tabs)/report")}
                activeOpacity={0.7}
              >
                <Sparkles size={16} color={Colors.rose400} />
                <View style={styles.rowBtnText}>
                  <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>{t("report.title")}</Text>
                  <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>
                    Trends, correlations, AI summary
                  </Text>
                </View>
                <ChevronRight size={16} color={Colors.gray400} />
              </TouchableOpacity>
              <View style={[styles.divider, isDark && { backgroundColor: C.gray200 }]} />
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={() => router.push("/(tabs)/history")}
                activeOpacity={0.7}
              >
                <CameraIcon size={16} color={Colors.rose400} />
                <View style={styles.rowBtnText}>
                  <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Scan history</Text>
                  <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>
                    {stats?.total_scans ?? 0} {t("profile.totalScans")}
                  </Text>
                </View>
                <ChevronRight size={16} color={Colors.gray400} />
              </TouchableOpacity>
              {/* ── body composition 暂时隐藏 ──
              {user.mode === "vip" && (
                <>
                  <View style={styles.divider} />
                  <TouchableOpacity
                    style={styles.rowBtn}
                    onPress={() => router.push("/body-composition")}
                    activeOpacity={0.7}
                  >
                    <Activity size={16} color={Colors.rose400} />
                    <View style={styles.rowBtnText}>
                      <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Body composition</Text>
                      <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>
                        {meta.latestBodyComp
                          ? `Latest: ${meta.latestBodyComp.bodyFatPct}% body fat`
                          : "Log your first measurement"}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={Colors.gray400} />
                  </TouchableOpacity>
                </>
              )}
              ── end hidden ── */}
            </View>

            {/* ── My Data ── */}
            <Text style={[styles.groupLabel, isDark && { color: C.gray400 }]}>My data</Text>
            <View style={[styles.section, S.card, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={handleExportData}
                activeOpacity={0.7}
              >
                <Download size={16} color={isDark ? C.gray400 : Colors.gray500} />
                <View style={styles.rowBtnText}>
                  <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Export my data</Text>
                  <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>
                    JSON copy of scans & diary
                  </Text>
                </View>
                <ChevronRight size={16} color={isDark ? C.gray400 : Colors.gray400} />
              </TouchableOpacity>
              <View style={[styles.divider, isDark && { backgroundColor: C.gray200 }]} />
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={handleDeleteAccount}
                activeOpacity={0.7}
              >
                <Trash2 size={16} color={Colors.red} />
                <View style={styles.rowBtnText}>
                  <Text style={[styles.rowBtnTitle, { color: Colors.red }]}>
                    Delete account
                  </Text>
                  <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>Permanent, can't be undone</Text>
                </View>
                <ChevronRight size={16} color={isDark ? C.gray400 : Colors.gray400} />
              </TouchableOpacity>
            </View>

            {/* ── Account settings ── */}
            <Text style={[styles.groupLabel, isDark && { color: C.gray400 }]}>Account settings</Text>
            <View style={[styles.section, S.card, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={() => setEditProfileOpen(true)}
                activeOpacity={0.7}
              >
                <Edit3 size={16} color={isDark ? C.gray400 : Colors.gray500} />
                <View style={styles.rowBtnText}>
                  <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Edit profile</Text>
                  <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>{user.name} · {user.email}</Text>
                </View>
                <ChevronRight size={16} color={isDark ? C.gray400 : Colors.gray400} />
              </TouchableOpacity>
              <View style={[styles.divider, isDark && { backgroundColor: C.gray200 }]} />
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={() => setChangePwOpen(true)}
                activeOpacity={0.7}
              >
                <Lock size={16} color={isDark ? C.gray400 : Colors.gray500} />
                <View style={styles.rowBtnText}>
                  <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Change password</Text>
                  <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>Keep your account secure</Text>
                </View>
                <ChevronRight size={16} color={isDark ? C.gray400 : Colors.gray400} />
              </TouchableOpacity>
              <View style={[styles.divider, isDark && { backgroundColor: C.gray200 }]} />
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={() => setHealthOpen(true)}
                activeOpacity={0.7}
              >
                <Sparkles size={16} color={isDark ? C.gray400 : Colors.rose400} />
                <View style={styles.rowBtnText}>
                  <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>{t("profile.skinProfile")}</Text>
                  <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>
                    {formatHealthSummary(health, t)}
                  </Text>
                </View>
                <ChevronRight size={16} color={isDark ? C.gray400 : Colors.gray400} />
              </TouchableOpacity>
              <View style={[styles.divider, isDark && { backgroundColor: C.gray200 }]} />
              <View style={styles.rowBtn}>
                <Bell size={16} color={isDark ? C.gray400 : Colors.gray500} />
                <View style={styles.rowBtnText}>
                  <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Daily reminder</Text>
                  <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>
                    {reminderOn ? `On · ${reminderLabel}` : "Off"}
                  </Text>
                </View>
                <Switch
                  value={reminderOn}
                  onValueChange={handleToggleReminder}
                  trackColor={{ true: Colors.rose400, false: Colors.gray200 }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            {/* ── Invite friends ── */}
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
                <Gift size={22} color="#fff" />
                <View style={styles.inviteCardText}>
                  <Text style={styles.inviteCardTitle}>
                    Give 30 days, get 30 days
                  </Text>
                  <Text style={styles.inviteCardSub}>
                    {referral
                      ? `Your code: ${referral.code}${
                          referral.redemptions > 0
                            ? ` · ${referral.redemptions} friends joined`
                            : ""
                        }`
                      : "Tap to get your referral code"}
                  </Text>
                </View>
                <ChevronRight size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>

            {/* ── About ── */}
            <Text style={[styles.groupLabel, isDark && { color: C.gray400 }]}>About</Text>
            <View style={[styles.section, S.card, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
              <View style={styles.rowBtn}>
                <Info size={16} color={isDark ? C.gray400 : Colors.gray500} />
                <View style={styles.rowBtnText}>
                  <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Version</Text>
                  <Text style={[styles.rowBtnSub, isDark && { color: C.gray400 }]}>
                    {Constants.expoConfig?.version ?? "—"}
                    {Constants.expoConfig?.runtimeVersion
                      ? ` · runtime ${Constants.expoConfig.runtimeVersion}`
                      : ""}
                  </Text>
                </View>
              </View>
              <View style={[styles.divider, isDark && { backgroundColor: C.gray200 }]} />
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={() => Linking.openURL(PRIVACY_URL)}
                activeOpacity={0.7}
              >
                <Shield size={16} color={isDark ? C.gray400 : Colors.gray500} />
                <View style={styles.rowBtnText}>
                  <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Privacy policy</Text>
                </View>
                <ChevronRight size={16} color={isDark ? C.gray400 : Colors.gray400} />
              </TouchableOpacity>
              <View style={[styles.divider, isDark && { backgroundColor: C.gray200 }]} />
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={() => Linking.openURL(TERMS_URL)}
                activeOpacity={0.7}
              >
                <FileText size={16} color={isDark ? C.gray400 : Colors.gray500} />
                <View style={styles.rowBtnText}>
                  <Text style={[styles.rowBtnTitle, isDark && { color: C.gray900 }]}>Terms of service</Text>
                </View>
                <ChevronRight size={16} color={isDark ? C.gray400 : Colors.gray400} />
              </TouchableOpacity>
            </View>

            {/* ── 登出 ── */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <LogOut size={16} color={Colors.red} />
              <Text style={styles.logoutText}>{t("common.signIn")}</Text>
            </TouchableOpacity>

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
              <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text style={styles.legalDot}>·</Text>
              <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
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
  { id: "none",     emoji: "🚫", label: "None",     desc: "No routine yet" },
  { id: "simple",   emoji: "🧴", label: "Simple",   desc: "Cleanser + moisturizer" },
  { id: "moderate", emoji: "🧪", label: "Moderate", desc: "+ serums / SPF" },
  { id: "complex",  emoji: "💎", label: "Complex",  desc: "Full multi-step" },
];

const CLIMATE_OPTIONS: { id: Climate; emoji: string; label: string }[] = [
  { id: "humid",     emoji: "🌊", label: "Humid" },
  { id: "dry",       emoji: "☀️", label: "Dry" },
  { id: "temperate", emoji: "🌤️", label: "Temperate" },
  { id: "tropical",  emoji: "🌴", label: "Tropical" },
  { id: "cold",      emoji: "❄️", label: "Cold" },
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
          Helps AI give you personalized skincare advice.
        </Text>

        {/* ── 肤质 ── */}
        <Text style={[spStyles.sectionTitle, dkTxt2]}>{t("profile.sp.skinType")}</Text>
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
        <View style={spStyles.chipWrap}>
          {ROUTINE_LEVELS.map(rl => (
            <Chip key={rl.id} active={routineLevel === rl.id} emoji={rl.emoji} label={rl.label}
              onPress={() => setRoutineLevel(routineLevel === rl.id ? "" : rl.id)} wide />
          ))}
        </View>

        {/* ── 气候 ── */}
        <Text style={[spStyles.sectionTitle, dkTxt2]}>{t("profile.sp.climate")}</Text>
        <View style={spStyles.chipWrap}>
          {CLIMATE_OPTIONS.map(cl => (
            <Chip key={cl.id} active={climate === cl.id} emoji={cl.emoji} label={cl.label}
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
            onChangeText={setBirthday}
            autoCapitalize="none"
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

  // 已登录
  avatarSection: { alignItems: "center", paddingVertical: Spacing.xxl },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  avatarText: { fontSize: 36, color: "#fff", fontWeight: "700" },
  profileName: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.gray800,
  },
  profileEmail: { fontSize: FontSize.sm, color: Colors.gray400, marginTop: 4 },
  vipTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fde68a20",
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
  },
  vipTagText: { fontSize: FontSize.xs, color: "#d97706", fontWeight: "600" },

  vipCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  vipCardText: { flex: 1 },
  vipCardTitle: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  vipCardSub: {
    color: "rgba(255,255,255,0.8)",
    fontSize: FontSize.xs,
    marginTop: 2,
  },

  section: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowColor: "#F0ABCA",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F9E0EE",
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
    backgroundColor: Colors.gray100,
    marginVertical: Spacing.md,
  },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  logoutText: { color: Colors.red, fontSize: FontSize.base, fontWeight: "600" },

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
    alignItems: "center",
    justifyContent: "center",
  },

  groupLabel: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    color: Colors.gray400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: "22%",
    minWidth: 72,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F9E0EE",
  },
  statInline: { flexDirection: "row", alignItems: "center", gap: 4 },
  statVal: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.gray800,
  },
  statLbl: {
    fontSize: 11,
    color: Colors.gray400,
    marginTop: 2,
  },

  rowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  rowBtnText: { flex: 1 },
  rowBtnTitle: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.gray800,
  },
  rowBtnSub: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    marginTop: 2,
  },

  // ── Avatar 可点击外观 ──
  avatarWrap: {
    position: "relative",
    marginBottom: Spacing.md,
  },
  avatarEditBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.rose400,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  // ── Invite card ──
  inviteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  inviteCardText: { flex: 1 },
  inviteCardTitle: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  inviteCardSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: FontSize.xs,
    marginTop: 2,
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
