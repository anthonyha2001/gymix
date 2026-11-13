import type { Box, Muscle, Pattern, Tool } from "./patterns";
import { BODY, add, mul, norm, sub, v3, type Skeleton, type V3 } from "./skeleton";

// Draws the figure on a canvas: a graphite stage with a soft floor grid, the
// machine, a matte mannequin shaded by depth, and the working muscles lit in
// Gymix lime. One function serves the studio, the thumbnails and video export.

export type Cam = { yaw: number; pitch: number; scale: number; cx: number; cy: number };
type P2 = { x: number; y: number; d: number };
const rad = (d: number) => (d * Math.PI) / 180;

export function project(p: V3, c: Cam): P2 {
  const ty = rad(c.yaw);
  const tp = rad(c.pitch);
  const x1 = p.x * Math.cos(ty) + p.z * Math.sin(ty);
  const d1 = -p.x * Math.sin(ty) + p.z * Math.cos(ty);
  return { x: c.cx + x1 * c.scale, y: c.cy - (p.y * Math.cos(tp) - d1 * Math.sin(tp)) * c.scale, d: d1 * Math.cos(tp) + p.y * Math.sin(tp) };
}
const facing = (n: V3, c: Cam) => {
  const d1 = -n.x * Math.sin(rad(c.yaw)) + n.z * Math.cos(rad(c.yaw));
  return d1 * Math.cos(rad(c.pitch)) + n.y * Math.sin(rad(c.pitch));
};

// ------------------------------------------------------------------ colour
type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const NEAR = hex("#e4e8ed");
const FAR = hex("#76818e");
const LIME = hex("#c8f135");
const LIME_DEEP = hex("#7f9d0b");
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [8, 10, 14];

type Tone = { base: RGB; glow: number };
type Item = { d: number; draw: (ctx: CanvasRenderingContext2D) => void };

// ------------------------------------------------------------------ shapes
function capsule(ctx: CanvasRenderingContext2D, a: P2, b: P2, ra: number, rb: number, tone: Tone) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const h1 = ang - Math.PI / 2;
  const h2 = ang + Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(a.x + Math.cos(h1) * ra, a.y + Math.sin(h1) * ra);
  ctx.lineTo(b.x + Math.cos(h1) * rb, b.y + Math.sin(h1) * rb);
  ctx.arc(b.x, b.y, rb, h1, h2);
  ctx.lineTo(a.x + Math.cos(h2) * ra, a.y + Math.sin(h2) * ra);
  ctx.arc(a.x, a.y, ra, h2, h1 + Math.PI * 2);
  ctx.closePath();
  fillShaded(ctx, (a.x + b.x) / 2, (a.y + b.y) / 2, Math.max(ra, rb), Math.sin(h1) <= 0 ? h1 : h2, tone);
}

