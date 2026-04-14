/**
 * AuraSight — Data Use Consent Modal
 *
 * 用户首次使用 AI 检测或上传照片时弹出。
 * 必须明确同意才能继续；拒绝则保留拍照预览，但 AI/云端保存被禁用。
 */

import React from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ShieldCheck, X } from "lucide-react-native";
import {
  Colors,
  Gradients,
  Spacing,
  Radius,
  FontSize,
  Shadow,
} from "../constants/theme";

interface Props {
  visible: boolean;
  onAgree: () => void;
  onDecline: () => void;
}

export function ConsentModal({ visible, onAgree, onDecline }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDecline}
    >
      <View style={st.backdrop}>
        <View style={[st.card, Shadow.card]}>
          {/* 关闭——视觉等同于拒绝 */}
          <TouchableOpacity style={st.closeBtn} onPress={onDecline}>
            <X size={18} color={Colors.gray400} />
          </TouchableOpacity>

          {/* 头部图标 */}
          <View style={st.iconWrap}>
            <LinearGradient
              colors={Gradients.roseMain}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={st.iconCircle}
            >
              <ShieldCheck size={28} color="#fff" />
            </LinearGradient>
          </View>

          <Text style={st.title}>Data Use & Privacy</Text>
          <Text style={st.subtitle}>
            Before we save or analyze your photos, we need your permission.
          </Text>

          <ScrollView
            style={st.bodyScroll}
            contentContainerStyle={st.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={st.sectionH}>What we collect</Text>
            <Text style={st.body}>
              Skin photos you take or upload, plus the AI detection results
              (spot positions, types, scores) and any diary notes you add.
            </Text>

            <Text style={st.sectionH}>How we use it</Text>
            <Text style={st.body}>
              • To show your scan history and skin trend over time.{"\n"}
              • To run AI skin analysis (Claude Vision) on your photos.{"\n"}
              • To improve our acne-detection model — anonymized images may be
              used as training data so AuraSight gets more accurate over time.
            </Text>

            <Text style={st.sectionH}>What we don't do</Text>
            <Text style={st.body}>
              • We don't sell your photos or share them with advertisers.{"\n"}
              • Faces are never published or shown to other users.{"\n"}
              • You can revoke this consent any time in Settings → Privacy.
              When you revoke, we mark all of your existing scans as
              off-limits for training and stop sending new photos for AI
              analysis. If you want the photos themselves deleted, delete
              the scan from History.
            </Text>

            <Text style={st.fineprint}>
              By tapping "I agree", you grant AuraSight a license to store and
              process your skin photos for the purposes above. You can delete
              individual scans any time from History.
            </Text>
          </ScrollView>

          {/* CTA */}
          <TouchableOpacity onPress={onAgree} activeOpacity={0.9}>
            <LinearGradient
              colors={Gradients.roseMain}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.agreeBtn}
            >
              <Text style={st.agreeText}>I agree — continue</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDecline} style={st.declineBtn}>
            <Text style={st.declineText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(31,41,55,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gray50,
  },
  iconWrap: { alignItems: "center", marginBottom: Spacing.md },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EC4899",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.gray800,
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.gray500,
    textAlign: "center",
    marginBottom: Spacing.md,
    lineHeight: 19,
  },
  bodyScroll: {
    maxHeight: 280,
    marginBottom: Spacing.md,
  },
  bodyContent: { paddingBottom: Spacing.sm },
  sectionH: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.rose400,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  body: {
    fontSize: FontSize.sm,
    color: Colors.gray700,
    lineHeight: 20,
  },
  fineprint: {
    fontSize: FontSize.xs,
    color: Colors.gray500,
    fontStyle: "italic",
    marginTop: Spacing.md,
    lineHeight: 17,
  },
  agreeBtn: {
    paddingVertical: 14,
    borderRadius: Radius.full,
    alignItems: "center",
  },
  agreeText: {
    color: "#fff",
    fontSize: FontSize.base,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  declineBtn: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  declineText: {
    color: Colors.gray500,
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
});
