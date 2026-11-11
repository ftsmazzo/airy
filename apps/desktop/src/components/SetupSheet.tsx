import { useEffect, useState } from "react";
import type { AirySettingsView } from "../vite-env";

type Props = {
  open: boolean;
  initial?: AirySettingsView | null;
  onClose: () => void;
  onSaved: (settings: AirySettingsView) => void;
};

export function SetupSheet({ open, initial, onClose, onSaved }: Props) {
  const [ownerName, setOwnerName] = useState("");
  const [radarUrl, setRadarUrl] = useState("");
  const [openrouterModel, setOpenrouterModel] = useState(
    "anthropic/claude-haiku-5.5",
  );
  const [elevenVoiceId, setElevenVoiceId] = useState("");
  const [openrouterApiKey, setOpenrouterApiKey] = useState("");
  const [elevenApiKey, setElevenApiKey] = useState("");
  const [mcpToken, setMcpToken] = useState("");
  const [inboxEnabled, setInboxEnabled] = useState(true);
  const [inboxPath, setInboxPath] = useState("");
  const [inboxAutoSummarizePdf, setInboxAutoSummarizePdf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<AirySettingsView | null>(initial || null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const s = initial || (await window.airy?.getSettings());
      if (!s) return;
      setView(s);
      setOwnerName(s.ownerName || "");
      setRadarUrl(s.radarUrl || "");
      setOpenrouterModel(s.openrouterModel || "anthropic/claude-haiku-5.5");
      setElevenVoiceId(s.elevenVoiceId || "");
      setOpenrouterApiKey("");
      setElevenApiKey("");
      setMcpToken("");
      setInboxEnabled(s.inboxEnabled !== false);
      const fallback =
        s.inboxPath ||
        (await window.airy?.defaultInboxPath?.()) ||
        "";
      setInboxPath(fallback);
      setInboxAutoSummarizePdf(Boolean(s.inboxAutoSummarizePdf));
      setMsg(
        s.encryption
          ? "Keys ficam no cofre do Mac/Windows (não no Git)."
          : "Cofre do SO indisponível — ainda assim só local neste PC.",
      );
    })();
  }, [open, initial]);

  const pickInbox = async () => {
    const res = await window.airy?.pickFolder?.();
    if (res?.ok) setInboxPath(res.path);
  };

  const save = async () => {
    if (!window.airy?.saveSettings) return;
    setBusy(true);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        ownerName,
        radarUrl,
        openrouterModel: openrouterModel.trim() || "anthropic/claude-haiku-5.5",
        elevenVoiceId,
        inboxEnabled,
        inboxPath: inboxPath.trim(),
        inboxAutoSummarizePdf,
      };
      if (openrouterApiKey.trim()) payload.openrouterApiKey = openrouterApiKey.trim();
      if (elevenApiKey.trim()) payload.elevenApiKey = elevenApiKey.trim();
      if (mcpToken.trim()) payload.mcpToken = mcpToken.trim();

      const res = await window.airy.saveSettings(payload);
      if (!res.ok) {
        setMsg(res.error || "Falha ao salvar");
        return;
      }
      setView(res.settings || null);
      setMsg("Salvo. Pode usar a voz.");
      if (res.settings) onSaved(res.settings);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="setup-backdrop" onClick={onClose}>
      <div className="setup-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Ajustes Airy</h2>
        <p className="setup-lead">
          Assistente pessoal neste PC. Segredos no Keychain/DPAPI. MCP continua
          disponível quando você pedir dados públicos.
        </p>

        <label>
          Seu nome (editável — ou deixe vazio p/ ela perguntar na 1ª vez)
          <input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Fred"
          />
        </label>
        <label>
          URL Radar Municipal
          <input value={radarUrl} onChange={(e) => setRadarUrl(e.target.value)} />
        </label>
        <label>
          Modelo OpenRouter (barato + tools)
          <select
            value={openrouterModel}
            onChange={(e) => setOpenrouterModel(e.target.value)}
          >
            <option value="anthropic/claude-haiku-5.5">
              Haiku 5.5 — recomendado (~30× mais barato que Sonnet)
            </option>
            <option value="openai/gpt-4o-mini">GPT-4o mini — barato e estável</option>
            <option value="google/gemini-2.5-flash-lite">
              Gemini 2.5 Flash Lite — o mais barato
            </option>
            <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="anthropic/claude-sonnet-4.5">
              Sonnet 4.5 — caro (só se precisar)
            </option>
          </select>
        </label>

        <fieldset className="setup-fieldset">
          <legend>Pasta vigiada</legend>
          <label className="setup-check">
            <input
              type="checkbox"
              checked={inboxEnabled}
              onChange={(e) => setInboxEnabled(e.target.checked)}
            />
            Avisar quando entrar arquivo novo
          </label>
          <div className="setup-path-row">
            <input
              value={inboxPath}
              readOnly
              placeholder="Escolha a pasta…"
              title={inboxPath}
            />
            <button type="button" className="ghost" onClick={() => void pickInbox()}>
              Escolher pasta…
            </button>
          </div>
          <label className="setup-check">
            <input
              type="checkbox"
              checked={inboxAutoSummarizePdf}
              onChange={(e) => setInboxAutoSummarizePdf(e.target.checked)}
              disabled={!inboxEnabled}
            />
            Resumir PDF automaticamente (gasta API)
          </label>
        </fieldset>

        <label>
          ElevenLabs Voice ID
          <input value={elevenVoiceId} onChange={(e) => setElevenVoiceId(e.target.value)} />
        </label>
        <label>
          OpenRouter API Key {view?.hasOpenrouterApiKey ? "(já salva — cole de novo se der 401)" : ""}
          <input
            type="password"
            autoComplete="off"
            value={openrouterApiKey}
            onChange={(e) => setOpenrouterApiKey(e.target.value)}
            placeholder={view?.hasOpenrouterApiKey ? "sk-or-v1-…" : "sk-or-v1-…"}
          />
        </label>
        <label>
          ElevenLabs API Key {view?.hasElevenApiKey ? "(já salva)" : ""}
          <input
            type="password"
            autoComplete="off"
            value={elevenApiKey}
            onChange={(e) => setElevenApiKey(e.target.value)}
            placeholder={view?.hasElevenApiKey ? "••••••••" : ""}
          />
        </label>
        <label>
          MCP Token {view?.hasMcpToken ? "(já salvo)" : ""}
          <input
            type="password"
            autoComplete="off"
            value={mcpToken}
            onChange={(e) => setMcpToken(e.target.value)}
            placeholder={view?.hasMcpToken ? "••••••••" : ""}
          />
        </label>

        {msg ? <p className="setup-msg">{msg}</p> : null}
        {view?.path ? <p className="setup-path">{view.path}</p> : null}

        <div className="setup-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Fechar
          </button>
          <button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
