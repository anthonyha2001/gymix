import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Pattern } from "./patterns";
import type { Skeleton } from "./skeleton";

// The gym around the athlete, modelled like real equipment: powder-coated
// steel, chrome guide rods, upholstered pads with lime piping, weight stacks
// that rise as the cable is pulled, pulleys, platforms and racks.

export type Mats = {
  frame: THREE.Material;
  chrome: THREE.Material;
  steel: THREE.Material;
  pad: THREE.Material;
  rubber: THREE.Material;
  lime: THREE.Material;
  plate: THREE.Material;
  glass: THREE.Material;
  wood: THREE.Material;
  tile: THREE.Material;
  seam: THREE.Material;
  cable: THREE.Material;
};

export function machineMaterials(): Mats {
  return {
    frame: new THREE.MeshStandardMaterial({ color: "#1a1f26", metalness: 0.55, roughness: 0.42 }),
    chrome: new THREE.MeshStandardMaterial({ color: "#cfd5dc", metalness: 1, roughness: 0.26 }),
    steel: new THREE.MeshStandardMaterial({ color: "#9aa4b0", metalness: 1, roughness: 0.3 }),
    pad: new THREE.MeshPhysicalMaterial({ color: "#1c222b", roughness: 0.52, clearcoat: 0.4, clearcoatRoughness: 0.45, sheen: 0.5, sheenColor: new THREE.Color("#556070") }),
    rubber: new THREE.MeshStandardMaterial({ color: "#121519", roughness: 0.7, metalness: 0.02 }),
    lime: new THREE.MeshStandardMaterial({ color: "#c8f135", emissive: "#c8f135", emissiveIntensity: 0.55, roughness: 0.4 }),
    plate: new THREE.MeshStandardMaterial({ color: "#2a3038", metalness: 0.7, roughness: 0.35 }),
    glass: new THREE.MeshPhysicalMaterial({ color: "#0d1117", roughness: 0.08, metalness: 0, transparent: true, opacity: 0.32, clearcoat: 1 }),
    wood: new THREE.MeshStandardMaterial({ color: "#5b4632", roughness: 0.62, metalness: 0 }),
    tile: new THREE.MeshStandardMaterial({ color: "#14181e", roughness: 0.92, metalness: 0 }),
    seam: new THREE.MeshStandardMaterial({ color: "#0a0c10", roughness: 1 }),
    cable: new THREE.MeshStandardMaterial({ color: "#c9d0d8", metalness: 0.85, roughness: 0.3 }),
  };
}

export type Machine = { group: THREE.Group; update: (sk: Skeleton, rest: Skeleton) => void };

type V = [number, number, number];

