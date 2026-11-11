import { useEffect, useRef } from "react";
import * as THREE from "three";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

type Props = {
  state: OrbState;
  level?: number;
};

/** FUI denso estilo video-wall / Pin — cyan + âmbar, núcleo luminoso. */
const CYAN: Record<OrbState, number> = {
  idle: 0x33cfff,
  listening: 0x6af7ff,
  thinking: 0x8ab4ff,
  speaking: 0x5dffd5,
};
const AMBER = 0xff8a3d;
const AMBER_HOT = 0xffb347;

type ColorEntry = { mat: THREE.Material & { color: THREE.Color; opacity: number }; baseOp: number };

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
  });
}

function circlePts(radius: number, segments = 160): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }
  return pts;
}

function dashedCircle(radius: number, dashes = 48, gapRatio = 0.35): THREE.BufferGeometry {
  const step = (Math.PI * 2) / dashes;
  const span = step * (1 - gapRatio);
  const segs: number[] = [];
  for (let i = 0; i < dashes; i++) {
    const start = i * step;
    const end = start + span;
    segs.push(Math.cos(start) * radius, Math.sin(start) * radius, 0);
    segs.push(Math.cos(end) * radius, Math.sin(end) * radius, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(segs, 3));
  return geo;
}

function arcPts(radius: number, start: number, end: number, segments = 64): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = start + ((end - start) * i) / segments;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }
  return pts;
}

