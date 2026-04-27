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

/**
 * Carrega a configuração salva no Supabase e aplica no store local.
 * Se não existir registro ainda, mantém os defaults / o que está no localStorage.
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

    if (!data?.payload) return { ok: true, found: false };

    const payload = data.payload as CloudConfigPayload;
    const patch: Record<string, unknown> = {};
    for (const key of SYNCED_KEYS) {
      if (payload[key] !== undefined) patch[key] = payload[key];
    }
    // Aplica direto no store (sem disparar setters parciais)
    useAdmin.setState(patch as Parameters<typeof useAdmin.setState>[0]);
    return { ok: true, found: true };
  } catch (e: any) {
    console.error("[cloudConfig] load exception", e);
    return { ok: false, found: false, error: e?.message ?? String(e) };
  }
}

/**
 * Salva o estado atual do store no Supabase (upsert do registro único).
 * Requer usuário admin (RLS).
 */
export async function saveCloudConfig(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const state = useAdmin.getState();
    const payload: CloudConfigPayload = {};
    for (const key of SYNCED_KEYS) {
      payload[key] = (state as any)[key];
    }

    const { error } = await supabase.from("app_config").upsert(
      {
        id: CONFIG_ID,
        payload,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) {
      console.error("[cloudConfig] save error", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e: any) {
    console.error("[cloudConfig] save exception", e);
    return { ok: false, error: e?.message ?? String(e) };
  }
}
