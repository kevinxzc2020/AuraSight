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

function pointsCollection() {
  return db.collection("points");
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

    // 简单 hash（生产环境用 bcrypt，MVP 先用这个）
    const crypto = require("crypto");
    const hash = crypto.createHash("sha256").update(password).digest("hex");

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

    const crypto = require("crypto");
    const hash = crypto.createHash("sha256").update(password).digest("hex");

    const user = await usersCollection().findOne({
      email: email.toLowerCase(),
      password: hash,
    });

    if (!user)
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
        .find({ user_id: userId, scan_date: { $gte: weekStart.toISOString() } })
        .toArray(),
      db
        .collection("scans")
        .find({
          user_id: userId,
          scan_date: {
            $gte: lastStart.toISOString(),
            $lt: weekStart.toISOString(),
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

// PATCH /scans/:id/diary — 给扫描记录添加日记备注
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
