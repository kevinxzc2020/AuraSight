"use client"

import { Home, Camera, Clock, FileText, User, Flame, TrendingUp, TrendingDown, Sparkles } from "lucide-react"

export function HomeScreen() {
  const progressPercent = 40 // Day 12 of 30

  return (
    <div className="relative flex h-full flex-col bg-gradient-to-b from-rose-50/80 via-white to-white text-gray-800 overflow-hidden">
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-rose-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 top-40 h-32 w-32 rounded-full bg-pink-200/30 blur-3xl" />

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 pb-24 pt-12">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-rose-400">Good morning</p>
            <h1 className="text-xl font-semibold text-gray-800">Sarah</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-100 to-pink-100 px-3 py-1.5 text-sm ring-1 ring-rose-200/50">
            <Flame className="h-4 w-4 text-rose-500" />
            <span className="font-medium text-rose-600">Day 12</span>
          </div>
        </div>

        {/* Progress Ring */}
        <div className="mb-6 flex justify-center">
          <div className="relative h-40 w-40">
            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#fce7f3"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="url(#roseProgressGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${progressPercent * 2.64} 264`}
                className="drop-shadow-[0_0_8px_rgba(244,114,182,0.4)]"
              />
              <defs>
                <linearGradient id="roseProgressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f472b6" />
                  <stop offset="100%" stopColor="#fb7185" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-800">{progressPercent}%</span>
              <span className="text-xs text-gray-500">Complete</span>
            </div>
          </div>
        </div>

        {/* Scan Today Card */}
        <div className="mb-5 overflow-hidden rounded-3xl bg-white p-4 shadow-sm ring-1 ring-rose-100">
          <div className="mb-3 flex gap-3">
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-gradient-to-br from-rose-100 to-pink-100">
              <div className="absolute inset-0 flex items-center justify-center text-3xl">👤</div>
              <span className="absolute bottom-1 left-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-rose-600">Face</span>
            </div>
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-gradient-to-br from-pink-100 to-rose-100">
              <div className="absolute inset-0 flex items-center justify-center text-3xl">🧍</div>
              <span className="absolute bottom-1 left-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-rose-600">Body</span>
            </div>
          </div>
          <button className="w-full rounded-2xl bg-gradient-to-r from-rose-400 to-pink-400 py-3.5 font-semibold text-white shadow-lg shadow-rose-200/50 transition-all hover:shadow-rose-300/50 active:scale-[0.98]">
            Scan Today
          </button>
        </div>

        {/* Quick Stats */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-rose-100">
            <div className="mb-1 flex items-center gap-1">
              <span className="text-lg font-bold text-gray-800">12</span>
              <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <p className="text-[11px] text-gray-500">Total Spots</p>
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-rose-100">
            <div className="mb-1 flex items-center gap-1">
              <span className="text-lg font-bold text-gray-800">-3</span>
              <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <p className="text-[11px] text-gray-500">This Week</p>
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-rose-100">
            <div className="mb-1 flex items-center gap-1">
              <span className="text-lg font-bold text-gray-800">87</span>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <p className="text-[11px] text-gray-500">Skin Score</p>
          </div>
        </div>

        {/* Condition Pills */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          {[
            { label: "Pustule", count: 5, bg: "bg-rose-50", color: "from-rose-400 to-pink-400" },
            { label: "Broken", count: 3, bg: "bg-amber-50", color: "from-amber-400 to-orange-400" },
            { label: "Scab", count: 2, bg: "bg-emerald-50", color: "from-emerald-400 to-teal-400" },
            { label: "Redness", count: 2, bg: "bg-red-50", color: "from-red-400 to-rose-400" },
          ].map((item) => (
            <div key={item.label} className={`flex items-center gap-3 rounded-2xl ${item.bg} p-3 ring-1 ring-black/[0.03]`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} shadow-sm`}>
                <span className="text-lg font-bold text-white">{item.count}</span>
              </div>
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
            </div>
          ))}
        </div>

        {/* AI Insight Card */}
        <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 p-4 ring-1 ring-rose-100">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-rose-400 to-pink-400">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-rose-600">Beauty Insight</span>
          </div>
          <p className="text-sm leading-relaxed text-gray-600">
            3 pustules detected near chin — possible hormonal trigger. Consider tracking your cycle for correlation.
          </p>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="absolute inset-x-0 bottom-0 border-t border-rose-100 bg-white/90 backdrop-blur-xl">
        <div className="flex items-center justify-around py-3">
          <button className="flex flex-col items-center gap-1">
            <Home className="h-5 w-5 text-rose-500" />
            <span className="text-[10px] font-medium text-rose-500">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1">
            <Camera className="h-5 w-5 text-gray-400" />
            <span className="text-[10px] text-gray-400">Camera</span>
          </button>
          <button className="flex flex-col items-center gap-1">
            <Clock className="h-5 w-5 text-gray-400" />
            <span className="text-[10px] text-gray-400">History</span>
          </button>
          <button className="flex flex-col items-center gap-1">
            <FileText className="h-5 w-5 text-gray-400" />
            <span className="text-[10px] text-gray-400">Report</span>
          </button>
          <button className="flex flex-col items-center gap-1">
            <User className="h-5 w-5 text-gray-400" />
            <span className="text-[10px] text-gray-400">Profile</span>
          </button>
        </div>
      </div>
    </div>
  )
}
