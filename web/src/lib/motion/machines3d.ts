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
  // A rod of radius r between two moving points (lever arms, pads).
  link(r: number, mat: THREE.Material, seg = 16) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, seg), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return (a: THREE.Vector3, b: THREE.Vector3) => {
      const d = b.clone().sub(a);
      mesh.position.copy(a).addScaledVector(d, 0.5);
      mesh.scale.set(1, Math.max(0.001, d.length()), 1);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    };
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
  const first = k.group.children.length;
  for (const s of [-1, 1]) {
    const x = s * 0.62;
    // Foot: a wide base with rubber pads.
    k.box([0.09, 0.06, 0.78], [x, 0.03, -0.12], m.frame, 0.012);
    k.box([0.3, 0.06, 0.09], [x - s * 0.08, 0.03, -0.12], m.frame, 0.012);
    for (const z of [-0.48, 0.24]) k.box([0.1, 0.012, 0.08], [x, 0.006, z], m.rubber, 0.004);
    // Upright with a lime stripe and hole marks.
    k.box([0.075, 1.75, 0.075], [x, 0.9, -0.12], m.frame, 0.01);
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
  // Stepped back from the hooks: the bar never passes through an upright.
  for (const o of k.group.children.slice(first)) o.position.z -= 0.62;
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

function bench(k: Kit, uprights = true) {
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
  if (!uprights) return;
  // Integrated uprights with J-hooks and plate horns.
  k.box([1.24, 0.06, 0.08], [0, 0.03, -0.62], m.frame, 0.01);
  k.box([0.08, 0.06, 0.5], [0, 0.03, -0.62 + 0.25], m.frame, 0.008);
  for (const s of [-1, 1]) {
    k.box([0.07, 1.22, 0.07], [s * 0.58, 0.64, -0.62], m.frame, 0.01);
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

// ------------------------------------------------------------ stations
const rad = (d: number) => (d * Math.PI) / 180;
const ankleMid = (s: Skeleton) => vec(s.ankle.L).add(vec(s.ankle.R)).multiplyScalar(0.5);

// A pad lying along the torso: a backrest (out < 0) or a chest pad (out > 0).
function torsoPad(k: Kit, p: Pattern, along: number, out: number, size: V) {
  const s0 = p.keys[0].pose;
  const a = rad(s0.trunk ?? 0);
  const py = s0.pelvisY ?? 0.55;
  const pz = s0.pelvisZ ?? 0;
  const c: V = [0, py + Math.cos(a) * along - Math.sin(a) * out, pz + Math.sin(a) * along + Math.cos(a) * out];
  const pad = k.box(size, c, k.m.pad, 0.03);
  pad.rotation.x = a;
  return pad;
}

// A machine seat on its post, with a base plate.
function seat(k: Kit, z = 0.04) {
  const m = k.m;
  k.box([0.38, 0.075, 0.44], [0, 0.42, z], m.pad, 0.03);
  for (const s of [-1, 1]) k.box([0.004, 0.006, 0.4], [s * 0.19, 0.42, z], m.lime, 0.001);
  k.box([0.1, 0.36, 0.26], [0, 0.2, z], m.frame, 0.012);
  k.box([0.7, 0.05, 0.9], [0, 0.03, z - 0.1], m.frame, 0.01);
}

// A selectorised stack in its own frame, centred at (x, z).
function stackTower(k: Kit, x: number, z: number, h = 1.7) {
  const m = k.m;
  for (const s of [-1, 1]) k.box([0.07, h, 0.07], [x + s * 0.24, h / 2 + 0.02, z], m.frame, 0.01);
  k.box([0.56, 0.07, 0.1], [x, h + 0.02, z], m.frame, 0.01);
  k.box([0.6, 0.05, 0.36], [x, 0.03, z], m.frame, 0.01);
  return k.stack([x, 0.06, z], h - 0.25, 14);
}

// Plate-loaded or selectorised lever machines: chest press, shoulder press, chest-supported row.
function leverStation(k: Kit, p: Pattern, kind: "chest" | "shoulder" | "row") {
  const m = k.m;
  k.floor(2.6, 2.6, 0);
  seat(k);
  if (kind === "row") torsoPad(k, p, 0.4, 0.17, [0.34, 0.36, 0.08]);
  else torsoPad(k, p, 0.36, -0.15, [0.42, 0.68, 0.08]);
  const fz = kind === "row" ? 0.86 : -0.58;
  const stack = stackTower(k, 0, fz + (kind === "row" ? 0.16 : -0.16));
  for (const s of [-1, 1]) k.box([0.08, 1.62, 0.08], [s * 0.64, 0.81, fz], m.frame, 0.01);
  k.box([1.36, 0.08, 0.1], [0, 1.62, fz], m.frame, 0.01);
  k.box([0.08, 0.05, Math.abs(fz) + 0.1], [0, 0.03, fz / 2], m.frame, 0.008);
  const py = kind === "chest" ? 1.52 : kind === "shoulder" ? 0.72 : 1.42;
  const pivots = [1, -1].map((s) => new THREE.Vector3(s * 0.64, py, fz + (kind === "row" ? -0.06 : 0.06)));
  for (const pv of pivots) k.rod([pv.x - 0.05, pv.y, pv.z], [pv.x + 0.05, pv.y, pv.z], 0.04, m.steel);
  const arms = pivots.map(() => k.link(0.022, m.frame));
  const grips = pivots.map(() => k.link(0.017, m.rubber));
  const outs = pivots.map(() => k.link(0.016, m.steel));
  return (sk: Skeleton, rest: Skeleton) => {
    (["L", "R"] as const).forEach((side, i) => {
      const g = vec(sk.grip[side]);
      const elbow = new THREE.Vector3(pivots[i].x, g.y, g.z);
      outs[i](g, elbow);
      arms[i](pivots[i], elbow);
      grips[i](g.clone().add(new THREE.Vector3(0, -0.07, 0)), g.clone().add(new THREE.Vector3(0, 0.07, 0)));
    });
    stack.moving.position.y = Math.min(0.7, gripMid(sk).distanceTo(gripMid(rest)) * 0.6);
  };
}

// 45° leg press: reclined seat, a sled on two rails, plate horns.
function legPress(k: Kit, p: Pattern) {
  const m = k.m;
  k.floor(2.6, 3.2, 0.4);
  k.box([0.4, 0.075, 0.42], [0, 0.4, 0.02], m.pad, 0.03);
  torsoPad(k, p, 0.32, -0.15, [0.42, 0.72, 0.08]);
  k.box([0.8, 0.06, 2.1], [0, 0.03, 0.45], m.frame, 0.012);
  k.box([0.12, 0.34, 0.5], [0, 0.2, -0.05], m.frame, 0.012);
  const dir = new THREE.Vector3(0, 0.69, 0.72).normalize();
  for (const s of [-1, 1]) {
    k.rod([s * 0.34, 0.5, 0.2], [s * 0.34, 1.62, 1.37], 0.03, m.chrome);
    k.box([0.08, 1.6, 0.08], [s * 0.34, 0.8, 1.4], m.frame, 0.01);
    k.box([0.08, 0.5, 0.08], [s * 0.34, 0.25, 0.2], m.frame, 0.01);
    // Side handles by the seat.
    k.rod([s * 0.25, 0.42, 0.1], [s * 0.34, 0.42, 0.1], 0.012, m.steel);
    k.rod([s * 0.34, 0.42, -0.02], [s * 0.34, 0.42, 0.22], 0.016, m.rubber);
  }
  const sled = new THREE.Group();
  sled.rotation.x = Math.atan2(-dir.y, dir.z);
  k.group.add(sled);
  k.box([0.66, 0.62, 0.05], [0, 0, 0.03], m.steel, 0.02, sled);
  k.box([0.6, 0.56, 0.012], [0, 0, 0.0], m.rubber, 0.004, sled);
  for (const s of [-1, 1]) {
    k.box([0.1, 0.5, 0.12], [s * 0.34, -0.05, 0.1], m.frame, 0.012, sled);
    k.rod([s * 0.4, -0.05, 0.12], [s * 0.6, -0.05, 0.12], 0.025, m.chrome, 20, sled);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 48), m.rubber);
    plate.rotation.z = Math.PI / 2;
    plate.position.set(s * 0.48, -0.05, 0.12);
    plate.castShadow = true;
    sled.add(plate);
  }
  return (sk: Skeleton) => {
    sled.position.copy(ankleMid(sk).addScaledVector(dir, 0.1));
  };
}

// Smith machine: two guide rods with a carriage that rides with the bar.
function smith(k: Kit, withBench: boolean) {
  const m = k.m;
  if (withBench) bench(k, false);
  else k.floor(2.8, 2.4, -0.1);
  for (const s of [-1, 1]) {
    for (const z of [-0.46, 0.34]) k.box([0.07, 2.3, 0.07], [s * 0.7, 1.15, z], m.frame, 0.01);
    k.box([0.08, 0.06, 0.9], [s * 0.7, 2.3, -0.06], m.frame, 0.01);
    k.box([0.08, 0.05, 0.9], [s * 0.7, 0.03, -0.06], m.frame, 0.01);
  }
  k.box([1.48, 0.06, 0.08], [0, 2.3, -0.46], m.frame, 0.01);
  const guides = new THREE.Group();
  k.group.add(guides);
  const cars: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    k.rod([s * 0.6, 0.08, 0], [s * 0.6, 2.27, 0], 0.016, m.chrome, 20, guides);
    k.box([0.14, 0.04, 0.04], [s * 0.66, 2.27, 0], m.frame, 0.006, guides);
    k.box([0.14, 0.04, 0.04], [s * 0.66, 0.08, 0], m.frame, 0.006, guides);
    cars.push(k.box([0.06, 0.12, 0.07], [s * 0.6, 1, 0], m.frame, 0.012, guides));
  }
  return (sk: Skeleton, rest: Skeleton) => {
    guides.position.z = gripMid(rest).z;
    const y = gripMid(sk).y;
    for (const c of cars) c.position.y = y;
  };
}

