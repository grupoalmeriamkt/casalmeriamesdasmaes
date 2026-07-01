import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

function gerarTokenPedidos(): string {
  return randomBytes(16).toString("hex");
}

/** Obtém ou cria o token geral da central de pedidos (service role). */
export async function obterOuCriarTokenGeralCozinha(
  admin: SupabaseClient,
): Promise<string | null> {
  const { data: existing, error: readErr } = await admin
    .from("share_tokens")
    .select("token")
    .eq("scope", "pedidos")
    .is("campanha_id", null)
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (readErr) {
    console.error("[cozinha.server] read token error", readErr);
    return null;
  }
  if (typeof existing?.token === "string" && existing.token.length > 0) {
    return existing.token;
  }

  const token = gerarTokenPedidos();
  const { data: created, error: insertErr } = await admin
    .from("share_tokens")
    .insert({ token, scope: "pedidos" })
    .select("token")
    .maybeSingle();

  if (insertErr) {
    console.error("[cozinha.server] create token error", insertErr);
    return null;
  }

  return typeof created?.token === "string" ? created.token : null;
}
