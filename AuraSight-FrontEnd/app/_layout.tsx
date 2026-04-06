import { Stack, router, useRootNavigationState } from "expo-router";
import { useEffect } from "react";

export default function RootLayout() {
  // useRootNavigationState 返回导航器的当前状态
  // key 存在时说明导航器已经完全挂载，可以安全地调用 router.replace
  const navState = useRootNavigationState();

  useEffect(() => {
    if (!navState?.key) return; // 导航器还没准备好，等下一次触发

    // 开发阶段：强制每次显示 Onboarding
    router.replace("/onboarding");

    // ── 正式逻辑（上线前替换上面那行） ──────────────
    // async function check() {
    //   const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default
    //   const done = await AsyncStorage.getItem('@aurasight_onboarding_done')
    //   if (done !== 'true') router.replace('/onboarding')
    // }
    // check()
  }, [navState?.key]); // 依赖 key，key 出现时触发一次跳转

  return <Stack screenOptions={{ headerShown: false }} />;
}
