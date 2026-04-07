import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import {
  ChevronLeft,
  Trash2,
  Calendar,
  MapPin,
  Star,
  BookOpen,
  Check,
} from "lucide-react-native";
import {
  Colors,
  Gradients,
  Spacing,
  Radius,
  FontSize,
  Shadow,
  AcneColors,
  StatusColors,
} from "../../constants/theme";
import { getRecentScans, ScanRecord } from "../../lib/mongodb";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.59:3000";

async function getUserId(): Promise<string> {
  let id = await AsyncStorage.getItem("@aurasight_user_id");
  if (!id) {
    id = "guest_" + Math.random().toString(36).slice(2, 10);
    await AsyncStorage.setItem("@aurasight_user_id", id);
  }
  return id;
}

const ZONE_LABELS: Record<string, string> = {
  face_forehead: "Forehead",
  face_cheek_l: "Left Cheek",
  face_cheek_r: "Right Cheek",
  face_chin: "Chin",
  face_nose: "Nose",
  back: "Back",
  chest: "Chest",
};

// 皮肤日记的快速标签 — 用户常见的影响皮肤的生活因素
// 这些标签日后会被 AI 用来找出皮肤状态和生活习惯之间的关联
const DIARY_TAGS = [
  { id: "sleep_bad", label: "😴 Poor sleep" },
  { id: "sleep_good", label: "😌 Good sleep" },
  { id: "lots_of_water", label: "💧 Drank a lot" },
  { id: "stressed", label: "😰 Stressed" },
  { id: "exercised", label: "🏃 Exercised" },
  { id: "ate_oily", label: "🍟 Oily food" },
  { id: "ate_healthy", label: "🥗 Healthy food" },
  { id: "period", label: "📅 Period" },
  { id: "new_skincare", label: "🧴 New skincare" },
  { id: "outdoor", label: "☀️ Outdoors all day" },
];

