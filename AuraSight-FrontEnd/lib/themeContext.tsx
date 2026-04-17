/**
 * AuraSight — 主题管理
 * mode: "light" | "dark" | "system"
 * system 模式下跟随 RN 的 useColorScheme()
 */
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Colors,
  DarkColors,
  Gradients,
  DarkGradients,
  Shadow,
  DarkShadow,
} from "../constants/theme";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const THEME_KEY = "@aurasight_theme_mode";

interface ThemeContextType {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (m: ThemeMode) => Promise<void>;
  colors: typeof Colors;
  gradients: typeof Gradients;
  shadow: typeof Shadow;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: "system",
  resolved: "light",
  setMode: async () => {},
  colors: Colors,
  gradients: Gradients,
  shadow: Shadow,
  isDark: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme(); // "light" | "dark" | null
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((raw) => {
      if (raw === "light" || raw === "dark" || raw === "system") {
        setModeState(raw);
      }
      setLoaded(true);
    });
  }, []);

  async function setMode(m: ThemeMode) {
    setModeState(m);
    await AsyncStorage.setItem(THEME_KEY, m);
  }

  const resolved: ResolvedTheme =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  const isDark = resolved === "dark";

  const value: ThemeContextType = {
    mode,
    resolved,
    setMode,
    colors: isDark ? DarkColors : Colors,
    gradients: isDark ? DarkGradients : Gradients,
    shadow: isDark ? DarkShadow : Shadow,
    isDark,
  };

  // 在 AsyncStorage 读完之前不渲染（避免闪白→黑）
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
