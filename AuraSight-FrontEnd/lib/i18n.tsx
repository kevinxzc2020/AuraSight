// 简易 i18n —— 字典式，不引入额外依赖
// 使用方式：
//   const { t, lang, setLang } = useT();
//   <Text>{t("settings.title")}</Text>
// 新字符串只需要在 STRINGS 里加 key，未翻译的 key 会 fallback 回英文再 fallback 回 key 本身
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export type Lang = "en" | "zh";
const STORAGE_KEY = "@aurasight_lang";

// ─── 字典 ─────────────────────────────────────────────────
// 规则：key 用点号分层 (page.section.item)。未加 key 的文案原样显示英文，
// 所以不必一次翻译所有字符串——增量迁移即可。
const STRINGS: Record<string, Record<Lang, string>> = {
  // 通用
  "common.back": { en: "‹ Back", zh: "‹ 返回" },
  "common.cancel": { en: "Cancel", zh: "取消" },
  "common.save": { en: "Save", zh: "保存" },
  "common.done": { en: "Done", zh: "完成" },
  "common.gotIt": { en: "Got it", zh: "知道了" },
  "common.continue": { en: "Continue", zh: "继续" },
  "common.upgrade": { en: "Upgrade", zh: "升级" },

  // Tab bar
  "tabs.home": { en: "Home", zh: "首页" },
  "tabs.camera": { en: "Scan", zh: "扫描" },
  "tabs.history": { en: "History", zh: "历史" },
  "tabs.report": { en: "Report", zh: "报告" },
  "tabs.profile": { en: "Profile", zh: "我的" },

  // Settings 页
  "settings.title": { en: "Settings", zh: "设置" },
  "settings.section.account": { en: "ACCOUNT", zh: "账户" },
  "settings.section.skinGoals": { en: "SKIN GOALS", zh: "肌肤目标" },
  "settings.section.notifications": { en: "NOTIFICATIONS", zh: "通知" },
  "settings.section.privacy": { en: "PRIVACY & SECURITY", zh: "隐私与安全" },
  "settings.section.personalization": { en: "PERSONALIZATION", zh: "个性化" },
  "settings.section.help": { en: "HELP & FEEDBACK", zh: "帮助与反馈" },
  "settings.section.dev": { en: "DEV / TEST", zh: "开发 / 测试" },

  "settings.name": { en: "Name", zh: "名字" },
  "settings.email": { en: "Email", zh: "邮箱" },
  "settings.dailyReminder": { en: "Daily reminder", zh: "每日提醒" },
  "settings.dailyReminder.sub": {
    en: "Remind me to scan every day",
    zh: "每天提醒我扫描",
  },
  "settings.reminderTime": { en: "Reminder time", zh: "提醒时间" },
  "settings.faceId": { en: "Face ID / Touch ID", zh: "Face ID / 指纹" },
  "settings.faceId.sub": {
    en: "Require biometrics to open",
    zh: "打开 App 时需要生物识别",
  },
  "settings.photoDataUse": { en: "Allow photo data use", zh: "允许使用照片数据" },
  "settings.privacyPolicy": { en: "Privacy Policy", zh: "隐私政策" },
  "settings.terms": { en: "Terms of Service", zh: "服务条款" },
  "settings.language": { en: "Language", zh: "语言" },
  "settings.appearance": { en: "Appearance", zh: "外观" },
  "settings.appearance.lightLabel": { en: "Light", zh: "浅色" },
  "settings.appearance.darkSoon": { en: "Dark mode coming soon", zh: "深色模式即将推出" },
  "settings.rate": { en: "Rate AuraSight ⭐", zh: "给 AuraSight 评分 ⭐" },
  "settings.rate.sub": {
    en: "Your review helps others find us",
    zh: "你的评价能帮助更多人找到我们",
  },
  "settings.signOut": { en: "Sign Out", zh: "退出登录" },
  "settings.deleteAccount": { en: "Delete Account", zh: "删除账户" },
  "settings.vipBanner": { en: "Try VIP free for 7 days", zh: "免费试用 VIP 7 天" },
  "settings.vipActive": { en: "VIP ✦", zh: "VIP ✦" },

  // Face ID 弹窗
  "faceId.prompt": {
    en: "Unlock AuraSight",
    zh: "解锁 AuraSight",
  },
  "faceId.unavailable": {
    en: "Biometric authentication is not available on this device.",
    zh: "此设备不支持生物识别。",
  },
  "faceId.notEnrolled": {
    en: "You haven't set up Face ID / Touch ID on this device yet.",
    zh: "你还没在此设备上设置 Face ID / 指纹。",
  },
  "faceId.retry": { en: "Try again", zh: "重试" },

  // 通知
  "notif.permissionDenied": {
    en: "Please enable notifications in system settings to use daily reminders.",
    zh: "请在系统设置中开启通知权限以使用每日提醒。",
  },
  "notif.title": { en: "Skin check-in 💫", zh: "皮肤打卡 💫" },
  "notif.body": {
    en: "Take 30 seconds to scan today and keep your streak alive.",
    zh: "花 30 秒扫描一下今天的皮肤，保持连续打卡。",
  },
};

// ─── Context ──────────────────────────────────────────────
interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => Promise<void>;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nCtx>({
  lang: "en",
  setLang: async () => {},
  t: (k) => k,
});

export function useT() {
  return useContext(I18nContext);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "zh") setLangState(saved);
    })();
  }, []);

  const setLang = async (l: Lang) => {
    setLangState(l);
    await AsyncStorage.setItem(STORAGE_KEY, l);
  };

  const t = (key: string): string => {
    const entry = STRINGS[key];
    if (!entry) return key; // 未注册 key，直接返回 key 方便发现遗漏
    return entry[lang] ?? entry.en ?? key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}
