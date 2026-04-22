import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView as RNSafeAreaView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import {
  Colors,
  DarkColors,
  Spacing,
  Radius,
  FontSize,
} from "../constants/theme";
import { useAppTheme } from "../lib/themeContext";

const LAST_UPDATED = "April 22, 2026";

export default function PrivacyScreen() {
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
      paddingVertical: Spacing.lg,
      paddingBottom: Spacing.xxl,
    },
    lastUpdated: {
      fontSize: FontSize.sm,
      color: isDark ? C.gray400 : C.gray500,
      marginBottom: Spacing.xl,
      fontStyle: "italic",
    },
    sectionTitle: {
      fontSize: FontSize.md,
      fontWeight: "600",
      color: isDark ? C.gray900 : C.gray900,
      marginTop: Spacing.xl,
      marginBottom: Spacing.md,
    },
    paragraph: {
      fontSize: FontSize.base,
      lineHeight: 24,
      color: isDark ? C.gray700 : C.gray700,
      marginBottom: Spacing.lg,
    },
    listItem: {
      fontSize: FontSize.base,
      lineHeight: 24,
      color: isDark ? C.gray700 : C.gray700,
      marginBottom: Spacing.md,
      marginLeft: Spacing.lg,
    },
    listBullet: {
      marginLeft: -Spacing.lg,
    },
  });

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
            <Text style={styles.headerTitle}>Privacy Policy</Text>
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
        <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>

        <Text style={styles.sectionTitle}>1. Overview</Text>
        <Text style={styles.paragraph}>
          AuraSight ("we," "us," "our," or "Company") is committed to protecting
          your privacy. This Privacy Policy explains how we collect, use,
          disclose, and otherwise handle your information when you use our
          mobile application, website, and related services (collectively, the
          "Service").
        </Text>

        <Text style={styles.sectionTitle}>2. Information We Collect</Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>Account Information:</Text> When
          you register or log in, we collect your name, email address, and
          password (hashed and encrypted).
        </Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>Health & Profile Data:</Text> We
          collect information about your skin type, skin concerns, skincare
          routine level, climate/location, age, and other health-related data
          you voluntarily provide in your profile.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>Photos & Skin Scans:</Text> When
          you use the camera feature to scan your skin, we collect:
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Photographs of your skin
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Acne detection analysis (provided by AI)
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Scan metadata (date, time, affected areas)
        </Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>How Photos Are Handled:</Text>
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Free users: Photos are analyzed by AI but not permanently stored on
          our servers. They are processed and deleted within 24 hours.
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • VIP users: Photos are securely stored to enable your transformation
          timeline and historical analysis.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>Usage Data:</Text> We collect
          information about how you interact with the Service, including app
          usage patterns, features accessed, and session duration.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>Device Information:</Text> We
          collect data about your device, including device type, operating
          system, and unique device identifiers (when you grant permission).
        </Text>

        <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>

        <Text style={styles.paragraph}>We use collected information to:</Text>

        <Text style={[styles.listItem, styles.listBullet]}>
          • Provide, maintain, and improve the Service
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Analyze your skin condition using AI and generate personalized
          reports
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Process your subscription and billing information
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Send transactional emails (account confirmation, purchase receipts)
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Respond to your inquiries and customer support requests
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Detect and prevent fraudulent activity
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Comply with legal obligations
        </Text>

        <Text style={styles.sectionTitle}>4. AI Processing</Text>

        <Text style={styles.paragraph}>
          Your photos are processed using artificial intelligence (powered by
          Anthropic AI) to detect acne and skin conditions. This AI analysis is
          not a medical diagnosis and should not be used as a substitute for
          professional dermatological advice. The AI model is trained to
          classify acne types (pustules, nodules, papules, etc.) but may have
          limitations and should be reviewed with a dermatologist for
          therapeutic decisions.
        </Text>

        <Text style={styles.sectionTitle}>5. Data Storage & Security</Text>

        <Text style={styles.paragraph}>
          We use industry-standard encryption and security measures to protect
          your information. However, no method of transmission over the Internet
          or electronic storage is 100% secure. We cannot guarantee absolute
          security of your data.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>Data Retention:</Text> We retain
          your account data as long as your account is active. If you delete
          your account, we will remove personal data within 30 days (except
          where required by law).
        </Text>

        <Text style={styles.sectionTitle}>6. Third-Party Services</Text>

        <Text style={styles.paragraph}>
          We work with third-party service providers, including:
        </Text>

        <Text style={[styles.listItem, styles.listBullet]}>
          • <Text style={{ fontWeight: "600" }}>Analytics:</Text> Google
          Analytics and similar services to understand app usage
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • <Text style={{ fontWeight: "600" }}>Advertising:</Text> Google
          AdMob for displaying ads (only in free tier)
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • <Text style={{ fontWeight: "600" }}>AI Processing:</Text> Anthropic
          AI for skin analysis
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • <Text style={{ fontWeight: "600" }}>Payment Processing:</Text> App
          Store / Google Play for subscription management
        </Text>

        <Text style={styles.paragraph}>
          These services may collect and process your data according to their
          own privacy policies. We are not responsible for their practices.
        </Text>

        <Text style={styles.sectionTitle}>7. Camera & Photo Permissions</Text>

        <Text style={styles.paragraph}>
          To use the skin scanning feature, the Service requires access to your
          device's camera and photo library. You can revoke these permissions
          at any time through your device settings. Without these permissions,
          you cannot use the scanning and analysis features.
        </Text>

        <Text style={styles.sectionTitle}>8. Your Privacy Rights</Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>Access & Portability:</Text> You
          can request a copy of your personal data at any time by contacting us.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>Deletion:</Text> You can delete
          your account and associated data through the app settings. This action
          is permanent and cannot be undone.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>Data Export:</Text> You can
          export your scan history and health profile data in a standard format.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>Opt-Out of Analytics:</Text> You
          can disable analytics tracking in your settings to limit data
          collection.
        </Text>

        <Text style={styles.sectionTitle}>9. Children's Privacy</Text>

        <Text style={styles.paragraph}>
          The Service is not intended for children under 13 years of age (or the
          applicable age of digital consent in your jurisdiction). We do not
          knowingly collect personal data from children. If we become aware that
          a child has provided us with personal data, we will promptly delete
          such information.
        </Text>

        <Text style={styles.sectionTitle}>10. International Data Transfers</Text>

        <Text style={styles.paragraph}>
          Your information may be transferred to, stored in, and processed in
          countries other than your country of residence. These countries may
          have data protection laws that differ from your home country. By using
          the Service, you consent to such transfers.
        </Text>

        <Text style={styles.sectionTitle}>11. Changes to This Privacy Policy</Text>

        <Text style={styles.paragraph}>
          We may update this Privacy Policy periodically. We will notify you of
          material changes by updating the "Last Updated" date at the top of
          this policy. Your continued use of the Service after such changes
          constitutes your acceptance of the updated Privacy Policy.
        </Text>

        <Text style={styles.sectionTitle}>12. Contact Us</Text>

        <Text style={styles.paragraph}>
          If you have questions about this Privacy Policy or our privacy
          practices, please contact us at:
        </Text>

        <Text style={[styles.paragraph, { fontWeight: "600" }]}>
          Email: kevinxzc2020@gmail.com
        </Text>

        <Text style={styles.paragraph}>
          We will respond to your inquiries within 30 days.
        </Text>
      </ScrollView>
    </View>
  );
}
