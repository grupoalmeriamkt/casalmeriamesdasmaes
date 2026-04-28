// SERVIDOR APENAS — NUNCA importar este arquivo do front.
// Usa a Service Role Key do Supabase para operações que precisam
// bypassar RLS (ex.: ler segredos da tabela app_secrets).
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  // Não jogamos exceção aqui pra não quebrar o boot do worker em rotas
  // que não dependem do admin client. Quem usar valida em runtime.
  console.warn(
    "[supabase admin] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes — chamadas vão falhar.",
  );
}

export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Lê os segredos do registro único `app_secrets.default`.
 * Retorna objeto vazio se não houver registro ou em caso de falha.
 */
export async function getAppSecrets(): Promise<{
  mpAccessToken?: string;
  metaAccessToken?: string;
  webhookUrl?: string;
}> {
  try {
    const { data, error } = await supabaseAdmin
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
