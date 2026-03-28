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
}

export const UserContext = createContext<UserContextType>({
  user: null,
  isLoading: true,
  setUser: async () => {},
  clearUser: async () => {},
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
      const raw = await AsyncStorage.getItem(USER_KEY);
      if (raw) {
        setUserState(JSON.parse(raw));
      } else {
        // 自动创建游客账户
        const guest: AppUser = {
          id: generateGuestId(),
          mode: "guest",
          name: "Guest",
        };
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(guest));
        setUserState(guest);
      }
    } catch (err) {
      console.error("Failed to load user:", err);
    } finally {
      setLoading(false);
    }
  }

  async function setUser(newUser: AppUser) {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setUserState(newUser);
  }

  async function clearUser() {
    await AsyncStorage.removeItem(USER_KEY);
    setUserState(null);
  }

  return (
    <UserContext.Provider value={{ user, isLoading, setUser, clearUser }}>
      {children}
    </UserContext.Provider>
  );
}
