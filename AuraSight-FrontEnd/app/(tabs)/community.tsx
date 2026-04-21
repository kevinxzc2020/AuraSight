import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Heart, MessageCircle, Plus, Pin, Send,
  ChevronDown, ChevronUp, Trash2, BadgeCheck, ImagePlus, X,
} from "lucide-react-native";
import { Colors, Spacing, FontSize, Radius } from "../../constants/theme";
import { useAppTheme } from "../../lib/themeContext";
import { useUser } from "../../lib/userContext";
import { useT } from "../../lib/i18n";
import { LoadingSkeleton, EmptyState } from "../../lib/StateViews";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { AdBanner } from "../../lib/ads";
import { FadeInComponent, StaggeredList, AnimatedPressable } from "../../lib/animations";
import Animated from "react-native-reanimated";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

// ─── 话题标签定义 ──────────────────────────────────────────
type PostTag = "help" | "share" | "routine" | "checkin";

const TAGS: { id: PostTag; labelKey: string; emoji: string; color: string; bg: string; darkBg: string }[] = [
  { id: "help",    labelKey: "tag.help",    emoji: "🆘", color: "#ef4444", bg: "#fef2f2", darkBg: "#3b1010" },
  { id: "share",   labelKey: "tag.share",   emoji: "✨", color: "#f472b6", bg: "#fdf2f8", darkBg: "#2a1020" },
  { id: "routine", labelKey: "tag.routine", emoji: "🌿", color: "#10b981", bg: "#ecfdf5", darkBg: "#0a2a1a" },
  { id: "checkin", labelKey: "tag.checkin", emoji: "📸", color: "#8b5cf6", bg: "#f5f3ff", darkBg: "#1a1030" },
];

function tagInfo(id?: string) {
  return TAGS.find(t => t.id === id) ?? TAGS[1];
}

// ─── 类型 ──────────────────────────────────────────────────
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

// ─── 工具函数 ──────────────────────────────────────────────
function timeAgo(iso: string, t: (k: string) => string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return t("time.justNow");
  if (diff < 3600)  return `${Math.floor(diff / 60)}${t("time.mAgo")}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}${t("time.hAgo")}`;
  return `${Math.floor(diff / 86400)}${t("time.dAgo")}`;
}

function nameInitial(name: string) {
  return (name ?? "?").charAt(0).toUpperCase();
}

