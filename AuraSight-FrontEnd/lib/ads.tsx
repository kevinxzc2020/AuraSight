/**
 * AuraSight — Ad Service Layer
 *
 * 使用 react-native-google-mobile-ads (Google AdMob)
 * 免费用户显示广告，VIP 用户无广告。
 *
 * 安装步骤：
 *   npx expo install react-native-google-mobile-ads
 *   然后在 app.json 的 plugins 里加上配置（已做好）
 *   需要 EAS Build / custom dev client，Expo Go 不支持原生广告 SDK
 */

import React from "react";
import { View, Text, Platform, AppState, AppStateStatus } from "react-native";
import { useUser } from "./userContext";
import { useT } from "./i18n";

// ── Ad Unit IDs ──────────────────────────────────────────────
// iOS 真实广告 ID（AdMob 后台创建）
const BANNER_IOS            = "ca-app-pub-7552640548182350/6318185898";
const INTERSTITIAL_IOS      = "ca-app-pub-7552640548182350/9167710518";
// TODO: 在 AdMob 创建 App Open 和 Rewarded ad unit 后替换为真实 ID
const APP_OPEN_IOS          = "ca-app-pub-7552640548182350/4324259556";
const REWARDED_IOS          = "ca-app-pub-7552640548182350/3011177887";

// Android 暂时用 Google 测试 ID，上线前替换为真实的
const BANNER_ANDROID        = "ca-app-pub-3940256099942544/6300978111";
const INTERSTITIAL_ANDROID  = "ca-app-pub-3940256099942544/1033173712";
const APP_OPEN_ANDROID      = "ca-app-pub-3940256099942544/9257395921";   // 测试 ID
const REWARDED_ANDROID      = "ca-app-pub-3940256099942544/5224354917";   // 测试 ID

export const AD_UNIT = {
  banner:       Platform.select({ ios: BANNER_IOS, default: BANNER_ANDROID }),
  interstitial: Platform.select({ ios: INTERSTITIAL_IOS, default: INTERSTITIAL_ANDROID }),
  appOpen:      Platform.select({ ios: APP_OPEN_IOS, default: APP_OPEN_ANDROID }),
  rewarded:     Platform.select({ ios: REWARDED_IOS, default: REWARDED_ANDROID }),
};

// ── 安全导入 ─────────────────────────────────────────────────
// react-native-google-mobile-ads 是原生模块，在 Expo Go 里不存在
// 用 try/catch 做 graceful fallback，避免 Expo Go 开发时崩溃
let BannerAd: any = null;
let BannerAdSize: any = null;
let InterstitialAd: any = null;
let AppOpenAd: any = null;
let RewardedAd: any = null;
let AdEventType: any = null;
let RewardedAdEventType: any = null;
let _adsAvailable = false;

try {
  const admob = require("react-native-google-mobile-ads");
  BannerAd = admob.BannerAd;
  BannerAdSize = admob.BannerAdSize;
  InterstitialAd = admob.InterstitialAd;
  AppOpenAd = admob.AppOpenAd;
  RewardedAd = admob.RewardedAd;
  AdEventType = admob.AdEventType;
  RewardedAdEventType = admob.RewardedAdEventType;
  _adsAvailable = true;
} catch {
  // 模块不可用（Expo Go / 未安装），静默降级
}

export const adsAvailable = _adsAvailable;

// ── 开发模式占位符（Expo Go 里显示，让你知道广告位在哪） ──────
const __DEV_PLACEHOLDER__ = __DEV__ && !_adsAvailable;

function AdPlaceholder() {
  const { t } = useT();
  return (
    <View style={{
      height: 52, alignItems: "center", justifyContent: "center",
      backgroundColor: "#FFF0F3", borderRadius: 8,
      borderWidth: 1, borderColor: "#FCE7F3", borderStyle: "dashed",
      marginHorizontal: 16,
    }}>
      <Text style={{ fontSize: 12, color: "#F472B6", fontWeight: "600" }}>
        {t("ads.placeholder")}
      </Text>
    </View>
  );
}

