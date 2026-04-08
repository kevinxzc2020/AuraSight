# AuraSight — Development Progress Log

## Project Overview

A 30-day skin and body transformation tracking mobile app built with React Native (Expo), Express.js, and MongoDB Atlas. Features acne detection, body shape monitoring, AI-powered analysis, and a gamified daily task system.

**Tech Stack:** React Native (Expo) · Express.js · MongoDB Atlas · TFLite (planned)
**Repo:** github.com/kevinxzc2020/AuraSight
**Structure:** Monorepo → `AuraSight-FrontEnd/` + `AuraSight-api/`

---

## Session 1 — 2025-03-27

### ✅ Project Foundation

Set up the monorepo structure at `Documents/AuraSight/` with two subfolders. Initialized the Expo project (`AuraSight-FrontEnd`) using `create-expo-app` with the blank TypeScript template. Created the Express backend (`AuraSight-api`) with a clean `src/index.js` entry point.

### ✅ Design System

Used v0.dev (Vercel) to prototype the UI in Next.js, then manually translated the design into a React Native design system (`constants/theme.ts`). Extracted all colors, spacing, radii, font sizes, shadow presets, and acne-type color mapping from the v0 components. The rose/pink aesthetic is fully captured in theme constants so every screen stays visually consistent.

### ✅ Four Core Screens (UI)

Translated all four v0 screens into React Native components using `expo-linear-gradient`, `react-native-svg`, and `lucide-react-native`. Each screen matches the v0 design: Home Dashboard, Camera/Scan, History/Calendar, and AI Report. Added a bottom Tab Navigator via `expo-router`.

### ✅ MongoDB Atlas Connection

Created a new database user `aurasight` in MongoDB Atlas (Cluster0). Confirmed the `AuraSight` database and `scans` collection exist. Built a custom Express backend (replacing the deprecated MongoDB Data API) that connects via the official Node.js driver. The health check endpoint at `GET /` returns `{"status":"ok"}`.

### ✅ Express Backend — Scans API

Implemented the following REST endpoints in `AuraSight-api/src/index.js`:
`POST /scans` saves a new scan record with auto-calculated `skin_status` and `skin_score`. `GET /scans/:userId` returns the last 30 days of records. `GET /scans/:userId/today` returns today's scan if it exists. `GET /scans/:userId/stats` returns aggregated stats including streak, week-over-week change, acne breakdown, and a calendar array. `DELETE /scans/:id` removes a record by ID.

### ✅ Camera Screen — Real Photo Capture

Integrated `expo-camera`, `expo-image-picker`, and `expo-media-library`. The camera screen supports front/back toggle, flash control, face alignment guide overlay, body zone selector (face only), and a side button to pick from the photo library. On capture, the photo URI and scan metadata are saved to MongoDB via the Express API. Offline fallback saves to `AsyncStorage` and syncs when the network returns.

### ✅ History Screen — Real Data

Connected the History page to the live API using `useFocusEffect` so data refreshes every time the user navigates to the tab. The calendar renders real scan dates with color-coded dots (green = clear, yellow = mild, red = breakout). Today's date is highlighted with a rose circle.

### ✅ Swipeable Scan Cards + Detail Page

Built a `SwipeableScanCard` component using `PanResponder` that reveals a red delete button on left swipe. Tapping a card navigates to `app/scan/[id].tsx`, a detail page showing the full photo, skin score, condition breakdown, and a basic AI insight. Delete works from both the swipe action and a trash button on the detail page.

### ✅ User Auth (Register / Login)

Added `POST /auth/register` and `POST /auth/login` to the backend using SHA-256 password hashing (MVP-grade, bcrypt planned for production). The Profile screen (`app/(tabs)/profile.tsx`) shows a Sign In / Sign Up form for guests and a user info card with VIP upsell for registered users. Login state is persisted in `AsyncStorage`. The Home screen refreshes on focus and displays the user's name once logged in, hiding the "Sign In" button.

---

## Session 2 — 2026-03-29

### ✅ Gamified Daily Task System

Replaced the "30-day completion percentage" ring with a daily task system. Users earn 50 points for scanning their face and 50 points for scanning their body, for a maximum of 100 points per day. The progress ring now shows today's earned points out of 100. Added streak tracking with bonus points at 3-day (+20), 7-day (+50), and 30-day (+200) milestones. Implemented a milestone unlock system: 100 pts unlocks Trend Chart, 300 pts unlocks Cause Report, 500 pts unlocks PDF Export, and 1000 pts unlocks a VIP Trial.

Backend additions: `GET /points/:userId` returns current points, streak, today's task status, and unlocked milestones. `POST /points/:userId/task` awards points for completing a face or body scan, with duplicate-prevention logic so the same task can only be completed once per day.

