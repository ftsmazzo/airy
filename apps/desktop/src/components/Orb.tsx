import { useEffect, useRef } from "react";
import * as THREE from "three";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

type Props = {
  state: OrbState;
  level?: number;
};

/** Núcleo estilo Jarvis — ciano holográfico, anéis e arcos (não “planeta”). */
const COLORS: Record<OrbState, number> = {
  idle: 0x3ecbff,
  listening: 0x6af0ff,
  thinking: 0x7ab8ff,
  speaking: 0x5cffd2,
};

function softDisc(): THREE.CanvasTexture {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.25, "rgba(255,255,255,0.55)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

function makeRing(
  radius: number,
  tube: number,
  opacity: number,
  color: number,
): THREE.Mesh {
  const geo = new THREE.TorusGeometry(radius, tube, 12, 220);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

function makeArcRing(
  radius: number,
  tube: number,
  arc: number,
  opacity: number,
  color: number,
): THREE.Mesh {
  const geo = new THREE.TorusGeometry(radius, tube, 10, 120, arc);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
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
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.z = 5.4;

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

    // Núcleo wireframe + glow
    const coreWire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55, 1),
      new THREE.MeshBasicMaterial({
        color: COLORS.idle,
        wireframe: true,
        transparent: true,
        opacity: 0.55,
      }),
    );
    root.add(coreWire);

    const coreFill = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 2),
      new THREE.MeshBasicMaterial({
        color: COLORS.idle,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    root.add(coreFill);

    const coreAura = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 32, 32),
      new THREE.MeshBasicMaterial({
        color: COLORS.idle,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    root.add(coreAura);

    // Anéis Jarvis
    const ringA = makeRing(1.15, 0.01, 0.55, COLORS.idle);
    ringA.rotation.x = Math.PI / 2.2;
    const ringB = makeRing(1.45, 0.008, 0.35, COLORS.idle);
    ringB.rotation.x = Math.PI / 2.6;
    ringB.rotation.y = 0.4;
    const ringC = makeRing(1.85, 0.006, 0.22, COLORS.idle);
    ringC.rotation.x = Math.PI / 1.7;
    ringC.rotation.z = 0.5;
    root.add(ringA, ringB, ringC);

    const arc1 = makeArcRing(1.62, 0.014, Math.PI * 1.2, 0.7, COLORS.idle);
    arc1.rotation.x = Math.PI / 2;
    const arc2 = makeArcRing(2.05, 0.01, Math.PI * 0.85, 0.45, COLORS.idle);
    arc2.rotation.x = Math.PI / 2.3;
    arc2.rotation.y = 1.1;
    root.add(arc1, arc2);

    // Marcas / ticks orbitais (pontos)
    const sprite = softDisc();
    const tickCount = 72;
    const tickPos = new Float32Array(tickCount * 3);
    for (let i = 0; i < tickCount; i++) {
      const a = (i / tickCount) * Math.PI * 2;
      const r = 2.25;
      tickPos[i * 3] = Math.cos(a) * r;
      tickPos[i * 3 + 1] = Math.sin(a) * r * 0.22;
      tickPos[i * 3 + 2] = Math.sin(a) * r * 0.08;
    }
    const tickGeo = new THREE.BufferGeometry();
    tickGeo.setAttribute("position", new THREE.BufferAttribute(tickPos, 3));
    const tickMat = new THREE.PointsMaterial({
      size: 0.045,
      map: sprite,
      color: COLORS.idle,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ticks = new THREE.Points(tickGeo, tickMat);
    root.add(ticks);

    // Partículas de energia (poucas, internas)
    const sparkN = 180;
    const sparkPos = new Float32Array(sparkN * 3);
    for (let i = 0; i < sparkN; i++) {
      const r = 0.6 + Math.random() * 0.9;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      sparkPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      sparkPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      sparkPos[i * 3 + 2] = r * Math.cos(ph);
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = new THREE.PointsMaterial({
      size: 0.035,
      map: sprite,
      color: COLORS.idle,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    root.add(sparks);

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
      (coreAura.material as THREE.MeshBasicMaterial).color.copy(c);
      for (const m of [ringA, ringB, ringC, arc1, arc2]) {
        (m.material as THREE.MeshBasicMaterial).color.copy(c);
      }
      tickMat.color.copy(c);
      sparkMat.color.copy(c);
    };

    const animate = () => {
      const t = clock.getElapsedTime();
      const s = stateRef.current;
      const lv = Math.min(1, Math.max(0, levelRef.current));
      target.set(COLORS[s]);
      current.lerp(target, 0.08);
      paint(current);

      const pulse =
        s === "idle"
          ? 1 + Math.sin(t * 1.6) * 0.03
          : s === "listening"
            ? 1 + 0.05 + lv * 0.2 + Math.sin(t * 7) * 0.02
            : s === "thinking"
              ? 1 + 0.04 + Math.sin(t * 11) * 0.05
              : 1 + 0.07 + lv * 0.28 + Math.sin(t * 8) * 0.03;

      root.scale.setScalar(pulse);

      const spin = s === "thinking" ? 1.4 : s === "listening" ? 0.9 : s === "speaking" ? 1.1 : 0.35;
      ringA.rotation.z = t * spin;
      ringB.rotation.z = -t * spin * 0.7;
      ringC.rotation.z = t * spin * 0.45;
      ringB.rotation.y = 0.4 + Math.sin(t * 0.4) * 0.25;
      ringC.rotation.x = Math.PI / 1.7 + Math.cos(t * 0.35) * 0.2;
      arc1.rotation.z = t * 1.6;
      arc2.rotation.z = -t * 1.1;
      coreWire.rotation.y = t * 0.55;
      coreWire.rotation.x = t * 0.25;
      coreFill.rotation.y = -t * 0.4;
      ticks.rotation.z = t * 0.2;
      sparks.rotation.y = t * 0.5;

      const hot = s === "speaking" || s === "listening";
      (coreFill.material as THREE.MeshBasicMaterial).opacity = 0.28 + lv * 0.35 + (hot ? 0.12 : 0);
      (coreAura.material as THREE.MeshBasicMaterial).opacity = 0.08 + lv * 0.18;
      sparkMat.opacity = 0.55 + lv * 0.4;
      (arc1.material as THREE.MeshBasicMaterial).opacity = 0.45 + (s === "thinking" ? 0.35 : 0.15);

      camera.position.z = 5.4 - lv * 0.2;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      sprite.dispose();
      tickGeo.dispose();
      sparkGeo.dispose();
      tickMat.dispose();
      sparkMat.dispose();
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div className="orb-canvas" ref={mountRef} aria-hidden />;
}
