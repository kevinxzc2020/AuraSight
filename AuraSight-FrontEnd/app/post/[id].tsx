import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { AdBanner } from "../../lib/ads";
import {
  ChevronLeft, Heart, Send, Trash2, BadgeCheck, Pin, ImagePlus, X,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Colors, Spacing, FontSize, Radius } from "../../constants/theme";
import { useAppTheme } from "../../lib/themeContext";
import { useUser } from "../../lib/userContext";
import { useT } from "../../lib/i18n";
import { LoadingSkeleton, EmptyState } from "../../lib/StateViews";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

type PostTag = "help" | "share" | "routine" | "checkin";

const TAGS: Record<PostTag, { labelKey: string; emoji: string; color: string; bg: string; darkBg: string }> = {
  help:    { labelKey: "tag.help",    emoji: "🆘", color: "#ef4444", bg: "#fef2f2", darkBg: "#3b1010" },
  share:   { labelKey: "tag.share",   emoji: "✨", color: "#f472b6", bg: "#fdf2f8", darkBg: "#2a1020" },
  routine: { labelKey: "tag.routine", emoji: "🌿", color: "#10b981", bg: "#ecfdf5", darkBg: "#0a2a1a" },
  checkin: { labelKey: "tag.checkin", emoji: "📸", color: "#8b5cf6", bg: "#f5f3ff", darkBg: "#1a1030" },
};

interface Post {
  _id: string;
  author_id: string;
  author_name: string;
  content: string;
  tag: PostTag;
  image_url?: string;
  is_pinned: boolean;
  is_official: boolean;
  likes: string[];
  comment_count: number;
  created_at: string;
}

interface Comment {
  _id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  content: string;
  image_url?: string;
  created_at: string;
}

function timeAgo(iso: string, t: (k: string) => string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return t("time.justNow");
  if (diff < 3600)  return `${Math.floor(diff / 60)}${t("time.mAgo")}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}${t("time.hAgo")}`;
  return `${Math.floor(diff / 86400)}${t("time.dAgo")}`;
}

function initial(name: string) {
  return (name ?? "?").charAt(0).toUpperCase();
}

