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
  const [assistantName, setAssistantName] = useState("Airy");
  const [installToken, setInstallToken] = useState("");
  const [radarUrl, setRadarUrl] = useState("");
  const [openrouterModel, setOpenrouterModel] = useState(
    "anthropic/claude-haiku-5.5",
  );
  const [elevenVoiceId, setElevenVoiceId] = useState("");
  const [voiceCatalog, setVoiceCatalog] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [openrouterApiKey, setOpenrouterApiKey] = useState("");
  const [elevenApiKey, setElevenApiKey] = useState("");
  const [mcpToken, setMcpToken] = useState("");
  const [inboxEnabled, setInboxEnabled] = useState(true);
  const [inboxPath, setInboxPath] = useState("");
  const [inboxAutoSummarizePdf, setInboxAutoSummarizePdf] = useState(false);
  const [showManualKeys, setShowManualKeys] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<AirySettingsView | null>(initial || null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const s = initial || (await window.airy?.getSettings());
      if (!s) return;
      setView(s);
      setOwnerName(s.ownerName || "");
      setAssistantName(s.assistantName || "Airy");
      setRadarUrl(s.radarUrl || "");
      setOpenrouterModel(s.openrouterModel || "anthropic/claude-haiku-5.5");
      setElevenVoiceId(s.elevenVoiceId || "");
      setVoiceCatalog(Array.isArray(s.voiceCatalog) ? s.voiceCatalog : []);
      setOpenrouterApiKey("");
      setElevenApiKey("");
      setMcpToken("");
      setInstallToken("");
      setInboxEnabled(s.inboxEnabled !== false);
      const fallback =
        s.inboxPath ||
        (await window.airy?.defaultInboxPath?.()) ||
        "";
      setInboxPath(fallback);
      setInboxAutoSummarizePdf(Boolean(s.inboxAutoSummarizePdf));
      setShowManualKeys(!s.configured);
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

  const activateToken = async () => {
    if (!window.airy?.redeemToken) {
      setMsg("Atualize o app — redeem indisponível.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await window.airy.redeemToken(installToken.trim());
      if (!res.ok) {
        setMsg(res.error || "Token recusado");
        setShowManualKeys(true);
        return;
      }
      setInstallToken("");
      setView(res.settings || null);
      if (res.settings?.voiceCatalog) setVoiceCatalog(res.settings.voiceCatalog);
      if (res.settings?.elevenVoiceId) setElevenVoiceId(res.settings.elevenVoiceId);
      setMsg("Pronto. Pode falar com a Airy.");
      if (res.settings) onSaved(res.settings);
    } catch (e) {
      setMsg((e as Error).message);
      setShowManualKeys(true);
    } finally {
      setBusy(false);
    }
  };

  const previewVoice = async () => {
    if (!window.airy?.speak || !elevenVoiceId.trim()) return;
    setPreviewBusy(true);
    setMsg(null);
    try {
      const { audioBase64 } = await window.airy.speak(
        "Olá. Assim eu falo com você.",
        { voiceId: elevenVoiceId.trim() },
      );
      const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
      await audio.play();
      setMsg("Preview tocado — Salvar para usar esta voz.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setPreviewBusy(false);
    }
  };

  const save = async () => {
    if (!window.airy?.saveSettings) return;
    setBusy(true);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        ownerName,
        assistantName: assistantName.trim() || "Airy",
        radarUrl,
        openrouterModel: openrouterModel.trim() || "anthropic/claude-haiku-5.5",
        elevenVoiceId,
        voiceCatalog,
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

  const needsCreds = !view?.configured;

  return (
    <div className="setup-backdrop" onClick={needsCreds ? undefined : onClose}>
      <div className="setup-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{needsCreds ? "Começar com a Airy" : "Ajustes Airy"}</h2>
        <p className="setup-lead">
          {needsCreds
            ? "Cole o token de instalação que você recebeu. Segredos ficam no cofre deste PC."
            : "Assistente neste PC. Segredos no Keychain/DPAPI."}
        </p>

        <fieldset className="setup-fieldset">
          <legend>Token de instalação</legend>
          <label>
            Token
            <input
              type="password"
              autoComplete="off"
              value={installToken}
              onChange={(e) => setInstallToken(e.target.value)}
              placeholder="Cole aqui o token…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && installToken.trim()) void activateToken();
              }}
            />
          </label>
          <div className="setup-actions" style={{ marginTop: 0 }}>
            <button
              type="button"
              disabled={busy || !installToken.trim()}
              onClick={() => void activateToken()}
            >
              {busy ? "Ativando…" : "Ativar"}
            </button>
          </div>
          <button
            type="button"
            className="setup-linkish"
            onClick={() => setShowManualKeys((v) => !v)}
          >
            {showManualKeys ? "Ocultar chaves manuais" : "Prefiro colar as chaves"}
          </button>
        </fieldset>

        <label>
          Nome da IA
          <input
            value={assistantName}
            onChange={(e) => setAssistantName(e.target.value)}
            placeholder="Airy"
          />
        </label>
        <label>
          Seu nome (como a IA te chama)
          <input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Fred"
          />
        </label>
        <label>
          URL do Radar / atalho principal
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

        <fieldset className="setup-fieldset">
          <legend>Voz</legend>
          {voiceCatalog.length > 0 ? (
            <label>
              Escolher voz
              <select
                value={elevenVoiceId}
                onChange={(e) => setElevenVoiceId(e.target.value)}
              >
                {voiceCatalog.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label || v.id}
                  </option>
                ))}
                {!voiceCatalog.some((v) => v.id === elevenVoiceId) &&
                elevenVoiceId ? (
                  <option value={elevenVoiceId}>Atual ({elevenVoiceId.slice(0, 8)}…)</option>
                ) : null}
              </select>
            </label>
          ) : (
            <label>
              ElevenLabs Voice ID
              <input
                value={elevenVoiceId}
                onChange={(e) => setElevenVoiceId(e.target.value)}
                placeholder="cole o voice id…"
              />
            </label>
          )}
          <div className="setup-actions" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="ghost"
              disabled={previewBusy || busy || !elevenVoiceId.trim()}
              onClick={() => void previewVoice()}
            >
              {previewBusy ? "Tocando…" : "Preview"}
            </button>
          </div>
        </fieldset>

        {showManualKeys && (
          <>
            <label>
              OpenRouter API Key{" "}
              {view?.hasOpenrouterApiKey ? "(já salva — cole de novo se der 401)" : ""}
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
          </>
        )}

        {msg ? <p className="setup-msg">{msg}</p> : null}
        {view?.path ? <p className="setup-path">{view.path}</p> : null}

        <div className="setup-actions">
          {!needsCreds && (
            <button type="button" className="ghost" onClick={onClose}>
              Fechar
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
