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
import * as ImageManipulator from "expo-image-manipulator";
import Svg, { Path, G, Ellipse } from "react-native-svg";
import {
  X,
  Zap,
  ZapOff,
  RotateCcw,
  ImageIcon,
  Timer,
} from "lucide-react-native";
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
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.59:3000";

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

// ─── 头部轮廓 SVG ─────────────────────────────────────────
const HEAD_PATH = `
  M 110,18
  C 145,18 178,35 190,65
  C 198,85 196,110 190,130
  C 185,148 178,162 172,175
  C 165,190 158,202 148,215
  C 138,228 125,238 110,242
  C 95,238 82,228 72,215
  C 62,202 55,190 48,175
  C 42,162 35,148 30,130
  C 24,110 22,85 30,65
  C 42,35 75,18 110,18
  Z
`;

function HeadOutline({ countdown }: { countdown: number | null }) {
  const active = countdown !== null;
  const color = active ? "rgba(52,211,153,0.9)" : "rgba(244,114,182,0.75)";
  // 用相对于宽度的固定比例，不依赖屏幕高度
  const guideW = width * 0.58;
  const guideH = guideW * 1.35; // 头部大约是宽的1.35倍高
  const guideX = (width - guideW) / 2;
  const guideY = height * 0.12; // 从顶部12%开始
  const scaleX = guideW / 220;
  const scaleY = guideH / 300;

  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
    >
      <G
        transform={`translate(${guideX}, ${guideY}) scale(${scaleX}, ${scaleY})`}
      >
        <Path
          d={HEAD_PATH}
          fill={active ? "rgba(52,211,153,0.07)" : "none"}
          stroke={color}
          strokeWidth={3.5 / Math.max(scaleX, scaleY)}
          strokeDasharray={active ? undefined : `${12 / scaleX} ${6 / scaleX}`}
        />
      </G>
    </Svg>
  );
}

function BodyOutline() {
  const headCX = width / 2;
  const headCY = height * 0.13;
  const headR = width * 0.1;
  const shoulderY = headCY + headR * 1.6;
  const shoulderW = width * 0.42;
  const hipW = width * 0.32;
  const hipY = shoulderY + height * 0.28;
  const footY = height * 0.72;
  const bodyPath = `
    M ${headCX - shoulderW / 2},${shoulderY}
    L ${headCX - hipW / 2},${hipY}
    L ${headCX - hipW / 2},${footY}
    L ${headCX + hipW / 2},${footY}
    L ${headCX + hipW / 2},${hipY}
    L ${headCX + shoulderW / 2},${shoulderY}
    Z
  `;
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
    >
      <Ellipse
        cx={headCX}
        cy={headCY}
        rx={headR}
        ry={headR * 1.2}
        fill="none"
        stroke="rgba(244,114,182,0.75)"
        strokeWidth={2.5}
        strokeDasharray="10 5"
      />
      <Path
        d={bodyPath}
        fill="none"
        stroke="rgba(244,114,182,0.75)"
        strokeWidth={2.5}
        strokeDasharray="10 5"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── 倒计时大数字 ─────────────────────────────────────────
function CountdownOverlay({ count }: { count: number }) {
  return (
    <View style={cd.wrapper} pointerEvents="none">
      <LinearGradient
        colors={["rgba(244,114,182,0.88)", "rgba(251,113,133,0.88)"]}
        style={cd.circle}
      >
        <Text style={cd.text}>{count}</Text>
      </LinearGradient>
    </View>
  );
}
const cd = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { fontSize: 72, fontWeight: "800", color: "#fff" },
});

