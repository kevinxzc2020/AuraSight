"use client"

import { Home, Camera, Clock, FileText, User, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react"
import { useState } from "react"

export function HistoryScreen() {
  const [activeFilter, setActiveFilter] = useState("All")
  const filters = ["Face", "Body", "All"]

  const calendarDays = [
    { day: 1, status: "clear" },
    { day: 2, status: "clear" },
    { day: 3, status: "mild" },
    { day: 4, status: "mild" },
    { day: 5, status: "breakout" },
    { day: 6, status: "breakout" },
    { day: 7, status: "mild" },
    { day: 8, status: "clear" },
    { day: 9, status: "clear" },
    { day: 10, status: "clear" },
    { day: 11, status: "mild" },
    { day: 12, status: "clear" },
    { day: 13, status: null },
    { day: 14, status: null },
    { day: 15, status: null },
    { day: 16, status: null },
    { day: 17, status: null },
    { day: 18, status: null },
    { day: 19, status: null },
    { day: 20, status: null },
    { day: 21, status: null },
    { day: 22, status: null },
    { day: 23, status: null },
    { day: 24, status: null },
    { day: 25, status: null },
    { day: 26, status: null },
    { day: 27, status: null },
    { day: 28, status: null },
    { day: 29, status: null },
    { day: 30, status: null },
    { day: 31, status: null },
  ]

  const statusColors = {
    clear: "bg-emerald-400",
    mild: "bg-amber-400",
    breakout: "bg-rose-400",
  }

  const recentDays = [
    { date: "Today", count: 12, trend: -2 },
    { date: "Yesterday", count: 14, trend: 0 },
    { date: "Mar 25", count: 14, trend: +1 },
    { date: "Mar 24", count: 13, trend: -1 },
  ]

  // Sparkline data
  const sparklineData = [18, 20, 19, 22, 20, 18, 17, 16, 15, 14, 14, 12]

  return (
    <div className="relative flex h-full flex-col bg-gradient-to-b from-rose-50/80 via-white to-white text-gray-800 overflow-hidden">
      {/* Background decorative */}
      <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-rose-200/30 blur-3xl" />

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 pb-24 pt-12">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800">History</h1>
          <div className="flex gap-1 rounded-full bg-rose-50 p-1 ring-1 ring-rose-100">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  activeFilter === filter
                    ? "bg-gradient-to-r from-rose-400 to-pink-400 text-white"
                    : "text-gray-500"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar */}
        <div className="mb-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-rose-100">
          <div className="mb-4 flex items-center justify-between">
            <button className="rounded-full p-1.5 text-gray-400 hover:bg-rose-50 hover:text-gray-600">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="font-semibold text-gray-800">March 2026</span>
            <button className="rounded-full p-1.5 text-gray-400 hover:bg-rose-50 hover:text-gray-600">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-400">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((item) => (
              <div key={item.day} className="flex aspect-square flex-col items-center justify-center">
                <span className={`text-xs ${item.status ? "font-medium text-gray-700" : "text-gray-400"}`}>
                  {item.day}
                </span>
                {item.status && (
                  <div
                    className={`mt-0.5 h-1.5 w-1.5 rounded-full ${statusColors[item.status as keyof typeof statusColors]}`}
                  />
                )}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="mt-4 flex justify-center gap-5 text-[11px] text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Clear
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              Mild
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              Breakout
            </div>
          </div>
        </div>

        {/* Sparkline Trend */}
        <div className="mb-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-rose-100">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">30-Day Trend</p>
            <div className="flex items-center gap-1 text-emerald-500">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-semibold">-33%</span>
            </div>
          </div>
          <div className="flex h-14 items-end gap-1">
            {sparklineData.map((value, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-gradient-to-t from-rose-400 to-pink-300"
                style={{ height: `${(value / 25) * 100}%` }}
              />
            ))}
          </div>
        </div>

        {/* Recent Days */}
        <div className="space-y-2">
          <p className="mb-2 text-sm font-medium text-gray-600">Recent Scans</p>
          {recentDays.map((day, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-rose-100"
            >
              <div className="h-12 w-12 overflow-hidden rounded-xl bg-gradient-to-br from-rose-100 to-pink-100">
                <div className="flex h-full items-center justify-center text-xl">👤</div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{day.date}</p>
                <p className="text-xs text-gray-500">{day.count} spots detected</p>
              </div>
              <div
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  day.trend < 0
                    ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"
                    : day.trend > 0
                      ? "bg-rose-50 text-rose-600 ring-1 ring-rose-100"
                      : "bg-gray-50 text-gray-500 ring-1 ring-gray-100"
                }`}
              >
                {day.trend > 0 ? "+" : ""}
                {day.trend === 0 ? "0" : day.trend}
              </div>
            </div>
          ))}
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
            <Clock className="h-5 w-5 text-rose-500" />
            <span className="text-[10px] font-medium text-rose-500">History</span>
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