// Pec deck: the arm pads swing about pivots above the shoulders.
function pecDeck(k: Kit, p: Pattern) {
  const m = k.m;
  k.floor(2.6, 2.4, 0);
  seat(k);
  torsoPad(k, p, 0.36, -0.15, [0.42, 0.7, 0.08]);
  const stack = stackTower(k, 0, -0.62, 1.95);
  k.box([0.08, 0.08, 0.5], [0, 1.95, -0.38], m.frame, 0.01);
  const pads = [0, 1].map(() => k.link(0.045, m.pad, 24));
  const tops = [0, 1].map(() => k.link(0.02, m.frame));
  const drops = [0, 1].map(() => k.link(0.018, m.frame));
  return (sk: Skeleton, rest: Skeleton) => {
    (["L", "R"] as const).forEach((side, i) => {
      const e = vec(sk.elbow[side]);
      const w = vec(sk.wrist[side]);
      const sh = vec(sk.shoulder[side]);
      const pivot = new THREE.Vector3(sh.x * 0.7, sh.y + 0.32, sh.z - 0.04);
      const over = new THREE.Vector3(w.x, pivot.y, w.z);
      pads[i](e.clone().add(new THREE.Vector3(0, -0.03, 0)), w.clone().add(new THREE.Vector3(0, 0.04, 0)));
      tops[i](pivot, over);
      drops[i](over, w);
    });
    const spread = (a: Skeleton) => vec(a.wrist.L).distanceTo(vec(a.wrist.R));
    stack.moving.position.y = Math.min(0.6, Math.abs(spread(sk) - spread(rest)) * 0.5);
  };
}

