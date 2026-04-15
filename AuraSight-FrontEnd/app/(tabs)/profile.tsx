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
import { LinearGradient } from "expo-linear-gradient";
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
} from "lucide-react-native";
import {
  Colors,
  Gradients,
  Spacing,
  Radius,
  FontSize,
  Shadow,
} from "../../constants/theme";
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
  const { setUser: setCtxUser, clearUser: clearCtxUser } = useUser();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
        { text: "Cancel", style: "cancel" },
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
      await scheduleDailyReminder(hour, minute);
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

  if (loading) {
    return (
      <LinearGradient colors={["#FFF3F6", "#FFF9FB", "#FFFFFF"]} style={styles.center}>
        <ActivityIndicator size="large" color={Colors.rose400} />
      </LinearGradient>
    );
  }

  // ─── 已登录 ───────────────────────────────────────────────
  if (user) {
    const stats = meta.stats;
    return (
      <LinearGradient colors={["#FFF3F6", "#FFF9FB", "#FFFFFF"]} style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <View style={styles.topNav}>
            <Text style={styles.topNavTitle}>Profile</Text>
            <TouchableOpacity
              onPress={() => router.push("/settings")}
              style={styles.settingsBtn}
            >
              <Settings size={22} color={Colors.gray500} />
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
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
              {user.mode === "vip" && (
                <View style={styles.vipTag}>
                  <Crown size={12} color="#fde68a" />
                  <Text style={styles.vipTagText}>VIP Member</Text>
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
                    <Text style={styles.vipCardTitle}>Upgrade to VIP</Text>
                    <Text style={styles.vipCardSub}>
                      Try free 7 days · then $4.99/mo or $34.99/yr
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* ── Your Journey 数据卡 ── */}
            <Text style={styles.groupLabel}>Your Journey</Text>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, Shadow.card]}>
                <Text style={styles.statVal}>
                  {meta.daysSinceJoined ?? "—"}
                </Text>
                <Text style={styles.statLbl}>Days in</Text>
              </View>
              <View style={[styles.statCard, Shadow.card]}>
                <Text style={styles.statVal}>{stats?.total_scans ?? 0}</Text>
                <Text style={styles.statLbl}>Scans</Text>
              </View>
              <View style={[styles.statCard, Shadow.card]}>
                <View style={styles.statInline}>
                  <Flame size={14} color="#fb923c" />
                  <Text style={[styles.statVal, { color: "#fb923c" }]}>
                    {stats?.streak ?? 0}
                  </Text>
                </View>
                <Text style={styles.statLbl}>Streak</Text>
              </View>
              <View style={[styles.statCard, Shadow.card]}>
                <Text style={styles.statVal}>
                  {stats?.avg_skin_score ?? "—"}
                </Text>
                <Text style={styles.statLbl}>Avg score</Text>
              </View>
            </View>

            {/* ── 快捷操作 ── */}
            <Text style={styles.groupLabel}>Quick actions</Text>
            <View style={[styles.section, Shadow.card]}>
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={() => router.push("/(tabs)/report")}
                activeOpacity={0.7}
              >
                <Sparkles size={16} color={Colors.rose400} />
                <View style={styles.rowBtnText}>
                  <Text style={styles.rowBtnTitle}>30-day Report</Text>
                  <Text style={styles.rowBtnSub}>
                    Trends, correlations, AI summary
                  </Text>
                </View>
                <ChevronRight size={16} color={Colors.gray400} />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={() => router.push("/(tabs)/history")}
                activeOpacity={0.7}
              >
                <CameraIcon size={16} color={Colors.rose400} />
                <View style={styles.rowBtnText}>
                  <Text style={styles.rowBtnTitle}>Scan history</Text>
                  <Text style={styles.rowBtnSub}>
                    {stats?.total_scans ?? 0} scans
                  </Text>
                </View>
                <ChevronRight size={16} color={Colors.gray400} />
              </TouchableOpacity>
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
                      <Text style={styles.rowBtnTitle}>Body composition</Text>
                      <Text style={styles.rowBtnSub}>
                        {meta.latestBodyComp
                          ? `Latest: ${meta.latestBodyComp.bodyFatPct}% body fat`
                          : "Log your first measurement"}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={Colors.gray400} />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* ── My Data ── */}
            <Text style={styles.groupLabel}>My data</Text>
            <View style={[styles.section, Shadow.card]}>
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={handleExportData}
                activeOpacity={0.7}
              >
                <Download size={16} color={Colors.gray500} />
                <View style={styles.rowBtnText}>
                  <Text style={styles.rowBtnTitle}>Export my data</Text>
                  <Text style={styles.rowBtnSub}>
                    JSON copy of scans & diary
                  </Text>
                </View>
                <ChevronRight size={16} color={Colors.gray400} />
              </TouchableOpacity>
              <View style={styles.divider} />
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
                  <Text style={styles.rowBtnSub}>Permanent, can't be undone</Text>
                </View>
                <ChevronRight size={16} color={Colors.gray400} />
              </TouchableOpacity>
            </View>

            {/* ── Account settings ── */}
            <Text style={styles.groupLabel}>Account settings</Text>
            <View style={[styles.section, Shadow.card]}>
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={() => setEditProfileOpen(true)}
                activeOpacity={0.7}
              >
                <Edit3 size={16} color={Colors.gray500} />
                <View style={styles.rowBtnText}>
                  <Text style={styles.rowBtnTitle}>Edit profile</Text>
                  <Text style={styles.rowBtnSub}>{user.name} · {user.email}</Text>
                </View>
                <ChevronRight size={16} color={Colors.gray400} />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={() => setChangePwOpen(true)}
                activeOpacity={0.7}
              >
                <Lock size={16} color={Colors.gray500} />
                <View style={styles.rowBtnText}>
                  <Text style={styles.rowBtnTitle}>Change password</Text>
                  <Text style={styles.rowBtnSub}>Keep your account secure</Text>
                </View>
                <ChevronRight size={16} color={Colors.gray400} />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={() => setHealthOpen(true)}
                activeOpacity={0.7}
              >
                <Activity size={16} color={Colors.gray500} />
                <View style={styles.rowBtnText}>
                  <Text style={styles.rowBtnTitle}>Health profile</Text>
                  <Text style={styles.rowBtnSub}>
                    {formatHealthSummary(health)}
                  </Text>
                </View>
                <ChevronRight size={16} color={Colors.gray400} />
              </TouchableOpacity>
              <View style={styles.divider} />
              <View style={styles.rowBtn}>
                <Bell size={16} color={Colors.gray500} />
                <View style={styles.rowBtnText}>
                  <Text style={styles.rowBtnTitle}>Daily reminder</Text>
                  <Text style={styles.rowBtnSub}>
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
            <Text style={styles.groupLabel}>Invite friends</Text>
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
            <Text style={styles.groupLabel}>About</Text>
            <View style={[styles.section, Shadow.card]}>
              <View style={styles.rowBtn}>
                <Info size={16} color={Colors.gray500} />
                <View style={styles.rowBtnText}>
                  <Text style={styles.rowBtnTitle}>Version</Text>
                  <Text style={styles.rowBtnSub}>
                    {Constants.expoConfig?.version ?? "—"}
                    {Constants.expoConfig?.runtimeVersion
                      ? ` · runtime ${Constants.expoConfig.runtimeVersion}`
                      : ""}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={() => Linking.openURL(PRIVACY_URL)}
                activeOpacity={0.7}
              >
                <Shield size={16} color={Colors.gray500} />
                <View style={styles.rowBtnText}>
                  <Text style={styles.rowBtnTitle}>Privacy policy</Text>
                </View>
                <ChevronRight size={16} color={Colors.gray400} />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={() => Linking.openURL(TERMS_URL)}
                activeOpacity={0.7}
              >
                <FileText size={16} color={Colors.gray500} />
                <View style={styles.rowBtnText}>
                  <Text style={styles.rowBtnTitle}>Terms of service</Text>
                </View>
                <ChevronRight size={16} color={Colors.gray400} />
              </TouchableOpacity>
            </View>

            {/* ── 登出 ── */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <LogOut size={16} color={Colors.red} />
              <Text style={styles.logoutText}>Sign Out</Text>
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
    <LinearGradient colors={["#FFF3F6", "#FFF9FB", "#FFFFFF"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Logo */}
            <View style={styles.logoSection}>
              <LinearGradient
                colors={Gradients.roseMain}
                style={styles.logoCircle}
              >
                <Text style={styles.logoText}>✨</Text>
              </LinearGradient>
              <Text style={styles.logoTitle}>AuraSight</Text>
              <Text style={styles.logoSub}>
                Track your skin & body transformation
              </Text>
            </View>

            {/* Tab 切换 */}
            <View style={styles.tabRow}>
              {(["login", "register"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={styles.tabItem}
                  onPress={() => setTab(t)}
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

            {/* 表单 */}
            <View style={[styles.form, Shadow.card]}>
              {tab === "register" && (
                <View style={styles.inputWrap}>
                  <User size={16} color={Colors.gray400} />
                  <TextInput
                    style={styles.input}
                    placeholder="Your name"
                    placeholderTextColor={Colors.gray300}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              )}

              <View style={styles.inputWrap}>
                <Mail size={16} color={Colors.gray400} />
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor={Colors.gray300}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputWrap}>
                <Lock size={16} color={Colors.gray400} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={Colors.gray300}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

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

            {/* 游客继续 */}
            <Text style={styles.guestNote}>
              Continue as guest — your data stays on this device only
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── 辅助 ───────────────────────────────────────────────

function formatHealthSummary(h: HealthProfile): string {
  const parts: string[] = [];
  if (h.height_cm) parts.push(`${h.height_cm}cm`);
  if (h.weight_kg) parts.push(`${h.weight_kg}kg`);
  if (h.gender) parts.push(h.gender);
  if (h.birthday) parts.push(h.birthday);
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
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={styles.modalSheet}
          onPress={() => {}}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <X size={18} color={Colors.gray500} />
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
      <View style={styles.inputWrap}>
        <User size={16} color={Colors.gray400} />
        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor={Colors.gray300}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      </View>
      <View style={styles.inputWrap}>
        <Mail size={16} color={Colors.gray400} />
        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor={Colors.gray300}
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
          <Text style={styles.submitText}>Save</Text>
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
      <View style={styles.inputWrap}>
        <Lock size={16} color={Colors.gray400} />
        <TextInput
          style={styles.input}
          placeholder="Current password"
          placeholderTextColor={Colors.gray300}
          value={oldPw}
          onChangeText={setOldPw}
          secureTextEntry
        />
      </View>
      <View style={styles.inputWrap}>
        <Lock size={16} color={Colors.gray400} />
        <TextInput
          style={styles.input}
          placeholder="New password"
          placeholderTextColor={Colors.gray300}
          value={newPw}
          onChangeText={setNewPw}
          secureTextEntry
        />
      </View>
      <View style={styles.inputWrap}>
        <Lock size={16} color={Colors.gray400} />
        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor={Colors.gray300}
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
  const [heightStr, setHeightStr] = useState("");
  const [weightStr, setWeightStr] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [birthday, setBirthday] = useState("");

  useEffect(() => {
    if (visible) {
      setHeightStr(initial.height_cm ? String(initial.height_cm) : "");
      setWeightStr(initial.weight_kg ? String(initial.weight_kg) : "");
      setGender(initial.gender ?? "");
      setBirthday(initial.birthday ?? "");
    }
  }, [visible, initial]);

  function submit() {
    const patch: HealthProfile = {};
    const h = parseFloat(heightStr);
    const w = parseFloat(weightStr);
    if (!isNaN(h) && h > 0) patch.height_cm = h;
    if (!isNaN(w) && w > 0) patch.weight_kg = w;
    if (gender) patch.gender = gender as "male" | "female" | "other";
    // 简单校验日期格式 YYYY-MM-DD，不做日历组件
    if (birthday && /^\d{4}-\d{2}-\d{2}$/.test(birthday)) patch.birthday = birthday;
    onSave(patch);
  }

  return (
    <ModalShell visible={visible} onClose={onClose} title="Health profile">
      <Text style={styles.modalHint}>
        Used by Body Composition and future personalization features.
      </Text>
      <View style={styles.inputWrap}>
        <Text style={styles.inputPrefix}>Height</Text>
        <TextInput
          style={styles.input}
          placeholder="cm"
          placeholderTextColor={Colors.gray300}
          value={heightStr}
          onChangeText={setHeightStr}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.inputWrap}>
        <Text style={styles.inputPrefix}>Weight</Text>
        <TextInput
          style={styles.input}
          placeholder="kg"
          placeholderTextColor={Colors.gray300}
          value={weightStr}
          onChangeText={setWeightStr}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.genderRow}>
        {(["male", "female", "other"] as const).map((g) => (
          <TouchableOpacity
            key={g}
            onPress={() => setGender(g)}
            style={[
              styles.genderBtn,
              gender === g && styles.genderBtnActive,
            ]}
          >
            <Text
              style={[
                styles.genderBtnText,
                gender === g && styles.genderBtnTextActive,
              ]}
            >
              {g}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.inputWrap}>
        <Text style={styles.inputPrefix}>Birthday</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.gray300}
          value={birthday}
          onChangeText={setBirthday}
          autoCapitalize="none"
        />
      </View>
      <TouchableOpacity onPress={submit} activeOpacity={0.85}>
        <LinearGradient colors={Gradients.roseMain} style={styles.submitBtn}>
          <Text style={styles.submitText}>Save</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ModalShell>
  );
}

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

      <Text style={styles.modalHint}>Got a code from a friend?</Text>
      <View style={styles.inputWrap}>
        <Gift size={16} color={Colors.gray400} />
        <TextInput
          style={styles.input}
          placeholder="Enter referral code"
          placeholderTextColor={Colors.gray300}
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

  // 未登录
  logoSection: { alignItems: "center", paddingVertical: Spacing.xxl },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  logoText: { fontSize: 32 },
  logoTitle: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    color: Colors.gray800,
  },
  logoSub: {
    fontSize: FontSize.sm,
    color: Colors.gray400,
    marginTop: 4,
    textAlign: "center",
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

  guestNote: {
    textAlign: "center",
    fontSize: FontSize.xs,
    color: Colors.gray400,
    lineHeight: 18,
  },
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
