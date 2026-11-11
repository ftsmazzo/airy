import { useEffect, useRef } from "react";
import * as THREE from "three";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

type Props = {
  state: OrbState;
  level?: number;
};

/** Núcleo estilo JARVIS — HUD ciano, anéis, arcs e varredura (não “planeta”). */
const COLORS: Record<OrbState, number> = {
  idle: 0x2ec8ff,
  listening: 0x5ef0ff,
  thinking: 0x7eb6ff,
  speaking: 0x4dffe0,
};

function softDisc(): THREE.CanvasTexture {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.2, "rgba(180,240,255,0.85)");
  r.addColorStop(0.55, "rgba(80,200,255,0.25)");
  r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

function addMat(color: number, opacity: number) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function Orb({ state, level = 0 }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const levelRef = useRef(level);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.15, 5.6);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);
    const sprite = softDisc();
    const disposables: Array<{ dispose: () => void }> = [sprite];

    // —— Núcleo ——
    const coreGeo = new THREE.IcosahedronGeometry(0.48, 2);
    const coreWire = new THREE.Mesh(
      coreGeo,
      new THREE.MeshBasicMaterial({
        color: COLORS.idle,
        wireframe: true,
        transparent: true,
        opacity: 0.65,
      }),
    );
    const coreFill = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.36, 3),
      addMat(COLORS.idle, 0.4),
    );
    const coreGlow = new THREE.Mesh(new THREE.SphereGeometry(0.72, 48, 48), addMat(COLORS.idle, 0.14));
    const coreHalo = new THREE.Mesh(new THREE.SphereGeometry(1.05, 32, 32), addMat(COLORS.idle, 0.07));
    root.add(coreWire, coreFill, coreGlow, coreHalo);
    disposables.push(coreGeo, coreWire.material as THREE.Material, coreFill.geometry, coreFill.material as THREE.Material, coreGlow.geometry, coreGlow.material as THREE.Material, coreHalo.geometry, coreHalo.material as THREE.Material);

    // —— Anéis principais (estilo reator) ——
    const rings: THREE.Mesh[] = [];
    const ringDefs = [
      { r: 1.05, t: 0.012, op: 0.7, rx: Math.PI / 2, ry: 0, rz: 0 },
      { r: 1.28, t: 0.008, op: 0.45, rx: Math.PI / 2.35, ry: 0.55, rz: 0.2 },
      { r: 1.55, t: 0.007, op: 0.35, rx: Math.PI / 1.75, ry: -0.4, rz: 0.5 },
      { r: 1.88, t: 0.006, op: 0.28, rx: Math.PI / 2.1, ry: 0.9, rz: -0.3 },
      { r: 2.22, t: 0.005, op: 0.18, rx: Math.PI / 2.6, ry: -0.7, rz: 0.15 },
    ];
    for (const d of ringDefs) {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(d.r, d.t, 10, 240), addMat(COLORS.idle, d.op));
      mesh.rotation.set(d.rx, d.ry, d.rz);
      root.add(mesh);
      rings.push(mesh);
      disposables.push(mesh.geometry, mesh.material as THREE.Material);
    }

    // —— Arcs / varredura ——
    const arcs: THREE.Mesh[] = [];
    for (const conf of [
      { r: 1.4, t: 0.018, arc: Math.PI * 0.9, op: 0.85 },
      { r: 1.7, t: 0.014, arc: Math.PI * 0.55, op: 0.55 },
      { r: 2.05, t: 0.012, arc: Math.PI * 1.15, op: 0.4 },
    ]) {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(conf.r, conf.t, 8, 100, conf.arc),
        addMat(COLORS.idle, conf.op),
      );
      m.rotation.x = Math.PI / 2;
      root.add(m);
      arcs.push(m);
      disposables.push(m.geometry, m.material as THREE.Material);
    }

    // —— Hex HUD (anel facetado) ——
    const hex = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.15, 0.02, 6, 1, true),
      addMat(COLORS.idle, 0.22),
    );
    hex.rotation.x = Math.PI / 2;
    root.add(hex);
    disposables.push(hex.geometry, hex.material as THREE.Material);

    // —— Ticks orbitais ——
    const tickN = 96;
    const tickPos = new Float32Array(tickN * 3);
    for (let i = 0; i < tickN; i++) {
      const a = (i / tickN) * Math.PI * 2;
      const r = i % 4 === 0 ? 2.45 : 2.35;
      tickPos[i * 3] = Math.cos(a) * r;
      tickPos[i * 3 + 1] = Math.sin(a) * r * 0.12;
      tickPos[i * 3 + 2] = Math.sin(a) * r * 0.04;
    }
    const tickGeo = new THREE.BufferGeometry();
    tickGeo.setAttribute("position", new THREE.BufferAttribute(tickPos, 3));
    const tickMat = new THREE.PointsMaterial({
      size: 0.04,
      map: sprite,
      color: COLORS.idle,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ticks = new THREE.Points(tickGeo, tickMat);
    root.add(ticks);
    disposables.push(tickGeo, tickMat);

    // —— Sparks internos ——
    const sparkN = 260;
    const sparkPos = new Float32Array(sparkN * 3);
    for (let i = 0; i < sparkN; i++) {
      const r = 0.5 + Math.random() * 0.85;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      sparkPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      sparkPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      sparkPos[i * 3 + 2] = r * Math.cos(ph);
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = new THREE.PointsMaterial({
      size: 0.03,
      map: sprite,
      color: COLORS.idle,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    root.add(sparks);
    disposables.push(sparkGeo, sparkMat);

    // —— Retículos (linhas HUD) ——
    const crossMat = addMat(COLORS.idle, 0.2);
    const mkLine = (points: THREE.Vector3[]) => {
      const g = new THREE.BufferGeometry().setFromPoints(points);
      const l = new THREE.Line(g, crossMat);
      root.add(l);
      disposables.push(g);
      return l;
    };
    mkLine([new THREE.Vector3(-2.6, 0, 0), new THREE.Vector3(-1.1, 0, 0)]);
    mkLine([new THREE.Vector3(1.1, 0, 0), new THREE.Vector3(2.6, 0, 0)]);
    mkLine([new THREE.Vector3(0, -2.3, 0), new THREE.Vector3(0, -1.1, 0)]);
    mkLine([new THREE.Vector3(0, 1.1, 0), new THREE.Vector3(0, 2.3, 0)]);
    disposables.push(crossMat);

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let raf = 0;
    const clock = new THREE.Clock();
    const target = new THREE.Color(COLORS.idle);
    const current = new THREE.Color(COLORS.idle);

    const paint = (c: THREE.Color) => {
      (coreWire.material as THREE.MeshBasicMaterial).color.copy(c);
      (coreFill.material as THREE.MeshBasicMaterial).color.copy(c);
      (coreGlow.material as THREE.MeshBasicMaterial).color.copy(c);
      (coreHalo.material as THREE.MeshBasicMaterial).color.copy(c);
      (hex.material as THREE.MeshBasicMaterial).color.copy(c);
      crossMat.color.copy(c);
      tickMat.color.copy(c);
      sparkMat.color.copy(c);
      for (const r of rings) (r.material as THREE.MeshBasicMaterial).color.copy(c);
      for (const a of arcs) (a.material as THREE.MeshBasicMaterial).color.copy(c);
    };

    const animate = () => {
      const t = clock.getElapsedTime();
      const s = stateRef.current;
      const lv = Math.min(1, Math.max(0, levelRef.current));
      target.set(COLORS[s]);
      current.lerp(target, 0.09);
      paint(current);

      const pulse =
        s === "idle"
          ? 1 + Math.sin(t * 1.7) * 0.035
          : s === "listening"
            ? 1 + 0.06 + lv * 0.22 + Math.sin(t * 8) * 0.025
            : s === "thinking"
              ? 1 + 0.05 + Math.sin(t * 12) * 0.055
              : 1 + 0.08 + lv * 0.3 + Math.sin(t * 9) * 0.035;

      root.scale.setScalar(pulse);

      const spin = s === "thinking" ? 1.55 : s === "listening" ? 1.05 : s === "speaking" ? 1.25 : 0.42;
      rings[0].rotation.z = t * spin * 0.9;
      rings[1].rotation.z = -t * spin * 0.65;
      rings[2].rotation.z = t * spin * 0.4;
      rings[3].rotation.z = -t * spin * 0.55;
      rings[4].rotation.z = t * spin * 0.25;
      rings[1].rotation.y = 0.55 + Math.sin(t * 0.45) * 0.35;
      rings[2].rotation.x = Math.PI / 1.75 + Math.cos(t * 0.4) * 0.25;
      rings[3].rotation.y = 0.9 + t * 0.12;

      arcs[0].rotation.z = t * 2.1;
      arcs[1].rotation.z = -t * 1.4;
      arcs[2].rotation.z = t * 0.85;
      arcs[1].rotation.x = Math.PI / 2 + Math.sin(t * 0.6) * 0.35;

      hex.rotation.z = t * 0.35;
      coreWire.rotation.y = t * 0.7;
      coreWire.rotation.x = t * 0.28;
      coreFill.rotation.y = -t * 0.55;
      ticks.rotation.z = t * 0.22;
      sparks.rotation.y = t * 0.6;

      const hot = s === "speaking" || s === "listening";
      (coreFill.material as THREE.MeshBasicMaterial).opacity = 0.32 + lv * 0.4 + (hot ? 0.15 : 0);
      (coreGlow.material as THREE.MeshBasicMaterial).opacity = 0.1 + lv * 0.22;
      (coreHalo.material as THREE.MeshBasicMaterial).opacity = 0.05 + lv * 0.1;
      sparkMat.opacity = 0.55 + lv * 0.45;
      (arcs[0].material as THREE.MeshBasicMaterial).opacity =
        0.55 + (s === "thinking" ? 0.35 : 0.15) + lv * 0.2;

      camera.position.z = 5.6 - lv * 0.25 - (s === "speaking" ? 0.12 : 0);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      for (const d of disposables) d.dispose?.();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="orb-canvas" ref={mountRef} aria-hidden />;
}
