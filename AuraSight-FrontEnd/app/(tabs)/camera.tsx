import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
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
import { saveScan, BodyZone, Detection, AcneType } from "../../lib/mongodb";
import { analyzeImage, AnalyzeResult } from "../../lib/ai";
import { AnnotatedSkinImage, TYPE_COLOR, TYPE_LABEL } from "../../components/AnnotatedSkinImage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { canUseAI, consumeAI, getQuotaSummary, WEEKLY_AI_LIMIT } from "../../lib/quota";
import { useUser } from "../../lib/userContext";
import { hasConsent, acceptConsent } from "../../lib/consent";
import { ConsentModal } from "../../components/ConsentModal";
import { getUserId } from "../../lib/userId";

const { width } = Dimensions.get("window");
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.59:3000";

const TYPE_DESC: Record<AcneType, string> = {
  pustule:  "White/yellow pus-filled pimple",
  redness:  "Red inflamed area, no white head",
  broken:   "Picked or burst pimple, open wound",
  scab:     "Healing crust or dry scab",
};

// 底部抽屉固定高度
const DRAWER_H_FACE = 170;
const DRAWER_H_BODY = 170;

const ZONES: { label: string; value: BodyZone }[] = [
  { label: "Forehead", value: "face_forehead" },
  { label: "L. Cheek", value: "face_cheek_l" },
  { label: "R. Cheek", value: "face_cheek_r" },
  { label: "Chin", value: "face_chin" },
  { label: "Nose", value: "face_nose" },
];

