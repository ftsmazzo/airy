/**
 * Redeem de token de instalação no provisionador VPS.
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
    ""
  );
}

export async function redeemInstallToken(
  token: string,
): Promise<{ ok: true; partial: Partial<SettingsForm> } | { ok: false; error: string }> {
  const base = provisionerBaseUrl();
  if (!base) {
    return {
      ok: false,
      error:
        "Provisionador não configurado (AIRY_PROVISIONER_URL). Use keys manuais ou defina a URL.",
    };
  }
  const t = (token || "").trim();
  if (t.length < 8) {
    return { ok: false, error: "Token muito curto." };
  }

  let res: Response;
  try {
    res = await fetch(`${base}/v1/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token: t }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    return { ok: false, error: `Sem rede no provisionador: ${(e as Error).message}` };
  }

  let body: { ok?: boolean; error?: string; payload?: RedeemPayload } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { ok: false, error: `Resposta inválida (${res.status})` };
  }

  if (!res.ok || !body.ok || !body.payload) {
    return {
      ok: false,
      error: body.error || `Token recusado (${res.status})`,
    };
  }

  const p = body.payload;
  const partial: Partial<SettingsForm> = {
    ...(p.secrets || {}),
    ...(p.public || {}),
  };
  return { ok: true, partial };
}
