import React, { ReactNode } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  RefreshControl,
  ScrollViewProps,
  RefreshControlProps,
} from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  BounceIn,
} from "react-native-reanimated";
import { Colors } from "../constants/theme";

// ─── AnimatedPressable ──────────────────────────────────────
/**
 * A touchable wrapper with smooth scale-down feedback animation.
 * Uses react-native-reanimated for smooth 60fps spring animations.
 * Props: same as TouchableOpacity + scaleAmount (default 0.96)
 */
interface AnimatedPressableProps {
  onPress?: () => void;
  children: ReactNode;
  scaleAmount?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  activeOpacity?: number;
  testID?: string;
  hapticFeedback?: boolean;
}

export function AnimatedPressable({
  onPress,
  children,
  scaleAmount = 0.96,
  style,
  disabled = false,
  hapticFeedback = true,
  testID,
  activeOpacity = 0.7,
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = async () => {
    if (disabled) return;
    scale.value = withSpring(scaleAmount, {
      damping: 10,
      mass: 1,
      overshootClamping: true,
    });
    if (hapticFeedback) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Haptics not available
      }
    }
  };

  const handlePressOut = () => {
    if (disabled) return;
    scale.value = withSpring(1, {
      damping: 10,
      mass: 1,
      overshootClamping: true,
    });
  };

  return (
    <Animated.View style={[animatedStyle, style]}>
      <TouchableOpacity
        onPress={() => {
          onPress?.();
          handlePressOut();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={activeOpacity}
        testID={testID}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── FadeIn ────────────────────────────────────────────────
/**
 * Wrapper component that fades in children on mount with optional direction.
 * Props: delay, duration, from ("bottom" | "left" | "right" | "none")
 */
interface FadeInProps {
  delay?: number;
  duration?: number;
  from?: "bottom" | "left" | "right" | "none";
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function FadeInComponent({
  delay = 0,
  duration = 400,
  from = "bottom",
  children,
  style,
}: FadeInProps) {
  let entering: any;

  switch (from) {
    case "bottom":
      entering = FadeInDown.delay(delay).duration(duration);
      break;
    case "left":
      entering = FadeInLeft.delay(delay).duration(duration);
      break;
    case "right":
      entering = FadeInRight.delay(delay).duration(duration);
      break;
    case "none":
      entering = FadeIn.delay(delay).duration(duration);
      break;
    default:
      entering = FadeInDown.delay(delay).duration(duration);
  }

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

// ─── StaggeredList ─────────────────────────────────────────
/**
 * Renders children with staggered fade-in delays.
 * Props: stagger (ms between each child), children
 */
interface StaggeredListProps {
  stagger?: number;
  children: ReactNode[] | ReactNode;
  duration?: number;
  from?: "bottom" | "left" | "right" | "none";
  style?: StyleProp<ViewStyle>;
  /** Style applied to each FadeInComponent wrapper (useful for flex items) */
  itemStyle?: StyleProp<ViewStyle>;
}

export function StaggeredList({
  stagger = 50,
  children,
  duration = 400,
  from = "bottom",
  style,
  itemStyle,
}: StaggeredListProps) {
  const childArray = React.Children.toArray(children);

  return (
    <View style={style}>
      {childArray.map((child, idx) => (
        <FadeInComponent
          key={idx}
          delay={idx * stagger}
          duration={duration}
          from={from}
          style={itemStyle}
        >
          {child}
        </FadeInComponent>
      ))}
    </View>
  );
}

// ─── PullToRefresh ─────────────────────────────────────────
/**
 * Enhanced pull-to-refresh wrapper with rose-tinted colors.
 * Props: refreshing, onRefresh, children
 */
interface PullToRefreshProps {
  refreshing: boolean;
  onRefresh: () => void;
  children: ReactNode;
  scrollViewProps?: ScrollViewProps;
  isDark?: boolean;
}

export function PullToRefreshView({
  refreshing,
  onRefresh,
  children,
  scrollViewProps,
  isDark = false,
}: PullToRefreshProps) {
  const refreshControlProps: RefreshControlProps = {
    refreshing,
    onRefresh,
    tintColor: isDark ? Colors.rose400 : Colors.rose500,
    progressViewOffset: 10,
  };

  return (
    <Animated.ScrollView
      {...scrollViewProps}
      refreshControl={<RefreshControl {...refreshControlProps} />}
      scrollEventThrottle={16}
    >
      {children}
    </Animated.ScrollView>
  );
}

// ─── Scale Animation ───────────────────────────────────────
/**
 * Utility function to create a scale animation for a shared value.
 */
export function useScaleAnimation(initialScale = 1) {
  const scale = useSharedValue(initialScale);

  const animateScale = (targetScale: number, duration = 300) => {
    scale.value = withTiming(targetScale, {
      duration,
      easing: Easing.inOut(Easing.ease),
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { scale, animateScale, animatedStyle };
}

// ─── Bounce Animation ──────────────────────────────────────
/**
 * Simple bounce animation for alerts or notifications.
 */
export function useBounceAnimation() {
  const scale = useSharedValue(0);

  const triggerBounce = () => {
    scale.value = withSpring(1, {
      damping: 6,
      mass: 0.8,
      overshootClamping: false,
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { scale, triggerBounce, animatedStyle };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
