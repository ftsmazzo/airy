import { useEffect, useRef } from "react";
import * as THREE from "three";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

type Props = {
  state: OrbState;
  level?: number;
};

const COLORS: Record<OrbState, THREE.ColorRepresentation> = {
  idle: 0x4aa3c7,
  listening: 0x5ee0ff,
  thinking: 0xa8b4ff,
  speaking: 0x6dffc2,
};

function softCircleTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function fillSphereCloud(
  count: number,
  rMin: number,
  rMax: number,
  jitter = 0,
): Float32Array {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = rMin + Math.random() * (rMax - rMin) + (Math.random() - 0.5) * jitter;
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
  }
  return pos;
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
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.z = 5.1;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const sprite = softCircleTexture();
    const group = new THREE.Group();
    scene.add(group);

    // Núcleo luminoso
    const coreGeo = new THREE.SphereGeometry(0.55, 64, 64);
    const coreMat = new THREE.MeshBasicMaterial({
      color: COLORS.idle,
      transparent: true,
      opacity: 0.55,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    const innerGlowGeo = new THREE.SphereGeometry(0.78, 48, 48);
    const innerGlowMat = new THREE.MeshBasicMaterial({
      color: COLORS.idle,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const innerGlow = new THREE.Mesh(innerGlowGeo, innerGlowMat);
    group.add(innerGlow);

    // Nuvem densa
    const denseCount = 2200;
    const denseGeo = new THREE.BufferGeometry();
    denseGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(fillSphereCloud(denseCount, 0.9, 1.25), 3),
    );
    const denseMat = new THREE.PointsMaterial({
      size: 0.045,
      map: sprite,
      color: COLORS.idle,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const dense = new THREE.Points(denseGeo, denseMat);
    group.add(dense);

    // Halo externo
    const haloCount = 900;
    const haloGeo = new THREE.BufferGeometry();
    haloGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(fillSphereCloud(haloCount, 1.45, 2.05, 0.08), 3),
    );
    const haloMat = new THREE.PointsMaterial({
      size: 0.07,
      map: sprite,
      color: COLORS.idle,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const halo = new THREE.Points(haloGeo, haloMat);
    group.add(halo);

    // Anéis orbitais
    const rings: THREE.Mesh[] = [];
    const ringMatBase = [
      { r: 1.35, tube: 0.012, opacity: 0.35, tilt: 0.4 },
      { r: 1.65, tube: 0.008, opacity: 0.22, tilt: -0.7 },
      { r: 1.95, tube: 0.006, opacity: 0.14, tilt: 1.1 },
    ];
    for (const conf of ringMatBase) {
      const geo = new THREE.TorusGeometry(conf.r, conf.tube, 16, 180);
      const mat = new THREE.MeshBasicMaterial({
        color: COLORS.idle,
        transparent: true,
        opacity: conf.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = Math.PI / 2 + conf.tilt;
      group.add(mesh);
      rings.push(mesh);
    }

    // Aura grande (plano billboard suave via esfera bem transparente)
    const auraGeo = new THREE.SphereGeometry(2.4, 32, 32);
    const auraMat = new THREE.MeshBasicMaterial({
      color: COLORS.idle,
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    group.add(aura);

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
      current.lerp(target, 0.07);

      denseMat.color.copy(current);
      haloMat.color.copy(current);
      coreMat.color.copy(current);
      innerGlowMat.color.copy(current);
      auraMat.color.copy(current);
      for (const ring of rings) {
        (ring.material as THREE.MeshBasicMaterial).color.copy(current);
      }

      const breathe =
        s === "idle"
          ? 1 + Math.sin(t * 1.25) * 0.045
          : s === "listening"
            ? 1 + 0.07 + lv * 0.28 + Math.sin(t * 5.5) * 0.03
            : s === "thinking"
              ? 1 + 0.05 + Math.sin(t * 9.5) * 0.055
              : 1 + 0.09 + lv * 0.35 + Math.sin(t * 7.2) * 0.04;

      const spin =
        s === "thinking" ? 0.85 : s === "listening" ? 0.42 : s === "speaking" ? 0.55 : 0.18;

      group.scale.setScalar(breathe);
      dense.rotation.y = t * spin;
      dense.rotation.x = Math.sin(t * 0.35) * 0.18;
      halo.rotation.y = -t * spin * 0.55;
      halo.rotation.z = t * 0.12;
      core.rotation.y = t * 0.2;

      rings[0].rotation.z = t * 0.35;
      rings[1].rotation.z = -t * 0.55;
      rings[2].rotation.z = t * 0.22;
      rings[0].rotation.x = Math.PI / 2 + 0.4 + Math.sin(t * 0.6) * 0.15;
      rings[1].rotation.x = Math.PI / 2 - 0.7 + Math.cos(t * 0.5) * 0.12;

      denseMat.opacity = s === "speaking" ? 1 : 0.88;
      denseMat.size = s === "listening" ? 0.05 + lv * 0.03 : 0.045;
      haloMat.opacity = 0.28 + (s === "speaking" ? 0.25 : s === "listening" ? 0.2 : 0.1) + lv * 0.2;
      coreMat.opacity = 0.42 + lv * 0.25 + (s === "thinking" ? 0.12 : 0);
      innerGlowMat.opacity = 0.12 + lv * 0.2 + (s === "speaking" ? 0.1 : 0);
      auraMat.opacity = 0.04 + lv * 0.06 + (s === "listening" ? 0.04 : 0);

      // leve “câmera breathing”
      camera.position.z = 5.1 - lv * 0.15 - (s === "speaking" ? 0.08 : 0);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      denseGeo.dispose();
      haloGeo.dispose();
      denseMat.dispose();
      haloMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      innerGlowGeo.dispose();
      innerGlowMat.dispose();
      auraGeo.dispose();
      auraMat.dispose();
      for (const ring of rings) {
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      }
      sprite.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div className="orb-canvas" ref={mountRef} aria-hidden />;
}
