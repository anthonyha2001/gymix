import * as THREE from "three";
import { MUSCLES, type Muscle } from "./patterns";

// The Gymix athlete, sculpted in code: every limb is a tube whose radius
// follows an anatomical profile (calf belly, quad sweep, biceps peak) with
// muscle lobes pushed out in the right direction. Each vertex knows which
// muscle it belongs to, so the glow lands on the quads, not the whole thigh.
//
// Local frame of a limb: y runs along the bone (0 at the upper joint), z is
// the front of the limb, x = y × z. On both sides x points to the figure's
// right, so "inner" is +x on the left limb and -x on the right one.

export const MUSCLE_INDEX = Object.fromEntries(MUSCLES.map((m, i) => [m.id, i])) as Record<Muscle, number>;

type Lobe = { t: number; w: number; amt: number; ang: number; k: number };
type Region = (t: number, ang: number) => { muscle: Muscle | null; w: number };

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const band = (lo: number, hi: number, x: number, soft = 0.04) => smooth(lo - soft, lo + soft, x) * (1 - smooth(hi - soft, hi + soft, x));

function profileAt(p: [number, number][], t: number) {
  if (t <= p[0][0]) return p[0][1];
  for (let i = 0; i < p.length - 1; i++) {
    const [t0, r0] = p[i];
    const [t1, r1] = p[i + 1];
    if (t <= t1) {
      const u = (t - t0) / (t1 - t0);
      const e = (1 - Math.cos(u * Math.PI)) / 2; // cosine ease between keys: no kinks
      return r0 + (r1 - r0) * e;
    }
  }
  return p[p.length - 1][1];
}

function lobeAt(lobes: Lobe[] | undefined, t: number, ang: number) {
  let out = 0;
  for (const b of lobes ?? []) {
    const g = Math.exp(-(((t - b.t) / b.w) ** 2));
    const c = Math.cos(ang - b.ang);
    out += b.amt * g * Math.pow(Math.max(0, c), b.k);
  }
  return out;
}

export type LimbSpec = {
  length: number;
  profile: [number, number][];
  sx?: number;
  sz?: number;
  lobes?: Lobe[];
  region?: Region;
};