// ─── 主组件 ───────────────────────────────────────────────
export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<"face" | "body">("face");
  const [facing, setFacing] = useState<CameraType>("front");
  const [flash, setFlash] = useState(false);
  const [activeZone, setActiveZone] = useState<BodyZone>("face_chin");
  const [saving, setSaving] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  // 组件卸载时清除倒计时
  useEffect(() => {
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, []);

  // ─── 倒计时拍摄 ───────────────────────────────────────
  function startCountdown() {
    if (countdown !== null) {
      // 取消倒计时
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      countdownTimer.current = null;
      setCountdown(null);
      return;
    }

    let count = 3;
    setCountdown(count);

    countdownTimer.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(countdownTimer.current!);
        countdownTimer.current = null;
        setCountdown(null);
        handleCapture();
      } else {
        setCountdown(count);
      }
    }, 1000);
  }

  // ─── 立即拍照 ─────────────────────────────────────────
  async function handleCapture() {
    if (!cameraRef.current || saving) return;

    try {
      setSaving(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: false,
        skipProcessing: false,
      });

      if (!photo) throw new Error("No photo taken");

      let finalUri = photo.uri;

      // 前置摄像头：水平镜像翻转
      if (facing === "front") {
        const flipped = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ flip: ImageManipulator.FlipType.Horizontal }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
        );
        finalUri = flipped.uri;
      }

      await handleSave(finalUri);
    } catch (err) {
      Alert.alert("Error", "Failed to take photo. Please try again.");
      console.error("Capture error:", err);
    } finally {
      setSaving(false);
    }
  }

  // ─── 相册 ─────────────────────────────────────────────
  async function handlePickImage() {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
      setCountdown(null);
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setSaving(true);
      await handleSave(result.assets[0].uri);
      setSaving(false);
    }
  }

  // ─── 保存 + 积分 ──────────────────────────────────────
  async function handleSave(imageUri: string) {
    try {
      const userId = await getUserId();

      await saveScan({
        user_id: userId,
        scan_date: new Date().toISOString(),
        body_zone: activeZone,
        image_uri: imageUri,
        detections: [] as Detection[],
      });

      const taskType =
        activeZone === "back" || activeZone === "chest" ? "body" : "face";

      const ptsRes = await fetch(`${API_URL}/points/${userId}/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_type: taskType }),
      }).then((r) => r.json());

      const earned = ptsRes.points_earned ?? 0;
      const already = earned === 0;

      Alert.alert(
        already ? "✅ Already Done!" : `🎉 +${earned} pts earned!`,
        already
          ? "You already completed this task today. Come back tomorrow!"
          : `${taskType === "face" ? "Face" : "Body"} scan saved!${ptsRes.streak > 1 ? ` 🔥 ${ptsRes.streak}-day streak!` : ""}`,
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

  if (!permission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionEmoji}>📷</Text>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          AuraSight needs camera access to scan your skin
        </Text>
        <TouchableOpacity onPress={requestPermission}>
          <LinearGradient
            colors={Gradients.roseMain}
            style={styles.permissionBtn}
          >
            <Text style={styles.permissionBtnText}>Grant Permission</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 相机 — flex:1 让它占满除底部抽屉以外的空间 */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash ? "on" : "off"}
      />

      {/* 覆盖层 — absoluteFill 完整覆盖相机区域 */}
      <View style={styles.overlay}>
        {/* 顶部控件 */}
        <SafeAreaView style={styles.topControls}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              if (countdownTimer.current) clearInterval(countdownTimer.current);
              router.back();
            }}
          >
            <X size={20} color="#fff" />
          </TouchableOpacity>

          <View style={styles.modeToggle}>
            {(["face", "body"] as const).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => {
                  if (countdownTimer.current) {
                    clearInterval(countdownTimer.current);
                    setCountdown(null);
                  }
                  setMode(m);
                  setActiveZone(m === "body" ? "back" : "face_chin");
                }}
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
            style={[styles.iconButton, flash && styles.iconButtonActive]}
            onPress={() => setFlash((f) => !f)}
          >
            {flash ? (
              <Zap size={20} color="#fde68a" />
            ) : (
              <ZapOff size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </SafeAreaView>

        {/* 头部/身体轮廓 */}
        {mode === "face" ? (
          <HeadOutline countdown={countdown} />
        ) : (
          <BodyOutline />
        )}

        {/* 倒计时数字 */}
        {countdown !== null && <CountdownOverlay count={countdown} />}

        {/* 底部提示 */}
        <View style={styles.hintWrapper} pointerEvents="none">
          <View style={[styles.hint, countdown !== null && styles.hintGreen]}>
            <Text style={styles.hintText}>
              {countdown !== null
                ? `Hold still... ${countdown}`
                : mode === "face"
                  ? "Tap ⏱ for auto-shoot · tap 📷 for instant"
                  : "Step back for full body view"}
            </Text>
          </View>
        </View>

        {/* 翻转按钮 */}
        <TouchableOpacity
          style={styles.flipButton}
          onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))}
        >
          <RotateCcw size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 底部抽屉 */}
      <View style={styles.bottomDrawer}>
        <View style={styles.drawerHandle} />

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

        <View style={styles.captureRow}>
          {/* 相册 */}
          <TouchableOpacity style={styles.sideButton} onPress={handlePickImage}>
            <ImageIcon size={26} color={Colors.gray500} />
          </TouchableOpacity>

          {/* 即拍快门 */}
          <TouchableOpacity
            style={styles.shutterOuter}
            onPress={handleCapture}
            disabled={saving || countdown !== null}
            activeOpacity={0.85}
          >
            <View
              style={[
                styles.shutterMiddle,
                (saving || countdown !== null) && {
                  borderColor: Colors.gray200,
                },
              ]}
            >
              {saving ? (
                <ActivityIndicator color={Colors.rose400} />
              ) : (
                <LinearGradient
                  colors={
                    countdown !== null
                      ? [Colors.gray200, Colors.gray200]
                      : Gradients.roseMain
                  }
                  style={styles.shutterInner}
                />
              )}
            </View>
          </TouchableOpacity>

          {/* 倒计时拍摄按钮 */}
          <TouchableOpacity
            style={[
              styles.sideButton,
              countdown !== null && styles.sideButtonActive,
            ]}
            onPress={startCountdown}
            disabled={saving}
          >
            <Timer
              size={26}
              color={countdown !== null ? Colors.rose400 : Colors.gray500}
            />
            {countdown !== null && (
              <View style={styles.cancelDot}>
                <Text style={styles.cancelDotText}>✕</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {saving && <Text style={styles.savingText}>Saving your scan...</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  // flex:1 让相机占满除底部抽屉之外的所有空间
  camera: { flex: 1, width },
  // absoluteFill 让覆盖层和相机完全重叠
  overlay: { ...StyleSheet.absoluteFillObject, bottom: undefined },

  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    backgroundColor: "#fff",
  },
  permissionEmoji: { fontSize: 56, marginBottom: Spacing.md },
  permissionTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.gray800,
    marginBottom: Spacing.sm,
  },
  permissionText: {
    fontSize: FontSize.sm,
    color: Colors.gray500,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  permissionBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: Radius.full,
  },
  permissionBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: FontSize.base,
  },

  topControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonActive: { backgroundColor: "rgba(244,114,182,0.5)" },
  modeToggle: {
    flexDirection: "row",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: Radius.full,
    padding: 3,
  },
  modeActive: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  modeActiveText: { color: "#fff", fontSize: FontSize.sm, fontWeight: "700" },
  modeInactive: { paddingHorizontal: 18, paddingVertical: 7 },
  modeInactiveText: { color: "rgba(255,255,255,0.6)", fontSize: FontSize.sm },

  hintWrapper: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  hint: {
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  hintGreen: { backgroundColor: "rgba(5,150,105,0.75)" },
  hintText: { color: "#fff", fontSize: FontSize.xs, fontWeight: "500" },

  flipButton: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  bottomDrawer: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 10,
    paddingBottom: 28,
    paddingHorizontal: Spacing.lg,
  },
  drawerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray200,
    alignSelf: "center",
    marginBottom: Spacing.md,
  },

  zoneRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: Spacing.lg,
    flexWrap: "wrap",
  },
  zoneActive: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  zoneActiveText: { color: "#fff", fontSize: FontSize.xs, fontWeight: "700" },
  zoneInactive: {
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  sideButtonActive: { opacity: 1 },
  cancelDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.red,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelDotText: { color: "#fff", fontSize: 8, fontWeight: "700" },

  shutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(244,114,182,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterMiddle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: Colors.rose200,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 54, height: 54, borderRadius: 27 },
  savingText: {
    textAlign: "center",
    color: Colors.gray400,
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
  },
});