// Hip abduction / adduction: thigh pads on the outside or the inside of the knees.
function hipMachine(k: Kit, p: Pattern, inside: boolean) {
  const m = k.m;
  k.floor(2.6, 2.4, 0);
  seat(k);
  torsoPad(k, p, 0.36, -0.15, [0.42, 0.68, 0.08]);
  const stack = stackTower(k, 0, -0.66, 1.5);
  const pads = [0, 1].map(() => k.link(0.05, m.pad, 24));
  const posts = [0, 1].map(() => k.link(0.02, m.frame));
  return (sk: Skeleton, rest: Skeleton) => {
    (["L", "R"] as const).forEach((side, i) => {
      const s = side === "L" ? 1 : -1;
      const hip = vec(sk.hip[side]);
      const knee = vec(sk.knee[side]);
      const d = knee.clone().sub(hip).normalize();
      const n = new THREE.Vector3(s * d.z, 0, -s * d.x).normalize().multiplyScalar(inside ? -0.115 : 0.135);
      const a = hip.clone().addScaledVector(d, 0.22).add(n);
      const b = knee.clone().addScaledVector(d, 0.03).add(n);
      pads[i](a, b);
      posts[i](b, new THREE.Vector3(b.x, 0.42, b.z - 0.05));
    });
    const w = (a: Skeleton) => vec(a.knee.L).distanceTo(vec(a.knee.R));
    stack.moving.position.y = Math.min(0.6, Math.abs(w(sk) - w(rest)) * 0.9);
  };
}