class Kit {
  group = new THREE.Group();
  constructor(public m: Mats) {}
  private add<T extends THREE.Object3D>(o: T, parent: THREE.Object3D = this.group) {
    o.traverse((x) => {
      if (x instanceof THREE.Mesh) {
        x.castShadow = true;
        x.receiveShadow = true;
      }
    });
    parent.add(o);
    return o;
  }
  // A rounded box centred at c.
  box(size: V, c: V, mat: THREE.Material, r = 0.012, parent?: THREE.Object3D) {
    const rr = Math.min(r, size[0] / 2.1, size[1] / 2.1, size[2] / 2.1);
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 3, rr), mat);
    mesh.position.set(...c);
    return this.add(mesh, parent);
  }
  // A cylinder from a to b.
  rod(a: V, b: V, r: number, mat: THREE.Material, seg = 24, parent?: THREE.Object3D) {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat);
    mesh.position.copy(va).addScaledVector(d, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return this.add(mesh, parent);
  }
  // A pulley wheel in its housing, turning about `axis`.
  pulley(c: V, axis: "x" | "z", parent?: THREE.Object3D) {
    const g = new THREE.Group();
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.013, 14, 40), this.m.steel);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 32), this.m.frame);
    disc.rotation.x = Math.PI / 2;
    g.add(wheel, disc);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.13, 0.008, 2, 0.003), this.m.frame);
      side.position.z = s * 0.022;
      g.add(side);
    }
    if (axis === "x") g.rotation.y = Math.PI / 2;
    g.position.set(...c);
    return this.add(g, parent);
  }
  // A thin cable stretched between moving points.
  cable() {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 1, 8), this.m.cable);
    mesh.castShadow = true;
    this.group.add(mesh);
    return (a: THREE.Vector3, b: THREE.Vector3) => {
      const d = b.clone().sub(a);
      mesh.position.copy(a).addScaledVector(d, 0.5);
      mesh.scale.set(1, Math.max(0.001, d.length()), 1);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    };
  }
  // A selectorised weight stack between two guide rods. Returns the moving group.
  stack(base: V, height: number, plates = 14, parent?: THREE.Object3D) {
    const [x, y, z] = base;
    for (const s of [-1, 1]) this.rod([x + s * 0.11, y, z], [x + s * 0.11, y + height, z], 0.011, this.m.chrome, 20, parent);
    this.box([0.36, 0.03, 0.2], [x, y + 0.015, z], this.m.frame, 0.006, parent);
    this.box([0.36, 0.03, 0.2], [x, y + height - 0.015, z], this.m.frame, 0.006, parent);
    const moving = new THREE.Group();
    const still = new THREE.Group();
    const pin = 6; // the pin sits under the 6th plate from the top
    for (let i = 0; i < plates; i++) {
      const py = y + 0.05 + i * 0.031;
      const target = i >= plates - pin ? moving : still;
      const p = this.box([0.3, 0.027, 0.15], [x, py, z], this.m.plate, 0.004, target);
      if (i % 2 === 0) this.box([0.302, 0.003, 0.152], [x, py + 0.0125, z], this.m.chrome, 0.001, target);
      void p;
    }
    const top = y + 0.05 + plates * 0.031;
    this.box([0.3, 0.035, 0.15], [x, top + 0.004, z], this.m.chrome, 0.006, moving);
    this.rod([x, top, z], [x, top - plates * 0.031 * 0.9, z], 0.009, this.m.steel, 12, moving);
    // The lime selector pin.
    const pinY = y + 0.05 + (plates - pin) * 0.031 - 0.002;
    this.rod([x - 0.03, pinY, z + 0.075], [x, pinY, z + 0.075], 0.008, this.m.lime, 12, moving);
    this.add(still, parent ?? this.group);
    this.add(moving, parent ?? this.group);
    return { moving, top: top + 0.02 };
  }
  // A rubber gym floor with tile seams.
  floor(w: number, d: number, cz = 0) {
    this.box([w, 0.016, d], [0, -0.008, cz], this.m.tile, 0.004);
    for (let i = -w / 2 + 0.6; i < w / 2; i += 0.6) this.box([0.006, 0.002, d], [i, 0.0004, cz], this.m.seam, 0);
    for (let i = -d / 2 + 0.6; i < d / 2; i += 0.6) this.box([w, 0.002, 0.006], [0, 0.0004, cz + i], this.m.seam, 0);
  }
}

const vec = (p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x, p.y, p.z);
const gripMid = (s: Skeleton) => vec(s.grip.L).add(vec(s.grip.R)).multiplyScalar(0.5);

