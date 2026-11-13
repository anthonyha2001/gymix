import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MUSCLES, type Muscle } from "./patterns";
import type { Skeleton as Pose3, V3 } from "./skeleton";

// Drives a rigged human model (a Rigify skeleton) with the motion engine.
//
// For every deforming bone we know its rest transform. Each frame the engine's
// skeleton gives, per body segment, a direction and a "front" reference; the
// same rule run on the model's rest pose gives the rest basis. The bone's new
// world rotation is (posed basis) · (rest basis)⁻¹ · (rest rotation), and its
// position follows its logical parent, so the model keeps its own proportions.
// The skin is repainted in the Gymix porcelain, and each vertex gets muscle
// weights (front of the thigh = quads, back = hamstrings, ...) for the glow.

const key = (name: string) => name.replace(/_\d+$/, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
const V = (p: V3) => new THREE.Vector3(p.x, p.y, p.z);

type Seg = "pelvis" | "spineMid" | "chest" | "neck" | "head" | `upper${"L" | "R"}` | `fore${"L" | "R"}` | `hand${"L" | "R"}` | `thigh${"L" | "R"}` | `shin${"L" | "R"}` | `foot${"L" | "R"}`;
type Frames = Record<Seg, THREE.Matrix4>;

// Segment frames (rotation only) from a pose: y along the segment, z its front.
function basis(dir: THREE.Vector3, front: THREE.Vector3) {
  const y = dir.clone().normalize();
  const z = front.clone().addScaledVector(y, -front.dot(y));
  if (z.lengthSq() < 1e-8) z.set(0, 0, 1).addScaledVector(y, -y.z);
  if (z.lengthSq() < 1e-8) z.set(0, 1, 0).addScaledVector(y, -y.y);
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Matrix4().makeBasis(x, y, z);
}
const perp = (a: THREE.Vector3, axis: THREE.Vector3) => a.clone().addScaledVector(axis.clone().normalize(), -a.dot(axis.clone().normalize()));

// The joints the frame rules need, from either the engine or the model's rest pose.
type Joints = {
  pelvis: THREE.Vector3;
  mid: THREE.Vector3;
  chest: THREE.Vector3;
  neck: THREE.Vector3;
  Up: THREE.Vector3;
  Fp: THREE.Vector3;
  U: THREE.Vector3;
  F: THREE.Vector3;
  Uh: THREE.Vector3;
  Fh: THREE.Vector3;
  side: Record<"L" | "R", { shoulder: THREE.Vector3; elbow: THREE.Vector3; wrist: THREE.Vector3; grip: THREE.Vector3; hip: THREE.Vector3; knee: THREE.Vector3; ankle: THREE.Vector3; toe: THREE.Vector3 }>;
};

function frames(j: Joints): Frames {
  const out = {} as Frames;
  out.pelvis = basis(j.Up, j.Fp);
  out.spineMid = basis(j.Up.clone().add(j.U), j.Fp.clone().add(j.F));
  out.chest = basis(j.U, j.F);
  out.neck = basis(j.neck.clone().sub(j.chest), j.F.clone().add(j.Fh));
  out.head = basis(j.Uh, j.Fh);
  for (const k of ["L", "R"] as const) {
    const s = j.side[k];
    const upDir = s.elbow.clone().sub(s.shoulder);
    const foDir = s.wrist.clone().sub(s.elbow);
    const armFront = perp(foDir, upDir).add(j.F.clone().multiplyScalar(0.35));
    out[`upper${k}`] = basis(upDir, armFront);
    out[`fore${k}`] = basis(foDir, perp(armFront, foDir).lengthSq() > 1e-6 ? perp(armFront, foDir) : j.F);
    const hDir = s.grip.clone().sub(s.wrist);
    out[`hand${k}`] = basis(hDir, perp(armFront, hDir).lengthSq() > 1e-6 ? perp(armFront, hDir) : j.F);
    const thighDir = s.knee.clone().sub(s.hip);
    const shinDir = s.ankle.clone().sub(s.knee);
    const thighFront = perp(shinDir, thighDir).multiplyScalar(-1).add(j.Fp.clone().multiplyScalar(0.35));
    out[`thigh${k}`] = basis(thighDir, thighFront);
    out[`shin${k}`] = basis(shinDir, perp(thighFront, shinDir).lengthSq() > 1e-6 ? perp(thighFront, shinDir) : j.Fp);
    const fDir = s.toe.clone().sub(s.ankle);
    out[`foot${k}`] = basis(fDir, new THREE.Vector3(0, 1, 0));
  }
  return out;
}

function jointsFromPose(p: Pose3): Joints {
  const side = {} as Joints["side"];
  for (const k of ["L", "R"] as const) {
    side[k] = { shoulder: V(p.shoulder[k]), elbow: V(p.elbow[k]), wrist: V(p.wrist[k]), grip: V(p.grip[k]), hip: V(p.hip[k]), knee: V(p.knee[k]), ankle: V(p.ankle[k]), toe: V(p.toe[k]) };
  }
  return { pelvis: V(p.pelvis), mid: V(p.mid), chest: V(p.chest), neck: V(p.neck), Up: V(p.Up), Fp: V(p.Fp), U: V(p.U), F: V(p.F), Uh: V(p.Uh), Fh: V(p.Fh), side };
}

// Which engine segment rotates each deforming bone. Bones not listed move
// rigidly with their logical parent (palms, fingers, toes, pelvis, breast).
const SEGMENT: Record<string, Seg> = {
  defspine: "pelvis",
  defspine001: "spineMid",
  defspine002: "spineMid",
  defspine003: "chest",
  defspine004: "neck",
  defspine005: "neck",
  defspine006: "head",
};
for (const k of ["L", "R"] as const) {
  const s = k.toLowerCase();
  Object.assign(SEGMENT, {
    [`defupperarm${s}`]: `upper${k}`,
    [`defupperarm${s}001`]: `upper${k}`,
    [`defforearm${s}`]: `fore${k}`,
    [`defforearm${s}001`]: `fore${k}`,
    [`defhand${s}`]: `hand${k}`,
    [`defthigh${s}`]: `thigh${k}`,
    [`defthigh${s}001`]: `thigh${k}`,
    [`defshin${s}`]: `shin${k}`,
    [`defshin${s}001`]: `shin${k}`,
    [`deffoot${s}`]: `foot${k}`,
  });
}

// The parent each bone follows for its position (and rotation, if it has no segment).
function logicalParent(k: string): string | null {
  if (k === "defspine") return null;
  const m = k.match(/^defspine(\d{3})$/);
  if (m) return Number(m[1]) === 1 ? "defspine" : `defspine${String(Number(m[1]) - 1).padStart(3, "0")}`;
  const side = k.endsWith("l") || /l\d{3}$/.test(k) ? "l" : "r";
  if (/^defshoulder/.test(k) || /^defbreast/.test(k)) return "defspine003";
  if (/^defpelvis/.test(k)) return "defspine";
  if (k === `defupperarm${side}`) return `defshoulder${side}`;
  if (k === `defupperarm${side}001`) return `defupperarm${side}`;
  if (k === `defforearm${side}`) return `defupperarm${side}001`;
  if (k === `defforearm${side}001`) return `defforearm${side}`;
  if (k === `defhand${side}`) return `defforearm${side}001`;
  if (/^def(palm|f(index|middle|ring|pinky)|thumb)/.test(k)) {
    const f = k.match(/^def(f(index|middle|ring|pinky)|thumb)(\d\d)/);
    if (f && f[3] !== "01") return k.replace(/(\d\d)(l|r)$/, (_, n, s) => `${String(Number(n) - 1).padStart(2, "0")}${s}`);
    return `defhand${side}`;
  }
  if (k === `defthigh${side}`) return "defspine";
  if (k === `defthigh${side}001`) return `defthigh${side}`;
  if (k === `defshin${side}`) return `defthigh${side}001`;
  if (k === `defshin${side}001`) return `defshin${side}`;
  if (k === `deffoot${side}`) return `defshin${side}001`;
  if (k === `deftoe${side}`) return `deffoot${side}`;
  return "defspine";
}

type BoneRec = { bone: THREE.Bone; key: string; parent: string | null; rest: THREE.Matrix4; restPos: THREE.Vector3; restRot: THREE.Quaternion; restScale: THREE.Vector3; posed: THREE.Matrix4 };

export type Athlete = {
  root: THREE.Group;
  pose: (p: Pose3, grip: "bar" | "open") => { gripL: THREE.Vector3; gripR: THREE.Vector3 };
  levels: (primary: Muscle[], secondary: Muscle[]) => void;
  pulse: (t: number) => void;
  dispose: () => void;
};

// ---------------------------------------------------------------- material
function porcelain(ao: THREE.Texture | null) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#cdd2d9"),
    roughness: 0.44,
    metalness: 0,
    clearcoat: 0.42,
    clearcoatRoughness: 0.34,
    sheen: 0.3,
    sheenColor: new THREE.Color("#ffffff"),
    sheenRoughness: 0.55,
    aoMap: ao,
    aoMapIntensity: 0.9,
    side: THREE.FrontSide,
  });
  const u = {
    uL0: { value: new THREE.Vector4() },
    uL1: { value: new THREE.Vector4() },
    uL2: { value: new THREE.Vector4() },
    uLime: { value: new THREE.Color("#c8f135") },
    uPulse: { value: 0 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 m0;\nattribute vec4 m1;\nattribute vec4 m2;\nuniform vec4 uL0;\nuniform vec4 uL1;\nuniform vec4 uL2;\nvarying float vGlow;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = dot(m0, uL0) + dot(m1, uL1) + dot(m2, uL2);");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGlow;\nuniform vec3 uLime;\nuniform float uPulse;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float g = clamp(vGlow, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, uLime * 0.9, g * 0.88);
        totalEmissiveRadiance += uLime * g * (0.48 + 0.18 * uPulse);`,
      );
  };
  return { mat, u };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- load
export async function loadAthlete(url: string, target: { legLength: number }): Promise<Athlete> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = gltf.scene;
  // Drop anything that isn't the body (the model ships with a floor).
  let mesh: THREE.SkinnedMesh | null = null;
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && !mesh) mesh = o as THREE.SkinnedMesh;
  });
  if (!mesh) throw new Error("No rigged mesh in the model");
  const body: THREE.SkinnedMesh = mesh;
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== body) o.visible = false;
  });
  scene.updateMatrixWorld(true);

  const bones = body.skeleton.bones;
  const byKey = new Map(bones.map((b) => [key(b.name), b]));
  const world = (k: string) => new THREE.Vector3().setFromMatrixPosition(byKey.get(k)!.matrixWorld);
  const need = ["defspine", "defthighl", "defshinl", "deffootl", "deftoel"];
  for (const n of need) if (!byKey.has(n)) throw new Error(`The model's skeleton has no ${n}`);

  // Scale so the model's legs match the engine's (hip to ankle).
  const legModel = world("defthighl").distanceTo(world("defshinl")) + world("defshinl").distanceTo(world("deffootl"));
  const s = target.legLength / legModel;
  scene.scale.multiplyScalar(s);
  scene.updateMatrixWorld(true);

  // The model's rest pose in the engine's terms.
  const up = new THREE.Vector3(0, 1, 0);
  const left = world("defupperarml").sub(world("defupperarmr")).normalize();
  const fwd = new THREE.Vector3().crossVectors(left, up).normalize();
  const tail = (k: string, fallback: string) => (byKey.has(fallback) ? world(fallback) : world(k));
  const restSide = {} as Joints["side"];
  for (const k of ["l", "r"] as const) {
    restSide[k === "l" ? "L" : "R"] = {
      shoulder: world(`defupperarm${k}`),
      elbow: world(`defforearm${k}`),
      wrist: world(`defhand${k}`),
      grip: tail(`defhand${k}`, `deffmiddle01${k}`),
      hip: world(`defthigh${k}`),
      knee: world(`defshin${k}`),
      ankle: world(`deffoot${k}`),
      toe: world(`deftoe${k}`),
    };
  }
  const Up = world("defspine002").sub(world("defspine")).normalize();
  const U = world("defspine004").sub(world("defspine002")).normalize();
  const Uh = byKey.has("defspine006") ? world("defspine006").sub(world("defspine005")).normalize() : U.clone();
  const restJoints: Joints = {
    pelvis: world("defspine"),
    mid: world("defspine002"),
    chest: world("defspine004"),
    neck: world("defspine006"),
    Up,
    Fp: perp(fwd, Up).normalize(),
    U,
    F: perp(fwd, U).normalize(),
    Uh,
    Fh: perp(fwd, Uh).normalize(),
    side: restSide,
  };
  const restFrames = frames(restJoints);
  const restFrameInv = Object.fromEntries(Object.entries(restFrames).map(([k, m]) => [k, m.clone().invert()])) as Frames;

  // Record every deforming bone's rest transform, then lift all bones out of
  // the hierarchy: from now on their world matrices are set directly.
  const recs: BoneRec[] = [];
  const holder = new THREE.Group();
  for (const b of bones) {
    const k = key(b.name);
    const rest = b.matrixWorld.clone();
    const restPos = new THREE.Vector3();
    const restRot = new THREE.Quaternion();
    const restScale = new THREE.Vector3();
    rest.decompose(restPos, restRot, restScale);
    recs.push({ bone: b, key: k, parent: k.startsWith("def") ? logicalParent(k) : null, rest, restPos, restRot, restScale, posed: rest.clone() });
  }
  for (const r of recs) {
    holder.add(r.bone);
    r.bone.matrixAutoUpdate = false;
    r.bone.matrix.copy(r.rest);
  }
  const recByKey = new Map(recs.map((r) => [r.key, r]));
  // Process parents before children.
  const order: BoneRec[] = [];
  const seen = new Set<string>();
  const visit = (r: BoneRec) => {
    if (seen.has(r.key)) return;
    if (r.parent && recByKey.has(r.parent)) visit(recByKey.get(r.parent)!);
    seen.add(r.key);
    order.push(r);
  };
  recs.filter((r) => r.key.startsWith("def")).forEach(visit);

  // ---- material and muscle weights
  const original = body.material as THREE.MeshStandardMaterial;
  const ao = original.aoMap ?? original.metalnessMap ?? null;
  const { mat, u } = porcelain(ao);
  body.material = mat;
  body.castShadow = true;
  body.receiveShadow = true;
  body.frustumCulled = false;
  muscleWeights(body, bones, restJoints, fwd);

  const root = new THREE.Group();
  root.add(scene, holder);

  // Finger curl around each bone's own bend axis, for a closed grip on a bar.
  const curl = new Map<string, number>();
  for (const r of recs) {
    const m = r.key.match(/^def(f(index|middle|ring|pinky)|thumb)(\d\d)(l|r)$/);
    if (m) curl.set(r.key, m[1] === "thumb" ? 0.35 : m[3] === "01" ? 0.95 : 1.15);
  }

  const tmpQ = new THREE.Quaternion();
  const tmpM = new THREE.Matrix4();
  const delta = new Map<string, THREE.Matrix4>();

  return {
    root,
    pose(p, grip) {
      const posedFrames = frames(jointsFromPose(p));
      delta.clear();
      for (const r of order) {
        const seg = SEGMENT[r.key];
        let rot: THREE.Quaternion;
        if (seg) {
          // posed basis · rest basis⁻¹ · rest rotation
          tmpM.multiplyMatrices(posedFrames[seg], restFrameInv[seg]);
          rot = new THREE.Quaternion().setFromRotationMatrix(tmpM).multiply(r.restRot);
        } else {
          const parent = r.parent ? recByKey.get(r.parent) : null;
          const pd = parent ? delta.get(parent.key) : null;
          rot = pd ? new THREE.Quaternion().setFromRotationMatrix(pd).multiply(r.restRot) : r.restRot.clone();
          const c = curl.get(r.key);
          if (c && grip === "bar") rot.multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), c));
          else if (c) rot.multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), c * 0.25));
        }
        // Position: the root sits on the engine's pelvis; everything else hangs off its logical parent.
        let pos: THREE.Vector3;
        const parent = r.parent ? recByKey.get(r.parent) : null;
        if (!parent) pos = V(p.pelvis);
        else {
          const local = r.restPos.clone().applyMatrix4(parent.rest.clone().invert());
          pos = local.applyMatrix4(parent.posed);
        }
        r.posed.compose(pos, rot, r.restScale);
        r.bone.matrix.copy(r.posed);
        delta.set(r.key, new THREE.Matrix4().makeRotationFromQuaternion(rot.clone().multiply(r.restRot.clone().invert())));
      }
      holder.updateMatrixWorld(true);
      const g = (k: "l" | "r") => {
        const hand = recByKey.get(`defhand${k}`);
        const mid = recByKey.get(`deffmiddle01${k}`);
        const a = hand ? new THREE.Vector3().setFromMatrixPosition(hand.posed) : V(p.grip[k === "l" ? "L" : "R"]);
        const b = mid ? new THREE.Vector3().setFromMatrixPosition(mid.posed) : a;
        return a.lerp(b, 0.85);
      };
      return { gripL: g("l"), gripR: g("r") };
    },
    levels(primary, secondary) {
      const lv = new Array(12).fill(0);
      for (const m of secondary) lv[MUSCLES.findIndex((x) => x.id === m)] = 0.26;
      for (const m of primary) lv[MUSCLES.findIndex((x) => x.id === m)] = 1;
      u.uL0.value.set(lv[0], lv[1], lv[2], lv[3]);
      u.uL1.value.set(lv[4], lv[5], lv[6], lv[7]);
      u.uL2.value.set(lv[8], lv[9], lv[10], lv[11]);
    },
    pulse(t) {
      u.uPulse.value = Math.sin(t * 2.4) * 0.5 + 0.5;
    },
    dispose() {
      body.geometry.dispose();
      mat.dispose();
    },
  };
}

