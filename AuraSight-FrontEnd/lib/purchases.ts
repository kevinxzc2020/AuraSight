/**
 * AuraSight — RevenueCat In-App Purchases
 *
 * 接入步骤：
 * 1. 去 revenuecat.com 注册账号（免费）
 * 2. 创建 App，拿到 API Key（iOS 和 Android 各一个）
 * 3. 在 App Store Connect / Google Play Console 创建订阅产品，ID 对应下面的 PRODUCT_IDS
 * 4. 安装 SDK：expo install react-native-purchases react-native-purchases-ui
 * 5. 把 REVENUECAT_API_KEY_IOS / _ANDROID 填到 app.json 的 extra 里
 * 6. 需要 Development Build（Expo Go 不支持真实购买）
 *
 * 文档：https://www.revenuecat.com/docs/getting-started/installation/expo
 */

// ─── Product IDs（要和 App Store / Play Store 里的一致）──────
export const PRODUCT_IDS = {
  monthly:  "aurasight_vip_monthly",   // $4.99/mo, 7-day trial
  annual:   "aurasight_vip_annual",    // $34.99/yr, 7-day trial
  lifetime: "aurasight_vip_lifetime",  // $9.99 one-time
} as const;

export type PlanId = keyof typeof PRODUCT_IDS;

// ─── Mock 模式（Dev Build 未接好时用） ────────────────────────
// 设为 true 时所有购买都立刻"成功"，用于 UI 测试
const MOCK_MODE = true;

// ─── 初始化 RevenueCat ────────────────────────────────────────
export async function initPurchases(userId?: string): Promise<void> {
  if (MOCK_MODE) return;
  try {
    const Purchases = (await import("react-native-purchases")).default;
    const Platform = (await import("react-native")).Platform;
    const apiKey = Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_RC_API_KEY_IOS ?? ""
      : process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID ?? "";
    if (!apiKey) {
      console.warn("RevenueCat API key not set — purchases disabled");
      return;
    }
    await Purchases.configure({ apiKey });
    if (userId) await Purchases.logIn(userId);
    console.log("✅ RevenueCat initialized");
  } catch (err) {
    console.warn("RevenueCat init failed:", err);
  }
}

// ─── 购买产品 ─────────────────────────────────────────────────
export interface PurchaseResult {
  success: boolean;
  error?: string;
}

export async function purchasePlan(planId: PlanId): Promise<PurchaseResult> {
  if (MOCK_MODE) {
    // Mock: 直接返回成功
    console.log("[MOCK] Purchase simulated for:", planId);
    return { success: true };
  }

  try {
    const Purchases = (await import("react-native-purchases")).default;
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return { success: false, error: "No offerings available" };

    // 找到对应的 package
    const pkg = current.availablePackages.find(
      (p) => p.product.identifier === PRODUCT_IDS[planId]
    );
    if (!pkg) return { success: false, error: `Product ${planId} not found` };

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isActive = customerInfo.activeSubscriptions.length > 0
      || customerInfo.nonSubscriptionTransactions.length > 0;

    return { success: isActive };
  } catch (err: any) {
    if (err.userCancelled) return { success: false, error: "cancelled" };
    return { success: false, error: err.message ?? "Purchase failed" };
  }
}

// ─── 恢复购买 ─────────────────────────────────────────────────
export async function restorePurchases(): Promise<boolean> {
  if (MOCK_MODE) return false;
  try {
    const Purchases = (await import("react-native-purchases")).default;
    const { customerInfo } = await Purchases.restorePurchases();
    return customerInfo.activeSubscriptions.length > 0;
  } catch {
    return false;
  }
}

// ─── 检查当前订阅状态 ─────────────────────────────────────────
export async function checkVIPStatus(): Promise<boolean> {
  if (MOCK_MODE) return false;
  try {
    const Purchases = (await import("react-native-purchases")).default;
    const info = await Purchases.getCustomerInfo();
    return info.activeSubscriptions.length > 0
      || info.nonSubscriptionTransactions.length > 0;
  } catch {
    return false;
  }
}
