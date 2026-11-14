/**
 * Redeem + validate de token de instalação no provisionador VPS.
 * Não loga o payload nem o token.
 */
import type { SettingsForm } from "./secureConfig.js";

export type RedeemPayload = {
  version?: number;
  secrets?: Partial<{
    openrouterApiKey: string;
    elevenApiKey: string;
    mcpToken: string;
  }>;
  public?: Partial<{
    elevenVoiceId: string;
    voiceCatalog: Array<{ id: string; label: string }>;
    openrouterModel: string;
    mcpBaseUrl: string;
    radarUrl: string;
    ownerName: string;
    assistantName: string;
    elevenTtsModel: string;
    elevenStability: number;
    elevenSimilarity: number;
    elevenStyle: number;
    elevenSpeed: number;
  }>;
};

export function provisionerBaseUrl(): string {
  return (
    (process.env.AIRY_PROVISIONER_URL || "").trim().replace(/\/$/, "") ||
    "https://airy-provisioner.kxryyk.easypanel.host"
  );
}

async function postToken(
  path: "/v1/redeem" | "/v1/validate",
  token: string,
): Promise<{ ok: boolean; status: number; error?: string; payload?: RedeemPayload }> {
  const base = provisionerBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 0,
      error:
        "Provisionador não configurado (AIRY_PROVISIONER_URL). Defina a URL ou use o default.",
    };
  }
  const t = (token || "").trim();
  if (t.length < 8) {
    return { ok: false, status: 400, error: "Token muito curto." };
  }

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token: t }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: `Sem rede no provisionador: ${(e as Error).message}`,
    };
  }

  let body: { ok?: boolean; error?: string; payload?: RedeemPayload } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { ok: false, status: res.status, error: `Resposta inválida (${res.status})` };
  }

  if (!res.ok || !body.ok) {
    return {
      ok: false,
      status: res.status,
      error: body.error || `Token recusado (${res.status})`,
    };
  }
  return { ok: true, status: res.status, payload: body.payload };
}

export async function redeemInstallToken(
  token: string,
): Promise<{ ok: true; partial: Partial<SettingsForm> } | { ok: false; error: string }> {
  const result = await postToken("/v1/redeem", token);
  if (!result.ok || !result.payload) {
    return { ok: false, error: result.error || "Token recusado" };
  }

  const p = result.payload;
  const partial: Partial<SettingsForm> = {
    ...(p.secrets || {}),
    ...(p.public || {}),
    licenseToken: (token || "").trim(),
  };
  return { ok: true, partial };
}

export async function validateLicenseToken(
  token: string,
): Promise<
  | { ok: true }
  | { ok: false; error: string; revokeLocal: boolean }
> {
  const result = await postToken("/v1/validate", token);
  if (!result.ok) {
    // Só apaga keys locais em recusa definitiva (inválido/revogado/expirado)
    const revokeLocal =
      result.status === 401 || result.status === 410 || result.status === 400;
    return {
      ok: false,
      error: result.error || "Licença inválida",
      revokeLocal,
    };
  }
  return { ok: true };
}