// Seated calf raise: a knee pad that rises with the knees, a toe block.
function seatedCalf(k: Kit) {
  const m = k.m;
  k.floor(2.4, 2.4, 0.2);
  seat(k);
  k.box([0.5, 0.05, 1.1], [0, 0.03, 0.3], m.frame, 0.01);
  const pad = k.link(0.05, m.pad, 24);
  const lever = k.link(0.025, m.frame);
  const post = k.link(0.03, m.steel);
  k.rod([0.32, 0.25, 0.85], [0.32, 0.5, 0.85], 0.04, m.frame);
  for (const s of [-1, 1]) k.box([0.12, 0.16, 0.12], [s * 0.32, 0.1, 0.85], m.rubber, 0.02);
  return (sk: Skeleton) => {
    const kl = vec(sk.knee.L);
    const kr = vec(sk.knee.R);
    const y = Math.max(kl.y, kr.y) + 0.075;
    const z = (kl.z + kr.z) / 2 + 0.03;
    pad(new THREE.Vector3(-0.22, y, z), new THREE.Vector3(0.22, y, z));
    lever(new THREE.Vector3(0.22, y, z), new THREE.Vector3(0.32, 0.5, 0.85));
    post(new THREE.Vector3(0.32, 0.06, 0.85), new THREE.Vector3(0.32, 0.25, 0.85));
  };
}

// A lever with a shin roller pivoting at the knee (lying leg curl).
function shinLever(k: Kit, behind: boolean) {
  const m = k.m;
  const lever = new THREE.Group();
  k.group.add(lever);
  const arm = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.42, 0.05, 2, 0.01), m.frame);
  arm.position.set(0.3, -0.21, 0);
  arm.castShadow = true;
  lever.add(arm);
  const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 40), m.frame);
  cam.rotation.z = Math.PI / 2;
  cam.position.x = 0.3;
  lever.add(cam);
  const roller = new THREE.Group();
  roller.position.set(0, -0.4, behind ? -0.075 : 0.075);
  lever.add(roller);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 12), m.steel);
  bar.rotation.z = Math.PI / 2;
  roller.add(bar);
  for (const s of [-1, 1]) {
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 28), m.pad);
    roll.rotation.z = Math.PI / 2;
    roll.position.x = s * 0.13;
    roll.castShadow = true;
    roller.add(roll);
  }
  return (sk: Skeleton) => {
    const knee = vec(sk.knee.L).add(vec(sk.knee.R)).multiplyScalar(0.5);
    const d = ankleMid(sk).sub(knee).normalize();
    lever.position.copy(knee);
    lever.rotation.x = -Math.atan2(d.z, -d.y);
  };
}

