import { frameAtU, type Draft } from "./motion";
import { PATTERN } from "./patterns";
import { project, type Cam } from "./render";
import type { V3 } from "./skeleton";

// Camera framing shared by the lab and the app.

// Where to aim the camera for a draft: the middle of the body and the machine.
function focusOf(d: Draft) {
  const { skel, pattern } = frameAtU(d, 0.5);
  const zs = [skel.pelvis.z, skel.toe.L.z, skel.heel.R.z, skel.grip.L.z, skel.head.z];
  for (const b of pattern.machine) zs.push((b.min.z + b.max.z) / 2);
  const z = (Math.min(...zs) + Math.max(...zs)) / 2;
  return { z: Math.max(-0.5, Math.min(0.5, z)) };
}

export function camFor(d: Draft, w: number, h: number, yaw: number, pitch: number, zoom: number): Cam {
  const scale = h * 0.345 * zoom;
  const f = focusOf(d);
  const base: Cam = { yaw, pitch, scale, cx: w / 2, cy: h * 0.86 };
  const off = project({ x: 0, y: 0, z: f.z }, base);
  return { ...base, cx: base.cx - (off.x - w / 2) };
}

export function boundsOf(d: Draft): { target: V3; radius: number } {
  const pts: V3[] = [];
  for (const u of [0, 0.5, 1]) {
    const s = frameAtU(d, u).skel;
    pts.push(s.head, s.pelvis, s.toe.L, s.toe.R, s.heel.L, s.heel.R, s.grip.L, s.grip.R, s.knee.L, s.knee.R, s.elbow.L, s.elbow.R, { x: s.head.x, y: s.head.y + 0.13, z: s.head.z });
    // Plates reach above and beside the hands.
    if (d.tool === "barbell") pts.push({ x: 0.8, y: s.grip.L.y + 0.24, z: s.grip.L.z }, { x: -0.8, y: s.grip.L.y + 0.24, z: s.grip.L.z });
  }
  for (const b of PATTERN[d.pattern].machine) {
    pts.push(b.min, b.max);
  }
  const lo = { x: Math.min(...pts.map((p) => p.x)), y: 0, z: Math.min(...pts.map((p) => p.z)) };
  const hi = { x: Math.max(...pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)), z: Math.max(...pts.map((p) => p.z)) };
  const target = { x: (lo.x + hi.x) / 2, y: hi.y * (hi.y > 2 ? 0.5 : 0.47), z: (lo.z + hi.z) / 2 };
  const radius = Math.max(0.75, Math.hypot(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z) / 2, hi.y * 0.62);
  return { target, radius };
}