// ─── 评论区 ───────────────────────────────────────────────
function CommentSection({
  postId, myId, myName, isDark, C, onImagePress, t,
}: {
  postId: string; myId: string; myName: string;
  isDark: boolean; C: ReturnType<typeof useAppTheme>["colors"];
  onImagePress: (uri: string) => void;
  t: (k: string) => string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [text, setText]         = useState("");
  const [sending, setSending]   = useState(false);
  const [commentImg, setCommentImg] = useState<{ uri: string; base64: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const r = await fetch(`${API_URL}/posts/${postId}/comments`);
      setComments(await r.json());
    } catch {}
    setLoading(false);
  }

  async function pickCommentImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("🖼️", "Please allow photo access."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.6, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setCommentImg({ uri: a.uri, base64: a.base64 ?? "" });
    }
  }

  async function send() {
    if (!text.trim() && !commentImg) return;
    setSending(true);
    try {
      const r = await fetch(`${API_URL}/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_id: myId, author_name: myName,
          content: text.trim(),
          image_base64: commentImg?.base64 ?? undefined,
        }),
      });
      const c = await r.json();
      setComments(p => [...p, c]);
      setText("");
      setCommentImg(null);
    } catch {
      Alert.alert("Error", t("community.errorSend"));
    }
    setSending(false);
  }

  if (loading) return <ActivityIndicator size="small" color={Colors.rose400} style={{ margin: 12 }} />;

  return (
    <View style={[cs.wrap, isDark && { borderTopColor: C.gray200 }]}>
      {comments.length === 0 && (
        <Text style={[cs.empty, isDark && { color: C.gray400 }]}>{t("community.beFirst")}</Text>
      )}
      {comments.map(c => (
        <View key={c._id} style={cs.row}>
          <View style={[cs.avatar, { backgroundColor: Colors.rose300 }]}>
            <Text style={cs.avatarTxt}>{nameInitial(c.author_name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <Text style={[cs.name, isDark && { color: C.gray900 }]}>{c.author_name}</Text>
              <Text style={[cs.time, isDark && { color: C.gray400 }]}>{timeAgo(c.created_at, t)}</Text>
            </View>
            {!!c.content && <Text style={[cs.text, isDark && { color: C.gray600 }]}>{c.content}</Text>}
            {!!c.image_url && (
              <TouchableOpacity onPress={() => onImagePress(c.image_url!)} activeOpacity={0.9}>
                <Image source={{ uri: c.image_url }} style={cs.commentImage} resizeMode="cover" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
      {/* 图片预览 */}
      {commentImg && (
        <View style={cs.imgPreviewRow}>
          <Image source={{ uri: commentImg.uri }} style={cs.imgThumb} resizeMode="cover" />
          <TouchableOpacity onPress={() => setCommentImg(null)} hitSlop={6}>
            <X size={14} color={Colors.rose400} />
          </TouchableOpacity>
        </View>
      )}
      {/* 输入框 */}
      <View style={[cs.inputRow, isDark && { backgroundColor: C.gray200, borderColor: C.gray300 }]}>
        <TouchableOpacity onPress={pickCommentImage} hitSlop={6} style={{ paddingRight: 4 }}>
          <ImagePlus size={18} color={commentImg ? Colors.rose400 : C.gray400} />
        </TouchableOpacity>
        <TextInput
          style={[cs.input, isDark && { color: C.gray900 }]}
          placeholder={t("community.reply")}
          placeholderTextColor={C.gray400}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={300}
        />
        <TouchableOpacity onPress={send} disabled={sending || (!text.trim() && !commentImg)} hitSlop={8}>
          {sending
            ? <ActivityIndicator size="small" color={Colors.rose400} />
            : <Send size={16} color={(text.trim() || commentImg) ? Colors.rose400 : C.gray300} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── 帖子卡片 ─────────────────────────────────────────────
function PostCard({
  post, myId, myName, isDark, C, onLike, onDelete, onImagePress, t,
}: {
  post: Post; myId: string; myName: string;
  isDark: boolean; C: ReturnType<typeof useAppTheme>["colors"];
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onImagePress: (uri: string) => void;
  t: (k: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [textExpanded, setTextExpanded] = useState(false);
  const [textClamped, setTextClamped]   = useState(false);
  const liked = post.likes.includes(myId);
  const tag   = tagInfo(post.tag);

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => router.push(`/post/${post._id}`)}
      style={[pc.card,
        isDark && { backgroundColor: C.cardBg, borderColor: C.gray200 },
        post.is_pinned && (isDark ? pc.pinnedDk : pc.pinned),
      ]}
    >
      {/* 置顶 */}
      {post.is_pinned && (
        <View style={pc.pinnedRow}>
          <Pin size={10} color={Colors.rose400} />
          <Text style={pc.pinnedTxt}>{t("community.pinned")}</Text>
        </View>
      )}

      {/* 标签 pill */}
      <View style={[pc.tagPill, { backgroundColor: isDark ? tag.darkBg : tag.bg }]}>
        <Text style={pc.tagEmoji}>{tag.emoji}</Text>
        <Text style={[pc.tagLabel, { color: tag.color }]}>{t(tag.labelKey)}</Text>
      </View>

      {/* 作者行 */}
      <View style={pc.authorRow}>
        <View style={[pc.avatar, { backgroundColor: post.is_official ? Colors.rose400 : Colors.gray300 }]}>
          <Text style={pc.avatarTxt}>{nameInitial(post.author_name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={[pc.name, isDark && { color: C.gray900 }]}>{post.author_name}</Text>
            {post.is_official && <BadgeCheck size={13} color={Colors.rose400} />}
          </View>
          <Text style={[pc.time, isDark && { color: C.gray400 }]}>{timeAgo(post.created_at, t)}</Text>
        </View>
        {post.author_id === myId && (
          <TouchableOpacity onPress={() => onDelete(post._id)} hitSlop={10}>
            <Trash2 size={15} color={C.gray300} />
          </TouchableOpacity>
        )}
      </View>

      {/* 正文 */}
      <Text
        style={[pc.content, isDark && { color: C.gray800 }]}
        numberOfLines={textExpanded ? undefined : 4}
        onTextLayout={(e) => {
          if (!textClamped && e.nativeEvent.lines.length > 4) setTextClamped(true);
        }}
      >
        {post.content}
      </Text>
      {textClamped && (
        <TouchableOpacity onPress={() => setTextExpanded(p => !p)} hitSlop={6}>
          <Text style={{ fontSize: 13, color: Colors.rose400, fontWeight: "600", marginTop: 2 }}>
            {textExpanded ? t("community.showLess") : t("community.showMore")}
          </Text>
        </TouchableOpacity>
      )}

      {/* 图片 */}
      {post.image_url && (
        <TouchableOpacity
          onPress={() => onImagePress(post.image_url!)}
          activeOpacity={0.9}
          style={pc.imageWrap}
        >
          <Image source={{ uri: post.image_url }} style={pc.image} resizeMode="cover" />
        </TouchableOpacity>
      )}

      {/* 操作栏 */}
      <View style={pc.actions}>
        <TouchableOpacity onPress={() => onLike(post._id)} style={pc.actionBtn} hitSlop={8}>
          <Heart size={16} color={liked ? Colors.rose400 : C.gray400} fill={liked ? Colors.rose400 : "none"} />
          <Text style={[pc.count, liked && { color: Colors.rose400 }, isDark && !liked && { color: C.gray400 }]}>
            {post.likes.length}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setExpanded(p => !p)} style={pc.actionBtn} hitSlop={8}>
          <MessageCircle size={16} color={C.gray400} />
          <Text style={[pc.count, isDark && { color: C.gray400 }]}>{post.comment_count}</Text>
          {expanded ? <ChevronUp size={13} color={C.gray400} /> : <ChevronDown size={13} color={C.gray400} />}
        </TouchableOpacity>
      </View>

      {expanded && (
        <CommentSection postId={post._id} myId={myId} myName={myName} isDark={isDark} C={C} onImagePress={onImagePress} t={t} />
      )}
    </TouchableOpacity>
  );
}

// ─── 主页面 ───────────────────────────────────────────────
export default function CommunityScreen() {
  const { colors: C, isDark, shadow: S } = useAppTheme();
  const { user } = useUser();
  const { t } = useT();

  const [posts, setPosts]           = useState<Post[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTag, setActiveTag]   = useState<PostTag | "all">("all");

  const [showCompose, setShowCompose]   = useState(false);
  const [composeText, setComposeText]   = useState("");
  const [composeTag, setComposeTag]     = useState<PostTag>("help");
  const [composeImage, setComposeImage] = useState<{ uri: string; base64: string } | null>(null);
  const [posting, setPosting]           = useState(false);

  const [myName, setMyName] = useState("Anonymous");
  const [myId, setMyId]     = useState("guest");
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  useEffect(() => {
    loadIdentity();
    fetchPosts();
  }, []);

  async function loadIdentity() {
    const name = await AsyncStorage.getItem("@aurasight_user_name");
    const uid  = user?._id ?? (await AsyncStorage.getItem("@aurasight_guest_id")) ?? "guest";
    if (name) setMyName(name);
    setMyId(uid);
  }

  async function fetchPosts(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const r = await fetch(`${API_URL}/posts?limit=40`);
      setPosts(await r.json());
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  async function handleLike(postId: string) {
    setPosts(prev => prev.map(p => {
      if (p._id !== postId) return p;
      const liked = p.likes.includes(myId);
      return { ...p, likes: liked ? p.likes.filter(id => id !== myId) : [...p.likes, myId] };
    }));
    try {
      await fetch(`${API_URL}/posts/${postId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: myId }),
      });
    } catch { fetchPosts(); }
  }

  async function handleDelete(postId: string) {
    Alert.alert(t("community.deleteTitle"), t("community.deleteMsg"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"), style: "destructive",
        onPress: async () => {
          setPosts(prev => prev.filter(p => p._id !== postId));
          try {
            await fetch(`${API_URL}/posts/${postId}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_id: myId }),
            });
          } catch { fetchPosts(); }
        },
      },
    ]);
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("🖼️", "Please allow photo access to attach images."); // TODO: Add i18n key for permission alert
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setComposeImage({ uri: asset.uri, base64: asset.base64 ?? "" });
    }
  }

  async function handlePost() {
    if (!composeText.trim()) return;
    setPosting(true);
    try {
      const r = await fetch(`${API_URL}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_id:    myId,
          author_name:  myName,
          content:      composeText.trim(),
          tag:          composeTag,
          image_base64: composeImage?.base64 ?? undefined,
        }),
      });
      const newPost: Post = await r.json();
      setPosts(prev => [newPost, ...prev]);
      setComposeText("");
      setComposeTag("help");
      setComposeImage(null);
      setShowCompose(false);
    } catch {
      Alert.alert("Error", t("community.errorPost"));
    }
    setPosting(false);
  }

  // 本地筛选
  const filtered = activeTag === "all"
    ? posts
    : posts.filter(p => p.tag === activeTag || p.is_pinned);

  const renderPost = useCallback(({ item, index }: { item: Post; index: number }) => (
    <FadeInComponent delay={index * 60} duration={350} from="bottom">
      <View>
        <PostCard
          post={item} myId={myId} myName={myName}
          isDark={isDark} C={C}
          onLike={handleLike} onDelete={handleDelete}
          onImagePress={setLightboxUri} t={t}
        />
        {/* 每 3 个帖子后插一个广告 */}
        {(index + 1) % 3 === 0 && <AdBanner style={{ marginHorizontal: 16, marginBottom: 8 }} />}
      </View>
    </FadeInComponent>
  ), [myId, myName, isDark, C, t]);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={isDark ? [C.background, C.background] : ["#FFF3F6", "#FFFFFF"]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>

        {/* 顶栏 */}
        <LinearGradient colors={["#F43F8F", "#F472B6", "#FB9FBD"]} style={st.header}>
          <Text style={st.headerTitle}>{t("community.title")}</Text>
          <Text style={st.headerSub}>{t("community.sub")}</Text>
        </LinearGradient>

        {/* 标签筛选栏 */}
        <View style={[st.filterWrap, isDark && { backgroundColor: C.cardBg, borderBottomColor: C.gray200 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filterRow}>
            {/* All */}
            <TouchableOpacity
              onPress={() => setActiveTag("all")}
              style={[st.filterChip, activeTag === "all" && st.filterChipActive]}
              activeOpacity={0.7}
            >
              <Text style={[st.filterLabel, activeTag === "all" && st.filterLabelActive, isDark && activeTag !== "all" && { color: C.gray500 }]}>
                {t("community.filter.all")}
              </Text>
            </TouchableOpacity>
            {TAGS.map(tag => (
              <TouchableOpacity
                key={tag.id}
                onPress={() => setActiveTag(tag.id)}
                style={[st.filterChip,
                  activeTag === tag.id && { backgroundColor: tag.bg, borderColor: tag.color },
                  isDark && activeTag !== tag.id && { borderColor: C.gray300 },
                ]}
                activeOpacity={0.7}
              >
                <Text style={st.filterEmoji}>{tag.emoji}</Text>
                <Text style={[st.filterLabel,
                  activeTag === tag.id && { color: tag.color, fontWeight: "700" },
                  isDark && activeTag !== tag.id && { color: C.gray500 },
                ]}>
                  {t(tag.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Posts List */}
        {loading ? (
          <View style={{ marginTop: 60 }}>
            <LoadingSkeleton variant="list" count={3} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item._id}
            renderItem={renderPost}
            contentContainerStyle={st.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => fetchPosts(true)} tintColor={Colors.rose400} />
            }
            ListEmptyComponent={
              <EmptyState
                icon="🌸"
                title={t("community.empty")}
                subtitle={t("community.sub")}
                actionLabel={t("community.newPost")}
                onAction={() => setShowCompose(true)}
              />
            }
          />
        )}
      </SafeAreaView>

      {/* 浮动发帖按钮 */}
      <AnimatedPressable style={[st.fab, S.button]} onPress={() => setShowCompose(true)} scaleAmount={0.9}>
        <LinearGradient colors={["#F43F8F", "#F472B6"]} style={st.fabGrad}>
          <Plus size={22} color="#fff" strokeWidth={2.5} />
        </LinearGradient>
      </AnimatedPressable>

      {/* 发帖 Modal */}
      <Modal visible={showCompose} animationType="slide" transparent>
        <Pressable style={st.overlay} onPress={() => setShowCompose(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
            <Pressable style={[st.sheet, isDark && { backgroundColor: C.cardBg }]} onPress={() => {}}>
              <View style={[st.handle, isDark && { backgroundColor: C.gray300 }]} />

              <Text style={[st.sheetTitle, isDark && { color: C.gray900 }]}>{t("community.newPost")}</Text>
              <Text style={[st.sheetSub, isDark && { color: C.gray400 }]}>
                {t("community.postingAs")} <Text style={{ color: Colors.rose400, fontWeight: "700" }}>{myName}</Text>
              </Text>

              {/* 话题标签选择 */}
              <Text style={[st.tagPickerLabel, isDark && { color: C.gray500 }]}>{t("community.topic")}</Text>
              <View style={st.tagPickerRow}>
                {TAGS.map(tag => (
                  <TouchableOpacity
                    key={tag.id}
                    onPress={() => setComposeTag(tag.id)}
                    style={[st.tagOption,
                      composeTag === tag.id
                        ? { backgroundColor: tag.bg, borderColor: tag.color, borderWidth: 1.5 }
                        : { borderColor: isDark ? C.gray300 : "#f3f4f6" },
                      isDark && composeTag !== tag.id && { backgroundColor: C.gray200 },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={st.tagOptionEmoji}>{tag.emoji}</Text>
                    <Text style={[st.tagOptionLabel,
                      composeTag === tag.id ? { color: tag.color, fontWeight: "700" } : { color: isDark ? C.gray500 : Colors.gray500 },
                    ]}>
                      {t(tag.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 正文输入 */}
              <TextInput
                style={[st.input, isDark && { backgroundColor: C.gray200, color: C.gray900, borderColor: C.gray300 }]}
                placeholder={t(`community.placeholder.${composeTag}`)}
                placeholderTextColor={C.gray400}
                value={composeText}
                onChangeText={setComposeText}
                multiline
                maxLength={500}
                autoFocus
              />
              <Text style={[st.charCount, isDark && { color: C.gray400 }]}>{composeText.length}/500</Text>

              {/* 图片预览 */}
              {composeImage && (
                <View style={st.imgPreviewWrap}>
                  <Image source={{ uri: composeImage.uri }} style={st.imgPreview} resizeMode="cover" />
                  <TouchableOpacity style={st.imgRemoveBtn} onPress={() => setComposeImage(null)}>
                    <X size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              {/* 底部工具栏：选图 + 发布 */}
              <View style={st.composeFooter}>
                <TouchableOpacity
                  onPress={pickImage}
                  style={[st.imgPickBtn, isDark && { backgroundColor: C.gray200, borderColor: C.gray300 }]}
                  activeOpacity={0.7}
                >
                  <ImagePlus size={18} color={composeImage ? Colors.rose400 : Colors.gray400} />
                  <Text style={[st.imgPickLabel, composeImage && { color: Colors.rose400 }]}>
                    {composeImage ? t("community.changePhoto") : t("community.addPhoto")}
                  </Text>
                </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePost}
                disabled={posting || !composeText.trim()}
                style={[st.postBtn, (!composeText.trim() || posting) && { opacity: 0.5 }]}
                activeOpacity={0.8}
              >
                <LinearGradient colors={["#F43F8F", "#F472B6"]} style={st.postBtnGrad}>
                  {posting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={st.postBtnTxt}>{t("community.post")}</Text>}
                </LinearGradient>
              </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

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

// ─── 样式 ──────────────────────────────────────────────────
const st = StyleSheet.create({
  header:      { paddingHorizontal: Spacing.xl, paddingTop: 14, paddingBottom: 18 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: "800", color: "#fff" },
  headerSub:   { fontSize: FontSize.xs, color: "rgba(255,255,255,0.7)", marginTop: 2 },

  filterWrap: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingVertical: 10,
  },
  filterRow: { paddingHorizontal: Spacing.xl, gap: 8 },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1,
    borderColor: "#f3f4f6", backgroundColor: "#f9fafb",
  },
  filterChipActive: {
    backgroundColor: "#fdf2f8", borderColor: Colors.rose300,
  },
  filterEmoji: { fontSize: 12 },
  filterLabel: { fontSize: 12, fontWeight: "600", color: Colors.gray500 },
  filterLabelActive: { color: Colors.rose400, fontWeight: "700" },

  list:       { paddingHorizontal: Spacing.xl, paddingTop: 12, paddingBottom: 100 },
  empty:      { alignItems: "center", marginTop: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTxt:   { fontSize: FontSize.sm, color: Colors.gray400 },

  fab:     { position: "absolute", bottom: 28, right: 20, borderRadius: 28 },
  fabGrad: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 44,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#e5e7eb", alignSelf: "center", marginBottom: 18,
  },
  sheetTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.gray900 },
  sheetSub:   { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 2, marginBottom: 16 },

  tagPickerLabel: { fontSize: 11, fontWeight: "700", color: Colors.gray500, letterSpacing: 0.5, marginBottom: 8 },
  tagPickerRow:   { flexDirection: "row", gap: 8, marginBottom: 14 },
  tagOption: {
    flex: 1, alignItems: "center", gap: 4,
    paddingVertical: 10, borderRadius: Radius.md,
    borderWidth: 1, borderColor: "#f3f4f6",
    backgroundColor: "#f9fafb",
  },
  tagOptionEmoji: { fontSize: 18 },
  tagOptionLabel: { fontSize: 10, fontWeight: "600" },

  input: {
    borderWidth: 1, borderColor: "#f3f4f6",
    borderRadius: Radius.md, padding: 14,
    fontSize: FontSize.sm, color: Colors.gray800,
    backgroundColor: "#f9fafb",
    minHeight: 110, textAlignVertical: "top",
  },
  charCount: { fontSize: 10, color: Colors.gray300, textAlign: "right", marginTop: 4 },

  imgPreviewWrap: { marginTop: 10, borderRadius: 12, overflow: "hidden", position: "relative" },
  imgPreview:     { width: "100%", height: 160, borderRadius: 12 },
  imgRemoveBtn: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12, padding: 4,
  },

  composeFooter: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  imgPickBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: Radius.md, borderWidth: 1,
    borderColor: "#f3f4f6", backgroundColor: "#f9fafb",
  },
  imgPickLabel: { fontSize: 12, fontWeight: "600", color: Colors.gray400 },

  postBtn:     { flex: 1, borderRadius: Radius.lg, overflow: "hidden" },
  postBtnGrad: { paddingVertical: 13, alignItems: "center" },
  postBtnTxt:  { fontSize: FontSize.sm, fontWeight: "800", color: "#fff" },
});

// ─── 帖子卡片样式 ─────────────────────────────────────────
const pc = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 18, marginBottom: 12,
    padding: 16, borderWidth: 1, borderColor: "#fce7f3",
    shadowColor: "#f472b6", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  pinned:   { borderColor: Colors.rose300, backgroundColor: "#fff8fa" },
  pinnedDk: { borderColor: "#5c2240" },
  pinnedRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  pinnedTxt: { fontSize: 10, color: Colors.rose400, fontWeight: "700" },

  tagPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full, marginBottom: 10,
  },
  tagEmoji: { fontSize: 11 },
  tagLabel: { fontSize: 11, fontWeight: "700" },

  authorRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  avatar:    { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },
  name:      { fontSize: FontSize.sm, fontWeight: "700", color: Colors.gray800 },
  time:      { fontSize: 10, color: Colors.gray400, marginTop: 1 },

  content: { fontSize: FontSize.sm, color: Colors.gray700, lineHeight: 20, marginBottom: 10 },

  imageWrap: { borderRadius: 12, overflow: "hidden", marginBottom: 12 },
  image:     { width: "100%", height: 200, borderRadius: 12 },

  actions:   { flexDirection: "row", gap: 20 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  count:     { fontSize: 12, color: Colors.gray500, fontWeight: "600" },
});

// ─── 评论区样式 ───────────────────────────────────────────
const cs = StyleSheet.create({
  wrap:     { marginTop: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 12 },
  empty:    { fontSize: 12, color: Colors.gray400, textAlign: "center", marginBottom: 10 },
  row:      { flexDirection: "row", gap: 8, marginBottom: 10 },
  avatar:   { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontSize: 11, fontWeight: "800", color: "#fff" },
  name:     { fontSize: 11, fontWeight: "700", color: Colors.gray800 },
  time:     { fontSize: 10, color: Colors.gray400 },
  text:     { fontSize: 12, color: Colors.gray600, lineHeight: 16, marginTop: 1 },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end",
    borderWidth: 1, borderColor: "#f3f4f6",
    borderRadius: Radius.md, padding: 8,
    backgroundColor: "#f9fafb", marginTop: 6, gap: 8,
  },
  input:    { flex: 1, fontSize: 12, color: Colors.gray800, maxHeight: 80, textAlignVertical: "top" },
  commentImage: { width: "100%", height: 140, borderRadius: 10, marginTop: 6 },
  imgPreviewRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 6, marginBottom: 4,
  },
  imgThumb: { width: 60, height: 60, borderRadius: 8 },
});
