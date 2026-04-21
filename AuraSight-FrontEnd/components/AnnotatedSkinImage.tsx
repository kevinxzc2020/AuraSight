/**
 * AnnotatedSkinImage
 * Each detection gets its own individual marker by type:
 *   pustule  → small filled circle with dashed ring
 *   redness  → soft organic blob area
 *   broken   → open circle with cross (open/broken skin)
 *   scab     → small irregular healing patch
 *
 * Edit mode: tap a marker to delete it, tap empty skin to add.
 */

import React, { useState, useEffect } from "react";
import { View, Image, StyleSheet, TouchableOpacity, Text, ImageLoadEventData, NativeSyntheticEvent } from "react-native";
import Svg, {
  Circle, Path, Line, G,
  Text as SvgText,
  Defs, RadialGradient, Stop,
} from "react-native-svg";
import { Detection, AcneType } from "../lib/mongodb";

// ─── Contain-mode coordinate mapping ─────────────────────────
// resizeMode="contain" scales the image to fit entirely inside the container,
// potentially adding letterbox padding. This avoids cropping, so coordinates
// map exactly to the visible image area.
function containTransform(
  imgW: number, imgH: number, containerW: number, containerH: number,
) {
  const scale = Math.min(containerW / imgW, containerH / imgH);
  const displayedW = imgW * scale;
  const displayedH = imgH * scale;
  const padX = (containerW - displayedW) / 2;  // letterbox padding left
  const padY = (containerH - displayedH) / 2;  // letterbox padding top
  return { scale, displayedW, displayedH, padX, padY };
}

// ─── Colours & labels ────────────────────────────────────────
export const TYPE_COLOR: Record<AcneType, string> = {
  pustule: "#F472B6",   // pink
  redness: "#FB7185",   // red
  broken:  "#FBBF24",   // amber
  scab:    "#34D399",   // green
};

export const TYPE_LABEL: Record<AcneType, string> = {
  pustule: "Pustule",
  redness: "Redness",
  broken:  "Wound",     // open/broken skin — clearer than "Broken" or "Open"
  scab:    "Scab",
};

// ─── Organic blob helper (for redness) ───────────────────────
function organicPath(
  cx: number, cy: number,
  rx: number, ry: number,
  seed: number, numPts = 8,
): string {
  const pts = [];
  for (let i = 0; i < numPts; i++) {
    const angle = (i / numPts) * Math.PI * 2 - Math.PI / 2;
    const wave = 1 + 0.2 * Math.sin(seed * 5.9 + i * 2.4)
                   + 0.1 * Math.cos(seed * 3.1 + i * 4.7);
    pts.push({
      x: cx + rx * wave * Math.cos(angle),
      y: cy + ry * wave * Math.sin(angle),
    });
  }
  const n = pts.length;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p0 = pts[(i - 1 + n) % n];
    const p3 = pts[(i + 2) % n];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d + " Z";
}

// ─── Per-type marker renderers ────────────────────────────────

function PustuleMarker({ px, py, r, color, label, showLabel }: {
  px: number; py: number; r: number; color: string; label: string; showLabel: boolean;
}) {
  const pillW = label.length * 6 + 16;
  const pillY = py - r - 14;
  return (
    <G>
      {/* Soft glow fill */}
      <Circle cx={px} cy={py} r={r * 1.5} fill={color} opacity={0.12} />
      {/* Main circle */}
      <Circle cx={px} cy={py} r={r} fill={color} opacity={0.35} />
      {/* Dashed ring */}
      <Circle
        cx={px} cy={py} r={r}
        fill="none" stroke={color} strokeWidth={2}
        strokeDasharray="4 3"
      />
      {/* Centre dot */}
      <Circle cx={px} cy={py} r={3} fill={color} />
      {showLabel && (
        <G>
          <Path
            d={`M ${px - pillW / 2} ${pillY - 8} h ${pillW} a 8 8 0 0 1 8 8 a 8 8 0 0 1 -8 8 h -${pillW} a 8 8 0 0 1 -8 -8 a 8 8 0 0 1 8 -8 Z`}
            fill={color}
          />
          <SvgText x={px} y={pillY + 4} textAnchor="middle" fontSize={9.5} fontWeight="700" fill="#fff">
            {label}
          </SvgText>
        </G>
      )}
    </G>
  );
}

function RednessMarker({ px, py, rx, ry, color, label, showLabel, seed }: {
  px: number; py: number; rx: number; ry: number;
  color: string; label: string; showLabel: boolean; seed: number;
}) {
  const d = organicPath(px, py, rx, ry, seed);
  const pillW = label.length * 6 + 16;
  const pillY = py - ry - 14;
  return (
    <G>
      <Path d={d} fill={color} opacity={0.15} />
      <Path d={d} fill="none" stroke={color} strokeWidth={2} strokeDasharray="6 4" strokeLinecap="round" />
      {showLabel && (
        <G>
          <Path
            d={`M ${px - pillW / 2} ${pillY - 8} h ${pillW} a 8 8 0 0 1 8 8 a 8 8 0 0 1 -8 8 h -${pillW} a 8 8 0 0 1 -8 -8 a 8 8 0 0 1 8 -8 Z`}
            fill={color}
          />
          <SvgText x={px} y={pillY + 4} textAnchor="middle" fontSize={9.5} fontWeight="700" fill="#fff">
            {label}
          </SvgText>
        </G>
      )}
    </G>
  );
}

