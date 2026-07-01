import { supabase } from "@/integrations/supabase/client";

export type UsuarioCozinha = {
  user_id: string;
  email: string;
  created_at: string;
};

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export function urlModuloCozinha(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/cozinha`;
}

export async function obterTokenGeralCozinha(): Promise<string | null> {
  const { data, error } = await supabase.rpc("cozinha_token_geral");
  if (error) {
    console.error("cozinha_token_geral:", error);
    return null;
  }
  return typeof data === "string" ? data : null;
}

export async function listarUsuariosCozinha(): Promise<UsuarioCozinha[]> {
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/cozinha-users", { headers });
    const json = await res.json();
    if (!res.ok) {
      console.error("listarUsuariosCozinha:", json.error);
      return [];
    }
    return (json.users ?? []) as UsuarioCozinha[];
  } catch (e) {
    console.error("listarUsuariosCozinha:", e);
    return [];
  }
}

export async function alterarSenhaUsuarioCozinha(
  userId: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch("/api/admin/cozinha-users", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "alterar_senha", userId, password }),
  });
  const json = await res.json();
  if (!res.ok) return { ok: false, error: json.error ?? "Erro ao alterar senha" };
  return { ok: true };
}
