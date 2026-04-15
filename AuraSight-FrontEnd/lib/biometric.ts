// Face ID / Touch ID 封装
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FACEID_KEY = "@aurasight_faceid_on";

export async function isFaceIdOn(): Promise<boolean> {
  return (await AsyncStorage.getItem(FACEID_KEY)) === "true";
}

export async function setFaceIdOn(on: boolean) {
  await AsyncStorage.setItem(FACEID_KEY, on ? "true" : "false");
}

export type BiometricCapability =
  | "ready"
  | "no_hardware"
  | "not_enrolled";

// 检查设备是否支持 + 是否已经注册过指纹/面容
export async function checkBiometric(): Promise<BiometricCapability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return "no_hardware";
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) return "not_enrolled";
  return "ready";
}

export async function authenticate(promptMessage: string): Promise<boolean> {
  const cap = await checkBiometric();
  if (cap !== "ready") return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    // 允许在生物识别失败时用设备密码兜底
    disableDeviceFallback: false,
    cancelLabel: "Cancel",
  });
  return result.success;
}