### ✅ Home Screen Redesign

Rebuilt the Home screen around the task system. The new layout has a points overview card (total points + next milestone progress bar), the daily task progress ring, a Daily Tasks card with yesterday's scan thumbnails, and the three core skin stats (Spots, Skin Score, Total Scans). The acne type breakdown (Pustule/Broken/Scab/Redness) is hidden when all values are zero and replaced with an "AI Skin Analysis — X more scans to unlock" placeholder card. Removed the redundant Beauty Insight card that conflicted with the AI placeholder. Added a guest banner prompting sign-up.

### ✅ Camera → Points Integration

Updated `handleSave` in the camera screen to call `POST /points/:userId/task` immediately after saving a scan. The task type is automatically inferred from the selected body zone: `back` and `chest` zones count as a body task, all face zones count as a face task. The success alert now shows points earned and current streak.

### ✅ Report Screen — Real Data + VIP Design

Added a new `GET /scans/:userId/report` endpoint that returns daily score history (for the line chart), score change percentage, acne breakdown totals, first/latest scan photos for before-after comparison, and a formatted date range string.

The Report screen now shows real data across four sections: a skin score trend line chart (SVG, built from actual daily scores), a condition breakdown donut chart, a before-and-after photo comparison with score delta badge, and a Deep Analysis section. For free users, the Deep Analysis section shows a blurred preview of mock VIP insights (weather correlation, hormonal patterns, hydration impact) behind a gradient overlay, with an "Unlock with VIP" button. VIP users see the feature list and a "Coming Soon" notice since the full AI pipeline is Phase 5.

---

---

## Session 3 — 2026-04-06

### ✅ Onboarding Flow

Built a 4-page dark-themed onboarding screen (`app/onboarding.tsx`) with horizontal swipe navigation using `Animated.ScrollView`. Each page has an emoji hero, animated title and subtitle (spring entry animation), and a shared `scrollX` value that drives the progress dot indicator and per-page scale/opacity transitions. The progress dots use `scaleX` transform instead of `width` animation to avoid a native driver conflict with the scroll event. The final page has two CTAs: "Create Account" (routes to profile) and "Explore as Guest" (routes to tabs). Completion sets `@aurasight_onboarding_done` in AsyncStorage. The `MilestonePreview` component on page 3 uses static `View` elements rather than `Animated.View` to avoid the `width` property conflict with `useNativeDriver: true`.

### ✅ Routing Architecture Fix

Resolved the "Attempted to navigate before mounting the Root Layout" error that had been causing crashes on cold start. The root cause was navigation logic placed in `_layout.tsx` and `app/(tabs)/_layout.tsx`, both of which execute before the navigator is mounted. The fix uses a minimal `app/index.tsx` as the true app entry point: it renders `null` during an async AsyncStorage check, then calls `router.replace` only after the check resolves — by which time the navigator is fully mounted. Both layout files were stripped of all navigation logic and reduced to their minimal forms (`<Stack>` and `<Tabs>` only).

### ✅ Weekly Insight Card (Home Screen)

Added a `WeeklyInsightCard` component to the Home screen. It displays a dark-background card (visually distinct from the rest of the light page) with a personalized one-sentence summary of the user's skin performance this week, three stat chips (avg score, score vs last week, scans), a "Free insight" badge, and a "Full report → VIP ✦" CTA linking to the VIP page. The card data comes from a new `GET /insights/:userId/weekly` backend endpoint that uses a rule engine to generate the insight text based on scan counts and score deltas rather than a real AI model.

### ✅ Home Screen Copy Upgrade

Changed "Daily Tasks" to "Daily Check-in" and replaced the flat task labels ("Scan your face") with emotionally warmer language: "How's your skin today?" for the face task and "Quick body check-in" for the body task. Subtitle copy was updated from "+50 pts" to "+50 pts · 30-second face scan" and "+50 pts · tracks shape & progress" to reduce the transactional feel.

### ✅ Skin Diary (Scan Detail Page)

Added a Skin Diary section to `app/scan/[id].tsx`. Users can select from 10 quick-tap tags (Poor sleep, Good sleep, Drank a lot, Stressed, Exercised, Oily food, Healthy food, Period, New skincare, Outdoors all day) and write a free-text note. Selections are saved immediately via a new `PATCH /scans/:id/diary` backend endpoint that stores `diary_note` and `diary_tags` fields on the scan document. A `KeyboardAvoidingView` wrapper prevents the input from being obscured by the software keyboard. Existing diary data is pre-populated when revisiting a scan. A "Saved" badge appears after successful saves.

### ✅ Backend — New Endpoints