// A closed tube with round ends, plus muscle attributes.
export function limbGeometry(spec: LimbSpec, radial = 40, rings = 36): THREE.BufferGeometry {
  const { length: L, profile, sx = 1, sz = 1 } = spec;
  const r0 = profile[0][1];
  const r1 = profile[profile.length - 1][1];
  const capRings = 9;
  const ys: { y: number; r: number; t: number }[] = [];
  for (let i = 0; i <= capRings; i++) {
    const a = (Math.PI / 2) * (1 - i / capRings);
    ys.push({ y: -Math.sin(a) * r0 * 0.92, r: Math.max(0.0008, Math.cos(a) * r0), t: 0 });
  }
  for (let i = 1; i < rings; i++) {
    const t = i / rings;
    ys.push({ y: t * L, r: profileAt(profile, t), t });
  }
  for (let i = 0; i <= capRings; i++) {
    const a = (Math.PI / 2) * (i / capRings);
    ys.push({ y: L + Math.sin(a) * r1 * 0.92, r: Math.max(0.0008, Math.cos(a) * r1), t: 1 });
  }

  const pos: number[] = [];
  const mId: number[] = [];
  const mW: number[] = [];
  for (const ring of ys) {
    const capFade = ring.t === 0 || ring.t === 1 ? ring.r / (ring.t === 0 ? r0 : r1) : 1;
    for (let j = 0; j < radial; j++) {
      const ang = (j / radial) * Math.PI * 2; // 0 = front (+z), π/2 = +x
      const r = ring.r + lobeAt(spec.lobes, ring.t, ang) * capFade;
      pos.push(Math.sin(ang) * r * sx, ring.y, Math.cos(ang) * r * sz);
      const reg = spec.region?.(ring.t, ang) ?? { muscle: null, w: 0 };
      mId.push(reg.muscle ? MUSCLE_INDEX[reg.muscle] : 0);
      mW.push(reg.muscle ? reg.w : 0);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < ys.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("mId", new THREE.Float32BufferAttribute(mId, 1));
  g.setAttribute("mW", new THREE.Float32BufferAttribute(mW, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- the limbs
const front = (lo: number, hi: number, muscle: Muscle, back?: Muscle): Region => (t, ang) => {
  const c = Math.cos(ang);
  const along = band(lo, hi, t, 0.08);
  if (c >= 0 || !back) return { muscle, w: along * smooth(-0.35, 0.25, c) };
  return { muscle: back, w: along * smooth(0.0, 0.5, -c) };
};

// `inner` is +π/2 on the left side, -π/2 on the right.
export function limbSpecs(inner: number) {
  return {
    thigh: {
      length: 0.44,
      profile: [
        [0, 0.078],
        [0.15, 0.085],
        [0.45, 0.079],
        [0.75, 0.066],
        [0.92, 0.056],
        [1, 0.052],
      ],
      sz: 1.04,
      lobes: [
        { t: 0.45, w: 0.24, amt: 0.013, ang: 0.25 * Math.sign(-inner), k: 2 }, // vastus lateralis / rectus
        { t: 0.8, w: 0.09, amt: 0.013, ang: inner * 0.6, k: 2 }, // teardrop above the knee
        { t: 0.42, w: 0.25, amt: 0.011, ang: Math.PI, k: 2 }, // hamstrings
        { t: 0.25, w: 0.18, amt: 0.008, ang: inner, k: 2 }, // adductors
      ],
      region: front(0.04, 0.88, "quads", "hamstrings"),
    },
    shin: {
      length: 0.43,
      profile: [
        [0, 0.052],
        [0.15, 0.053],
        [0.4, 0.047],
        [0.7, 0.035],
        [0.93, 0.029],
        [1, 0.029],
      ],
      lobes: [
        { t: 0.27, w: 0.17, amt: 0.026, ang: Math.PI + inner * 0.25, k: 1.6 }, // gastrocnemius
        { t: 0.3, w: 0.13, amt: 0.008, ang: inner * 0.8, k: 2 },
      ],
      region: (t, ang) => ({ muscle: "calves", w: band(0.05, 0.72, t, 0.08) * smooth(0.05, 0.6, -Math.cos(ang)) }),
    },
    upperArm: {
      length: 0.29,
      profile: [
        [0, 0.05],
        [0.2, 0.051],
        [0.45, 0.048],
        [0.78, 0.041],
        [1, 0.037],
      ],
      sz: 1.06,
      lobes: [
        { t: 0.55, w: 0.2, amt: 0.013, ang: 0, k: 3 }, // biceps peak
        { t: 0.35, w: 0.22, amt: 0.011, ang: Math.PI, k: 2 }, // triceps
      ],
      region: front(0.12, 0.88, "biceps", "triceps"),
    },
    forearm: {
      length: 0.26,
      profile: [
        [0, 0.041],
        [0.22, 0.043],
        [0.55, 0.035],
        [1, 0.026],
      ],
      sx: 1.15,
      sz: 0.9,
      lobes: [{ t: 0.22, w: 0.15, amt: 0.006, ang: -inner, k: 2 }],
      region: (t) => ({ muscle: "forearms", w: band(0.04, 0.75, t, 0.1) }),
    },
    delt: {
      length: 0.075,
      profile: [
        [0, 0.064],
        [0.5, 0.062],
        [1, 0.046],
      ],
      sx: 1.04,
      region: () => ({ muscle: "shoulders", w: 1 }),
    },
    neck: { length: 0.1, profile: [[0, 0.058], [1, 0.049]] as [number, number][] },
    hand: {
      length: 0.1,
      profile: [
        [0, 0.026],
        [0.35, 0.034],
        [0.75, 0.033],
        [1, 0.022],
      ],
      sx: 1.35,
      sz: 0.72,
    },
    foot: {
      length: 0.21,
      profile: [
        [0, 0.034],
        [0.3, 0.041],
        [0.7, 0.046],
        [0.9, 0.04],
        [1, 0.028],
      ],
      sx: 1.1,
      sz: 0.7,
    },
  } satisfies Record<string, LimbSpec>;
}

// ---------------------------------------------------------------- the torso
// Cross-sections from below the hips (h < 0) to the base of the neck, in the
// spine's frame: x to the figure's left, h up the spine, z out of the chest.
const TORSO: [number, number, number, number][] = [
  // h, half-width, half-depth, front/back shift
  [-0.13, 0.1, 0.07, -0.005],
  [-0.1, 0.148, 0.098, -0.012],
  [-0.04, 0.178, 0.112, -0.014],
  [0.02, 0.172, 0.107, -0.006],
  [0.09, 0.146, 0.097, 0],
  [0.16, 0.134, 0.094, 0.004],
  [0.24, 0.141, 0.099, 0.006],
  [0.32, 0.161, 0.107, 0.008],
  [0.4, 0.181, 0.113, 0.01],
  [0.46, 0.196, 0.11, 0.004],
  [0.5, 0.188, 0.098, -0.006],
  [0.535, 0.14, 0.082, -0.012],
  [0.565, 0.075, 0.06, -0.006],
  [0.6, 0.054, 0.051, 0],
];
const TORSO_LOBES: (Lobe & { h0: number; h1: number })[] = [
  { h0: 0.37, h1: 0.49, t: 0.43, w: 0.05, amt: 0.022, ang: 0.42, k: 3 }, // pecs
  { h0: 0.37, h1: 0.49, t: 0.43, w: 0.05, amt: 0.022, ang: -0.42, k: 3 },
  { h0: -0.1, h1: 0.04, t: -0.04, w: 0.05, amt: 0.022, ang: Math.PI - 0.4, k: 3 }, // glutes
  { h0: -0.1, h1: 0.04, t: -0.04, w: 0.05, amt: 0.022, ang: Math.PI + 0.4, k: 3 },
  { h0: 0.3, h1: 0.45, t: 0.37, w: 0.06, amt: 0.015, ang: Math.PI - 1.15, k: 3 }, // lats
  { h0: 0.3, h1: 0.45, t: 0.37, w: 0.06, amt: 0.015, ang: Math.PI + 1.15, k: 3 },
  { h0: 0.49, h1: 0.57, t: 0.53, w: 0.03, amt: 0.014, ang: Math.PI - 0.7, k: 2 }, // traps
  { h0: 0.49, h1: 0.57, t: 0.53, w: 0.03, amt: 0.014, ang: Math.PI + 0.7, k: 2 },
  { h0: 0.05, h1: 0.3, t: 0.18, w: 0.09, amt: 0.006, ang: 0, k: 6 }, // abs
];

export type TorsoRest = { geo: THREE.BufferGeometry; rest: Float32Array };

export function torsoGeometry(radial = 56): TorsoRest {
  const rows: number[] = [];
  const h0 = TORSO[0][0];
  const h1 = TORSO[TORSO.length - 1][0];
  for (let i = 0; i <= 64; i++) rows.push(h0 + ((h1 - h0) * i) / 64);
  const at = (h: number, col: number) => {
    for (let i = 0; i < TORSO.length - 1; i++) {
      if (h <= TORSO[i + 1][0]) {
        const u = (h - TORSO[i][0]) / (TORSO[i + 1][0] - TORSO[i][0]);
        const e = (1 - Math.cos(u * Math.PI)) / 2;
        return TORSO[i][col] + (TORSO[i + 1][col] - TORSO[i][col]) * e;
      }
    }
    return TORSO[TORSO.length - 1][col];
  };
  const rest: number[] = [];
  const mId: number[] = [];
  const mW: number[] = [];
  const n = 2.5; // a touch squarer than an ellipse
  for (let r = 0; r <= rows.length; r++) {
    // One extra ring closes the bottom, one the top.
    const h = r === rows.length ? h1 + 0.012 : rows[r];
    const close = r === 0 ? 0.25 : r === rows.length ? 0.2 : 1;
    const w = at(h, 1) * close;
    const d = at(h, 2) * close;
    const shift = at(h, 3);
    for (let j = 0; j < radial; j++) {
      const ang = (j / radial) * Math.PI * 2; // 0 = front
      const sn = Math.sin(ang);
      const cs = Math.cos(ang);
      let x = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n) * w;
      let z = Math.sign(cs) * Math.pow(Math.abs(cs), 2 / n) * d + shift;
      let push = 0;
      for (const l of TORSO_LOBES) if (h > l.h0 - 0.06 && h < l.h1 + 0.06) push += lobeAt([l], h, ang);
      // A soft groove down the spine.
      push -= 0.007 * Math.pow(Math.max(0, -cs), 30) * band(0.02, 0.48, h, 0.05);
      const len = Math.hypot(x, z - shift) || 1;
      x += (x / len) * push * close;
      z += ((z - shift) / len) * push * close;
      rest.push(x, h, z);

      // Muscles on the torso.
      const regions: [Muscle, number][] = [
        ["chest", band(0.35, 0.5, h, 0.03) * smooth(0.15, 0.55, cs)],
        ["core", band(0.03, 0.32, h, 0.04) * smooth(0.25, 0.65, cs)],
        ["back", band(0.14, 0.54, h, 0.05) * smooth(0.0, 0.45, -cs)],
        ["glutes", band(-0.13, 0.05, h, 0.03) * smooth(0.1, 0.55, -cs)],
      ];
      regions.sort((a, b) => b[1] - a[1]);
      mId.push(MUSCLE_INDEX[regions[0][0]]);
      mW.push(regions[0][1]);
    }
  }
  const idx: number[] = [];
  const ringCount = rows.length + 1;
  for (let i = 0; i < ringCount - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      idx.push(a, b, c, b, d, c);
    }
  }
  // Close the bottom and top with a fan around a centre vertex.
  const base = rest.length / 3;
  rest.push(0, h0 - 0.012, -0.004, 0, h1 + 0.02, 0);
  mId.push(0, 0);
  mW.push(0, 0);
  for (let j = 0; j < radial; j++) {
    idx.push(base, (j + 1) % radial, j);
    const top = (ringCount - 1) * radial;
    idx.push(base + 1, top + j, top + ((j + 1) % radial));
  }
  const g = new THREE.BufferGeometry();
  const arr = new Float32Array(rest);
  g.setAttribute("position", new THREE.Float32BufferAttribute(arr.slice(), 3));
  g.setAttribute("mId", new THREE.Float32BufferAttribute(mId, 1));
  g.setAttribute("mW", new THREE.Float32BufferAttribute(mW, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geo: g, rest: arr };
}

// ---------------------------------------------------------------- the head
// A faceless mannequin head: an egg with a tapered jaw and a hint of a brow.
export function headGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.1, 48, 36);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * 0.9;
    const y = p.getY(i) * 1.14;
    let z = p.getZ(i) * 1.0;
    if (y < 0) {
      const k = Math.min(1, -y / 0.11);
      x *= 1 - 0.3 * k;
      z *= 1 - 0.12 * k;
      if (z > 0) z += 0.012 * k; // chin
    }
    if (z > 0.06 && y > 0.0 && y < 0.05) z += 0.006; // brow
    p.setXYZ(i, x, y, z);
  }
  const n = p.count;
  g.setAttribute("mId", new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  g.setAttribute("mW", new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  g.computeVertexNormals();
  return g;
}