function lyingCurl(k: Kit) {
  const m = k.m;
  k.floor(2.6, 2.8, 0);
  k.box([0.4, 0.08, 1.15], [0, 0.44, 0.22], m.pad, 0.03);
  for (const s of [-1, 1]) k.box([0.004, 0.006, 1.1], [s * 0.2, 0.44, 0.22], m.lime, 0.001);
  k.box([0.12, 0.38, 0.12], [0, 0.2, 0.55], m.frame, 0.012);
  k.box([0.12, 0.38, 0.12], [0, 0.2, -0.15], m.frame, 0.012);
  k.box([0.6, 0.05, 1.5], [0, 0.03, 0.15], m.frame, 0.01);
  for (const s of [-1, 1]) {
    k.rod([s * 0.2, 0.3, 0.86], [s * 0.3, 0.3, 0.86], 0.012, m.steel);
    k.rod([s * 0.3, 0.3, 0.78], [s * 0.3, 0.3, 0.96], 0.016, m.rubber);
  }
  const stack = stackTower(k, 0.75, -0.2, 1.4);
  const move = shinLever(k, true);
  return (sk: Skeleton, rest: Skeleton) => {
    move(sk);
    const ang = (a: Skeleton) => {
      const d = vec(a.ankle.L).sub(vec(a.knee.L)).normalize();
      return Math.atan2(d.y, -d.z);
    };
    stack.moving.position.y = Math.min(0.6, Math.abs(ang(sk) - ang(rest)) * 0.25);
  };
}

// 45° back extension bench: hip pad, ankle roller and foot plate.
function backExt(k: Kit) {
  const m = k.m;
  k.floor(2.6, 2.6, -0.2);
  const pad = k.box([0.42, 0.08, 0.3], [0, 0.556, 0.03], m.pad, 0.03);
  pad.rotation.x = -0.77;
  k.rod([0, 0.06, -0.95], [0, 0.48, -0.02], 0.04, m.frame);
  k.rod([0, 0.06, 0.25], [0, 0.48, 0.02], 0.035, m.frame);
  k.box([0.6, 0.05, 1.4], [0, 0.03, -0.35], m.frame, 0.01);
  const plate = k.box([0.4, 0.03, 0.3], [0, 0.045, -0.6], m.steel, 0.008);
  plate.rotation.x = 0;
  k.rod([-0.18, 0.2, -0.72], [0.18, 0.2, -0.72], 0.045, m.pad, 28);
  k.rod([0, 0.06, -0.72], [0, 0.2, -0.72], 0.02, m.frame);
  return () => {};
}

// Preacher bench: the arm pad sits under the upper arms.
function preacher(k: Kit) {
  const m = k.m;
  k.floor(2.4, 2.4, 0.1);
  seat(k);
  const pad = k.box([0.5, 0.32, 0.07], [0, 0.95, 0.3], m.pad, 0.03);
  const post = k.link(0.035, m.frame);
  k.box([0.5, 0.05, 0.4], [0, 0.03, 0.42], m.frame, 0.01);
  return (_sk: Skeleton, rest: Skeleton) => {
    const sh = vec(rest.shoulder.L).add(vec(rest.shoulder.R)).multiplyScalar(0.5);
    const el = vec(rest.elbow.L).add(vec(rest.elbow.R)).multiplyScalar(0.5);
    const d = el.clone().sub(sh).normalize();
    const n = new THREE.Vector3(0, -d.z, d.y);
    if (n.y > 0) n.negate();
    const c = sh.clone().lerp(el, 0.62).addScaledVector(n, 0.075);
    pad.position.copy(c);
    pad.rotation.x = Math.atan2(d.z, d.y) - Math.PI;
    post(new THREE.Vector3(0, 0.06, c.z + 0.08), c.clone().addScaledVector(n, 0.04));
  };
}

