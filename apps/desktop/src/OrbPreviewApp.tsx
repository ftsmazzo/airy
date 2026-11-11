import { useEffect, useState } from "react";
import { Orb, type OrbState } from "./components/Orb";

const CYCLE: OrbState[] = ["idle", "listening", "thinking", "speaking"];

/** Preview só da orbe Jarvis — sem Electron / agente. */
export function OrbPreviewApp() {
  const [orb, setOrb] = useState<OrbState>("idle");
  const [level, setLevel] = useState(0.2);

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % CYCLE.length;
      setOrb(CYCLE[i]);
      setLevel(CYCLE[i] === "idle" ? 0.12 : 0.45 + Math.random() * 0.35);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setLevel((v) => Math.min(1, Math.max(0.08, v + (Math.random() - 0.45) * 0.15)));
    }, 90);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="app">
      <div className="stage" data-state={orb}>
        <div className="hud-top">
          <h1>AIRY</h1>
          <div className="status">
            <span className="dot" />
            demo · {orb}
          </div>
        </div>
        <Orb state={orb} level={level} />
        <div className="caption">
          <p className="line">HUD FUI · galáxia · preview</p>
        </div>
        <div className="hint-bar">npm run preview:orb</div>
      </div>
    </div>
  );
}
