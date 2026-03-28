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

async function deleteScan(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/scans/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Delete failed");
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

export default function ScanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [scan, setScan] = useState<ScanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadScan();
  }, [id]);

  async function loadScan() {
    try {
      const userId = await getUserId();
      const scans = await getRecentScans(userId, 30);
      const found = scans.find((s) => s._id === id);
      setScan(found ?? null);
    } catch (err) {
      console.error("Failed to load scan:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    Alert.alert(
      "Delete Scan",
      "Are you sure you want to delete this scan? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteScan(id!);
              router.back();
            } catch {
              Alert.alert("Error", "Failed to delete scan.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
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

  return (
    <LinearGradient colors={["#fff5f5", "#ffffff"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* 顶部导航 */}
        <View style={styles.topNav}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <ChevronLeft size={24} color={Colors.gray700} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Scan Detail</Text>
          <TouchableOpacity
            onPress={handleDelete}
            style={styles.deleteBtn}
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
        >
          {/* 图片 */}
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
            {/* 状态角标 */}
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

          {/* 基本信息 */}
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

            {/* 进度条 */}
            <View style={styles.scoreBar}>
              <LinearGradient
                colors={Gradients.roseMain}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.scoreBarFill, { width: `${scan.skin_score}%` }]}
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

          {/* AI 建议（占位，Phase 4 接入真实 AI） */}
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
  backBtn: {
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
  deleteBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
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
  statusBadgeText: {
    color: "#fff",
    fontSize: FontSize.xs,
    fontWeight: "700",
    textTransform: "uppercase",
  },

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
