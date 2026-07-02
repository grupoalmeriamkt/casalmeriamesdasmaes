import { supabase } from "@/integrations/supabase/client";

export type Operator = {
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

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessao expirada");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function listarOperadores(): Promise<Operator[]> {
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/operators", { headers });
    const json = await res.json();
    if (!res.ok) return [];
    return (json.operators ?? []) as Operator[];
  } catch (e) {
    console.error("listarOperadores:", e);
    return [];
  }
}

/** Auto-provisiona/retorna o operador do usuario logado. */
export async function obterOperadorAtual(): Promise<Operator | null> {
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/operators", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "auto" }),
    });
    const json = await res.json();
    if (!res.ok) return null;
    return (json.operator ?? null) as Operator | null;
  } catch (e) {
    console.error("obterOperadorAtual:", e);
    return null;
  }
}

export async function atualizarOperador(
  id: string,
  campos: Partial<Pick<Operator, "short_name" | "role_title" | "internal_key" | "phone" | "name">>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/operators", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "atualizar", id, ...campos }),
    });
    const json = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: json.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

export async function definirOperadorAtivo(
  id: string,
  is_active: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/operators", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "definir_ativo", id, is_active }),
    });
    const json = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: json.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}
