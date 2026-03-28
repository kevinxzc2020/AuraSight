"use client"

import { X, Zap, RotateCcw, ChevronUp } from "lucide-react"
import { useState } from "react"

export function CameraScreen() {
  const [mode, setMode] = useState<"face" | "body">("face")
  const zones = ["Forehead", "L. Cheek", "R. Cheek", "Chin", "Nose"]
  const [activeZone, setActiveZone] = useState("Chin")

  return (
    <div className="relative flex h-full flex-col bg-gray-900 text-white overflow-hidden">
      {/* Camera Viewfinder */}
      <div className="relative flex-1 bg-gradient-to-b from-gray-800 to-gray-900">
        {/* Top Controls */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4">
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur">
            <X className="h-5 w-5" />
          </button>
          <div className="flex gap-1 rounded-full bg-black/40 p-1 backdrop-blur">
            <button
              onClick={() => setMode("face")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                mode === "face"
                  ? "bg-gradient-to-r from-rose-400 to-pink-400 text-white"
                  : "text-gray-400"
              }`}
            >
              Face
            </button>
            <button
              onClick={() => setMode("body")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                mode === "body"
                  ? "bg-gradient-to-r from-rose-400 to-pink-400 text-white"
                  : "text-gray-400"
              }`}
            >
              Body
            </button>
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur">
            <Zap className="h-5 w-5" />
          </button>
        </div>

        {/* Face/Body Guide Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          {mode === "face" ? (
            <div className="relative">
              <div className="h-72 w-56 rounded-[100px] border-2 border-dashed border-rose-300/60 shadow-[0_0_30px_rgba(244,114,182,0.2)]" />
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-3 py-1.5 text-xs text-rose-200 backdrop-blur">
                Align your face
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="h-80 w-32 rounded-t-[60px] border-2 border-dashed border-pink-300/60 shadow-[0_0_30px_rgba(236,72,153,0.2)]">
                <div className="mx-auto mt-4 h-12 w-12 rounded-full border-2 border-dashed border-pink-300/60" />
              </div>
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-3 py-1.5 text-xs text-pink-200 backdrop-blur">
                Full body view
              </div>
            </div>
          )}
        </div>

        {/* Yesterday Comparison */}
        <div className="absolute bottom-4 left-4 z-20">
          <div className="overflow-hidden rounded-2xl bg-black/40 p-2 backdrop-blur">
            <p className="mb-1 text-[10px] text-gray-400">Yesterday</p>
            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-rose-400/30 to-pink-400/20">
              <div className="flex h-full items-center justify-center text-2xl opacity-60">👤</div>
            </div>
          </div>
        </div>

        {/* Flip Camera */}
        <div className="absolute bottom-4 right-4 z-20">
          <button className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur">
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Bottom Drawer */}
      <div className="relative bg-white pb-6 pt-3">
        <div className="mb-4 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-gray-300">
            <ChevronUp className="mx-auto -mt-4 h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* Zone Selector */}
        <div className="mb-5 flex justify-center gap-2 px-4">
          {zones.map((zone) => (
            <button
              key={zone}
              onClick={() => setActiveZone(zone)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                activeZone === zone
                  ? "bg-gradient-to-r from-rose-400 to-pink-400 text-white shadow-sm"
                  : "bg-rose-50 text-gray-500 hover:bg-rose-100"
              }`}
            >
              {zone}
            </button>
          ))}
        </div>

        {/* Capture Button */}
        <div className="flex justify-center">
          <button className="group relative">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-rose-400 to-pink-400 opacity-60 blur transition-all group-hover:opacity-80" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white ring-4 ring-rose-50">
              <div className="h-12 w-12 rounded-full bg-gradient-to-r from-rose-400 to-pink-400 transition-transform group-active:scale-90" />
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
