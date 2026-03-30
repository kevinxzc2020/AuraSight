import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { User, Mail, Lock, LogOut, ChevronRight, Crown } from 'lucide-react-native'
import { Colors, Gradients, Spacing, Radius, FontSize, Shadow } from '../../constants/theme'
import AsyncStorage from '@react-native-async-storage/async-storage'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.59:3000'

interface AppUser {
  id:    string
  name:  string
  email: string
  mode:  'guest' | 'registered' | 'vip'
}

export default function ProfileScreen() {
  const [user, setUser]         = useState<AppUser | null>(null)
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'login' | 'register'>('login')
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    try {
      const mode = await AsyncStorage.getItem('@aurasight_user_mode')
      if (mode === 'registered' || mode === 'vip') {
        const id    = await AsyncStorage.getItem('@aurasight_user_id')   ?? ''
        const uname = await AsyncStorage.getItem('@aurasight_user_name') ?? ''
        const uemail = await AsyncStorage.getItem('@aurasight_user_email') ?? ''
        setUser({ id, name: uname, email: uemail, mode: mode as any })
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields.')
      return
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.')
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Registration failed')

      await _saveUser(data)
      Alert.alert('✅ Welcome!', `Account created for ${name}`)
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password.')
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Login failed')

      await _saveUser(data)
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function _saveUser(data: any) {
    await AsyncStorage.setItem('@aurasight_user_id',    data.id)
    await AsyncStorage.setItem('@aurasight_user_name',  data.name)
    await AsyncStorage.setItem('@aurasight_user_email', data.email)
    await AsyncStorage.setItem('@aurasight_user_mode',  'registered')
    setUser({ id: data.id, name: data.name, email: data.email, mode: 'registered' })
  }

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          await AsyncStorage.multiRemove([
            '@aurasight_user_mode',
            '@aurasight_user_name',
            '@aurasight_user_email',
          ])
          setUser(null)
        }
      }
    ])
  }

  if (loading) {
    return (
      <LinearGradient colors={['#fff5f5', '#ffffff']} style={styles.center}>
        <ActivityIndicator size="large" color={Colors.rose400} />
      </LinearGradient>
    )
  }

  // ─── 已登录 ───────────────────────────────────────────────
  if (user) {
    return (
      <LinearGradient colors={['#fff5f5', '#ffffff']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>

            {/* 头像 + 名字 */}
            <View style={styles.avatarSection}>
              <LinearGradient colors={Gradients.roseMain} style={styles.avatar}>
                <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
              {user.mode === 'vip' && (
                <View style={styles.vipTag}>
                  <Crown size={12} color="#fde68a" />
                  <Text style={styles.vipTagText}>VIP Member</Text>
                </View>
              )}
            </View>

            {/* VIP 升级卡 */}
            {user.mode !== 'vip' && (
              <LinearGradient colors={['#f472b6', '#fb7185']} style={styles.vipCard}>
                <Crown size={20} color="#fde68a" />
                <View style={styles.vipCardText}>
                  <Text style={styles.vipCardTitle}>Upgrade to VIP</Text>
                  <Text style={styles.vipCardSub}>Deep reports · Unlimited storage · 4K export</Text>
                </View>
                <ChevronRight size={20} color="#fff" />
              </LinearGradient>
            )}

            {/* 设置列表 */}
            <View style={[styles.section, Shadow.card]}>
              <View style={styles.sectionItem}>
                <User size={16} color={Colors.gray400} />
                <Text style={styles.sectionLabel}>Name</Text>
                <Text style={styles.sectionValue}>{user.name}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.sectionItem}>
                <Mail size={16} color={Colors.gray400} />
                <Text style={styles.sectionLabel}>Email</Text>
                <Text style={styles.sectionValue}>{user.email}</Text>
              </View>
            </View>

            {/* 登出 */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <LogOut size={16} color={Colors.red} />
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>

          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    )
  }

  // ─── 未登录 ───────────────────────────────────────────────
  return (
    <LinearGradient colors={['#fff5f5', '#ffffff']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent}>

            {/* Logo */}
            <View style={styles.logoSection}>
              <LinearGradient colors={Gradients.roseMain} style={styles.logoCircle}>
                <Text style={styles.logoText}>✨</Text>
              </LinearGradient>
              <Text style={styles.logoTitle}>AuraSight</Text>
              <Text style={styles.logoSub}>Track your skin & body transformation</Text>
            </View>

            {/* Tab 切换 */}
            <View style={styles.tabRow}>
              {(['login', 'register'] as const).map((t) => (
                <TouchableOpacity key={t} style={styles.tabItem} onPress={() => setTab(t)}>
                  <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                    {t === 'login' ? 'Sign In' : 'Sign Up'}
                  </Text>
                  {tab === t && <View style={styles.tabUnderline} />}
                </TouchableOpacity>
              ))}
            </View>

            {/* 表单 */}
            <View style={[styles.form, Shadow.card]}>
              {tab === 'register' && (
                <View style={styles.inputWrap}>
                  <User size={16} color={Colors.gray400} />
                  <TextInput
                    style={styles.input}
                    placeholder="Your name"
                    placeholderTextColor={Colors.gray300}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              )}

              <View style={styles.inputWrap}>
                <Mail size={16} color={Colors.gray400} />
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor={Colors.gray300}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputWrap}>
                <Lock size={16} color={Colors.gray400} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={Colors.gray300}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                onPress={tab === 'login' ? handleLogin : handleRegister}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <LinearGradient colors={Gradients.roseMain} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtn}>
                  {submitting
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.submitText}>{tab === 'login' ? 'Sign In' : 'Create Account'}</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* 游客继续 */}
            <Text style={styles.guestNote}>
              Continue as guest — your data stays on this device only
            </Text>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  safeArea:      { flex: 1 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },

  // 已登录
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xxl },
  avatar:        { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  avatarText:    { fontSize: 36, color: '#fff', fontWeight: '700' },
  profileName:   { fontSize: FontSize.xl, fontWeight: '700', color: Colors.gray800 },
  profileEmail:  { fontSize: FontSize.sm, color: Colors.gray400, marginTop: 4 },
  vipTag:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fde68a20', borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4, marginTop: 8 },
  vipTagText:    { fontSize: FontSize.xs, color: '#d97706', fontWeight: '600' },

  vipCard:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.lg },
  vipCardText:  { flex: 1 },
  vipCardTitle: { color: '#fff', fontWeight: '700', fontSize: FontSize.base },
  vipCardSub:   { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.xs, marginTop: 2 },

  section:      { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.lg },
  sectionItem:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  sectionLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.gray500 },
  sectionValue: { fontSize: FontSize.sm, color: Colors.gray800, fontWeight: '500' },
  divider:      { height: 1, backgroundColor: Colors.gray100, marginVertical: Spacing.md },

  logoutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg },
  logoutText: { color: Colors.red, fontSize: FontSize.base, fontWeight: '600' },

  // 未登录
  logoSection: { alignItems: 'center', paddingVertical: Spacing.xxl },
  logoCircle:  { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  logoText:    { fontSize: 32 },
  logoTitle:   { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.gray800 },
  logoSub:     { fontSize: FontSize.sm, color: Colors.gray400, marginTop: 4, textAlign: 'center' },

  tabRow:       { flexDirection: 'row', marginBottom: Spacing.xl },
  tabItem:      { flex: 1, alignItems: 'center', paddingBottom: Spacing.sm },
  tabText:      { fontSize: FontSize.base, color: Colors.gray400, fontWeight: '500' },
  tabTextActive:{ color: Colors.rose400, fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, backgroundColor: Colors.rose400, borderRadius: 1 },

  form:        { backgroundColor: Colors.white, borderRadius: Radius.xxl, padding: Spacing.xl, marginBottom: Spacing.lg, gap: Spacing.md },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.gray100, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  input:       { flex: 1, fontSize: FontSize.base, color: Colors.gray800 },
  submitBtn:   { borderRadius: Radius.xl, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm },
  submitText:  { color: '#fff', fontSize: FontSize.base, fontWeight: '700' },

  guestNote:   { textAlign: 'center', fontSize: FontSize.xs, color: Colors.gray400, lineHeight: 18 },
})