function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  g.addColorStop(0, "rgba(180, 245, 255, 1)");
  g.addColorStop(0.25, "rgba(60, 200, 255, 0.85)");
  g.addColorStop(0.55, "rgba(30, 90, 180, 0.35)");
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 5; i++) {
    const a0 = (i / 5) * Math.PI * 2;
    ctx.strokeStyle = `rgba(${80 + i * 20}, ${180 + i * 10}, 255, 0.22)`;
    ctx.lineWidth = 10 - i;
    ctx.beginPath();
    for (let t = 0; t < 90; t++) {
      const a = a0 + t * 0.08;
      const r = 20 + t * 0.9;
      const x = 128 + Math.cos(a) * r;
      const y = 128 + Math.sin(a) * r * 0.72;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
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
    // Câmera afastada: canvas/tela grande, desenho do orbe compacto no centro
    const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
    camera.position.set(0, 0, 10.5);

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
    const colorizeCyan: ColorEntry[] = [];
    const colorizeAmber: ColorEntry[] = [];

    const track = (mat: ColorEntry["mat"], baseOp: number, tint: "cyan" | "amber") => {
      (tint === "cyan" ? colorizeCyan : colorizeAmber).push({ mat, baseOp });
    };

    const addLine = (
      parent: THREE.Object3D,
      geo: THREE.BufferGeometry,
      opacity: number,
      tint: "cyan" | "amber" = "cyan",
      asSegments = false,
    ) => {
      const mat = lineMat(tint === "cyan" ? CYAN.idle : AMBER, opacity);
      const obj = asSegments ? new THREE.LineSegments(geo, mat) : new THREE.Line(geo, mat);
      parent.add(obj);
      trash.push(geo, mat);
      track(mat, opacity, tint);
      return obj;
    };

    // —— Núcleo luminoso (galáxia / holograma) ——
    const glowTex = makeGlowTexture();
    trash.push(glowTex);
    const coreGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: CYAN.idle,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    coreGlow.scale.set(2.4, 2.4, 1);
    root.add(coreGlow);
    trash.push(coreGlow.material);
    track(coreGlow.material as THREE.SpriteMaterial, 0.95, "cyan");

    const coreDisk = new THREE.Mesh(new THREE.CircleGeometry(0.55, 64), meshMat(0x0a2038, 0.55));
    root.add(coreDisk);
    trash.push(coreDisk.geometry, coreDisk.material as THREE.Material);

    const coreRing = addLine(root, new THREE.BufferGeometry().setFromPoints(circlePts(0.58)), 0.85);
    const coreRing2 = addLine(root, new THREE.BufferGeometry().setFromPoints(circlePts(0.72)), 0.45);

    const coreWire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.38, 1),
      new THREE.MeshBasicMaterial({
        color: CYAN.idle,
        wireframe: true,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    root.add(coreWire);
    trash.push(coreWire.geometry, coreWire.material as THREE.Material);
    track(coreWire.material as THREE.MeshBasicMaterial, 0.22, "cyan");

    // —— Anéis densos ——
    const ringGroups: THREE.Group[] = [];
    const rings: Array<{ r: number; op: number; dashed?: boolean; dashes?: number }> = [
      { r: 0.95, op: 0.55 },
      { r: 1.15, op: 0.4, dashed: true, dashes: 56 },
      { r: 1.38, op: 0.65 },
      { r: 1.62, op: 0.35, dashed: true, dashes: 72 },
      { r: 1.88, op: 0.7 },
      { r: 2.18, op: 0.3, dashed: true, dashes: 64 },
      { r: 2.45, op: 0.55 },
      { r: 2.72, op: 0.25 },
    ];
    rings.forEach((cfg, i) => {
      const g = new THREE.Group();
      if (cfg.dashed) {
        addLine(g, dashedCircle(cfg.r, cfg.dashes ?? 48), cfg.op, "cyan", true);
      } else {
        addLine(g, new THREE.BufferGeometry().setFromPoints(circlePts(cfg.r)), cfg.op);
      }
      if (i % 2 === 0) {
        for (let t = 0; t < 36; t++) {
          if (t % 3 !== 0) continue;
          const a = (t / 36) * Math.PI * 2;
          addLine(
            g,
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(Math.cos(a) * (cfg.r - 0.035), Math.sin(a) * (cfg.r - 0.035), 0),
              new THREE.Vector3(Math.cos(a) * (cfg.r + 0.055), Math.sin(a) * (cfg.r + 0.055), 0),
            ]),
            0.35,
          );
        }
      }
      g.rotation.x = (i % 3 === 0 ? 0.08 : i % 3 === 1 ? -0.12 : 0.02) * (i > 4 ? 0.5 : 1);
      root.add(g);
      ringGroups.push(g);
    });

    // —— Anel de pontos âmbar ——
    const amberDots = new THREE.Group();
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), meshMat(AMBER, 0.85));
      m.position.set(Math.cos(a) * 2.02, Math.sin(a) * 2.02, 0.01);
      amberDots.add(m);
      trash.push(m.geometry, m.material as THREE.Material);
      track(m.material as THREE.MeshBasicMaterial, 0.85, "amber");
    }
    root.add(amberDots);

    // —— Arcs / radar ——
    const prog = new THREE.Group();
    [
      { r: 1.38, a0: -0.2, a1: 1.4, op: 0.95 },
      { r: 1.88, a0: 2.0, a1: 4.2, op: 0.75 },
      { r: 2.45, a0: 0.5, a1: 2.1, op: 0.55 },
    ].forEach((p) => {
      addLine(prog, new THREE.BufferGeometry().setFromPoints(arcPts(p.r, p.a0, p.a1, 80)), p.op);
    });
    const wedge = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 2.55, 64, 1, 0, Math.PI * 0.22),
      meshMat(CYAN.idle, 0.07),
    );
    prog.add(wedge);
    trash.push(wedge.geometry, wedge.material as THREE.Material);
    track(wedge.material as THREE.MeshBasicMaterial, 0.07, "cyan");
    root.add(prog);

    const amberSweep = new THREE.Group();
    addLine(amberSweep, new THREE.BufferGeometry().setFromPoints(arcPts(2.55, -0.35, 0.55, 40)), 0.9, "amber");
    addLine(amberSweep, new THREE.BufferGeometry().setFromPoints(arcPts(1.05, Math.PI * 0.8, Math.PI * 1.35, 32)), 0.7, "amber");
    root.add(amberSweep);

    // —— Brackets angular (cantos estilo Pin) ——
    const brackets = new THREE.Group();
    const bracketPath = (sx: number, sy: number, s = 0.55) => {
      addLine(
        brackets,
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(sx * (2.95 - s), sy * 2.95, 0),
          new THREE.Vector3(sx * 2.95, sy * 2.95, 0),
          new THREE.Vector3(sx * 2.95, sy * (2.95 - s), 0),
        ]),
        0.75,
        "amber",
      );
      addLine(
        brackets,
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(sx * (2.85 - s * 0.7), sy * 2.85, 0),
          new THREE.Vector3(sx * 2.85, sy * 2.85, 0),
          new THREE.Vector3(sx * 2.85, sy * (2.85 - s * 0.7), 0),
        ]),
        0.35,
      );
    };
    bracketPath(-1, 1);
    bracketPath(1, 1);
    bracketPath(-1, -1);
    bracketPath(1, -1);
    root.add(brackets);

    const hexPts = circlePts(0.88, 6);
    addLine(root, new THREE.BufferGeometry().setFromPoints([...hexPts, hexPts[0]]), 0.4);

    // —— Partículas ——
    const pCount = 180;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.random() * 2.8;
      pPos[i * 3] = Math.cos(a) * r;
      pPos[i * 3 + 1] = Math.sin(a) * r * (0.55 + Math.random() * 0.45);
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: CYAN.idle,
      size: 0.035,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(pGeo, pMat);
    root.add(particles);
    trash.push(pGeo, pMat);
    track(pMat, 0.55, "cyan");

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
    const target = new THREE.Color(CYAN.idle);
    const current = new THREE.Color(CYAN.idle);
    const amberTarget = new THREE.Color(AMBER);
    const amberCurrent = new THREE.Color(AMBER);

    const animate = () => {
      const t = clock.getElapsedTime();
      const s = stateRef.current;
      const lv = Math.min(1, Math.max(0, levelRef.current));
      target.set(CYAN[s]);
      current.lerp(target, 0.1);
      amberTarget.set(s === "speaking" ? AMBER_HOT : AMBER);
      amberCurrent.lerp(amberTarget, 0.08);

      for (const c of colorizeCyan) {
        c.mat.color.copy(current);
        c.mat.opacity = c.baseOp + lv * 0.12 + (s === "thinking" ? 0.08 : 0);
      }
      for (const c of colorizeAmber) {
        c.mat.color.copy(amberCurrent);
        c.mat.opacity = c.baseOp + lv * 0.08;
      }

      const pulse =
        s === "idle"
          ? 0.78 + Math.sin(t * 1.4) * 0.016
          : s === "listening"
            ? 0.8 + lv * 0.045
            : s === "thinking"
              ? 0.81 + Math.sin(t * 9) * 0.016
              : 0.82 + lv * 0.06;
      root.scale.setScalar(pulse);
      coreGlow.scale.setScalar(2.0 + Math.sin(t * 2.2) * 0.05 + lv * 0.16);

      const spin = s === "thinking" ? 1.35 : s === "listening" ? 0.9 : s === "speaking" ? 1.05 : 0.38;
      ringGroups.forEach((g, i) => {
        g.rotation.z = t * spin * (i % 2 === 0 ? 0.22 : -0.28);
      });
      prog.rotation.z = t * 1.15;
      amberDots.rotation.z = -t * 0.45;
      amberSweep.rotation.z = t * 0.7;
      coreWire.rotation.y = t * 0.55;
      coreWire.rotation.x = t * 0.2;
      coreRing.rotation.z = t * 0.15;
      coreRing2.rotation.z = -t * 0.2;
      particles.rotation.z = t * 0.12;
      wedge.rotation.z = t * 2.1;

      camera.position.z = 10.5 - lv * 0.1;
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
