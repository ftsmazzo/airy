import { useCallback, useEffect, useRef, useState } from "react";
import { Orb, type OrbState } from "./components/Orb";
import { SetupSheet } from "./components/SetupSheet";
import { startClapWake, type ClapWakeHandle } from "./lib/clapWake";
import { startNameWake, type NameWakeHandle } from "./lib/nameWake";
import { parseWakeUtterance } from "./lib/wakePhrase";
import type { AirySettingsView } from "./vite-env";

type Turn = {
  userText: string;
  assistantText: string;
  toolTrace: string[];
};

type Session = "dormant" | "listening" | "busy";

const DORMANT_CAPTION =
  'Dormindo · diga “Airy …” · ou Espaço / 2 palmas';

export function App() {
  const [orb, setOrb] = useState<OrbState>("idle");
  const [level, setLevel] = useState(0);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [session, setSession] = useState<Session>("dormant");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [settings, setSettings] = useState<AirySettingsView | null>(null);
  const [text, setText] = useState("");
  const [turn, setTurn] = useState<Turn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState(DORMANT_CAPTION);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clapRef = useRef<ClapWakeHandle | null>(null);
  const nameWakeRef = useRef<NameWakeHandle | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef<Session>("dormant");
  const discardRef = useRef(false);
  const speakingRef = useRef(false);
  const settingsRef = useRef<AirySettingsView | null>(null);
  const enrollModeRef = useRef(false);
  /** Bloqueia wake por um tempo após dormir — evita oscilação. */
  const clapArmedAtRef = useRef(0);
  /** Uma re-escuta se o 1º trecho vier vazio (Espaço “parece” que dormiu). */
  const listenRetryRef = useRef(false);
  const startListeningRef = useRef<() => Promise<void>>(async () => {});
  const stopListeningRef = useRef<(opts?: { discard?: boolean; reason?: string }) => void>(
    () => {},
  );
  const runTurnRef = useRef<(
    fn: () => Promise<{
      userText: string;
      assistantText: string;
      audioBase64: string | null;
      toolTrace: string[];
    }>,
  ) => Promise<void>>(async () => {});

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const goDormant = useCallback((msg = DORMANT_CAPTION) => {
    setSession("dormant");
    setOrb("idle");
    setLevel(0);
    setCaption(msg);
    clapArmedAtRef.current = performance.now() + 1800;
  }, []);

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
        if (r.settings) setSettings(r.settings as AirySettingsView);
        if (r.needsSetup || !r.ok) {
          setBootError(r.error || "Configure as keys uma vez");
          setSetupOpen(true);
          return;
        }
        setReady(true);
        setBootError(null);
        const named = Boolean((r.settings as AirySettingsView | undefined)?.ownerName?.trim());
        goDormant(
          named
            ? DORMANT_CAPTION
            : "Dormindo · 2 palmas — na 1ª vez peço seu nome",
        );
      } catch (e) {
        if (!cancelled) {
          setBootError((e as Error).message);
          setSetupOpen(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [goDormant]);

  const stopSpeech = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    speakingRef.current = false;
  }, []);

  const playAudio = useCallback(
    async (b64: string | null) => {
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
      audioRef.current = null;
      speakingRef.current = false;
    },
    [],
  );

  const runTurn = useCallback(
    async (fn: () => Promise<{
      userText: string;
      assistantText: string;
      audioBase64: string | null;
      toolTrace: string[];
    }>) => {
      setSession("busy");
      setError(null);
      setOrb("thinking");
      setCaption("Pensando…");
      let stopped = false;
      try {
        const res = await fn();
        setTurn({
          userText: res.userText,
          assistantText: res.assistantText,
          toolTrace: res.toolTrace,
        });
        setCaption(res.assistantText || "Pronto.");
        stopped = res.toolTrace.includes("session_stop");
        await playAudio(res.audioBase64);
      } catch (e) {
        setError((e as Error).message);
        goDormant("Falha · tente de novo com palmas");
        return;
      }
      goDormant(
        stopped ? "Dormindo · chame Airy quando quiser" : DORMANT_CAPTION,
      );
    },
    [goDormant, playAudio],
  );

  runTurnRef.current = runTurn;

  const stopListening = useCallback(
    (opts?: { discard?: boolean; reason?: string }) => {
      const rec = mediaRef.current;
      if (!rec || rec.state === "inactive") {
        if (speakingRef.current) {
          stopSpeech();
          goDormant(opts?.reason || "Parei.");
        }
        return;
      }
      discardRef.current = Boolean(opts?.discard);
      setCaption(
        opts?.reason ||
          (opts?.discard ? "Cancelado" : "Processando o que ouvi…"),
      );
      try {
        rec.stop();
      } catch (e) {
        setError((e as Error).message);
        goDormant("Falha ao parar o microfone");
      }
    },
    [goDormant, stopSpeech],
  );

  const startListening = useCallback(async () => {
    if (!ready) return;
    if (sessionRef.current === "busy") return;
    if (sessionRef.current === "listening") return;
    if (speakingRef.current) return;

    const needsName = !settingsRef.current?.ownerName?.trim();
    enrollModeRef.current = needsName;

    // 1ª vez sem nome: pergunta antes de gravar a resposta
    if (needsName && window.airy?.speak) {
      setSession("busy");
      setOrb("speaking");
      setCaption("Oi! Qual é o seu nome?");
      try {
        const { audioBase64 } = await window.airy.speak(
          "Oi! Qual é o seu nome?",
        );
        await playAudio(audioBase64);
      } catch {
        /* segue mesmo sem TTS */
      }
    }

    discardRef.current = false;
    setError(null);
    setSession("listening");
    setOrb("listening");
    setCaption(
      needsName
        ? "Diga seu nome… Espaço envia · Esc cancela"
        : "Ouvindo… Espaço envia · Esc cancela",
    );

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setError((e as Error).message);
      goDormant("Sem microfone — permita o mic nas configurações do Windows");
      return;
    }

    const mime = pickMime();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      setError((e as Error).message);
      goDormant("Gravação de áudio indisponível neste PC");
      return;
    }
    chunksRef.current = [];
    mediaRef.current = rec;

    rec.ondataavailable = (ev) => {
      if (ev.data.size) chunksRef.current.push(ev.data);
    };

    rec.onerror = () => {
      setError("Erro no gravador de áudio");
      goDormant("Falha no microfone · tente de novo");
    };

    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      mediaRef.current = null;
      const discard = discardRef.current;
      const enrolling = enrollModeRef.current;
      discardRef.current = false;
      enrollModeRef.current = false;
      if (discard) {
        listenRetryRef.current = false;
        goDormant(DORMANT_CAPTION);
        return;
      }
      try {
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        if (blob.size < 800) {
          if (!enrolling && !listenRetryRef.current) {
            listenRetryRef.current = true;
            sessionRef.current = "dormant";
            setSession("dormant");
            setCaption("Ainda ouvindo… pode falar");
            void startListeningRef.current();
            return;
          }
          listenRetryRef.current = false;
          goDormant(
            enrolling
              ? "Não ouvi o nome · chame Airy de novo"
              : "Não ouvi nada · diga “Airy …” ou Espaço",
          );
          return;
        }
        listenRetryRef.current = false;
        const buf = await blob.arrayBuffer();
        const b64 = bufferToBase64(buf);
        const ext = (rec.mimeType || "").includes("ogg") ? "ogg" : "webm";

        if (enrolling && window.airy?.enrollName) {
          setSession("busy");
          setOrb("thinking");
          setCaption("Anotando seu nome…");
          try {
            const res = await window.airy.enrollName(b64, `audio.${ext}`);
            if (res.settings) setSettings(res.settings);
            setTurn({
              userText: res.userText,
              assistantText: res.assistantText,
              toolTrace: res.ok ? ["enroll_name"] : ["enroll_name_retry"],
            });
            setCaption(res.assistantText);
            await playAudio(res.audioBase64);
            if (res.ok) {
              goDormant(DORMANT_CAPTION);
            } else {
              goDormant("Dormindo · 2 palmas para repetir o nome");
            }
          } catch (e) {
            setError((e as Error).message);
            goDormant("Falha ao gravar nome · tente de novo");
          }
          return;
        }

        await runTurn(() => window.airy!.voiceTurn(b64, `audio.${ext}`));
      } catch (e) {
        setError((e as Error).message);
        goDormant("Falha ao processar áudio · tente de novo");
      }
    };

    try {
      rec.start(250);
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      mediaRef.current = null;
      setError((e as Error).message);
      goDormant("Não consegui iniciar a gravação");
      return;
    }
    setLevel(0.25);

    const ctx = new AudioContext();
    try {
      if (ctx.state === "suspended") await ctx.resume();
    } catch {
      /* segue com timeout */
    }
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    // Mais curto no instalado: AudioContext às vezes falha em detectar silêncio
    const MIN_MS = 1200;
    const SILENCE_MS = 1600;
    const MAX_MS = 16000;
    const SPEECH_THRESH = 0.03;
    const started = performance.now();
    let heardSpeech = false;
    let silentFor = 0;
    let last = performance.now();

    const watch = () => {
      if (sessionRef.current !== "listening" || mediaRef.current !== rec) {
        try {
          source.disconnect();
        } catch {
          /* ok */
        }
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
      const elapsed = now - started;
      if (energy > SPEECH_THRESH) {
        heardSpeech = true;
        silentFor = 0;
      } else if (heardSpeech && elapsed >= MIN_MS) {
        silentFor += dt;
      }
      const silenceDone =
        heardSpeech && silentFor > SILENCE_MS && elapsed >= MIN_MS;
      const timedOut = elapsed > MAX_MS;
      if (silenceDone || timedOut) {
        try {
          source.disconnect();
        } catch {
          /* ok */
        }
        void ctx.close();
        if (mediaRef.current === rec && rec.state !== "inactive") {
          setCaption(timedOut ? "Tempo esgotado — processando…" : "Processando…");
          try {
            rec.stop();
          } catch (e) {
            setError((e as Error).message);
            goDormant("Falha ao parar o microfone");
          }
        }
        return;
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  }, [goDormant, playAudio, ready, runTurn, stopListening, stopSpeech]);

  startListeningRef.current = startListening;
  stopListeningRef.current = stopListening;

  // Palmas: backup — só acordar quando dormindo
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    clapArmedAtRef.current = performance.now() + 1200;
    (async () => {
      try {
        const handle = await startClapWake({
          isActive: () =>
            sessionRef.current === "dormant" &&
            !speakingRef.current &&
            performance.now() >= clapArmedAtRef.current,
          onLevel: (lv) => {
            if (sessionRef.current === "dormant") setLevel(lv * 0.12);
          },
          onWake: () => {
            if (sessionRef.current !== "dormant" || speakingRef.current) return;
            if (performance.now() < clapArmedAtRef.current) return;
            listenRetryRef.current = false;
            void startListeningRef.current();
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

  // Pasta vigiada: arquivo novo → caption (+ resumo PDF se ligado nos Ajustes)
  useEffect(() => {
    if (!ready || !window.airy?.onInboxFile) return;
    return window.airy.onInboxFile((payload) => {
      setCaption(`Inbox · entrou ${payload.name}`);
      if (
        payload.autoSummarizePdf &&
        payload.name.toLowerCase().endsWith(".pdf") &&
        sessionRef.current === "dormant" &&
        !speakingRef.current
      ) {
        void runTurnRef.current(() =>
          window.airy!.textTurn(
            `Resuma este PDF agora (caminho: ${payload.path}). Use summarize_pdf.`,
          ),
        );
      }
    });
  }, [ready]);

  // Wake por nome: “Airy, abre o radar” / “faz isso Airy” (passivo, só dormindo)
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const handle = await startNameWake({
          isArmed: () =>
            sessionRef.current === "dormant" &&
            !speakingRef.current &&
            performance.now() >= clapArmedAtRef.current,
          onLevel: (lv) => {
            if (sessionRef.current === "dormant") setLevel(lv * 0.1);
          },
          onUtterance: async (b64, filename) => {
            if (!window.airy?.transcribe) return;
            if (sessionRef.current !== "dormant" || speakingRef.current) return;
            try {
              const { text } = await window.airy.transcribe(b64, filename);
              const wake = parseWakeUtterance(text);
              if (!wake.hit) return;
              if (sessionRef.current !== "dormant") return;

              const needsName = !settingsRef.current?.ownerName?.trim();
              if (needsName || !wake.command) {
                listenRetryRef.current = false;
                void startListeningRef.current();
                return;
              }
              await runTurnRef.current(() =>
                window.airy!.textTurn(wake.command),
              );
            } catch (e) {
              setError(`Wake: ${(e as Error).message}`);
            }
          },
        });
        if (cancelled) handle.stop();
        else nameWakeRef.current = handle;
      } catch (e) {
        setError(`Mic wake: ${(e as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
      nameWakeRef.current?.stop();
      nameWakeRef.current = null;
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
      if (e.code === "Comma" && !e.metaKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setSetupOpen(true);
        return;
      }
      if (e.code === "Escape") {
        setSheetOpen(false);
        setSetupOpen(false);
        if (sessionRef.current === "listening" || speakingRef.current) {
          stopListeningRef.current({ discard: true, reason: "Parei." });
          goDormant(DORMANT_CAPTION);
        }
        return;
      }
      if (e.code !== "Space" || e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      // Espaço = push-to-talk: dormindo → ouve; ouvindo → envia
      if (sessionRef.current === "listening") {
        stopListeningRef.current({
          discard: false,
          reason: "Processando o que ouvi…",
        });
        return;
      }
      if (sessionRef.current !== "dormant") return;
      listenRetryRef.current = false;
      void startListeningRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goDormant]);

  const sendText = async () => {
    const q = text.trim();
    if (!q || !ready || sessionRef.current === "busy") return;
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
            {ready && session === "dormant" && "dormindo"}
            {ready && session === "listening" && "ouvindo"}
            {ready && session === "busy" && orb}
          </div>
        </div>

        <Orb state={orb} level={level} />

        <div className="caption">
          <p className="line">{caption}</p>
          {turn?.userText ? <p className="sub">Você: {turn.userText}</p> : null}
        </div>

        <div className="hint-bar">
          Espaço ouve / Espaço envia · “airy …” · esc cancela · , ajustes
        </div>
      </div>

      {(bootError || error) && !setupOpen && (
        <div className="error-toast">{bootError || error}</div>
      )}

      <SetupSheet
        open={setupOpen}
        initial={settings}
        onClose={() => setSetupOpen(false)}
        onSaved={(s) => {
          setSettings(s);
          setReady(s.configured);
          setBootError(null);
          setSetupOpen(false);
          goDormant(DORMANT_CAPTION);
        }}
      />

      <div className={`sheet ${sheetOpen ? "open" : ""}`}>
        <div className="row">
          <input
            value={text}
            placeholder="Texto opcional…"
            disabled={!ready || session === "busy"}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void sendText();
            }}
          />
          <button
            disabled={!ready || session === "busy" || !text.trim()}
            onClick={() => void sendText()}
          >
            Enviar
          </button>
        </div>
        <div className="meta">Tecla , abre ajustes (keys no cofre do SO)</div>
      </div>
    </div>
  );
}

function pickMime(): string {
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return "audio/webm;codecs=opus";
  }
  if (MediaRecorder.isTypeSupported("audio/webm")) {
    return "audio/webm";
  }
  if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
    return "audio/ogg;codecs=opus";
  }
  return "";
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
