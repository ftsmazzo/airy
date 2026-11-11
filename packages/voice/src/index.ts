export { transcribeAudio } from "./stt.js";
export type { SttConfig } from "./stt.js";
export { synthesizeSpeech } from "./tts.js";
export type { TtsConfig } from "./tts.js";
export {
  createClapState,
  feedClapEnergy,
  rmsFromTimeDomain,
  DEFAULT_CLAP_CONFIG,
} from "./clap.js";
export type { ClapConfig, ClapDetectorState } from "./clap.js";
