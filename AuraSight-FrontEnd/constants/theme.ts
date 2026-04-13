// AuraSight Design System
// 直接从 v0 设计稿提取的颜色和样式变量

export const Colors = {
  // 主色调 - 玫瑰粉渐变
  roseLight: "#fff1f2", // rose-50
  rose100: "#ffe4e6",
  rose200: "#fecdd3",
  rose300: "#fda4af",
  rose400: "#f472b6", // 主accent
  rose500: "#fb7185",
  rose600: "#e11d48",

  // 粉色
  pink300: "#f9a8d4",
  pink400: "#f472b6",

  // 状态色
  emerald: "#34d399",
  amber: "#fbbf24",
  red: "#fb7185",

  // 中性色
  white: "#ffffff",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray800: "#1f2937",
  gray900: "#111827",

  // 背景
  background: "#fff5f5", // rose-50/80 近似
  cardBg: "#ffffff",
  darkBg: "#111827", // 相机页深色背景
};

export const Gradients = {
  roseMain: ["#f472b6", "#fb7185"] as const,
  roseLight: ["#fff1f2", "#ffffff"] as const,
  pinkRose: ["#fce7f3", "#fff1f2"] as const,
  emeraldTeal: ["#34d399", "#2dd4bf"] as const,
  amberOrange: ["#fbbf24", "#fb923c"] as const,
  darkCamera: ["#1f2937", "#111827"] as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Shadow = {
  card: {
    shadowColor: "#f472b6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  button: {
    shadowColor: "#f472b6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
};

// 痘痘类型颜色
export const AcneColors = {
  pustule: "#f472b6",
  broken: "#fbbf24",
  scab: "#34d399",
  redness: "#fb7185",
};

// 皮肤状态颜色（日历用）
export const StatusColors = {
  clear:   "#34d399",  // green
  mild:    "#fbbf24",  // amber
  healing: "#a78bfa",  // purple — recovering/scarring
  breakout:"#fb7185",  // red
};
