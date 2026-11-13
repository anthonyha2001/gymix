import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MUSCLE_INDEX, headGeometry, limbGeometry, limbSpecs, torsoGeometry, type TorsoRest } from "./body3d";
import { buildMachine, machineMaterials, type Machine } from "./machines3d";
import { MUSCLES, type Muscle, type Pattern, type Tool } from "./patterns";
import type { Skeleton, V3 } from "./skeleton";

// The studio in 3D: a satin porcelain athlete on a graphite stage, lit like a
// product shot (key, cool rim, a low lime kicker and soft reflections), with
// soft contact shadows, real equipment and the working muscles glowing lime.

const LIME = new THREE.Color("#c8f135");
const v = (p: V3) => new THREE.Vector3(p.x, p.y, p.z);

type Part = { mesh: THREE.Mesh };

function bodyMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#c9ced6"),
    roughness: 0.46,
    metalness: 0,
    clearcoat: 0.38,
    clearcoatRoughness: 0.32,
    sheen: 0.25,
    sheenColor: new THREE.Color("#ffffff"),
    sheenRoughness: 0.6,
  });
  const uniforms = {
    uLevels: { value: new Array(MUSCLES.length).fill(0) as number[] },
    uLime: { value: LIME.clone() },
    uPulse: { value: 0 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nattribute float mId;\nattribute float mW;\nuniform float uLevels[${MUSCLES.length}];\nvarying float vGlow;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvGlow = mW * uLevels[int(mId + 0.5)];`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGlow;\nuniform vec3 uLime;\nuniform float uPulse;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float g = clamp(vGlow, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, uLime * 0.92, g * 0.9);
        totalEmissiveRadiance += uLime * g * (0.5 + 0.18 * uPulse);`,
      );
  };
  return { mat, uniforms };
}

