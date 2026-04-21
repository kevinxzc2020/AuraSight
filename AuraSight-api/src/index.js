require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const BCRYPT_ROUNDS = 12;
const { v2: cloudinary } = require("cloudinary");

// ─── Cloudinary 配置 ──────────────────────────────────────
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * 把 base64 图片上传到 Cloudinary，返回 secure_url。
 * 如果 Cloudinary 未配置或上传失败，返回 null（不影响主流程）。
 */
async function uploadToCloudinary(base64Image, userId) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) return null;
  try {
    const dataUri = `data:image/jpeg;base64,${base64Image}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: `aurasight/${userId}`,
      resource_type: "image",
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    });
    return result.secure_url;
  } catch (err) {
    console.warn("⚠️  Cloudinary upload failed:", err.message);
    return null;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "10mb" })); // 图片 base64 可能较大

// ─── MongoDB 连接 ─────────────────────────────────────────
let db;
const client = new MongoClient(process.env.MONGODB_URI);

async function connectDB() {
  try {
    // ⚠️  安全检查：如果 MONGODB_URI 包含明文密码暴露风险就警告
    const uri = process.env.MONGODB_URI ?? "";
    if (uri.includes("@") && process.env.NODE_ENV === "production") {
      console.warn("⚠️  WARNING: MONGODB_URI contains credentials. Rotate the Atlas password before public release.");
    }
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "your_api_key_here") {
      console.warn("⚠️  WARNING: ANTHROPIC_API_KEY is not set.");
    }
    await client.connect();
    db = client.db(process.env.DB_NAME ?? "AuraSight");
    console.log("✅ MongoDB connected:", process.env.DB_NAME);
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}

// ─── 工具函数 ─────────────────────────────────────────────
function scansCollection() {
  return db.collection("scans");
}

function pointsCollection() {
  return db.collection("points");
}

function calcSkinStatus(detections) {
  const total = (detections ?? []).length;
  if (total === 0) return "clear";
  const scabCount = (detections ?? []).filter(d => d.acne_type === "scab").length;
  const activeCount = total - scabCount;
  // Mostly scabs and few active = healing/recovering
  if (scabCount >= 1 && scabCount >= activeCount && activeCount <= 3) return "healing";
  if (total <= 5) return "mild";
  return "breakout";
}

function calcSkinScore(detections) {
  if (!detections || detections.length === 0) return 100;
  const weights = { pustule: 4, broken: 5, redness: 2, scab: 1 };
  const deduction = detections.reduce((sum, d) => {
    return sum + (weights[d.acne_type] ?? 3) * (d.confidence ?? 1);
  }, 0);
  return Math.max(0, Math.round(100 - deduction));
}

// 计算连续打卡天数奖励积分
function calcStreakBonus(streak) {
  if (streak >= 30) return 200;
  if (streak >= 7) return 50;
  if (streak >= 3) return 20;
  return 0;
}

// 检查积分里程碑解锁
function checkMilestones(totalPoints) {
  const milestones = [
    { points: 100, reward: "30-Day Trend Chart" },
    { points: 300, reward: "Acne Cause Report" },
    { points: 500, reward: "PDF Export" },
    { points: 1000, reward: "VIP Trial (3 days)" },
  ];
  return milestones.filter((m) => totalPoints >= m.points);
}

// ─── Routes ───────────────────────────────────────────────

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", app: "AuraSight API", version: "1.0.0" });
});

// ── Points ────────────────────────────────────────────────

/**
 * GET /points/:userId
 * 获取用户积分、今日任务状态、连续天数、已解锁里程碑
 */
app.get("/points/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // 获取积分记录
    let record = await pointsCollection().findOne({ user_id: userId });
    if (!record) {
      record = {
        user_id: userId,
        total_points: 0,
        streak: 0,
        last_scan_date: null,
        tasks_today: { face: false, body: false },
        unlocked: [],
      };
    }

    // 检查今日任务是否已重置（新的一天）
    const today = new Date().toISOString().split("T")[0];
    const lastDate = record.last_scan_date
      ? new Date(record.last_scan_date).toISOString().split("T")[0]
      : null;

    if (lastDate !== today) {
      record.tasks_today = { face: false, body: false };
    }

    res.json({
      total_points: record.total_points,
      streak: record.streak,
      tasks_today: record.tasks_today,
      unlocked: checkMilestones(record.total_points),
      today_pts:
        (record.tasks_today.face ? 50 : 0) + (record.tasks_today.body ? 50 : 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /points/:userId/task
 * 完成任务，增加积分
 * body: { task_type: 'face' | 'body' }
 */
app.post("/points/:userId/task", async (req, res) => {
  try {
    const { userId } = req.params;
    const { task_type } = req.body; // 'face' | 'body'

    if (!["face", "body"].includes(task_type)) {
      return res.status(400).json({ error: "task_type must be face or body" });
    }

    const today = new Date().toISOString().split("T")[0];
    let record = await pointsCollection().findOne({ user_id: userId });

    if (!record) {
      record = {
        user_id: userId,
        total_points: 0,
        streak: 0,
        last_scan_date: null,
        tasks_today: { face: false, body: false },
        unlocked: [],
      };
    }

    // 检查今日任务是否已重置
    const lastDate = record.last_scan_date
      ? new Date(record.last_scan_date).toISOString().split("T")[0]
      : null;
    if (lastDate !== today) {
      record.tasks_today = { face: false, body: false };
    }

    // 如果这个任务今天已经完成，不重复加分
    if (record.tasks_today[task_type]) {
      return res.json({
        total_points: record.total_points,
        streak: record.streak,
        tasks_today: record.tasks_today,
        points_earned: 0,
        message: "Task already completed today",
      });
    }

    // 计算积分
    let pointsEarned = 50; // 基础任务积分

    // 更新连续打卡天数
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (lastDate === yesterdayStr) {
      record.streak += 1;
    } else if (lastDate !== today) {
      record.streak = 1;
    }

    // 连续打卡奖励（只在今天第一次任务时给）
    const isFirstTaskToday =
      !record.tasks_today.face && !record.tasks_today.body;
    if (isFirstTaskToday) {
      pointsEarned += calcStreakBonus(record.streak);
    }

    // 更新记录
    record.tasks_today[task_type] = true;
    record.total_points += pointsEarned;
    record.last_scan_date = new Date();

    // 保存到 MongoDB
    await pointsCollection().updateOne(
      { user_id: userId },
      { $set: record },
      { upsert: true },
    );

    res.json({
      total_points: record.total_points,
      streak: record.streak,
      tasks_today: record.tasks_today,
      points_earned: pointsEarned,
      unlocked: checkMilestones(record.total_points),
      today_pts:
        (record.tasks_today.face ? 50 : 0) + (record.tasks_today.body ? 50 : 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Scans ─────────────────────────────────────────────────

/**
 * POST /scans
 * 保存今日扫描记录
 */
app.post("/scans", async (req, res) => {
  try {
    const { user_id, scan_date, body_zone, detections, image_uri, image_base64, notes } =
      req.body;

    if (!user_id || !scan_date || !body_zone) {
      return res.status(400).json({
        error: "Missing required fields: user_id, scan_date, body_zone",
      });
    }

    // 如果前端传了 base64 图片，上传到 Cloudinary 拿云端 URL
    let finalImageUri = image_uri ?? null;
    if (image_base64 && process.env.CLOUDINARY_CLOUD_NAME) {
      const cloudUrl = await uploadToCloudinary(image_base64, user_id);
      if (cloudUrl) finalImageUri = cloudUrl;
    }

    const record = {
      user_id,
      scan_date: new Date(scan_date),
      body_zone,
      detections: detections ?? [],
      image_uri: finalImageUri,
      notes: notes ?? null,
      total_count: (detections ?? []).length,
      skin_status: calcSkinStatus(detections ?? []),
      skin_score: calcSkinScore(detections ?? []),
      created_at: new Date(),
    };

    const result = await scansCollection().insertOne(record);
    res.status(201).json({ ...record, _id: result.insertedId });
  } catch (err) {
    console.error("POST /scans error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /scans/:userId
 * 获取用户最近 30 天记录
 */
app.get("/scans/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days ?? "30");

    const since = new Date();
    since.setDate(since.getDate() - days);

    const scans = await scansCollection()
      .find({
        user_id: userId,
        scan_date: { $gte: since },
      })
      .sort({ scan_date: -1 })
      .limit(days)
      .toArray();

    res.json(scans);
  } catch (err) {
    console.error("GET /scans error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /scans/:userId/today
 * 获取今日扫描
 */
app.get("/scans/:userId/today", async (req, res) => {
  try {
    const { userId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const scan = await scansCollection().findOne({
      user_id: userId,
      scan_date: { $gte: today, $lt: tomorrow },
    });

    res.json(scan ?? null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /scans/:userId/stats
 * 获取30天统计数据（给首页用）
 */
app.get("/scans/:userId/stats", async (req, res) => {
  try {
    const { userId } = req.params;

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const scans = await scansCollection()
      .find({ user_id: userId, scan_date: { $gte: since } })
      .sort({ scan_date: -1 })
      .toArray();

    if (scans.length === 0) {
      return res.json({
        total_scans: 0,
        streak: 0,
        avg_skin_score: 100,
        latest_count: 0,
        week_change: 0,
        acne_breakdown: { pustule: 0, broken: 0, scab: 0, redness: 0 },
      });
    }

    // 计算 streak
    let streak = 0;
    let expected = new Date();
    expected.setHours(0, 0, 0, 0);
    for (const scan of scans) {
      const d = new Date(scan.scan_date);
      d.setHours(0, 0, 0, 0);
      const diff = (expected - d) / (1000 * 60 * 60 * 24);
      if (diff <= 1) {
        streak++;
        expected = d;
      } else break;
    }

    // 本周 vs 上周变化
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeek = scans.filter((s) => new Date(s.scan_date) >= weekAgo);
    const lastWeek = scans.filter((s) => {
      const d = new Date(s.scan_date);
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      return d >= twoWeeksAgo && d < weekAgo;
    });
    const thisAvg = thisWeek.length
      ? thisWeek.reduce((s, r) => s + r.total_count, 0) / thisWeek.length
      : 0;
    const lastAvg = lastWeek.length
      ? lastWeek.reduce((s, r) => s + r.total_count, 0) / lastWeek.length
      : 0;
    const weekChange = Math.round(thisAvg - lastAvg);

    // 痘痘类型汇总
    const breakdown = { pustule: 0, broken: 0, scab: 0, redness: 0 };
    for (const scan of scans) {
      for (const d of scan.detections ?? []) {
        if (breakdown[d.acne_type] !== undefined) breakdown[d.acne_type]++;
      }
    }

    res.json({
      total_scans: scans.length,
      streak,
      avg_skin_score: Math.round(
        scans.reduce((s, r) => s + r.skin_score, 0) / scans.length,
      ),
      latest_count: scans[0]?.total_count ?? 0,
      latest_score: scans[0]?.skin_score ?? 100,
      week_change: weekChange,
      acne_breakdown: breakdown,
      calendar: scans.map((s) => ({
        date: s.scan_date,
        status: s.skin_status,
        count: s.total_count,
        score: s.skin_score,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /scans/:userId/report
 * 给 Report 页用的完整数据：逐日评分、首尾对比图、各类型趋势
 */
app.get("/scans/:userId/report", async (req, res) => {
  try {
    const { userId } = req.params;

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const scans = await scansCollection()
      .find({ user_id: userId, scan_date: { $gte: since } })
      .sort({ scan_date: 1 }) // 正序，方便折线图
      .toArray();

    if (scans.length === 0) {
      return res.json({
        total_scans: 0,
        avg_skin_score: 100,
        score_change_pct: 0,
        streak: 0,
        daily_scores: [],
        acne_breakdown: { pustule: 0, broken: 0, scab: 0, redness: 0 },
        first_scan: null,
        latest_scan: null,
        date_range: null,
      });
    }

    // 逐日皮肤评分（折线图用）
    const daily_scores = scans.map((s) => ({
      date: new Date(s.scan_date).toISOString().split("T")[0],
      score: s.skin_score,
      count: s.total_count,
    }));

    // 皮肤评分变化百分比（第一天 vs 最后一天）
    const firstScore = scans[0].skin_score;
    const latestScore = scans[scans.length - 1].skin_score;
    const scoreChangePct =
      firstScore > 0
        ? Math.round(((latestScore - firstScore) / firstScore) * 100)
        : 0;

    // 痘痘类型汇总
    const breakdown = { pustule: 0, broken: 0, scab: 0, redness: 0 };
    for (const scan of scans) {
      for (const d of scan.detections ?? []) {
        if (breakdown[d.acne_type] !== undefined) breakdown[d.acne_type]++;
      }
    }

    // 连续天数
    let streak = 0;
    let expected = new Date();
    expected.setHours(0, 0, 0, 0);
    const sortedDesc = [...scans].reverse();
    for (const scan of sortedDesc) {
      const d = new Date(scan.scan_date);
      d.setHours(0, 0, 0, 0);
      const diff = (expected - d) / (1000 * 60 * 60 * 24);
      if (diff <= 1) {
        streak++;
        expected = d;
      } else break;
    }

    res.json({
      total_scans: scans.length,
      avg_skin_score: Math.round(
        scans.reduce((s, r) => s + r.skin_score, 0) / scans.length,
      ),
      score_change_pct: scoreChangePct,
      streak,
      daily_scores,
      acne_breakdown: breakdown,
      first_scan: {
        image_uri: scans[0].image_uri,
        score: scans[0].skin_score,
        date: scans[0].scan_date,
      },
      latest_scan: {
        image_uri: scans[scans.length - 1].image_uri,
        score: scans[scans.length - 1].skin_score,
        date: scans[scans.length - 1].scan_date,
      },
      date_range: {
        from: new Date(scans[0].scan_date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        to: new Date(scans[scans.length - 1].scan_date).toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric", year: "numeric" },
        ),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /scans/:id
 * 删除一条记录
 */
app.delete("/scans/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    try {
      query = { _id: new ObjectId(id) };
    } catch {
      query = { _id: id };
    }
    await scansCollection().deleteOne(query);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Auth ──────────────────────────────────────────────────

function usersCollection() {
  return db.collection("users");
}

/**
 * POST /auth/register
 */
app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 检查邮箱是否已注册
    const existing = await usersCollection().findOne({
      email: email.toLowerCase(),
    });
    if (existing)
      return res.status(409).json({ error: "Email already registered" });

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = {
      name,
      email: email.toLowerCase(),
      password: hash,
      mode: "registered",
      created_at: new Date(),
    };

    const result = await usersCollection().insertOne(user);
    res.status(201).json({
      id: result.insertedId.toString(),
      name: user.name,
      email: user.email,
      mode: user.mode,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /auth/login
 */
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    const user = await usersCollection().findOne({
      email: email.toLowerCase(),
    });

    const valid = user && await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: "Invalid email or password" });

    res.json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      mode: user.mode,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Consent ──────────────────────────────────────────────

/**
 * POST /consent/revoke
 * 用户撤销数据使用同意——把该用户所有历史 scans 打上 can_train=false
 * 前端 lib/consent.ts 的 revokeConsentEverywhere() 调用此接口
 */
app.post("/consent/revoke", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: "user_id required" });

    await scansCollection().updateMany(
      { user_id },
      { $set: { can_train: false, consent_revoked_at: new Date() } }
    );

    res.json({ success: true, message: "Consent revoked. Your data has been removed from training sets." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /auth/forgot-password
 * body: { email }
 * V1 实现：生成 6 位临时数字码，bcrypt 存入 users.password，
 * 直接返回给前端显示（用户用这个码当新密码登录，之后自己改密码）。
 * V2 待办：接 SendGrid / SES 把码发到邮箱，不在 response 里明文返回。
 */
app.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "email required" });

    const user = await usersCollection().findOne({ email: email.toLowerCase() });
    if (!user) {
      // 安全：不暴露"邮箱不存在"——统一返回 200
      return res.json({ success: true, message: "If that email is registered, a temporary password has been generated." });
    }

    // 6 位纯数字临时密码
    const tempCode = String(Math.floor(100000 + Math.random() * 900000));
    const hash = await bcrypt.hash(tempCode, BCRYPT_ROUNDS);
    await usersCollection().updateOne(
      { _id: user._id },
      { $set: { password: hash, password_reset_at: new Date() } }
    );

    // V1：直接返回临时密码（仅开发期/MVP，生产要走邮件）
    res.json({
      success: true,
      temp_password: tempCode,
      message: "Temporary password generated. Use it to sign in, then change your password.",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── User profile / avatar / health / referral ────────────
// 2026-04 新增：profile 页需要的"基础功能"全家桶
// 设计权衡：
//  - 目前所有接口都是基于 user_id body/param 的（和注册/登录保持一致，没加 JWT/session）
//  - 上线前务必换成有认证 token 的路由，不然任何人拿到别人的 userId 都能改资料
//  - 体积控制：avatar base64 最大 ~8MB，借助 express.json limit 10mb

/** 安全把字符串 userId 转成 ObjectId，失败返回 null */
function toObjectId(userId) {
  try {
    return new ObjectId(userId);
  } catch {
    return null;
  }
}

async function findUserById(userId) {
  const oid = toObjectId(userId);
  if (!oid) return null;
  return usersCollection().findOne({ _id: oid });
}

/**
 * POST /user/avatar
 * body: { user_id, image_base64 }  (jpeg/png base64, 不带 data: 前缀)
 * 上传到 cloudinary 并把 avatar_url 写入 users。
 * 同一用户重复上传会在 aurasight/avatars/<uid> 下累积多张——可接受，未来再做清理。
 */
app.post("/user/avatar", async (req, res) => {
  try {
    const { user_id, image_base64 } = req.body;
    if (!user_id || !image_base64) {
      return res.status(400).json({ error: "user_id and image_base64 required" });
    }
    const oid = toObjectId(user_id);
    if (!oid) return res.status(400).json({ error: "invalid user_id" });

    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(503).json({ error: "avatar storage not configured" });
    }

    const dataUri = `data:image/jpeg;base64,${image_base64}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: `aurasight/avatars/${user_id}`,
      resource_type: "image",
      transformation: [
        { width: 512, height: 512, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    await usersCollection().updateOne(
      { _id: oid },
      { $set: { avatar_url: result.secure_url, avatar_updated_at: new Date() } }
    );

    res.json({ avatar_url: result.secure_url });
  } catch (err) {
    console.warn("avatar upload failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /user/avatar
 * body: { user_id }
 * 不主动删 cloudinary 文件（懒删除），只把 users.avatar_url unset
 */
app.delete("/user/avatar", async (req, res) => {
  try {
    const { user_id } = req.body;
    const oid = toObjectId(user_id);
    if (!oid) return res.status(400).json({ error: "invalid user_id" });

    await usersCollection().updateOne(
      { _id: oid },
      { $unset: { avatar_url: "", avatar_updated_at: "" } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /user/:userId
 * 拉取用户的公开资料（含 avatar_url, mode 等），不返回 password
 */
app.get("/user/:userId", async (req, res) => {
  try {
    const user = await findUserById(req.params.userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    const { password, ...safe } = user;
    res.json({ ...safe, id: user._id.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /user/profile
 * body: { user_id, name?, email? }
 * 改邮箱时要查重，避免和别人冲突
 */
app.patch("/user/profile", async (req, res) => {
  try {
    const { user_id, name, email } = req.body;
    const oid = toObjectId(user_id);
    if (!oid) return res.status(400).json({ error: "invalid user_id" });

    const update = {};
    if (typeof name === "string" && name.trim()) update.name = name.trim();
    if (typeof email === "string" && email.trim()) {
      const lower = email.trim().toLowerCase();
      const existing = await usersCollection().findOne({
        email: lower,
        _id: { $ne: oid },
      });
      if (existing) return res.status(409).json({ error: "Email already in use" });
      update.email = lower;
    }
    if (!Object.keys(update).length) {
      return res.status(400).json({ error: "nothing to update" });
    }
    update.updated_at = new Date();

    await usersCollection().updateOne({ _id: oid }, { $set: update });
    const fresh = await usersCollection().findOne({ _id: oid });
    const { password, ...safe } = fresh;
    res.json({ ...safe, id: fresh._id.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /auth/change-password
 * body: { user_id, old_password, new_password }
 */
app.post("/auth/change-password", async (req, res) => {
  try {
    const { user_id, old_password, new_password } = req.body;
    if (!user_id || !old_password || !new_password) {
      return res.status(400).json({ error: "missing fields" });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: "new password must be at least 6 characters" });
    }
    const user = await findUserById(user_id);
    if (!user) return res.status(404).json({ error: "user not found" });

    const valid = await bcrypt.compare(old_password, user.password);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    const hash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    await usersCollection().updateOne(
      { _id: user._id },
      { $set: { password: hash, password_updated_at: new Date() } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Health profile ────────────────────────────────────────
// 结构： users.health_profile = { height_cm, weight_kg, gender, birthday }
// body-composition 页以后可以直接读这里，不用再单独存一份

/**
 * GET /user/health-profile/:userId
 */
app.get("/user/health-profile/:userId", async (req, res) => {
  try {
    const user = await findUserById(req.params.userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    res.json(user.health_profile ?? {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /user/health-profile
 * body: { user_id, height_cm?, weight_kg?, gender?, birthday? }
 */
app.patch("/user/health-profile", async (req, res) => {
  try {
    const { user_id, height_cm, weight_kg, gender, birthday } = req.body;
    const oid = toObjectId(user_id);
    if (!oid) return res.status(400).json({ error: "invalid user_id" });

    const current = (await usersCollection().findOne({ _id: oid }))?.health_profile ?? {};
    const next = { ...current };
    if (typeof height_cm === "number" && height_cm > 0) next.height_cm = height_cm;
    if (typeof weight_kg === "number" && weight_kg > 0) next.weight_kg = weight_kg;
    if (typeof gender === "string" && ["male", "female", "other"].includes(gender)) {
      next.gender = gender;
    }
    if (typeof birthday === "string") next.birthday = birthday; // ISO yyyy-mm-dd

    await usersCollection().updateOne(
      { _id: oid },
      { $set: { health_profile: next, health_profile_updated_at: new Date() } }
    );
    res.json(next);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Referral ──────────────────────────────────────────────
// 结构：
//  referrals = { _id, code (6-char), owner_id, created_at, redemptions: [{user_id, redeemed_at}] }
//  索引：code (unique)
// V1 规则：redeem 成功给双方都加 30 天 VIP。
// 生产化待办：并发 race（两个人同时 redeem 同一个码）用事务；防自己 redeem 自己；防重复 redeem。

function referralsCollection() {
  return db.collection("referrals");
}

function genReferralCode() {
  // 6 字符，排除 0/O/I/1 这类易混淆字符
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

/**
 * GET /user/referral/:userId
 * 没有就创建一条。重试几次避免 code 冲突。
 */
app.get("/user/referral/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const oid = toObjectId(userId);
    if (!oid) return res.status(400).json({ error: "invalid user_id" });

    const existing = await referralsCollection().findOne({ owner_id: userId });
    if (existing) {
      return res.json({
        code: existing.code,
        redemptions: existing.redemptions?.length ?? 0,
      });
    }

    let code = null;
    for (let i = 0; i < 5; i++) {
      const candidate = genReferralCode();
      const dup = await referralsCollection().findOne({ code: candidate });
      if (!dup) {
        code = candidate;
        break;
      }
    }
    if (!code) return res.status(500).json({ error: "failed to allocate code" });

    await referralsCollection().insertOne({
      code,
      owner_id: userId,
      created_at: new Date(),
      redemptions: [],
    });
    res.json({ code, redemptions: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /user/referral/redeem
 * body: { user_id, code }
 * 给 redeemer + owner 都加 30 天 VIP。
 */
app.post("/user/referral/redeem", async (req, res) => {
  try {
    const { user_id, code } = req.body;
    if (!user_id || !code) return res.status(400).json({ error: "missing fields" });

    const oid = toObjectId(user_id);
    if (!oid) return res.status(400).json({ error: "invalid user_id" });

    const ref = await referralsCollection().findOne({ code: code.toUpperCase() });
    if (!ref) return res.status(404).json({ error: "invalid code" });
    if (ref.owner_id === user_id) {
      return res.status(400).json({ error: "cannot redeem your own code" });
    }
    if (ref.redemptions?.some((r) => r.user_id === user_id)) {
      return res.status(409).json({ error: "already redeemed" });
    }

    const now = new Date();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    async function extendVip(targetId) {
      const target = await findUserById(targetId);
      if (!target) return;
      const curr = target.vip_expires_at ? new Date(target.vip_expires_at) : now;
      const base = curr > now ? curr : now;
      const next = new Date(base.getTime() + thirtyDaysMs);
      await usersCollection().updateOne(
        { _id: target._id },
        { $set: { mode: "vip", vip_expires_at: next } }
      );
    }

    await extendVip(user_id);
    await extendVip(ref.owner_id);

    await referralsCollection().updateOne(
      { _id: ref._id },
      { $push: { redemptions: { user_id, redeemed_at: now } } }
    );

    res.json({ success: true, vip_days_added: 30 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Community / Forum ────────────────────────────────────

function postsCollection()    { return db.collection("posts"); }
function commentsCollection() { return db.collection("comments"); }

/**
 * GET /posts?limit=20&offset=0
 * 获取帖子列表，置顶帖优先，按时间倒序
 */
app.get("/posts", async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  ?? "20"), 50);
    const offset = parseInt(req.query.offset ?? "0");
    const posts = await postsCollection()
      .find({})
      .sort({ is_pinned: -1, created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /posts
 * 发帖，body: { author_id, author_name, content, is_official? }
 */
app.post("/posts", async (req, res) => {
  try {
    const { author_id, author_name, content, tag = "share", is_official = false, image_base64 } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Content required" });
    const validTags = ["help", "share", "routine", "checkin"];

    // 如果有图片，上传到 Cloudinary
    let image_url = null;
    if (image_base64) {
      image_url = await uploadToCloudinary(image_base64, author_id ?? "guest");
    }

    const post = {
      author_id:     author_id ?? "guest",
      author_name:   author_name?.trim() || "Anonymous",
      content:       content.trim(),
      tag:           validTags.includes(tag) ? tag : "share",
      image_url:     image_url ?? undefined,
      is_pinned:     false,
      is_official:   !!is_official,
      likes:         [],
      comment_count: 0,
      created_at:    new Date().toISOString(),
    };
    const result = await postsCollection().insertOne(post);
    res.json({ ...post, _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /posts/:id
 * 获取单个帖子
 */
app.get("/posts/:id", async (req, res) => {
  try {
    const post = await postsCollection().findOne({ _id: new ObjectId(req.params.id) });
    if (!post) return res.status(404).json({ error: "Not found" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /posts/:id/like
 * 切换点赞（已赞→取消，未赞→加赞），body: { user_id }
 */
app.post("/posts/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id = "guest" } = req.body;
    const post = await postsCollection().findOne({ _id: new ObjectId(id) });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const alreadyLiked = (post.likes ?? []).includes(user_id);
    await postsCollection().updateOne(
      { _id: new ObjectId(id) },
      alreadyLiked
        ? { $pull:  { likes: user_id } }
        : { $push:  { likes: user_id } },
    );
    const updated = await postsCollection().findOne({ _id: new ObjectId(id) });
    res.json({ likes: updated.likes, liked: !alreadyLiked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /posts/:id/comments
 * 获取帖子评论，按时间正序
 */
app.get("/posts/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const comments = await commentsCollection()
      .find({ post_id: id })
      .sort({ created_at: 1 })
      .toArray();
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /posts/:id/comments
 * 发评论，body: { author_id, author_name, content }
 */
app.post("/posts/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const { author_id, author_name, content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Content required" });

    const comment = {
      post_id:     id,
      author_id:   author_id ?? "guest",
      author_name: author_name?.trim() || "Anonymous",
      content:     content.trim(),
      created_at:  new Date().toISOString(),
    };
    const result = await commentsCollection().insertOne(comment);
    // 同步更新帖子的 comment_count
    await postsCollection().updateOne(
      { _id: new ObjectId(id) },
      { $inc: { comment_count: 1 } },
    );
    res.json({ ...comment, _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /posts/:id
 * 删除帖子（仅作者本人），body: { user_id }
 */
app.delete("/posts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    const post = await postsCollection().findOne({ _id: new ObjectId(id) });
    if (!post) return res.status(404).json({ error: "Not found" });
    if (post.author_id !== user_id) return res.status(403).json({ error: "Not your post" });
    await postsCollection().deleteOne({ _id: new ObjectId(id) });
    await commentsCollection().deleteMany({ post_id: id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 启动 ─────────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 AuraSight API running on port ${PORT}`);
  });
});

// ─── Weekly Insight 规则引擎 ─────────────────────────────
// 根据本周 vs 上周的数据，生成一句有温度的个性化文字
function generateInsightText(thisWeek, lastWeek, streak) {
  const scansThisWeek = thisWeek.length;
  const avgThisWeek =
    thisWeek.length > 0
      ? Math.round(
          thisWeek.reduce((s, x) => s + x.skin_score, 0) / thisWeek.length,
        )
      : null;
  const avgLastWeek =
    lastWeek.length > 0
      ? Math.round(
          lastWeek.reduce((s, x) => s + x.skin_score, 0) / lastWeek.length,
        )
      : null;

  // 没有数据时的鼓励
  if (scansThisWeek === 0) {
    return "This week hasn't started yet — your skin is waiting for its first check-in. Even one scan gives us something to work with.";
  }

  // 第一周用户
  if (!avgLastWeek) {
    if (avgThisWeek >= 90)
      return `Strong start. Your skin is scoring ${avgThisWeek} this week — that's a great baseline to build on.`;
    if (avgThisWeek >= 70)
      return `Good first week. Your skin score is sitting at ${avgThisWeek} — let's see what daily check-ins can do for it.`;
    return `First week in. Your score is ${avgThisWeek} — don't worry, the trend matters more than the number right now.`;
  }

  const scoreDiff = avgLastWeek ? avgThisWeek - avgLastWeek : 0;

  // 分情况生成文字
  if (scansThisWeek >= 6 && scoreDiff > 0) {
    return `Your most consistent week yet — ${scansThisWeek}/7 days scanned, and your skin responded. Score up ${scoreDiff} points from last week.`;
  }
  if (scansThisWeek >= 6 && scoreDiff === 0) {
    return `${scansThisWeek} days scanned this week. Your skin is holding steady — consistency is doing its job even when the numbers don't move.`;
  }
  if (scansThisWeek >= 4 && scoreDiff > 3) {
    return `Great week. You showed up ${scansThisWeek} times and your skin score jumped ${scoreDiff} points. Something's working — keep it going.`;
  }
  if (scansThisWeek >= 4 && scoreDiff < -3) {
    return `You scanned ${scansThisWeek} days this week, but your score dipped ${Math.abs(scoreDiff)} points. Stress, sleep, diet — worth checking in with your diary.`;
  }
  if (scansThisWeek <= 2 && scoreDiff > 0) {
    return `Only ${scansThisWeek} scans this week, but your skin actually improved. Imagine what daily tracking could show.`;
  }
  if (scansThisWeek <= 2) {
    return `Light week — just ${scansThisWeek} scans. Your skin misses you. Even a 30-second check-in adds up over 30 days.`;
  }
  if (scoreDiff > 5) {
    return `This week your skin jumped ${scoreDiff} points. Whatever you did differently — it's working.`;
  }
  if (scoreDiff < -5) {
    return `Score dropped ${Math.abs(scoreDiff)} points this week. It happens. Add a diary note to your next scan and we can start connecting the dots.`;
  }

  return `${scansThisWeek} scans this week, average score ${avgThisWeek}. You're building the data that makes 30-day insights possible.`;
}

// GET /insights/:userId/weekly — 周报告
app.get("/insights/:userId/weekly", async (req, res) => {
  try {
    const { userId } = req.params;
    const db = client.db(process.env.DB_NAME);

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const lastStart = new Date(weekStart);
    lastStart.setDate(weekStart.getDate() - 7);

    const [thisWeek, lastWeek] = await Promise.all([
      db
        .collection("scans")
        .find({ user_id: userId, scan_date: { $gte: weekStart } })
        .toArray(),
      db
        .collection("scans")
        .find({
          user_id: userId,
          scan_date: {
            $gte: lastStart,
            $lt: weekStart,
          },
        })
        .toArray(),
    ]);

    // 获取 streak
    const pts = await db.collection("points").findOne({ user_id: userId });
    const streak = pts?.streak ?? 0;

    const avgThis =
      thisWeek.length > 0
        ? Math.round(
            thisWeek.reduce((s, x) => s + (x.skin_score ?? 0), 0) /
              thisWeek.length,
          )
        : null;
    const avgLast =
      lastWeek.length > 0
        ? Math.round(
            lastWeek.reduce((s, x) => s + (x.skin_score ?? 0), 0) /
              lastWeek.length,
          )
        : null;

    res.json({
      scans_this_week: thisWeek.length,
      avg_score_this_week: avgThis,
      avg_score_last_week: avgLast,
      score_change: avgThis && avgLast ? avgThis - avgLast : null,
      streak,
      insight_text: generateInsightText(thisWeek, lastWeek, streak),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Routes (Claude) ───────────────────────────────────────
const Anthropic = require("@anthropic-ai/sdk");

function getAnthropicClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === "your_key_here") throw new Error("ANTHROPIC_API_KEY not configured");
  return new Anthropic.default({ apiKey: key });
}

// ─── NMS: 去掉重叠的框，保留高置信度的 ──────────────────────
function nmsFilter(boxes, iouThreshold = 0.4) {
  // 按 confidence 降序排列
  const sorted = [...boxes].sort((a, b) => b.confidence - a.confidence);
  const kept = [];
  for (const box of sorted) {
    const overlap = kept.some(k => iou(box.bbox, k.bbox) > iouThreshold);
    if (!overlap) kept.push(box);
  }
  return kept;
}

function iou(a, b) {
  const ax1 = a.cx - a.w / 2, ay1 = a.cy - a.h / 2;
  const ax2 = a.cx + a.w / 2, ay2 = a.cy + a.h / 2;
  const bx1 = b.cx - b.w / 2, by1 = b.cy - b.h / 2;
  const bx2 = b.cx + b.w / 2, by2 = b.cy + b.h / 2;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
  const inter = ix * iy;
  const union = (ax2-ax1)*(ay2-ay1) + (bx2-bx1)*(by2-by1) - inter;
  return union > 0 ? inter / union : 0;
}

// ─── Roboflow helper ─────────────────────────────────────────
async function detectWithRoboflow(image_base64) {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  const model   = process.env.ROBOFLOW_MODEL; // e.g. "acne-detection-v1-kf14t/2"
  if (!apiKey || !model || apiKey === "your_roboflow_key_here") return null;

  try {
    const url = `https://detect.roboflow.com/${model}?api_key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: image_base64,
    });
    if (!response.ok) throw new Error(`Roboflow HTTP ${response.status}`);
    const data = await response.json();
    if (!data.predictions || !data.image) return null;

    const { width: imgW, height: imgH } = data.image;

    // Step 1: 过滤低置信度（0.50 以上才算）
    const filtered = data.predictions
      .filter(p => p.confidence >= 0.50)
      .map(p => ({
        acne_type: "redness",
        confidence: Math.round(p.confidence * 100) / 100,
        bbox: {
          cx: p.x / imgW,
          cy: p.y / imgH,
          w:  p.width  / imgW,
          h:  p.height / imgH,
        },
      }));

    // Step 2: NMS — 去掉重叠 > 40% 的框
    const afterNms = nmsFilter(filtered, 0.4);

    // Step 3: 最多保留 15 个（超过就说明模型误报严重）
    const capped = afterNms.slice(0, 15);

    console.log(`Roboflow raw: ${data.predictions.length} → conf≥0.5: ${filtered.length} → NMS: ${afterNms.length} → cap: ${capped.length}`);
    return capped;
  } catch (e) {
    console.warn("⚠️  Roboflow error:", e.message);
    return null;
  }
}

// POST /ai/analyze — Claude Vision 单独检测（Roboflow 模型精度不足暂时旁路）
// 待 Colab 大数据集训练完成后再重新启用 Roboflow hybrid 模式
app.post("/ai/analyze", async (req, res) => {
  try {
    const { image_base64, media_type = "image/jpeg" } = req.body;
    if (!image_base64) return res.status(400).json({ error: "image_base64 required" });

    // Roboflow 旁路开关 — 当前模型 mAP 只有 24%，先关掉等更好的模型训练完
    // 改回 true 即可重新启用 hybrid 模式
    const ROBOFLOW_ENABLED = false;

    let roboflowBoxes = null;
    let useRoboflow = false;

    if (ROBOFLOW_ENABLED) {
      roboflowBoxes = await detectWithRoboflow(image_base64);
      useRoboflow = Array.isArray(roboflowBoxes) && roboflowBoxes.length > 0;
      console.log(
        roboflowBoxes === null
          ? "ℹ️  Roboflow not configured — Claude doing full analysis"
          : roboflowBoxes.length === 0
            ? "ℹ️  Roboflow: no detections — Claude doing full analysis"
            : `✅ Roboflow: ${roboflowBoxes.length} detections`
      );
    } else {
      console.log("ℹ️  Roboflow bypassed — Claude doing full analysis");
    }

    // ── Claude Vision 全量检测 ─────
    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type, data: image_base64 },
          },
          {
            type: "text",
            text: useRoboflow
              ? buildRoboflowClassifyPrompt(roboflowBoxes)
              : buildFullDetectionPrompt(),
          },
        ],
      }],
    });

    const raw = message.content[0].text.trim();
    const json = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");
    const claudeResult = JSON.parse(json);

    // ── Step 3: merge Roboflow positions with Claude classifications ──
    let finalResult;
    if (useRoboflow) {
      const classifications = claudeResult.classifications ?? [];
      const detections = roboflowBoxes.map((box, i) => ({
        ...box,
        acne_type: classifications[i] ?? "redness",
      }));
      const breakdown = { pustule: 0, redness: 0, broken: 0, scab: 0 };
      detections.forEach(d => { if (breakdown[d.acne_type] !== undefined) breakdown[d.acne_type]++; });
      finalResult = {
        detections,
        summary:        claudeResult.summary,
        severity:       claudeResult.severity,
        acne_breakdown: breakdown,
        positive:       claudeResult.positive,
        tips:           claudeResult.tips,
      };
    } else {
      // Claude-only 模式：后端再过滤一遍，去掉不可信的检测
      const rawDetections = claudeResult.detections ?? [];
      const cleaned = rawDetections
        .filter(d => (d.confidence ?? 0) >= 0.75)   // 只保留 75%+ 置信度
        .filter(d => d.bbox && d.bbox.w >= 0.02 && d.bbox.h >= 0.02)  // 过滤掉太小的噪点
        .slice(0, 8);                                // 最多 8 个

      // NMS 去重叠
      const deduped = nmsFilter(cleaned, 0.4);

      finalResult = {
        ...claudeResult,
        detections: deduped,
      };
    }

    res.json(finalResult);
  } catch (err) {
    console.error("AI analyze error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Prompt builders ─────────────────────────────────────────

function buildRoboflowClassifyPrompt(boxes) {
  const spotList = boxes.map((b, i) =>
    `Spot ${i + 1}: center (${b.bbox.cx.toFixed(3)}, ${b.bbox.cy.toFixed(3)}), size ${(b.bbox.w * 100).toFixed(1)}% × ${(b.bbox.h * 100).toFixed(1)}% of image, confidence ${(b.confidence * 100).toFixed(0)}%`
  ).join("\n");

  return `You are AuraSight's senior skin consultant. A computer vision model has detected ${boxes.length} acne lesion(s) in this skin photo at these positions:

${spotList}

Your tasks:
1. For each spot, look at that location in the image and classify it as one of: pustule | redness | broken | scab
   - pustule: raised pimple with white/yellow pus head
   - redness: inflamed raised papule, no head yet
   - broken: open/picked spot, blackhead, disrupted skin
   - scab: healing crust or dry scab
2. Write a warm, honest 2-3 sentence skin assessment as a professional esthetician speaking directly to the client.
3. Rate overall severity: clear | mild | moderate | severe
4. Give one specific genuine positive observation about this person's skin.
5. Give 3 specific actionable skincare tips tailored to what you see.

Return ONLY valid JSON (no markdown, no extra text):
{
  "classifications": ["pustule", "redness", ...],
  "summary": "...",
  "severity": "clear" | "mild" | "moderate" | "severe",
  "positive": "...",
  "tips": ["...", "...", "..."]
}`;
}

function buildFullDetectionPrompt() {
  return `You are AuraSight's senior AI skin consultant — combining the precision of a licensed esthetician with the warmth of a trusted beauty advisor. You have 10+ years of experience analyzing skin conditions and crafting personalized skincare routines for clients of all skin types and tones.

Your role: examine this skin photo the way you would during a professional facial consultation. You notice everything — the texture, the tone, the active breakouts, the healing spots — and you speak to your client with honesty and encouragement.

---

## STEP 1: SCAN THE IMAGE SYSTEMATICALLY
Divide the face/skin into zones and check each one: forehead, temples, nose, cheeks (left & right), chin, jawline, and neck if visible. Do not miss lesions at the edges of the frame.

## STEP 2: CLASSIFY EACH LESION
For every lesion you find, assign one of these four types based on what you see:

- **pustule** — A raised pimple with a visible white or yellow pus-filled head, surrounded by inflamed red skin. These are active, infected breakouts that need gentle treatment.
- **redness** — A clearly raised or palpably inflamed papule without a white head. Must be a DISTINCT, localized raised bump — not general skin flushing, not facial warmth, not skin undertone, not lighting variation. Only mark redness if it is a clear isolated lesion that stands out from surrounding skin.
- **broken** — An open lesion: a popped pimple, a picked spot, a blackhead (open comedone), or any area where the skin barrier is visibly disrupted. These are highest priority for healing.
- **scab** — A healing lesion covered by a dry crust or scab. The skin is recovering but the lesion is still raised or textured (not a flat post-acne mark).

## STEP 3: MARK PRECISE BOUNDING BOXES
For each lesion, draw a tight box around just that lesion:
- cx, cy = the exact center point (0.0 = left/top edge, 1.0 = right/bottom edge)
- w, h = the width and height of just that lesion
- Typical lesion size: w and h between 0.02 and 0.12
- Large inflamed areas (cystic acne, wide redness zones): up to 0.20 max
- Each individual lesion gets its OWN entry — do not group multiple spots into one box
- If two lesions overlap, still mark each one separately

## STEP 4: CONFIDENCE LEVELS
Only include a detection if you are at least 70% confident it is a real lesion:
- 0.90–1.0: Unmistakably clear lesion
- 0.70–0.89: Very likely, clearly visible
- Below 0.70: Skip — do not include uncertain or borderline detections

## CRITICAL RULE — BE CONSERVATIVE
It is far better to UNDER-report than to OVER-report. A professional esthetician would never flag 10+ spots on a face with only 1–2 real pimples. If you are not sure, skip it. Ask yourself: "Would I point this out to a client sitting in my chair?" If not, do not include it.

For redness specifically: general skin warmth, flushing, pink skin tone, lighting reflections, and post-acne flat marks are NOT redness lesions. Only mark redness if it is a clearly raised, inflamed, isolated bump — distinct from the surrounding skin.

## WHAT AN ESTHETICIAN WOULD IGNORE
Skip these — they are not acne lesions:
- Normal pores and skin texture
- General skin redness or warmth (not a specific raised bump)
- Skin undertones or natural flush
- Freckles, moles, beauty marks (unless actively inflamed)
- Shadows from lighting or facial contours
- Hair follicles or peach fuzz
- Flat post-acne hyperpigmentation (fully healed, flush with skin)
- Makeup, filters, or digital artifacts
- Any area where you are less than 70% confident

## SEVERITY ASSESSMENT
- "clear" — No active lesions. Skin is calm and balanced.
- "mild" — 1 to 5 lesions. Mostly non-inflamed. Manageable with a gentle routine.
- "moderate" — 6 to 15 lesions. A mix of types. Needs a targeted treatment plan.
- "severe" — 16+ lesions, or multiple pustules/broken lesions present. Recommend professional consultation.

---

## OUTPUT
Return ONLY valid JSON. No markdown, no explanation, no code fences. Speak in the summary, positive, and tips fields as a warm, professional beauty consultant would to a real client:

{
  "detections": [
    {
      "acne_type": "pustule" | "broken" | "redness" | "scab",
      "confidence": <0.50 to 1.0>,
      "bbox": { "cx": <0.0-1.0>, "cy": <0.0-1.0>, "w": <0.02-0.20>, "h": <0.02-0.20> }
    }
  ],
  "summary": "<2–3 sentences. Describe what you see like a consultant speaking directly to the client: mention the types of lesions, where they are concentrated, and the overall skin condition. Be honest but never harsh.>",
  "severity": "clear" | "mild" | "moderate" | "severe",
  "acne_breakdown": {
    "pustule": <integer count>,
    "redness": <integer count>,
    "broken": <integer count>,
    "scab": <integer count>
  },
  "positive": "<One specific, genuine compliment about something good you observe in this skin — texture, tone, hydration, improvement area. Be specific to what you actually see, not generic praise.>",
  "tips": [
    "<Tip 1: Address the most urgent lesion type found. Give a specific, actionable product recommendation or technique — e.g. 'Apply a salicylic acid spot treatment to the active pustules on your chin before bed'>",
    "<Tip 2: A skincare routine adjustment relevant to this severity and skin condition>",
    "<Tip 3: A lifestyle, diet, or prevention tip that specifically addresses the pattern of breakouts you observed>"
  ]
}

If the image is too blurry, too dark, not a close-up of skin, or the face is not clearly visible, return detections:[] with severity:"clear" and use the summary field to kindly let the user know the photo quality needs improvement for an accurate reading.`;
}

// /pdf/report/:userId 已在 2026-04 移除——对实际用户群没什么意义
// （他们不会真的把 PDF 拿去给皮肤科医生），维护 pdfkit 体积和模板反而是负担。
// 如需恢复请翻 git 历史。

app.post("/ai/report/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const db = client.db(process.env.DB_NAME);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const scans = await db.collection("scans")
      .find({ user_id: userId, scan_date: { $gte: thirtyDaysAgo } })
      .sort({ scan_date: 1 })
      .toArray();

    if (scans.length === 0) {
      return res.json({ report: "Not enough data yet. Complete at least a few scans to generate your personalized report." });
    }

    const scores = scans.map(s => s.skin_score ?? 100);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const firstScore = scores[0];
    const lastScore = scores[scores.length - 1];
    const spotCounts = scans.map(s => s.total_count ?? 0);
    const avgSpots = (spotCounts.reduce((a, b) => a + b, 0) / spotCounts.length).toFixed(1);
    const breakdown = scans.reduce((acc, s) => {
      (s.detections ?? []).forEach(d => { acc[d.acne_type] = (acc[d.acne_type] ?? 0) + 1; });
      return acc;
    }, {});

    // 真实观察窗口：不能再硬写 "30 days"——用户可能只拍了几天。
    // 让 prompt 诚实反映实际数据跨度，否则 LLM 会捏造"一个月的趋势"。
    const firstDate = new Date(scans[0].scan_date);
    const lastDate = new Date(scans[scans.length - 1].scan_date);
    const spanDays = Math.max(1, Math.round((lastDate - firstDate) / 86400000) + 1);
    const windowLabel = spanDays === 1
      ? "a single day"
      : spanDays < 7
      ? `${spanDays} days`
      : spanDays < 14
      ? `about 1 week`
      : spanDays < 21
      ? `about 2 weeks`
      : spanDays < 28
      ? `about 3 weeks`
      : `${spanDays} days (up to 30)`;
    // 推荐/预测 horizon 与数据量成比例：数据很少时不要说 "Next 30 days"
    const horizonLabel = spanDays < 7
      ? "Next 7 days"
      : spanDays < 14
      ? "Next 2 weeks"
      : "Next 30 days";
    const limitedData = spanDays < 7 || scans.length < 5;

    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `You are AuraSight's AI dermatology consultant writing a personalized skin progress report.

User's data (observation window: ${windowLabel}, ${scans.length} scan${scans.length === 1 ? "" : "s"}):
- Average skin score: ${avgScore}/100
- Starting score: ${firstScore}, Latest score: ${lastScore}
- Average spots per scan: ${avgSpots}
- Acne type breakdown: ${JSON.stringify(breakdown)}
- Trend: ${lastScore > firstScore ? "IMPROVING" : lastScore < firstScore ? "DECLINING" : "STABLE"}
${limitedData ? "\nIMPORTANT: The observation window is short and/or scan count is low. DO NOT describe this as a month-long journey or over-interpret trends. Acknowledge the limited data honestly and focus on early patterns rather than confident conclusions.\n" : ""}
Write a warm, honest, personalized report with these sections:
1. **Overall Progress** (2-3 sentences, grounded in the actual ${windowLabel} of data — no "over the past month" if the window is shorter)
2. **What's Working** (1-2 specific positives based on the data${limitedData ? ", or note it's too early to tell if data is too thin" : ""})
3. **Areas to Focus** (1-2 honest observations)
4. **${horizonLabel}** (3 specific, actionable recommendations appropriate for this horizon)
5. **Encouragement** (1 motivating closing sentence)

Keep the tone like a friendly dermatologist — professional but warm. Use the actual numbers and the actual window. No generic advice. Never claim more data than exists.`,
      }],
    });

    res.json({
      report: message.content[0].text,
      generated_at: new Date().toISOString(),
      scan_count: scans.length,
      span_days: spanDays,
      window_label: windowLabel,
      limited_data: limitedData,
    });
  } catch (err) {
    console.error("AI report error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /ai/advice/:userId — 生成今日个性化护肤建议
app.post("/ai/advice/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const db = client.db(process.env.DB_NAME);

    const recentScans = await db.collection("scans")
      .find({ user_id: userId })
      .sort({ scan_date: -1 })
      .limit(7)
      .toArray();

    const pts = await db.collection("points").findOne({ user_id: userId });
    const streak = pts?.streak ?? 0;

    const latestScan = recentScans[0];
    const latestScore = latestScan?.skin_score ?? null;
    const latestSpots = latestScan?.total_count ?? 0;
    const latestStatus = latestScan?.skin_status ?? "unknown";

    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `You are AuraSight's AI skin coach. Generate today's personalized skincare advice.

User's current status:
- Latest skin score: ${latestScore ?? "no scan yet"}
- Current spots: ${latestSpots}
- Skin status: ${latestStatus}
- Streak: ${streak} days
- Recent scan count: ${recentScans.length}

Write ONE short, specific, actionable piece of advice (2-3 sentences max) for today.
Be specific to their actual skin condition. Start directly with the advice, no preamble.
Tone: warm coach, not medical.`,
      }],
    });

    res.json({ advice: message.content[0].text, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error("AI advice error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /ai/chat — AI皮肤顾问对话
app.post("/ai/chat", async (req, res) => {
  try {
    const { messages, userId } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array required" });
    }

    // Fetch user context
    let userContext = "";
    if (userId) {
      try {
        const db = client.db(process.env.DB_NAME);
        const latestScan = await db.collection("scans")
          .find({ user_id: userId }).sort({ scan_date: -1 }).limit(1).toArray();
        const pts = await db.collection("points").findOne({ user_id: userId });
        if (latestScan[0]) {
          userContext = `\nUser's latest scan: score ${latestScan[0].skin_score}, ${latestScan[0].total_count} spots, status: ${latestScan[0].skin_status}. Streak: ${pts?.streak ?? 0} days.`;
        }
      } catch {}
    }

    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 600,
      system: `You are AuraSight's AI skin consultant — a friendly, knowledgeable dermatology assistant.
You help users understand their skin condition, interpret scan results, and give evidence-based skincare advice.
Keep responses concise (2-3 short paragraphs max), warm, practical, and actionable.
Never diagnose medical conditions — always recommend seeing a dermatologist for serious concerns.
${userContext}`,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    res.json({ reply: response.content[0].text });
  } catch (err) {
    console.error("AI chat error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /scans/:id/diary — 给扫描记录添加日记备注
// POST /ai/deep-analysis/:userId — VIP 深度 AI 分析
// 包含日记标签关联、生活方式影响因素分析
app.post("/ai/deep-analysis/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const db = client.db(process.env.DB_NAME);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const scans = await db.collection("scans")
      .find({ user_id: userId, scan_date: { $gte: thirtyDaysAgo } })
      .sort({ scan_date: 1 })
      .toArray();

    if (scans.length < 3) {
      return res.json({
        error: "not_enough_data",
        message: "Complete at least 3 scans to unlock deep analysis."
      });
    }

    // ── 日记标签统计 ────────────────────────────────────────
    const tagMap = {};
    const tagScores = {}; // tag → [scores on days with that tag]
    scans.forEach(s => {
      const score = s.skin_score ?? 100;
      (s.diary_tags ?? []).forEach(tag => {
        tagMap[tag] = (tagMap[tag] ?? 0) + 1;
        if (!tagScores[tag]) tagScores[tag] = [];
        tagScores[tag].push(score);
      });
    });

    // 计算每个标签的平均分 vs 整体平均分
    const overallAvg = scans.reduce((s, r) => s + (r.skin_score ?? 100), 0) / scans.length;
    const tagImpact = Object.entries(tagScores).map(([tag, scores]) => {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return { tag, count: tagMap[tag], avg_score: Math.round(avg), impact: Math.round(avg - overallAvg) };
    }).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    // ── 皮肤趋势 ────────────────────────────────────────────
    const scores = scans.map(s => s.skin_score ?? 100);
    const breakdown = scans.reduce((acc, s) => {
      (s.detections ?? []).forEach(d => { acc[d.acne_type] = (acc[d.acne_type] ?? 0) + 1; });
      return acc;
    }, {});

    // 真实观察窗口：用户可能只拍了几天，不能硬说 "30 days"
    const firstDate = new Date(scans[0].scan_date);
    const lastDate = new Date(scans[scans.length - 1].scan_date);
    const spanDays = Math.max(1, Math.round((lastDate - firstDate) / 86400000) + 1);
    const windowLabel = spanDays < 7
      ? `${spanDays} day${spanDays === 1 ? "" : "s"}`
      : spanDays < 14
      ? "about 1 week"
      : spanDays < 21
      ? "about 2 weeks"
      : spanDays < 28
      ? "about 3 weeks"
      : `${spanDays} days (up to 30)`;
    const horizonLabel = spanDays < 7
      ? "next 7 days"
      : spanDays < 14
      ? "next 2 weeks"
      : "next 30 days";
    const limitedData = spanDays < 7 || scans.length < 5;

    // 周趋势只分桶到实际覆盖的周数，避免空周污染
    const totalWeeks = Math.min(4, Math.max(1, Math.ceil(spanDays / 7)));
    const weeklyTrend = [];
    for (let i = 0; i < totalWeeks; i++) {
      const week = scans.filter(s => {
        const daysAgo = (Date.now() - new Date(s.scan_date).getTime()) / 86400000;
        return daysAgo >= i * 7 && daysAgo < (i + 1) * 7;
      });
      if (week.length > 0) {
        weeklyTrend.unshift({
          week: `Week ${totalWeeks - i}`,
          avg: Math.round(week.reduce((s, r) => s + (r.skin_score ?? 100), 0) / week.length),
          scans: week.length
        });
      }
    }

    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `You are AuraSight's senior AI skin consultant performing a deep lifestyle correlation analysis.

SKIN DATA (observation window: ${windowLabel}):
- ${scans.length} scan${scans.length === 1 ? "" : "s"}, overall avg score: ${Math.round(overallAvg)}/100
- First score: ${scores[0]}, Latest score: ${scores[scores.length - 1]}
- Acne breakdown: ${JSON.stringify(breakdown)}
- Weekly trend (only includes weeks with data): ${JSON.stringify(weeklyTrend)}

LIFESTYLE DIARY CORRELATIONS:
${tagImpact.length > 0
  ? tagImpact.map(t => `- "${t.tag}": appeared ${t.count}x, avg skin score ${t.avg_score} (${t.impact > 0 ? '+' : ''}${t.impact} vs baseline)`).join('\n')
  : '- No diary tags recorded yet'}
${limitedData ? "\nIMPORTANT: Observation window is short and/or scan count is low. Do NOT pretend this is a month of data. Flag low confidence, avoid over-interpreting tag correlations that only appeared a handful of times, and scale all predictions/experiments to the available window.\n" : ""}
Based on this data, provide a deep analysis in this exact JSON format:
{
  "headline": "One punchy headline summarizing their skin journey so far (match the actual window — no '30-day journey' if the window is shorter)",
  "overall_trend": "improving | declining | stable | fluctuating | too_early",
  "data_confidence": "high | medium | low (low if window < 7 days or scans < 5)",
  "lifestyle_insights": [
    {
      "factor": "factor name (e.g. Sleep quality, Hydration, Diet, Stress)",
      "finding": "1-2 sentence finding based on diary data or inferred from patterns",
      "impact": "positive | negative | neutral",
      "score_effect": "+X or -X points on skin score (estimate; omit if confidence is low)"
    }
  ],
  "best_habit": "The single most beneficial habit identified from their data (or null if too early)",
  "worst_habit": "The single most harmful pattern (or null if too early)",
  "weekly_pattern": "Any day-of-week or weekly pattern observed (or null if data < 1 week)",
  "next_experiment": "One specific lifestyle experiment to try in the ${horizonLabel}",
  "prediction": "If they maintain current trajectory, skin score in the ${horizonLabel} will be approximately X (or 'too early to predict' if confidence is low)"
}`
      }]
    });

    const raw = message.content[0].text.trim();
    const json = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");
    const analysis = JSON.parse(json);

    res.json({
      ...analysis,
      tag_impact: tagImpact,
      overall_avg: Math.round(overallAvg),
      weekly_trend: weeklyTrend,
      scan_count: scans.length,
      span_days: spanDays,        // 真实观察窗口（天）
      window_label: windowLabel,  // 给 UI 用的可读文案
      limited_data: limitedData,  // UI 可据此显示低置信度 badge
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Deep analysis error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /ai/diary-correlation/:userId — 日记标签与皮肤分数的关联（轻量版，不需要 Claude）
app.get("/ai/diary-correlation/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const db = client.db(process.env.DB_NAME);

    const scans = await db.collection("scans")
      .find({ user_id: userId, diary_tags: { $exists: true, $not: { $size: 0 } } })
      .sort({ scan_date: -1 })
      .limit(60)
      .toArray();

    if (scans.length < 3) {
      return res.json({ correlations: [], message: "Need more diary entries for correlation." });
    }

    const overallAvg = scans.reduce((s, r) => s + (r.skin_score ?? 100), 0) / scans.length;
    const tagScores = {};
    scans.forEach(s => {
      (s.diary_tags ?? []).forEach(tag => {
        if (!tagScores[tag]) tagScores[tag] = [];
        tagScores[tag].push(s.skin_score ?? 100);
      });
    });

    const correlations = Object.entries(tagScores)
      .filter(([, scores]) => scores.length >= 2)
      .map(([tag, scores]) => {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return {
          tag,
          count: scores.length,
          avg_score: Math.round(avg),
          impact: Math.round(avg - overallAvg),
          label: avg > overallAvg + 3 ? "beneficial" : avg < overallAvg - 3 ? "harmful" : "neutral"
        };
      })
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    res.json({ correlations, overall_avg: Math.round(overallAvg), scan_count: scans.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/scans/:id/diary", async (req, res) => {
  try {
    const { id } = req.params;
    const { note, tags } = req.body; // note: 文字备注, tags: ['sleep_bad', 'lots_of_water', ...]
    const db = client.db(process.env.DB_NAME);
    const { ObjectId } = require("mongodb");

    await db
      .collection("scans")
      .updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            diary_note: note,
            diary_tags: tags ?? [],
            diary_updated_at: new Date().toISOString(),
          },
        },
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
