// 敏感数据门禁
// 设计要点：
// - unlock 状态放内存（useState），app kill 就丢失，下次冷启动必须重验
// - 背景/前台切换不重锁（不依赖 AsyncStorage，不看 AppState）
// - 只要用户在这次 app session 里通过过一次，访问所有敏感页面都不再弹
// - 如果用户没开 Face ID 开关，直接放行
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Lock } from "lucide-react-native";
import { isFaceIdOn, authenticate, checkBiometric } from "./biometric";
import { useT } from "./i18n";

interface SensitiveCtx {
  unlocked: boolean;
  unlock: () => Promise<boolean>;
  // null = 还没查出来；true = 需要门禁；false = 不需要（开关关 / 设备不支持）
  gateRequired: boolean | null;
}

const Ctx = createContext<SensitiveCtx>({
  unlocked: false,
  unlock: async () => false,
  gateRequired: false,
});

export function useSensitive() {
  return useContext(Ctx);
}

export function SensitiveProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [gateRequired, setGateRequired] = useState<boolean | null>(null);
  const authingRef = useRef(false);

  // 把 "Face ID 开关是否开" + "设备是否支持" 这两个异步查询提到 Provider，
  // 只查一次、缓存结果。否则每个 SensitiveGate 实例都要重跑一遍，
  // 页面在 loading/loaded 间切换时会不断看到占位空白。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const on = await isFaceIdOn();
        if (cancelled) return;
        if (!on) {
          setGateRequired(false);
          return;
        }
        const cap = await checkBiometric();
        if (cancelled) return;
        setGateRequired(cap === "ready");
      } catch {
        if (!cancelled) setGateRequired(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 用 useCallback 让 unlock 引用稳定——不然每次 Provider 重渲染都产生新函数，
  // SensitiveGate 的 useEffect deps 会因此被触发，造成"一直 loading"的假象。
  const unlock = useCallback(async (): Promise<boolean> => {
    if (authingRef.current) return false;
    authingRef.current = true;
    try {
      const ok = await authenticate("Access private data");
      if (ok) setUnlocked(true);
      return ok;
    } finally {
      authingRef.current = false;
    }
  }, []);

  const value = useMemo(
    () => ({ unlocked, unlock, gateRequired }),
    [unlocked, unlock, gateRequired],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// 包裹敏感页面。自动决定是否需要验证：
// - Face ID 开关关 → 直接渲染
// - 开关开 + 本 session 已解锁 → 直接渲染
// - 开关开 + 未解锁 → 显示锁屏 + 触发验证
// 模块级 ref：整个 app session 只自动弹一次 Face ID。
// 放在模块级是刻意的——各页面 SensitiveGate 实例不同，但同一 session 共用。
const autoTriedRef = { current: false };

export function SensitiveGate({ children }: { children: ReactNode }) {
  const { t } = useT();
  const { unlocked, unlock, gateRequired } = useSensitive();

  // 第一次进入敏感页自动弹验证（只针对真正需要门禁的情况）
  useEffect(() => {
    if (!gateRequired) return;
    if (unlocked) return;
    if (autoTriedRef.current) return;
    autoTriedRef.current = true;
    unlock();
  }, [gateRequired, unlocked, unlock]);

  // Provider 还在查设备能力——直接放行（乐观渲染）。
  // 不能 return 占位 View：如果 isFaceIdOn/checkBiometric 因任何原因不 resolve，
  // gateRequired 会永远停在 null，整个敏感页面就会卡住。宁可短暂闪一下内容，
  // 也不要"一直 loading"。
  const needsGate = gateRequired === true && !unlocked;

  if (needsGate) {
    return (
      <View style={styles.gate}>
        <LinearGradient
          colors={["#FDF2F8", "#FCE7F3", "#F3E8FF"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.lockCircle}>
          <Lock size={26} color="#fff" />
        </View>
        <Text style={styles.title}>{t("faceId.prompt")}</Text>
        <Text style={styles.sub}>Face ID required to view this data</Text>
        <TouchableOpacity
          onPress={() => {
            unlock();
          }}
          style={styles.btn}
        >
          <Text style={styles.btnText}>{t("faceId.retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDF2F8",
  },
  lockCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#b77cff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1530",
    marginBottom: 4,
  },
  sub: {
    fontSize: 13,
    color: "#5D566F",
    marginBottom: 20,
  },
  btn: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#b77cff",
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
