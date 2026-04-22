import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { UserProvider } from "../lib/userContext";
import { I18nProvider } from "../lib/i18n";
// SensitiveProvider removed — replaced by PIN lock in report.tsx
import { ThemeProvider } from "../lib/themeContext";
import { initAds, initAppOpenAd, initRewardedAd } from "../lib/ads";
import { useUser } from "../lib/userContext";
import { registerForPushNotifications, setupNotificationHandler } from "../lib/notifications";
import { initPurchases } from "../lib/purchases";

// Root layout
// 四层 provider：
//   UserProvider      —— 全局用户/VIP 状态
//   I18nProvider      —— 语言切换
//   ThemeProvider     —— 亮/暗/跟随系统 主题
//   PIN lock 现在直接在 report.tsx 内处理

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

function PurchaseInitializer() {
  const { user } = useUser();

  useEffect(() => {
    // 初始化 RevenueCat（带有自动 mock 模式降级）
    if (user?.id) {
      initPurchases(user.id).catch((err) => {
        console.error("Failed to initialize purchases:", err);
      });
    }
  }, [user?.id]);

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
      <PurchaseInitializer />
      <AdInitializer />
      <I18nProvider>
        <ThemeProvider>
            <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      </I18nProvider>
    </UserProvider>
  );
}