// ------------------------------------------------------------------ builders
// Squat stands: two free uprights on wide feet, J-hooks, spotter arms and
// plate horns. Open at the front and sides, so the athlete stays in view.
function squatStands(k: Kit, hookY: number) {
  k.floor(2.6, 2.4, -0.1);
  const m = k.m;
  for (const s of [-1, 1]) {
    const x = s * 0.62;
    // Foot: a wide base with rubber pads.
    k.box([0.09, 0.06, 0.78], [x, 0.03, -0.12], m.frame, 0.012);
    k.box([0.3, 0.06, 0.09], [x - s * 0.08, 0.03, -0.12], m.frame, 0.012);
    for (const z of [-0.48, 0.24]) k.box([0.1, 0.012, 0.08], [x, 0.006, z], m.rubber, 0.004);
    // Upright with a lime stripe and hole marks.
    k.box([0.075, 1.75, 0.075], [x, 0.9, -0.12], m.frame, 0.01);
    k.box([0.004, 1.5, 0.012], [x - s * 0.038, 0.95, -0.12], m.lime, 0.001);
    for (let y = 0.3; y < 1.65; y += 0.075) k.box([0.003, 0.012, 0.02], [x - s * 0.038, y, -0.093], m.seam, 0.001);
    k.box([0.085, 0.02, 0.085], [x, 1.785, -0.12], m.frame, 0.004);
    // J-hook and spotter arm.
    k.box([0.065, 0.12, 0.09], [x - s * 0.01, hookY, -0.04], m.frame, 0.01);
    k.box([0.05, 0.026, 0.06], [x - s * 0.01, hookY - 0.05, 0.0], m.rubber, 0.008);
    k.box([0.06, 0.06, 0.62], [x, 0.66, -0.12], m.steel, 0.01);
    k.box([0.064, 0.012, 0.6], [x, 0.695, -0.12], m.rubber, 0.004);
    // Plate horn at the back with two stored plates.
    k.rod([x, 0.3, -0.16], [x, 0.3, -0.72], 0.025, m.chrome);
    for (const [z, r] of [
      [-0.62, 0.225],
      [-0.67, 0.17],
    ] as const) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.045, 48), m.rubber);
      plate.rotation.x = Math.PI / 2;
      plate.position.set(x, Math.max(r, 0.3), z);
      plate.castShadow = true;
      k.group.add(plate);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.84, 0.0035, 8, 64), m.lime);
      ring.position.set(x, Math.max(r, 0.3), z - 0.024);
      k.group.add(ring);
    }
  }
}

function platform(k: Kit) {
  const m = k.m;
  k.box([2.4, 0.03, 2.4], [0, -0.013, 0], m.rubber, 0.006);
  k.box([1.2, 0.034, 2.36], [0, -0.0135, 0], m.wood, 0.004);
  for (let i = -0.45; i <= 0.45; i += 0.15) k.box([0.003, 0.0345, 2.36], [i, -0.013, 0], m.seam, 0);
  k.box([2.42, 0.036, 0.025], [0, -0.013, 1.2], m.frame, 0.004);
  k.box([2.42, 0.036, 0.025], [0, -0.013, -1.2], m.frame, 0.004);
}

// A rubber floor mat with a lime edge line.
function mat(k: Kit) {
  k.floor(2.8, 3, -0.25);
  const m = k.m;
  k.box([0.64, 0.012, 2.2], [0, 0.006, -0.25], m.rubber, 0.004);
  for (const s of [-1, 1]) k.box([0.004, 0.0125, 2.14], [s * 0.3, 0.006, -0.25], m.lime, 0.001);
}

function dumbbellRack(k: Kit) {
  k.floor(3, 2.4, -0.3);
  const m = k.m;
  const z = -1.15;
  for (const s of [-1, 1]) {
    k.box([0.06, 0.82, 0.5], [s * 0.85, 0.43, z], m.frame, 0.01);
  }
  for (const [y, tilt] of [
    [0.78, 0.16],
    [0.46, 0.16],
  ] as const) {
    const shelf = k.box([1.66, 0.03, 0.34], [0, y, z], m.frame, 0.006);
    shelf.rotation.x = tilt;
    for (let i = 0; i < 5; i++) {
      const x = -0.66 + i * 0.33;
      const r = 0.045 + i * 0.006 + (y < 0.6 ? 0.012 : 0);
      for (const dz of [-0.07, 0.07]) {
        const g = new THREE.Group();
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.13, 12), m.steel);
        handle.rotation.z = Math.PI / 2;
        g.add(handle);
        for (const sx of [-1, 1]) {
          const head = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.07 + i * 0.006, 6), m.rubber);
          head.rotation.z = Math.PI / 2;
          head.position.x = sx * (0.1 + i * 0.004);
          head.castShadow = true;
          g.add(head);
        }
        g.position.set(x, y + 0.02 + r, z + dz);
        g.rotation.x = tilt;
        k.group.add(g);
      }
    }
  }
}

