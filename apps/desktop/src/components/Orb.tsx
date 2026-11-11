import { useEffect, useRef } from "react";
import * as THREE from "three";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

type Props = {
  state: OrbState;
  level?: number; // 0..1 audio energy
};

const COLORS: Record<OrbState, number> = {
  idle: 0x3d5a80,
  listening: 0x5ec8ff,
  thinking: 0x7a5cff,
  speaking: 0x7dffb3,
};

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
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.z = 4.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const count = 1400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 1.05 + Math.random() * 0.35;
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = Math.random() * Math.PI * 2;
      positions[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
      positions[i * 3 + 2] = r * Math.cos(theta);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      size: 0.028,
      color: COLORS.idle,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const coreGeo = new THREE.SphereGeometry(0.72, 48, 48);
    const coreMat = new THREE.MeshBasicMaterial({
      color: COLORS.idle,
      transparent: true,
      opacity: 0.18,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    const glowGeo = new THREE.SphereGeometry(0.95, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: COLORS.idle,
      transparent: true,
      opacity: 0.08,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glow);

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const t = clock.getElapsedTime();
      const s = stateRef.current;
      const lv = levelRef.current;
      const color = new THREE.Color(COLORS[s]);
      material.color.lerp(color, 0.08);
      coreMat.color.lerp(color, 0.08);
      glowMat.color.lerp(color, 0.08);

      const pulse =
        s === "idle"
          ? 1 + Math.sin(t * 1.4) * 0.03
          : s === "listening"
            ? 1 + 0.08 + lv * 0.25 + Math.sin(t * 6) * 0.02
            : s === "thinking"
              ? 1 + 0.06 + Math.sin(t * 10) * 0.04
              : 1 + 0.1 + lv * 0.3 + Math.sin(t * 8) * 0.03;

      points.scale.setScalar(pulse);
      core.scale.setScalar(pulse * 0.98);
      glow.scale.setScalar(pulse * 1.15);
      points.rotation.y = t * (s === "thinking" ? 0.55 : 0.18);
      points.rotation.x = Math.sin(t * 0.4) * 0.12;

      material.opacity = s === "speaking" ? 0.95 : 0.85;
      glowMat.opacity = s === "listening" ? 0.14 : 0.08;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
