"use client"

import { Home, Camera, Clock, FileText, User, Sparkles, Droplets, AlertCircle, TrendingUp, Crown, Check } from "lucide-react"

export function ReportScreen() {
  // Donut chart data
  const acneBreakdown = [
    { type: "Pustule", count: 5, color: "#f472b6", percent: 42 },
    { type: "Broken", count: 3, color: "#fbbf24", percent: 25 },
    { type: "Scab", count: 2, color: "#34d399", percent: 17 },
    { type: "Redness", count: 2, color: "#fb7185", percent: 16 },
  ]

  // Calculate stroke dasharray for donut
  const total = 100
  let cumulativePercent = 0
  
  const insights = [
    {
      icon: Droplets,
      title: "Hydration Impact",
      desc: "Your skin clarity improved 23% on days you logged 8+ glasses of water.",
    },
    {
      icon: AlertCircle,
      title: "Hormonal Pattern",
      desc: "Chin breakouts peaked during days 21-25 of your cycle. Consider targeted care.",
    },
    {
      icon: TrendingUp,
      title: "Progress Milestone",
      desc: "You've reduced total acne count by 38% since day 1. Keep it up!",
    },
  ]

  const vipFeatures = [
    "Personalized routine builder",
    "Product recommendations",
    "Dermatologist report export",
    "Unlimited history storage",
  ]

  return (
    <div className="relative flex h-full flex-col bg-gradient-to-b from-rose-50/80 via-white to-white text-gray-800 overflow-hidden">
      {/* Background decorative */}
      <div className="pointer-events-none absolute -left-20 top-20 h-64 w-64 rounded-full bg-pink-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-40 h-48 w-48 rounded-full bg-rose-200/30 blur-3xl" />

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 pb-24 pt-12">
        {/* Header */}
        <div className="mb-5">
          <h1 className="mb-1 text-xl font-semibold text-gray-800">Your 30-Day Journey</h1>
          <p className="text-sm text-gray-500">Feb 25 - Mar 27, 2026</p>
        </div>

        {/* Skin Score Trend */}
        <div className="mb-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-rose-100">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">Skin Score Trend</p>
            <span className="flex items-center gap-1 text-emerald-500">
              <TrendingUp className="h-4 w-4" />
              <span className="text-lg font-bold">+12%</span>
            </span>
          </div>
          <div className="h-24">
            <svg className="h-full w-full" viewBox="0 0 300 80" preserveAspectRatio="none">
              <defs>
                <linearGradient id="roseLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f472b6" />
                  <stop offset="100%" stopColor="#fb7185" />
                </linearGradient>
                <linearGradient id="roseAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f472b6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f472b6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,60 Q30,55 60,50 T120,45 T180,35 T240,25 T300,20"
                fill="none"
                stroke="url(#roseLineGradient)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M0,60 Q30,55 60,50 T120,45 T180,35 T240,25 T300,20 L300,80 L0,80 Z"
                fill="url(#roseAreaGradient)"
              />
            </svg>
          </div>
        </div>

        {/* Acne Breakdown Donut */}
        <div className="mb-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-rose-100">
          <p className="mb-3 text-sm font-medium text-gray-600">Condition Breakdown</p>
          <div className="flex items-center gap-5">
            <div className="relative h-28 w-28 shrink-0">
              <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                {acneBreakdown.map((item, i) => {
                  const dashArray = (item.percent / total) * 251.2
                  const dashOffset = -((cumulativePercent / total) * 251.2)
                  cumulativePercent += item.percent
                  return (
                    <circle
                      key={i}
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke={item.color}
                      strokeWidth="14"
                      strokeDasharray={`${dashArray} 251.2`}
                      strokeDashoffset={dashOffset}
                      strokeLinecap="round"
                    />
                  )
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-800">12</span>
                <span className="text-[10px] text-gray-500">Total</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {acneBreakdown.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-gray-600">{item.type}</span>
                  </div>
                  <span className="font-semibold text-gray-800">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Body Change Preview */}
        <div className="mb-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-rose-100">
          <p className="mb-3 text-sm font-medium text-gray-600">30-Day Comparison</p>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="mb-2 flex h-20 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 to-pink-100">
                <span className="text-2xl">👤</span>
              </div>
              <span className="text-[11px] text-gray-500">Day 1</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-px w-10 bg-gradient-to-r from-rose-200 to-pink-200" />
              <div className="my-1 rounded-full bg-gradient-to-r from-rose-400 to-pink-400 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                +22
              </div>
              <div className="h-px w-10 bg-gradient-to-r from-pink-200 to-rose-200" />
            </div>
            <div className="text-center">
              <div className="mb-2 flex h-20 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100">
                <span className="text-2xl">👤</span>
              </div>
              <span className="text-[11px] text-gray-500">Today</span>
            </div>
          </div>
        </div>

        {/* AI Insights */}
        <div className="mb-5 space-y-3">
          <p className="text-sm font-medium text-gray-600">Beauty Insights</p>
          {insights.map((insight, i) => (
            <div
              key={i}
              className="flex gap-3 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 p-3 ring-1 ring-rose-100"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-pink-400">
                <insight.icon className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{insight.title}</p>
                <p className="text-xs leading-relaxed text-gray-600">{insight.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* VIP Upsell */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-400 via-pink-400 to-rose-500 p-5 shadow-lg shadow-rose-200/50">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/10" />
          
          <div className="relative">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Crown className="h-4 w-4 text-amber-200" />
              </div>
              <div>
                <p className="font-semibold text-white">Unlock Pro Features</p>
                <p className="text-xs text-white/70">AuraSight Premium</p>
              </div>
            </div>
            <ul className="mb-4 space-y-1.5">
              {vipFeatures.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-white/90">
                  <Check className="h-3.5 w-3.5 text-white" />
                  {feature}
                </li>
              ))}
            </ul>
            <button className="w-full rounded-2xl bg-white py-2.5 text-sm font-semibold text-rose-500 shadow-lg transition-all hover:shadow-xl active:scale-[0.98]">
              Try 7 Days Free
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="absolute inset-x-0 bottom-0 border-t border-rose-100 bg-white/90 backdrop-blur-xl">
        <div className="flex items-center justify-around py-3">
          <button className="flex flex-col items-center gap-1">
            <Home className="h-5 w-5 text-gray-400" />
            <span className="text-[10px] text-gray-400">Home</span>
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
            <FileText className="h-5 w-5 text-rose-500" />
            <span className="text-[10px] font-medium text-rose-500">Report</span>
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
