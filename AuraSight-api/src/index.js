require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");

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

function calcSkinStatus(totalCount) {
  if (totalCount === 0) return "clear";
  if (totalCount <= 5) return "mild";
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

// ─── Routes ───────────────────────────────────────────────

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", app: "AuraSight API", version: "1.0.0" });
});

// ── Scans ─────────────────────────────────────────────────

/**
 * POST /scans
 * 保存今日扫描记录
 */
app.post("/scans", async (req, res) => {
  try {
    const { user_id, scan_date, body_zone, detections, image_uri, notes } =
      req.body;

    if (!user_id || !scan_date || !body_zone) {
      return res.status(400).json({
        error: "Missing required fields: user_id, scan_date, body_zone",
      });
    }

    const record = {
      user_id,
      scan_date: new Date(scan_date),
      body_zone,
      detections: detections ?? [],
      image_uri: image_uri ?? null,
      notes: notes ?? null,
      total_count: (detections ?? []).length,
      skin_status: calcSkinStatus((detections ?? []).length),
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
 * DELETE /scans/:id
 * 删除一条记录
 */
app.delete("/scans/:id", async (req, res) => {
  try {
    await scansCollection().deleteOne({ _id: new ObjectId(req.params.id) });
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
