import { useCallback, useEffect, useRef, useState } from "react";
import { Orb, type OrbState } from "./components/Orb";

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
  const [text, setText] = useState("");
  const [turn, setTurn] = useState<Turn | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await window.airy.ready();
        if (cancelled) return;
        if (!r.ok) {
          setBootError(r.error || "Falha ao iniciar agente");
          return;
        }
        setReady(true);
      } catch (e) {
        if (!cancelled) setBootError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const playAudio = useCallback(async (b64: string | null) => {
    if (!b64) return;
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

  const sendText = async () => {
    const q = text.trim();
    if (!q || busy || !ready) return;
    setText("");
    await runTurn(() => window.airy.textTurn(q));
  };

  const startRecording = async () => {
    if (busy || recording || !ready) return;
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
      await runTurn(() => window.airy.voiceTurn(b64, `audio.${ext}`));
    };
    mediaRef.current = rec;
    rec.start();
    setRecording(true);
    setOrb("listening");
    setLevel(0.2);
  };

  const stopRecording = () => {
    const rec = mediaRef.current;
    if (!rec || rec.state === "inactive") return;
    rec.stop();
    setRecording(false);
    setLevel(0);
  };

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
      <div className="stage">
        <div className="hud">
          <h1>Airy</h1>
          <div className="status">
            {!ready && !bootError && "conectando MCP…"}
            {bootError && "offline"}
            {ready && orb}
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
            <div className="user">Segure a conversa por voz (Espaço) ou digite abaixo.</div>
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
        </div>
        <div className="hint">
          Push-to-talk: tecla Espaço. Desktop: Radar Municipal, YouTube, Spotify.
        </div>
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
