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
  const [elevenVoiceId, setElevenVoiceId] = useState("");
  const [openrouterApiKey, setOpenrouterApiKey] = useState("");
  const [elevenApiKey, setElevenApiKey] = useState("");
  const [mcpToken, setMcpToken] = useState("");
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
      setElevenVoiceId(s.elevenVoiceId || "");
      setOpenrouterApiKey("");
      setElevenApiKey("");
      setMcpToken("");
      setMsg(
        s.encryption
          ? "Keys ficam no cofre do Mac/Windows (não no Git)."
          : "Cofre do SO indisponível — ainda assim só local neste PC.",
      );
    })();
  }, [open, initial]);

  const save = async () => {
    if (!window.airy?.saveSettings) return;
    setBusy(true);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        ownerName,
        radarUrl,
        elevenVoiceId,
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
          Sem banco remoto. Segredos no Keychain/DPAPI deste computador.
          Nome e Radar são preferências locais.
        </p>

        <label>
          Seu nome (editável — ou deixe vazio p/ ela perguntar na 1ª palmada)
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
          ElevenLabs Voice ID
          <input value={elevenVoiceId} onChange={(e) => setElevenVoiceId(e.target.value)} />
        </label>
        <label>
          OpenRouter API Key {view?.hasOpenrouterApiKey ? "(já salva — deixe vazio p/ manter)" : ""}
          <input
            type="password"
            autoComplete="off"
            value={openrouterApiKey}
            onChange={(e) => setOpenrouterApiKey(e.target.value)}
            placeholder={view?.hasOpenrouterApiKey ? "••••••••" : ""}
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
