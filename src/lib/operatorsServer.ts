import type { SupabaseClient } from "@supabase/supabase-js";

export type OperatorRow = {
  id: string;
  user_id: string | null;
  name: string;
  short_name: string | null;
  email: string | null;
  phone: string | null;
  role_title: string | null;
  internal_key: string | null;
  is_active: boolean;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Garante que exista um operador para o usuario logado; cria se necessario. */
export async function ensureOperator(
  admin: SupabaseClient,
  userId: string,
  info: { name: string; email?: string | null },
): Promise<OperatorRow | null> {
  const { data: existing } = await admin
    .from("operators")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await admin
      .from("operators")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", existing.id);
    return existing as OperatorRow;
  }

  const { data: created, error } = await admin
    .from("operators")
    .insert({
      user_id: userId,
      name: info.name || info.email || "Operador",
      email: info.email ?? null,
      is_active: true,
      last_activity_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    console.error("[ensureOperator]", error);
    return null;
  }
  return created as OperatorRow;
}
