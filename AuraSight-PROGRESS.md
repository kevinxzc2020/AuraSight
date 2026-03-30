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

## What's Next

The immediate priority is completing the TFLite AI acne analysis integration, which is the core differentiating feature of the product. After that, the History screen has some remaining static elements (the sparkline chart) that should be connected to real data. The advertising system and VIP payment flow are next in line. Railway deployment (to eliminate the local IP switching friction) is deferred by choice but should be addressed before any external testing or App Store submission.

---

## Known Issues / Technical Debt

The local IP address in `.env` (`EXPO_PUBLIC_API_URL`) must be manually updated each time the development machine changes networks. This is a known friction point. The password hashing uses SHA-256 rather than bcrypt — this is acceptable for MVP but must be upgraded before production. The `image_uri` stored in MongoDB is a local device path, which means photos are not accessible across devices or after app reinstall; cloud image storage (S3 or similar) is needed for the VIP permanent storage feature.
