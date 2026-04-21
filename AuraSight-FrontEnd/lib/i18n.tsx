// 简易 i18n —— 字典式，不引入额外依赖
// 使用方式：
//   const { t, lang, setLang } = useT();
//   <Text>{t("settings.title")}</Text>
//   <Text>{t("home.greeting", { name: "Kevin" })}</Text>  // 支持 {{var}} 插值
// 新字符串只需要在 STRINGS 里加 key，未翻译的 key 会 fallback 回英文再 fallback 回 key 本身
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export type Lang = "en" | "zh" | "es";
const STORAGE_KEY = "@aurasight_lang";

// ─── 字典 ─────────────────────────────────────────────────
// 规则：key 用点号分层 (page.section.item)。未加 key 的文案原样显示英文，
// 所以不必一次翻译所有字符串——增量迁移即可。
// 支持 {{var}} 插值: t("key", { name: "Kevin" })
const STRINGS: Record<string, Record<string, string>> = {

  // ═══════════════════════════════════════════════════════════
  // 通用
  // ═══════════════════════════════════════════════════════════
  "common.back":     { en: "‹ Back",     zh: "‹ 返回",   es: "‹ Atrás" },
  "common.cancel":   { en: "Cancel",     zh: "取消",     es: "Cancelar" },
  "common.delete":   { en: "Delete",     zh: "删除",     es: "Eliminar" },
  "common.save":     { en: "Save",       zh: "保存",     es: "Guardar" },
  "common.done":     { en: "Done",       zh: "完成",     es: "Listo" },
  "common.gotIt":    { en: "Got it",     zh: "知道了",   es: "Entendido" },
  "common.continue": { en: "Continue",   zh: "继续",     es: "Continuar" },
  "common.upgrade":  { en: "Upgrade",    zh: "升级",     es: "Mejorar" },
  "common.open":     { en: "Open",       zh: "打开",     es: "Abrir" },
  "common.iAgree":   { en: "I agree",    zh: "我同意",   es: "Acepto" },
  "common.revoke":   { en: "Revoke",     zh: "撤销",     es: "Revocar" },
  "common.signIn":   { en: "Sign In",    zh: "登录",     es: "Iniciar sesión" },
  "common.unlock":   { en: "Unlock",     zh: "解锁",     es: "Desbloquear" },
  "common.scan":     { en: "Scan",       zh: "扫描",     es: "Escanear" },
  "common.close":    { en: "Close",      zh: "关闭",     es: "Cerrar" },
  "common.ok":       { en: "OK",         zh: "好",       es: "OK" },
  "common.error":    { en: "Error",      zh: "错误",     es: "Error" },
  "common.retry":    { en: "Retry",      zh: "重试",     es: "Reintentar" },
  "common.loading":  { en: "Loading…",   zh: "加载中…",  es: "Cargando…" },
  "common.noData":   { en: "No data",    zh: "暂无数据", es: "Sin datos" },

  // ═══════════════════════════════════════════════════════════
  // Tab bar
  // ═══════════════════════════════════════════════════════════
  "tabs.home":     { en: "Home",     zh: "首页",   es: "Inicio" },
  "tabs.camera":   { en: "Scan",     zh: "扫描",   es: "Escanear" },
  "tabs.history":  { en: "History",  zh: "历史",   es: "Historial" },
  "tabs.report":   { en: "Report",   zh: "报告",   es: "Informe" },
  "tabs.profile":  { en: "Profile",  zh: "我的",   es: "Perfil" },

  // ═══════════════════════════════════════════════════════════
  // Home 首页
  // ═══════════════════════════════════════════════════════════

  // Greetings (with name)
  "home.greet.nightOwl":      { en: "Hey {{name}}, burning the midnight oil?", zh: "嘿 {{name}}，夜猫子啊？",       es: "Oye {{name}}, ¿quemando el aceite de medianoche?" },
  "home.greet.nightOwlAnon":  { en: "Hey, night owl",                         zh: "嘿，夜猫子",                    es: "Hola, noctámbulo" },
  "home.greet.morning":       { en: "Good morning, {{name}}",                 zh: "早上好，{{name}}",              es: "Buenos días, {{name}}" },
  "home.greet.morningAnon":   { en: "Good morning",                           zh: "早上好",                        es: "Buenos días" },
  "home.greet.afternoon":     { en: "Good afternoon, {{name}}",               zh: "下午好，{{name}}",              es: "Buenas tardes, {{name}}" },
  "home.greet.afternoonAnon": { en: "Good afternoon",                         zh: "下午好",                        es: "Buenas tardes" },
  "home.greet.evening":       { en: "Good evening, {{name}}",                 zh: "晚上好，{{name}}",              es: "Buenas noches, {{name}}" },
  "home.greet.eveningAnon":   { en: "Good evening",                           zh: "晚上好",                        es: "Buenas noches" },
  "home.greet.lateNight":     { en: "Still up, {{name}}?",                    zh: "还没睡，{{name}}？",            es: "¿Sigues despierto, {{name}}?" },
  "home.greet.lateNightAnon": { en: "Still up?",                              zh: "还没睡？",                      es: "¿Sigues despierto?" },

  // Day of week messages
  "home.dayMsg.0": { en: "Sunday — slow down, recharge, and let your skin breathe.",            zh: "周日 — 放慢脚步，充充电，让皮肤自由呼吸。",      es: "Domingo — relájate, recarga y deja que tu piel respire." },
  "home.dayMsg.1": { en: "Monday — fresh start! A little discipline goes a long way.",          zh: "周一 — 新的开始！一点自律受益匪浅。",             es: "Lunes — ¡nuevo comienzo! Un poco de disciplina va lejos." },
  "home.dayMsg.2": { en: "Tuesday — keep the momentum going, you're doing great.",              zh: "周二 — 保持势头，你做得很好。",                   es: "Martes — mantén el impulso, lo estás haciendo genial." },
  "home.dayMsg.3": { en: "Wednesday — halfway there. Stay hydrated & stay consistent.",         zh: "周三 — 一周过半。多喝水，保持一致。",             es: "Miércoles — a mitad de semana. Hidrátate y sé constante." },
  "home.dayMsg.4": { en: "Thursday — almost weekend! Don't skip your routine tonight.",         zh: "周四 — 快到周末了！今晚别偷懒跳过护肤。",        es: "Jueves — ¡casi fin de semana! No te saltes tu rutina." },
  "home.dayMsg.5": { en: "Friday — you made it. Treat yourself, but wash your face first.",    zh: "周五 — 你撑过来了。犒劳自己，但先洗脸。",        es: "Viernes — lo lograste. Date un gusto, pero lávate la cara primero." },
  "home.dayMsg.6": { en: "Saturday — relax day. A scan only takes 10 seconds.",                 zh: "周六 — 放松日。扫描只需 10 秒。",                es: "Sábado — día de relax. Un escaneo solo toma 10 segundos." },

  // Milestones
  "home.milestone.trendChart":  { en: "Trend Chart",  zh: "趋势图表", es: "Gráfico de tendencia" },
  "home.milestone.causeReport": { en: "Cause Report",  zh: "原因报告", es: "Informe de causas" },
  "home.milestone.pdfExport":   { en: "PDF Export",    zh: "PDF 导出", es: "Exportar PDF" },
  "home.milestone.vipTrial":    { en: "VIP Trial",     zh: "VIP 试用", es: "Prueba VIP" },

  // Skin Score Hero
  "home.yourSkinScore":        { en: "YOUR SKIN SCORE",                zh: "你的皮肤评分",           es: "TU PUNTUACIÓN DE PIEL" },
  "home.condition.excellent":  { en: "Excellent condition",            zh: "状态极佳",               es: "Excelente condición" },
  "home.condition.good":       { en: "Looking good",                   zh: "状态不错",               es: "Se ve bien" },
  "home.condition.needsCare":  { en: "Needs some care",                zh: "需要护理",               es: "Necesita cuidado" },
  "home.condition.noScan":     { en: "No scan yet",                    zh: "还没扫描",               es: "Sin escaneo aún" },
  "home.change.startScan":     { en: "Start scanning to track trends", zh: "开始扫描来追踪趋势",     es: "Empieza a escanear para seguir tendencias" },
  "home.change.up":            { en: "↑ +{{n}} from last week",        zh: "↑ +{{n}} 相比上周",      es: "↑ +{{n}} desde la semana pasada" },
  "home.change.down":          { en: "↓ {{n}} from last week",         zh: "↓ {{n}} 相比上周",       es: "↓ {{n}} desde la semana pasada" },
  "home.change.none":          { en: "No change from last week",       zh: "和上周一样",             es: "Sin cambios desde la semana pasada" },
  "home.pts":                  { en: "pts",                            zh: "分",                    es: "pts" },
  "home.today":                { en: "today",                          zh: "今天",                  es: "hoy" },
  "home.next":                 { en: "Next: {{label}} · {{cur}} / {{max}} pts", zh: "下一步: {{label}} · {{cur}} / {{max}} 分", es: "Siguiente: {{label}} · {{cur}} / {{max}} pts" },

  // Daily Check-in
  "home.dailyCheckin":         { en: "Daily Check-in",                 zh: "每日打卡",               es: "Check-in diario" },
  "home.doneToday":            { en: "✓ Done today",                   zh: "✓ 今日已完成",           es: "✓ Hecho hoy" },
  "home.mainProgress":         { en: "{{done}}/1 main",               zh: "{{done}}/1 主要",        es: "{{done}}/1 principal" },
  "home.bonusProgress":        { en: "{{done}}/{{total}} bonus",      zh: "{{done}}/{{total}} 额外", es: "{{done}}/{{total}} bonus" },
  "home.ptsToday":             { en: "{{pts}} pts today",              zh: "今日 {{pts}} 分",        es: "{{pts}} pts hoy" },
  "home.checkinComplete":      { en: "Daily check-in complete!",       zh: "每日打卡完成！",          es: "¡Check-in diario completado!" },
  "home.checkinReward":        { en: "+50 pts earned · streak protected today", zh: "+50 分到手 · 今日连签已保护", es: "+50 pts ganados · racha protegida hoy" },
  "home.faceChecked":          { en: "Face checked in ✓",              zh: "面部已打卡 ✓",           es: "Rostro registrado ✓" },
  "home.howsSkin":             { en: "How's your skin today?",         zh: "今天皮肤怎么样？",        es: "¿Cómo está tu piel hoy?" },
  "home.faceScanSub":          { en: "+50 pts · 30-second face scan",  zh: "+50 分 · 30 秒面部扫描", es: "+50 pts · escaneo facial de 30 segundos" },
  "home.vipExclusive":         { en: "VIP exclusive",                  zh: "VIP 专属",               es: "Exclusivo VIP" },

  // Extra tasks
  "home.task.mood":            { en: "Rate your skin mood",            zh: "给你的皮肤心情打分",      es: "Califica tu estado de piel" },
  "home.task.moodSub":         { en: "+10 pts · takes 5 seconds",      zh: "+10 分 · 5 秒完成",      es: "+10 pts · toma 5 segundos" },
  "home.task.moodBtn":         { en: "Rate",                           zh: "打分",                   es: "Calificar" },
  "home.task.tip":             { en: "Read today's skin tip",          zh: "阅读今日护肤贴士",        es: "Lee el consejo de piel de hoy" },
  "home.task.tipSub":          { en: "+5 pts · new tip every day",     zh: "+5 分 · 每天一个新贴士", es: "+5 pts · un consejo nuevo cada día" },
  "home.task.tipBtn":          { en: "Read",                           zh: "阅读",                   es: "Leer" },
  "home.task.trend":           { en: "Check your 7-day trend",         zh: "查看 7 天趋势",          es: "Revisa tu tendencia de 7 días" },
  "home.task.trendSub":        { en: "+10 pts · see how you're progressing",  zh: "+10 分 · 看看你的进展", es: "+10 pts · mira tu progreso" },
  "home.task.trendBtn":        { en: "View",                           zh: "查看",                   es: "Ver" },
  "home.task.report":          { en: "Review last scan report",        zh: "查看上次扫描报告",        es: "Revisa el último informe" },
  "home.task.reportSub":       { en: "+10 pts · understand your results",     zh: "+10 分 · 了解你的结果", es: "+10 pts · entiende tus resultados" },
  "home.task.reportBtn":       { en: "Open",                           zh: "打开",                   es: "Abrir" },
  "home.task.aiReport":        { en: "Generate AI skin analysis",      zh: "生成 AI 皮肤分析",       es: "Genera análisis AI de piel" },
  "home.task.aiReportSub":     { en: "+20 pts · deep dive into your skin health", zh: "+20 分 · 深入了解皮肤健康", es: "+20 pts · análisis profundo de tu piel" },
  "home.task.aiReportBtn":     { en: "Unlock",                         zh: "解锁",                   es: "Desbloquear" },
  "home.task.aiChat":          { en: "Chat with your skin advisor",    zh: "与皮肤顾问聊天",          es: "Chatea con tu asesor de piel" },
  "home.task.aiChatSub":       { en: "+15 pts · personalized advice just for you", zh: "+15 分 · 为你定制的个性化建议", es: "+15 pts · consejos personalizados para ti" },
  "home.task.aiChatBtn":       { en: "Unlock",                         zh: "解锁",                   es: "Desbloquear" },

  // Skin tips (rotates daily)
  "home.tip.0":  { en: "Cleanse twice daily — morning removes overnight oils, evening removes pollutants and makeup.", zh: "每天洁面两次——早上清除隔夜油脂，晚上清除污染物和彩妆。", es: "Limpia dos veces al día — por la mañana elimina aceites nocturnos, por la noche contaminantes y maquillaje." },
  "home.tip.1":  { en: "SPF 30+ every morning, even on cloudy days. UV rays penetrate clouds and windows.", zh: "每天早上涂 SPF 30+ 防晒，阴天也不例外。紫外线能穿透云层和窗户。", es: "SPF 30+ cada mañana, incluso en días nublados. Los rayos UV penetran nubes y ventanas." },
  "home.tip.2":  { en: "Touching your face transfers bacteria. Keep hands away between cleansing routines.", zh: "摸脸会传递细菌。洁面之间请让手远离脸部。", es: "Tocar tu cara transfiere bacterias. Mantén las manos lejos entre rutinas de limpieza." },
  "home.tip.3":  { en: "Pillowcases collect oil and bacteria. Change them at least once a week.", zh: "枕套会积累油脂和细菌。至少每周换一次。", es: "Las fundas de almohada acumulan grasa y bacterias. Cámbialas al menos una vez por semana." },
  "home.tip.4":  { en: "Lukewarm water is ideal for washing. Hot water strips your skin's natural barrier.", zh: "温水是洗脸的最佳选择。热水会破坏皮肤的天然屏障。", es: "El agua tibia es ideal para lavarse. El agua caliente daña la barrera natural de tu piel." },
  "home.tip.5":  { en: "Stress triggers cortisol, which increases oil production and breakouts.", zh: "压力会触发皮质醇，导致油脂分泌增加和痘痘爆发。", es: "El estrés activa el cortisol, que aumenta la producción de grasa y los brotes." },
  "home.tip.6":  { en: "Retinol at night, vitamin C in the morning — they work best at different times.", zh: "晚上用视黄醇，早上用维生素 C——它们在不同时间效果最佳。", es: "Retinol por la noche, vitamina C por la mañana — funcionan mejor en diferentes momentos." },
  "home.tip.7":  { en: "Hydration shows in your skin. Dehydrated skin overproduces oil to compensate.", zh: "补水效果直接体现在皮肤上。缺水的皮肤会过度分泌油脂来补偿。", es: "La hidratación se nota en tu piel. La piel deshidratada produce exceso de grasa para compensar." },
  "home.tip.8":  { en: "Pat dry, don't rub. Rubbing with a towel creates micro-tears in skin.", zh: "轻拍擦干，不要搓。用毛巾搓会造成皮肤微裂伤。", es: "Seca con palmaditas, no frotes. Frotar con una toalla crea micro-desgarros en la piel." },
  "home.tip.9":  { en: "Always apply skincare to slightly damp skin — it absorbs actives better.", zh: "护肤品要涂在微湿的皮肤上——这样吸收活性成分更好。", es: "Aplica siempre el cuidado de la piel sobre piel ligeramente húmeda — absorbe mejor los activos." },
  "home.tip.10": { en: "Spot treatments work best applied to a clean face before moisturiser.", zh: "祛痘产品在清洁面部后、保湿前使用效果最好。", es: "Los tratamientos localizados funcionan mejor aplicados sobre rostro limpio antes de hidratar." },
  "home.tip.11": { en: "Exfoliate 1-2x per week max. Over-exfoliation weakens your skin barrier.", zh: "每周最多去角质 1-2 次。过度去角质会削弱皮肤屏障。", es: "Exfolia 1-2 veces por semana máximo. La exfoliación excesiva debilita la barrera cutánea." },
  "home.tip.12": { en: "Antioxidants in your diet (berries, green tea) help fight skin-damaging free radicals.", zh: "饮食中的抗氧化剂（莓果、绿茶）有助于对抗损害皮肤的自由基。", es: "Los antioxidantes en tu dieta (bayas, té verde) ayudan a combatir los radicales libres." },
  "home.tip.13": { en: "The skin around your eyes is thinnest — use a dedicated eye cream, gently.", zh: "眼周皮肤最薄——请使用专门的眼霜，轻柔涂抹。", es: "La piel alrededor de tus ojos es la más fina — usa una crema de ojos dedicada, con suavidad." },
  "home.tip.14": { en: "Consistency beats intensity. A simple routine done daily beats an elaborate one done rarely.", zh: "坚持胜过强度。每天坚持简单的护肤流程比偶尔做复杂流程更有效。", es: "La constancia vence a la intensidad. Una rutina simple diaria supera a una elaborada hecha raramente." },

  // Spots modal
  "home.spotAnalysis":         { en: "Spot Analysis",                  zh: "痘痘分析",               es: "Análisis de manchas" },
  "home.latestResults":        { en: "Latest scan results",            zh: "最近扫描结果",           es: "Últimos resultados" },
  "home.totalSpots":           { en: "Total Spots",                    zh: "总痘痘数",               es: "Total de manchas" },
  "home.severity.clear":       { en: "Clear",                          zh: "无痘",                   es: "Limpio" },
  "home.severity.mild":        { en: "Mild",                           zh: "轻度",                   es: "Leve" },
  "home.severity.moderate":    { en: "Moderate",                       zh: "中度",                   es: "Moderado" },
  "home.severity.severe":      { en: "Severe",                         zh: "重度",                   es: "Severo" },
  "home.lastScan":             { en: "Last scan · {{date}}",           zh: "上次扫描 · {{date}}",    es: "Último escaneo · {{date}}" },
  "home.spotsDetected":        { en: "{{n}} spot{{s}} detected · colored markers show location & type", zh: "检测到 {{n}} 个痘痘 · 彩色标记显示位置和类型", es: "{{n}} mancha{{s}} detectada{{s}} · marcadores de colores muestran ubicación y tipo" },
  "home.breakdownByType":      { en: "Breakdown by Type",              zh: "按类型分布",             es: "Desglose por tipo" },
  "home.noSpotData":           { en: "No spot data yet",               zh: "暂无痘痘数据",           es: "Sin datos de manchas aún" },
  "home.noSpotDataSub":        { en: "Do your first face scan to see breakdown", zh: "完成第一次面部扫描查看详情", es: "Haz tu primer escaneo facial para ver el desglose" },
  "home.viewFullReport":       { en: "View Full Report",               zh: "查看完整报告",           es: "Ver informe completo" },

  // Acne types
  "acne.pustule":     { en: "Pustules",   zh: "脓疱",   es: "Pústulas" },
  "acne.pustuleDesc": { en: "Inflamed, pus-filled lesions", zh: "发炎的脓疱性病变", es: "Lesiones inflamadas llenas de pus" },
  "acne.broken":      { en: "Wound",      zh: "伤口",   es: "Herida" },
  "acne.brokenDesc":  { en: "Picked or burst pimple, open wound", zh: "挤破的痘痘，开放性伤口", es: "Grano reventado, herida abierta" },
  "acne.redness":     { en: "Redness",    zh: "红斑",   es: "Enrojecimiento" },
  "acne.rednessDesc": { en: "Inflammatory redness patches", zh: "炎性红斑", es: "Parches de enrojecimiento inflamatorio" },
  "acne.scab":        { en: "Scabs",      zh: "结痂",   es: "Costras" },
  "acne.scabDesc":    { en: "Healing or dried lesions", zh: "愈合中或干燥的病变", es: "Lesiones en proceso de curación o secas" },

  // Mood modal
  "home.moodTitle":            { en: "How's your skin today?",         zh: "今天皮肤感觉怎么样？",    es: "¿Cómo está tu piel hoy?" },
  "home.moodSub":              { en: "Tap to rate · earns +10 pts",    zh: "点击评分 · 赚 +10 分",   es: "Toca para calificar · gana +10 pts" },
  "home.mood.bad":             { en: "Bad",                            zh: "很差",                   es: "Mal" },
  "home.mood.meh":             { en: "Meh",                            zh: "一般",                   es: "Meh" },
  "home.mood.okay":            { en: "Okay",                           zh: "还行",                   es: "Bien" },
  "home.mood.good":            { en: "Good",                           zh: "不错",                   es: "Bueno" },
  "home.mood.amazing":         { en: "Amazing",                        zh: "超棒",                   es: "Genial" },
  "home.moodSave":             { en: "Save & earn 10 pts",             zh: "保存并获得 10 分",        es: "Guardar y ganar 10 pts" },

  // Tip modal
  "home.tipTitle":             { en: "Today's Skin Tip 💡",            zh: "今日护肤贴士 💡",         es: "Consejo de piel del día 💡" },
  "home.tipSub":               { en: "Earn +5 pts for reading",        zh: "阅读赚 +5 分",           es: "Gana +5 pts por leer" },
  "home.tipGotIt":             { en: "Got it! +5 pts",                 zh: "知道了！+5 分",           es: "¡Entendido! +5 pts" },

  // Weekly insight
  "home.weeklyInsight":        { en: "Weekly Insight",                 zh: "每周洞察",               es: "Resumen semanal" },
  "home.free":                 { en: "✓ Free",                         zh: "✓ 免费",                 es: "✓ Gratis" },
  "home.avgScore":             { en: "Avg score",                      zh: "平均分",                 es: "Puntaje promedio" },
  "home.vsLastWeek":           { en: "vs last week",                   zh: "对比上周",               es: "vs semana pasada" },
  "home.scans":                { en: "Scans",                          zh: "扫描次数",               es: "Escaneos" },
  "home.unlockFullReport":     { en: "Unlock full report → VIP ✦",     zh: "解锁完整报告 → VIP ✦",   es: "Desbloquear informe → VIP ✦" },

  // Today stats
  "home.todayLabel":           { en: "Today",                          zh: "今天",                   es: "Hoy" },
  "home.noScanToday":          { en: "No scan yet today",              zh: "今天还没扫描",           es: "Sin escaneo hoy" },
  "home.noScanTodaySub":       { en: "Take a quick photo to update your daily stats", zh: "拍张快照更新你的每日数据", es: "Toma una foto rápida para actualizar tus datos diarios" },
  "home.spots":                { en: "Spots",                          zh: "痘痘",                   es: "Manchas" },
  "home.skinScore":            { en: "Skin Score",                     zh: "皮肤评分",               es: "Puntaje de piel" },

  // AI advisor
  "home.aiAdvisor":            { en: "AI Skin Advisor",                zh: "AI 皮肤顾问",            es: "Asesor AI de piel" },
  "home.aiLive":               { en: "Live",                           zh: "在线",                   es: "En vivo" },
  "home.aiDefault":            { en: "Tap to get personalized advice from your AI consultant", zh: "点击获取 AI 顾问的个性化建议", es: "Toca para recibir consejos personalizados de tu consultor AI" },

  // Guest banner
  "home.guestBanner":          { en: "Sign up to sync your data across devices", zh: "注册以跨设备同步数据", es: "Regístrate para sincronizar tus datos entre dispositivos" },

  // Streak
  "home.streak":               { en: "{{n}}d streak",                  zh: "连续 {{n}} 天",          es: "{{n}} días seguidos" },

  // ═══════════════════════════════════════════════════════════
  // Camera 扫描页
  // ═══════════════════════════════════════════════════════════
  "camera.title":              { en: "Skin Scanner",                   zh: "皮肤扫描仪",             es: "Escáner de piel" },
  "camera.centerFace":         { en: "Center your face in the frame",  zh: "将面部对准取景框中央",     es: "Centra tu rostro en el marco" },
  "camera.takePhoto":          { en: "Take Photo",                     zh: "拍照",                   es: "Tomar foto" },
  "camera.gallery":            { en: "Gallery",                        zh: "相册",                   es: "Galería" },
  "camera.analyzing":          { en: "Analyzing your skin…",           zh: "正在分析你的皮肤…",       es: "Analizando tu piel…" },
  "camera.saving":             { en: "Saving scan…",                   zh: "正在保存扫描…",           es: "Guardando escaneo…" },
  "camera.saveScan":           { en: "Save Scan",                      zh: "保存扫描",               es: "Guardar escaneo" },
  "camera.retake":             { en: "Retake",                         zh: "重拍",                   es: "Retomar" },
  "camera.notSkinTitle":       { en: "Not a skin photo",               zh: "不是皮肤照片",           es: "No es una foto de piel" },
  "camera.notSkinMsg":         { en: "Please take or select a close-up photo of your face/skin so we can analyze it accurately.", zh: "请拍摄或选择面部/皮肤的特写照片以便准确分析。", es: "Por favor, toma o selecciona una foto de primer plano de tu rostro/piel para analizarla con precisión." },
  "camera.quotaUsed":          { en: "AI detection used for this week", zh: "本周 AI 检测次数已用完", es: "Detección AI usada esta semana" },
  "camera.quotaMsg":           { en: "Free plan includes {{n}} AI scan per week.\nUpgrade to VIP for unlimited detection & tracking.", zh: "免费版每周包含 {{n}} 次 AI 扫描。\n升级 VIP 享受无限检测和追踪。", es: "El plan gratis incluye {{n}} escaneo AI por semana.\nMejora a VIP para detección y seguimiento ilimitados." },
  "camera.upgradeVip":         { en: "Upgrade to VIP",                 zh: "升级 VIP",               es: "Mejorar a VIP" },
  "camera.watchAd":            { en: "🎬 Watch Ad for 1 Free Scan",    zh: "🎬 看广告获取 1 次免费扫描", es: "🎬 Ve un anuncio por 1 escaneo gratis" },
  "camera.saveWithout":        { en: "Or tap Save to keep the photo without detection.", zh: "或点保存以保留照片（无检测）。", es: "O toca Guardar para conservar la foto sin detección." },
  "camera.noAi":               { en: "AI analysis unavailable — scan will be saved without spot detection.", zh: "AI 分析不可用——扫描将保存但不含痘痘检测。", es: "Análisis AI no disponible — el escaneo se guardará sin detección de manchas." },
  "camera.weeklyQuota":        { en: "{{remaining}}/{{total}} AI scans left", zh: "剩余 {{remaining}}/{{total}} 次 AI 扫描", es: "{{remaining}}/{{total}} escaneos AI restantes" },
  "camera.consentTitle":       { en: "Data Use Consent",               zh: "数据使用同意",           es: "Consentimiento de uso de datos" },
  "camera.consentMsg":         { en: "To use AI analysis, please agree to our data use policy. Your photos are processed securely and never shared.", zh: "要使用 AI 分析，请同意我们的数据使用政策。你的照片会被安全处理，绝不共享。", es: "Para usar el análisis AI, acepta nuestra política de uso de datos. Tus fotos se procesan de forma segura y nunca se comparten." },
  "camera.saved":              { en: "Scan saved!",                    zh: "扫描已保存！",           es: "¡Escaneo guardado!" },
  "camera.flip":               { en: "Flip",                           zh: "翻转",                   es: "Voltear" },
  "camera.permissionTitle":    { en: "Camera Permission",              zh: "相机权限",               es: "Permiso de cámara" },
  "camera.permissionMsg":      { en: "We need camera access to scan your skin.", zh: "我们需要相机权限来扫描你的皮肤。", es: "Necesitamos acceso a la cámara para escanear tu piel." },
  "camera.countdown":          { en: "{{n}}",                          zh: "{{n}}",                  es: "{{n}}" },

  // ═══════════════════════════════════════════════════════════
  // History 历史页
  // ═══════════════════════════════════════════════════════════
  "history.title":             { en: "Scan History",                   zh: "扫描历史",               es: "Historial de escaneos" },
  "history.sub":               { en: "Track your skin journey",        zh: "追踪你的皮肤旅程",       es: "Sigue tu viaje de piel" },
  "history.empty":             { en: "No scans yet",                   zh: "还没有扫描记录",          es: "Sin escaneos aún" },
  "history.emptySub":          { en: "Your scan history will appear here after your first scan.", zh: "完成第一次扫描后，你的扫描记录将显示在这里。", es: "Tu historial de escaneos aparecerá aquí después de tu primer escaneo." },
  "history.startScan":         { en: "Start First Scan",               zh: "开始第一次扫描",         es: "Iniciar primer escaneo" },
  "history.spotsDetected":     { en: "{{n}} spots",                    zh: "{{n}} 个痘痘",           es: "{{n}} manchas" },
  "history.noSpots":           { en: "No spots",                       zh: "无痘痘",                 es: "Sin manchas" },
  "history.score":             { en: "Score: {{n}}",                   zh: "评分: {{n}}",            es: "Puntaje: {{n}}" },
  "history.deleteTitle":       { en: "Delete scan?",                   zh: "删除扫描？",             es: "¿Eliminar escaneo?" },
  "history.deleteMsg":         { en: "This scan record will be permanently deleted.", zh: "此扫描记录将被永久删除。", es: "Este registro de escaneo será eliminado permanentemente." },
  "history.filter.all":        { en: "All",                            zh: "全部",                   es: "Todo" },
  "history.filter.7d":         { en: "7d",                             zh: "7天",                    es: "7d" },
  "history.filter.30d":        { en: "30d",                            zh: "30天",                   es: "30d" },
  "history.filter.90d":        { en: "90d",                            zh: "90天",                   es: "90d" },

  // ═══════════════════════════════════════════════════════════
  // Report 报告页
  // ═══════════════════════════════════════════════════════════
  "report.title":              { en: "Skin Report",                    zh: "皮肤报告",               es: "Informe de piel" },
  "report.sub":                { en: "Your weekly skin analysis",      zh: "你的每周皮肤分析",        es: "Tu análisis semanal de piel" },
  "report.overview":           { en: "Overview",                       zh: "概览",                   es: "Resumen" },
  "report.trend":              { en: "Trend",                          zh: "趋势",                   es: "Tendencia" },
  "report.details":            { en: "Details",                        zh: "详情",                   es: "Detalles" },
  "report.aiReport":           { en: "AI Report",                      zh: "AI 报告",                es: "Informe AI" },
  "report.generateAi":         { en: "Generate AI Report",             zh: "生成 AI 报告",           es: "Generar informe AI" },
  "report.generating":         { en: "Generating your report…",        zh: "正在生成报告…",           es: "Generando tu informe…" },
  "report.aiError":            { en: "Unable to generate report right now. Please try again later.", zh: "暂时无法生成报告，请稍后重试。", es: "No se puede generar el informe ahora. Intenta de nuevo más tarde." },
  "report.weeklyScore":        { en: "Weekly Score",                   zh: "每周评分",               es: "Puntaje semanal" },
  "report.totalScans":         { en: "Total Scans",                    zh: "总扫描次数",             es: "Total de escaneos" },
  "report.avgSpots":           { en: "Avg Spots",                      zh: "平均痘痘",               es: "Manchas promedio" },
  "report.improvement":        { en: "Improvement",                    zh: "改善",                   es: "Mejora" },
  "report.noData":             { en: "Not enough data yet",            zh: "数据还不够",             es: "Aún no hay suficientes datos" },
  "report.noDataSub":          { en: "Scan for a few days to see your report.", zh: "扫描几天后就能看到报告了。", es: "Escanea durante unos días para ver tu informe." },
  "report.vipLock":            { en: "VIP Feature",                    zh: "VIP 功能",               es: "Función VIP" },
  "report.vipLockSub":         { en: "Upgrade to unlock full AI skin analysis", zh: "升级解锁完整 AI 皮肤分析", es: "Mejora para desbloquear el análisis AI completo" },
  // VIP preview insights
  "report.insight.triggers":       { en: "Trigger Analysis",           zh: "诱因分析",               es: "Análisis de desencadenantes" },
  "report.insight.triggersSub":    { en: "Identify what's causing your breakouts", zh: "找出导致痘痘的原因", es: "Identifica qué causa tus brotes" },
  "report.insight.trends":         { en: "Trend Prediction",           zh: "趋势预测",               es: "Predicción de tendencia" },
  "report.insight.trendsSub":      { en: "See where your skin is heading", zh: "看看你的皮肤走势", es: "Mira hacia dónde va tu piel" },
  "report.insight.products":       { en: "Product Matching",           zh: "产品匹配",               es: "Coincidencia de productos" },
  "report.insight.productsSub":    { en: "Get product recommendations for your skin type", zh: "获取适合你肤质的产品推荐", es: "Obtén recomendaciones de productos para tu tipo de piel" },

  // ═══════════════════════════════════════════════════════════
  // Profile 个人页
  // ═══════════════════════════════════════════════════════════
  "profile.title":             { en: "Profile",                        zh: "我的",                   es: "Perfil" },
  "profile.guest":             { en: "Guest",                          zh: "游客",                   es: "Invitado" },
  "profile.guestSub":          { en: "Sign in to sync your data",      zh: "登录以同步数据",          es: "Inicia sesión para sincronizar datos" },
  "profile.editProfile":       { en: "Edit Profile",                   zh: "编辑资料",               es: "Editar perfil" },
  "profile.skinProfile":       { en: "Skin Profile",                   zh: "皮肤档案",               es: "Perfil de piel" },
  "profile.skinProfileSub":    { en: "Skin type, concerns & routine",  zh: "肤质、关注点与护肤流程",  es: "Tipo de piel, preocupaciones y rutina" },
  "profile.settings":          { en: "Settings",                       zh: "设置",                   es: "Ajustes" },
  "profile.vipBadge":          { en: "VIP ✦",                          zh: "VIP ✦",                  es: "VIP ✦" },
  "profile.freeBadge":         { en: "Free",                           zh: "免费",                   es: "Gratis" },
  "profile.totalScans":        { en: "Total Scans",                    zh: "总扫描",                 es: "Total escaneos" },
  "profile.avgScore":          { en: "Avg Score",                      zh: "平均分",                 es: "Puntaje promedio" },
  "profile.streak":            { en: "Streak",                         zh: "连续天数",               es: "Racha" },
  "profile.points":            { en: "Points",                         zh: "积分",                   es: "Puntos" },
  "profile.healthProfile":     { en: "Health Profile",                 zh: "健康档案",               es: "Perfil de salud" },
  "profile.community":         { en: "Community",                      zh: "社区",                   es: "Comunidad" },
  "profile.vipFeatures":       { en: "VIP Features",                   zh: "VIP 功能",               es: "Funciones VIP" },
  "profile.signOut":           { en: "Sign Out",                       zh: "退出登录",               es: "Cerrar sesión" },
  // Skin profile modal
  "profile.sp.title":          { en: "Skin Profile",                   zh: "皮肤档案",               es: "Perfil de piel" },
  "profile.sp.sub":            { en: "Help AI give you better advice", zh: "帮助 AI 给你更好的建议",  es: "Ayuda a la IA a darte mejores consejos" },
  "profile.sp.skinType":       { en: "Skin Type",                      zh: "肤质",                   es: "Tipo de piel" },
  "profile.sp.oily":           { en: "Oily",                           zh: "油性",                   es: "Grasa" },
  "profile.sp.dry":            { en: "Dry",                            zh: "干性",                   es: "Seca" },
  "profile.sp.combination":    { en: "Combination",                    zh: "混合",                   es: "Mixta" },
  "profile.sp.sensitive":      { en: "Sensitive",                      zh: "敏感",                   es: "Sensible" },
  "profile.sp.normal":         { en: "Normal",                         zh: "中性",                   es: "Normal" },
  "profile.sp.concerns":       { en: "Main Concerns",                  zh: "主要关注点",             es: "Preocupaciones principales" },
  "profile.sp.acne":           { en: "Acne",                           zh: "痘痘",                   es: "Acné" },
  "profile.sp.darkSpots":      { en: "Dark Spots",                     zh: "色斑",                   es: "Manchas oscuras" },
  "profile.sp.wrinkles":       { en: "Wrinkles",                       zh: "皱纹",                   es: "Arrugas" },
  "profile.sp.redness":        { en: "Redness",                        zh: "泛红",                   es: "Enrojecimiento" },
  "profile.sp.pores":          { en: "Pores",                          zh: "毛孔",                   es: "Poros" },
  "profile.sp.dryness":        { en: "Dryness",                        zh: "干燥",                   es: "Sequedad" },
  "profile.sp.oiliness":       { en: "Oiliness",                       zh: "出油",                   es: "Oleosidad" },
  "profile.sp.routine":        { en: "Routine Level",                  zh: "护肤程度",               es: "Nivel de rutina" },
  "profile.sp.routineNone":    { en: "None",                           zh: "无",                     es: "Ninguna" },
  "profile.sp.routineSimple":  { en: "Simple",                         zh: "简单",                   es: "Simple" },
  "profile.sp.routineModerate":{ en: "Moderate",                       zh: "适中",                   es: "Moderada" },
  "profile.sp.routineComplex": { en: "Complex",                        zh: "复杂",                   es: "Compleja" },
  "profile.sp.climate":        { en: "Climate",                        zh: "气候",                   es: "Clima" },
  "profile.sp.humid":          { en: "Humid",                          zh: "潮湿",                   es: "Húmedo" },
  "profile.sp.dryClimate":     { en: "Dry",                            zh: "干燥",                   es: "Seco" },
  "profile.sp.temperate":      { en: "Temperate",                      zh: "温带",                   es: "Templado" },
  "profile.sp.tropical":       { en: "Tropical",                       zh: "热带",                   es: "Tropical" },
  "profile.sp.cold":           { en: "Cold",                           zh: "寒冷",                   es: "Frío" },
  "profile.sp.allergies":      { en: "Allergies",                      zh: "过敏",                   es: "Alergias" },
  "profile.sp.allergiesPlaceholder": { en: "e.g. fragrance, salicylic acid…", zh: "如：香料、水杨酸…", es: "ej. fragancias, ácido salicílico…" },
  "profile.sp.aboutYou":       { en: "About You (optional)",           zh: "关于你（可选）",         es: "Sobre ti (opcional)" },
  "profile.sp.gender":         { en: "Gender",                         zh: "性别",                   es: "Género" },
  "profile.sp.birthday":       { en: "Birthday",                       zh: "生日",                   es: "Cumpleaños" },

  // ═══════════════════════════════════════════════════════════
  // Settings 页
  // ═══════════════════════════════════════════════════════════
  "settings.title":            { en: "Settings",                       zh: "设置",                   es: "Ajustes" },
  "settings.section.account":  { en: "ACCOUNT",                        zh: "账户",                   es: "CUENTA" },
  "settings.section.skinGoals":{ en: "SKIN GOALS",                     zh: "肌肤目标",               es: "METAS DE PIEL" },
  "settings.section.notifications": { en: "NOTIFICATIONS",             zh: "通知",                   es: "NOTIFICACIONES" },
  "settings.section.privacy":  { en: "PRIVACY & SECURITY",             zh: "隐私与安全",             es: "PRIVACIDAD Y SEGURIDAD" },
  "settings.section.personalization": { en: "PERSONALIZATION",          zh: "个性化",                 es: "PERSONALIZACIÓN" },
  "settings.section.help":     { en: "HELP & FEEDBACK",                zh: "帮助与反馈",             es: "AYUDA Y COMENTARIOS" },
  "settings.section.dev":      { en: "DEV / TEST",                     zh: "开发 / 测试",            es: "DEV / TEST" },
  "settings.section.about":    { en: "ABOUT",                          zh: "关于",                   es: "ACERCA DE" },
  "settings.name":             { en: "Name",                           zh: "名字",                   es: "Nombre" },
  "settings.email":            { en: "Email",                          zh: "邮箱",                   es: "Correo" },
  "settings.dailyReminder":    { en: "Daily reminder",                 zh: "每日提醒",               es: "Recordatorio diario" },
  "settings.dailyReminder.sub":{ en: "Remind me to scan every day",    zh: "每天提醒我扫描",         es: "Recuérdame escanear cada día" },
  "settings.reminderTime":     { en: "Reminder time",                  zh: "提醒时间",               es: "Hora del recordatorio" },
  "settings.faceId":           { en: "Face ID / Touch ID",             zh: "Face ID / 指纹",         es: "Face ID / Touch ID" },
  "settings.faceId.sub":       { en: "Require biometrics to open",     zh: "打开 App 时需要生物识别", es: "Requerir biometría para abrir" },
  "settings.photoDataUse":     { en: "Allow photo data use",           zh: "允许使用照片数据",        es: "Permitir uso de datos fotográficos" },
  "settings.privacyPolicy":    { en: "Privacy Policy",                 zh: "隐私政策",               es: "Política de privacidad" },
  "settings.terms":            { en: "Terms of Service",               zh: "服务条款",               es: "Términos de servicio" },
  "settings.language":         { en: "Language",                        zh: "语言",                   es: "Idioma" },
  "settings.appearance":       { en: "Appearance",                     zh: "外观",                   es: "Apariencia" },
  "settings.appearance.lightLabel": { en: "Light",                     zh: "浅色",                   es: "Claro" },
  "settings.appearance.darkSoon": { en: "Dark mode coming soon",       zh: "深色模式即将推出",        es: "Modo oscuro próximamente" },
  "settings.appearance.light": { en: "Light",                          zh: "浅色",                   es: "Claro" },
  "settings.appearance.dark":  { en: "Dark",                           zh: "深色",                   es: "Oscuro" },
  "settings.appearance.system":{ en: "System",                         zh: "跟随系统",               es: "Sistema" },
  "settings.rate":             { en: "Rate AuraSight ⭐",               zh: "给 AuraSight 评分 ⭐",    es: "Califica AuraSight ⭐" },
  "settings.rate.sub":         { en: "Your review helps others find us", zh: "你的评价能帮助更多人找到我们", es: "Tu reseña ayuda a otros a encontrarnos" },
  "settings.rate.alertTitle":  { en: "Rate AuraSight",                 zh: "给 AuraSight 评分",      es: "Califica AuraSight" },
  "settings.rate.alertMsg":    { en: "Opening App Store...",            zh: "正在打开应用商店...",     es: "Abriendo App Store..." },
  "settings.signOut":          { en: "Sign Out",                       zh: "退出登录",               es: "Cerrar sesión" },
  "settings.deleteAccount":    { en: "Delete Account",                 zh: "删除账户",               es: "Eliminar cuenta" },
  "settings.vipBanner":        { en: "Try VIP free for 7 days",        zh: "免费试用 VIP 7 天",      es: "Prueba VIP gratis por 7 días" },
  "settings.vipActive":        { en: "VIP ✦",                          zh: "VIP ✦",                  es: "VIP ✦" },
  "settings.version":          { en: "Version",                        zh: "版本",                   es: "Versión" },
  "settings.sendFeedback":     { en: "Send Feedback",                  zh: "发送反馈",               es: "Enviar comentarios" },
  "settings.sendFeedback.sub": { en: "hello@aurasight.app",            zh: "hello@aurasight.app",    es: "hello@aurasight.app" },
  "settings.skinGoals.note":   { en: "Tell AI what you care about most — it tailors your weekly reports.", zh: "告诉 AI 你最关注什么，它会据此定制你的每周报告。", es: "Dile a la IA lo que más te importa — personaliza tus informes semanales." },
  "settings.consent.agreed":   { en: "Agreed",                         zh: "已同意",                 es: "Aceptado" },
  "settings.consent.needed":   { en: "Needed for AI analysis & cloud save", zh: "AI 分析和云存储需要此权限", es: "Necesario para análisis AI y guardado en la nube" },
  "settings.consent.allowTitle": { en: "Allow data use",               zh: "允许数据使用",           es: "Permitir uso de datos" },
  "settings.consent.allowMsg": { en: "By turning this on, you allow AuraSight to save your skin photos and use anonymized versions to improve our detection model.", zh: "开启后，你允许 AuraSight 保存皮肤照片，并使用匿名版本改进我们的检测模型。", es: "Al activar esto, permites que AuraSight guarde tus fotos de piel y use versiones anónimas para mejorar nuestro modelo de detección." },
  "settings.consent.revokeTitle": { en: "Revoke data consent?",        zh: "撤销数据授权？",         es: "¿Revocar consentimiento de datos?" },
  "settings.consent.revokeMsg": { en: "We'll stop using new photos for training and cloud save. You can re-enable this any time.", zh: "我们将停止使用新照片进行训练和云存储。你可以随时重新开启。", es: "Dejaremos de usar nuevas fotos para entrenamiento y guardado en la nube. Puedes reactivarlo en cualquier momento." },
  "settings.devTools.switchVip": { en: "Switch to VIP (Test)",         zh: "切换 VIP（测试）",       es: "Cambiar a VIP (Test)" },
  "settings.devTools.current": { en: "Current",                        zh: "当前",                   es: "Actual" },

  // Skin goals
  "goal.acne":    { en: "Control breakouts", zh: "控制痘痘",  es: "Controlar brotes" },
  "goal.tone":    { en: "Even skin tone",    zh: "均匀肤色",  es: "Tono uniforme" },
  "goal.texture": { en: "Improve texture",   zh: "改善肤质",  es: "Mejorar textura" },
  "goal.body":    { en: "Track body shape",  zh: "记录体型",  es: "Seguir forma corporal" },
  "goal.aging":   { en: "Anti-aging",        zh: "抗衰老",    es: "Anti-envejecimiento" },

  // ═══════════════════════════════════════════════════════════
  // Community 社区
  // ═══════════════════════════════════════════════════════════
  "community.title":        { en: "Community",                       zh: "社区",                              es: "Comunidad" },
  "community.sub":          { en: "Skin tips, questions & stories",  zh: "护肤技巧、问题与故事",               es: "Consejos, preguntas e historias de piel" },
  "community.filter.all":   { en: "All",                             zh: "全部",                              es: "Todo" },
  "community.empty":        { en: "No posts yet — be the first!",    zh: "还没有帖子——来发第一条吧！",         es: "Sin publicaciones aún — ¡sé el primero!" },
  "community.newPost":      { en: "New Post",                        zh: "发新帖",                            es: "Nueva publicación" },
  "community.postingAs":    { en: "Posting as",                      zh: "身份",                              es: "Publicar como" },
  "community.topic":        { en: "Topic",                           zh: "话题",                              es: "Tema" },
  "community.addPhoto":     { en: "Add photo",                       zh: "添加图片",                          es: "Agregar foto" },
  "community.changePhoto":  { en: "Change photo",                    zh: "更换图片",                          es: "Cambiar foto" },
  "community.post":         { en: "Post",                            zh: "发布",                              es: "Publicar" },
  "community.beFirst":      { en: "Be the first to reply 💬",        zh: "来发第一条回复吧 💬",                es: "Sé el primero en responder 💬" },
  "community.reply":        { en: "Reply...",                        zh: "写回复...",                          es: "Responder..." },
  "community.pinned":       { en: "Pinned",                          zh: "置顶",                              es: "Fijado" },
  "community.deleteTitle":  { en: "Delete post?",                    zh: "删除帖子？",                        es: "¿Eliminar publicación?" },
  "community.deleteMsg":    { en: "This cannot be undone.",           zh: "此操作无法撤销。",                   es: "Esto no se puede deshacer." },
  "community.errorPost":    { en: "Could not post. Check your connection.", zh: "发帖失败，请检查网络。",       es: "No se pudo publicar. Verifica tu conexión." },
  "community.errorSend":    { en: "Could not send. Check your connection.", zh: "发送失败，请检查网络。",       es: "No se pudo enviar. Verifica tu conexión." },
  "community.errorLoad":    { en: "Could not load post.",             zh: "帖子加载失败。",                    es: "No se pudo cargar la publicación." },
  "community.notFound":     { en: "Post not found.",                  zh: "帖子不存在。",                      es: "Publicación no encontrada." },
  "community.showMore":     { en: "Show more",                        zh: "展开",                              es: "Ver más" },
  "community.showLess":     { en: "Show less",                        zh: "收起",                              es: "Ver menos" },

  // Post detail
  "post.navTitle":    { en: "Post",                                          zh: "帖子",                              es: "Publicación" },
  "post.comments":    { en: "Comments",                                      zh: "评论",                              es: "Comentarios" },
  "post.noComments":  { en: "No comments yet — be the first to reply! 💬",  zh: "还没有评论——来发第一条吧！💬",      es: "Sin comentarios aún — ¡sé el primero en responder! 💬" },
  "post.replyAs":     { en: "Reply as",                                      zh: "以身份回复",                        es: "Responder como" },
  "post.likes":       { en: "likes",                                         zh: "个赞",                              es: "me gusta" },
  "post.like":        { en: "like",                                          zh: "个赞",                              es: "me gusta" },

  // Post tags
  "tag.help":    { en: "Help",     zh: "求助",   es: "Ayuda" },
  "tag.share":   { en: "Share",    zh: "分享",   es: "Compartir" },
  "tag.routine": { en: "Routine",  zh: "护肤",   es: "Rutina" },
  "tag.checkin": { en: "Check-in", zh: "打卡",   es: "Check-in" },

  // Compose placeholders per tag
  "community.placeholder.help":    { en: "Describe your skin issue in detail...",    zh: "详细描述你的皮肤问题...",          es: "Describe tu problema de piel en detalle..." },
  "community.placeholder.share":   { en: "Share your skin story or experience...",   zh: "分享你的皮肤故事或经历...",        es: "Comparte tu historia o experiencia de piel..." },
  "community.placeholder.routine": { en: "Share your skincare routine or tips...",   zh: "分享你的护肤流程或技巧...",        es: "Comparte tu rutina o consejos de cuidado de piel..." },
  "community.placeholder.checkin": { en: "Share your progress or today's scan!",     zh: "分享你的进展或今天的扫描结果！",   es: "¡Comparte tu progreso o el escaneo de hoy!" },

  // Time ago
  "time.justNow": { en: "just now",  zh: "刚刚",       es: "ahora" },
  "time.mAgo":    { en: "m ago",     zh: "分钟前",     es: "min" },
  "time.hAgo":    { en: "h ago",     zh: "小时前",     es: "h" },
  "time.dAgo":    { en: "d ago",     zh: "天前",       es: "d" },

  // ═══════════════════════════════════════════════════════════
  // Face ID 弹窗
  // ═══════════════════════════════════════════════════════════
  "faceId.prompt":       { en: "Unlock AuraSight",                                                zh: "解锁 AuraSight",                                   es: "Desbloquear AuraSight" },
  "faceId.unavailable":  { en: "Biometric authentication is not available on this device.",        zh: "此设备不支持生物识别。",                             es: "La autenticación biométrica no está disponible en este dispositivo." },
  "faceId.notEnrolled":  { en: "You haven't set up Face ID / Touch ID on this device yet.",        zh: "你还没在此设备上设置 Face ID / 指纹。",               es: "Aún no has configurado Face ID / Touch ID en este dispositivo." },
  "faceId.retry":        { en: "Try again",                                                        zh: "重试",                                             es: "Reintentar" },

  // ═══════════════════════════════════════════════════════════
  // 通知
  // ═══════════════════════════════════════════════════════════
  "notif.permissionDenied": { en: "Please enable notifications in system settings to use daily reminders.", zh: "请在系统设置中开启通知权限以使用每日提醒。", es: "Habilita las notificaciones en ajustes del sistema para usar recordatorios diarios." },
  "notif.title":            { en: "Skin check-in 💫",                                                      zh: "皮肤打卡 💫",                                es: "Check-in de piel 💫" },
  "notif.body":             { en: "Take 30 seconds to scan today and keep your streak alive.",              zh: "花 30 秒扫描一下今天的皮肤，保持连续打卡。",   es: "Toma 30 segundos para escanear hoy y mantén tu racha." },

  // Push notification types (i18n keys)
  "notif.scanReady.title":      { en: "Scan Ready ✨",                                                      zh: "扫描完成 ✨",                              es: "Escaneo listo ✨" },
  "notif.scanReady.body":       { en: "Your AI analysis is ready. Tap to view your skin report.",            zh: "你的 AI 分析已完成。点击查看皮肤报告。",   es: "Tu análisis AI está listo. Toca para ver tu informe de piel." },
  "notif.communityReply.title": { en: "New Reply 💬",                                                       zh: "新回复 💬",                                es: "Nueva respuesta 💬" },
  "notif.communityReply.body":  { en: "{{name}} replied to your post: {{reply}}",                           zh: "{{name}} 回复了你的帖子：{{reply}}",       es: "{{name}} respondió a tu publicación: {{reply}}" },
  "notif.streakReminder.title": { en: "Streak Alert! 🔥",                                                   zh: "连签提醒 🔥",                             es: "¡Alerta de racha! 🔥" },
  "notif.streakReminder.body":  { en: "You're about to lose your {{streak}}-day streak. Scan now!",        zh: "你即将失去 {{streak}} 天的连签。现在扫描！", es: "Estás a punto de perder tu racha de {{streak}} días. ¡Escanea ahora!" },
  "notif.weeklySummary.title":  { en: "Weekly Summary 📊",                                                  zh: "每周总结 📊",                             es: "Resumen semanal 📊" },
  "notif.weeklySummary.body":   { en: "Your skin improved {{change}}%. See your progress →",                zh: "你的皮肤改善了 {{change}}%。查看进展 →",   es: "Tu piel mejoró {{change}}%. Ver progreso →" },

  // ═══════════════════════════════════════════════════════════
  // Login / Register / Auth
  // ═══════════════════════════════════════════════════════════
  "auth.login":            { en: "Log In",                             zh: "登录",                   es: "Iniciar sesión" },
  "auth.register":         { en: "Sign Up",                            zh: "注册",                   es: "Registrarse" },
  "auth.email":            { en: "Email",                              zh: "邮箱",                   es: "Correo electrónico" },
  "auth.password":         { en: "Password",                           zh: "密码",                   es: "Contraseña" },
  "auth.confirmPassword":  { en: "Confirm Password",                   zh: "确认密码",               es: "Confirmar contraseña" },
  "auth.forgotPassword":   { en: "Forgot password?",                   zh: "忘记密码？",             es: "¿Olvidaste tu contraseña?" },
  "auth.continueGuest":    { en: "Continue as Guest",                  zh: "以游客身份继续",          es: "Continuar como invitado" },
  "auth.alreadyHave":      { en: "Already have an account?",           zh: "已有账户？",             es: "¿Ya tienes una cuenta?" },
  "auth.noAccount":        { en: "Don't have an account?",             zh: "没有账户？",             es: "¿No tienes una cuenta?" },
  "auth.name":             { en: "Name",                               zh: "名字",                   es: "Nombre" },
  "auth.resetPassword":    { en: "Reset Password",                     zh: "重置密码",               es: "Restablecer contraseña" },
  "auth.resetSent":        { en: "A temporary password has been sent to your email.", zh: "临时密码已发送到你的邮箱。", es: "Se ha enviado una contraseña temporal a tu correo." },

  // ═══════════════════════════════════════════════════════════
  // VIP
  // ═══════════════════════════════════════════════════════════
  "vip.title":             { en: "Go VIP",                             zh: "升级 VIP",               es: "Hazte VIP" },
  "vip.subtitle":          { en: "Unlock your full skin potential",    zh: "解锁你的全部皮肤潜力",    es: "Desbloquea todo el potencial de tu piel" },
  "vip.feature.unlimited": { en: "Unlimited AI scans",                 zh: "无限 AI 扫描",           es: "Escaneos AI ilimitados" },
  "vip.feature.reports":   { en: "Full AI skin reports",               zh: "完整 AI 皮肤报告",       es: "Informes AI completos de piel" },
  "vip.feature.chat":      { en: "AI skin advisor chat",               zh: "AI 皮肤顾问聊天",        es: "Chat con asesor AI de piel" },
  "vip.feature.noAds":     { en: "No ads",                             zh: "无广告",                 es: "Sin anuncios" },
  "vip.feature.export":    { en: "PDF report export",                  zh: "PDF 报告导出",           es: "Exportar informe PDF" },
  "vip.tryFree":           { en: "Try 7 Days Free",                    zh: "免费试用 7 天",          es: "Prueba 7 días gratis" },
  "vip.restore":           { en: "Restore Purchase",                   zh: "恢复购买",               es: "Restaurar compra" },

  // ═══════════════════════════════════════════════════════════
  // Onboarding
  // ═══════════════════════════════════════════════════════════
  "onboarding.skip":       { en: "Skip",                               zh: "跳过",                   es: "Omitir" },
  "onboarding.next":       { en: "Next",                               zh: "下一步",                 es: "Siguiente" },
  "onboarding.getStarted": { en: "Get Started",                        zh: "开始使用",               es: "Comenzar" },

  // ═══════════════════════════════════════════════════════════
  // AI Chat
  // ═══════════════════════════════════════════════════════════
  "chat.title":            { en: "AI Skin Advisor",                    zh: "AI 皮肤顾问",            es: "Asesor AI de piel" },
  "chat.placeholder":      { en: "Ask about your skin…",               zh: "问问你的皮肤问题…",      es: "Pregunta sobre tu piel…" },
  "chat.send":             { en: "Send",                               zh: "发送",                   es: "Enviar" },
  "chat.thinking":         { en: "Thinking…",                          zh: "思考中…",                es: "Pensando…" },

  // ═══════════════════════════════════════════════════════════
  // Ads
  // ═══════════════════════════════════════════════════════════
  "ads.placeholder":       { en: "Ad Banner (visible after EAS build)", zh: "广告横幅（EAS 构建后可见）", es: "Banner publicitario (visible después de EAS build)" },

  // ═══════════════════════════════════════════════════════════
  // State Views — Loading, Error, Empty
  // ═══════════════════════════════════════════════════════════
  "state.loading":         { en: "Loading…",                           zh: "加载中…",                es: "Cargando…" },
  "state.error.title":     { en: "Oops!",                              zh: "哎呀！",                es: "¡Oops!" },
  "state.error.generic":   { en: "Something went wrong. Please try again.", zh: "出错了，请重试。",    es: "Algo salió mal. Por favor, intenta de nuevo." },
  "state.error.network":   { en: "Network error. Check your connection and try again.", zh: "网络错误，请检查连接后重试。", es: "Error de red. Verifica tu conexión e intenta de nuevo." },
  "state.empty.title":     { en: "No data yet",                        zh: "暂无数据",              es: "Sin datos aún" },
  "state.empty.subtitle":  { en: "Try taking action to get started",   zh: "尝试操作来开始",        es: "Intenta tomar medidas para empezar" },
};

// ─── Context ──────────────────────────────────────────────
interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => Promise<void>;
  t: (key: string, vars?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nCtx>({
  lang: "en",
  setLang: async () => {},
  t: (k) => k,
});

export function useT() {
  return useContext(I18nContext);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "zh" || saved === "es") setLangState(saved);
    })();
  }, []);

  const setLang = async (l: Lang) => {
    setLangState(l);
    await AsyncStorage.setItem(STORAGE_KEY, l);
  };

  const t = (key: string, vars?: Record<string, string>): string => {
    const entry = STRINGS[key];
    if (!entry) return key; // 未注册 key，直接返回 key 方便发现遗漏
    let str = entry[lang] ?? entry.en ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replaceAll(`{{${k}}}`, v);
      });
    }
    return str;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}
