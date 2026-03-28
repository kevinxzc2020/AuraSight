import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  PanResponder,
  Alert,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Trash2 } from "lucide-react-native";
import { router } from "expo-router";
import {
  Colors,
  Radius,
  FontSize,
  Shadow,
  Spacing,
  StatusColors,
} from "../constants/theme";
import { ScanRecord } from "../lib/mongodb";

const SWIPE_THRESHOLD = -80;
const DELETE_WIDTH = 80;
const { width } = Dimensions.get("window");

interface Props {
  scan: ScanRecord;
  onDelete: (id: string) => void;
}

export function SwipeableScanCard({ scan, onDelete }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 5,

    onPanResponderMove: (_, { dx }) => {
      // 只允许左滑
      if (dx < 0) translateX.setValue(Math.max(dx, -DELETE_WIDTH));
      else if (isOpen.current)
        translateX.setValue(Math.min(dx - DELETE_WIDTH, 0));
    },

    onPanResponderRelease: (_, { dx }) => {
      if (dx < SWIPE_THRESHOLD) {
        // 打开删除按钮
        Animated.spring(translateX, {
          toValue: -DELETE_WIDTH,
          useNativeDriver: true,
        }).start();
        isOpen.current = true;
      } else {
        // 关闭
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        isOpen.current = false;
      }
    },
  });

  function handleDelete() {
    Alert.alert("Delete Scan", "Are you sure? This cannot be undone.", [
      {
        text: "Cancel",
        style: "cancel",
        onPress: () => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          isOpen.current = false;
        },
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Animated.timing(translateX, {
            toValue: -width,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            onDelete(scan._id!);
          });
        },
      },
    ]);
  }

  function handlePress() {
    if (isOpen.current) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
      isOpen.current = false;
      return;
    }
    router.push({ pathname: "/scan/[id]", params: { id: scan._id! } });
  }

  const date = new Date(scan.scan_date);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const label = isToday
    ? "Today"
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <View style={styles.container}>
      {/* 删除按钮（底层） */}
      <TouchableOpacity style={styles.deleteAction} onPress={handleDelete}>
        <Trash2 size={20} color="#fff" />
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>

      {/* 卡片（上层，可滑动） */}
      <Animated.View
        style={[styles.card, Shadow.card, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.8}
          style={styles.inner}
        >
          {scan.image_uri ? (
            <Image source={{ uri: scan.image_uri }} style={styles.thumb} />
          ) : (
            <LinearGradient
              colors={["#ffe4e6", "#fce7f3"]}
              style={styles.thumb}
            >
              <Text style={{ fontSize: 22 }}>👤</Text>
            </LinearGradient>
          )}
          <View style={styles.info}>
            <Text style={styles.date}>{label}</Text>
            <Text style={styles.count}>
              {scan.total_count} spots · Score {scan.skin_score}
            </Text>
          </View>
          <View
            style={[
              styles.badge,
              { backgroundColor: StatusColors[scan.skin_status] + "20" },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: StatusColors[scan.skin_status] },
              ]}
            >
              {scan.skin_status}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative", marginBottom: Spacing.sm },
  deleteAction: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_WIDTH,
    backgroundColor: Colors.red,
    borderRadius: Radius.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  deleteText: { color: "#fff", fontSize: FontSize.xs, fontWeight: "600" },

  card: { backgroundColor: Colors.white, borderRadius: Radius.xl },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1 },
  date: { fontSize: FontSize.sm, fontWeight: "500", color: Colors.gray800 },
  count: { fontSize: FontSize.xs, color: Colors.gray500 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: "500",
    textTransform: "capitalize",
  },
});
