import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { X, Zap, ZapOff, RotateCcw, Image } from "lucide-react-native";
import {
  Colors,
  Gradients,
  Spacing,
  Radius,
  FontSize,
} from "../../constants/theme";
import { saveScan, BodyZone, Detection } from "../../lib/mongodb";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

const { width, height } = Dimensions.get("window");

const ZONES: { label: string; value: BodyZone }[] = [
  { label: "Forehead", value: "face_forehead" },
  { label: "L. Cheek", value: "face_cheek_l" },
  { label: "R. Cheek", value: "face_cheek_r" },
  { label: "Chin", value: "face_chin" },
  { label: "Nose", value: "face_nose" },
];

async function getUserId(): Promise<string> {
  let id = await AsyncStorage.getItem("@aurasight_user_id");
  if (!id) {
    id = "guest_" + Math.random().toString(36).slice(2, 10);
    await AsyncStorage.setItem("@aurasight_user_id", id);
  }
  return id;
}

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<"face" | "body">("face");
  const [facing, setFacing] = useState<CameraType>("front");
  const [flash, setFlash] = useState(false);
  const [activeZone, setActiveZone] = useState<BodyZone>("face_chin");
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // 请求相机权限
  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  // ─── 拍照 ────────────────────────────────────────────────
  async function handleCapture() {
    if (!cameraRef.current || saving) return;

    try {
      setSaving(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
        skipProcessing: false,
      });

      if (!photo) throw new Error("No photo taken");

      await handleSave(photo.uri);
    } catch (err) {
      Alert.alert("Error", "Failed to take photo. Please try again.");
      console.error("Capture error:", err);
    } finally {
      setSaving(false);
    }
  }

  // ─── 从相册选择 ──────────────────────────────────────────
  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setSaving(true);
      await handleSave(result.assets[0].uri);
      setSaving(false);
    }
  }

  // ─── 保存记录 ────────────────────────────────────────────
  async function handleSave(imageUri: string) {
    try {
      const userId = await getUserId();

      // 现在用空 detections，等 AI 接入后再填充
      // TODO: Phase 4 接入 TFLite 模型分析 imageUri
      const mockDetections: Detection[] = [];

      await saveScan({
        user_id: userId,
        scan_date: new Date().toISOString(),
        body_zone: activeZone,
        image_uri: imageUri,
        detections: mockDetections,
      });

      Alert.alert(
        "✅ Scan Saved!",
        "Your scan has been recorded. Check History to see your progress.",
        [
          {
            text: "View History",
            onPress: () => router.push("/(tabs)/history"),
          },
          { text: "OK", style: "cancel" },
        ],
      );
    } catch (err) {
      Alert.alert("Error", "Failed to save scan. Please try again.");
      console.error("Save error:", err);
    }
  }

  // ─── 权限未授权 ──────────────────────────────────────────
  if (!permission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          Camera access is needed to scan your skin.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={styles.permissionButton}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 相机取景框 */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash ? "on" : "off"}
      >
        {/* 顶部控件 */}
        <SafeAreaView style={styles.topControls}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.back()}
          >
            <X size={20} color="#fff" />
          </TouchableOpacity>

          {/* Face / Body 切换 */}
          <View style={styles.modeToggle}>
            {(["face", "body"] as const).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setMode(m)}
                activeOpacity={0.85}
              >
                {mode === m ? (
                  <LinearGradient
                    colors={Gradients.roseMain}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modeActive}
                  >
                    <Text style={styles.modeActiveText}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.modeInactive}>
                    <Text style={styles.modeInactiveText}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setFlash((f) => !f)}
          >
            {flash ? (
              <Zap size={20} color="#fde68a" />
            ) : (
              <ZapOff size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </SafeAreaView>

        {/* 轮廓引导 */}
        <View style={styles.guideContainer}>
          {mode === "face" ? (
            <View style={styles.faceGuide}>
              <Text style={styles.guideHint}>Align your face</Text>
            </View>
          ) : (
            <View style={styles.bodyGuideWrapper}>
              <View style={styles.bodyGuide}>
                <View style={styles.bodyHead} />
              </View>
              <Text style={styles.guideHint}>Full body view</Text>
            </View>
          )}
        </View>

        {/* 翻转相机 */}
        <TouchableOpacity
          style={styles.flipButton}
          onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))}
        >
          <RotateCcw size={20} color="#fff" />
        </TouchableOpacity>
      </CameraView>

      {/* 底部抽屉 */}
      <View style={styles.bottomDrawer}>
        <View style={styles.drawerHandle} />

        {/* 部位选择 */}
        {mode === "face" && (
          <View style={styles.zoneRow}>
            {ZONES.map((zone) => (
              <TouchableOpacity
                key={zone.value}
                onPress={() => setActiveZone(zone.value)}
                activeOpacity={0.8}
              >
                {activeZone === zone.value ? (
                  <LinearGradient
                    colors={Gradients.roseMain}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.zoneActive}
                  >
                    <Text style={styles.zoneActiveText}>{zone.label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.zoneInactive}>
                    <Text style={styles.zoneInactiveText}>{zone.label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 拍照按钮 + 相册按钮 */}
        <View style={styles.captureRow}>
          {/* 相册 */}
          <TouchableOpacity style={styles.sideButton} onPress={handlePickImage}>
            <Image size={24} color={Colors.gray500} />
          </TouchableOpacity>

          {/* 拍照 */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.captureOuter}
            onPress={handleCapture}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.rose400} size="large" />
            ) : (
              <LinearGradient
                colors={Gradients.roseMain}
                style={styles.captureInner}
              />
            )}
          </TouchableOpacity>

          {/* 空白占位（保持居中） */}
          <View style={styles.sideButton} />
        </View>

        {saving && <Text style={styles.savingText}>Saving your scan...</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray900 },
  camera: { flex: 1 },

  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  permissionText: {
    fontSize: FontSize.base,
    color: Colors.gray600,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  permissionButton: {
    backgroundColor: Colors.rose400,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Radius.full,
  },
  permissionButtonText: { color: "#fff", fontWeight: "600" },

  topControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  modeToggle: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: Radius.full,
    padding: 4,
  },
  modeActive: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  modeActiveText: { color: "#fff", fontSize: FontSize.sm, fontWeight: "600" },
  modeInactive: { paddingHorizontal: 16, paddingVertical: 6 },
  modeInactiveText: { color: Colors.gray400, fontSize: FontSize.sm },

  guideContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  faceGuide: {
    width: 200,
    height: 280,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: "rgba(244,114,182,0.6)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 12,
  },
  guideHint: {
    color: "rgba(244,114,182,0.9)",
    fontSize: FontSize.xs,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    overflow: "hidden",
    marginTop: 16,
  },
  bodyGuideWrapper: { alignItems: "center" },
  bodyGuide: {
    width: 120,
    height: 300,
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
    borderWidth: 2,
    borderColor: "rgba(244,114,182,0.6)",
    borderStyle: "dashed",
    alignItems: "center",
    paddingTop: 16,
  },
  bodyHead: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(244,114,182,0.6)",
    borderStyle: "dashed",
  },

  flipButton: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },

  bottomDrawer: {
    backgroundColor: Colors.white,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: Spacing.lg,
  },
  drawerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray200,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },

  zoneRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: Spacing.xl,
    flexWrap: "wrap",
  },
  zoneActive: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  zoneActiveText: { color: "#fff", fontSize: FontSize.xs, fontWeight: "600" },
  zoneInactive: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: "#fff0f6",
  },
  zoneInactiveText: { color: Colors.gray500, fontSize: FontSize.xs },

  captureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sideButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  captureOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.white,
    borderWidth: 4,
    borderColor: "#ffe4e6",
    alignItems: "center",
    justifyContent: "center",
  },
  captureInner: { width: 56, height: 56, borderRadius: 28 },
  savingText: {
    textAlign: "center",
    color: Colors.gray400,
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
  },
});
