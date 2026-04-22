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

/**
 * 生物识别验证
 * @param promptMessage  弹窗提示文案
 * @param biometricOnly  true = 只走 Face ID / 指纹，不 fallback 到设备密码
 *                       false = Face ID 失败后允许密码兜底（用于 settings toggle，防止锁死）
 */
export async function authenticate(
  promptMessage: string,
  biometricOnly = false,
): Promise<boolean> {
  const cap = await checkBiometric();
  if (cap !== "ready") return false;

  if (biometricOnly) {
    // 强制走 Face ID / 指纹，不弹密码键盘
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      disableDeviceFallback: true,
      cancelLabel: "Cancel",
    });
    return result.success;
  }

  // 允许密码兜底（settings toggle 验证用）
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    disableDeviceFallback: false,
    cancelLabel: "Cancel",
  });
  return result.success;
}