export default function ScanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [scan, setScan] = useState<ScanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // 皮肤日记相关状态
  const [diaryNote, setDiaryNote] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [savingDiary, setSavingDiary] = useState(false);
  const [diarySaved, setDiarySaved] = useState(false);

  useEffect(() => {
    loadScan();
  }, [id]);

  async function loadScan() {
    try {
      const userId = await getUserId();
      const scans = await getRecentScans(userId, 30);
      const found = scans.find((s) => s._id === id);
      setScan(found ?? null);

      // 如果已有日记记录，预填充进输入框
      if (found) {
        setDiaryNote((found as any).diary_note ?? "");
        setSelectedTags((found as any).diary_tags ?? []);
        if (
          (found as any).diary_note ||
          (found as any).diary_tags?.length > 0
        ) {
          setDiarySaved(true);
        }
      }
    } catch (err) {
      console.error("Failed to load scan:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    Alert.alert("Delete Scan", "Are you sure you want to delete this scan?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setDeleting(true);
            await fetch(`${API_URL}/scans/${id}`, { method: "DELETE" });
            router.back();
          } catch {
            Alert.alert("Error", "Failed to delete scan.");
            setDeleting(false);
          }
        },
      },
    ]);
  }

  // 标签切换逻辑 — 已选则取消，未选则添加
  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    );
    setDiarySaved(false);
  }

  // 保存日记到后端
  async function saveDiary() {
    if (!id) return;
    try {
      setSavingDiary(true);
      await fetch(`${API_URL}/scans/${id}/diary`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: diaryNote, tags: selectedTags }),
      });
      setDiarySaved(true);
    } catch {
      Alert.alert("Error", "Failed to save diary. Please try again.");
    } finally {
      setSavingDiary(false);
    }
  }

  if (loading) {
    return (
      <LinearGradient
        colors={["#fff5f5", "#ffffff"]}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={Colors.rose400} />
      </LinearGradient>
    );
  }

  if (!scan) {
    return (
      <LinearGradient
        colors={["#fff5f5", "#ffffff"]}
        style={styles.loadingContainer}
      >
        <Text style={styles.notFound}>Scan not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const date = new Date(scan.scan_date);
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const zoneLabel = ZONE_LABELS[scan.body_zone] ?? scan.body_zone;

  const acneTypes = [
    { label: "Pustule", key: "pustule", color: AcneColors.pustule },
    { label: "Broken", key: "broken", color: AcneColors.broken },
    { label: "Scab", key: "scab", color: AcneColors.scab },
    { label: "Redness", key: "redness", color: AcneColors.redness },
  ];

  const breakdown = scan.detections.reduce(
    (acc, d) => {
      acc[d.acne_type] = (acc[d.acne_type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const hasDiaryContent =
    diaryNote.trim().length > 0 || selectedTags.length > 0;

  return (
    // KeyboardAvoidingView 确保键盘弹出时日记输入框不被遮住
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient colors={["#fff5f5", "#ffffff"]} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          {/* 顶部导航 */}
          <View style={styles.topNav}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.navBtn}
            >
              <ChevronLeft size={24} color={Colors.gray700} />
            </TouchableOpacity>
            <Text style={styles.navTitle}>Scan Detail</Text>
            <TouchableOpacity
              onPress={handleDelete}
              style={styles.navBtn}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={Colors.red} />
              ) : (
                <Trash2 size={20} color={Colors.red} />
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* 照片 */}
            <View style={styles.imageContainer}>
              {scan.image_uri ? (
                <Image
                  source={{ uri: scan.image_uri }}
                  style={styles.image}
                  resizeMode="cover"
                />
              ) : (
                <LinearGradient
                  colors={["#ffe4e6", "#fce7f3"]}
                  style={styles.imagePlaceholder}
                >
                  <Text style={styles.placeholderEmoji}>👤</Text>
                </LinearGradient>
              )}
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: StatusColors[scan.skin_status] },
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {scan.skin_status.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* 日期 + 部位 */}
            <View style={[styles.card, Shadow.card]}>
              <View style={styles.infoRow}>
                <Calendar size={16} color={Colors.rose400} />
                <View style={styles.infoText}>
                  <Text style={styles.infoLabel}>{dateStr}</Text>
                  <Text style={styles.infoSub}>{timeStr}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <MapPin size={16} color={Colors.rose400} />
                <Text style={styles.infoLabel}>{zoneLabel}</Text>
              </View>
            </View>

            {/* 皮肤评分 */}
            <View style={[styles.card, Shadow.card]}>
              <Text style={styles.cardTitle}>Skin Score</Text>
              <View style={styles.scoreRow}>
                <LinearGradient
                  colors={Gradients.roseMain}
                  style={styles.scoreCircle}
                >
                  <Text style={styles.scoreNumber}>{scan.skin_score}</Text>
                </LinearGradient>
                <View style={styles.scoreInfo}>
                  <Text style={styles.scoreDesc}>
                    {scan.skin_score >= 80
                      ? "✨ Great skin day!"
                      : scan.skin_score >= 60
                        ? "👍 Looking good"
                        : scan.skin_score >= 40
                          ? "⚠️ Some concerns"
                          : "🔴 Needs attention"}
                  </Text>
                  <Text style={styles.spotCount}>
                    {scan.total_count} spots detected
                  </Text>
                </View>
              </View>
              <View style={styles.scoreBar}>
                <LinearGradient
                  colors={Gradients.roseMain}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.scoreBarFill,
                    { width: `${scan.skin_score}%` },
                  ]}
                />
              </View>
            </View>

            {/* 痘痘分布 */}
            {scan.total_count > 0 && (
              <View style={[styles.card, Shadow.card]}>
                <Text style={styles.cardTitle}>Condition Breakdown</Text>
                <View style={styles.acneGrid}>
                  {acneTypes.map((item) => {
                    const count = breakdown[item.key] ?? 0;
                    return (
                      <View key={item.key} style={styles.acneItem}>
                        <View
                          style={[
                            styles.acneDot,
                            { backgroundColor: item.color },
                          ]}
                        />
                        <Text style={styles.acneLabel}>{item.label}</Text>
                        <Text style={[styles.acneCount, { color: item.color }]}>
                          {count}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ─── 皮肤日记 ─────────────────────────────────────────────
                这是这次新增的核心功能。
                设计原则：让记录变成一件"顺手"的事，而不是一个任务。
                快速标签让用户不用打字就能记录，文字框留给想写更多的人。
                这些数据会被 AI 用来发现"生活习惯 → 皮肤状态"的关联规律。 */}
            <View style={[styles.card, Shadow.card]}>
              {/* 标题行 */}
              <View style={styles.diaryHeader}>
                <View style={styles.diaryTitleRow}>
                  <BookOpen size={16} color={Colors.rose400} />
                  <Text style={styles.cardTitle}>Skin Diary</Text>
                </View>
                {diarySaved && (
                  <View style={styles.savedBadge}>
                    <Check size={10} color={Colors.emerald} />
                    <Text style={styles.savedText}>Saved</Text>
                  </View>
                )}
              </View>

              <Text style={styles.diarySubtitle}>
                What was today like? This helps AI spot patterns over time.
              </Text>

              {/* 快速标签区 — 点一下就能记录，零摩擦 */}
              <View style={styles.tagGrid}>
                {DIARY_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id);
                  return (
                    <TouchableOpacity
                      key={tag.id}
                      onPress={() => toggleTag(tag.id)}
                      activeOpacity={0.7}
                      style={[styles.tag, isSelected && styles.tagSelected]}
                    >
                      <Text
                        style={[
                          styles.tagText,
                          isSelected && styles.tagTextSelected,
                        ]}
                      >
                        {tag.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 自由文字输入 */}
              <TextInput
                style={styles.diaryInput}
                placeholder="Anything else worth noting? (optional)"
                placeholderTextColor={Colors.gray300}
                multiline
                numberOfLines={3}
                value={diaryNote}
                onChangeText={(text) => {
                  setDiaryNote(text);
                  setDiarySaved(false);
                }}
                returnKeyType="done"
              />

              {/* 保存按钮 — 只在有内容且未保存时显示 */}
              {hasDiaryContent && !diarySaved && (
                <TouchableOpacity
                  onPress={saveDiary}
                  disabled={savingDiary}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={Gradients.roseMain}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveBtn}
                  >
                    {savingDiary ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveBtnText}>Save diary entry</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* 已保存时显示的说明文字 */}
              {diarySaved && (
                <Text style={styles.diaryNote}>
                  This entry will be used to find patterns in your skin data
                  over time.
                </Text>
              )}
            </View>

            {/* AI 建议（占位，Phase 4 接真实 AI） */}
            <LinearGradient
              colors={["#fff0f6", "#fff5f5"]}
              style={[
                styles.insightCard,
                { borderColor: Colors.rose100, borderWidth: 1 },
              ]}
            >
              <View style={styles.insightHeader}>
                <Star size={16} color={Colors.rose400} fill={Colors.rose400} />
                <Text style={styles.insightTitle}>AI Insight</Text>
              </View>
              <Text style={styles.insightText}>
                {scan.total_count === 0
                  ? "Your skin looks clear! Keep up your skincare routine."
                  : scan.skin_status === "mild"
                    ? "Mild breakout detected. Consider gentle cleansing and staying hydrated."
                    : "Active breakout detected. Avoid touching your face and consider spot treatment."}
              </Text>
            </LinearGradient>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },

  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  navBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: FontSize.base,
    fontWeight: "600",
    color: Colors.gray800,
  },
  notFound: {
    fontSize: FontSize.base,
    color: Colors.gray500,
    marginBottom: Spacing.md,
  },
  backLink: {
    fontSize: FontSize.base,
    color: Colors.rose400,
    fontWeight: "600",
  },

  imageContainer: {
    position: "relative",
    marginBottom: Spacing.lg,
    borderRadius: Radius.xxl,
    overflow: "hidden",
  },
  image: { width: "100%", height: width * 0.75 },
  imagePlaceholder: {
    width: "100%",
    height: width * 0.75,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: { fontSize: 80 },
  statusBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  statusBadgeText: { color: "#fff", fontSize: FontSize.xs, fontWeight: "700" },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: "600",
    color: Colors.gray800,
    marginBottom: Spacing.md,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  infoText: { flex: 1 },
  infoLabel: {
    fontSize: FontSize.sm,
    color: Colors.gray700,
    fontWeight: "500",
  },
  infoSub: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 2 },
  divider: {
    height: 1,
    backgroundColor: Colors.gray100,
    marginVertical: Spacing.md,
  },

  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  scoreCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNumber: { fontSize: FontSize.xxl, fontWeight: "700", color: "#fff" },
  scoreInfo: { flex: 1 },
  scoreDesc: {
    fontSize: FontSize.sm,
    fontWeight: "500",
    color: Colors.gray700,
  },
  spotCount: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 4 },
  scoreBar: {
    height: 6,
    backgroundColor: Colors.gray100,
    borderRadius: 3,
    overflow: "hidden",
  },
  scoreBarFill: { height: "100%", borderRadius: 3 },

  acneGrid: { gap: Spacing.sm },
  acneItem: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  acneDot: { width: 12, height: 12, borderRadius: 6 },
  acneLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.gray600 },
  acneCount: { fontSize: FontSize.sm, fontWeight: "700" },

  // 皮肤日记样式
  diaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  diaryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  savedText: { fontSize: 10, color: Colors.emerald, fontWeight: "600" },
  diarySubtitle: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    marginBottom: Spacing.md,
    lineHeight: 16,
  },

  // 标签网格 — flexWrap 让标签自动换行
  tagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: Spacing.md,
  },
  tag: {
    backgroundColor: Colors.gray50,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  tagSelected: { backgroundColor: "#fff0f6", borderColor: Colors.rose200 },
  tagText: { fontSize: FontSize.xs, color: Colors.gray500, fontWeight: "500" },
  tagTextSelected: { color: Colors.rose400, fontWeight: "700" },

  diaryInput: {
    backgroundColor: Colors.gray50,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    fontSize: FontSize.sm,
    color: Colors.gray700,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  saveBtn: {
    borderRadius: Radius.full,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  saveBtnText: { color: "#fff", fontSize: FontSize.sm, fontWeight: "700" },
  diaryNote: {
    fontSize: FontSize.xs,
    color: Colors.gray300,
    textAlign: "center",
    lineHeight: 16,
  },

  insightCard: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  insightTitle: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.rose600,
  },
  insightText: { fontSize: FontSize.sm, color: Colors.gray600, lineHeight: 20 },
});
