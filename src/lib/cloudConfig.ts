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
 * Salva config pública em `app_config` (sem segredos) e segredos em `app_secrets`.
 * Requer admin (RLS).
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

    const { error } = await supabase.from("app_config").upsert(
      {
        id: CONFIG_ID,
        payload: publicPayload,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) {
      console.error("[cloudConfig] save error", error);
      return { ok: false, error: error.message };
    }

    // Segredos: só atualiza campos que o usuário preencheu agora.
    // Se a tabela app_secrets ainda não existir (migração pendente), apenas
    // avisamos e seguimos — a configuração pública já foi salva.
    const incomingSecrets: AppSecrets = {
      mpAccessToken: state.pagamento.mpAccessToken || undefined,
      metaAccessToken: state.integracoes.metaAccessToken || undefined,
      webhookUrl: state.integracoes.webhookUrl || undefined,
    };

    const hasAnyIncoming =
      !!incomingSecrets.mpAccessToken ||
      !!incomingSecrets.metaAccessToken ||
      !!incomingSecrets.webhookUrl;

    try {
      const { data: existing, error: readErr } = await supabase
        .from("app_secrets")
        .select("payload")
        .eq("id", CONFIG_ID)
        .maybeSingle();

      // Tabela inexistente / não exposta no PostgREST → ignora silenciosamente.
      const isMissingTable = (e: any) => {
        if (!e) return false;
        const code = String(e.code ?? "");
        const msg = String(e.message ?? "");
        return (
          code === "42P01" || // postgres: undefined_table
          code === "PGRST205" || // postgrest: table not found in schema cache
          code === "PGRST204" ||
          /schema cache/i.test(msg) ||
          /does not exist/i.test(msg) ||
          /app_secrets/i.test(msg)
        );
      };

      if (readErr && isMissingTable(readErr)) {
        console.warn("[cloudConfig] app_secrets ausente — pulando segredos.");
        return { ok: true };
      }

      // Sem nada novo pra gravar → não escreve.
      if (!hasAnyIncoming) return { ok: true };

      const current = (existing?.payload as AppSecrets) ?? {};
      const merged: AppSecrets = {
        mpAccessToken: incomingSecrets.mpAccessToken ?? current.mpAccessToken,
        metaAccessToken:
          incomingSecrets.metaAccessToken ?? current.metaAccessToken,
        webhookUrl: incomingSecrets.webhookUrl ?? current.webhookUrl,
      };

      const { error: secErr } = await supabase.from("app_secrets").upsert(
        {
          id: CONFIG_ID,
          payload: merged,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

      if (secErr) {
        if (isMissingTable(secErr)) {
          console.warn("[cloudConfig] app_secrets ausente — pulando segredos.");
          return { ok: true };
        }
        console.error("[cloudConfig] save secrets error", secErr);
        return {
          ok: false,
          error: `Configuração pública salva, mas segredos falharam: ${secErr.message}`,
        };
      }
    } catch (e: any) {
      console.warn("[cloudConfig] segredos: exceção ignorada", e);
    }

    return { ok: true };
  } catch (e: any) {
    console.error("[cloudConfig] save exception", e);
    return { ok: false, error: e?.message ?? String(e) };
  }
}

export { SENTINEL_KEEP };
