// SERVIDOR APENAS — NUNCA importar este arquivo do front.
// Usa a Service Role Key do Supabase externo para operações que precisam
// bypassar RLS (ex.: ler segredos da tabela app_secrets).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient | null {
  if (_client) return _client;
  const url =
    process.env.EXTERNAL_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    "";
  const key =
    process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    console.warn(
      "[supabase admin] EXTERNAL_SUPABASE_URL/EXTERNAL_SUPABASE_SERVICE_ROLE_KEY ausentes.",
    );
    return null;
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export type AppSecrets = {
  mpAccessToken?: string;
  metaAccessToken?: string;
  webhookUrl?: string;
  asaasApiKey?: string;
  asaasWalletId?: string;
  asaasWebhookToken?: string;
};

/**
 * Lê os segredos do registro único `app_secrets.default`, separando falha de leitura
 * (banco fora do ar) de segredo não cadastrado.
 */
export async function lerAppSecrets(): Promise<
  { ok: true; secrets: AppSecrets } | { ok: false; error: string }
> {
  const client = getAdminClient();
  if (!client) return { ok: false, error: "admin_client_indisponivel" };
  try {
    const { data, error } = await client
      .from("app_secrets")
      .select("payload")
      .eq("id", "default")
      .maybeSingle();
    if (error) {
      console.error("[supabase admin] lerAppSecrets error", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, secrets: (data?.payload as AppSecrets) ?? {} };
  } catch (e) {
    console.error("[supabase admin] lerAppSecrets exception", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Lê os segredos do registro único `app_secrets.default`.
 * Retorna objeto vazio se o client não estiver configurado ou em caso de falha.
 */
export async function getAppSecrets(): Promise<AppSecrets> {
  const res = await lerAppSecrets();
  return res.ok ? res.secrets : {};
}
