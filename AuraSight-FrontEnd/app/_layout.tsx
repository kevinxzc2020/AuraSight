import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { UserProvider } from "../lib/userContext";
import { I18nProvider } from "../lib/i18n";
import { SensitiveProvider } from "../lib/sensitiveGate";
import { ThemeProvider } from "../lib/themeContext";
import { initAds, initAppOpenAd, initRewardedAd } from "../lib/ads";
import { useUser } from "../lib/userContext";
import { registerForPushNotifications, setupNotificationHandler } from "../lib/notifications";

// Root layout
// 四层 provider：
//   UserProvider      —— 全局用户/VIP 状态
//   I18nProvider      —— 语言切换
//   ThemeProvider     —— 亮/暗/跟随系统 主题
//   SensitiveProvider —— 本次 app session 的 Face ID 解锁状态（内存，kill 后丢失）

function PushNotificationManager() {
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    // 只在有用户时注册推送令牌
    if (user?.id) {
      registerForPushNotifications(user.id).catch((err) => {
        console.error("Failed to register push notifications:", err);
      });
    }
  }, [user?.id]);

  useEffect(() => {
    // 设置通知点击处理器（深链接导航）
    const subscription = setupNotificationHandler(router);
    return () => subscription?.remove?.();
  }, [router]);

  return null;
}

function AdInitializer() {
  const { user } = useUser();
  const isVIP = user?.mode === "vip";
  useEffect(() => {
    initAds();
    initRewardedAd();
    initAppOpenAd(isVIP);
  }, [isVIP]);
  return null;
}

export default function RootLayout() {
  return (
    <UserProvider>
      <PushNotificationManager />
      <AdInitializer />
      <I18nProvider>
        <ThemeProvider>
          <SensitiveProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </SensitiveProvider>
        </ThemeProvider>
      </I18nProvider>
    </UserProvider>
  );
}