function OpenMarker({ px, py, r, color, label, showLabel }: {
  px: number; py: number; r: number; color: string; label: string; showLabel: boolean;
}) {
  // Dashed open circle + small cross inside
  const arm = r * 0.55;
  const pillW = label.length * 6 + 16;
  const pillY = py - r - 14;
  return (
    <G>
      <Circle cx={px} cy={py} r={r} fill={color} opacity={0.12} />
      <Circle cx={px} cy={py} r={r} fill="none" stroke={color} strokeWidth={2} strokeDasharray="3 3" />
      <Line x1={px - arm} y1={py - arm} x2={px + arm} y2={py + arm} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={px + arm} y1={py - arm} x2={px - arm} y2={py + arm} stroke={color} strokeWidth={2} strokeLinecap="round" />
      {showLabel && (
        <G>
          <Path
            d={`M ${px - pillW / 2} ${pillY - 8} h ${pillW} a 8 8 0 0 1 8 8 a 8 8 0 0 1 -8 8 h -${pillW} a 8 8 0 0 1 -8 -8 a 8 8 0 0 1 8 -8 Z`}
            fill={color}
          />
          <SvgText x={px} y={pillY + 4} textAnchor="middle" fontSize={9.5} fontWeight="700" fill="#fff">
            {label}
          </SvgText>
        </G>
      )}
    </G>
  );
}

function ScabMarker({ px, py, rx, ry, color, label, showLabel, seed }: {
  px: number; py: number; rx: number; ry: number;
  color: string; label: string; showLabel: boolean; seed: number;
}) {
  // Slightly irregular patch (tighter organic shape)
  const d = organicPath(px, py, rx * 0.8, ry * 0.8, seed + 2.1, 7);
  const pillW = label.length * 6 + 16;
  const pillY = py - ry * 0.8 - 14;
  return (
    <G>
      <Path d={d} fill={color} opacity={0.25} />
      <Path d={d} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4 3" strokeLinecap="round" />
      {/* Hatching to indicate healing */}
      <Line x1={px - rx * 0.4} y1={py} x2={px + rx * 0.4} y2={py} stroke={color} strokeWidth={1.5} opacity={0.5} />
      {showLabel && (
        <G>
          <Path
            d={`M ${px - pillW / 2} ${pillY - 8} h ${pillW} a 8 8 0 0 1 8 8 a 8 8 0 0 1 -8 8 h -${pillW} a 8 8 0 0 1 -8 -8 a 8 8 0 0 1 8 -8 Z`}
            fill={color}
          />
          <SvgText x={px} y={pillY + 4} textAnchor="middle" fontSize={9.5} fontWeight="700" fill="#fff">
            {label}
          </SvgText>
        </G>
      )}
    </G>
  );
}

// ─── Hit test ────────────────────────────────────────────────
// Note: hitTest now receives pre-computed screen positions from toScreen()
function hitTest(
  lx: number, ly: number, px: number, py: number,
  rxScreen: number, ryScreen: number,
): boolean {
  const rx = Math.max(rxScreen, 18);
  const ry = Math.max(ryScreen, 18);
  // Generous hit: 1.6× the marker radius
  return ((lx - px) ** 2) / (rx * 1.6) ** 2 + ((ly - py) ** 2) / (ry * 1.6) ** 2 < 1;
}

// ─── Props ───────────────────────────────────────────────────
interface Props {
  imageUri: string;
  detections: Detection[];
  displayWidth: number;
  displayHeight: number;
  borderRadius?: number;
  showLabels?: boolean;
  editMode?: boolean;
  onDeleteDetection?: (index: number) => void;
  onAddAtPosition?: (cx: number, cy: number) => void;
}

