import { useCallback, useEffect, useRef, useState } from "react";
import { Orb, type OrbState } from "./components/Orb";
import { startClapWake, type ClapWakeHandle } from "./lib/clapWake";

type Turn = {
  userText: string;
  assistantText: string;
  toolTrace: string[];
};

export function App() {
  const [orb, setOrb] = useState<OrbState>("idle");
  const [level, setLevel] = useState(0);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [clapEnabled, setClapEnabled] = useState(true);
  const [text, setText] = useState("");
  const [turn, setTurn] = useState<Turn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState("Push-to-talk: Espaço. Ou bata 2 palmas para falar.");
  const [demo, setDemo] = useState(false);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const clapRef = useRef<ClapWakeHandle | null>(null);
  const busyRef = useRef(false);
  const recordingRef = useRef(false);
  const speakingRef = useRef(false);
  const startRecordingRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!window.airy?.ready) {
        setBootError("Agente indisponível — use Demo da orbe ou npm run preview:orb");
        setDemo(true);
        return;
      }
      try {
        const r = await window.airy.ready();
        if (cancelled) return;
        if (!r.ok) {
          setBootError(r.error || "Falha ao iniciar agente");
          setDemo(true);
          return;
        }
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          setBootError((e as Error).message);
          setDemo(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Demo visual da orbe (impacto na entrega, sem depender da voz)
  useEffect(() => {
    if (!demo || busy || recording || speakingRef.current) return;
    const cycle: OrbState[] = ["idle", "listening", "thinking", "speaking"];
    let i = 0;
    setOrb(cycle[0]);
    const id = setInterval(() => {
      if (busyRef.current || recordingRef.current || speakingRef.current) return;
      i = (i + 1) % cycle.length;
      setOrb(cycle[i]);
      setLevel(cycle[i] === "idle" ? 0.1 : 0.45 + Math.random() * 0.35);
    }, 2600);
    const wobble = setInterval(() => {
      if (busyRef.current || recordingRef.current || speakingRef.current) return;
      setLevel((v) => Math.min(1, Math.max(0.08, v + (Math.random() - 0.5) * 0.12)));
    }, 120);
    return () => {
      clearInterval(id);
      clearInterval(wobble);
    };
  }, [demo, busy, recording]);

  const playAudio = useCallback(async (b64: string | null) => {
    if (!b64) return;
    speakingRef.current = true;
    setOrb("speaking");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;

    const ctx = new AudioContext();
    const src = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    analyser.connect(ctx.destination);
    const data = new Uint8Array(analyser.frequencyBinCount);

    let raf = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      setLevel(sum / (data.length * 255));
      raf = requestAnimationFrame(tick);
    };
    tick();

    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      void audio.play().catch(() => resolve());
    });

    cancelAnimationFrame(raf);
    setLevel(0);
    URL.revokeObjectURL(url);
    await ctx.close();
    speakingRef.current = false;
    setOrb("idle");
  }, []);

  const runTurn = useCallback(
    async (fn: () => Promise<{
      userText: string;
      assistantText: string;
      audioBase64: string | null;
      toolTrace: string[];
    }>) => {
      setBusy(true);
      setError(null);
      setOrb("thinking");
      try {
        const res = await fn();
        setTurn({
          userText: res.userText,
          assistantText: res.assistantText,
          toolTrace: res.toolTrace,
        });
        await playAudio(res.audioBase64);
      } catch (e) {
        setError((e as Error).message);
        setOrb("idle");
      } finally {
        setBusy(false);
      }
    },
    [playAudio],
  );

  const stopRecording = useCallback(() => {
    const rec = mediaRef.current;
    if (!rec || rec.state === "inactive") return;
    rec.stop();
    setRecording(false);
    setLevel(0);
  }, []);

  const startRecording = useCallback(
    async (opts?: { autoStopSilence?: boolean }) => {
      if (busyRef.current || recordingRef.current || !ready) return;
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: pickMime() });
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        recStreamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        const buf = await blob.arrayBuffer();
        const b64 = bufferToBase64(buf);
        const ext = rec.mimeType.includes("ogg") ? "ogg" : "webm";
        await runTurn(() => window.airy.voiceTurn(b64, `audio.${ext}`));
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
      setOrb("listening");
      setLevel(0.2);
      setHint(
        opts?.autoStopSilence
          ? "Palmas detectadas — fale agora (para no silêncio)."
          : "Gravando… Espaço ou Parar para enviar.",
      );

      if (opts?.autoStopSilence) {
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const started = performance.now();
        let heardSpeech = false;
        let silentFor = 0;
        let last = performance.now();
        let raf = 0;

        const watch = () => {
          if (!recordingRef.current) {
            source.disconnect();
            void ctx.close();
            return;
          }
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const energy = Math.sqrt(sum / data.length);
          setLevel(Math.min(1, energy * 5));
          const now = performance.now();
          const dt = now - last;
          last = now;
          if (energy > 0.05) {
            heardSpeech = true;
            silentFor = 0;
          } else if (heardSpeech) {
            silentFor += dt;
          }
          const elapsed = now - started;
          if ((heardSpeech && silentFor > 1400) || elapsed > 12000) {
            source.disconnect();
            void ctx.close();
            stopRecording();
            return;
          }
          raf = requestAnimationFrame(watch);
        };
        raf = requestAnimationFrame(watch);
        // cleanup if external stop
        const prev = mediaRef.current;
        if (prev) {
          const orig = prev.onstop;
          // keep onstop; cancel raf when stream ends via stopRecording
          void raf;
          void orig;
        }
      }
    },
    [ready, runTurn, stopRecording],
  );

  startRecordingRef.current = startRecording;

  const sendText = async () => {
    const q = text.trim();
    if (!q || busy || !ready) return;
    setText("");
    await runTurn(() => window.airy.textTurn(q));
  };

  // Clap wake (P1)
  useEffect(() => {
    if (!ready || !clapEnabled) {
      clapRef.current?.stop();
      clapRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const handle = await startClapWake({
          isActive: () =>
            !busyRef.current && !recordingRef.current && !speakingRef.current,
          onLevel: (lv) => {
            if (!recordingRef.current && !speakingRef.current) setLevel(lv * 0.35);
          },
          onWake: () => {
            setHint("2 palmas! Abrindo escuta…");
            void startRecordingRef.current({ autoStopSilence: true });
          },
        });
        if (cancelled) handle.stop();
        else clapRef.current = handle;
      } catch (e) {
        setError(`Mic (palmas): ${(e as Error).message}`);
        setClapEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
      clapRef.current?.stop();
      clapRef.current = null;
    };
  }, [ready, clapEnabled]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      if (recording) stopRecording();
      else void startRecording();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="app">
      <div className="stage" data-state={orb}>
        <div className="hud">
          <h1>Airy</h1>
          <div className="tagline">assessor de voz · Ribeirão Preto</div>
          <div className="status">
            <span className="dot" />
            {!ready && !bootError && !demo && "conectando…"}
            {demo && !ready && `demo · ${orb}`}
            {ready && orb}
            {bootError && !demo && "offline"}
          </div>
        </div>
        <Orb state={orb} level={level} />
      </div>

      <div className="panel">
        <div className="transcript">
          {turn?.userText ? <div className="user">Você: {turn.userText}</div> : null}
          {turn?.assistantText ? (
            <div className="assistant">Airy: {turn.assistantText}</div>
          ) : (
            <div className="user">Espaço = push-to-talk · 2 palmas = wake · ou digite abaixo.</div>
          )}
          {turn?.toolTrace?.length ? (
            <div className="tools">tools: {turn.toolTrace.join(" → ")}</div>
          ) : null}
        </div>

        <div className="controls">
          <input
            value={text}
            placeholder="Pergunte sobre Ribeirão, CABS, PIB… ou diga para abrir o Radar"
            disabled={!ready || busy}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void sendText();
            }}
          />
          <button disabled={!ready || busy || !text.trim()} onClick={() => void sendText()}>
            Enviar
          </button>
          <button
            className={`secondary ${recording ? "recording" : ""}`}
            disabled={!ready || busy}
            onClick={() => (recording ? stopRecording() : void startRecording())}
          >
            {recording ? "Parar" : "Falar"}
          </button>
          <button
            className="secondary"
            disabled={!ready}
            onClick={() => setClapEnabled((v) => !v)}
            title="Wake por 2 palmas"
          >
            {clapEnabled ? "Palmas: on" : "Palmas: off"}
          </button>
          <button
            className={demo ? "active-demo" : "secondary"}
            onClick={() => {
              setDemo((v) => !v);
              if (demo) {
                setOrb("idle");
                setLevel(0);
              }
            }}
            title="Ciclo visual da orbe"
          >
            {demo ? "Orbe demo: on" : "Orbe demo"}
          </button>
        </div>
        <div className="hint">{hint}</div>
        {bootError ? <div className="error">Boot: {bootError}</div> : null}
        {error ? <div className="error">{error}</div> : null}
      </div>
    </div>
  );
}

function pickMime(): string {
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return "audio/webm;codecs=opus";
  }
  if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
    return "audio/ogg;codecs=opus";
  }
  return "audio/webm";
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
