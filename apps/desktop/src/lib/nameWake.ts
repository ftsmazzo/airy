/**
 * Escuta passiva enquanto dorme: VAD → grava trecho → callback (STT no main).
 * Não deixa a sessão “sempre ativa”; só manda áudio quando há fala.
 */

export type NameWakeHandle = { stop: () => void };

function pickMime(): string {
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return "audio/webm;codecs=opus";
  }
  if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
    return "audio/ogg;codecs=opus";
  }
  return "audio/webm";
}

function rms(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / Math.max(data.length, 1));
}

export async function startNameWake(opts: {
  isArmed: () => boolean;
  onUtterance: (audioBase64: string, filename: string) => void | Promise<void>;
  onLevel?: (level: number) => void;
}): Promise<NameWakeHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
    },
  });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);

  const SPEECH = 0.06;
  const SILENCE_END_MS = 750;
  const MIN_UTTER_MS = 450;
  const MAX_UTTER_MS = 12000;
  const COOLDOWN_MS = 900;

  let stopped = false;
  let raf = 0;
  let rec: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let inSpeech = false;
  let speechStarted = 0;
  let silentFor = 0;
  let last = performance.now();
  let cooldownUntil = 0;
  let busy = false;

  const mime = pickMime();
  const ext = mime.includes("ogg") ? "ogg" : "webm";

  const finishUtterance = async () => {
    const recorder = rec;
    rec = null;
    inSpeech = false;
    silentFor = 0;
    if (!recorder) return;
    busy = true;
    const blob: Blob = await new Promise((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: recorder.mimeType }));
      };
      if (recorder.state !== "inactive") recorder.stop();
      else resolve(new Blob(chunks, { type: recorder.mimeType }));
    });
    chunks = [];
    cooldownUntil = performance.now() + COOLDOWN_MS;
    try {
      if (blob.size >= 900 && opts.isArmed()) {
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        await opts.onUtterance(btoa(binary), `wake.${ext}`);
      }
    } finally {
      busy = false;
    }
  };

  const startRec = () => {
    if (rec || busy || stopped) return;
    chunks = [];
    rec = new MediaRecorder(stream, { mimeType: mime });
    rec.ondataavailable = (ev) => {
      if (ev.data.size) chunks.push(ev.data);
    };
    rec.start(200);
    speechStarted = performance.now();
    inSpeech = true;
    silentFor = 0;
  };

  const tick = () => {
    if (stopped) return;
    analyser.getByteTimeDomainData(data);
    const energy = rms(data);
    opts.onLevel?.(Math.min(1, energy * 3.5));

    const now = performance.now();
    const dt = now - last;
    last = now;

    if (!opts.isArmed() || busy || now < cooldownUntil) {
      if (rec && rec.state !== "inactive") {
        try {
          rec.onstop = null;
          rec.stop();
        } catch {
          /* ignore */
        }
        rec = null;
        chunks = [];
      }
      inSpeech = false;
      silentFor = 0;
      raf = requestAnimationFrame(tick);
      return;
    }

    if (energy >= SPEECH) {
      if (!inSpeech) startRec();
      silentFor = 0;
    } else if (inSpeech) {
      silentFor += dt;
      const elapsed = now - speechStarted;
      if (
        (silentFor >= SILENCE_END_MS && elapsed >= MIN_UTTER_MS) ||
        elapsed >= MAX_UTTER_MS
      ) {
        void finishUtterance();
      }
    }

    raf = requestAnimationFrame(tick);
  };
  tick();

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      try {
        if (rec && rec.state !== "inactive") rec.stop();
      } catch {
        /* ignore */
      }
      source.disconnect();
      void ctx.close();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