export function AnnotatedSkinImage({
  imageUri,
  detections,
  displayWidth: W,
  displayHeight: H,
  borderRadius = 20,
  showLabels = true,
  editMode = false,
  onDeleteDetection,
  onAddAtPosition,
}: Props) {

  // ── Get actual image dimensions for contain-mode coordinate mapping ──
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  // Strategy 1: Image.getSize on mount/URI change (works for file:// and http://)
  useEffect(() => {
    if (!imageUri) return;
    Image.getSize(
      imageUri,
      (w, h) => {
        if (w > 0 && h > 0) setImgSize({ w, h });
      },
      () => {}, // silently fail, onLoad will try
    );
  }, [imageUri]);

  // Strategy 2: onLoad event (backup — works for all URI types)
  const onImageLoad = (e: NativeSyntheticEvent<ImageLoadEventData>) => {
    const src = (e.nativeEvent as any)?.source;
    if (src?.width > 0 && src?.height > 0 && !imgSize) {
      setImgSize({ w: src.width, h: src.height });
    }
  };

  // Compute contain-mode layout (fall back to identity if image size unknown)
  const layout = imgSize
    ? containTransform(imgSize.w, imgSize.h, W, H)
    : null;

  // Map normalized (0–1) detection coords → screen px
  const toScreen = (cx: number, cy: number) => {
    if (layout) {
      return {
        px: layout.padX + cx * layout.displayedW,
        py: layout.padY + cy * layout.displayedH,
      };
    }
    // Fallback: assume image fills container exactly
    return { px: cx * W, py: cy * H };
  };

  // Map screen px → normalized coords (for edit-mode taps)
  const fromScreen = (sx: number, sy: number) => {
    if (layout) {
      return {
        cx: (sx - layout.padX) / layout.displayedW,
        cy: (sy - layout.padY) / layout.displayedH,
      };
    }
    return { cx: sx / W, cy: sy / H };
  };

  return (
    <View style={[styles.wrapper, { width: W, height: H, borderRadius, backgroundColor: "#000" }]}>
      {/* Base photo — contain: no cropping, coordinates map exactly */}
      <Image
        source={{ uri: imageUri }}
        style={{ width: W, height: H }}
        resizeMode="contain"
        onLoad={onImageLoad}
      />

      {/* SVG markers — one per detection, no merging */}
      {detections.length > 0 && (
        <Svg width={W} height={H} style={StyleSheet.absoluteFillObject} pointerEvents="none">
          {detections.map((det, idx) => {
            const color = TYPE_COLOR[det.acne_type] ?? "#F472B6";
            const label = TYPE_LABEL[det.acne_type] ?? det.acne_type;
            const { px, py } = toScreen(det.bbox.cx, det.bbox.cy);
            // Scale bbox size using the actual displayed image size
            const scaleW = layout ? layout.displayedW : W;
            const scaleH = layout ? layout.displayedH : H;
            const rx = Math.max(det.bbox.w * scaleW / 2, 16);
            const ry = Math.max(det.bbox.h * scaleH / 2, 16);
            const r  = Math.max((rx + ry) / 2, 16);   // circle radius for pustule/broken
            const seed = det.bbox.cx * 11.3 + det.bbox.cy * 7.7 + idx;

            switch (det.acne_type) {
              case "pustule":
                return (
                  <PustuleMarker key={idx}
                    px={px} py={py} r={r}
                    color={color} label={label} showLabel={showLabels}
                  />
                );
              case "redness":
                return (
                  <RednessMarker key={idx}
                    px={px} py={py} rx={rx} ry={ry}
                    color={color} label={label} showLabel={showLabels} seed={seed}
                  />
                );
              case "broken":
                return (
                  <OpenMarker key={idx}
                    px={px} py={py} r={r}
                    color={color} label={label} showLabel={showLabels}
                  />
                );
              case "scab":
                return (
                  <ScabMarker key={idx}
                    px={px} py={py} rx={rx} ry={ry}
                    color={color} label={label} showLabel={showLabels} seed={seed}
                  />
                );
              default:
                return null;
            }
          })}
        </Svg>
      )}

      {/* Edit mode overlay */}
      {editMode && (
        <View
          style={StyleSheet.absoluteFillObject}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => false}
          onResponderGrant={(e) => {
            const { locationX, locationY } = e.nativeEvent;
            const sW = layout ? layout.displayedW : W;
            const sH = layout ? layout.displayedH : H;
            const hitIdx = detections.findIndex(d => {
              const { px: dpx, py: dpy } = toScreen(d.bbox.cx, d.bbox.cy);
              return hitTest(locationX, locationY, dpx, dpy, d.bbox.w * sW / 2, d.bbox.h * sH / 2);
            });
            if (hitIdx >= 0) {
              onDeleteDetection?.(hitIdx);
            } else {
              const norm = fromScreen(locationX, locationY);
              onAddAtPosition?.(norm.cx, norm.cy);
            }
          }}
        >
          {/* ✕ per-marker delete button */}
          {detections.map((det, idx) => {
            const { px, py } = toScreen(det.bbox.cx, det.bbox.cy);
            const sW = layout ? layout.displayedW : W;
            const sH = layout ? layout.displayedH : H;
            const r  = Math.max((det.bbox.w * sW + det.bbox.h * sH) / 4, 16);
            return (
              <TouchableOpacity
                key={`del-${idx}`}
                style={[styles.deleteBtn, { left: px + r * 0.6 - 11, top: py - r * 0.6 - 11 }]}
                onPress={() => onDeleteDetection?.(idx)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.editHintBar}>
            <Text style={styles.editHintText}>Tap marker to remove  ·  Tap skin to add</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { overflow: "hidden", position: "relative" },
  deleteBtn: {
    position: "absolute",
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#fff",
    borderWidth: 2, borderColor: "#E11D48",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 3,
    elevation: 6, zIndex: 10,
  },
  deleteBtnText: { fontSize: 10, fontWeight: "800", color: "#E11D48", lineHeight: 12 },
  editHintBar: {
    position: "absolute", bottom: 10, alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
  },
  editHintText: { color: "#fff", fontSize: 11, fontWeight: "600" },
});
