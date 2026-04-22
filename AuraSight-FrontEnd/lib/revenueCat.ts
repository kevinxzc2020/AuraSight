/**
 * RevenueCat Integration Module
 * Handles configuration and API calls to RevenueCat for in-app purchases
 *
 * Setup:
 * 1. Register at revenuecat.com and create an app
 * 2. Get API keys for iOS and Android from the RevenueCat dashboard
 * 3. Set EXPO_PUBLIC_RC_API_KEY_IOS and EXPO_PUBLIC_RC_API_KEY_ANDROID in app.json
 * 4. Product IDs must match those created in App Store Connect / Google Play Console
 *
 * Reference: https://www.revenuecat.com/docs/getting-started/installation/expo
 */

import { Platform } from 'react-native';

// Type definitions for dynamic import to avoid build issues
type PurchasesType = typeof import('react-native-purchases').default;
type PurchasesPackageType = import('react-native-purchases').PurchasesPackage;
type CustomerInfoType = import('react-native-purchases').CustomerInfo;

// Product identifiers (must match RevenueCat dashboard and App Store / Play Store)
export const PRODUCT_IDS = {
  monthly: 'aurasight_vip_monthly',
  annual: 'aurasight_vip_annual',
  challenge: 'aurasight_30day_challenge',
} as const;

export type ProductId = keyof typeof PRODUCT_IDS;

// API key configuration
// TODO: Replace with real RevenueCat API keys from dashboard
const API_KEYS = {
  ios: process.env.EXPO_PUBLIC_RC_API_KEY_IOS || 'appl_REPLACE_WITH_REAL_KEY',
  android: process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID || 'goog_REPLACE_WITH_REAL_KEY',
};

let isInitialized = false;

/**
 * Initialize RevenueCat SDK
 * Should be called once in the root layout after user context loads
 */
export async function initRevenueCat(userId?: string): Promise<void> {
  if (isInitialized) return;

  try {
    const Purchases = (await import('react-native-purchases')).default;
    const apiKey = Platform.OS === 'ios' ? API_KEYS.ios : API_KEYS.android;

    // Skip if keys are not configured
    if (apiKey.includes('REPLACE_WITH_REAL_KEY')) {
      console.warn('RevenueCat: API keys not configured — falling back to mock mode');
      return;
    }

    await Purchases.configure({ apiKey });
    if (userId) {
      await Purchases.logIn(userId);
    }
    isInitialized = true;
    console.log('✅ RevenueCat initialized successfully');
  } catch (err) {
    console.warn('RevenueCat initialization failed:', err);
    // Don't throw — allow fallback to mock mode
  }
}

/**
 * Fetch current offerings (plans) from RevenueCat
 * Returns available packages for purchase
 */
export async function getOfferings(): Promise<PurchasesPackageType[]> {
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch (err) {
    console.warn('Failed to fetch offerings:', err);
    return [];
  }
}

/**
 * Purchase a package
 * Returns true if purchase was successful and VIP entitlement is active
 */
export async function purchasePackage(pkg: PurchasesPackageType): Promise<boolean> {
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    // Check if VIP entitlement is active
    return customerInfo.entitlements.active['vip'] !== undefined;
  } catch (err: any) {
    // Don't throw on user cancellation
    if (err.userCancelled) {
      console.log('Purchase cancelled by user');
      return false;
    }
    console.error('Purchase failed:', err);
    return false;
  }
}

/**
 * Restore previous purchases
 * Useful for users reinstalling the app or switching devices
 */
export async function restorePurchases(): Promise<boolean> {
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const customerInfo = await Purchases.restorePurchases();
    // Check if any active subscriptions or non-subscription purchases exist
    return customerInfo.entitlements.active['vip'] !== undefined;
  } catch (err) {
    console.warn('Failed to restore purchases:', err);
    return false;
  }
}

/**
 * Check current VIP status from RevenueCat
 * Can be called anytime to verify if user has active subscription
 */
export async function checkVipStatus(): Promise<boolean> {
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active['vip'] !== undefined;
  } catch (err) {
    console.warn('Failed to check VIP status:', err);
    return false;
  }
}

/**
 * Get current customer information
 * Useful for debugging and advanced use cases
 */
export async function getCustomerInfo(): Promise<CustomerInfoType | null> {
  try {
    const Purchases = (await import('react-native-purchases')).default;
    return await Purchases.getCustomerInfo();
  } catch (err) {
    console.warn('Failed to get customer info:', err);
    return null;
  }
}
