import { Stack } from "expo-router";
import { UserProvider } from "../lib/userContext";
import { I18nProvider } from "../lib/i18n";
import { SensitiveProvider } from "../lib/sensitiveGate";
import { ThemeProvider } from "../lib/themeContext";

// Root layout
// 四层 provider：
//   UserProvider      —— 全局用户/VIP 状态
//   I18nProvider      —— 语言切换
//   ThemeProvider     —— 亮/暗/跟随系统 主题
//   SensitiveProvider —— 本次 app session 的 Face ID 解锁状态（内存，kill 后丢失）
export default function RootLayout() {
  return (
    <UserProvider>
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