// getUserId 现在从 lib/userId.ts 导入（顶部 import 里）

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
    ...StyleSheet.absoluteFillObject,
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

  // Preview + AI analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewBase64, setPreviewBase64] = useState<string | null>(null); // for Cloudinary upload
  const [aiResult, setAiResult] = useState<AnalyzeResult | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editableDetections, setEditableDetections] = useState<Detection[]>([]);
  const [pendingAddPos, setPendingAddPos] = useState<{ cx: number; cy: number } | null>(null);
  const [undoStack, setUndoStack] = useState<Detection[][]>([]);

  // Free-tier / VIP gating
  const { user, refreshUser } = useUser();
  const isVIP = user?.mode === "vip";

  // 每次进入相机 tab 都重新拉一次 user mode——
  // 因为 settings/profile 页可能改了 VIP 状态，要保证 isVIP 是最新的
  useFocusEffect(
    useCallback(() => {
      refreshUser();
    }, [refreshUser]),
  );
  const [aiLocked, setAiLocked] = useState(false); // true when free user hit quota on this photo
  // consentLocked 和 aiLocked 分开——前者是"用户还没同意数据使用"，后者是"这周
  // AI 用完了"。两种 UI 应该引导去不同的地方（Settings vs VIP 升级）。
  const [consentLocked, setConsentLocked] = useState(false);
  const [quotaRemaining, setQuotaRemaining] = useState<number>(WEEKLY_AI_LIMIT);

  useEffect(() => {
    getQuotaSummary().then((q) => setQuotaRemaining(q.remaining));
  }, [user?.mode, previewUri]);

  const cameraRef = useRef<CameraView>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Data-use consent gate ─────────────────────────────
  // 用户在使用 AI 检测或把照片保存到云端之前，必须先同意我们使用照片做后续训练。
  // pendingConsentAction 暂存"同意之后要做什么"——同意了就执行；拒绝就丢弃。
  const [consentVisible, setConsentVisible] = useState(false);
  const pendingConsentAction = useRef<null | (() => void)>(null);

  /**
   * 包装任何"需要用户同意才能做的动作"。
   * 已同意 → 立即执行；未同意 → 弹窗，同意后执行，拒绝后丢弃。
   */
  async function requireConsent(action: () => void) {
    if (await hasConsent()) {
      action();
      return;
    }
    pendingConsentAction.current = action;
    setConsentVisible(true);
  }

  async function onConsentAgree() {
    await acceptConsent();
    setConsentVisible(false);
    const a = pendingConsentAction.current;
    pendingConsentAction.current = null;
    if (a) a();
  }

  function onConsentDecline() {
    setConsentVisible(false);
    pendingConsentAction.current = null;
  }

  // 直接用 flex:1 让相机区域填满剩余空间
  // 不再手动计算高度，避免状态栏/安全区域计算误差
  const drawerH = mode === "face" ? DRAWER_H_FACE : DRAWER_H_BODY;

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  useEffect(() => {
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, []);

  // ─── 倒计时拍摄 ───────────────────────────────────────
  function startCountdown() {
    if (countdown !== null) {
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

  // ─── 拍照 → AI分析 → 预览 ────────────────────────────
  async function handleCapture() {
    if (!cameraRef.current || saving || analyzing) return;
    try {
      setSaving(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: false,
        skipProcessing: false,
      });
      if (!photo) throw new Error("No photo taken");

      let finalUri = photo.uri;
      if (facing === "front") {
        const flipped = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ flip: ImageManipulator.FlipType.Horizontal }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
        );
        finalUri = flipped.uri;
      }
      setSaving(false);

      // Show preview immediately
      setPreviewUri(finalUri);
      setAiResult(null);

      // 数据使用同意——没同意之前不能跑 AI（也不能把图片送到云端）
      const consented = await hasConsent();
      if (!consented) {
        setConsentLocked(true);
        setAnalyzing(false);
        // 弹窗征求同意；同意后用同一张照片继续跑 AI
        requireConsent(() => runAiOn(finalUri));
        return;
      }

      await runAiOn(finalUri);
    } catch {
      Alert.alert("Error", "Failed to take photo. Please try again.");
      setSaving(false);
    }
  }

  // 对给定图片 URI 跑 AI 分析——假定用户已同意数据使用条款。
  async function runAiOn(uri: string) {
    // Gate by VIP / weekly quota
    const allowed = await canUseAI(isVIP);
    if (!allowed) {
      setAiLocked(true);
      setAnalyzing(false);
      return;
    }
    setAiLocked(false);
    setConsentLocked(false);
    setAnalyzing(true);
    try {
      const resized = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 512 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      const b64 = resized.base64 ?? "";
      setPreviewBase64(b64); // 保存供上传 Cloudinary
      const result = await analyzeImage(b64, "image/jpeg");
      setAiResult(result);
      await consumeAI(isVIP);
      const q = await getQuotaSummary();
      setQuotaRemaining(q.remaining);
    } catch {
      setAiResult(null); // analysis failed — still allow saving
    } finally {
      setAnalyzing(false);
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
      const uri = result.assets[0].uri;
      setPreviewUri(uri);
      setAiResult(null);

      // 未同意数据使用条款 → 不跑 AI，弹窗征求同意
      const consented = await hasConsent();
      if (!consented) {
        setConsentLocked(true);
        requireConsent(() => runAiOn(uri));
        return;
      }
      await runAiOn(uri);
    }
  }

  // ─── 确认保存（从预览页调用）────────────────────────
  async function handleConfirmSave() {
    if (!previewUri) return;
    // 保存到云端 = 把照片送到后台；必须先拿到用户的数据使用同意
    if (!(await hasConsent())) {
      requireConsent(() => {
        // 用户同意后重新触发保存流程
        handleConfirmSave();
      });
      return;
    }
    setSaving(true);
    try {
      const userId = await getUserId();
      // aiResult.detections always has the latest (edits are synced back on Done)
      const detections = (aiResult?.detections ?? []) as Detection[];

      await saveScan({
        user_id: userId,
        scan_date: new Date().toISOString(),
        body_zone: activeZone,
        image_uri: previewUri,
        detections,
        notes: aiResult?.summary ?? "",
      }, previewBase64 ?? undefined);

      const taskType = activeZone === "back" || activeZone === "chest" ? "body" : "face";
      const ptsRes = await fetch(`${API_URL}/points/${userId}/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_type: taskType }),
      }).then((r) => r.json());

      const earned = ptsRes.points_earned ?? 0;
      // Close preview
      setPreviewUri(null);
      setAiResult(null);

      Alert.alert(
        earned === 0 ? "✅ Already Done!" : `🎉 +${earned} pts!`,
        earned === 0
          ? "You already completed this task today."
          : `Scan saved!${ptsRes.streak > 1 ? ` 🔥 ${ptsRes.streak}-day streak!` : ""}`,
        [
          { text: "View History", onPress: () => router.push("/(tabs)/history") },
          { text: "OK", style: "cancel" },
        ],
      );
    } catch {
      Alert.alert("Error", "Failed to save scan. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Push current detections to undo stack before a change
  function pushUndo(current: Detection[]) {
    setUndoStack(prev => [...prev.slice(-9), [...current]]);
  }

  function handleUndo() {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const restored = prev[prev.length - 1];
      setEditableDetections(restored);
      return prev.slice(0, -1);
    });
  }

  function handleRetake() {
    setPreviewUri(null);
    setAiResult(null);
    setAnalyzing(false);
    setShowAnnotations(true);
    setEditMode(false);
    setEditableDetections([]);
    setPendingAddPos(null);
    setUndoStack([]);
    setAiLocked(false);
    setConsentLocked(false);
  }

  // ─── 权限页面 ─────────────────────────────────────────
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
    <>
    <View style={styles.container}>
      {/* 카메라 영역 — flex:1 로 나머지 공간을 모두 채웁니다 */}
      <View style={styles.cameraWrapper}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing={facing}
          flash={flash ? "on" : "off"}
        />

        {/* 오버레이 — 카메라 위에 컨트롤 레이어 */}
        <View style={StyleSheet.absoluteFillObject}>
          {/* 顶部控件 */}
          <SafeAreaView style={styles.topControls}>
            {/* 占位——保持 mode toggle 居中（已用 tab bar 切换页面，不再需要 X 关闭按钮） */}
            <View style={styles.iconButtonSpacer} />

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

          {/* 倒计时数字 */}
          {countdown !== null && <CountdownOverlay count={countdown} />}

          {/* 提示文字 */}
          <View style={styles.hintWrapper} pointerEvents="none">
            <View style={[styles.hint, countdown !== null && styles.hintGreen]}>
              <Text style={styles.hintText}>
                {countdown !== null
                  ? `Hold still... ${countdown}`
                  : mode === "face"
                    ? "👓 Remove glasses · Tap ⏱ auto-shoot · tap 📷 instant"
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
      </View>

      {/* 底部抽屉 — 고정 높이, flex 없음 */}
      <View style={[styles.bottomDrawer, { height: drawerH }]}>
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

          {/* 倒计时按钮 */}
          <TouchableOpacity
            style={styles.sideButton}
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

    {/* ── AI Analysis Preview Modal ── */}
    <Modal
      visible={!!previewUri}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleRetake}
    >
      <View style={styles.previewModal}>
        {/* Header */}
        <View style={styles.previewHeader}>
          <TouchableOpacity onPress={handleRetake} style={styles.previewBack}>
            <Text style={styles.previewBackText}>✕ Retake</Text>
          </TouchableOpacity>
          <Text style={styles.previewTitle}>Scan Preview</Text>
          {/* Edit controls */}
          {!analyzing && aiResult && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {/* Undo — only in edit mode */}
              {editMode && (
                <TouchableOpacity
                  style={[styles.undoBtn, undoStack.length === 0 && styles.undoBtnDisabled]}
                  onPress={handleUndo}
                  disabled={undoStack.length === 0}
                >
                  <Text style={[styles.undoBtnText, undoStack.length === 0 && styles.undoBtnTextDisabled]}>
                    ↩︎
                  </Text>
                </TouchableOpacity>
              )}
              {/* Edit / Done toggle */}
              <TouchableOpacity
                style={[styles.editToggleBtn, editMode && styles.editToggleBtnActive]}
                onPress={() => {
                  if (!editMode) {
                    setEditableDetections([...(aiResult?.detections ?? [])]);
                    setUndoStack([]);
                    setShowAnnotations(true);
                  } else {
                    setAiResult(prev => prev ? { ...prev, detections: editableDetections } : prev);
                    setUndoStack([]);
                  }
                  setEditMode(v => !v);
                }}
              >
                <Text style={[styles.editToggleBtnText, editMode && styles.editToggleBtnTextActive]}>
                  {editMode ? "✓ Done" : "✏️ Edit"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {!aiResult && <View style={{ width: 70 }} />}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.previewScroll}
          scrollEnabled={!editMode}
        >
          {/* Annotated image */}
          {previewUri && (
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {
                if (editMode || analyzing) return;
                setShowAnnotations(v => !v);
              }}
              style={styles.previewImageWrap}
            >
              <AnnotatedSkinImage
                imageUri={previewUri}
                detections={
                  editMode
                    ? editableDetections
                    : showAnnotations ? (aiResult?.detections ?? []) : []
                }
                displayWidth={width - 32}
                displayHeight={(width - 32) * 1.1}
                borderRadius={20}
                editMode={editMode}
                onDeleteDetection={(idx) => {
                  pushUndo(editableDetections);
                  setEditableDetections(prev => prev.filter((_, i) => i !== idx));
                }}
                onAddAtPosition={(cx, cy) => {
                  setPendingAddPos({ cx, cy });
                }}
              />

              {/* Analyzing overlay */}
              {analyzing && (
                <View style={styles.analyzingOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.analyzingText}>AI analyzing spots...</Text>
                </View>
              )}

              {/* Toggle hint — only in view mode */}
              {!analyzing && !editMode && aiResult && aiResult.detections.length > 0 && (
                <View style={styles.toggleHint}>
                  <Text style={styles.toggleHintText}>
                    {showAnnotations ? "👁 Tap to hide marks" : "👁 Tap to show marks"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* ── Type Picker Modal (Add new box) ── */}
          <Modal
            visible={!!pendingAddPos}
            transparent
            animationType="fade"
            onRequestClose={() => setPendingAddPos(null)}
          >
            <Pressable style={styles.typePickerBackdrop} onPress={() => setPendingAddPos(null)}>
              <View style={styles.typePickerSheet}>
                <Text style={styles.typePickerTitle}>What type of spot?</Text>
                <Text style={styles.typePickerSub}>Select the acne type to add at this location</Text>
                {(["pustule", "redness", "broken", "scab"] as AcneType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typePickerRow, { borderLeftColor: TYPE_COLOR[type] }]}
                    onPress={() => {
                      if (!pendingAddPos) return;
                      pushUndo(editableDetections);
                      const newDet: Detection = {
                        acne_type: type,
                        confidence: 1.0,
                        bbox: { cx: pendingAddPos.cx, cy: pendingAddPos.cy, w: 0.08, h: 0.08 },
                      };
                      setEditableDetections(prev => [...prev, newDet]);
                      setPendingAddPos(null);
                    }}
                  >
                    <View style={[styles.typePickerDot, { backgroundColor: TYPE_COLOR[type] }]} />
                    <View>
                      <Text style={styles.typePickerLabel}>{TYPE_LABEL[type]}</Text>
                      <Text style={styles.typePickerDesc}>{TYPE_DESC[type]}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.typePickerCancel} onPress={() => setPendingAddPos(null)}>
                  <Text style={styles.typePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>

          {/* AI Results */}
          {!analyzing && aiResult && (
            <>
              {/* Summary row */}
              <View style={styles.previewSummaryRow}>
                <View style={styles.previewStat}>
                  <Text style={styles.previewStatNum}>{aiResult.detections.length}</Text>
                  <Text style={styles.previewStatLbl}>Spots Found</Text>
                </View>
                <View style={[styles.previewStat, styles.previewStatMid]}>
                  <Text style={[styles.previewStatNum, {
                    color: aiResult.severity === "clear" ? "#10B981"
                      : aiResult.severity === "mild" ? "#F59E0B"
                      : aiResult.severity === "moderate" ? "#F97316"
                      : "#EF4444"
                  }]}>
                    {aiResult.severity.charAt(0).toUpperCase() + aiResult.severity.slice(1)}
                  </Text>
                  <Text style={styles.previewStatLbl}>Severity</Text>
                </View>
                <View style={styles.previewStat}>
                  <Text style={[styles.previewStatNum, { color: "#F472B6" }]}>
                    {Math.round((1 - aiResult.detections.reduce((s, d) => s + (1 - d.confidence), 0) / Math.max(aiResult.detections.length, 1)) * 100)}%
                  </Text>
                  <Text style={styles.previewStatLbl}>Confidence</Text>
                </View>
              </View>

              {/* AI summary */}
              <View style={styles.previewSummaryCard}>
                <Text style={styles.previewSummaryTitle}>🤖 AI Assessment</Text>
                <Text style={styles.previewSummaryText}>{aiResult.summary}</Text>
                {aiResult.positive ? (
                  <Text style={styles.previewPositive}>✨ {aiResult.positive}</Text>
                ) : null}
              </View>

              {/* Tips */}
              {aiResult.tips?.length > 0 && (
                <View style={styles.previewTipsCard}>
                  <Text style={styles.previewSummaryTitle}>💡 Tips for Today</Text>
                  {aiResult.tips.map((tip, i) => (
                    <View key={i} style={styles.previewTipRow}>
                      <View style={styles.previewTipDot} />
                      <Text style={styles.previewTipText}>{tip}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* 用户拒绝 / 从未同意数据使用条款——引导去 Settings 打开开关 */}
          {!analyzing && !aiResult && consentLocked && (
            <View style={styles.paywallCard}>
              <Text style={styles.paywallEmoji}>🛡️</Text>
              <Text style={styles.paywallTitle}>Photo data use is off</Text>
              <Text style={styles.paywallSub}>
                AI detection needs your permission to analyze photos.{"\n"}
                Enable it in Settings → Privacy → Allow photo data use.
              </Text>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => router.push("/settings")}
                style={styles.paywallCTAShadow}
              >
                <LinearGradient
                  colors={["#F472B6", "#EC4899"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.paywallCTA}
                >
                  <Text style={styles.paywallCTAText}>Open Settings</Text>
                </LinearGradient>
              </TouchableOpacity>
              <Text style={styles.paywallHint}>
                Or tap Save to keep the photo locally without AI analysis.
              </Text>
            </View>
          )}

          {!analyzing && !aiResult && aiLocked && !consentLocked && !isVIP && (
            <View style={styles.paywallCard}>
              <Text style={styles.paywallEmoji}>🔒</Text>
              <Text style={styles.paywallTitle}>AI detection used for this week</Text>
              <Text style={styles.paywallSub}>
                Free plan includes {WEEKLY_AI_LIMIT} AI scan per week.{"\n"}
                Upgrade to VIP for unlimited detection & tracking.
              </Text>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => router.push("/vip")}
                style={styles.paywallCTAShadow}
              >
                <LinearGradient
                  colors={["#b77cff", "#ff5e8e"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.paywallCTA}
                >
                  <Text style={styles.paywallCTAText}>Upgrade to VIP</Text>
                </LinearGradient>
              </TouchableOpacity>
              <Text style={styles.paywallHint}>
                Or tap Save to keep the photo without detection.
              </Text>
            </View>
          )}

          {!analyzing && !aiResult && !aiLocked && !consentLocked && (
            <View style={styles.previewNoAI}>
              <Text style={styles.previewNoAIText}>AI analysis unavailable — scan will be saved without spot detection.</Text>
            </View>
          )}
        </ScrollView>

        {/* Save button */}
        <View style={styles.previewFooter}>
          <TouchableOpacity
            onPress={handleConfirmSave}
            disabled={saving || analyzing}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={saving || analyzing ? ["#E5E7EB", "#E5E7EB"] : ["#F43F8F", "#F472B6"]}
              style={styles.previewSaveBtn}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.previewSaveBtnText}>
                  {analyzing ? "Analyzing..." : editMode ? `Save (${editableDetections.length} spots)` : "Save Scan"}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

    {/* Data-use consent — 首次使用 AI / 上传云端前弹窗 */}
    <ConsentModal
      visible={consentVisible}
      onAgree={onConsentAgree}
      onDecline={onConsentDecline}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  cameraWrapper: { flex: 1, width, overflow: "hidden" },

  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    backgroundColor: "#FFF3F6",
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
  iconButtonSpacer: { width: 42, height: 42 },
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
    backgroundColor: "#FFFBF9",
    paddingTop: 10,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#F9E0EE",
  },
  drawerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#F0ABCA",
    alignSelf: "center",
    marginBottom: Spacing.md,
  },

  zoneRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: Spacing.md,
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
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "rgba(244,114,182,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(244,114,182,0.25)",
  },
  shutterMiddle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: "#F472B6",
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

  // ── Preview Modal
  previewModal: { flex: 1, backgroundColor: "#FAFAFA" },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F9E0EE",
    backgroundColor: "#fff",
  },
  previewBack: { paddingVertical: 4, paddingHorizontal: 2 },
  previewBackText: { fontSize: 14, color: "#F43F8F", fontWeight: "600" },
  previewTitle: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  previewScroll: { padding: 16, paddingBottom: 24 },
  previewImageWrap: { position: "relative", marginBottom: 16, borderRadius: 20, overflow: "hidden" },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderRadius: 20,
  },
  analyzingText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  toggleHint: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  toggleHintText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  // Edit mode
  editToggleBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#F43F8F",
    width: 70,
    alignItems: "center",
  },
  editToggleBtnActive: {
    backgroundColor: "#F43F8F",
  },
  editToggleBtnText: { fontSize: 13, fontWeight: "700", color: "#F43F8F" },
  editToggleBtnTextActive: { color: "#fff" },
  undoBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  undoBtnDisabled: { backgroundColor: "#F9FAFB" },
  undoBtnText: { fontSize: 17, color: "#374151" },
  undoBtnTextDisabled: { color: "#D1D5DB" },

  // Type picker modal
  typePickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  typePickerSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  typePickerTitle: { fontSize: 17, fontWeight: "800", color: "#1F2937", marginBottom: 4 },
  typePickerSub: { fontSize: 13, color: "#6B7280", marginBottom: 20 },
  typePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderLeftWidth: 4,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    marginBottom: 10,
    gap: 14,
  },
  typePickerDot: { width: 14, height: 14, borderRadius: 7 },
  typePickerLabel: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  typePickerDesc: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  typePickerCancel: { marginTop: 6, alignItems: "center", paddingVertical: 12 },
  typePickerCancelText: { fontSize: 15, color: "#9CA3AF", fontWeight: "600" },
  previewSummaryRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F9E0EE",
  },
  previewStat: { flex: 1, alignItems: "center" },
  previewStatMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#F9E0EE" },
  previewStatNum: { fontSize: 22, fontWeight: "800", color: "#1F2937", marginBottom: 4 },
  previewStatLbl: { fontSize: 10, color: "#9CA3AF", fontWeight: "500" },
  previewSummaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F9E0EE",
    gap: 8,
  },
  previewSummaryTitle: { fontSize: 13, fontWeight: "700", color: "#1F2937" },
  previewSummaryText: { fontSize: 13, color: "#6B7280", lineHeight: 20 },
  previewPositive: { fontSize: 12, color: "#10B981", fontWeight: "600" },
  previewTipsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F9E0EE",
    gap: 10,
  },
  previewTipRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  previewTipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#F472B6", marginTop: 6, flexShrink: 0 },
  previewTipText: { flex: 1, fontSize: 12, color: "#6B7280", lineHeight: 18 },
  previewNoAI: { backgroundColor: "#FFF9F0", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#FDE68A" },
  previewNoAIText: { fontSize: 12, color: "#92400E", textAlign: "center" },

  // Paywall card on preview screen
  paywallCard: {
    backgroundColor: "rgba(246,240,255,0.85)",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(183,124,255,0.3)",
  },
  paywallEmoji: { fontSize: 32, marginBottom: 8 },
  paywallTitle: { fontSize: 16, fontWeight: "800", color: "#1A1530", marginBottom: 6, textAlign: "center" },
  paywallSub: { fontSize: 13, color: "#5D566F", textAlign: "center", lineHeight: 19, marginBottom: 16 },
  paywallCTAShadow: {
    width: "100%",
    shadowColor: "#b77cff",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  paywallCTA: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  paywallCTAText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },
  paywallHint: { fontSize: 11, color: "#8B839C", marginTop: 10 },

  // Quota pill shown when preview opens
  quotaPill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(183,124,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(183,124,255,0.25)",
    marginBottom: 10,
  },
  quotaPillText: { fontSize: 11, fontWeight: "700", color: "#7c4dff", letterSpacing: 0.3 },
  previewFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#F9E0EE",
    backgroundColor: "#fff",
  },
  previewSaveBtn: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F43F8F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  previewSaveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
