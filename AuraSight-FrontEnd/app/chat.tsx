import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ChevronLeft, Send, Sparkles } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sendChatMessage, ChatMessage } from "../lib/ai";
import { getUserId } from "../lib/userId";
import { Colors, Spacing, FontSize, Radius } from "../constants/theme";
import { useT } from "../lib/i18n";

type Message = ChatMessage & { id: string; loading?: boolean };

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <LinearGradient colors={["#F43F8F", "#F472B6"]} style={styles.avatar}>
          <Sparkles size={13} color="#fff" />
        </LinearGradient>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        {msg.loading ? (
          <View style={styles.typingRow}>
            <TypingDots />
          </View>
        ) : (
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {msg.content}
          </Text>
        )}
      </View>
    </View>
  );
}

function TypingDots() {
  const [dot, setDot] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDot((d) => (d + 1) % 3), 450);
    return () => clearInterval(t);
  }, []);
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.dot, dot === i && styles.dotActive]} />
      ))}
    </View>
  );
}

export default function ChatScreen() {
  const { t } = useT();
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: "" },  // Will be set with i18n in useEffect
  ]);
  const [welcomeLoaded, setWelcomeLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [dailyTip, setDailyTip] = useState<string>("");
  const listRef = useRef<FlatList>(null);
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.59:3000";

  // Static tips fallback (used from home page)
  const SKIN_TIP_COUNT = 15;
  function getStaticTip(): string {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const tipIndex = dayOfYear % SKIN_TIP_COUNT;
    const tips = [
      "Cleanse twice daily — morning removes overnight oils, evening removes pollutants and makeup.",
      "SPF 30+ every morning, even on cloudy days. UV rays penetrate clouds and windows.",
      "Touching your face transfers bacteria. Keep hands away between cleansing routines.",
      "Pillowcases collect oil and bacteria. Change them at least once a week.",
      "Lukewarm water is ideal for washing. Hot water strips your skin's natural barrier.",
      "Stress triggers cortisol, which increases oil production and breakouts.",
      "Retinol at night, vitamin C in the morning — they work best at different times.",
      "Hydration shows in your skin. Dehydrated skin overproduces oil to compensate.",
      "Pat dry, don't rub. Rubbing with a towel creates micro-tears in skin.",
      "Always apply skincare to slightly damp skin — it absorbs actives better.",
      "Spot treatments work best applied to a clean face before moisturiser.",
      "Exfoliate 1-2x per week max. Over-exfoliation weakens your skin barrier.",
      "Antioxidants in your diet (berries, green tea) help fight skin-damaging free radicals.",
      "The skin around your eyes is thinnest — use a dedicated eye cream, gently.",
      "Consistency beats intensity. A simple routine done daily beats an elaborate one done rarely.",
    ];
    return tips[tipIndex] || tips[0];
  }

  useEffect(() => {
    // 用集中版 getUserId——登录后拿账号 id，未登录拿 guest id
    getUserId().then((id) => setUserId(id));

    // Set welcome message with i18n
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `${t("chat.welcome")}\n\n${t("chat.welcomeSub")}`
      }
    ]);
    setWelcomeLoaded(true);

    // Fetch AI daily tip (non-blocking, cached server-side per day)
    fetch(`${API_URL}/ai/daily-tip`)
      .then(r => r.json())
      .then(data => { if (data.tip) setDailyTip(data.tip); })
      .catch(() => { setDailyTip(getStaticTip()); });
  }, [t]);

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    Keyboard.dismiss();
    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", content };
    const loadingMsg: Message = { id: "loading", role: "assistant", content: "", loading: true };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setSending(true);

    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // Build history for API (exclude welcome + loading)
      const history: ChatMessage[] = messages
        .filter((m) => m.id !== "welcome" && !m.loading)
        .map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content });

      const reply = await sendChatMessage(history, userId);

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== "loading"),
        { id: Date.now().toString() + "_ai", role: "assistant", content: reply },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== "loading"),
        {
          id: "err",
          role: "assistant",
          content: "Sorry, I couldn't connect right now. Please check your connection and try again.", // TODO: Add i18n key for error message
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }

  return (
    <LinearGradient colors={["#FFF3F6", "#FFF9FB", "#FFFFFF"]} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={["top"]}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={22} color={Colors.gray700} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <LinearGradient colors={["#F43F8F", "#F472B6"]} style={styles.headerAvatar}>
              <Sparkles size={16} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.headerTitle}>{t("chat.title")}</Text>
              <Text style={styles.headerSub}>Powered by Claude</Text>
            </View>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Messages */}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <Bubble msg={item} />}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              messages.length === 1 ? (
                <View style={styles.suggestedSection}>
                  {dailyTip && (
                    <LinearGradient
                      colors={["#FFF5F8", "#FFEDF3"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.tipCard}
                    >
                      <Text style={styles.tipHeader}>💡 Today's Tip</Text>
                      <Text style={styles.tipText}>{dailyTip}</Text>
                    </LinearGradient>
                  )}
                  <Text style={styles.suggestedLabel}>Suggested questions</Text>
                  {[
                    "What do my recent scan results mean?",
                    "How can I reduce my spots faster?",
                    "Why is my skin score dropping?",
                    "What's the best routine for acne-prone skin?",
                  ].map((q) => (
                    <TouchableOpacity
                      key={q}
                      style={styles.suggestedChip}
                      onPress={() => handleSend(q)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestedText}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null
            }
          />

          {/* Input bar */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={t("chat.placeholder")}
              placeholderTextColor={Colors.gray400}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={() => handleSend()}
            />
            <TouchableOpacity
              onPress={() => handleSend()}
              disabled={!input.trim() || sending}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={input.trim() && !sending ? ["#F43F8F", "#F472B6"] : ["#E5E7EB", "#E5E7EB"]}
                style={styles.sendBtn}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Send size={16} color={input.trim() ? "#fff" : Colors.gray400} />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F9E0EE",
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF0F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: {
    width: 36, height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.gray800 },
  headerSub: { fontSize: 10, color: Colors.gray400, marginTop: 1 },

  messageList: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 8,
  },

  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 12,
  },
  bubbleRowUser: { flexDirection: "row-reverse" },

  avatar: {
    width: 28, height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginBottom: 2,
  },

  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleAI: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F9E0EE",
    borderBottomLeftRadius: 4,
    shadowColor: "#F0ABCA",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
    backgroundColor: "#F43F8F",
  },
  bubbleText: { fontSize: FontSize.sm, color: Colors.gray700, lineHeight: 20 },
  bubbleTextUser: { color: "#fff" },

  typingRow: { paddingVertical: 4 },
  dots: { flexDirection: "row", gap: 5, alignItems: "center" },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#F9D5E8" },
  dotActive: { backgroundColor: "#F43F8F" },

  suggestedSection: { marginTop: 8, gap: 8 },
  tipCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F9E0EE",
    shadowColor: "#F472B6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  tipHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.gray700,
    marginBottom: 6,
  },
  tipText: {
    fontSize: 12,
    color: Colors.gray600,
    lineHeight: 18,
    fontWeight: "500",
  },
  suggestedLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.gray400,
    letterSpacing: 0.5,
    marginBottom: 2,
    marginLeft: 4,
  },
  suggestedChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F9E0EE",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#F0ABCA",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 1,
  },
  suggestedText: { fontSize: FontSize.sm, color: Colors.gray700 },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F9E0EE",
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  input: {
    flex: 1,
    backgroundColor: "#FFF5F8",
    borderWidth: 1,
    borderColor: "#F9E0EE",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: FontSize.sm,
    color: Colors.gray800,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
