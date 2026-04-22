/**
 * AuraSight — In-App Purchases Interface
 *
 * This module provides a unified interface for purchases with automatic fallback to mock mode.
 * RevenueCat integration is in lib/revenueCat.ts
 *
 * Setup:
 * 1. Register at revenuecat.com and create an app
 * 2. Get API keys for iOS and Android
 * 3. Set EXPO_PUBLIC_RC_API_KEY_IOS and EXPO_PUBLIC_RC_API_KEY_ANDROID in app.json
 * 4. Product IDs must match App Store Connect / Google Play Console
 * 5. Requires Development Build (Expo Go does not support real purchases)
 *
 * Reference: https://www.revenuecat.com/docs/getting-started/installation/expo
 */

import * as RevenueCat from './revenueCat';

// ─── Export product IDs from RevenueCat module ──────────────────
export const PRODUCT_IDS = RevenueCat.PRODUCT_IDS;
export type PlanId = RevenueCat.ProductId;

// ─── Mock mode detection ────────────────────────────────────────
// Falls back to mock mode if RevenueCat API keys are not configured
// or if SDK initialization fails
let useMockMode = false;

/**
 * Initialize purchases system
 * Automatically detects if RevenueCat is properly configured
 * If not, falls back to mock mode for UI testing
 */
export async function initPurchases(userId?: string): Promise<void> {
  try {
    await RevenueCat.initRevenueCat(userId);
    useMockMode = false;
    console.log('✅ RevenueCat purchases initialized');
  } catch (err) {
    console.warn('RevenueCat initialization failed, using mock mode:', err);
    useMockMode = true;
  }
}

// ─── Purchase result interface ──────────────────────────────────
export interface PurchaseResult {
  success: boolean;
  error?: string;
}

/**
 * Purchase a subscription or one-time product
 * @param planId - The plan to purchase (monthly, annual, challenge)
 * @returns Promise with success status and optional error message
 */
export async function purchasePlan(planId: PlanId): Promise<PurchaseResult> {
  if (useMockMode) {
    console.log('[MOCK] Purchase simulated for:', planId);
    return { success: true };
  }

  try {
    const offerings = await RevenueCat.getOfferings();
    if (!offerings || offerings.length === 0) {
      return { success: false, error: 'No offerings available' };
    }

    // Find the package matching the plan ID
    const productId = RevenueCat.PRODUCT_IDS[planId];
    const pkg = offerings.find((p) => p.product.identifier === productId);

    if (!pkg) {
      return { success: false, error: `Product ${planId} not found` };
    }

    const isActive = await RevenueCat.purchasePackage(pkg);
    return { success: isActive };
  } catch (err: any) {
    if (err.userCancelled) {
      return { success: false, error: 'cancelled' };
    }
    console.error('Purchase error:', err);
    return { success: false, error: err.message ?? 'Purchase failed' };
  }
}

/**
 * Restore previous purchases
 * Useful for users reinstalling or switching devices
 * @returns true if active subscriptions were found and restored
 */
export async function restorePurchases(): Promise<boolean> {
  if (useMockMode) {
    console.log('[MOCK] Restore purchases simulated');
    return false;
  }

  try {
    return await RevenueCat.restorePurchases();
  } catch (err) {
    console.error('Restore purchases error:', err);
    return false;
  }
}

/**
 * Check current VIP subscription status
 * @returns true if user has active VIP subscription
 */
export async function checkVIPStatus(): Promise<boolean> {
  if (useMockMode) {
    return false;
  }

  try {
    return await RevenueCat.checkVipStatus();
  } catch (err) {
    console.error('Check VIP status error:', err);
    return false;
  }
}
