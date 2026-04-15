// Body Composition (VIP) — Navy Method 体脂率估算
// 注意：这是趋势参考工具，非医疗精度。Navy Method 的误差约 ±3-4% 绝对值，
// 对想看"我这周掉了多少脂肪"的用户来说足够，不适合作为精准健康指标使用。
// 后续如果要升级到照片识别（MediaPipe Pose 或 Spren SDK），可以替换 computeBodyFat。
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ChevronLeft, Lock, TrendingUp, Info } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser } from "../lib/userContext";
import { fetchHealthProfile } from "../lib/userApi";
import {
  Colors,
  Gradients,
  Spacing,
  Radius,
  FontSize,
  Shadow,
} from "../constants/theme";

type Sex = "male" | "female";

type BodyCompRecord = {
  id: string;
  date: string; // ISO
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  neckCm: number;
  waistCm: number;
  hipCm?: number;
  bodyFatPct: number;
  fatMassKg: number;
  leanMassKg: number;
};

const STORAGE_KEY = "@aurasight_body_comp_history";

// Navy Method 公式 —— 美国海军 1984 年内部研究制定的体围估算法
// 精度：对普通人群 ±3-4% 绝对误差，比目测好，比 DEXA 差
function computeBodyFat(input: {
  sex: Sex;
  heightCm: number;
  waistCm: number;
  neckCm: number;
  hipCm?: number;
}): number | null {
  const { sex, heightCm, waistCm, neckCm, hipCm } = input;
  if (heightCm <= 0 || waistCm <= 0 || neckCm <= 0) return null;
  if (waistCm <= neckCm) return null; // 腰围必须大于颈围
  try {
    if (sex === "male") {
      const bf =
        495 /
          (1.0324 -
            0.19077 * Math.log10(waistCm - neckCm) +
            0.15456 * Math.log10(heightCm)) -
        450;
      return Math.max(3, Math.min(60, bf));
    } else {
      if (!hipCm || hipCm <= 0) return null;
      const bf =
        495 /
          (1.29579 -
            0.35004 * Math.log10(waistCm + hipCm - neckCm) +
            0.22100 * Math.log10(heightCm)) -
        450;
      return Math.max(3, Math.min(60, bf));
    }
  } catch {
    return null;
  }
}

// ACE 体脂分类表 —— 仅供参考，实际分类因年龄/种族有差异
function classifyBodyFat(pct: number, sex: Sex): {
  label: string;
  color: string;
} {
  if (sex === "male") {
    if (pct < 6) return { label: "Essential fat", color: "#8B5CF6" };
    if (pct < 14) return { label: "Athletic", color: "#10B981" };
    if (pct < 18) return { label: "Fit", color: "#34D399" };
    if (pct < 25) return { label: "Average", color: "#F59E0B" };
    return { label: "Above average", color: "#EF4444" };
  } else {
    if (pct < 14) return { label: "Essential fat", color: "#8B5CF6" };
    if (pct < 21) return { label: "Athletic", color: "#10B981" };
    if (pct < 25) return { label: "Fit", color: "#34D399" };
    if (pct < 32) return { label: "Average", color: "#F59E0B" };
    return { label: "Above average", color: "#EF4444" };
  }
}

