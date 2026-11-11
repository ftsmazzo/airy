import { useEffect, useState } from "react";
import { Orb, type OrbState } from "./components/Orb";

const CYCLE: OrbState[] = ["idle", "listening", "thinking", "speaking"];

/** Preview só da orbe — sem Electron / agente. Ideal para demo visual. */
export function OrbPreviewApp() {
  const [orb, setOrb] = useState<OrbState>("idle");
  const [level, setLevel] = useState(0.15);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % CYCLE.length;
      setOrb(CYCLE[i]);
      setLevel(CYCLE[i] === "idle" ? 0.12 : CYCLE[i] === "thinking" ? 0.35 : 0.55 + Math.random() * 0.3);
    }, 2800);
    return () => clearInterval(id);
  }, [auto]);

  useEffect(() => {
    if (orb === "idle") return;
    const id = setInterval(() => {
      setLevel((v) => {
        const wobble = Math.sin(Date.now() / 180) * 0.12;
        return Math.min(1, Math.max(0.08, v * 0.85 + 0.2 + wobble));
      });
    }, 80);
    return () => clearInterval(id);
  }, [orb]);

  return (
    <div className="app">
      <div className="stage" data-state={orb}>
        <div className="hud">
          <h1>Airy</h1>
          <div className="tagline">orbe · preview visual</div>
          <div className="status">
            <span className="dot" />
            {orb}
          </div>
        </div>
        <Orb state={orb} level={level} />
      </div>
      <div className="panel">
        <div className="transcript">
          <div className="assistant">
            Preview da orbe pulsante. Clique nos estados ou deixe o ciclo automático.
          </div>
        </div>
        <div className="controls">
          {CYCLE.map((s) => (
            <button
              key={s}
              className={`secondary ${orb === s ? "active-demo" : ""}`}
              onClick={() => {
                setAuto(false);
                setOrb(s);
                setLevel(s === "idle" ? 0.1 : 0.55);
              }}
            >
              {s}
            </button>
          ))}
          <button
            className={auto ? "active-demo" : "secondary"}
            onClick={() => setAuto((v) => !v)}
          >
            {auto ? "Demo: on" : "Demo: off"}
          </button>
        </div>
        <div className="hint">Abra com npm run preview:orb — sem instalar o app completo.</div>
      </div>
    </div>
  );
}
