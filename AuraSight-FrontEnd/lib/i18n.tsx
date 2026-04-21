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
  "common.delete": { en: "Delete", zh: "删除" },
  "common.save": { en: "Save", zh: "保存" },
  "common.done": { en: "Done", zh: "完成" },
  "common.gotIt": { en: "Got it", zh: "知道了" },
  "common.continue": { en: "Continue", zh: "继续" },
  "common.upgrade": { en: "Upgrade", zh: "升级" },
  "common.open": { en: "Open", zh: "打开" },
  "common.iAgree": { en: "I agree", zh: "我同意" },
  "common.revoke": { en: "Revoke", zh: "撤销" },

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
  "settings.section.about": { en: "ABOUT", zh: "关于" },
  "settings.version": { en: "Version", zh: "版本" },
  "settings.sendFeedback": { en: "Send Feedback", zh: "发送反馈" },
  "settings.sendFeedback.sub": { en: "hello@aurasight.app", zh: "hello@aurasight.app" },
  "settings.skinGoals.note": { en: "Tell AI what you care about most — it tailors your weekly reports.", zh: "告诉 AI 你最关注什么，它会据此定制你的每周报告。" },
  "settings.consent.agreed": { en: "Agreed", zh: "已同意" },
  "settings.consent.needed": { en: "Needed for AI analysis & cloud save", zh: "AI 分析和云存储需要此权限" },
  "settings.appearance.light": { en: "Light", zh: "浅色" },
  "settings.appearance.dark": { en: "Dark", zh: "深色" },
  "settings.appearance.system": { en: "System", zh: "跟随系统" },
  "settings.devTools.switchVip": { en: "Switch to VIP (Test)", zh: "切换 VIP（测试）" },
  "settings.devTools.current": { en: "Current", zh: "当前" },
  "settings.rate.alertTitle": { en: "Rate AuraSight", zh: "给 AuraSight 评分" },
  "settings.rate.alertMsg": { en: "Opening App Store...", zh: "正在打开应用商店..." },
  "settings.consent.allowTitle": { en: "Allow data use", zh: "允许数据使用" },
  "settings.consent.allowMsg": { en: "By turning this on, you allow AuraSight to save your skin photos and use anonymized versions to improve our detection model.", zh: "开启后，你允许 AuraSight 保存皮肤照片，并使用匿名版本改进我们的检测模型。" },
  "settings.consent.revokeTitle": { en: "Revoke data consent?", zh: "撤销数据授权？" },
  "settings.consent.revokeMsg": { en: "We'll stop using new photos for training and cloud save. You can re-enable this any time.", zh: "我们将停止使用新照片进行训练和云存储。你可以随时重新开启。" },
  // Skin goals
  "goal.acne":    { en: "Control breakouts", zh: "控制痘痘" },
  "goal.tone":    { en: "Even skin tone",    zh: "均匀肤色" },
  "goal.texture": { en: "Improve texture",   zh: "改善肤质" },
  "goal.body":    { en: "Track body shape",  zh: "记录体型" },
  "goal.aging":   { en: "Anti-aging",        zh: "抗衰老" },

  // Community
  "community.title":        { en: "Community 💬",                    zh: "社区 💬" },
  "community.sub":          { en: "Skin tips, questions & stories",  zh: "护肤技巧、问题与故事" },
  "community.filter.all":   { en: "All",                             zh: "全部" },
  "community.empty":        { en: "No posts yet — be the first!",    zh: "还没有帖子——来发第一条吧！" },
  "community.newPost":      { en: "New Post",                        zh: "发新帖" },
  "community.postingAs":    { en: "Posting as",                      zh: "身份" },
  "community.topic":        { en: "Topic",                           zh: "话题" },
  "community.addPhoto":     { en: "Add photo",                       zh: "添加图片" },
  "community.changePhoto":  { en: "Change photo",                    zh: "更换图片" },
  "community.post":         { en: "Post",                            zh: "发布" },
  "community.beFirst":      { en: "Be the first to reply 💬",        zh: "来发第一条回复吧 💬" },
  "community.reply":        { en: "Reply...",                        zh: "写回复..." },
  "community.pinned":       { en: "Pinned",                          zh: "置顶" },
  "community.deleteTitle":  { en: "Delete post?",                    zh: "删除帖子？" },
  "community.deleteMsg":    { en: "This cannot be undone.",           zh: "此操作无法撤销。" },
  "community.errorPost":    { en: "Could not post. Check your connection.", zh: "发帖失败，请检查网络。" },
  "community.errorSend":    { en: "Could not send. Check your connection.", zh: "发送失败，请检查网络。" },
  "community.errorLoad":    { en: "Could not load post.",             zh: "帖子加载失败。" },
  "community.notFound":     { en: "Post not found.",                  zh: "帖子不存在。" },

  // Post detail
  "post.navTitle":    { en: "Post",                                          zh: "帖子" },
  "post.comments":    { en: "Comments",                                      zh: "评论" },
  "post.noComments":  { en: "No comments yet — be the first to reply! 💬",  zh: "还没有评论——来发第一条吧！💬" },
  "post.replyAs":     { en: "Reply as",                                      zh: "以身份回复" },
  "post.likes":       { en: "likes",                                         zh: "个赞" },
  "post.like":        { en: "like",                                          zh: "个赞" },

  // Post tags
  "tag.help":    { en: "Help",     zh: "求助" },
  "tag.share":   { en: "Share",    zh: "分享" },
  "tag.routine": { en: "Routine",  zh: "护肤" },
  "tag.checkin": { en: "Check-in", zh: "打卡" },

  // Compose placeholders per tag
  "community.placeholder.help":    { en: "Describe your skin issue in detail...",    zh: "详细描述你的皮肤问题..." },
  "community.placeholder.share":   { en: "Share your skin story or experience...",   zh: "分享你的皮肤故事或经历..." },
  "community.placeholder.routine": { en: "Share your skincare routine or tips...",   zh: "分享你的护肤流程或技巧..." },
  "community.placeholder.checkin": { en: "Share your progress or today's scan!",     zh: "分享你的进展或今天的扫描结果！" },

  // Time ago
  "time.justNow": { en: "just now",  zh: "刚刚" },
  "time.mAgo":    { en: "m ago",     zh: "分钟前" },
  "time.hAgo":    { en: "h ago",     zh: "小时前" },
  "time.dAgo":    { en: "d ago",     zh: "天前" },

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
