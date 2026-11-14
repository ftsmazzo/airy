import { useEffect, useState } from "react";
import {
  PACKAGE_CATALOG,
  type PackageId,
} from "@airy/packages-catalog";
import { ToggleSwitch } from "./ToggleSwitch";
import type {
  AiryMcpConnView,
  AirySettingsView,
  AirySkillView,
} from "../vite-env";

type Props = {
  open: boolean;
  initial?: AirySettingsView | null;
  onClose: () => void;
  onSaved: (settings: AirySettingsView) => void;
};

type McpDraft = AiryMcpConnView & { tokenDraft: string };

const ALL_PACKAGE_IDS = PACKAGE_CATALOG.map((p) => p.id);

export function SetupSheet({ open, initial, onClose, onSaved }: Props) {
  const [ownerName, setOwnerName] = useState("");
  const [assistantName, setAssistantName] = useState("Airy");
  const [installToken, setInstallToken] = useState("");
  const [radarUrl, setRadarUrl] = useState("");
  const [radarOpenAsApp, setRadarOpenAsApp] = useState(false);
  const [radarAppName, setRadarAppName] = useState("Radar Municipal");
  const [enabledPackages, setEnabledPackages] = useState<string[]>(ALL_PACKAGE_IDS);
  const [openrouterModel, setOpenrouterModel] = useState(
    "anthropic/claude-haiku-5.5",
  );
  const [synthesisModel, setSynthesisModel] = useState(
    "anthropic/claude-sonnet-4.5",
  );
  const [elevenVoiceId, setElevenVoiceId] = useState("");
  const [voiceCatalog, setVoiceCatalog] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [openrouterApiKey, setOpenrouterApiKey] = useState("");
  const [elevenApiKey, setElevenApiKey] = useState("");
  const [mcpToken, setMcpToken] = useState("");
  const [mcpDrafts, setMcpDrafts] = useState<McpDraft[]>([]);
  const [skills, setSkills] = useState<AirySkillView[]>([]);
  const [enabledSkills, setEnabledSkills] = useState<string[]>([]);
  const [inboxEnabled, setInboxEnabled] = useState(true);
  const [inboxPath, setInboxPath] = useState("");
  const [inboxAutoSummarizePdf, setInboxAutoSummarizePdf] = useState(false);
  const [showManualKeys, setShowManualKeys] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<AirySettingsView | null>(initial || null);
  const [mcpAddOpen, setMcpAddOpen] = useState(false);
  const [mcpForm, setMcpForm] = useState({
    id: "",
    label: "",
    baseUrl: "",
    token: "",
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      const s = initial || (await window.airy?.getSettings());
      if (!s) return;
      setView(s);
      setOwnerName(s.ownerName || "");
      setAssistantName(s.assistantName || "Airy");
      setRadarUrl(s.radarUrl || "");
      setRadarOpenAsApp(Boolean(s.radarOpenAsApp));
      setRadarAppName(s.radarAppName || "Radar Municipal");
      setEnabledPackages(
        Array.isArray(s.enabledPackages) && s.enabledPackages.length
          ? s.enabledPackages
          : ALL_PACKAGE_IDS,
      );
      setOpenrouterModel(s.openrouterModel || "anthropic/claude-haiku-5.5");
      setSynthesisModel(s.synthesisModel || "anthropic/claude-sonnet-4.5");
      setElevenVoiceId(s.elevenVoiceId || "");
      setVoiceCatalog(Array.isArray(s.voiceCatalog) ? s.voiceCatalog : []);
      setOpenrouterApiKey("");
      setElevenApiKey("");
      setMcpToken("");
      setInstallToken("");
      const conns =
        Array.isArray(s.mcpConnections) && s.mcpConnections.length
          ? s.mcpConnections
          : [
              {
                id: "ie-dados",
                label: "ie-dados",
                baseUrl: s.mcpBaseUrl || "https://ie-dados-mcp.kxryyk.easypanel.host",
                enabled: true,
                hasToken: Boolean(s.hasMcpToken),
              },
            ];
      setMcpDrafts(conns.map((c) => ({ ...c, tokenDraft: "" })));
      setEnabledSkills(Array.isArray(s.enabledSkills) ? s.enabledSkills : []);
      try {
        const listed = await window.airy?.listSkills?.();
        if (listed) setSkills(listed);
      } catch {
        setSkills([]);
      }
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

  const mcpOnline = (id: string): "online" | "offline" | "unknown" => {
    const c = view?.mcp?.connections?.find((x) => x.id === id);
    if (!c) return "unknown";
    return c.ok ? "online" : "offline";
  };

  const addMcpManual = () => {
    const id = mcpForm.id.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
    const baseUrl = mcpForm.baseUrl.trim().replace(/\/$/, "");
    if (!id || !baseUrl) {
      setMsg("MCP precisa de id e URL.");
      return;
    }
    setMcpDrafts((prev) => {
      const rest = prev.filter((p) => p.id !== id);
      return [
        ...rest,
        {
          id,
          label: mcpForm.label.trim() || id,
          baseUrl,
          enabled: true,
          hasToken: Boolean(mcpForm.token.trim()),
          tokenDraft: mcpForm.token.trim(),
        },
      ];
    });
    setMcpForm({ id: "", label: "", baseUrl: "", token: "" });
    setMcpAddOpen(false);
    setMsg(`MCP “${id}” adicionado — Salvar para aplicar.`);
  };

  const importMcpJson = async () => {
    if (!window.airy?.importMcpJson) {
      setMsg("Atualize o app — import JSON indisponível.");
      return;
    }
    setBusy(true);
    try {
      const res = await window.airy.importMcpJson();
      if (!res.ok) {
        setMsg(res.error || "Import cancelado");
        return;
      }
      const list = res.connections || [];
      setMcpDrafts((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        for (const c of list) {
          map.set(c.id, {
            id: c.id,
            label: c.label || c.id,
            baseUrl: c.baseUrl,
            enabled: true,
            hasToken: Boolean(c.token),
            tokenDraft: c.token || "",
          });
        }
        return [...map.values()];
      });
      setMcpAddOpen(false);
      setMsg(`${list.length} conexão(ões) carregada(s) — Salvar para aplicar.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const importSkill = async () => {
    if (!window.airy?.importSkill) {
      setMsg("Atualize o app — import de skill indisponível.");
      return;
    }
    setBusy(true);
    try {
      const res = await window.airy.importSkill();
      if (!res.ok) {
        setMsg(res.error || "Import cancelado");
        return;
      }
      if (res.skills) setSkills(res.skills);
      if (res.settings?.enabledSkills) setEnabledSkills(res.settings.enabledSkills);
      if (res.settings) {
        setView(res.settings);
        onSaved(res.settings);
      }
      setMsg(`Skill “${res.skill?.label || ""}” importada.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!window.airy?.saveSettings) return;
    setBusy(true);
    setMsg(null);
    try {
      const mcpConnections = mcpDrafts.map((c) => ({
        id: c.id.trim(),
        label: c.label.trim() || c.id,
        baseUrl: c.baseUrl.trim(),
        enabled: c.enabled,
      }));
      const mcpTokenUpdates = mcpDrafts
        .filter((c) => c.tokenDraft.trim())
        .map((c) => ({ id: c.id.trim(), token: c.tokenDraft.trim() }));
      const skillIds =
        enabledSkills.length > 0
          ? enabledSkills
          : skills.filter((s) => s.enabled).map((s) => s.id);

      const payload: Record<string, unknown> = {
        ownerName,
        assistantName: assistantName.trim() || "Airy",
        radarUrl,
        radarOpenAsApp,
        radarAppName: radarAppName.trim() || "Radar Municipal",
        enabledPackages,
        enabledSkills: skillIds,
        openrouterModel: openrouterModel.trim() || "anthropic/claude-haiku-5.5",
        synthesisModel: synthesisModel.trim() || "anthropic/claude-sonnet-4.5",
        elevenVoiceId,
        voiceCatalog,
        mcpConnections,
        mcpTokenUpdates,
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
            ? view?.hasLicenseToken
              ? "Token inválido, expirado ou revogado. Cole um token novo para liberar de novo."
              : "Cole o token de instalação que você recebeu. Sem token válido a Airy fica bloqueada."
            : "Assistente neste PC. Licença revalidada na VPS; segredos no Keychain/DPAPI."}
        </p>

        <fieldset className="setup-fieldset">
          <legend>
            Token de instalação{" "}
            {view?.hasLicenseToken ? "· ativo neste PC" : "· obrigatório"}
          </legend>
          <label>
            Token
            <input
              type="password"
              autoComplete="off"
              value={installToken}
              onChange={(e) => setInstallToken(e.target.value)}
              placeholder={
                view?.hasLicenseToken
                  ? "Cole um novo só se precisar trocar…"
                  : "Cole aqui o token…"
              }
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
        <fieldset className="setup-fieldset">
          <legend>Radar — app ou browser</legend>
          <ToggleSwitch
            checked={radarOpenAsApp}
            label="Preferir app/PWA instalado"
            hint="Desligado = abre a URL no navegador"
            onChange={setRadarOpenAsApp}
          />
          {radarOpenAsApp ? (
            <label>
              Nome do app local
              <input
                value={radarAppName}
                onChange={(e) => setRadarAppName(e.target.value)}
                placeholder="Radar Municipal"
              />
            </label>
          ) : null}
        </fieldset>

        <fieldset className="setup-fieldset">
          <legend>Aplicativos / pacotes</legend>
          <p className="setup-hint">
            Chave verde = pode abrir por voz. Apagada = bloqueado.
          </p>
          <div className="setup-packages">
            {PACKAGE_CATALOG.map((pkg) => {
              const on = enabledPackages.includes(pkg.id);
              return (
                <ToggleSwitch
                  key={pkg.id}
                  checked={on}
                  label={pkg.label}
                  onChange={(next) => {
                    const id = pkg.id as PackageId;
                    setEnabledPackages((prev) =>
                      next
                        ? prev.includes(id)
                          ? prev
                          : [...prev, id]
                        : prev.filter((x) => x !== id),
                    );
                  }}
                />
              );
            })}
          </div>
          <div className="setup-actions" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="ghost"
              onClick={() => setEnabledPackages(ALL_PACKAGE_IDS)}
            >
              Ligar todos
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setEnabledPackages([])}
            >
              Desligar todos
            </button>
          </div>
        </fieldset>

        <fieldset className="setup-fieldset">
          <legend>Orquestrador (2 camadas)</legend>
          <label>
            Roteador (tools / barato)
            <select
              value={openrouterModel}
              onChange={(e) => setOpenrouterModel(e.target.value)}
            >
              <option value="anthropic/claude-haiku-5.5">Haiku 5.5 — recomendado</option>
              <option value="openai/gpt-4o-mini">GPT-4o mini</option>
              <option value="google/gemini-2.5-flash-lite">Gemini Flash Lite</option>
              <option value="google/gemini-2.5-flash">Gemini Flash</option>
            </select>
          </label>
          <label>
            Síntese final (pesquisa / artefato / MCP)
            <select
              value={synthesisModel}
              onChange={(e) => setSynthesisModel(e.target.value)}
            >
              <option value="anthropic/claude-sonnet-4.5">Sonnet 4.5 — recomendado</option>
              <option value="openai/gpt-4o">GPT-4o</option>
              <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="anthropic/claude-haiku-5.5">Haiku 5.5 (mais barato)</option>
            </select>
          </label>
          <p className="setup-hint">
            Abre app/URL: só o roteador. Pesquisa, HTML e dados MCP: síntese no modelo
            mais capaz.
          </p>
        </fieldset>

        <fieldset className="setup-fieldset">
          <legend>Skills</legend>
          <p className="setup-hint">Markdown em ~/Airy/skills — chave liga no prompt.</p>
          <div className="setup-toggle-list">
            {skills.length === 0 ? (
              <p className="setup-hint">Nenhuma skill ainda — importe um .md</p>
            ) : (
              skills.map((sk) => {
                const on =
                  enabledSkills.length === 0
                    ? sk.enabled
                    : enabledSkills.includes(sk.id);
                return (
                  <ToggleSwitch
                    key={sk.id}
                    checked={on}
                    label={sk.label}
                    hint={sk.source === "user" ? "sua pasta" : "embutida"}
                    onChange={(next) => {
                      const allIds = skills.map((x) => x.id);
                      const base =
                        enabledSkills.length > 0 ? enabledSkills : allIds;
                      setEnabledSkills(
                        next
                          ? [...new Set([...base, sk.id])]
                          : base.filter((x) => x !== sk.id),
                      );
                    }}
                  />
                );
              })
            )}
          </div>
          <div className="setup-actions" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="ghost"
              disabled={busy}
              onClick={() => void importSkill()}
            >
              Importar .md…
            </button>
          </div>
        </fieldset>

        <fieldset className="setup-fieldset">
          <legend>Conexões MCP</legend>
          <p className="setup-hint">
            Depois de carregar, só o nome + status. Token fica no cofre.
          </p>
          {mcpDrafts.map((c, idx) => {
            const status = mcpOnline(c.id);
            return (
              <div key={c.id || idx} className="mcp-card">
                <div className="mcp-card-main">
                  <span className={`mcp-dot ${status}`} title={status} />
                  <span className="mcp-card-name">{c.label || c.id}</span>
                </div>
                <ToggleSwitch
                  compact
                  checked={c.enabled}
                  label={c.enabled ? `${c.label} ligada` : `${c.label} desligada`}
                  onChange={(next) => {
                    const nextDrafts = [...mcpDrafts];
                    nextDrafts[idx] = { ...c, enabled: next };
                    setMcpDrafts(nextDrafts);
                  }}
                />
              </div>
            );
          })}
          <div className="setup-actions" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="ghost"
              onClick={() => setMcpAddOpen((v) => !v)}
            >
              {mcpAddOpen ? "Fechar" : "Adicionar"}
            </button>
          </div>
          {mcpAddOpen ? (
            <div className="mcp-add-panel">
              <p className="setup-hint">
                Manual ou JSON proto:{" "}
                {`{"id":"cliente","label":"Cliente","baseUrl":"https://…","token":"…"}`}
              </p>
              <div className="setup-actions" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={() => void importMcpJson()}
                >
                  Carregar JSON…
                </button>
              </div>
              <label>
                Id
                <input
                  value={mcpForm.id}
                  onChange={(e) => setMcpForm({ ...mcpForm, id: e.target.value })}
                  placeholder="cliente-acme"
                />
              </label>
              <label>
                Nome (aparece na lista)
                <input
                  value={mcpForm.label}
                  onChange={(e) => setMcpForm({ ...mcpForm, label: e.target.value })}
                  placeholder="Cliente Acme"
                />
              </label>
              <label>
                URL base
                <input
                  value={mcpForm.baseUrl}
                  onChange={(e) => setMcpForm({ ...mcpForm, baseUrl: e.target.value })}
                  placeholder="https://mcp.cliente.com"
                />
              </label>
              <label>
                Token
                <input
                  type="password"
                  autoComplete="off"
                  value={mcpForm.token}
                  onChange={(e) => setMcpForm({ ...mcpForm, token: e.target.value })}
                />
              </label>
              <div className="setup-actions">
                <button type="button" onClick={addMcpManual}>
                  Incluir
                </button>
              </div>
            </div>
          ) : null}
        </fieldset>

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

        {view?.mcp ? (
          <p className="setup-msg">
            {view.mcp.ok
              ? `MCP ok · ${view.mcp.toolCount} tools`
              : `MCP: ${view.mcp.error || "offline"}`}
          </p>
        ) : null}
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