// ─── 评论条 ──────────────────────────────────────────────
function CommentRow({ c, isDark, C, onImagePress, t }: {
  c: Comment;
  isDark: boolean;
  C: ReturnType<typeof useAppTheme>["colors"];
  onImagePress: (uri: string) => void;
  t: (k: string) => string;
}) {
  return (
    <View style={[st.commentRow, isDark && { borderBottomColor: C.gray200 }]}>
      <View style={[st.commentAvatar, { backgroundColor: Colors.rose300 }]}>
        <Text style={st.commentAvatarTxt}>{initial(c.author_name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[st.commentName, isDark && { color: C.gray900 }]}>{c.author_name}</Text>
          <Text style={[st.commentTime, isDark && { color: C.gray400 }]}>{timeAgo(c.created_at, t)}</Text>
        </View>
        {!!c.content && <Text style={[st.commentContent, isDark && { color: C.gray700 }]}>{c.content}</Text>}
        {!!c.image_url && (
          <TouchableOpacity onPress={() => onImagePress(c.image_url!)} activeOpacity={0.9}>
            <Image source={{ uri: c.image_url }} style={st.commentImg} resizeMode="cover" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── 主页面 ──────────────────────────────────────────────
export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors: C, isDark } = useAppTheme();
  const { user } = useUser();
  const { t } = useT();

  const [post, setPost]         = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [text, setText]         = useState("");
  const [sending, setSending]   = useState(false);
  const [commentImg, setCommentImg] = useState<{ uri: string; base64: string } | null>(null);
  const [myName, setMyName]     = useState("Anonymous");
  const [myId, setMyId]         = useState("guest");
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadIdentity();
    loadAll();
  }, [id]);

  async function loadIdentity() {
    const name = await AsyncStorage.getItem("@aurasight_user_name");
    const uid  = user?._id ?? (await AsyncStorage.getItem("@aurasight_guest_id")) ?? "guest";
    if (name) setMyName(name);
    setMyId(uid);
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [postRes, commentRes] = await Promise.all([
        fetch(`${API_URL}/posts/${id}`),
        fetch(`${API_URL}/posts/${id}/comments`),
      ]);
      if (postRes.status === 404) {
        Alert.alert("Error", t("community.notFound"));
        setLoading(false);
        return;
      }
      if (!postRes.ok) throw new Error(`Post fetch failed: ${postRes.status}`);
      if (!commentRes.ok) throw new Error(`Comments fetch failed: ${commentRes.status}`);
      setPost(await postRes.json());
      setComments(await commentRes.json());
    } catch {
      Alert.alert("Error", t("community.errorLoad"));
    }
    setLoading(false);
  }

  async function handleLike() {
    if (!post) return;
    const liked = post.likes.includes(myId);
    setPost(p => p ? {
      ...p,
      likes: liked ? p.likes.filter(id => id !== myId) : [...p.likes, myId],
    } : p);
    try {
      await fetch(`${API_URL}/posts/${id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: myId }),
      });
    } catch {}
  }

  async function handleDelete() {
    Alert.alert(t("community.deleteTitle"), t("community.deleteMsg"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"), style: "destructive",
        onPress: async () => {
          try {
            await fetch(`${API_URL}/posts/${id}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_id: myId }),
            });
          } catch {}
          router.back();
        },
      },
    ]);
  }

  async function pickCommentImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("🖼️", "Please allow photo access."); return; } // TODO: Add i18n key for permission alert
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.6, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setCommentImg({ uri: a.uri, base64: a.base64 ?? "" });
    }
  }

  async function sendComment() {
    if (!text.trim() && !commentImg) return;
    setSending(true);
    try {
      const r = await fetch(`${API_URL}/posts/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_id: myId, author_name: myName,
          content: text.trim(),
          image_base64: commentImg?.base64 ?? undefined,
        }),
      });
      const c: Comment = await r.json();
      setComments(prev => [...prev, c]);
      setPost(p => p ? { ...p, comment_count: p.comment_count + 1 } : p);
      setText("");
      setCommentImg(null);
    } catch {
      Alert.alert("Error", t("community.errorSend"));
    }
    setSending(false);
  }

  if (loading) {
    return (
      <View style={[st.root, { backgroundColor: isDark ? C.background : "#fff" }]}>
        <LoadingSkeleton variant="fullscreen" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[st.root, { backgroundColor: isDark ? C.background : "#fff" }]}>
        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
          <EmptyState
            icon="📝"
            title={t("community.notFound")}
            subtitle="The post you're looking for doesn't exist or has been removed."
            actionLabel="Go back"
            onAction={() => router.back()}
          />
        </SafeAreaView>
      </View>
    );
  }

  const tag      = TAGS[post.tag] ?? TAGS.share;
  const liked    = post.likes.includes(myId);
  const isAuthor = post.author_id === myId;

  return (
    <View style={[st.root, { backgroundColor: isDark ? C.background : "#f9fafb" }]}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>

          {/* 顶部导航栏 */}
          <LinearGradient colors={["#F43F8F", "#F472B6"]} style={st.navbar}>
            <TouchableOpacity onPress={() => router.back()} style={st.backBtn} hitSlop={10}>
              <ChevronLeft size={22} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={st.navTitle}>{t("post.navTitle")}</Text>
            {isAuthor ? (
              <TouchableOpacity onPress={handleDelete} hitSlop={10} style={st.deleteBtn}>
                <Trash2 size={18} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </LinearGradient>

          {/* 正文 + 评论列表 */}
          <FlatList
            data={comments}
            keyExtractor={c => c._id}
            renderItem={({ item }) => <CommentRow c={item} isDark={isDark} C={C} onImagePress={setLightboxUri} t={t} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListHeaderComponent={
              <View>
                {/* 帖子正文卡片 */}
                <View style={[st.postCard, isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 }]}>
                  {/* 置顶 */}
                  {post.is_pinned && (
                    <View style={st.pinnedRow}>
                      <Pin size={10} color={Colors.rose400} />
                      <Text style={st.pinnedTxt}>{t("community.pinned")}</Text>
                    </View>
                  )}

                  {/* 话题标签 */}
                  <View style={[st.tagPill, { backgroundColor: isDark ? tag.darkBg : tag.bg }]}>
                    <Text style={st.tagEmoji}>{tag.emoji}</Text>
                    <Text style={[st.tagLabel, { color: tag.color }]}>{t(tag.labelKey)}</Text>
                  </View>

                  {/* 作者信息 */}
                  <View style={st.authorRow}>
                    <View style={[st.avatar, { backgroundColor: post.is_official ? Colors.rose400 : Colors.gray300 }]}>
                      <Text style={st.avatarTxt}>{initial(post.author_name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={[st.authorName, isDark && { color: C.gray900 }]}>{post.author_name}</Text>
                        {post.is_official && <BadgeCheck size={13} color={Colors.rose400} />}
                      </View>
                      <Text style={[st.authorTime, isDark && { color: C.gray400 }]}>{timeAgo(post.created_at, t)}</Text>
                    </View>
                  </View>

                  {/* 正文 */}
                  <Text style={[st.postContent, isDark && { color: C.gray800 }]}>{post.content}</Text>

                  {/* 图片 */}
                  {post.image_url && (
                    <TouchableOpacity onPress={() => setLightboxUri(post.image_url!)} activeOpacity={0.9}>
                      <Image
                        source={{ uri: post.image_url }}
                        style={st.postImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  )}

                  {/* 点赞 */}
                  <TouchableOpacity onPress={handleLike} style={st.likeBtn} activeOpacity={0.7}>
                    <Heart
                      size={20}
                      color={liked ? Colors.rose400 : C.gray400}
                      fill={liked ? Colors.rose400 : "none"}
                    />
                    <Text style={[st.likeCount, liked && { color: Colors.rose400 }, isDark && !liked && { color: C.gray400 }]}>
                      {post.likes.length} {post.likes.length === 1 ? t("post.like") : t("post.likes")}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 广告横幅 */}
                <AdBanner style={{ marginTop: 8, marginBottom: 4 }} />

                {/* 评论区标题 */}
                <View style={[st.commentsHeader, isDark && { borderBottomColor: C.gray200 }]}>
                  <Text style={[st.commentsTitle, isDark && { color: C.gray900 }]}>
                    {t("post.comments")} ({post.comment_count})
                  </Text>
                </View>

                {comments.length === 0 && (
                  <Text style={[st.noComments, isDark && { color: C.gray400 }]}>
                    {t("post.noComments")}
                  </Text>
                )}
              </View>
            }
          />

          {/* 图片预览 */}
          {commentImg && (
            <View style={[st.imgPreviewBar, isDark && { backgroundColor: C.cardBg, borderTopColor: C.gray200 }]}>
              <Image source={{ uri: commentImg.uri }} style={st.imgThumb} resizeMode="cover" />
              <TouchableOpacity onPress={() => setCommentImg(null)} hitSlop={6}>
                <X size={14} color={Colors.rose400} />
              </TouchableOpacity>
            </View>
          )}

          {/* 底部评论输入框 */}
          <View style={[st.inputBar, isDark && { backgroundColor: C.cardBg, borderTopColor: C.gray200 }, commentImg && { borderTopWidth: 0 }]}>
            <TouchableOpacity onPress={pickCommentImage} hitSlop={6} style={{ marginBottom: 8 }}>
              <ImagePlus size={20} color={commentImg ? Colors.rose400 : C.gray400} />
            </TouchableOpacity>
            <View style={[st.inputWrap, isDark && { backgroundColor: C.gray200, borderColor: C.gray300 }]}>
              <TextInput
                ref={inputRef}
                style={[st.textInput, isDark && { color: C.gray900 }]}
                placeholder={`${t("post.replyAs")} ${myName}...`}
                placeholderTextColor={C.gray400}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={300}
              />
            </View>
            <TouchableOpacity
              onPress={sendComment}
              disabled={sending || (!text.trim() && !commentImg)}
              style={[st.sendBtn, (!text.trim() && !commentImg || sending) && { opacity: 0.4 }]}
            >
              <LinearGradient colors={["#F43F8F", "#F472B6"]} style={st.sendBtnGrad}>
                {sending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Send size={16} color="#fff" />}
              </LinearGradient>
            </TouchableOpacity>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ── 图片全屏查看 ── */}
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" }}
          onPress={() => setLightboxUri(null)}
        >
          {lightboxUri && (
            <Image
              source={{ uri: lightboxUri }}
              style={{ width: "94%", height: "80%" }}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            onPress={() => setLightboxUri(null)}
            style={{ position: "absolute", top: 54, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}
          >
            <X size={20} color="#fff" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },

  navbar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
  },
  backBtn:   { width: 40 },
  navTitle:  { flex: 1, textAlign: "center", fontSize: FontSize.base, fontWeight: "800", color: "#fff" },
  deleteBtn: { width: 40, alignItems: "flex-end" },

  postCard: {
    margin: Spacing.xl, marginBottom: 0,
    backgroundColor: "#fff", borderRadius: 20,
    padding: 18, borderWidth: 1, borderColor: "#fce7f3",
    shadowColor: "#f472b6", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  pinnedRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  pinnedTxt: { fontSize: 10, color: Colors.rose400, fontWeight: "700" },

  tagPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full, marginBottom: 12,
  },
  tagEmoji: { fontSize: 12 },
  tagLabel: { fontSize: 12, fontWeight: "700" },

  authorRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  avatar:    { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontSize: 16, fontWeight: "800", color: "#fff" },
  authorName: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.gray800 },
  authorTime: { fontSize: 11, color: Colors.gray400, marginTop: 1 },

  postContent: {
    fontSize: FontSize.base, color: Colors.gray700,
    lineHeight: 24, marginBottom: 16,
  },
  postImage: {
    width: "100%", height: 220,
    borderRadius: 12, marginBottom: 16,
  },

  likeBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  likeCount: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.gray500 },

  commentsHeader: {
    marginTop: Spacing.xl, marginHorizontal: Spacing.xl,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  commentsTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.gray800 },

  noComments: {
    textAlign: "center", color: Colors.gray400,
    fontSize: FontSize.sm, marginTop: 32,
  },

  commentRow: {
    flexDirection: "row", gap: 12,
    paddingHorizontal: Spacing.xl, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#f9f9f9",
  },
  commentAvatar:    { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  commentAvatarTxt: { fontSize: 13, fontWeight: "800", color: "#fff" },
  commentName:      { fontSize: FontSize.xs, fontWeight: "700", color: Colors.gray800 },
  commentTime:      { fontSize: 10, color: Colors.gray400 },
  commentContent:   { fontSize: FontSize.sm, color: Colors.gray600, lineHeight: 20, marginTop: 4 },
  commentImg:       { width: "100%", height: 160, borderRadius: 10, marginTop: 6 },

  imgPreviewBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: Spacing.lg, paddingTop: 10,
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f3f4f6",
  },
  imgThumb: { width: 56, height: 56, borderRadius: 8 },

  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: Spacing.lg, paddingVertical: 10,
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f3f4f6",
  },
  inputWrap: {
    flex: 1, borderWidth: 1, borderColor: "#f3f4f6",
    borderRadius: Radius.lg, backgroundColor: "#f9fafb",
    paddingHorizontal: 14, paddingVertical: 10,
    maxHeight: 100,
  },
  textInput: { fontSize: FontSize.sm, color: Colors.gray800, textAlignVertical: "top" },
  sendBtn:   { marginBottom: 2 },
  sendBtnGrad: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
});
