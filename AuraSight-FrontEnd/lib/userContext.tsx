/**
 * AuraSight — 用户会话管理
 * 支持游客模式（本地）和注册用户（云端同步）
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import "react-native";

const USER_KEY = "@aurasight_user";
// 注意：项目历史上还有一个独立的 mode key（settings/profile/vip 页直接写它），
// 这里把它当作"权威"的 mode 源头，每次都和 USER_KEY 里的 mode 做对账。
const MODE_KEY = "@aurasight_user_mode";

export type UserMode = "guest" | "registered" | "vip";

export interface AppUser {
  id: string;
  mode: UserMode;
  name?: string;
  email?: string;
}

// 生成游客 ID（固定，不会每次变）
function generateGuestId(): string {
  return "guest_" + Math.random().toString(36).slice(2, 10);
}

// ─── Context ──────────────────────────────────────────────

interface UserContextType {
  user: AppUser | null;
  isLoading: boolean;
  setUser: (user: AppUser) => Promise<void>;
  clearUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const UserContext = createContext<UserContextType>({
  user: null,
  isLoading: true,
  setUser: async () => {},
  clearUser: async () => {},
  refreshUser: async () => {},
});

export function useUser() {
  return useContext(UserContext);
}

// ─── Provider ─────────────────────────────────────────────

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AppUser | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    _loadUser();
  }, []);

  async function _loadUser() {
    try {
      const [raw, modeRaw] = await Promise.all([
        AsyncStorage.getItem(USER_KEY),
        AsyncStorage.getItem(MODE_KEY),
      ]);
      let loaded: AppUser;
      if (raw) {
        loaded = JSON.parse(raw);
      } else {
        // 自动创建游客账户
        loaded = {
          id: generateGuestId(),
          mode: "guest",
          name: "Guest",
        };
      }
      // 用独立 MODE_KEY 对账（settings / profile / vip 页直接写这个 key）
      if (modeRaw && (modeRaw === "guest" || modeRaw === "registered" || modeRaw === "vip")) {
        loaded.mode = modeRaw as UserMode;
      }
      // 写回 USER_KEY，保证两边一致
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(loaded));
      await AsyncStorage.setItem(MODE_KEY, loaded.mode);
      setUserState(loaded);
    } catch (err) {
      console.error("Failed to load user:", err);
    } finally {
      setLoading(false);
    }
  }

  async function setUser(newUser: AppUser) {
    // 双写——保证 settings / profile / vip 直接读 MODE_KEY 也拿到正确值
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
    await AsyncStorage.setItem(MODE_KEY, newUser.mode);
    setUserState(newUser);
  }

  async function clearUser() {
    await AsyncStorage.multiRemove([USER_KEY, MODE_KEY]);
    setUserState(null);
  }

  // 外部页面直接改了 MODE_KEY 后，调用这个把 context 拉回来
  async function refreshUser() {
    await _loadUser();
  }

  return (
    <UserContext.Provider value={{ user, isLoading, setUser, clearUser, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}
