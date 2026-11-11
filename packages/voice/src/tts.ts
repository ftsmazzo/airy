/** Text-to-speech via ElevenLabs. */

export type TtsConfig = {
  apiKey: string;
  voiceId: string;
  modelId?: string;
};

/**
 * Sintetiza fala PT-BR e devolve MP3 buffer.
 */
export async function synthesizeSpeech(
  text: string,
  cfg: TtsConfig,
): Promise<Buffer> {
  const voiceId = cfg.voiceId;
  if (!voiceId) throw new Error("ELEVENLABS_VOICE_ID não definido");

  const model = cfg.modelId || "eleven_multilingual_v2";
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": cfg.apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: text.slice(0, 4500),
      model_id: model,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.2,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs TTS ${res.status}: ${err.slice(0, 400)}`);
  }

  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