function bench(k: Kit) {
  k.floor(2.6, 2.6, -0.3);
  const m = k.m;
  // Upholstered pad with lime piping.
  k.box([0.3, 0.075, 1.15], [0, 0.4, -0.375], m.pad, 0.03);
  for (const s of [-1, 1]) k.box([0.004, 0.006, 1.1], [s * 0.15, 0.4, -0.375], m.lime, 0.001);
  // Spine frame under the pad.
  k.box([0.08, 0.06, 1.0], [0, 0.33, -0.38], m.frame, 0.008);
  k.box([0.07, 0.3, 0.07], [0, 0.17, 0.08], m.frame, 0.008);
  k.box([0.5, 0.05, 0.07], [0, 0.03, 0.08], m.frame, 0.01);
  for (const s of [-1, 1]) k.box([0.06, 0.04, 0.075], [s * 0.26, 0.02, 0.08], m.rubber, 0.01);
  // Integrated uprights with J-hooks and plate horns.
  k.box([1.24, 0.06, 0.08], [0, 0.03, -0.62], m.frame, 0.01);
  k.box([0.08, 0.06, 0.5], [0, 0.03, -0.62 + 0.25], m.frame, 0.008);
  for (const s of [-1, 1]) {
    k.box([0.07, 1.22, 0.07], [s * 0.58, 0.64, -0.62], m.frame, 0.01);
    k.box([0.004, 1.0, 0.012], [s * 0.58 - s * 0.037, 0.62, -0.62], m.lime, 0.001);
    k.box([0.06, 0.11, 0.085], [s * 0.55, 1.07, -0.56], m.frame, 0.01);
    k.box([0.05, 0.028, 0.05], [s * 0.55, 1.025, -0.52], m.rubber, 0.008);
    k.rod([s * 0.58, 0.35, -0.66], [s * 0.58, 0.35, -0.9], 0.025, m.chrome);
  }
}

function pulldown(k: Kit, p: Pattern) {
  k.floor(2.4, 2.6, -0.1);
  const m = k.m;
  // Base and frame.
  k.box([0.8, 0.05, 1.45], [0, 0.04, -0.15], m.frame, 0.01);
  for (const s of [-1, 1]) k.box([0.08, 2.3, 0.08], [s * 0.24, 1.18, -0.78], m.frame, 0.01);
  k.box([0.56, 0.08, 0.08], [0, 2.34, -0.78], m.frame, 0.01);
  k.box([0.08, 0.08, 1.0], [0, 2.34, -0.32], m.frame, 0.01);
  k.box([0.004, 0.012, 0.9], [0, 2.3, -0.32], m.lime, 0.001);
  // Stack behind a smoked shield.
  const stack = k.stack([0, 0.06, -0.78], 1.85, 16);
  k.box([0.46, 1.6, 0.006], [0, 1.0, -0.66], m.glass, 0.002);
  // Pulleys: over the stack and at the front of the beam.
  const pBack: [number, number, number] = [0, 2.24, -0.78];
  const pFront: [number, number, number] = [p.pulley!.x, p.pulley!.y, p.pulley!.z];
  k.pulley(pBack, "x");
  k.pulley(pFront, "x");
  // Seat on its post, and the thigh rollers.
  k.rod([0, 0.06, 0.05], [0, 0.38, 0.05], 0.032, m.steel);
  k.box([0.36, 0.075, 0.44], [0, 0.42, 0.05], m.pad, 0.03);
  k.box([0.004, 0.006, 0.4], [0.18, 0.42, 0.05], m.lime, 0.001);
  k.box([0.004, 0.006, 0.4], [-0.18, 0.42, 0.05], m.lime, 0.001);
  k.box([0.05, 0.3, 0.05], [0, 0.6, 0.36], m.frame, 0.008);
  k.rod([-0.28, 0.73, 0.33], [0.28, 0.73, 0.33], 0.012, m.steel);
  for (const s of [-1, 1]) {
    const roll = k.rod([s * 0.05, 0.73, 0.33], [s * 0.25, 0.73, 0.33], 0.055, m.pad, 28);
    void roll;
  }
  k.box([0.06, 0.05, 0.5], [0, 0.04, 0.32], m.frame, 0.008);

  const c1 = k.cable();
  const c2 = k.cable();
  const c3 = k.cable();
  return (sk: Skeleton, rest: Skeleton) => {
    const front = new THREE.Vector3(...pFront);
    const travel = Math.max(0, gripMid(sk).distanceTo(front) - gripMid(rest).distanceTo(front));
    stack.moving.position.y = Math.min(0.9, travel);
    const top = new THREE.Vector3(0, stack.top + stack.moving.position.y, -0.78);
    c1(top, new THREE.Vector3(0, pBack[1] - 0.05, -0.78));
    c2(new THREE.Vector3(0, pBack[1] + 0.05, -0.78), new THREE.Vector3(0, pFront[1] + 0.05, pFront[2]));
    c3(new THREE.Vector3(0, pFront[1] - 0.04, pFront[2] + 0.02), gripMid(sk));
  };
}

