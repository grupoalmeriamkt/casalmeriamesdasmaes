import { supabase } from "@/integrations/supabase/client";

export type ShareToken = {
  token: string;
  scope: string;
  criado_em: string;
  senha?: string | null;
};

function gerarToken(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function listarTokensPedidos(): Promise<ShareToken[]> {
  const { data, error } = await supabase
    .from("share_tokens")
    .select("*")
    .eq("scope", "pedidos")
    .order("criado_em", { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return (data ?? []) as ShareToken[];
}

export async function criarTokenPedidos(
  senha?: string,
): Promise<ShareToken | null> {
  const token = gerarToken();
  const payload: Record<string, unknown> = { token, scope: "pedidos" };
  if (senha && senha.length >= 4) payload.senha = senha;

  const { data, error } = await supabase
    .from("share_tokens")
    .insert(payload)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error(error);
    return null;
  }
  return data as ShareToken;
}

export async function revogarToken(token: string): Promise<boolean> {
  const { error } = await supabase
    .from("share_tokens")
    .delete()
    .eq("token", token);
  if (error) {
    console.error(error);
    return false;
  }
  return true;
}

export function urlPublicaPedidos(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/pedidos/${token}`;
}

export function mensagemCompartilhar(token: string, senha?: string | null): string {
  const url = urlPublicaPedidos(token);
  const linhas = [
    "Acesse a lista de pedidos pelo link abaixo:",
    `🔗 ${url}`,
  ];
  if (senha) linhas.push(`🔑 Senha: ${senha}`);
  return linhas.join("\n");
}

/** Verifica se o token requer senha (chamando a RPC do banco). */
export async function tokenRequerSenha(token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("token_requer_senha", { _token: token });
  if (error) {
    console.warn("token_requer_senha RPC indisponível:", error.message);
    return false;
  }
  return !!data;
}

/** Valida senha contra um token. */
export async function validarSenhaToken(
  token: string,
  senha: string,
): Promise<boolean> {
  if (!senha || senha.length < 1) return false;
  const { data, error } = await supabase.rpc("validar_token_pedidos", {
    _token: token,
    _senha: senha,
  });
  if (error) {
    console.warn("validar_token_pedidos RPC erro:", error.message);
    return false;
  }
  return !!data;
}
