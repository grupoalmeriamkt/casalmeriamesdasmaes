import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/store/admin";

const CONFIG_ID = "default";

// Chaves do estado que sincronizamos com o Cloud (não inclui `pedidos`).
const SYNCED_KEYS = [
  "tema",
  "textos",
  "cestas",
  "sobremesas",
  "entrega",
  "pagamento",
  "integracoes",
  "geral",
  "campanhas",
  "campanhaAtivaId",
  "home",
  "unidades",
  "categorias",
] as const;

type SyncedKey = (typeof SYNCED_KEYS)[number];

export type CloudConfigPayload = Partial<Record<SyncedKey, unknown>>;

// Campos SENSÍVEIS — nunca vão para a tabela pública `app_config`.
// Vão para `app_secrets` (RLS admin-only).
type AppSecrets = {
  mpAccessToken?: string;
  metaAccessToken?: string;
  webhookUrl?: string;
};

const SENTINEL_KEEP = "__keep__"; // marca para manter valor existente sem sobrescrever

/** Sanitiza o payload removendo campos sensíveis antes de publicar em app_config. */
function stripSecrets(payload: CloudConfigPayload): CloudConfigPayload {
  const out: any = { ...payload };
  if (out.pagamento && typeof out.pagamento === "object") {
    out.pagamento = { ...out.pagamento, mpAccessToken: "" };
  }
  if (out.integracoes && typeof out.integracoes === "object") {
    out.integracoes = { ...out.integracoes, metaAccessToken: "", webhookUrl: "" };
  }
  return out;
}

/**
 * Carrega configuração pública do Supabase + (se admin logado) os segredos.
 */
export async function loadCloudConfig(): Promise<{
  ok: boolean;
  found: boolean;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("app_config")
      .select("payload")
      .eq("id", CONFIG_ID)
      .maybeSingle();

    if (error) {
      console.error("[cloudConfig] load error", error);
      return { ok: false, found: false, error: error.message };
    }

    const patch: Record<string, unknown> = {};
    let found = false;

    if (data?.payload) {
      found = true;
      const payload = data.payload as CloudConfigPayload;
      for (const key of SYNCED_KEYS) {
        if (payload[key] !== undefined) patch[key] = payload[key];
      }
    }

    // Tenta carregar segredos (vai falhar silenciosamente se não for admin).
    try {
      const { data: sec, error: secErr } = await supabase
        .from("app_secrets")
        .select("payload")
        .eq("id", CONFIG_ID)
        .maybeSingle();
      if (!secErr && sec?.payload) {
        const s = sec.payload as AppSecrets;
        if (patch.pagamento || s.mpAccessToken) {
          patch.pagamento = {
            ...(patch.pagamento as object),
            mpAccessToken: s.mpAccessToken ?? "",
          };
        }
        if (patch.integracoes || s.metaAccessToken || s.webhookUrl) {
          patch.integracoes = {
            ...(patch.integracoes as object),
            metaAccessToken: s.metaAccessToken ?? "",
            webhookUrl: s.webhookUrl ?? "",
          };
        }
      }
    } catch (e) {
      // Silencioso — visitante público não tem acesso, é esperado.
    }

    if (Object.keys(patch).length > 0) {
      useAdmin.setState(patch as Parameters<typeof useAdmin.setState>[0]);
    }
    return { ok: true, found };
  } catch (e: any) {
    console.error("[cloudConfig] load exception", e);
    return { ok: false, found: false, error: e?.message ?? String(e) };
  }
}

/**
 * Salva config pública em `app_config` e segredos em `app_secrets` via API server-side.
 * O servidor usa service role (bypassa RLS), validando o JWT do usuário logado.
 */
export async function saveCloudConfig(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const state = useAdmin.getState();
    const fullPayload: CloudConfigPayload = {};
    for (const key of SYNCED_KEYS) {
      fullPayload[key] = (state as any)[key];
    }

    const publicPayload = stripSecrets(fullPayload);

    const incomingSecrets: AppSecrets = {
      mpAccessToken: state.pagamento.mpAccessToken || undefined,
      metaAccessToken: state.integracoes.metaAccessToken || undefined,
      webhookUrl: state.integracoes.webhookUrl || undefined,
    };
    const hasAnySecrets = Object.values(incomingSecrets).some(Boolean);

    // Obtém JWT do usuário logado para autorizar a chamada server-side
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      return { ok: false, error: "Sessão expirada. Faça login novamente." };
    }

    const res = await fetch("/api/admin/save-config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        publicPayload,
        secrets: hasAnySecrets ? incomingSecrets : undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as any)?.error ?? res.statusText;
      console.error("[cloudConfig] save-config API error", res.status, msg);
      return { ok: false, error: msg };
    }

    return { ok: true };
  } catch (e: any) {
    console.error("[cloudConfig] save exception", e);
    return { ok: false, error: e?.message ?? String(e) };
  }
}

export { SENTINEL_KEEP };
