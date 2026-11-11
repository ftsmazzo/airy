/**
 * Wake por 2 palmas — wrapper browser sobre @airy/voice/clap.
 */
import {
  createClapState,
  feedClapEnergy,
  rmsFromTimeDomain,
  DEFAULT_CLAP_CONFIG,
  type ClapConfig,
} from "@airy/voice";

export type ClapWakeHandle = {
  stop: () => void;
};

export async function startClapWake(opts: {
  onWake: () => void;
  isActive: () => boolean;
  onLevel?: (level: number) => void;
  config?: Partial<ClapConfig>;
}): Promise<ClapWakeHandle> {
  const cfg = { ...DEFAULT_CLAP_CONFIG, ...opts.config };
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      // AGC no Mac infla picos e gera “palmas” falsas → loop acorda/dorme
      autoGainControl: false,
    },
  });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  const state = createClapState();
  let raf = 0;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    analyser.getByteTimeDomainData(data);
    const energy = rmsFromTimeDomain(data);
    opts.onLevel?.(Math.min(1, energy * 4));

    if (opts.isActive()) {
      const woke = feedClapEnergy(state, energy, performance.now(), cfg);
      if (woke) opts.onWake();
    }

    raf = requestAnimationFrame(tick);
  };
  tick();

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      source.disconnect();
      void ctx.close();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