function cableRow(k: Kit, p: Pattern) {
  k.floor(2.4, 3.0, 0.4);
  const m = k.m;
  // Long base rail, seat and the angled foot plate.
  k.box([0.22, 0.12, 1.65], [0, 0.07, 0.38], m.frame, 0.012);
  k.box([0.004, 0.012, 1.5], [0.112, 0.1, 0.38], m.lime, 0.001);
  k.box([0.34, 0.075, 0.6], [0, 0.29, -0.07], m.pad, 0.03);
  k.box([0.06, 0.16, 0.06], [0, 0.17, -0.07], m.frame, 0.008);
  const plate = k.box([0.5, 0.36, 0.04], [0, 0.27, 0.84], m.steel, 0.012);
  plate.rotation.x = -0.32;
  for (const s of [-1, 1]) {
    const pad = k.box([0.17, 0.26, 0.012], [s * 0.13, 0.27, 0.815], m.rubber, 0.006);
    pad.rotation.x = -0.32;
  }
  // The tower: a stack between uprights, a top pulley and the low pulley.
  for (const s of [-1, 1]) k.box([0.08, 1.75, 0.08], [s * 0.24, 0.89, 1.3], m.frame, 0.01);
  k.box([0.56, 0.08, 0.12], [0, 1.76, 1.3], m.frame, 0.01);
  k.box([0.6, 0.05, 0.4], [0, 0.03, 1.3], m.frame, 0.01);
  const stack = k.stack([0, 0.06, 1.3], 1.6, 14);
  k.box([0.46, 1.4, 0.006], [0, 0.85, 1.18], m.glass, 0.002);
  const pTop: [number, number, number] = [0, 1.7, 1.3];
  const pLow: [number, number, number] = [0, 0.16, 1.12];
  const pOut: [number, number, number] = [p.pulley!.x, p.pulley!.y, p.pulley!.z];
  k.pulley(pTop, "x");
  k.pulley(pLow, "x");
  k.pulley(pOut, "x");
  const a = k.cable();
  const b = k.cable();
  const c = k.cable();
  const d = k.cable();
  return (sk: Skeleton, rest: Skeleton) => {
    const out = new THREE.Vector3(...pOut);
    const travel = Math.max(0, gripMid(sk).distanceTo(out) - gripMid(rest).distanceTo(out));
    stack.moving.position.y = Math.min(0.8, travel);
    a(new THREE.Vector3(0, stack.top + stack.moving.position.y, 1.3), new THREE.Vector3(0, pTop[1] - 0.05, 1.3));
    b(new THREE.Vector3(0, pTop[1] + 0.05, 1.25), new THREE.Vector3(0, pLow[1], 1.16));
    c(new THREE.Vector3(0, pLow[1] - 0.04, pLow[2]), new THREE.Vector3(0, pOut[1] - 0.04, pOut[2] + 0.02));
    d(new THREE.Vector3(0, pOut[1], pOut[2] - 0.04), gripMid(sk));
  };
}