function fillShaded(ctx: CanvasRenderingContext2D, mx: number, my: number, r: number, lightAngle: number, tone: Tone) {
  const lx = Math.cos(lightAngle) * r;
  const ly = Math.sin(lightAngle) * r;
  const g = ctx.createLinearGradient(mx + lx, my + ly, mx - lx, my - ly);
  g.addColorStop(0, css(mix(tone.base, WHITE, 0.32)));
  g.addColorStop(0.45, css(tone.base));
  g.addColorStop(1, css(mix(tone.base, BLACK, 0.42)));
  ctx.save();
  if (tone.glow) {
    ctx.shadowColor = `rgba(200,241,53,${0.55 * tone.glow})`;
    ctx.shadowBlur = 14 * tone.glow;
  }
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function ball(ctx: CanvasRenderingContext2D, p: P2, r: number, tone: Tone) {
  const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
  g.addColorStop(0, css(mix(tone.base, WHITE, 0.35)));
  g.addColorStop(0.6, css(tone.base));
  g.addColorStop(1, css(mix(tone.base, BLACK, 0.4)));
  ctx.save();
  if (tone.glow) {
    ctx.shadowColor = `rgba(200,241,53,${0.55 * tone.glow})`;
    ctx.shadowBlur = 14 * tone.glow;
  }
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function poly(ctx: CanvasRenderingContext2D, pts: P2[], fill: string, stroke?: string) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ------------------------------------------------------------------ frame
export type DrawOpts = {
  cam: Cam;
  width: number;
  height: number;
  primary: Muscle[];
  secondary: Muscle[];
  tool: Tool;
  pattern: Pattern;
  // Plain background (thumbnails) instead of the full stage.
  simple?: boolean;
};

const SEGMENT_MUSCLES: Record<string, Muscle[]> = {
  torsoUpper: ["chest", "back"],
  torsoLower: ["core"],
  delt: ["shoulders"],
  upperArm: ["biceps", "triceps"],
  forearm: ["forearms"],
  glute: ["glutes"],
  thigh: ["quads", "hamstrings"],
  shin: ["calves"],
};

export function drawFrame(ctx: CanvasRenderingContext2D, s: Skeleton, o: DrawOpts) {
  const { cam, width: W, height: H } = o;
  const P = (p: V3) => project(p, cam);
  const sc = cam.scale;

  // ---- stage
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W * 0.5, H * 0.38, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
  bg.addColorStop(0, "#151b24");
  bg.addColorStop(1, "#07090d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (!o.simple) {
    // Floor grid, fading out from the middle.
    ctx.save();
    ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      const k = i * 0.25;
      for (const [a, b] of [
        [v3(k, 0, -1.5), v3(k, 0, 1.5)],
        [v3(-1.5, 0, k), v3(1.5, 0, k)],
      ] as const) {
        const pa = P(a);
        const pb = P(b);
        const g = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
        const alpha = 0.07 * (1 - Math.abs(i) / 7);
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Soft contact shadow under the body.
  const foot = mul(add(add(s.heel.L, s.toe.L), add(s.heel.R, s.toe.R)), 0.25);
  const sp = P(v3((foot.x + s.pelvis.x) / 2, 0, (foot.z + s.pelvis.z) / 2));
  ctx.save();
  ctx.translate(sp.x, sp.y);
  ctx.scale(1, Math.max(0.18, Math.sin(rad(cam.pitch)) + 0.12));
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.62 * sc);
  sh.addColorStop(0, "rgba(0,0,0,0.55)");
  sh.addColorStop(0.55, "rgba(0,0,0,0.18)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.arc(0, 0, 0.62 * sc, 0, Math.PI * 2);
  ctx.fill();
  // A faint lime pool of light on the floor.
  const lp = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.9 * sc);
  lp.addColorStop(0, "rgba(200,241,53,0.07)");
  lp.addColorStop(1, "rgba(200,241,53,0)");
  ctx.fillStyle = lp;
  ctx.beginPath();
  ctx.arc(0, 0, 0.9 * sc, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- depth range for shading
  const all = [s.head, s.pelvis, s.hip.L, s.hip.R, s.shoulder.L, s.shoulder.R, s.grip.L, s.grip.R, s.toe.L, s.toe.R].map((p) => P(p).d);
  const dMin = Math.min(...all) - 0.05;
  const dMax = Math.max(...all) + 0.05;
  const lit = (seg: string): number => {
    const ms = SEGMENT_MUSCLES[seg] ?? [];
    if (ms.some((m) => o.primary.includes(m))) return 1;
    if (ms.some((m) => o.secondary.includes(m))) return 0.45;
    return 0;
  };
  const tone = (d: number, seg?: string): Tone => {
    const t = Math.min(1, Math.max(0, (d - dMin) / (dMax - dMin || 1)));
    const body = mix(FAR, NEAR, t);
    const l = seg ? lit(seg) : 0;
    if (!l) return { base: body, glow: 0 };
    const lime = mix(LIME_DEEP, LIME, 0.35 + t * 0.65);
    return { base: mix(body, lime, l === 1 ? 1 : 0.6), glow: l };
  };

  const items: Item[] = [];
  const under: Item[] = [];
  const limb = (a: V3, b: V3, ra: number, rb: number, seg?: string) => {
    const pa = P(a);
    const pb = P(b);
    const d = (pa.d + pb.d) / 2;
    items.push({ d, draw: (c) => capsule(c, pa, pb, ra * sc, rb * sc, tone(d, seg)) });
  };
  const joint = (a: V3, r: number, seg?: string, bias = 0) => {
    const pa = P(a);
    items.push({ d: pa.d + bias, draw: (c) => ball(c, pa, r * sc, tone(pa.d, seg)) });
  };

  // ---- body
  for (const k of ["L", "R"] as const) {
    limb(s.hip[k], s.knee[k], 0.078, 0.056, "thigh");
    joint(s.knee[k], 0.052);
    limb(s.knee[k], s.ankle[k], 0.055, 0.038, "shin");
    joint(s.ankle[k], 0.036);
    limb(s.heel[k], s.toe[k], 0.04, 0.03);
    limb(s.ankle[k], mul(add(s.heel[k], s.toe[k]), 0.5), 0.036, 0.034);
    joint(add(s.hip[k], mul(s.F, -0.035)), 0.085, "glute", -0.02);
    limb(s.shoulder[k], s.elbow[k], 0.05, 0.041, "upperArm");
    joint(s.elbow[k], 0.04);
    limb(s.elbow[k], s.wrist[k], 0.041, 0.032, "forearm");
    limb(s.wrist[k], s.grip[k], 0.032, 0.03);
    joint(s.shoulder[k], 0.064, "delt", 0.01);
  }
  // Torso: a shoulder-to-hip plate for width, two thick spine capsules for depth.
  {
    const q = [s.shoulder.L, s.shoulder.R, s.hip.R, s.hip.L].map(P);
    const d = q.reduce((n, p) => n + p.d, 0) / 4 - 0.01;
    items.push({
      d,
      draw: (c) => {
        const tn = tone(d, "torsoUpper");
        c.save();
        if (tn.glow) {
          c.shadowColor = `rgba(200,241,53,${0.4 * tn.glow})`;
          c.shadowBlur = 12;
        }
        c.lineJoin = "round";
        c.lineWidth = 0.1 * sc;
        c.strokeStyle = css(mix(tn.base, BLACK, 0.12));
        c.beginPath();
        q.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
        c.closePath();
        c.fillStyle = css(mix(tn.base, BLACK, 0.12));
        c.fill();
        c.stroke();
        c.restore();
      },
    });
  }
  limb(s.pelvis, s.mid, 0.1, 0.098, "torsoLower");
  limb(s.mid, add(s.chest, mul(s.U, -0.03)), 0.104, 0.112, "torsoUpper");
  limb(s.chest, s.neck, 0.048, 0.044);
  {
    const ph = P(s.head);
    const face = P(add(s.head, add(mul(sub(s.headFront, s.head), 0.78), mul(s.U, 0.015))));
    items.push({
      d: ph.d,
      draw: (c) => {
        ball(c, ph, BODY.headR * sc, tone(ph.d));
        // A visor line shows which way the head faces.
        if (face.d > ph.d - 0.01) {
          c.save();
          c.globalAlpha = Math.min(1, (face.d - ph.d + 0.01) * 14);
          c.fillStyle = "rgba(13,17,23,0.75)";
          c.beginPath();
          c.ellipse(face.x, face.y, 0.03 * sc, 0.016 * sc, Math.atan2(face.y - ph.y, face.x - ph.x) + Math.PI / 2, 0, Math.PI * 2);
          c.fill();
          c.restore();
        }
      },
    });
  }

  // ---- machine
  for (const b of o.pattern.machine) (b.under ? under : items).push(boxItem(b, cam));

  // ---- tools
  const X = v3(1, 0, 0);
  const steel: Tone = { base: hex("#c3cbd5"), glow: 0 };
  const rubber: Tone = { base: hex("#1c222b"), glow: 0 };
  const bar = (a: V3, b: V3, r: number, tn: Tone) => {
    const pa = P(a);
    const pb = P(b);
    items.push({ d: (pa.d + pb.d) / 2 + 0.005, draw: (c) => capsule(c, pa, pb, r * sc, r * sc, tn) });
  };
  const disc = (center: V3, r: number, w: number) => {
    const pc = P(center);
    items.push({
      d: pc.d,
      draw: (c) => {
        for (const side of [-1, 1]) {
          const pts: P2[] = [];
          for (let i = 0; i < 28; i++) {
            const t = (i / 28) * Math.PI * 2;
            pts.push(P(add(center, v3(side * w, Math.cos(t) * r, Math.sin(t) * r))));
          }
          poly(c, pts, side < 0 ? "#10141a" : "#1a2029", "rgba(255,255,255,0.08)");
        }
        // The lime ring on the face toward the camera.
        const faceSide = facing(X, cam) >= 0 ? 1 : -1;
        c.save();
        c.strokeStyle = "rgba(200,241,53,0.7)";
        c.lineWidth = Math.max(1, 0.006 * sc);
        c.beginPath();
        for (let i = 0; i <= 32; i++) {
          const t = (i / 32) * Math.PI * 2;
          const q = P(add(center, v3(faceSide * w, Math.cos(t) * r * 0.82, Math.sin(t) * r * 0.82)));
          if (i) c.lineTo(q.x, q.y);
          else c.moveTo(q.x, q.y);
        }
        c.stroke();
        c.restore();
      },
    });
  };
  const gm = mul(add(s.grip.L, s.grip.R), 0.5);

  if (o.tool === "barbell") {
    bar(sub(gm, mul(X, 1.08)), sub(gm, mul(X, 0.62)), 0.016, steel);
    bar(sub(gm, mul(X, 0.62)), add(gm, mul(X, 0.62)), 0.013, steel);
    bar(add(gm, mul(X, 0.62)), add(gm, mul(X, 1.08)), 0.016, steel);
    disc(add(gm, mul(X, 0.74)), 0.225, 0.04);
    disc(sub(gm, mul(X, 0.74)), 0.225, 0.04);
  } else if (o.tool === "dumbbells") {
    for (const k of ["L", "R"] as const) {
      const g = s.grip[k];
      bar(sub(g, mul(X, 0.075)), add(g, mul(X, 0.075)), 0.014, steel);
      bar(sub(g, mul(X, 0.15)), sub(g, mul(X, 0.085)), 0.058, rubber);
      bar(add(g, mul(X, 0.085)), add(g, mul(X, 0.15)), 0.058, rubber);
    }
  } else if (o.tool === "latbar") {
    bar(sub(gm, mul(X, 0.62)), add(gm, mul(X, 0.62)), 0.014, steel);
  } else if (o.tool === "shortbar") {
    bar(sub(gm, mul(X, 0.2)), add(gm, mul(X, 0.2)), 0.015, steel);
  } else if (o.tool === "vhandle") {
    bar(s.grip.L, s.grip.R, 0.016, steel);
  } else if (o.tool === "roller") {
    const am = mul(add(s.ankle.L, s.ankle.R), 0.5);
    const km = mul(add(s.knee.L, s.knee.R), 0.5);
    const dir = norm(sub(am, km));
    const front = v3(0, dir.z, -dir.y);
    const roll = add(am, add(mul(front, 0.08), mul(dir, -0.02)));
    for (const side of [-1, 1]) {
      const pivot = v3(side * 0.28, km.y, km.z);
      bar(pivot, v3(side * 0.28, roll.y, roll.z), 0.016, steel);
    }
    bar(add(roll, mul(X, -0.28)), add(roll, mul(X, 0.28)), 0.05, rubber);
  }

  // ---- cable
  if (o.pattern.pulley) {
    const pp = P(o.pattern.pulley);
    const to = P(gm);
    items.push({
      d: Math.min(pp.d, to.d) - 0.01,
      draw: (c) => {
        c.save();
        c.strokeStyle = "rgba(200,210,222,0.75)";
        c.lineWidth = Math.max(1.2, 0.007 * sc);
        c.beginPath();
        c.moveTo(pp.x, pp.y);
        c.lineTo(to.x, to.y);
        c.stroke();
        c.restore();
        ball(c, pp, 0.045 * sc, { base: hex("#3b4552"), glow: 0 });
      },
    });
  }

  for (const it of under) it.draw(ctx);
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw(ctx);

  if (!o.simple) {
    // Vignette.
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
}

function boxItem(b: Box, cam: Cam): Item {
  const { min: a, max: z } = b;
  const corner = (x: number, y: number, w: number) => project(v3(x ? z.x : a.x, y ? z.y : a.y, w ? z.z : a.z), cam);
  const faces: { n: V3; pts: [number, number, number][]; top?: boolean }[] = [
    { n: v3(0, 1, 0), pts: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]], top: true },
    { n: v3(0, -1, 0), pts: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { n: v3(1, 0, 0), pts: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
    { n: v3(-1, 0, 0), pts: [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]] },
    { n: v3(0, 0, 1), pts: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { n: v3(0, 0, -1), pts: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]] },
  ];
  const palette = { pad: ["#2b3341", "#1d232d"], frame: ["#353e4b", "#232a34"], steel: ["#8d99a8", "#5d6876"] }[b.tone];
  const center = project(v3((a.x + z.x) / 2, (a.y + z.y) / 2, (a.z + z.z) / 2), cam);
  return {
    d: center.d,
    draw: (c) => {
      for (const f of faces) {
        if (facing(f.n, cam) <= 0) continue;
        poly(c, f.pts.map(([x, y, w]) => corner(x, y, w)), f.top ? palette[0] : palette[1], "rgba(255,255,255,0.06)");
      }
    },
  };
}
