import { useEffect, useRef } from "react";
import * as THREE from "three";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

type Props = {
  state: OrbState;
  level?: number;
};

/**
 * HUD Jarvis — linhas, anéis e arcs. Sem esfera “planetária” preenchida.
 */
const COLORS: Record<OrbState, number> = {
  idle: 0x33cfff,
  listening: 0x6af7ff,
  thinking: 0x8ab4ff,
  speaking: 0x5dffd5,
};

function lineMat(color: number, opacity: number) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

function meshMat(color: number, opacity: number) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    wireframe: false,
  });
}

function circleLine(radius: number, segments = 128): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function arcLine(radius: number, start: number, end: number, segments = 64) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = start + ((end - start) * i) / segments;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
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
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 6.2);

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
    const trash: Array<{ dispose: () => void }> = [];

    const colorize: Array<{ mat: THREE.Material & { color: THREE.Color; opacity: number }; baseOp: number }> = [];

    const addLine = (geo: THREE.BufferGeometry, opacity: number, rot?: [number, number, number]) => {
      const mat = lineMat(COLORS.idle, opacity);
      const line = new THREE.Line(geo, mat);
      if (rot) line.rotation.set(...rot);
      root.add(line);
      trash.push(geo, mat);
      colorize.push({ mat, baseOp: opacity });
      return line;
    };

    // —— Núcleo: só wireframe (sem bola sólida) ——
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 1),
      new THREE.MeshBasicMaterial({
        color: COLORS.idle,
        wireframe: true,
        transparent: true,
        opacity: 0.85,
      }),
    );
    root.add(core);
    trash.push(core.geometry, core.material as THREE.Material);
    colorize.push({ mat: core.material as THREE.MeshBasicMaterial, baseOp: 0.85 });

    const coreInner = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 0),
      new THREE.MeshBasicMaterial({
        color: COLORS.idle,
        wireframe: true,
        transparent: true,
        opacity: 0.7,
      }),
    );
    root.add(coreInner);
    trash.push(coreInner.geometry, coreInner.material as THREE.Material);
    colorize.push({ mat: coreInner.material as THREE.MeshBasicMaterial, baseOp: 0.7 });

    // —— Anéis circulares finos (linha, não torus grosso) ——
    const ringPlanes: THREE.Object3D[] = [];
    const ringRadii = [0.85, 1.15, 1.45, 1.8, 2.2, 2.55];
    ringRadii.forEach((r, i) => {
      const g = new THREE.Group();
      g.add(addLine(circleLine(r), 0.55 - i * 0.05));
      // ticks
      for (let t = 0; t < 24; t++) {
        if (t % 3 !== 0) continue;
        const a = (t / 24) * Math.PI * 2;
        const x0 = Math.cos(a) * (r - 0.04);
        const y0 = Math.sin(a) * (r - 0.04);
        const x1 = Math.cos(a) * (r + 0.06);
        const y1 = Math.sin(a) * (r + 0.06);
        addLine(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x0, y0, 0),
            new THREE.Vector3(x1, y1, 0),
          ]),
          0.35,
        );
      }
      g.rotation.x = i % 2 === 0 ? 0.15 : -0.35;
      g.rotation.y = i * 0.4;
      root.add(g);
      ringPlanes.push(g);
    });

    // —— Arcs de varredura ——
    const sweep = new THREE.Group();
    sweep.add(addLine(arcLine(1.95, 0, Math.PI * 0.7), 0.9));
    sweep.add(addLine(arcLine(2.35, Math.PI * 0.9, Math.PI * 1.6), 0.55));
    root.add(sweep);

    // —— Hexágono HUD ——
    const hexPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      hexPts.push(new THREE.Vector3(Math.cos(a) * 1.05, Math.sin(a) * 1.05, 0));
    }
    const hex = addLine(new THREE.BufferGeometry().setFromPoints(hexPts), 0.5);

    // —— Brackets retangulares (cantos) ——
    const bracket = (x: number, y: number, s = 0.35) => {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, y - s, 0),
        new THREE.Vector3(x, y, 0),
        new THREE.Vector3(x + (x > 0 ? -s : s), y, 0),
      ]);
      addLine(g, 0.45);
    };
    bracket(-2.7, 1.6);
    bracket(2.7, 1.6);
    bracket(-2.7, -1.6);
    bracket(2.7, -1.6);

    // —— Cruz / mira ——
    addLine(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.55, 0, 0),
        new THREE.Vector3(-0.2, 0, 0),
      ]),
      0.4,
    );
    addLine(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0.2, 0, 0),
        new THREE.Vector3(0.55, 0, 0),
      ]),
      0.4,
    );
    addLine(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -0.55, 0),
        new THREE.Vector3(0, -0.2, 0),
      ]),
      0.4,
    );
    addLine(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.2, 0),
        new THREE.Vector3(0, 0.55, 0),
      ]),
      0.4,
    );

    // —— Disco de varredura (plano fino, quase invisível — só “radar”) ——
    const scan = new THREE.Mesh(
      new THREE.RingGeometry(0.01, 2.5, 64, 1, 0, Math.PI * 0.18),
      meshMat(COLORS.idle, 0.08),
    );
    root.add(scan);
    trash.push(scan.geometry, scan.material as THREE.Material);
    colorize.push({ mat: scan.material as THREE.MeshBasicMaterial, baseOp: 0.08 });

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

    const animate = () => {
      const t = clock.getElapsedTime();
      const s = stateRef.current;
      const lv = Math.min(1, Math.max(0, levelRef.current));
      target.set(COLORS[s]);
      current.lerp(target, 0.1);
      for (const c of colorize) {
        c.mat.color.copy(current);
        c.mat.opacity = c.baseOp + lv * 0.15 + (s === "thinking" ? 0.1 : 0);
      }
      (core.material as THREE.MeshBasicMaterial).color.copy(current);
      (coreInner.material as THREE.MeshBasicMaterial).color.copy(current);

      const pulse =
        s === "idle"
          ? 1 + Math.sin(t * 1.5) * 0.02
          : s === "listening"
            ? 1 + 0.03 + lv * 0.12
            : s === "thinking"
              ? 1 + 0.04 + Math.sin(t * 10) * 0.03
              : 1 + 0.05 + lv * 0.18;
      root.scale.setScalar(pulse);

      const spin = s === "thinking" ? 1.3 : s === "listening" ? 0.85 : s === "speaking" ? 1.0 : 0.35;
      ringPlanes.forEach((g, i) => {
        g.rotation.z = t * spin * (i % 2 === 0 ? 0.4 : -0.55);
      });
      sweep.rotation.z = t * 1.8;
      hex.rotation.z = -t * 0.25;
      core.rotation.y = t * 0.6;
      core.rotation.x = t * 0.25;
      coreInner.rotation.y = -t * 0.9;
      scan.rotation.z = t * 2.4;

      camera.position.z = 6.2 - lv * 0.2;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      trash.forEach((d) => d.dispose());
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="orb-canvas" ref={mountRef} aria-hidden />;
}