function radialTexture(inner: string, outer: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export type Look = { primary: Muscle[]; secondary: Muscle[]; tool: Tool; pattern: Pattern; rest: Skeleton };

export class MotionScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(26, 1, 0.05, 60);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private mat: ReturnType<typeof bodyMaterial>;
  private parts: Record<string, Part> = {};
  private torso: TorsoRest;
  private torsoMesh: THREE.Mesh;
  private props = new THREE.Group();
  private machine = new THREE.Group();
  private rig: Machine | null = null;
  private rest: Skeleton | null = null;
  private mm = machineMaterials();
  private propKey = "";
  private machineKey = "";
  private mats: Record<string, THREE.Material>;
  private key: THREE.DirectionalLight;

  constructor(canvas: HTMLCanvasElement, opts: { preserve?: boolean } = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: opts.preserve ?? false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;

    const s = this.scene;
    s.background = new THREE.Color("#07090d");
    s.fog = new THREE.Fog("#07090d", 5.5, 11);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    s.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    s.environmentIntensity = 0.28;

    // ---- lights
    s.add(new THREE.HemisphereLight("#dfe8ff", "#0b0f15", 0.3));
    const key = new THREE.DirectionalLight("#fff6ec", 1.9);
    key.position.set(2.2, 4.2, 3.0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -2.2;
    key.shadow.camera.right = 2.2;
    key.shadow.camera.top = 2.8;
    key.shadow.camera.bottom = -1.2;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 9;
    key.shadow.blurSamples = 16;
    key.target.position.set(0, 0.8, 0);
    s.add(key, key.target);
    this.key = key;
    const rim = new THREE.DirectionalLight("#9fb6ff", 1.7);
    rim.position.set(-2.6, 3.2, -3.4);
    s.add(rim);
    const fill = new THREE.DirectionalLight("#ffffff", 0.3);
    fill.position.set(-3, 1.4, 2.5);
    s.add(fill);
    const kicker = new THREE.PointLight("#c8f135", 1.1, 3.2, 1.8);
    kicker.position.set(1.6, 0.35, -1.6);
    s.add(kicker);

    // ---- stage: a graphite floor with a soft pool of light and a faint grid
    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 96), new THREE.MeshStandardMaterial({ color: "#0e131a", roughness: 0.82, metalness: 0.15, envMapIntensity: 0.6 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.position.y = -0.04;
    s.add(floor);
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 64),
      new THREE.MeshBasicMaterial({ map: radialTexture("rgba(200,241,53,0.045)", "rgba(200,241,53,0)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.0015;
    s.add(pool);
    const grid = new THREE.GridHelper(8, 32, "#2a3240", "#1a212b");
    const gm = grid.material as THREE.Material;
    gm.transparent = true;
    gm.opacity = 0.35;
    gm.depthWrite = false;
    grid.position.y = -0.035;
    s.add(grid);

    // ---- materials for equipment
    this.mats = {
      chrome: new THREE.MeshStandardMaterial({ color: "#cfd5dc", metalness: 1, roughness: 0.26 }),
      rubber: new THREE.MeshStandardMaterial({ color: "#14181e", metalness: 0.05, roughness: 0.62 }),
      knurl: new THREE.MeshStandardMaterial({ color: "#b9c0c8", metalness: 1, roughness: 0.45 }),
      lime: new THREE.MeshStandardMaterial({ color: "#c8f135", emissive: "#c8f135", emissiveIntensity: 0.9, roughness: 0.4 }),
      pad: new THREE.MeshPhysicalMaterial({ color: "#1f2631", roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: new THREE.Color("#5a6577") }),
      frame: new THREE.MeshStandardMaterial({ color: "#2b333e", metalness: 0.65, roughness: 0.38 }),
      steel: new THREE.MeshStandardMaterial({ color: "#a3adb9", metalness: 1, roughness: 0.28 }),
      cable: new THREE.MeshStandardMaterial({ color: "#c9d0d8", metalness: 0.8, roughness: 0.35 }),
    };

    // ---- the athlete
    this.mat = bodyMaterial();
    const add = (name: string, geo: THREE.BufferGeometry) => {
      const mesh = new THREE.Mesh(geo, this.mat.mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      s.add(mesh);
      this.parts[name] = { mesh };
    };
    for (const [k, inner] of [
      ["L", Math.PI / 2],
      ["R", -Math.PI / 2],
    ] as const) {
      const spec = limbSpecs(inner);
      add(`thigh${k}`, limbGeometry(spec.thigh));
      add(`shin${k}`, limbGeometry(spec.shin));
      add(`foot${k}`, limbGeometry(spec.foot, 32, 20));
      add(`upper${k}`, limbGeometry(spec.upperArm));
      add(`fore${k}`, limbGeometry(spec.forearm));
      add(`hand${k}`, limbGeometry(spec.hand, 28, 14));
      add(`delt${k}`, limbGeometry(spec.delt, 36, 10));
    }
    add("neck", limbGeometry(limbSpecs(0).neck, 32, 8));
    add("head", headGeometry());
    this.torso = torsoGeometry();
    this.torsoMesh = new THREE.Mesh(this.torso.geo, this.mat.mat);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    s.add(this.torsoMesh);

    s.add(this.props, this.machine);

    // ---- post: a gentle bloom so the lime muscles glow
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(s, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.38, 0.5, 1.45);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  resize(w: number, h: number, dpr: number) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // The camera orbits `target`: yaw 0 looks at the athlete's front, 90 at their right side.
  view(yaw: number, pitch: number, zoom: number, target: V3, radius: number) {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const fit = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * this.camera.aspect));
    const dist = (radius / Math.sin(fit / 2)) * 1.02 / zoom;
    const y = THREE.MathUtils.degToRad(yaw);
    const p = THREE.MathUtils.degToRad(pitch + 4);
    const t = v(target);
    this.camera.position.set(t.x - Math.sin(y) * Math.cos(p) * dist, t.y + Math.sin(p) * dist, t.z + Math.cos(y) * Math.cos(p) * dist);
    this.camera.lookAt(t);
  }

  look(l: Look) {
    const levels = this.mat.uniforms.uLevels.value;
    levels.fill(0);
    for (const m of l.secondary) levels[MUSCLE_INDEX[m]] = 0.26;
    for (const m of l.primary) levels[MUSCLE_INDEX[m]] = 1;
    this.rest = l.rest;
    const mk = l.pattern.id;
    if (mk !== this.machineKey) {
      this.machineKey = mk;
      this.clear(this.machine);
      this.rig = buildMachine(l.pattern, this.mm);
      this.machine.add(this.rig.group);
    }
    const pk = `${l.pattern.id}:${l.tool}`;
    if (pk !== this.propKey) {
      this.propKey = pk;
      this.clear(this.props);
      if (l.tool !== "roller") this.buildTool(l.tool);
    }
  }

  private clear(g: THREE.Group) {
    for (const c of [...g.children]) {
      g.remove(c);
      c.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    }
  }

  // Tools are built along +x around the origin; frame() moves them to the hands.
  private buildTool(tool: Tool) {
    const cyl = (r: number, len: number, mat: THREE.Material, x = 0, seg = 32) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
      m.rotation.z = Math.PI / 2;
      m.position.x = x;
      m.castShadow = true;
      return m;
    };
    const bar = (name: string, half: number) => {
      const g = new THREE.Group();
      g.name = name;
      g.add(cyl(0.0135, half * 2, this.mats.knurl));
      return g;
    };
    if (tool === "barbell") {
      const g = new THREE.Group();
      g.name = "mid";
      g.add(cyl(0.0135, 1.3, this.mats.knurl));
      for (const s of [-1, 1]) {
        g.add(cyl(0.026, 0.44, this.mats.chrome, s * 0.86));
        g.add(cyl(0.032, 0.03, this.mats.chrome, s * 0.655));
        for (const [x, r] of [
          [0.71, 0.225],
          [0.765, 0.225],
        ]) {
          const plate = cyl(r, 0.045, this.mats.rubber, s * x, 64);
          plate.receiveShadow = true;
          g.add(plate);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.84, 0.0035, 8, 72), this.mats.lime);
          ring.rotation.y = Math.PI / 2;
          ring.position.x = s * (x + 0.0235);
          g.add(ring);
          const hub = cyl(0.04, 0.05, this.mats.chrome, s * x);
          g.add(hub);
        }
      }
      this.props.add(g);
    } else if (tool === "dumbbells") {
      for (const k of ["L", "R"]) {
        const g = new THREE.Group();
        g.name = `db${k}`;
        g.add(cyl(0.015, 0.15, this.mats.knurl));
        for (const s of [-1, 1]) {
          g.add(cyl(0.062, 0.075, this.mats.rubber, s * 0.115, 6));
          g.add(cyl(0.03, 0.006, this.mats.chrome, s * 0.155));
        }
        this.props.add(g);
      }
    } else if (tool === "latbar") {
      const g = bar("mid", 0.62);
      for (const s of [-1, 1]) g.add(cyl(0.02, 0.16, this.mats.rubber, s * 0.48));
      this.props.add(g);
    } else if (tool === "shortbar") {
      const g = bar("mid", 0.21);
      this.props.add(g);
    } else if (tool === "vhandle") {
      const g = bar("mid", 0.07);
      this.props.add(g);
    } else if (tool === "roller") {
      const g = new THREE.Group();
      g.name = "roller";
      g.add(cyl(0.052, 0.5, this.mats.pad));
      this.props.add(g);
      for (const s of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1, 12), this.mats.steel);
        arm.name = `lever${s}`;
        arm.castShadow = true;
        this.props.add(arm);
      }
    }
  }

  // Pose the athlete and the equipment for one moment.
  frame(sk: Skeleton, time: number) {
    const X = new THREE.Vector3();
    const Y = new THREE.Vector3();
    const Z = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const place = (name: string, start: THREE.Vector3, dir: THREE.Vector3, zRef: THREE.Vector3) => {
      Y.copy(dir).normalize();
      Z.copy(zRef).addScaledVector(Y, -zRef.dot(Y));
      if (Z.lengthSq() < 1e-8) Z.set(0, 0, 1).addScaledVector(Y, -Y.z);
      if (Z.lengthSq() < 1e-8) Z.set(0, 1, 0).addScaledVector(Y, -Y.y);
      Z.normalize();
      X.crossVectors(Y, Z);
      const m = this.parts[name].mesh.matrix;
      m.makeBasis(X, Y, Z).setPosition(start);
      this.parts[name].mesh.matrixWorldNeedsUpdate = true;
    };
    const perp = (a: THREE.Vector3, axis: THREE.Vector3) => a.clone().addScaledVector(axis, -a.dot(axis));
    const Fp = v(sk.Fp);
    const F = v(sk.F);
    const worldX = new THREE.Vector3(1, 0, 0);

    for (const k of ["L", "R"] as const) {
      const hip = v(sk.hip[k]);
      const knee = v(sk.knee[k]);
      const ankle = v(sk.ankle[k]);
      const thighDir = tmp.subVectors(knee, hip).normalize().clone();
      const shinDir = ankle.clone().sub(knee).normalize();
      // The thigh's front faces away from the way the shin folds back.
      const thighFront = perp(shinDir, thighDir).multiplyScalar(-1).add(Fp.clone().multiplyScalar(0.35));
      place(`thigh${k}`, hip, thighDir, thighFront);
      place(`shin${k}`, knee, shinDir, perp(thighFront, shinDir).lengthSq() > 1e-6 ? perp(thighFront, shinDir) : Fp);
      const heel = v(sk.heel[k]);
      const toe = v(sk.toe[k]);
      const fdir = toe.clone().sub(heel).normalize();
      const fup = new THREE.Vector3(0, fdir.z, -fdir.y);
      place(`foot${k}`, heel.clone().addScaledVector(fup, 0.03).addScaledVector(fdir, 0.012), fdir, fup);

      const sh = v(sk.shoulder[k]);
      const el = v(sk.elbow[k]);
      const wr = v(sk.wrist[k]);
      const gr = v(sk.grip[k]);
      const upDir = el.clone().sub(sh).normalize();
      const foDir = wr.clone().sub(el).normalize();
      const armFront = perp(foDir, upDir).add(F.clone().multiplyScalar(0.35));
      place(`upper${k}`, sh, upDir, armFront);
      place(`delt${k}`, sh.clone().addScaledVector(upDir, -0.03).add(v(sk.U).multiplyScalar(0.012)), upDir, armFront);
      place(`fore${k}`, el, foDir, perp(armFront, foDir));
      const hDir = gr.clone().sub(wr).normalize();
      const palm = new THREE.Vector3().crossVectors(worldX, hDir);
      place(`hand${k}`, wr.clone().addScaledVector(hDir, -0.012), hDir, palm.lengthSq() > 0.05 ? palm : F);
    }
    const chest = v(sk.chest);
    place("neck", chest.clone().addScaledVector(v(sk.U), -0.03), v(sk.neck).sub(chest), F);
    {
      const m = this.parts.head.mesh.matrix;
      const Uh = v(sk.Uh);
      const Fh = v(sk.Fh);
      m.makeBasis(new THREE.Vector3().crossVectors(Uh, Fh), Uh, Fh).setPosition(v(sk.head));
      this.parts.head.mesh.matrixWorldNeedsUpdate = true;
    }

    // Torso: blend each vertex between the pelvis frame and the chest frame.
    {
      const r = this.torso.rest;
      const pos = this.torso.geo.attributes.position as THREE.BufferAttribute;
      const P = sk.pelvis;
      const M = sk.mid;
      const Up = sk.Up;
      const U = sk.U;
      const Fu = sk.F;
      for (let i = 0; i < r.length / 3; i++) {
        const x = r[i * 3];
        const h = r[i * 3 + 1];
        const z = r[i * 3 + 2];
        const lo = { x: P.x + x, y: P.y + Up.y * h + sk.Fp.y * z, z: P.z + Up.z * h + sk.Fp.z * z };
        const hu = h - 0.24;
        const up = { x: M.x + x, y: M.y + U.y * hu + Fu.y * z, z: M.z + U.z * hu + Fu.z * z };
        const t = Math.min(1, Math.max(0, (h - 0.1) / 0.26));
        const w = t * t * (3 - 2 * t);
        pos.setXYZ(i, lo.x + (up.x - lo.x) * w, lo.y + (up.y - lo.y) * w, lo.z + (up.z - lo.z) * w);
      }
      pos.needsUpdate = true;
      this.torso.geo.computeVertexNormals();
      this.torso.geo.computeBoundingSphere();
    }

    // ---- equipment follows the hands
    const gL = v(sk.grip.L);
    const gR = v(sk.grip.R);
    const mid = gL.clone().add(gR).multiplyScalar(0.5);
    for (const c of this.props.children) {
      if (c.name === "mid") c.position.copy(mid);
      else if (c.name === "dbL") c.position.copy(gL);
      else if (c.name === "dbR") c.position.copy(gR);
      else if (c.name === "roller") {
        const am = v(sk.ankle.L).add(v(sk.ankle.R)).multiplyScalar(0.5);
        const km = v(sk.knee.L).add(v(sk.knee.R)).multiplyScalar(0.5);
        const d = am.clone().sub(km).normalize();
        const front = new THREE.Vector3(0, d.z, -d.y);
        c.position.copy(am).addScaledVector(front, 0.085).addScaledVector(d, -0.03);
      } else if (c.name.startsWith("lever")) {
        const s = c.name === "lever1" ? 1 : -1;
        const roller = this.props.getObjectByName("roller")!;
        const km = v(sk.knee.L).add(v(sk.knee.R)).multiplyScalar(0.5);
        const a = new THREE.Vector3(s * 0.27, km.y, km.z);
        const b = new THREE.Vector3(s * 0.27, roller.position.y, roller.position.z);
        this.stretch(c as THREE.Mesh, a, b);
      }
    }

    if (this.rig && this.rest) this.rig.update(sk, this.rest);
    this.mat.uniforms.uPulse.value = Math.sin(time * 2.4) * 0.5 + 0.5;
  }

  private stretch(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
    const d = b.clone().sub(a);
    const len = d.length() || 0.0001;
    mesh.position.copy(a).addScaledVector(d, 0.5);
    mesh.scale.set(1, len, 1);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  }

  render() {
    this.composer.render();
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.mat.mat.dispose();
    for (const m of Object.values(this.mats)) m.dispose();
    for (const m of Object.values(this.mm)) m.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }

  get keyLight() {
    return this.key;
  }
}