// ---------------------------------------------------------------- muscles
// Each vertex is classified by the bone that moves it most and where it sits
// around that bone (front, back, outside), at rest.
function muscleWeights(mesh: THREE.SkinnedMesh, bones: THREE.Bone[], j: Joints, fwd: THREE.Vector3) {
  const g = mesh.geometry;
  const n = g.attributes.position.count;
  const si = g.attributes.skinIndex as THREE.BufferAttribute;
  const sw = g.attributes.skinWeight as THREE.BufferAttribute;
  const m = [new Float32Array(n * 4), new Float32Array(n * 4), new Float32Array(n * 4)];
  const idx = Object.fromEntries(MUSCLES.map((x, i) => [x.id, i])) as Record<Muscle, number>;
  const put = (v: number, mus: Muscle, w: number) => {
    const i = idx[mus];
    const arr = m[Math.floor(i / 4)];
    arr[v * 4 + (i % 4)] = Math.max(arr[v * 4 + (i % 4)], Math.min(1, w));
  };
  const p = new THREE.Vector3();
  const keys = bones.map((b) => key(b.name));
  const torsoLo = j.pelvis.y - 0.12;
  const torsoHi = j.chest.y + 0.02;
  for (let v = 0; v < n; v++) {
    // Strongest bone for this vertex.
    let best = -1;
    let bw = 0;
    for (let c = 0; c < 4; c++) {
      const w = sw.getComponent(v, c);
      if (w > bw) {
        bw = w;
        best = si.getComponent(v, c);
      }
    }
    if (best < 0) continue;
    mesh.getVertexPosition(v, p);
    p.applyMatrix4(mesh.matrixWorld);
    const k = keys[best];
    const side = /l(\d{3})?$/.test(k) ? "L" : "R";
    const S = j.side[side as "L" | "R"];
    const around = (a: THREE.Vector3, b: THREE.Vector3, front: THREE.Vector3) => {
      const axis = b.clone().sub(a);
      const len = axis.length();
      axis.normalize();
      const t = p.clone().sub(a).dot(axis) / len;
      const radial = p.clone().sub(a).addScaledVector(axis, -p.clone().sub(a).dot(axis));
      const r = radial.length() || 1;
      const f = perp(front, axis).normalize();
      return { t, c: radial.dot(f) / r, out: radial.dot(S.shoulder.clone().sub(j.chest).setY(0).normalize()) / r };
    };
    if (/^def(thigh)/.test(k)) {
      const a = around(S.hip, S.knee, fwd);
      const along = smooth(-0.05, 0.12, a.t) * (1 - smooth(0.86, 1.0, a.t));
      put(v, "quads", along * smooth(-0.35, 0.3, a.c));
      put(v, "hamstrings", along * smooth(0.0, 0.5, -a.c));
      put(v, "glutes", (1 - smooth(0.05, 0.22, a.t)) * smooth(0.0, 0.5, -a.c));
    } else if (/^defshin/.test(k)) {
      const a = around(S.knee, S.ankle, fwd);
      put(v, "calves", smooth(0.0, 0.5, -a.c) * (1 - smooth(0.62, 0.85, a.t)));
    } else if (/^defupperarm/.test(k)) {
      const a = around(S.shoulder, S.elbow, fwd);
      const top = 1 - smooth(0.12, 0.32, a.t);
      put(v, "shoulders", top);
      put(v, "biceps", (1 - top) * smooth(-0.2, 0.4, a.c) * (1 - smooth(0.88, 1.02, a.t)));
      put(v, "triceps", (1 - top) * smooth(0.0, 0.5, -a.c) * (1 - smooth(0.88, 1.02, a.t)));
    } else if (/^defshoulder/.test(k)) {
      const a = around(j.chest, S.shoulder, fwd);
      put(v, "shoulders", smooth(0.45, 0.85, a.t));
      put(v, "back", (1 - smooth(0.45, 0.85, a.t)) * smooth(0.0, 0.5, -a.c));
    } else if (/^defforearm/.test(k)) {
      const a = around(S.elbow, S.wrist, fwd);
      put(v, "forearms", 1 - smooth(0.7, 0.95, a.t));
    } else if (/^def(spine|pelvis|breast)/.test(k) && !/^defspine00[456]/.test(k)) {
      const h = (p.y - torsoLo) / (torsoHi - torsoLo);
      const radial = p.clone().sub(new THREE.Vector3(j.pelvis.x, p.y, j.pelvis.z));
      const r = radial.length() || 1;
      const c = radial.dot(fwd) / r;
      put(v, "chest", smooth(0.62, 0.74, h) * (1 - smooth(0.95, 1.05, h)) * smooth(0.25, 0.6, c));
      put(v, "core", smooth(0.2, 0.3, h) * (1 - smooth(0.58, 0.68, h)) * smooth(0.3, 0.65, c));
      put(v, "back", smooth(0.3, 0.42, h) * (1 - smooth(1.0, 1.1, h)) * smooth(0.05, 0.45, -c));
      put(v, "glutes", (1 - smooth(0.2, 0.32, h)) * smooth(0.1, 0.5, -c));
    }
  }
  g.setAttribute("m0", new THREE.BufferAttribute(m[0], 4));
  g.setAttribute("m1", new THREE.BufferAttribute(m[1], 4));
  g.setAttribute("m2", new THREE.BufferAttribute(m[2], 4));
}
