"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export type Room3D = "salon" | "kitchen" | "bath" | "beds";
export type View3D = "all" | Room3D | `obj:${string}` | `person:${string}`;
export type Pick3D = { room?: Room3D; cat?: string; person?: string };
export type Person3D = { id: string; name: string; color: string; talking: boolean; warn: boolean; kind?: "adult" | "child" };

type Props = {
  view: View3D;
  people: Person3D[];
  /** Bill categories that need attention (orange label on the object). */
  warnCats: string[];
  /** Screen-space vertical centre (CSS px from the top of the canvas) where the focus should sit. */
  focusY: number;
  onPick: (p: Pick3D) => void;
  onReady?: () => void;
};

// ---------- Layout (world units ≈ metres; x → screen right, z → screen left) ----------
const ROOMS: { id: string; pick: Room3D; x: [number, number]; z: [number, number]; floor: string; label: string }[] = [
  { id: "bath", pick: "bath", x: [0, 4], z: [0, 3], floor: "#CFE5EC", label: "חשבון מים" },
  { id: "kids", pick: "beds", x: [0, 4], z: [3, 6], floor: "#F7DCCF", label: "סלולר · ילדים" },
  { id: "kitchen", pick: "kitchen", x: [0, 4], z: [6, 10], floor: "#EFE8D6", label: "חשמל וגז" },
  { id: "parents", pick: "beds", x: [4, 10], z: [0, 4], floor: "#E6D8BF", label: "סלולר · הורים" },
  { id: "salon", pick: "salon", x: [4, 10], z: [4, 10], floor: "#EADFC8", label: "טלוויזיה, אינטרנט וטלפון" },
];
// Walkable waypoints per room, chosen in open floor; edges are straight paths that avoid furniture.
const NAV: Record<string, { p: [number, number][]; e: [number, number][] }> = {
  salon: { p: [[5.3, 5.6], [8.9, 5.8], [8.9, 8.1], [5.2, 8.1], [7.2, 5.7]], e: [[0, 4], [4, 1], [1, 2], [2, 3], [3, 0]] },
  parents: { p: [[8.0, 1.2], [8.2, 3.3], [5.6, 3.2], [9.3, 2.8], [6.9, 3.3]], e: [[0, 1], [1, 4], [4, 2], [1, 3], [3, 0]] },
  kids: { p: [[1.8, 3.6], [2.4, 4.6], [3.4, 4.6], [1.7, 5.5]], e: [[0, 1], [1, 2], [1, 3], [3, 0]] },
  kitchen: { p: [[1.5, 6.7], [2.3, 7.4], [3.5, 7.6], [1.35, 7.9]], e: [[0, 1], [1, 2], [1, 3], [3, 0]] },
  bath: { p: [[2.0, 1.6], [2.9, 1.6], [2.5, 2.4]], e: [[0, 1], [1, 2], [2, 0]] },
};
const ADULT_ROOMS = ["parents", "salon", "kitchen", "salon", "parents"];
const CHILD_ROOMS = ["kids", "kids", "salon", "kids"];
const CAMS: Record<View3D, { t: [number, number, number]; w: number }> = {
  all: { t: [5, 0.7, 5], w: 13.6 },
  salon: { t: [7, 0.6, 7], w: 7.2 },
  kitchen: { t: [1.9, 0.7, 8.0], w: 5.8 },
  bath: { t: [1.9, 0.5, 1.4], w: 5.2 },
  beds: { t: [4.6, 0.6, 3.0], w: 9.6 },
};
// Each bill lives on an object; labels and taps are per object.
export const OBJECTS: { cat: string; label: string; at: [number, number, number]; cam: { t: [number, number, number]; w: number } }[] = [
  { cat: "tv", label: "טלוויזיה", at: [7.2, 1.95, 4.4], cam: { t: [7.2, 0.8, 5.2], w: 4.6 } },
  { cat: "internet", label: "אינטרנט", at: [4.67, 1.15, 4.55], cam: { t: [4.8, 0.6, 5.0], w: 3.8 } },
  { cat: "landline", label: "טלפון קווי", at: [9.3, 1.05, 9.15], cam: { t: [9.0, 0.6, 8.7], w: 3.8 } },
  { cat: "gas", label: "גז", at: [0.6, 1.5, 7.45], cam: { t: [1.0, 0.8, 7.5], w: 3.6 } },
  { cat: "electricity", label: "חשמל", at: [3.3, 2.35, 6.6], cam: { t: [2.6, 1.0, 7.4], w: 4.8 } },
  { cat: "water", label: "מים", at: [1.15, 1.05, 0.7], cam: { t: [1.6, 0.4, 1.2], w: 3.8 } },
];

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function textSprite(text: string, opts: { size?: number; color?: string; bg?: string; pad?: number; radius?: number; bold?: boolean } = {}) {
  const { size = 42, color = "#5C5446", bg, pad = 14, radius = 22, bold = true } = opts;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const font = `${bold ? 700 : 500} ${size}px Rubik, system-ui, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = size + pad * 2;
  c.width = w;
  c.height = h;
  ctx.font = font;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, radius);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(w / 160, h / 160, 1);
  return s;
}


export default function Apartment3D({ view, people, warnCats, focusY, onPick, onReady }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{
    setView: (v: View3D, focusY: number) => void;
    setPeople: (p: Person3D[]) => void;
    setWarn: (w: string[]) => void;
    pickable: boolean;
  } | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    const el = host.current!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    const DIR = new THREE.Vector3(1, 0.92, 1).normalize();

    // ---------- Lights ----------
    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x3a3f4a, 1.15));
    const sun = new THREE.DirectionalLight(0xfff0dd, 2.2);
    sun.position.set(14, 18, 8);
    sun.target.position.set(5, 0, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 50 });
    sun.shadow.bias = -0.0005;
    sun.shadow.radius = 4;
    scene.add(sun, sun.target);

    // ---------- Helpers ----------
    const mats = new Map<string, THREE.MeshStandardMaterial>();
    const mat = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
      const key = color + JSON.stringify(opts);
      if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.02, ...opts }));
      return mats.get(key)!;
    };
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const box = (x: number, z: number, w: number, d: number, h: number, color: string, y = 0, opts?: Partial<THREE.MeshStandardMaterialParameters>) => {
      const m = new THREE.Mesh(boxGeo, mat(color, opts));
      m.scale.set(w, h, d);
      m.position.set(x + w / 2, y + h / 2, z + d / 2);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    const cyl = (x: number, z: number, r: number, h: number, color: string, y = 0, seg = 20, opts?: Partial<THREE.MeshStandardMaterialParameters>) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat(color, opts));
      m.position.set(x, y + h / 2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };

    // ---------- Shell ----------
    box(-0.2, -0.2, 10.4, 10.4, 0.35, "#9EA3AB", -0.35);
    const floors: THREE.Mesh[] = [];
    const labels: THREE.Sprite[] = [];
    for (const r of ROOMS) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(r.x[1] - r.x[0], r.z[1] - r.z[0]), mat(r.floor));
      f.rotation.x = -Math.PI / 2;
      f.position.set((r.x[0] + r.x[1]) / 2, 0.002, (r.z[0] + r.z[1]) / 2);
      f.receiveShadow = true;
      f.userData.pick = r.pick;
      scene.add(f);
      floors.push(f);

    }
    // bathroom tiles + kitchen checker
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2) box(i + 0.02, j + 0.02, 0.96, 0.96, 0.004, "#BCDBE4", 0.002);
    for (let i = 0; i < 4; i++) for (let j = 6; j < 10; j++) if ((i + j) % 2) box(i, j, 1, 1, 0.004, "#E2D8C0", 0.002);
    // back walls
    const WALL = 2.6;
    box(-0.18, -0.18, 10.18, 0.18, WALL, "#EFE9DE");
    box(-0.18, 0, 0.18, 10, WALL, "#E2DACB");
    const glass = mat("#A9D8F0", { emissive: "#BFE6FA", emissiveIntensity: 0.55, roughness: 0.2 });
    const win = (x: number, z: number, w: number, d: number) => {
      const frame = box(x - 0.06, z - 0.06, w + 0.12, d + 0.12, 1.3, "#FFFFFF", 0.9);
      frame.castShadow = false;
      const g = new THREE.Mesh(boxGeo, glass);
      g.scale.set(w || 0.02, 1.18, d || 0.02);
      g.position.set(x + (w || 0.02) / 2 + (w ? 0 : 0.03), 1.55, z + (d || 0.02) / 2 + (d ? 0.03 : 0));
      scene.add(g);
    };
    win(5.6, 0.0, 1.8, 0);
    win(1.2, 0.0, 1.4, 0);
    win(0.0, 3.8, 0, 1.4);
    win(0.0, 7.2, 0, 1.6);
    // low partitions (cutaway) with door gaps
    const PW = "#E7DFD1", PH = 0.95;
    box(0, 2.92, 1.4, 0.16, PH, PW); box(2.4, 2.92, 1.6, 0.16, PH, PW);
    box(0, 5.92, 1.6, 0.16, PH, PW); box(2.8, 5.92, 1.2, 0.16, PH, PW);
    box(3.92, 0, 0.16, 1.6, PH, PW); box(3.92, 2.6, 0.16, 1.8, PH, PW); box(3.92, 5.4, 0.16, 1.4, PH, PW); box(3.92, 8.0, 0.16, 2.0, PH, PW);
    box(4, 3.92, 2.0, 0.16, PH, PW); box(7.4, 3.92, 2.6, 0.16, PH, PW);

    // ---------- Bathroom: tub, sink, toilet, running water ----------
    const tub = box(0.2, 0.2, 1.9, 1.0, 0.55, "#FFFFFF", 0, { roughness: 0.35 });
    const water = box(0.32, 0.32, 1.66, 0.76, 0.02, "#6FC0E6", 0.5, { roughness: 0.1, emissive: "#3A9BD0", emissiveIntensity: 0.25 });
    box(0.25, 0.55, 0.12, 0.12, 0.35, "#C9CED6", 0.55, { metalness: 0.6, roughness: 0.3 });
    box(0.25, 0.57, 0.3, 0.08, 0.06, "#C9CED6", 0.86, { metalness: 0.6, roughness: 0.3 });
    box(3.0, 0.2, 0.8, 0.6, 0.85, "#FFFFFF", 0, { roughness: 0.4 });
    box(3.1, 0.26, 0.6, 0.45, 0.03, "#CFE5EC", 0.85);
    box(3.25, 0.2, 0.3, 0.05, 0.7, "#BFE6FA", 1.1, { emissive: "#BFE6FA", emissiveIntensity: 0.4, roughness: 0.1 });
    box(2.2, 0.25, 0.5, 0.6, 0.45, "#FFFFFF", 0, { roughness: 0.4 });
    box(2.2, 0.2, 0.5, 0.2, 0.75, "#FFFFFF", 0, { roughness: 0.4 });
    const dropGeo = new THREE.SphereGeometry(0.035, 8, 8);
    const drops = Array.from({ length: 6 }, (_, i) => {
      const m = new THREE.Mesh(dropGeo, mat("#7CC9F0", { emissive: "#7CC9F0", emissiveIntensity: 0.6 }));
      m.position.set(0.52, 0.85, 0.61);
      m.userData.t = i / 6;
      scene.add(m);
      return m;
    });

    // ---------- Kids room ----------
    box(0.2, 3.25, 1.05, 2.0, 0.32, "#F4B9B2");
    box(0.25, 3.3, 0.95, 1.9, 0.16, "#FFFFFF", 0.32);
    box(0.3, 3.35, 0.85, 0.45, 0.1, "#FFE7A8", 0.48);
    box(0.25, 4.0, 0.95, 1.2, 0.05, "#9FB4E8", 0.48);
    box(2.95, 3.2, 0.85, 0.6, 0.75, "#B7865A");
    box(3.05, 3.3, 0.3, 0.22, 0.2, "#4F9FA6", 0.75);
    cyl(2.2, 4.85, 0.55, 0.02, "#9FD3B6", 0, 32);
    box(2.0, 5.2, 0.5, 0.5, 0.35, "#7CC765");
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), mat("#FF6A2C"));
    ball.position.set(2.7, 0.14, 5.1);
    ball.castShadow = true;
    scene.add(ball);

    // ---------- Kitchen: counter, stove with gas flame, fridge, table, pendant ----------
    box(0.18, 6.2, 0.85, 3.2, 0.88, "#FFFFFF");
    box(0.15, 6.18, 0.9, 3.24, 0.05, "#B9B2A3", 0.88);
    const stove = box(0.28, 7.15, 0.62, 0.62, 0.02, "#2B2F36", 0.93);
    const flames: THREE.Mesh[] = [];
    for (const [fx, fz] of [[0.44, 7.3], [0.74, 7.3], [0.44, 7.6], [0.74, 7.6]] as [number, number][]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 10), mat("#3FA7FF", { emissive: "#3FA7FF", emissiveIntensity: 2.2, transparent: true, opacity: 0.9 }));
      f.position.set(fx, 1.0, fz);
      scene.add(f);
      flames.push(f);
    }
    cyl(0.6, 7.6, 0.16, 0.18, "#D0533A", 1.03, 18, { roughness: 0.4 });
    const fridge = box(2.85, 6.2, 0.95, 0.8, 1.95, "#E9ECEF", 0, { roughness: 0.35 });
    box(2.85, 6.98, 0.02, 0.02, 0.5, "#9AA0AB", 1.1);
    box(1.75, 8.25, 1.35, 1.0, 0.06, "#B7865A", 0.72);
    cyl(2.42, 8.75, 0.07, 0.72, "#8C6440");
    for (const [cx, cz] of [[1.55, 8.55], [3.25, 8.55], [2.25, 9.4]] as [number, number][]) box(cx - 0.2, cz - 0.2, 0.4, 0.4, 0.45, "#D9A877");
    const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), mat("#FFE7A0", { emissive: "#FFD27A", emissiveIntensity: 2 }));
    pendant.position.set(2.42, 1.85, 8.75);
    scene.add(pendant);
    box(2.41, 8.74, 0.02, 0.02, 0.8, "#3B3F46", 1.95);

    // ---------- Parents room ----------
    box(4.9, 0.3, 0.15, 2.2, 1.05, "#8C6440");
    box(5.05, 0.3, 2.2, 2.2, 0.3, "#FFFFFF");
    box(5.1, 0.35, 2.1, 2.1, 0.14, "#F4F1EA", 0.3);
    box(5.15, 0.4, 0.5, 0.9, 0.12, "#FFFFFF", 0.44);
    box(5.15, 1.4, 0.5, 0.9, 0.12, "#FFFFFF", 0.44);
    box(5.8, 0.35, 1.45, 2.1, 0.06, "#9FB4E8", 0.44);
    box(8.75, 0.15, 1.05, 1.75, 2.05, "#C9A57A");
    box(9.3, 0.15, 0.01, 1.75, 2.0, "#A98558", 0.02);
    box(7.4, 0.3, 0.5, 0.5, 0.5, "#B7865A");
    const lampP = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.2, 16, 1, true), mat("#FFF1CC", { emissive: "#FFE2A0", emissiveIntensity: 1.6, side: THREE.DoubleSide }));
    lampP.position.set(7.65, 0.78, 0.55);
    scene.add(lampP);

    // ---------- Living room: TV wall, sofa, router, landline, plant, floor lamp ----------
    box(5.6, 6.4, 3.0, 3.0, 0.01, "#D98B6B", 0.003);
    box(5.85, 6.65, 2.5, 2.5, 0.01, "#E9A889", 0.006);
    box(6.0, 4.15, 2.4, 0.5, 0.5, "#3B3F46");
    box(6.15, 4.25, 2.1, 0.1, 1.15, "#1E2125", 0.5);
    const screenMat = new THREE.MeshStandardMaterial({ color: "#5DB7E3", emissive: "#5DB7E3", emissiveIntensity: 1.4, roughness: 0.2 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 1.0), screenMat);
    screen.position.set(7.2, 1.075, 4.356);
    scene.add(screen);
    const tvLight = new THREE.PointLight(0x5db7e3, 1.6, 4, 1.6);
    tvLight.position.set(7.2, 1.1, 4.9);
    scene.add(tvLight);
    box(5.9, 8.75, 2.7, 0.95, 0.45, "#4F9FA6");
    box(5.9, 9.4, 2.7, 0.35, 0.95, "#3F8A90");
    box(5.75, 8.75, 0.2, 1.0, 0.65, "#3F8A90");
    box(8.6, 8.75, 0.2, 1.0, 0.65, "#3F8A90");
    for (let i = 0; i < 3; i++) box(6.05 + i * 0.85, 9.05, 0.7, 0.3, 0.35, "#64B5BC", 0.45);
    box(6.6, 6.8, 1.25, 0.85, 0.08, "#B7865A", 0.35);
    cyl(7.22, 7.22, 0.06, 0.35, "#8C6440");
    cyl(7.0, 7.1, 0.07, 0.12, "#FFFFFF", 0.43);
    box(4.3, 4.3, 0.75, 0.5, 0.6, "#FFFFFF");
    const router = box(4.45, 4.38, 0.45, 0.32, 0.1, "#2B2F36", 0.6);
    const leds = [0, 1, 2].map((i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshStandardMaterial({ color: "#2FBF5B", emissive: "#2FBF5B", emissiveIntensity: 3 }));
      m.position.set(4.55 + i * 0.1, 0.66, 4.71);
      scene.add(m);
      return m;
    });
    box(4.62, 4.4, 0.02, 0.02, 0.3, "#2B2F36", 0.7);
    box(9.0, 8.9, 0.6, 0.55, 0.55, "#B7865A");
    const phone = box(9.1, 9.0, 0.38, 0.3, 0.12, "#E0664A", 0.55, { roughness: 0.4 });
    cyl(9.55, 4.6, 0.2, 0.35, "#C9A57A");
    const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), mat("#5FA84E", { flatShading: true }));
    plant.position.set(9.55, 0.72, 4.6);
    plant.castShadow = true;
    scene.add(plant);
    cyl(4.55, 9.45, 0.03, 1.5, "#3B3F46");
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.28, 18, 1, true), mat("#FFF1CC", { emissive: "#FFE2A0", emissiveIntensity: 1.5, side: THREE.DoubleSide }));
    shade.position.set(4.55, 1.55, 9.45);
    scene.add(shade);

    // Warm room lights ("electricity")
    const roomLights = [
      [2.4, 1.7, 8.7], [7.65, 1.1, 0.6], [4.6, 1.5, 9.3], [2, 2, 1.5], [2, 2, 4.6],
    ].map(([x, y, z]) => {
      const l = new THREE.PointLight(0xffd59a, 1.4, 4.5, 1.8);
      l.position.set(x, y, z);
      scene.add(l);
      return l;
    });

    // ---------- People: simple low-poly figures with a walk cycle ----------
    type Limb = THREE.Group;
    type P = {
      group: THREE.Group; hips: THREE.Group; legL: Limb; legR: Limb; armL: Limb; armR: Limb; head: THREE.Group;
      ring: THREE.Mesh; bubble: THREE.Sprite; phone: THREE.Mesh; torsoMat: THREE.MeshStandardMaterial;
      nav: { p: [number, number][]; e: [number, number][] }; at: number; next: number; wait: number;
      heading: number; stride: number; talking: boolean; warn: boolean; phase: number; scale: number; kind: "adult" | "child"; name: string; id: string;
    };
    const persons = new Map<string, P>();
    // eslint-disable-next-line prefer-const
    let syncPersonLabels: (() => void) | undefined;
    const skin = mat("#F2C9A0");
    const pants = [mat("#3B4252"), mat("#2F4F86"), mat("#5C4B3B"), mat("#4A5A3C")];
    const shoes = mat("#1E2433");
    const ringMat = new THREE.MeshBasicMaterial({ color: "#FF6A2C", transparent: true, opacity: 0.9, depthWrite: false });
    // Blocky, voxel-style figures.
    const cube = (w: number, h: number, d: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(boxGeo, m);
      mesh.scale.set(w, h, d);
      mesh.castShadow = true;
      return mesh;
    };
    /** A limb that pivots at its top (shoulder / hip). */
    const limb = (w: number, len: number, m: THREE.Material, end?: THREE.Material, endH = 0.06) => {
      const g = new THREE.Group();
      const c = cube(w, len, w, m);
      c.position.y = -len / 2;
      g.add(c);
      if (end) {
        const f = cube(w * 1.05, endH, end === shoes ? w * 1.6 : w * 1.05, end);
        f.position.set(0, -len - endH / 2 + 0.005, end === shoes ? w * 0.3 : 0);
        g.add(f);
      }
      return g;
    };
    const neighbours = (nav: P["nav"], i: number) => nav.e.filter(([a, b]) => a === i || b === i).map(([a, b]) => (a === i ? b : a));
    const makePerson = (p: Person3D, i: number, slot: number): P => {
      const child = p.kind === "child";
      const roomId = child ? CHILD_ROOMS[slot % CHILD_ROOMS.length] : ADULT_ROOMS[slot % ADULT_ROOMS.length];
      const nav = NAV[roomId];
      const scale = child ? 0.7 : 1;
      const group = new THREE.Group();
      const hips = new THREE.Group();
      hips.position.y = 0.5;
      const torsoMat = mat(p.color).clone();
      const torso = cube(0.34, 0.42, 0.2, torsoMat);
      torso.position.y = 0.21;
      const belt = cube(0.345, 0.06, 0.205, pants[i % pants.length]);
      belt.position.y = 0.015;
      const legL = limb(0.15, 0.44, pants[i % pants.length], shoes);
      const legR = limb(0.15, 0.44, pants[i % pants.length], shoes);
      legL.position.set(-0.085, 0, 0);
      legR.position.set(0.085, 0, 0);
      const armL = limb(0.1, 0.36, torsoMat, skin, 0.08);
      const armR = limb(0.1, 0.36, torsoMat, skin, 0.08);
      armL.position.set(-0.225, 0.41, 0);
      armR.position.set(0.225, 0.41, 0);
      const ph = new THREE.Mesh(boxGeo, mat("#1E2433"));
      ph.scale.set(0.05, 0.13, 0.08);
      ph.position.set(0, -0.44, 0.05);
      armR.add(ph);
      const head = new THREE.Group();
      head.position.y = 0.6;
      const skull = cube(0.28, 0.28, 0.28, skin);
      skull.position.y = 0.0;
      const hairMat = mat(i % 3 === 0 ? "#3B2A20" : i % 3 === 1 ? "#1E2433" : "#8C5A35");
      const hair = cube(0.3, 0.09, 0.3, hairMat);
      hair.position.y = 0.13;
      const hairBack = cube(0.3, 0.16, 0.07, hairMat);
      hairBack.position.set(0, 0.04, -0.12);
      const eyeMat = mat("#1E2433");
      const eyeL = cube(0.04, 0.05, 0.01, eyeMat);
      const eyeR = cube(0.04, 0.05, 0.01, eyeMat);
      eyeL.position.set(-0.06, 0.01, 0.141);
      eyeR.position.set(0.06, 0.01, 0.141);
      eyeL.castShadow = eyeR.castShadow = false;
      head.add(skull, hair, hairBack, eyeL, eyeR);
      hips.add(torso, belt, legL, legR, armL, armR, head);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.34, 32), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.015;
      const bubble = textSprite("•••", { size: 40, color: "#1E2433", bg: "#FFFFFF", pad: 12, radius: 26 });
      bubble.position.set(0.28, 1.45, 0);
      bubble.scale.multiplyScalar(0.65);
      group.add(hips, ring, bubble);
      group.scale.setScalar(scale);
      const start = i % nav.p.length;
      group.position.set(nav.p[start][0], 0, nav.p[start][1]);
      scene.add(group);
      return { group, hips, legL, legR, armL, armR, head, ring, bubble, phone: ph, torsoMat, nav, at: start, next: start, wait: 0.5 + Math.random() * 2, heading: Math.random() * Math.PI * 2, stride: 0, talking: p.talking, warn: p.warn, phase: Math.random() * 10, scale, kind: child ? "child" : "adult", name: p.name, id: p.id };
    };
    const setPeople = (list: Person3D[]) => {
      const keep = new Set(list.map((p) => p.id));
      for (const [id, p] of persons) if (!keep.has(id)) { scene.remove(p.group); persons.delete(id); }
      let adults = 0, kids = 0;
      list.slice(0, 8).forEach((p, i) => {
        const slot = p.kind === "child" ? kids++ : adults++;
        let pp = persons.get(p.id);
        if (pp && pp.kind !== (p.kind ?? "adult")) { scene.remove(pp.group); persons.delete(p.id); pp = undefined; }
        if (!pp) { pp = makePerson(p, i, slot); persons.set(p.id, pp); }
        pp.talking = p.talking;
        pp.warn = p.warn;
        pp.phone.visible = p.talking;
        pp.bubble.visible = p.talking;
        pp.ring.visible = p.warn;
        pp.torsoMat.color.set(p.color);
        pp.name = p.name;
        pp.group.traverse((o) => { o.userData.person = p.id; if ((o as THREE.Mesh).isMesh && !pickables.includes(o)) pickables.push(o); });
      });
      syncPersonLabels?.();
    };
    const angleLerp = (a: number, b: number, k: number) => {
      let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      return a + d * k;
    };
    const updatePerson = (p: P, dt: number, t: number) => {
      const pos = p.group.position;
      const [tx, tz] = p.nav.p[p.next];
      const dx = tx - pos.x, dz = tz - pos.z;
      const dist = Math.hypot(dx, dz);
      const walking = p.next !== p.at && dist > 0.02;
      const speed = 0.7 * p.scale;
      if (walking) {
        const step = Math.min(dist, speed * dt);
        pos.x += (dx / dist) * step;
        pos.z += (dz / dist) * step;
        p.heading = angleLerp(p.heading, Math.atan2(dx, dz), Math.min(1, dt * 8));
        p.stride += step / (0.26 * p.scale);
      } else {
        if (p.next !== p.at) { p.at = p.next; p.wait = (p.talking ? 3.5 : 1.5) + Math.random() * 3; }
        p.wait -= dt;
        if (p.wait <= 0) {
          const opts = neighbours(p.nav, p.at);
          p.next = opts[Math.floor(Math.random() * opts.length)] ?? p.at;
        }
      }
      p.group.rotation.y = p.heading;
      // walk cycle blends to idle
      const amp = walking ? 1 : 0;
      const k = THREE.MathUtils.damp(p.legL.userData.amp ?? 0, amp, 10, dt);
      p.legL.userData.amp = k;
      const s = Math.sin(p.stride * Math.PI);
      p.legL.rotation.x = s * 0.55 * k;
      p.legR.rotation.x = -s * 0.55 * k;
      p.armL.rotation.x = -s * 0.45 * k;
      p.hips.position.y = 0.5 + Math.abs(Math.cos(p.stride * Math.PI)) * 0.02 * k;
      p.hips.rotation.y = s * 0.08 * k;
      if (p.talking) {
        // phone held to the ear
        p.armR.rotation.set(-2.5, 0, -0.42);
        p.head.rotation.z = 0.12;
        p.bubble.material.opacity = 0.75 + Math.sin(t * 4 + p.phase) * 0.25;
      } else {
        p.armR.rotation.set(s * 0.45 * k, 0, 0);
        p.head.rotation.z = 0;
      }
      p.head.rotation.y = walking ? 0 : Math.sin(t * 0.6 + p.phase) * 0.35;
      // breathing when idle
      p.hips.scale.y = 1 + (1 - k) * Math.sin(t * 2 + p.phase) * 0.012;
      if (p.ring.visible) {
        const r = (t * 0.8 + p.phase) % 1;
        p.ring.scale.setScalar(0.8 + r * 0.9);
        ringMat.opacity = 0.9 * (1 - r);
      }
    };

    // ---------- Object labels (one per bill) ----------
    const pickables: THREE.Object3D[] = [];
    const tag = (o: THREE.Object3D, cat: string) => { o.userData.cat = cat; pickables.push(o); };
    tag(screen, "tv"); tag(router, "internet"); tag(phone, "landline"); tag(stove, "gas"); tag(fridge, "electricity"); tag(tub, "water");
    flames.forEach((f) => tag(f, "gas"));
    type ObjLabel = { normal: THREE.Sprite; warn: THREE.Sprite; cat?: string; person?: P; y?: number };
    const objLabels: ObjLabel[] = [];
    const makeLabel = (text: string, at: THREE.Vector3, cat?: string): ObjLabel => {
      const normal = textSprite(text, { size: 40, color: "#FFFFFF", bg: "rgba(17,18,20,0.85)", pad: 14, radius: 28 });
      const warn = textSprite("! " + text, { size: 40, color: "#FFFFFF", bg: "#FF6A2C", pad: 14, radius: 28 });
      for (const s of [normal, warn]) {
        (s.material as THREE.SpriteMaterial).depthTest = false;
        s.renderOrder = 20;
        s.center.set(0.5, 0);
        s.position.copy(at);
        s.userData.base = s.scale.clone();
        if (cat) s.userData.cat = cat;
        labels.push(s);
        pickables.push(s);
        scene.add(s);
      }
      warn.visible = false;
      return { normal, warn, cat };
    };
    for (const o of OBJECTS) objLabels.push(makeLabel(o.label, new THREE.Vector3(...o.at), o.cat));
    let warnSet = new Set<string>();
    const setWarn = (cats: string[]) => {
      warnSet = new Set(cats);
      for (const l of objLabels) {
        const w = l.cat ? warnSet.has(l.cat) : !!l.person?.warn;
        l.warn.visible = w;
        l.normal.visible = !w;
      }
    };
    // Cellular labels follow the residents who have a line.
    const personLabels = new Map<string, ObjLabel>();
    syncPersonLabels = () => {
      for (const [id, p] of persons) {
        let l = personLabels.get(id);
        if (p.talking && !l) {
          l = makeLabel("סלולר · " + p.name, p.group.position.clone());
          l.person = p;
          l.normal.userData.person = id;
          l.warn.userData.person = id;
          personLabels.set(id, l);
          objLabels.push(l);
        }
        if (l) {
          const show = p.talking;
          l.normal.visible = show && !p.warn;
          l.warn.visible = show && p.warn;
        }
      }
      for (const [id, l] of personLabels) {
        if (!persons.has(id)) {
          for (const s of [l.normal, l.warn]) { scene.remove(s); labels.splice(labels.indexOf(s), 1); pickables.splice(pickables.indexOf(s), 1); }
          personLabels.delete(id);
          objLabels.splice(objLabels.indexOf(l), 1);
        }
      }
    };

    // ---------- Camera ----------
    let size = { w: 1, h: 1 };
    const cam = { t: new THREE.Vector3(...CAMS.all.t), w: CAMS.all.w, fy: 0.5 };
    const from = { t: cam.t.clone(), w: cam.w, fy: cam.fy };
    const to = { t: cam.t.clone(), w: cam.w, fy: cam.fy };
    let tween = 1;
    // User zoom/pan on top of the preset camera (mouse wheel, pinch, drag).
    const user = { zoom: 1, panX: 0, panY: 0 };
    const userTo = { zoom: 1, panX: 0, panY: 0 };
    const ZMIN = 0.35, ZMAX = 1.5;
    const applyCamera = () => {
      const aspect = size.w / size.h;
      const halfW = (cam.w * user.zoom) / 2, halfH = halfW / aspect;
      camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
      camera.position.copy(cam.t).addScaledVector(DIR, 40);
      camera.lookAt(cam.t);
      // shift so the focus point lands at fy (fraction of height from the top)
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const shift = (cam.fy - 0.5) * 2 * halfH;
      camera.position.addScaledVector(up, shift);
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      camera.position.addScaledVector(right, user.panX).addScaledVector(up, user.panY);
      camera.updateProjectionMatrix();
    };
    const setView = (v: View3D, focusPx: number) => {
      from.t.copy(cam.t); from.w = cam.w; from.fy = cam.fy;
      if (v.startsWith("obj:")) {
        const o = OBJECTS.find((x) => x.cat === v.slice(4));
        to.t.set(...(o?.cam.t ?? CAMS.all.t)); to.w = o?.cam.w ?? CAMS.all.w;
      } else if (v.startsWith("person:")) {
        const p = persons.get(v.slice(7));
        if (p) { to.t.set(p.group.position.x, 0.7, p.group.position.z); to.w = 4.2; } else { to.t.set(...CAMS.beds.t); to.w = CAMS.beds.w; }
      } else {
        const c = CAMS[v as keyof typeof CAMS];
        to.t.set(...c.t); to.w = c.w;
      } to.fy = Math.min(0.8, Math.max(0.2, focusPx / size.h));
      tween = reduce ? 1 : 0;
      userTo.zoom = 1; userTo.panX = 0; userTo.panY = 0;
      if (reduce) { cam.t.copy(to.t); cam.w = to.w; cam.fy = to.fy; }
    };

    const resize = () => {
      const r = el.getBoundingClientRect();
      const cssW = el.clientWidth || r.width, cssH = el.clientHeight || r.height;
      size = { w: Math.max(1, cssW), h: Math.max(1, cssH) };
      renderer.setSize(size.w, size.h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      applyCamera();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // ---------- Picking ----------
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = (e: { clientX: number; clientY: number }) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const obj = ray.intersectObjects(pickables, false)[0]?.object;
      if (obj?.userData.person) return { person: obj.userData.person as string };
      if (obj?.userData.cat) return { cat: obj.userData.cat as string };
      const room = ray.intersectObjects(floors, false)[0]?.object.userData.pick as Room3D | undefined;
      return room ? { room } : undefined;
    };
    // Gestures: tap = pick a room (full view), drag = pan, wheel / two-finger pinch = zoom.
    const pts = new Map<number, { x: number; y: number }>();
    let down: { x: number; y: number; moved: boolean } | null = null;
    let pinch: { d: number; zoom: number; mx: number; my: number; panX: number; panY: number } | null = null;
    const worldPerPx = () => (cam.w * userTo.zoom) / size.w;
    const clampPan = () => {
      const lim = cam.w * 0.55;
      userTo.panX = THREE.MathUtils.clamp(userTo.panX, -lim, lim);
      userTo.panY = THREE.MathUtils.clamp(userTo.panY, -lim, lim);
    };
    const zoomAt = (factor: number, cx: number, cy: number) => {
      const r = renderer.domElement.getBoundingClientRect();
      const nx = (cx - r.left) / r.width - 0.5, ny = (cy - r.top) / r.height - 0.5;
      const before = userTo.zoom;
      const after = THREE.MathUtils.clamp(before * factor, ZMIN, ZMAX);
      const viewW = cam.w, viewH = cam.w * (size.h / size.w);
      // keep the point under the cursor fixed
      userTo.panX += nx * viewW * (before - after);
      userTo.panY -= ny * viewH * (before - after);
      userTo.zoom = after;
      clampPan();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(Math.exp(delta * 0.0016), e.clientX, e.clientY);
    };
    const onDown = (e: PointerEvent) => {
      renderer.domElement.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) down = { x: e.clientX, y: e.clientY, moved: false };
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: userTo.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, panX: userTo.panX, panY: userTo.panY };
        if (down) down.moved = true;
      }
    };
    const onMove = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId);
      if (!prev) {
        renderer.domElement.style.cursor = hit(e) && (api.current?.pickable || !hit(e)?.room) ? "pointer" : "grab";
        return;
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        userTo.zoom = pinch.zoom;
        userTo.panX = pinch.panX - (mx - pinch.mx) * worldPerPx();
        userTo.panY = pinch.panY + (my - pinch.my) * worldPerPx();
        zoomAt(pinch.d / Math.max(20, d), mx, my);
        return;
      }
      if (down) {
        if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
        if (down.moved) {
          const wpp = worldPerPx();
          userTo.panX -= (e.clientX - prev.x) * wpp;
          userTo.panY += (e.clientY - prev.y) * wpp;
          clampPan();
          renderer.domElement.style.cursor = "grabbing";
        }
      }
    };
    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0 && down) {
        if (!down.moved) {
          const target = hit(e);
          if (target && (target.room ? api.current?.pickable : true)) onPickRef.current(target);
        }
        down = null;
        renderer.domElement.style.cursor = "grab";
      }
    };
    const onDbl = () => { userTo.zoom = 1; userTo.panX = 0; userTo.panY = 0; };
    const cv = renderer.domElement;
    cv.style.touchAction = "none";
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointercancel", onUp);
    cv.addEventListener("dblclick", onDbl);

    // ---------- Loop ----------
    const timer = new THREE.Timer();
    let raf = 0;
    let tvNext = 0;
    const TV_COLORS = ["#5DB7E3", "#8FD0F0", "#F5C542", "#7CC765", "#E58AD0", "#4A9FD0"];
    let first = true;
    const tick = (now?: number) => {
      timer.update(now);
      const dt = Math.min(timer.getDelta(), 0.05);
      const t = timer.getElapsed();

      if (tween < 1) {
        tween = Math.min(1, tween + dt / 0.65);
        const k = ease(tween);
        cam.t.lerpVectors(from.t, to.t, k);
        cam.w = from.w + (to.w - from.w) * k;
        cam.fy = from.fy + (to.fy - from.fy) * k;
      }
      const kz = reduce ? 1 : 1 - Math.exp(-dt * 14);
      user.zoom += (userTo.zoom - user.zoom) * kz;
      user.panX += (userTo.panX - user.panX) * kz;
      user.panY += (userTo.panY - user.panY) * kz;
      applyCamera();
      const labelScale = (cam.w * user.zoom) / 13.6;
      for (const l of labels) l.scale.copy(l.userData.base as THREE.Vector3).multiplyScalar(1.45 * labelScale); // constant on-screen size
      for (const l of personLabels.values()) {
        const p = l.person!;
        for (const s of [l.normal, l.warn]) s.position.set(p.group.position.x, 1.55 * p.scale + 0.05, p.group.position.z);
      }

      if (!reduce) {
        for (const p of persons.values()) updatePerson(p, dt, t);
        for (const d of drops) {
          d.userData.t = (d.userData.t + dt * 1.3) % 1;
          const k = d.userData.t;
          d.position.y = 0.84 - k * 0.32;
          d.scale.setScalar(1 - k * 0.4);
        }
        (water.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25 + Math.sin(t * 3) * 0.08;
        flames.forEach((f, i) => {
          f.scale.set(1, 0.8 + Math.abs(Math.sin(t * 17 + i * 1.7)) * 0.5, 1);
        });
        leds.forEach((l, i) => ((l.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(t * (6 + i * 3)) > 0 ? 3 : 0.2));
        if (t > tvNext) {
          const c = TV_COLORS[Math.floor(Math.random() * TV_COLORS.length)];
          screenMat.color.set(c);
          screenMat.emissive.set(c);
          tvLight.color.set(c);
          tvNext = t + 0.6 + Math.random() * 1.4;
        }
        roomLights.forEach((l, i) => (l.intensity = 1.3 + Math.sin(t * 1.3 + i) * 0.12));
        const ringPhase = t % 9;
        phone.rotation.z = ringPhase < 1.2 ? Math.sin(t * 60) * 0.08 : 0;
        plant.rotation.y = Math.sin(t * 0.7) * 0.06;
        for (const l of objLabels) {
          if (l.warn.visible) {
            const k = 1 + Math.sin(t * 5) * 0.06;
            l.warn.scale.multiplyScalar(k);
          }
        }
        ball.position.x = 2.7 + Math.sin(t * 0.9) * 0.25;
        ball.rotation.z = -Math.sin(t * 0.9) * 2;
      }

      renderer.render(scene, camera);
      if (first) { first = false; onReady?.(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    api.current = { setView, setPeople, setWarn, pickable: true };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener("wheel", onWheel);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointercancel", onUp);
      cv.removeEventListener("dblclick", onDbl);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mm = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mm) ? mm : mm ? [mm] : []).forEach((x) => {
          (x as THREE.SpriteMaterial).map?.dispose();
          x.dispose();
        });
      });
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!api.current) return;
    api.current.pickable = view === "all"; // room floors only in the full view; objects are always tappable
    api.current.setView(view, focusY);
  }, [view, focusY]);
  useEffect(() => api.current?.setPeople(people), [people]);
  useEffect(() => api.current?.setWarn(warnCats), [warnCats]);

  return <div ref={host} className="apt-3d" aria-hidden="true" />;
}
