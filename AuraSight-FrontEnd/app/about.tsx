import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ChevronLeft, ExternalLink } from "lucide-react-native";
import {
  Colors,
  Spacing,
  Radius,
  FontSize,
} from "../constants/theme";
import { useAppTheme } from "../lib/themeContext";

const APP_VERSION = "1.0.0";

export default function AboutScreen() {
  const { colors: C, isDark } = useAppTheme();

  const styles = StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: isDark ? C.background : "#FFFFFF",
    },
    header: {
      paddingBottom: Spacing.xl,
    },
    headerContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backBtn: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      flex: 1,
      fontSize: FontSize.lg,
      fontWeight: "600",
      color: "#FFFFFF",
      marginLeft: Spacing.md,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.xl,
      paddingBottom: Spacing.xxl,
    },
    logoContainer: {
      alignItems: "center",
      marginBottom: Spacing.xl,
    },
    logo: {
      fontSize: 80,
      marginBottom: Spacing.lg,
    },
    appName: {
      fontSize: FontSize.xl,
      fontWeight: "700",
      color: isDark ? C.gray900 : C.gray900,
      marginBottom: Spacing.sm,
    },
    version: {
      fontSize: FontSize.sm,
      color: isDark ? C.gray500 : C.gray500,
      marginBottom: Spacing.xl,
    },
    tagline: {
      fontSize: FontSize.md,
      fontWeight: "600",
      color: isDark ? C.gray800 : C.gray800,
      marginBottom: Spacing.lg,
      textAlign: "center",
    },
    description: {
      fontSize: FontSize.base,
      lineHeight: 24,
      color: isDark ? C.gray700 : C.gray700,
      marginBottom: Spacing.xl,
      textAlign: "center",
    },
    section: {
      marginBottom: Spacing.xl,
      paddingBottom: Spacing.xl,
      borderBottomColor: isDark ? C.gray300 : C.gray200,
      borderBottomWidth: 1,
    },
    sectionTitle: {
      fontSize: FontSize.md,
      fontWeight: "600",
      color: isDark ? C.gray900 : C.gray900,
      marginBottom: Spacing.lg,
      textAlign: "center",
    },
    teamText: {
      fontSize: FontSize.base,
      lineHeight: 24,
      color: isDark ? C.gray700 : C.gray700,
      textAlign: "center",
      marginBottom: Spacing.lg,
    },
    contactLink: {
      fontSize: FontSize.base,
      color: "#F43F8F",
      fontWeight: "600",
      textAlign: "center",
      textDecorationLine: "underline",
      marginBottom: Spacing.xl,
    },
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
      borderRadius: Radius.md,
      backgroundColor: isDark ? C.gray200 : "#F3F4F6",
    },
    linkText: {
      fontSize: FontSize.base,
      color: isDark ? C.gray900 : C.gray900,
      fontWeight: "500",
      marginRight: Spacing.sm,
      flex: 1,
    },
    linkIcon: {
      marginLeft: Spacing.sm,
    },
    copyright: {
      fontSize: FontSize.sm,
      color: isDark ? C.gray500 : C.gray500,
      textAlign: "center",
      marginTop: Spacing.xl,
      marginBottom: Spacing.md,
    },
    madeIn: {
      fontSize: FontSize.sm,
      color: isDark ? C.gray500 : C.gray500,
      textAlign: "center",
      fontStyle: "italic",
    },
  });

  const handleEmailPress = () => {
    Linking.openURL("mailto:kevinxzc2020@gmail.com");
  };

  const handleWebsitePress = () => {
    Linking.openURL("https://aurasight.app");
  };

  return (
    <View style={styles.root}>
      {/* Header with gradient */}
      <LinearGradient
        colors={["#F43F8F", "#F472B6", "#FB9FBD"]}
        style={styles.header}
      >
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <ChevronLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>About</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo & App Name */}
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>✨</Text>
          <Text style={styles.appName}>AuraSight</Text>
          <Text style={styles.version}>v{APP_VERSION}</Text>
        </View>

        {/* Tagline */}
        <Text style={styles.tagline}>AI-Powered Skin Analysis</Text>

        {/* Description */}
        <Text style={styles.description}>
          AuraSight uses advanced AI to help you track, understand, and improve
          your skin health. Powered by computer vision and dermatological
          expertise.
        </Text>

        {/* Team Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Team</Text>
          <Text style={styles.teamText}>Built with ❤️ by the AuraSight team</Text>
          <TouchableOpacity onPress={handleEmailPress}>
            <Text style={styles.contactLink}>kevinxzc2020@gmail.com</Text>
          </TouchableOpacity>
        </View>

        {/* Links Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Links</Text>

          {/* Website */}
          <TouchableOpacity
            style={styles.linkRow}
            onPress={handleWebsitePress}
          >
            <Text style={styles.linkText}>Website</Text>
            <ExternalLink size={16} color="#F43F8F" />
          </TouchableOpacity>

          {/* Privacy Policy */}
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push("/privacy")}
          >
            <Text style={styles.linkText}>Privacy Policy</Text>
            <ExternalLink size={16} color="#F43F8F" />
          </TouchableOpacity>

          {/* Terms of Service */}
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push("/terms")}
          >
            <Text style={styles.linkText}>Terms of Service</Text>
            <ExternalLink size={16} color="#F43F8F" />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.copyright}>
          © 2026 AuraSight. All rights reserved.
        </Text>
        <Text style={styles.madeIn}>Made in California</Text>
      </ScrollView>
    </View>
  );
}