// Cable crossover: two towers with adjustable pulleys at the pattern's height.
function crossover(k: Kit, p: Pattern, cross: boolean) {
  const m = k.m;
  k.floor(3.2, 2.6, 0);
  const px = p.pulley!.x;
  const py = p.pulley!.y;
  const stacks = [1, -1].map((s) => {
    const x = s * 1.05;
    for (const dz of [-0.16, 0.16]) k.box([0.08, 2.3, 0.08], [x, 1.15, -0.08 + dz], m.frame, 0.01);
    k.box([0.1, 0.08, 0.44], [x, 2.3, -0.08], m.frame, 0.01);
    k.box([0.4, 0.05, 0.5], [x, 0.03, -0.08], m.frame, 0.01);
    const g = new THREE.Group();
    g.position.set(x, 0, -0.08);
    g.rotation.y = Math.PI / 2;
    k.group.add(g);
    const st = k.stack([0, 0.06, 0], 1.7, 14, g);
    k.pulley([s * px, py, -0.02], "z");
    k.pulley([x, 2.22, -0.08], "z");
    return { st, x };
  });
  k.box([2.2, 0.07, 0.07], [0, 2.3, -0.24], m.frame, 0.01);
  const toHand = [0, 1].map(() => k.cable());
  const up = [0, 1].map(() => k.cable());
  return (sk: Skeleton, rest: Skeleton) => {
    (["L", "R"] as const).forEach((side, i) => {
      const s = side === "L" ? 1 : -1;
      const from = cross ? -s : s;
      const pulley = new THREE.Vector3(from * px, py, -0.02);
      const g = vec(sk.grip[side]);
      toHand[i](pulley, g);
      const t = stacks[from === 1 ? 0 : 1];
      const travel = Math.max(0, g.distanceTo(pulley) - vec(rest.grip[side]).distanceTo(pulley));
      t.st.moving.position.y = Math.min(0.8, travel);
      up[i](new THREE.Vector3(t.x, t.st.top + t.st.moving.position.y, -0.08), new THREE.Vector3(t.x, 2.17, -0.08));
    });
  };
}

// Power tower: pull-up bar on top, dip bars at the front.
function tower(k: Kit) {
  const m = k.m;
  k.floor(2.6, 2.6, 0);
  for (const s of [-1, 1]) {
    k.box([0.08, 2.46, 0.08], [s * 0.66, 1.23, -0.3], m.frame, 0.01);
    k.box([0.1, 0.05, 0.9], [s * 0.66, 0.03, -0.1], m.frame, 0.01);
    k.box([0.06, 0.06, 0.4], [s * 0.6, 2.36, -0.12], m.frame, 0.008);
    k.box([0.05, 0.1, 0.05], [s * 0.6, 2.32, 0.02], m.frame, 0.008);
    // Dip bar on a bracket.
    k.box([0.42, 0.05, 0.05], [s * 0.46, 1.2, -0.3], m.frame, 0.008);
    k.rod([s * 0.27, 1.2, -0.3], [s * 0.27, 1.2, 0.45], 0.02, m.chrome);
    k.rod([s * 0.27, 1.2, 0.0], [s * 0.27, 1.2, 0.2], 0.024, m.rubber);
  }
  k.box([1.4, 0.08, 0.08], [0, 2.42, -0.3], m.frame, 0.01);
  k.rod([-0.72, 2.28, 0.02], [0.72, 2.28, 0.02], 0.016, m.chrome);
  for (const s of [-1, 1]) k.rod([s * 0.42, 2.28, 0.02], [s * 0.56, 2.28, 0.02], 0.02, m.rubber);
  return () => {};
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
    case "legpress":
      update = legPress(k, p);
      break;
    case "chestpress":
      update = leverStation(k, p, "chest");
      break;
    case "shoulderpress":
      update = leverStation(k, p, "shoulder");
      break;
    case "machinerow":
      update = leverStation(k, p, "row");
      break;
    case "pecdeck":
      update = pecDeck(k, p);
      break;
    case "hipabd":
      update = hipMachine(k, p, false);
      break;
    case "hipadd":
      update = hipMachine(k, p, true);
      break;
    case "seatedcalf":
      update = seatedCalf(k);
      break;
    case "lyingcurl":
      update = lyingCurl(k);
      break;
    case "backext":
      update = backExt(k);
      break;
    case "preacher":
      update = preacher(k);
      break;
    case "cablefly":
    case "lowfly":
      update = crossover(k, p, false);
      break;
    case "cablelateral":
      update = crossover(k, p, true);
      break;
    case "facepull":
    case "cablecurl":
    case "straightarm":
      update = cableTower(k, p);
      break;
    case "pullup":
    case "dip":
    case "kneeraise":
      update = tower(k);
      break;
    case "smithsquat":
    case "smithohp":
    case "smithrdl":
    case "smithrow":
    case "smithsplit":
      update = smith(k, false);
      break;
    case "smithbench":
      update = smith(k, true);
      break;
    default:
      dumbbellRack(k);
  }
  return { group: k.group, update };
}
