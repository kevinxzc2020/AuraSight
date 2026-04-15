import { Stack } from "expo-router";
import { UserProvider } from "../lib/userContext";
import { I18nProvider } from "../lib/i18n";
import { SensitiveProvider } from "../lib/sensitiveGate";

// Root layout
// 三层 provider：
//   UserProvider      —— 全局用户/VIP 状态
//   I18nProvider      —— 语言切换
//   SensitiveProvider —— 本次 app session 的 Face ID 解锁状态（内存，kill 后丢失）
//
// 注意：这里已经不再在启动时强制 Face ID。Face ID 只在访问敏感页面（History、
// Scan 详情、Report）时触发一次，本次 session 内不再重复。
export default function RootLayout() {
  return (
    <UserProvider>
      <I18nProvider>
        <SensitiveProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </SensitiveProvider>
      </I18nProvider>
    </UserProvider>
  );
}
