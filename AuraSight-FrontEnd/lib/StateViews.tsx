/**
 * AuraSight — Unified Loading, Error, and Empty State Components
 * Reusable components with dark mode support and i18n integration
 */
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useAppTheme } from "./themeContext";
import { useT } from "./i18n";
import {
  Colors,
  DarkColors,
  Spacing,
  Radius,
  FontSize,
  Shadow,
} from "../constants/theme";

const { width } = Dimensions.get("window");

// ───────────────────────────────────────────────────────────
// LoadingSkeleton — Shimmer/pulse loading placeholder
// ───────────────────────────────────────────────────────────
interface LoadingSkeletonProps {
  variant?: "card" | "list" | "fullscreen" | "inline";
  count?: number;
}

export function LoadingSkeleton({
  variant = "card",
  count = 1,
}: LoadingSkeletonProps) {
  const { colors: C, isDark } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const skeletonColor = isDark ? C.gray200 : C.rose100;

  const renderCardSkeleton = () => (
    <Animated.View style={{ opacity }}>
      <View
        style={[
          st.skeletonCard,
          { backgroundColor: skeletonColor },
        ]}
      />
    </Animated.View>
  );

  const renderListSkeleton = () => (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View key={i} style={{ opacity, marginBottom: Spacing.md }}>
          <View
            style={[
              st.skeletonListItem,
              { backgroundColor: skeletonColor },
            ]}
          />
        </Animated.View>
      ))}
    </View>
  );

  const renderFullscreenSkeleton = () => (
    <View style={st.fullscreenContainer}>
      <Animated.View style={{ opacity }}>
        <View
          style={[
            st.skeletonFullscreen,
            { backgroundColor: skeletonColor },
          ]}
        />
      </Animated.View>
    </View>
  );

  const renderInlineSkeleton = () => (
    <Animated.View style={{ opacity }}>
      <View
        style={[
          st.skeletonInline,
          { backgroundColor: skeletonColor },
        ]}
      />
    </Animated.View>
  );

  switch (variant) {
    case "list":
      return renderListSkeleton();
    case "fullscreen":
      return renderFullscreenSkeleton();
    case "inline":
      return renderInlineSkeleton();
    case "card":
    default:
      return renderCardSkeleton();
  }
}

// ───────────────────────────────────────────────────────────
// ErrorState — Friendly error display with retry
// ───────────────────────────────────────────────────────────
interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({
  message,
  onRetry,
  compact = false,
}: ErrorStateProps) {
  const { colors: C, isDark, shadow: S } = useAppTheme();
  const { t } = useT();

  const displayMessage =
    message || t("state.error.generic") || "Something went wrong";
  const title = t("state.error.title") || "Oops!";

  if (compact) {
    return (
      <View style={[st.compactErrorContainer, isDark && { backgroundColor: C.cardBg }]}>
        <Text style={[st.compactErrorText, isDark && { color: C.gray700 }]}>
          {displayMessage}
        </Text>
        {onRetry && (
          <TouchableOpacity
            onPress={onRetry}
            style={[
              st.compactRetryBtn,
              { backgroundColor: C.rose400 },
            ]}
          >
            <Text style={st.compactRetryBtnText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[st.errorContainer, isDark && { backgroundColor: C.background }]}>
      <View
        style={[
          st.errorCard,
          isDark && { backgroundColor: C.cardBg, ...S.card },
        ]}
      >
        <Text style={st.errorEmoji}>😟</Text>
        <Text style={[st.errorTitle, isDark && { color: C.gray900 }]}>
          {title}
        </Text>
        <Text
          style={[
            st.errorMessage,
            isDark && { color: C.gray400 },
          ]}
        >
          {displayMessage}
        </Text>
        {onRetry && (
          <TouchableOpacity
            onPress={onRetry}
            style={[
              st.retryBtn,
              { backgroundColor: C.rose400 },
            ]}
            activeOpacity={0.8}
          >
            <Text style={st.retryBtnText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ───────────────────────────────────────────────────────────
// EmptyState — Empty data display with optional CTA
// ───────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: string;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors: C, isDark, shadow: S } = useAppTheme();
  const { t } = useT();

  const displayTitle = title || t("state.empty.title") || "No data yet";
  const displaySubtitle =
    subtitle || t("state.empty.subtitle") || "Try taking action to get started";
  const displayIcon = icon || "📋";

  return (
    <View style={[st.emptyContainer, isDark && { backgroundColor: C.background }]}>
      <View
        style={[
          st.emptyCard,
          isDark && { backgroundColor: C.cardBg, ...S.card },
        ]}
      >
        <Text style={st.emptyIcon}>{displayIcon}</Text>
        <Text style={[st.emptyTitle, isDark && { color: C.gray900 }]}>
          {displayTitle}
        </Text>
        <Text
          style={[
            st.emptySubtitle,
            isDark && { color: C.gray400 },
          ]}
        >
          {displaySubtitle}
        </Text>
        {onAction && actionLabel && (
          <TouchableOpacity
            onPress={onAction}
            style={[
              st.emptyActionBtn,
              { backgroundColor: C.rose400 },
            ]}
            activeOpacity={0.8}
          >
            <Text style={st.emptyActionBtnText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ───────────────────────────────────────────────────────────
// Styles
// ───────────────────────────────────────────────────────────
const st = StyleSheet.create({
  // LoadingSkeleton
  skeletonCard: {
    height: 120,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
  },
  skeletonListItem: {
    height: 60,
    borderRadius: Radius.sm,
    marginHorizontal: Spacing.lg,
  },
  fullscreenContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  skeletonFullscreen: {
    width: width - Spacing.xl * 2,
    height: 200,
    borderRadius: Radius.lg,
  },
  skeletonInline: {
    height: 40,
    width: 100,
    borderRadius: Radius.sm,
  },

  // ErrorState
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  errorCard: {
    alignItems: "center",
    padding: Spacing.xxl,
    borderRadius: Radius.lg,
    maxWidth: 320,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  errorTitle: {
    fontSize: FontSize.lg,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    color: Colors.gray900,
  },
  errorMessage: {
    fontSize: FontSize.base,
    textAlign: "center",
    marginBottom: Spacing.xl,
    color: Colors.gray600,
    lineHeight: 20,
  },
  retryBtn: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  retryBtnText: {
    color: Colors.white,
    fontWeight: "600",
    fontSize: FontSize.base,
    textAlign: "center",
  },

  // Compact Error
  compactErrorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.rose100,
  },
  compactErrorText: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.rose600,
    marginRight: Spacing.lg,
  },
  compactRetryBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  compactRetryBtnText: {
    color: Colors.white,
    fontWeight: "600",
    fontSize: FontSize.sm,
  },

  // EmptyState
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  emptyCard: {
    alignItems: "center",
    padding: Spacing.xxl,
    borderRadius: Radius.lg,
    maxWidth: 340,
  },
  emptyIcon: {
    fontSize: 72,
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    color: Colors.gray900,
  },
  emptySubtitle: {
    fontSize: FontSize.base,
    textAlign: "center",
    marginBottom: Spacing.xl,
    color: Colors.gray600,
    lineHeight: 20,
  },
  emptyActionBtn: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  emptyActionBtnText: {
    color: Colors.white,
    fontWeight: "600",
    fontSize: FontSize.base,
    textAlign: "center",
  },
});
