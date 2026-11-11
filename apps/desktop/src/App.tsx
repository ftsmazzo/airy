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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [text, setText] = useState("");
  const [turn, setTurn] = useState<Turn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState("Duas palmas ou Espaço para falar");

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clapRef = useRef<ClapWakeHandle | null>(null);
  const busyRef = useRef(false);
  const recordingRef = useRef(false);
  const speakingRef = useRef(false);
  const startRecordingRef = useRef<(opts?: { autoStopSilence?: boolean }) => Promise<void>>(
    async () => {},
  );

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
        setBootError("Rode npm run dev (Electron). preview:orb é só visual.");
        return;
      }
      try {
        const r = await window.airy.ready();
        if (cancelled) return;
        if (!r.ok) {
          setBootError(r.error || "Falha ao iniciar agente");
          return;
        }
        setReady(true);
        setCaption("Ouvindo palmas · Espaço para falar");
      } catch (e) {
        if (!cancelled) setBootError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const playAudio = useCallback(async (b64: string | null) => {
    if (!b64) {
      setOrb("idle");
      return;
    }
    speakingRef.current = true;
    setOrb("speaking");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

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
    setCaption("Ouvindo palmas · Espaço para falar");
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
      setCaption("Pensando…");
      try {
        const res = await fn();
        setTurn({
          userText: res.userText,
          assistantText: res.assistantText,
          toolTrace: res.toolTrace,
        });
        setCaption(res.assistantText || "Pronto.");
        await playAudio(res.audioBase64);
      } catch (e) {
        setError((e as Error).message);
        setOrb("idle");
        setCaption("Falha na resposta");
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
      const rec = new MediaRecorder(stream, { mimeType: pickMime() });
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        const buf = await blob.arrayBuffer();
        const b64 = bufferToBase64(buf);
        const ext = rec.mimeType.includes("ogg") ? "ogg" : "webm";
        await runTurn(() => window.airy!.voiceTurn(b64, `audio.${ext}`));
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
      setOrb("listening");
      setLevel(0.25);
      setCaption(opts?.autoStopSilence ? "Pode falar…" : "Gravando… Espaço para enviar");

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
          if ((heardSpeech && silentFor > 1200) || now - started > 10000) {
            source.disconnect();
            void ctx.close();
            stopRecording();
            return;
          }
          requestAnimationFrame(watch);
        };
        requestAnimationFrame(watch);
      }
    },
    [ready, runTurn, stopRecording],
  );

  startRecordingRef.current = startRecording;

  // Palmas sempre ativas (produto voz-first)
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const handle = await startClapWake({
          isActive: () =>
            !busyRef.current && !recordingRef.current && !speakingRef.current,
          onLevel: (lv) => {
            if (!recordingRef.current && !speakingRef.current) setLevel(lv * 0.25);
          },
          onWake: () => {
            setCaption("Palmas — pode falar");
            void startRecordingRef.current({ autoStopSilence: true });
          },
        });
        if (cancelled) handle.stop();
        else clapRef.current = handle;
      } catch (e) {
        setError(`Mic: ${(e as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
      clapRef.current?.stop();
      clapRef.current = null;
    };
  }, [ready]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Slash" && !e.metaKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setSheetOpen((v) => !v);
        return;
      }
      if (e.code === "Escape") {
        setSheetOpen(false);
        void window.airy; // noop keep
        return;
      }
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

  const sendText = async () => {
    const q = text.trim();
    if (!q || busy || !ready) return;
    setText("");
    setSheetOpen(false);
    await runTurn(() => window.airy!.textTurn(q));
  };

  return (
    <div className="app">
      <div className="stage" data-state={orb}>
        <div className="hud-top">
          <h1>AIRY</h1>
          <div className="status">
            <span className="dot" />
            {!ready && !bootError && "boot"}
            {bootError && "offline"}
            {ready && orb}
          </div>
        </div>

        <Orb state={orb} level={level} />

        <div className="caption">
          <p className="line">{caption}</p>
          {turn?.userText ? <p className="sub">Você: {turn.userText}</p> : null}
        </div>

        <div className="hint-bar">2 palmas · espaço · / texto</div>
      </div>

      {(bootError || error) && (
        <div className="error-toast">{bootError || error}</div>
      )}

      <div className={`sheet ${sheetOpen ? "open" : ""}`}>
        <div className="row">
          <input
            value={text}
            placeholder="Texto opcional…"
            disabled={!ready || busy}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void sendText();
            }}
          />
          <button disabled={!ready || busy || !text.trim()} onClick={() => void sendText()}>
            Enviar
          </button>
        </div>
        <div className="meta">Esc fecha · uso principal é voz</div>
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
