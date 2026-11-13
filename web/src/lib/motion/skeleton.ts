// The Gymix motion figure: a 1.75 m mannequin built from a pose.
//
// World: metres, y up, the figure faces +z, its left side is +x. The floor is
// y = 0. A pose is a flat record of numbers so any two poses can be blended.
// Legs either stand on planted feet (two-bone IK from the hips to the ankles)
// or follow hip/knee angles (seated, lying). Arms either reach for a target in
// the torso's frame (two-bone IK, for bars and handles) or follow shoulder and
// elbow angles (curls, raises).

export type V3 = { x: number; y: number; z: number };
export const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
export const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const len = (a: V3) => Math.hypot(a.x, a.y, a.z);
export const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return mul(a, 1 / l);
};
export const lerp3 = (a: V3, b: V3, t: number): V3 => add(a, mul(sub(b, a), t));
const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export const BODY = {
  pelvisHalf: 0.09,
  lowerSpine: 0.24,
  upperSpine: 0.26,
  neck: 0.09,
  headR: 0.105,
  shoulderDrop: 0.04,
  shoulderHalf: 0.18,
  upperArm: 0.29,
  forearm: 0.26,
  hand: 0.07,
  thigh: 0.44,
  shin: 0.43,
  ankleH: 0.075,
  heel: 0.05,
  toe: 0.16,
};

export type Pose = Record<string, number>;

export type Rig = {
  // planted: feet at (±stance, ankle height + footY, footZ); pole = where knees point.
  legs: { mode: "planted"; pole: V3 } | { mode: "angles" };
  // ik: hands reach (±hand, handU, handF) from the top of the chest, in the
  // torso's frame (x outward, y along the spine, z out of the chest).
  // frame "world": hands reach the absolute point (±hand, handU, handF) (a bar path that stays over the feet).
  arms: { mode: "ik"; pole: V3; frame?: "torso" | "world" } | { mode: "angles"; hint: V3 };
  // Feet whose toes are tipped down to touch the floor (a back foot in a lunge).
  tiptoe?: ("L" | "R")[];
};

// Every number a pose may carry, with its default, so a pose can omit any.
export const POSE_DEFAULTS: Pose = {
  pelvisY: 0.93,
  pelvisZ: 0,
  trunk: 0,
  chest: 0,
  head: 0,
  // planted legs
  stance: 0.13,
  footLZ: 0,
  footRZ: 0,
  footLY: 0,
  footRY: 0,
  // leg angles
  hipL: 0,
  kneeL: 0,
  hipR: 0,
  kneeR: 0,
  hipAbd: 5,
  // thighs swung out about the vertical (seated abduction)
  hipOut: 0,
  footPitch: 0,
  // arm IK
  handL: 0.25,
  handU: -0.5,
  handF: 0.1,
  // arm angles
  shFlex: 0,
  shAbd: 8,
  elbow: 10,
};

export type Skeleton = {
  pelvis: V3;
  mid: V3;
  chest: V3;
  neck: V3;
  head: V3;
  headFront: V3;
  U: V3;
  F: V3;
  // Lower spine (pelvis) frame and head frame, for the 3D sculpt.
  Up: V3;
  Fp: V3;
  Uh: V3;
  Fh: V3;
  hip: { L: V3; R: V3 };
  knee: { L: V3; R: V3 };
  ankle: { L: V3; R: V3 };
  heel: { L: V3; R: V3 };
  toe: { L: V3; R: V3 };
  shoulder: { L: V3; R: V3 };
  elbow: { L: V3; R: V3 };
  wrist: { L: V3; R: V3 };
  grip: { L: V3; R: V3 };
};

// Two bones from `a` toward `target`: the middle joint bends toward `pole`.
export function twoBone(a: V3, target: V3, l1: number, l2: number, pole: V3) {
  const d = sub(target, a);
  const dist = clamp(len(d), 1e-4, l1 + l2 - 1e-4);
  const dir = norm(d);
  const cosA = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  let p = sub(pole, mul(dir, dot(pole, dir)));
  if (len(p) < 1e-6) p = Math.abs(dir.y) < 0.9 ? v3(0, 1, 0) : v3(0, 0, 1);
  p = norm(p);
  const mid = add(add(a, mul(dir, l1 * cosA)), mul(p, l1 * sinA));
  return { mid, end: add(a, mul(dir, dist)) };
}

// Rotate unit vector `a` toward `h` by `deg` (in the plane they span).
function bendToward(a: V3, h: V3, deg: number, fallback: V3): V3 {
  let p = sub(h, mul(a, dot(h, a)));
  if (len(p) < 1e-6) p = sub(fallback, mul(a, dot(fallback, a)));
  p = norm(p);
  const r = rad(deg);
  return add(mul(a, Math.cos(r)), mul(p, Math.sin(r)));
}

function foot(ankle: V3, pitchDeg: number) {
  const r = rad(pitchDeg);
  const fdir = v3(0, Math.sin(r), Math.cos(r));
  const fup = v3(0, Math.cos(r), -Math.sin(r));
  const sole = sub(ankle, mul(fup, BODY.ankleH));
  return { heel: sub(sole, mul(fdir, BODY.heel)), toe: add(sole, mul(fdir, BODY.toe)) };
}

// The foot pitch (degrees, negative = toes down) that puts the toe on the floor.
function tiptoePitch(ankle: V3) {
  if (ankle.y <= BODY.ankleH + 0.004) return 0;
  let lo = -85;
  let hi = 0;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (foot(ankle, m).toe.y > 0) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}

