import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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

export default function TermsScreen() {
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
    highlight: {
      fontWeight: "600",
      color: isDark ? C.rose400 : Colors.rose600,
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
            <Text style={styles.headerTitle}>Terms of Service</Text>
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

        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.paragraph}>
          By accessing and using AuraSight (the "Service"), you agree to be
          bound by these Terms of Service ("Terms"). If you do not agree to
          abide by the above, please do not use this service. These terms
          constitute a binding agreement between you and AuraSight ("Company,"
          "we," "us," or "our").
        </Text>

        <Text style={styles.sectionTitle}>2. Description of Service</Text>

        <Text style={styles.paragraph}>
          AuraSight is a mobile application that provides:
        </Text>

        <Text style={[styles.listItem, styles.listBullet]}>
          • AI-powered skin analysis using photographs
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Acne detection and categorization
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Skin health tracking and reporting
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Subscription plans for enhanced features (VIP)
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.highlight}>
            IMPORTANT DISCLAIMER: The Service is not a medical device and is not
            intended to diagnose, treat, cure, or prevent any disease. Results
            from the AI analysis are for informational purposes only and should
            not be used as a substitute for professional medical advice, diagnosis,
            or treatment.
          </Text>
        </Text>

        <Text style={styles.paragraph}>
          We strongly recommend consulting with a licensed dermatologist for any
          skin concerns or before making therapeutic decisions based on the
          Service's output.
        </Text>

        <Text style={styles.sectionTitle}>3. User Accounts & Responsibilities</Text>

        <Text style={styles.paragraph}>
          When you create an account, you agree to:
        </Text>

        <Text style={[styles.listItem, styles.listBullet]}>
          • Provide accurate, current, and complete information
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Maintain the confidentiality of your password
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Accept responsibility for all activities that occur under your
          account
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Notify us immediately of any unauthorized use of your account
        </Text>

        <Text style={styles.paragraph}>
          You are responsible for maintaining the security of your account. We
          are not liable for unauthorized access to your account due to your
          negligence or failure to keep your password secure.
        </Text>

        <Text style={styles.sectionTitle}>4. Subscription & Billing</Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>Free Tier:</Text> The Service
          offers a free tier with limited features. You may use the free tier
          indefinitely, subject to these Terms and our policies.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>VIP Subscription:</Text> VIP plans
          are offered on a subscription basis with the following options:
        </Text>

        <Text style={[styles.listItem, styles.listBullet]}>
          • Monthly subscription: $4.99/month
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Annual subscription: $34.99/year
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • 30-Day Challenge: $9.99 (one-time, non-recurring)
        </Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>Free Trial:</Text> Monthly and
          annual plans include a 7-day free trial (where applicable). Trial
          access will automatically convert to a paid subscription unless
          cancelled at least 24 hours before the trial period ends.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>Auto-Renewal:</Text> Your
          subscription will automatically renew at the end of each billing
          period unless you cancel. Cancellation can be made through:
        </Text>

        <Text style={[styles.listItem, styles.listBullet]}>
          • App Store Settings (for iOS users)
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Google Play Store Settings (for Android users)
        </Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>Refunds:</Text> Refund requests
          must be made within 14 days of purchase. Refunds are processed at our
          sole discretion. Recurring subscriptions cannot be refunded for
          periods already billed.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>Price Changes:</Text> We may
          change pricing at any time. We will notify you at least 7 days before
          any price increase. If you do not agree to the new price, you may
          cancel your subscription.
        </Text>

        <Text style={styles.sectionTitle}>5. Intellectual Property</Text>

        <Text style={styles.paragraph}>
          All content in the Service, including but not limited to text, images,
          logos, icons, graphics, software, and code, is the exclusive property
          of AuraSight or its licensors. You may not reproduce, distribute,
          modify, or transmit any content without our prior written consent.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: "600" }}>Your Content:</Text> You retain
          all rights to the photographs and health data you upload. By uploading
          content, you grant us a worldwide, royalty-free license to use,
          process, analyze, and store that content for the purpose of providing
          the Service.
        </Text>

        <Text style={styles.paragraph}>
          You represent and warrant that you own or have the necessary rights to
          all content you upload and that such content does not infringe any
          third-party rights.
        </Text>

        <Text style={styles.sectionTitle}>6. Limitation of Liability</Text>

        <Text style={styles.paragraph}>
          <Text style={styles.highlight}>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, AURASIGHT SHALL NOT BE
            LIABLE FOR:
          </Text>
        </Text>

        <Text style={[styles.listItem, styles.listBullet]}>
          • Any indirect, incidental, special, or consequential damages
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Loss of profits, revenue, data, or business opportunities
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Errors, inaccuracies, or delays in the Service
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Skin condition deterioration or any medical harm
        </Text>

        <Text style={styles.paragraph}>
          Our total liability for any claim arising from or related to this
          Service shall not exceed the amount you paid us in the 12 months
          preceding the claim.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.highlight}>
            The Service is provided "as is" without warranty of any kind. We do
            not warrant that the Service will be uninterrupted, error-free, or
            secure.
          </Text>
        </Text>

        <Text style={styles.sectionTitle}>7. Indemnification</Text>

        <Text style={styles.paragraph}>
          You agree to indemnify, defend, and hold harmless AuraSight and its
          officers, directors, employees, and agents from any claims, damages,
          or costs arising from:
        </Text>

        <Text style={[styles.listItem, styles.listBullet]}>
          • Your use of the Service
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Your violation of these Terms
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Your content or data uploaded to the Service
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Your actions based on information provided by the Service
        </Text>

        <Text style={styles.sectionTitle}>8. Prohibited Conduct</Text>

        <Text style={styles.paragraph}>
          You agree not to:
        </Text>

        <Text style={[styles.listItem, styles.listBullet]}>
          • Use the Service for any illegal or unauthorized purpose
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Attempt to reverse engineer, decompile, or hack the Service
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Upload malware, viruses, or harmful code
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Harass, threaten, or defame other users
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Resell or redistribute access to the Service
        </Text>
        <Text style={[styles.listItem, styles.listBullet]}>
          • Spam or send unsolicited communications
        </Text>

        <Text style={styles.sectionTitle}>9. Termination</Text>

        <Text style={styles.paragraph}>
          We may terminate or suspend your account at any time, with or without
          cause, and with or without notice. Reasons for termination may include
          violation of these Terms, illegal activity, or extended inactivity.
        </Text>

        <Text style={styles.paragraph}>
          Upon termination, your right to access the Service will immediately
          cease. Data retention upon termination is subject to our Privacy
          Policy.
        </Text>

        <Text style={styles.sectionTitle}>10. Changes to Terms</Text>

        <Text style={styles.paragraph}>
          We may update these Terms at any time. We will notify you of material
          changes by updating the "Last Updated" date. Your continued use of the
          Service after changes constitutes your acceptance of the updated
          Terms.
        </Text>

        <Text style={styles.sectionTitle}>11. Governing Law</Text>

        <Text style={styles.paragraph}>
          These Terms are governed by and construed in accordance with the laws
          of the jurisdiction in which AuraSight operates, and you irrevocably
          submit to the exclusive jurisdiction of the courts in that location.
        </Text>

        <Text style={styles.sectionTitle}>12. Severability</Text>

        <Text style={styles.paragraph}>
          If any provision of these Terms is found to be invalid or
          unenforceable, the remaining provisions shall remain in full force and
          effect.
        </Text>

        <Text style={styles.sectionTitle}>13. Contact Us</Text>

        <Text style={styles.paragraph}>
          If you have questions about these Terms of Service, please contact us
          at:
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