function cableTower(k: Kit, p: Pattern) {
  k.floor(2.4, 2.4, 0.2);
  const m = k.m;
  const z = 0.82;
  k.box([0.62, 0.05, 0.5], [0, 0.03, z], m.frame, 0.01);
  for (const s of [-1, 1]) k.box([0.08, 2.25, 0.08], [s * 0.24, 1.15, z], m.frame, 0.01);
  k.box([0.56, 0.08, 0.1], [0, 2.26, z], m.frame, 0.01);
  k.box([0.08, 0.08, 0.36], [0, 2.18, z - 0.16], m.frame, 0.01);
  k.box([0.004, 1.9, 0.012], [0.2, 1.1, z - 0.04], m.lime, 0.001);
  const stack = k.stack([0, 0.06, z], 1.95, 16);
  k.box([0.46, 1.6, 0.006], [0, 1.0, z - 0.11], m.glass, 0.002);
  const pTop: [number, number, number] = [0, 2.2, z];
  const pFront: [number, number, number] = [p.pulley!.x, p.pulley!.y, p.pulley!.z];
  k.pulley(pTop, "x");
  k.pulley(pFront, "x");
  const a = k.cable();
  const b = k.cable();
  const c = k.cable();
  return (sk: Skeleton, rest: Skeleton) => {
    const f = new THREE.Vector3(...pFront);
    const travel = Math.max(0, gripMid(sk).distanceTo(f) - gripMid(rest).distanceTo(f));
    stack.moving.position.y = Math.min(0.9, travel);
    a(new THREE.Vector3(0, stack.top + stack.moving.position.y, z), new THREE.Vector3(0, pTop[1] - 0.05, z));
    b(new THREE.Vector3(0, pTop[1] + 0.05, z - 0.02), new THREE.Vector3(0, pFront[1] + 0.05, pFront[2]));
    c(new THREE.Vector3(0, pFront[1] - 0.04, pFront[2] - 0.02), gripMid(sk));
  };
}

