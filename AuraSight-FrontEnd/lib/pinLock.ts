// 4 位 PIN 锁屏
import AsyncStorage from "@react-native-async-storage/async-storage";

const PIN_KEY = "@aurasight_pin";

/** 是否设置了 PIN */
export async function isPinSet(): Promise<boolean> {
  const pin = await AsyncStorage.getItem(PIN_KEY);
  return !!pin;
}

/** 保存 PIN（明文存储，足够 app 级隐私保护） */
export async function savePin(pin: string): Promise<void> {
  await AsyncStorage.setItem(PIN_KEY, pin);
}

/** 清除 PIN（关闭锁屏） */
export async function clearPin(): Promise<void> {
  await AsyncStorage.removeItem(PIN_KEY);
}

/** 验证 PIN 是否正确 */
export async function verifyPin(input: string): Promise<boolean> {
  const saved = await AsyncStorage.getItem(PIN_KEY);
  return saved === input;
}