// ── Banner 广告组件 ──────────────────────────────────────────
// VIP 用户自动隐藏，模块不可用时显示占位符（开发），生产环境隐藏
export function AdBanner({ style }: { style?: any }) {
  const { user } = useUser();
  const isVIP = user?.mode === "vip";

  if (isVIP) return null;

  // Expo Go / 模块未安装 → 开发时显示占位，生产环境隐藏
  if (!_adsAvailable || !BannerAd) {
    return __DEV_PLACEHOLDER__ ? (
      <View style={[{ alignItems: "center", marginVertical: 8 }, style]}>
        <AdPlaceholder />
      </View>
    ) : null;
  }

  return (
    <View style={[{ alignItems: "center", marginVertical: 8 }, style]}>
      <BannerAd
        unitId={AD_UNIT.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

// ── 插页广告 (Interstitial) ─────────────────────────────────
// 预加载一个 interstitial，在合适时机调用 showInterstitial()
let _interstitial: any = null;
let _interstitialReady = false;

function loadInterstitial() {
  if (!_adsAvailable || !InterstitialAd) return;
  _interstitial = InterstitialAd.createForAdRequest(AD_UNIT.interstitial, {
    requestNonPersonalizedAdsOnly: true,
  });
  _interstitial.addAdEventListener(AdEventType.LOADED, () => {
    _interstitialReady = true;
  });
  _interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    _interstitialReady = false;
    // 关闭后自动预加载下一个
    loadInterstitial();
  });
  _interstitial.load();
}

/** 初始化广告系统，app 启动时调用一次 */
export function initAds() {
  if (!_adsAvailable) return;
  loadInterstitial();
}

/** 尝试显示插页广告。返回 true = 成功显示, false = 没准备好或 VIP */
export function showInterstitial(isVIP: boolean): boolean {
  if (isVIP || !_interstitialReady || !_interstitial) return false;
  _interstitial.show();
  return true;
}

// ── App Open Ad（开屏广告）───────────────────────────────────
// 用户从后台切回前台时显示，CPM 最高的广告类型之一
let _appOpen: any = null;
let _appOpenReady = false;
let _appOpenLastShown = 0; // 防止频繁显示
const APP_OPEN_COOLDOWN = 30_000; // 至少间隔 30 秒

function loadAppOpen() {
  if (!_adsAvailable || !AppOpenAd) return;
  _appOpen = AppOpenAd.createForAdRequest(AD_UNIT.appOpen, {
    requestNonPersonalizedAdsOnly: true,
  });
  _appOpen.addAdEventListener(AdEventType.LOADED, () => {
    _appOpenReady = true;
  });
  _appOpen.addAdEventListener(AdEventType.CLOSED, () => {
    _appOpenReady = false;
    loadAppOpen(); // 关闭后预加载下一个
  });
  _appOpen.load();
}

let _appStateListener: any = null;
let _isVipCached = false;

/** 初始化 App Open Ad，传入 isVIP 标志，只对免费用户生效 */
export function initAppOpenAd(isVIP: boolean) {
  _isVipCached = isVIP;
  if (!_adsAvailable || !AppOpenAd || isVIP) return;

  loadAppOpen();

  // 监听 app 从后台切回前台
  if (_appStateListener) _appStateListener.remove();
  _appStateListener = AppState.addEventListener("change", (next: AppStateStatus) => {
    if (
      next === "active" &&
      !_isVipCached &&
      _appOpenReady &&
      _appOpen &&
      Date.now() - _appOpenLastShown > APP_OPEN_COOLDOWN
    ) {
      _appOpen.show();
      _appOpenLastShown = Date.now();
    }
  });
}

/** 更新 VIP 状态缓存（用户升级后调用） */
export function updateAdVipStatus(isVIP: boolean) {
  _isVipCached = isVIP;
}

// ── Rewarded Ad（激励视频广告）─────────────────────────────
// 用户看完广告获得 1 次免费扫描机会
let _rewarded: any = null;
let _rewardedReady = false;

function loadRewarded() {
  if (!_adsAvailable || !RewardedAd) return;
  _rewarded = RewardedAd.createForAdRequest(AD_UNIT.rewarded, {
    requestNonPersonalizedAdsOnly: true,
  });
  _rewarded.addAdEventListener(AdEventType.LOADED, () => {
    _rewardedReady = true;
  });
  _rewarded.addAdEventListener(AdEventType.CLOSED, () => {
    _rewardedReady = false;
    loadRewarded(); // 关闭后预加载下一个
  });
  _rewarded.load();
}

/** 初始化 Rewarded Ad，app 启动时调用 */
export function initRewardedAd() {
  if (!_adsAvailable || !RewardedAd) return;
  loadRewarded();
}

/** 检查激励广告是否准备好 */
export function isRewardedAdReady(): boolean {
  return _rewardedReady && !!_rewarded;
}

/**
 * 显示激励广告。
 * @returns Promise<boolean> — true = 用户看完获得奖励, false = 中途关闭或没准备好
 */
export function showRewardedAd(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!_rewardedReady || !_rewarded) {
      resolve(false);
      return;
    }

    let earned = false;

    // 用户看完广告获得奖励的回调
    const rewardListener = _rewarded.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => { earned = true; }
    );

    // 广告关闭后 resolve
    const closeListener = _rewarded.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        rewardListener();  // 移除 listener
        closeListener();   // 移除 listener
        resolve(earned);
      }
    );

    _rewarded.show();
  });
}