export function solve(input: Pose, rig: Rig): Skeleton {
  const p = { ...POSE_DEFAULTS, ...input };
  const pelvis = v3(0, p.pelvisY, p.pelvisZ);
  const a1 = rad(p.trunk);
  const Up = v3(0, Math.cos(a1), Math.sin(a1));
  const Fp = v3(0, -Math.sin(a1), Math.cos(a1));
  const mid = add(pelvis, mul(Up, BODY.lowerSpine));
  const a2 = rad(p.trunk + p.chest);
  const U = v3(0, Math.cos(a2), Math.sin(a2));
  const F = v3(0, -Math.sin(a2), Math.cos(a2));
  const chest = add(mid, mul(U, BODY.upperSpine));
  const a3 = a2 + rad(p.head);
  const Uh = v3(0, Math.cos(a3), Math.sin(a3));
  const Fh = v3(0, -Math.sin(a3), Math.cos(a3));
  const neck = add(chest, mul(Uh, BODY.neck));
  const head = add(neck, mul(Uh, BODY.headR + 0.02));
  const headFront = add(head, mul(Fh, BODY.headR));

  // In the torso's frame: x outward on side s (+1 left, -1 right), y up the spine, z out of the chest.
  const local = (x: number, y: number, z: number, s: number) => add(add(v3(x * s, 0, 0), mul(U, y)), mul(F, z));

  const sides = [
    ["L", 1],
    ["R", -1],
  ] as const;
  const out = {
    hip: {} as Skeleton["hip"],
    knee: {} as Skeleton["knee"],
    ankle: {} as Skeleton["ankle"],
    heel: {} as Skeleton["heel"],
    toe: {} as Skeleton["toe"],
    shoulder: {} as Skeleton["shoulder"],
    elbow: {} as Skeleton["elbow"],
    wrist: {} as Skeleton["wrist"],
    grip: {} as Skeleton["grip"],
  };

  for (const [k, s] of sides) {
    // ---- legs
    const hip = add(pelvis, v3(BODY.pelvisHalf * s, 0, 0));
    let knee: V3;
    let ankle: V3;
    if (rig.legs.mode === "planted") {
      const target = v3(p.stance * s, BODY.ankleH + (k === "L" ? p.footLY : p.footRY), k === "L" ? p.footLZ : p.footRZ);
      const pole = v3(rig.legs.pole.x * s, rig.legs.pole.y, rig.legs.pole.z);
      const r = twoBone(hip, target, BODY.thigh, BODY.shin, pole);
      knee = r.mid;
      ankle = r.end;
    } else {
      const th = rad(k === "L" ? p.hipL : p.hipR);
      const sh = th - rad(k === "L" ? p.kneeL : p.kneeR);
      const ab = rad(p.hipAbd);
      const out = rad(p.hipOut) * s;
      const swing = (d0: V3) => {
        const d = v3(d0.x * Math.cos(ab) - s * d0.y * Math.sin(ab), d0.y * Math.cos(ab) + s * d0.x * Math.sin(ab), d0.z);
        return v3(d.x * Math.cos(out) + d.z * Math.sin(out), d.y, -d.x * Math.sin(out) + d.z * Math.cos(out));
      };
      knee = add(hip, mul(swing(v3(0, -Math.cos(th), Math.sin(th))), BODY.thigh));
      ankle = add(knee, mul(swing(v3(0, -Math.cos(sh), Math.sin(sh))), BODY.shin));
    }
    const pitch = rig.tiptoe?.includes(k) ? tiptoePitch(ankle) : p.footPitch;
    const f = foot(ankle, pitch);
    out.hip[k] = hip;
    out.knee[k] = knee;
    out.ankle[k] = ankle;
    out.heel[k] = f.heel;
    out.toe[k] = f.toe;

    // ---- arms
    const shoulder = add(chest, add(mul(U, -BODY.shoulderDrop), v3(BODY.shoulderHalf * s, 0, 0)));
    let elbow: V3;
    let wrist: V3;
    let grip: V3;
    if (rig.arms.mode === "ik") {
      const target = rig.arms.frame === "world" ? v3(p.handL * s, p.handU, p.handF) : add(chest, local(p.handL, p.handU, p.handF, s));
      const pole = local(rig.arms.pole.x, rig.arms.pole.y, rig.arms.pole.z, s);
      const r = twoBone(shoulder, target, BODY.upperArm, BODY.forearm + BODY.hand * 0.55, pole);
      elbow = r.mid;
      const fdir = norm(sub(r.end, elbow));
      wrist = add(elbow, mul(fdir, BODY.forearm));
      grip = r.end;
    } else {
      const fl = rad(p.shFlex);
      const ab = rad(p.shAbd);
      // Flex forward, then swing out to the side; both in the torso's frame.
      const fu = -Math.cos(fl);
      const ff = Math.sin(fl);
      const lx = -fu * Math.sin(ab); // outward
      const uy = fu * Math.cos(ab);
      const dir = norm(local(lx, uy, ff, s));
      elbow = add(shoulder, mul(dir, BODY.upperArm));
      const h = rig.arms.hint;
      const fdir = bendToward(dir, local(h.x, h.y, h.z, s), p.elbow, F);
      wrist = add(elbow, mul(fdir, BODY.forearm));
      grip = add(wrist, mul(fdir, BODY.hand * 0.55));
    }
    out.shoulder[k] = shoulder;
    out.elbow[k] = elbow;
    out.wrist[k] = wrist;
    out.grip[k] = grip;
  }

  return { pelvis, mid, chest, neck, head, headFront, U, F, Up, Fp, Uh, Fh, ...out };
}

// Blend two poses field by field.
export function blend(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k] ?? POSE_DEFAULTS[k] ?? 0;
    const y = b[k] ?? POSE_DEFAULTS[k] ?? 0;
    out[k] = x + (y - x) * t;
  }
  return out;
}