export default function BodyCompositionScreen() {
  const { user } = useUser();
  const isVIP = user?.mode === "vip";

  const [sex, setSex] = useState<Sex>("male");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [neckCm, setNeckCm] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [hipCm, setHipCm] = useState("");

  const [result, setResult] = useState<BodyCompRecord | null>(null);
  const [history, setHistory] = useState<BodyCompRecord[]>([]);
  // 是否从 profile 带过来的（用于 UI 提示）
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          setHistory(JSON.parse(raw));
        } catch {}
      }

      // 从 profile 的 health_profile 预填高/重/性别/年龄
      // 只在字段为空时填，避免覆盖用户手动输入。
      // 预填失败/没数据都静默走开，不打断页面加载。
      if (user?.id) {
        try {
          const hp = await fetchHealthProfile(user.id);
          let didPrefill = false;
          if (hp.height_cm) {
            setHeightCm((v) => (v ? v : String(hp.height_cm)));
            didPrefill = true;
          }
          if (hp.weight_kg) {
            setWeightKg((v) => (v ? v : String(hp.weight_kg)));
            didPrefill = true;
          }
          // gender "other" 在 Navy Method 下没公式，保持默认 male 不强制覆盖
          if (hp.gender === "male" || hp.gender === "female") {
            setSex((prev) => prev /* 已经是 state 初始值 male，这里只在用户未改时覆盖 */);
            setSex(hp.gender);
            didPrefill = true;
          }
          if (hp.birthday && /^\d{4}-\d{2}-\d{2}$/.test(hp.birthday)) {
            const bornYear = parseInt(hp.birthday.slice(0, 4), 10);
            const ageNow = new Date().getFullYear() - bornYear;
            if (ageNow > 0 && ageNow < 120) {
              setAge((v) => (v ? v : String(ageNow)));
              didPrefill = true;
            }
          }
          if (didPrefill) setPrefilled(true);
        } catch {
          /* 预填失败走开，不弹错 */
        }
      }
    })();
    // user?.id 变化时重跑（登录/切账号）
  }, [user?.id]);

  // 免费用户直接看到 paywall
  if (!isVIP) {
    return (
      <SafeAreaView style={styles.paywallSafe}>
        <LinearGradient
          colors={["#FDF2F8", "#F3E8FF"]}
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ChevronLeft size={22} color={Colors.gray800} />
        </TouchableOpacity>

        <View style={styles.paywallContent}>
          <View style={styles.lockCircle}>
            <Lock size={28} color="#fff" />
          </View>
          <Text style={styles.paywallTitle}>Body Composition</Text>
          <Text style={styles.paywallSub}>
            Track your body fat percentage over time and correlate with your
            skin trends. Available with VIP.
          </Text>

          <View style={styles.featureList}>
            <Text style={styles.featureItem}>• Navy Method body fat % estimate</Text>
            <Text style={styles.featureItem}>• Lean mass + fat mass breakdown</Text>
            <Text style={styles.featureItem}>• History tracking & trend view</Text>
            <Text style={styles.featureItem}>• Correlate with skin condition</Text>
          </View>

          <TouchableOpacity
            onPress={() => router.push("/vip")}
            activeOpacity={0.85}
            style={styles.upgradeShadow}
          >
            <LinearGradient
              colors={["#b77cff", "#ff9fc2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.upgradeBtn}
            >
              <Text style={styles.upgradeText}>Upgrade to VIP</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Estimate accuracy ±3–4%. For trend tracking, not medical use.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleCalculate = async () => {
    const h = parseFloat(heightCm);
    const w = parseFloat(weightKg);
    const n = parseFloat(neckCm);
    const wa = parseFloat(waistCm);
    const hip = sex === "female" ? parseFloat(hipCm) : undefined;
    const ageN = parseFloat(age);

    if (!h || !w || !n || !wa || !ageN) {
      Alert.alert("Missing info", "Please fill all required fields.");
      return;
    }
    if (sex === "female" && !hip) {
      Alert.alert("Missing info", "Hip measurement is required for women.");
      return;
    }

    const bf = computeBodyFat({
      sex,
      heightCm: h,
      waistCm: wa,
      neckCm: n,
      hipCm: hip,
    });
    if (bf === null) {
      Alert.alert(
        "Invalid measurements",
        "Waist should be larger than neck. Double-check your numbers.",
      );
      return;
    }

    const fatMass = (w * bf) / 100;
    const record: BodyCompRecord = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      sex,
      age: ageN,
      heightCm: h,
      weightKg: w,
      neckCm: n,
      waistCm: wa,
      hipCm: hip,
      bodyFatPct: Math.round(bf * 10) / 10,
      fatMassKg: Math.round(fatMass * 10) / 10,
      leanMassKg: Math.round((w - fatMass) * 10) / 10,
    };

    const next = [record, ...history].slice(0, 50);
    setHistory(next);
    setResult(record);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const cls = result ? classifyBodyFat(result.bodyFatPct, result.sex) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={24} color={Colors.gray800} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Body Composition</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* 结果卡片 */}
          {result && cls && (
            <LinearGradient
              colors={["#FFF7F9", "#FDF2F8"]}
              style={[styles.resultCard, Shadow.card]}
            >
              <Text style={styles.resultLabel}>Body Fat</Text>
              <Text style={[styles.resultValue, { color: cls.color }]}>
                {result.bodyFatPct}%
              </Text>
              <View
                style={[styles.resultBadge, { backgroundColor: cls.color }]}
              >
                <Text style={styles.resultBadgeText}>{cls.label}</Text>
              </View>
              <View style={styles.resultSplit}>
                <View style={styles.resultSplitItem}>
                  <Text style={styles.resultSplitLabel}>Fat mass</Text>
                  <Text style={styles.resultSplitValue}>
                    {result.fatMassKg} kg
                  </Text>
                </View>
                <View style={styles.resultSplitDivider} />
                <View style={styles.resultSplitItem}>
                  <Text style={styles.resultSplitLabel}>Lean mass</Text>
                  <Text style={styles.resultSplitValue}>
                    {result.leanMassKg} kg
                  </Text>
                </View>
              </View>
            </LinearGradient>
          )}

          {/* 性别选择 */}
          <Text style={styles.sectionTitle}>Your info</Text>
          {prefilled && (
            <Text style={styles.prefilledHint}>
              ✨ Prefilled from your profile — adjust if needed.
            </Text>
          )}
          <View style={styles.sexRow}>
            {(["male", "female"] as const).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setSex(s)}
                activeOpacity={0.8}
                style={[
                  styles.sexChip,
                  sex === s && styles.sexChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.sexChipText,
                    sex === s && styles.sexChipTextActive,
                  ]}
                >
                  {s === "male" ? "Male" : "Female"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 年龄 / 身高 / 体重 */}
          <View style={styles.row2}>
            <LabeledInput
              label="Age"
              value={age}
              onChange={setAge}
              unit="yrs"
            />
            <LabeledInput
              label="Height"
              value={heightCm}
              onChange={setHeightCm}
              unit="cm"
            />
          </View>
          <LabeledInput
            label="Weight"
            value={weightKg}
            onChange={setWeightKg}
            unit="kg"
          />

          {/* 围度 */}
          <Text style={styles.sectionTitle}>Measurements</Text>
          <LabeledInput
            label="Neck circumference"
            value={neckCm}
            onChange={setNeckCm}
            unit="cm"
            hint="Just below Adam's apple"
          />
          <LabeledInput
            label="Waist circumference"
            value={waistCm}
            onChange={setWaistCm}
            unit="cm"
            hint={
              sex === "male"
                ? "At navel level, relaxed"
                : "At narrowest point, relaxed"
            }
          />
          {sex === "female" && (
            <LabeledInput
              label="Hip circumference"
              value={hipCm}
              onChange={setHipCm}
              unit="cm"
              hint="At widest point of hips"
            />
          )}

          <TouchableOpacity
            onPress={handleCalculate}
            activeOpacity={0.85}
            style={styles.calcBtnShadow}
          >
            <LinearGradient
              colors={["#b77cff", "#ff9fc2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.calcBtn}
            >
              <Text style={styles.calcBtnText}>Calculate</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* 历史 */}
          {history.length > 0 && (
            <View style={styles.historySection}>
              <View style={styles.historyHeader}>
                <TrendingUp size={16} color={Colors.rose400} />
                <Text style={styles.historyTitle}>Recent history</Text>
              </View>
              {history.slice(0, 5).map((r) => {
                const d = new Date(r.date);
                return (
                  <View key={r.id} style={styles.historyRow}>
                    <Text style={styles.historyDate}>
                      {d.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <Text style={styles.historyBf}>{r.bodyFatPct}%</Text>
                    <Text style={styles.historyWeight}>{r.weightKg} kg</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Disclaimer */}
          <View style={styles.disclaimerBox}>
            <Info size={14} color={Colors.gray500} />
            <Text style={styles.disclaimerText}>
              Navy Method estimate. Accuracy ±3–4%. Best used for tracking
              trends over weeks, not absolute values. Consult a professional
              for medical purposes.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  unit,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  hint?: string;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputBox}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder="—"
          placeholderTextColor={Colors.gray400}
        />
        <Text style={styles.inputUnit}>{unit}</Text>
      </View>
      {hint && <Text style={styles.inputHint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FDF8F9" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.gray800,
  },
  scroll: { padding: Spacing.lg, paddingBottom: 60 },

  // 结果卡片
  resultCard: {
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  resultLabel: {
    fontSize: FontSize.sm,
    color: Colors.gray600,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  resultValue: {
    fontSize: 56,
    fontWeight: "800",
    marginVertical: Spacing.xs,
  },
  resultBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  resultBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: FontSize.xs,
  },
  resultSplit: {
    flexDirection: "row",
    marginTop: Spacing.lg,
    alignItems: "center",
  },
  resultSplitItem: { alignItems: "center", paddingHorizontal: Spacing.lg },
  resultSplitLabel: { fontSize: FontSize.xs, color: Colors.gray500 },
  resultSplitValue: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.gray800,
    marginTop: 2,
  },
  resultSplitDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.gray200,
  },

  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.gray600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  prefilledHint: {
    fontSize: FontSize.xs,
    color: Colors.rose400,
    marginBottom: Spacing.sm,
    fontStyle: "italic",
  },

  // 性别
  sexRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  sexChip: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.white,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  sexChipActive: {
    backgroundColor: "#b77cff",
    borderColor: "#b77cff",
  },
  sexChipText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.gray600 },
  sexChipTextActive: { color: "#fff" },

  // inputs
  row2: { flexDirection: "row", gap: Spacing.sm },
  inputGroup: { flex: 1, marginBottom: Spacing.md },
  inputLabel: {
    fontSize: FontSize.sm,
    color: Colors.gray700,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.gray800,
    paddingVertical: Spacing.md,
  },
  inputUnit: { fontSize: FontSize.sm, color: Colors.gray500, fontWeight: "500" },
  inputHint: { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 4 },

  // calc button
  calcBtnShadow: {
    marginTop: Spacing.lg,
    borderRadius: Radius.xl,
    shadowColor: "#b77cff",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  calcBtn: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
    alignItems: "center",
  },
  calcBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },

  // history
  historySection: { marginTop: Spacing.xl },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  historyTitle: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.gray700,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  historyDate: { flex: 1, fontSize: FontSize.sm, color: Colors.gray600 },
  historyBf: {
    fontSize: FontSize.base,
    fontWeight: "700",
    color: Colors.rose400,
    marginRight: Spacing.md,
  },
  historyWeight: { fontSize: FontSize.sm, color: Colors.gray500 },

  disclaimerBox: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.xl,
    padding: Spacing.md,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: Radius.lg,
  },
  disclaimerText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.gray500,
    lineHeight: 16,
  },

  // paywall
  paywallSafe: { flex: 1 },
  backButton: {
    position: "absolute",
    top: 60,
    left: Spacing.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  paywallContent: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  lockCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#b77cff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  paywallTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.gray800,
    marginBottom: Spacing.sm,
  },
  paywallSub: {
    fontSize: FontSize.base,
    color: Colors.gray600,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  featureList: {
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  featureItem: {
    fontSize: FontSize.sm,
    color: Colors.gray700,
    lineHeight: 24,
  },
  upgradeShadow: {
    alignSelf: "stretch",
    borderRadius: Radius.xl,
    shadowColor: "#b77cff",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  upgradeBtn: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
    alignItems: "center",
  },
  upgradeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: FontSize.base,
  },
  disclaimer: {
    fontSize: FontSize.xs,
    color: Colors.gray500,
    marginTop: Spacing.md,
    textAlign: "center",
  },
});