function legExtension(k: Kit, behind = false) {
  k.floor(2.6, 2.4, 0);
  const m = k.m;
  k.box([0.7, 0.05, 0.9], [0.12, 0.03, -0.05], m.frame, 0.01);
  k.box([0.1, 0.36, 0.3], [0, 0.21, 0.02], m.frame, 0.012);
  k.box([0.38, 0.08, 0.52], [0, 0.42, 0.06], m.pad, 0.03);
  for (const s of [-1, 1]) k.box([0.004, 0.006, 0.48], [s * 0.19, 0.42, 0.06], m.lime, 0.001);
  // Backrest, tilted with the athlete.
  const back = k.box([0.38, 0.62, 0.08], [0, 0.78, -0.31], m.pad, 0.03);
  back.rotation.x = -0.14;
  k.box([0.06, 0.5, 0.06], [0, 0.6, -0.39], m.frame, 0.008);
  // Side handles.
  for (const s of [-1, 1]) {
    k.rod([s * 0.21, 0.36, -0.02], [s * 0.3, 0.36, -0.02], 0.012, m.steel);
    k.rod([s * 0.3, 0.36, -0.02], [s * 0.3, 0.36, 0.14], 0.016, m.rubber);
    k.rod([s * 0.21, 0.2, -0.02], [s * 0.21, 0.36, -0.02], 0.014, m.frame);
  }
  // The weight stack at the side.
  const sx = 0.62;
  for (const s of [-1, 1]) k.box([0.07, 1.4, 0.07], [sx, 0.72, -0.05 + s * 0.17], m.frame, 0.01);
  k.box([0.07, 0.07, 0.42], [sx, 1.42, -0.05], m.frame, 0.01);
  const stackGroup = new THREE.Group();
  stackGroup.position.set(sx, 0, -0.05);
  stackGroup.rotation.y = Math.PI / 2;
  k.group.add(stackGroup);
  const stack = k.stack([0, 0.06, 0], 1.3, 12, stackGroup);
  k.pulley([sx, 1.36, -0.05], "z");
  // Lever: a cam at the knee, an arm down to the shin roller.
  const lever = new THREE.Group();
  k.group.add(lever);
  const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 40), m.frame);
  cam.rotation.z = Math.PI / 2;
  cam.position.x = 0.3;
  lever.add(cam);
  const camRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.004, 8, 40), m.lime);
  camRing.rotation.y = Math.PI / 2;
  camRing.position.x = 0.322;
  lever.add(camRing);
  const arm = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.42, 0.05, 2, 0.01), m.frame);
  arm.position.set(0.3, -0.21, 0);
  arm.castShadow = true;
  lever.add(arm);
  const rollerBar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 12), m.steel);
  rollerBar.rotation.z = Math.PI / 2;
  rollerBar.position.set(0, -0.4, 0);
  lever.add(rollerBar);
  for (const s of [-1, 1]) {
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 28), m.pad);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(s * 0.13, -0.4, 0);
    roll.castShadow = true;
    lever.add(roll);
  }
  const c1 = k.cable();
  const c2 = k.cable();
  return (sk: Skeleton, rest: Skeleton) => {
    const knee = vec(sk.knee.L).add(vec(sk.knee.R)).multiplyScalar(0.5);
    const ankle = vec(sk.ankle.L).add(vec(sk.ankle.R)).multiplyScalar(0.5);
    const d = ankle.clone().sub(knee).normalize();
    // Pivot on the knee axis; the arm points down the shin, the roller rests on its front.
    lever.position.copy(knee);
    const angle = Math.atan2(d.z, -d.y);
    lever.rotation.x = -angle;
    const restD = vec(rest.ankle.L).sub(vec(rest.knee.L)).normalize();
    const restAngle = Math.atan2(restD.z, -restD.y);
    // The roller sits slightly forward of the shin.
    lever.children.forEach((c) => {
      if (c !== cam && c !== camRing && c !== arm) c.position.z = behind ? -0.075 : 0.075;
    });
    const travel = Math.abs(angle - restAngle) * 0.16;
    stack.moving.position.y = Math.min(0.7, travel);
    const camEdge = new THREE.Vector3(0.36, knee.y + 0.06, knee.z);
    c1(camEdge, new THREE.Vector3(sx, 1.36, -0.05));
    c2(new THREE.Vector3(sx, 1.31, -0.05), new THREE.Vector3(sx, stack.top + stack.moving.position.y, -0.05));
  };
}

export function buildMachine(p: Pattern, mats: Mats): Machine {
  const k = new Kit(mats);
  let update: Machine["update"] = () => {};
  switch (p.id) {
    case "squat":
      squatStands(k, 1.32);
      break;
    case "ohp":
      squatStands(k, 1.36);
      break;
    case "deadlift":
    case "row":
    case "hinge":
    case "goodmorning":
      platform(k);
      break;
    case "bench":
    case "flye":
    case "skullcrusher":
      bench(k);
      break;
    case "pulldown":
      update = pulldown(k, p);
      break;
    case "cablerow":
      update = cableRow(k, p);
      break;
    case "pushdown":
      update = cableTower(k, p);
      break;
    case "legext":
      update = legExtension(k);
      break;
    case "legcurl":
      update = legExtension(k, true);
      break;
    case "pushup":
    case "crunch":
    case "bridge":
      mat(k);
      break;
    default:
      dumbbellRack(k);
  }
  return { group: k.group, update };
}