Added `GET /insights/:userId/weekly` which queries this week's and last week's scans, computes average scores and scan counts, and runs them through a multi-branch rule engine that generates contextually appropriate insight text (12 different message variants). Added `PATCH /scans/:id/diary` which updates a scan document with diary tags and a free-text note.

---

## Session 4 — 2026-04-07

### ✅ VIP Upgrade Page

Built `app/vip.tsx` as a full-screen standalone page (no tab bar). The page has a dark gradient Hero section with the app icon, tagline, and a "Try free for 7 days · Cancel anytime" badge. Below the hero are five feature rows (Deep AI report, Permanent photo storage, 4K timelapse, Zero ads, Unlimited history) each with a check mark. Three pricing tiers are displayed as selectable cards: 30-Day Challenge ($9.99 one-time, no trial), Annual Plan ($34.99/yr at $2.99/mo, BEST VALUE badge, 7-day trial), and Monthly Plan ($4.99/mo, 7-day trial). The CTA button text updates dynamically based on the selected plan — "Start 7-day free trial ✦" for subscription plans and "Start my 30-day challenge ✦" for the one-time pack. Sub-text below the CTA reads "Free for 7 days · then $X · auto-renews · cancel anytime" to comply with App Store disclosure requirements. Payment is currently an Alert placeholder; RevenueCat integration is queued for the Development Build phase.

### ✅ Settings Page

Built `app/settings.tsx` as a standalone page accessible from a gear icon in the Profile tab header. The page has a dark Hero section displaying the user's avatar initial, name, email, and account type badge (Free/VIP/Guest), plus a "Try VIP free for 7 days" banner for non-VIP users. Content is organized into six groups: Skin Goals (five tappable chips that persist to AsyncStorage and will influence AI analysis), Notifications (daily reminder toggle, placeholder pending Development Build), Privacy & Security (Face ID toggle placeholder, Privacy Policy and Terms links), Personalization (language and appearance placeholders for Phase 2), Help & Feedback (Rate AuraSight and Send Feedback via mailto), and About (version number). A danger zone at the bottom offers Sign Out and Delete Account (with double-confirmation alert) for logged-in users.

### ✅ History Page Redesign

Rebuilt `app/(tabs)/history.tsx` from scratch with three major functional and visual upgrades. The top of the page now features a dark gradient Month Hero card showing the number of days scanned that month out of the total, average skin score, total scans, and day streak — giving users an immediate sense of achievement when they open the page. The calendar was upgraded so that days with scan records display the actual skin score number (e.g. "94") rather than a colored dot, colored green for 90+, amber for 70–89, and rose for below 70. Each calendar day with data is tappable and navigates directly to that scan's detail page. The 30-day bar chart was replaced with an SVG polyline chart drawn from actual skin score values; the chart auto-labels the last score, includes dashed reference lines, and shows an "↗ Improving" or "↘ Declining" badge based on the trend of the last three data points versus the first three.

### ✅ Report Page Redesign

Rebuilt `app/(tabs)/report.tsx` using a chapter-narrative structure that reorganizes the page around emotional impact rather than data modules. Chapter 1 (Before/After Hero) is now at the top: the first and latest scan photos sit side-by-side with score chips overlaid and a change bubble in the center showing the percentage delta. Below the photos, a rule-engine-generated summary sentence gives a personalized reading of the user's progress (12 variants based on scan count, score change magnitude, and direction). Chapter 2 presents three stat chips followed by the SVG score trend line chart with a gradient fill area. Chapter 3 is a Diary Patterns card that hints at upcoming lifestyle correlation analysis and prompts users to keep logging entries. Chapter 4 replaces the blurred-content VIP wall with a transparent preview card: the feature names are visible but the descriptions are rendered in near-white text, communicating "locked" without aggressive content suppression, and a 7-day trial CTA closes the page.

---

## What's Next

The remaining UI/UX work before technical integrations consists of the App Icon and Splash Screen (requires asset preparation). After those are done, the Development Build phase begins, which will unlock AdMob ads, push notifications via expo-notifications, Face ID via expo-local-authentication, and the TFLite AI model for real acne detection. Chinese localization is planned as a later phase after the English version ships.

---

## Known Issues / Technical Debt

The local IP address in `.env` (`EXPO_PUBLIC_API_URL`) must be manually updated each session when the development machine changes networks — the two-machine workflow (work laptop + home desktop) makes this a recurring friction point. The password hashing uses SHA-256 rather than bcrypt; this must be upgraded before production. The `image_uri` stored in MongoDB is a local device path, meaning photos are inaccessible across devices or after reinstall; S3 or equivalent cloud storage is required for the VIP permanent storage feature. The MongoDB Atlas password is currently exposed in the connection string and should be rotated before any public release.
