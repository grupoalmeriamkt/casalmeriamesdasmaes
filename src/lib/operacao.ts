import { supabase } from "@/integrations/supabase/client";

export type UsuarioOperacao = {
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

export function urlModuloOperacao(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/operacao`;
}

export function urlPedidosOperacao(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/pedidos/${token}`;
}

export async function obterTokenPortalOperacao(): Promise<string | null> {
  const { data, error } = await supabase.rpc("operacao_token_portal");
  if (!error && typeof data === "string" && data.length > 0) return data;
  if (error) console.error("operacao_token_portal:", error);

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return null;

    const res = await fetch("/api/operacao/token", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = (await res.json()) as { token?: string; error?: string };
    if (res.ok && typeof json.token === "string" && json.token.length > 0) {
      return json.token;
    }
    if (!res.ok) console.error("api/operacao/token:", json.error);
  } catch (e) {
    console.error("obterTokenPortalOperacao fallback:", e);
  }

  return null;
}

export async function listarUsuariosOperacao(): Promise<UsuarioOperacao[]> {
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/operacao-users", { headers });
    const json = await res.json();
    if (!res.ok) {
      console.error("listarUsuariosOperacao:", json.error);
      return [];
    }
    return (json.users ?? []) as UsuarioOperacao[];
  } catch (e) {
    console.error("listarUsuariosOperacao:", e);
    return [];
  }
}

export async function alterarSenhaUsuarioOperacao(
  userId: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch("/api/admin/operacao-users", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "alterar_senha", userId, password }),
  });
  const json = await res.json();
  if (!res.ok) return { ok: false, error: json.error ?? "Erro ao alterar senha" };
  return { ok: true };
}

export async function obterPortalOperacaoConfig(): Promise<{ share_token: string } | null> {
  const { data, error } = await supabase
    .from("operacao_portal")
    .select("share_token")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data?.share_token) return null;
  return { share_token: data.share_token };
}

export async function atualizarPortalOperacaoToken(
  shareToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch("/api/admin/operacao-users", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "atualizar_token", shareToken }),
  });
  const json = await res.json();
  if (!res.ok) return { ok: false, error: json.error ?? "Erro ao salvar token" };
  return { ok: true };
}
