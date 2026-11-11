/** Speech-to-text via ElevenLabs Scribe (speech-to-text API). */

export type SttConfig = {
  apiKey: string;
};

/**
 * Transcreve áudio (webm/wav/mp3) para texto PT-BR.
 * Docs: POST /v1/speech-to-text
 */
export async function transcribeAudio(
  audio: Buffer,
  filename: string,
  cfg: SttConfig,
): Promise<string> {
  const form = new FormData();
  const bytes = new Uint8Array(audio);
  const blob = new Blob([bytes], { type: guessMime(filename) });
  form.append("file", blob, filename);
  form.append("model_id", "scribe_v1");
  form.append("language_code", "pt");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": cfg.apiKey,
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs STT ${res.status}: ${err.slice(0, 400)}`);
  }

  const data = (await res.json()) as { text?: string };
  return (data.text || "").trim();
}

function guessMime(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".webm")) return "audio/webm";
  return "application/octet-stream";
}
