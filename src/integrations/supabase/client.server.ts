// SERVIDOR APENAS — NUNCA importar este arquivo do front.
// Usa a Service Role Key do Supabase externo para operações que precisam
// bypassar RLS (ex.: ler segredos da tabela app_secrets).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient | null {
  if (_client) return _client;
  const url =
    process.env.EXTERNAL_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    "";
  const key =
    process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "";
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

/**
 * Lê os segredos do registro único `app_secrets.default`.
 * Retorna objeto vazio se o client não estiver configurado ou em caso de falha.
 */
export async function getAppSecrets(): Promise<{
  mpAccessToken?: string;
  metaAccessToken?: string;
  webhookUrl?: string;
}> {
  const client = getAdminClient();
  if (!client) return {};
  try {
    const { data, error } = await client
      .from("app_secrets")
      .select("payload")
      .eq("id", "default")
      .maybeSingle();
    if (error) {
      console.error("[supabase admin] getAppSecrets error", error);
      return {};
    }
    return (data?.payload as Record<string, string>) ?? {};
  } catch (e) {
    console.error("[supabase admin] getAppSecrets exception", e);
    return {};
  }
}
