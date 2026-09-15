import { supabase } from "@/integrations/supabase/client";
import type { DadosOperadorCodigo, OperadorCodigo } from "@/lib/operacaoCodigo";

export { PORTAL_OPERACAO_TOKEN_PADRAO, isTokenPortalOperacao } from "@/lib/operacaoPortal";

export type UsuarioOperacao = {
  user_id: string;
  email: string;
  created_at: string;
};

export type AcessosOperacao = {
  /** Usuários que entram com e-mail e senha. */
  usuarios: UsuarioOperacao[];
  operadores: OperadorCodigo[];
  /** Erro ao listar operadores por código (ex.: migration_pendente). */
  operadoresErro: string | null;
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
  const fromTable = await obterPortalOperacaoConfig();
  if (fromTable?.share_token) return fromTable.share_token;

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

export async function listarAcessosOperacao(): Promise<AcessosOperacao> {
  const vazio: AcessosOperacao = { usuarios: [], operadores: [], operadoresErro: null };
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/operacao-users", { headers });
    const json = await res.json();
    if (!res.ok) {
      console.error("listarAcessosOperacao:", json.error);
      return vazio;
    }
    return {
      usuarios: (json.users ?? []) as UsuarioOperacao[],
      operadores: (json.operadores ?? []) as OperadorCodigo[],
      operadoresErro: json.operadoresErro ?? null,
    };
  } catch (e) {
    console.error("listarAcessosOperacao:", e);
    return vazio;
  }
}

async function enviarAcaoOperacao(
  body: Record<string, unknown>,
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/operacao-users", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: String(json.error ?? "erro_desconhecido") };
    return { ok: true, json };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

export async function criarOperadorCodigo(
  dados: DadosOperadorCodigo,
): Promise<{ ok: true; operador: OperadorCodigo } | { ok: false; error: string }> {
  const res = await enviarAcaoOperacao({ action: "criar_codigo", ...dados });
  return res.ok ? { ok: true, operador: res.json.operador as OperadorCodigo } : res;
}

export async function editarOperadorCodigo(
  id: string,
  dados: DadosOperadorCodigo,
): Promise<{ ok: true; operador: OperadorCodigo } | { ok: false; error: string }> {
  const res = await enviarAcaoOperacao({ action: "editar_codigo", id, ...dados });
  return res.ok ? { ok: true, operador: res.json.operador as OperadorCodigo } : res;
}

export async function removerOperadorCodigo(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await enviarAcaoOperacao({ action: "remover_codigo", id });
  return res.ok ? { ok: true } : res;
}

export function mensagemErroOperadorCodigo(error: string): string {
  switch (error) {
    case "codigo_em_uso":
      return "Este código já está em uso por outro operador.";
    case "cpf_em_uso":
      return "Já existe um operador ativo com este CPF.";
    case "migration_pendente":
      return "Banco desatualizado: aplique a migration 20260915_operacao_acesso_codigo.sql no Supabase.";
    case "nao_encontrado":
      return "Operador não encontrado. Atualize a lista.";
    case "invalid_body":
      return "Confira nome, CPF, setor e código.";
    case "forbidden":
      return "Sua sessão não tem permissão de administrador no servidor.";
    default:
      return error;
  }
}

/** Portal /operacao: troca o código por uma sessão do Supabase. */
export async function entrarComCodigoOperacao(
  codigo: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/public/operacao/entrar-codigo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo }),
    });
    if (res.status === 429) {
      return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
    }
    const json = (await res.json().catch(() => ({}))) as { tokenHash?: string };
    if (res.status === 400 || res.status === 401) {
      return { ok: false, error: "Código inválido." };
    }
    if (!res.ok || typeof json.tokenHash !== "string") {
      return { ok: false, error: "Não foi possível entrar agora. Tente novamente." };
    }
    const { error } = await supabase.auth.verifyOtp({ token_hash: json.tokenHash, type: "email" });
    if (error) {
      console.error("entrarComCodigoOperacao verifyOtp:", error);
      return { ok: false, error: "Não foi possível entrar agora. Tente novamente." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao conectar. Verifique sua internet e tente novamente." };
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
