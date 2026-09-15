import type { SupabaseClient } from "@supabase/supabase-js";
import { canAccessOperacao } from "@/lib/authServer";
import {
  CODIGO_ACESSO_REGEX,
  type DadosOperadorCodigo,
  type OperadorCodigo,
} from "@/lib/operacaoCodigo";

/** Domínio dos logins técnicos dos operadores por código. Nenhum e-mail é enviado a eles. */
const DOMINIO_LOGIN_TECNICO = "grupoalmeria.com.br";
const FALHAS_MAX_POR_IP = 10;
const JANELA_FALHAS_MS = 15 * 60_000;
const RETENCAO_FALHAS_MS = 24 * 60 * 60_000;

const COLUNAS = "id, user_id, name, cpf, role_title, access_code, created_at, last_activity_at";

type OperadorRow = {
  id: string;
  user_id: string | null;
  name: string;
  cpf: string | null;
  role_title: string | null;
  access_code: string | null;
  created_at: string;
  last_activity_at: string | null;
};

type Falha = { ok: false; error: string };

function paraOperadorCodigo(row: OperadorRow): OperadorCodigo {
  return {
    id: row.id,
    user_id: row.user_id,
    nome: row.name,
    cpf: row.cpf ?? "",
    setor: row.role_title ?? "",
    codigo: row.access_code ?? "",
    criado_em: row.created_at,
    ultimo_acesso_em: row.last_activity_at,
  };
}

/** Traduz erros do PostgREST: índices únicos e colunas/tabela da migration ainda não aplicada. */
function codigoErro(error: { code?: string; message?: string } | null): string {
  if (!error) return "erro_desconhecido";
  const msg = error.message ?? "";
  if (error.code === "23505" && msg.includes("operators_access_code_key")) return "codigo_em_uso";
  if (error.code === "23505" && msg.includes("operators_cpf_ativo_key")) return "cpf_em_uso";
  if (["42703", "42P01", "PGRST204", "PGRST205"].includes(error.code ?? "")) {
    return "migration_pendente";
  }
  return msg || "erro_desconhecido";
}

function dadosValidos(dados: DadosOperadorCodigo): boolean {
  return CODIGO_ACESSO_REGEX.test(dados.codigo) && /^[0-9]{11}$/.test(dados.cpf);
}

function senhaDescartavel(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function conferirConflito(
  admin: SupabaseClient,
  dados: DadosOperadorCodigo,
  ignorarId?: string,
): Promise<string | null> {
  // cpf e código já chegam só com dígitos (dadosValidos), seguros dentro do filtro.
  let query = admin
    .from("operators")
    .select("access_code")
    .or(`access_code.eq.${dados.codigo},and(cpf.eq.${dados.cpf},is_active.eq.true)`);
  if (ignorarId) query = query.neq("id", ignorarId);
  const { data, error } = await query;
  if (error) return codigoErro(error);
  if (data?.some((r) => r.access_code === dados.codigo)) return "codigo_em_uso";
  if (data?.length) return "cpf_em_uso";
  return null;
}

export async function listarOperadoresCodigo(
  admin: SupabaseClient,
): Promise<{ ok: true; operadores: OperadorCodigo[] } | Falha> {
  const { data, error } = await admin
    .from("operators")
    .select(COLUNAS)
    .not("access_code", "is", null)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[operacaoCodigo] listar", error);
    return { ok: false, error: codigoErro(error) };
  }
  return { ok: true, operadores: (data as OperadorRow[]).map(paraOperadorCodigo) };
}

export async function criarOperadorCodigo(
  admin: SupabaseClient,
  dados: DadosOperadorCodigo,
): Promise<{ ok: true; operador: OperadorCodigo } | Falha> {
  if (!dadosValidos(dados)) return { ok: false, error: "invalid_body" };
  const conflito = await conferirConflito(admin, dados);
  if (conflito) return { ok: false, error: conflito };

  const email = `operador.${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}@${DOMINIO_LOGIN_TECNICO}`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: senhaDescartavel(),
    email_confirm: true,
    user_metadata: { name: dados.nome },
    app_metadata: { acesso_operacao: "codigo" },
  });
  if (createErr || !created.user) {
    console.error("[operacaoCodigo] createUser", createErr);
    return { ok: false, error: createErr?.message ?? "create_failed" };
  }
  const userId = created.user.id;

  const { error: roleErr } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role: "operacao" });
  if (roleErr) {
    console.error("[operacaoCodigo] role insert", roleErr);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: roleErr.message };
  }

  const { data: row, error: opErr } = await admin
    .from("operators")
    .insert({
      user_id: userId,
      name: dados.nome,
      cpf: dados.cpf,
      role_title: dados.setor,
      access_code: dados.codigo,
      is_active: true,
    })
    .select(COLUNAS)
    .single();
  if (opErr || !row) {
    console.error("[operacaoCodigo] operator insert", opErr);
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: codigoErro(opErr) };
  }

  return { ok: true, operador: paraOperadorCodigo(row as OperadorRow) };
}

export async function editarOperadorCodigo(
  admin: SupabaseClient,
  id: string,
  dados: DadosOperadorCodigo,
): Promise<{ ok: true; operador: OperadorCodigo } | Falha> {
  if (!dadosValidos(dados)) return { ok: false, error: "invalid_body" };
  const { data: atual, error: readErr } = await admin
    .from("operators")
    .select("user_id, name")
    .eq("id", id)
    .not("access_code", "is", null)
    .maybeSingle();
  if (readErr) return { ok: false, error: codigoErro(readErr) };
  if (!atual) return { ok: false, error: "nao_encontrado" };

  const conflito = await conferirConflito(admin, dados, id);
  if (conflito) return { ok: false, error: conflito };

  const { data: row, error } = await admin
    .from("operators")
    .update({
      name: dados.nome,
      cpf: dados.cpf,
      role_title: dados.setor,
      access_code: dados.codigo,
    })
    .eq("id", id)
    .select(COLUNAS)
    .single();
  if (error || !row) {
    console.error("[operacaoCodigo] update", error);
    return { ok: false, error: codigoErro(error) };
  }

  if (atual.user_id && atual.name !== dados.nome) {
    const { error: metaErr } = await admin.auth.admin.updateUserById(atual.user_id, {
      user_metadata: { name: dados.nome },
    });
    if (metaErr) console.warn("[operacaoCodigo] nome no login", metaErr);
  }

  return { ok: true, operador: paraOperadorCodigo(row as OperadorRow) };
}

/** Revoga o acesso e apaga o login técnico. O registro fica inativo, como histórico dos pedidos. */
export async function removerOperadorCodigo(
  admin: SupabaseClient,
  id: string,
): Promise<{ ok: true } | Falha> {
  const { data: atual, error: readErr } = await admin
    .from("operators")
    .select("user_id")
    .eq("id", id)
    .not("access_code", "is", null)
    .maybeSingle();
  if (readErr) return { ok: false, error: codigoErro(readErr) };
  if (!atual) return { ok: false, error: "nao_encontrado" };

  if (atual.user_id) {
    const { error: roleErr } = await admin
      .from("user_roles")
      .delete()
      .eq("user_id", atual.user_id)
      .eq("role", "operacao");
    if (roleErr) {
      console.error("[operacaoCodigo] role delete", roleErr);
      return { ok: false, error: roleErr.message };
    }
    // Sem a role o acesso já caiu; apagar o login só encerra a sessão aberta.
    const { error: delErr } = await admin.auth.admin.deleteUser(atual.user_id);
    if (delErr) console.error("[operacaoCodigo] deleteUser", delErr);
  }

  const { error: updErr } = await admin
    .from("operators")
    .update({ access_code: null, is_active: false })
    .eq("id", id);
  if (updErr) {
    console.error("[operacaoCodigo] desativar", updErr);
    return { ok: false, error: codigoErro(updErr) };
  }
  return { ok: true };
}

async function registrarFalha(admin: SupabaseClient, ip: string) {
  await admin.from("operacao_login_falhas").insert({ ip });
  await admin
    .from("operacao_login_falhas")
    .delete()
    .lt("criado_em", new Date(Date.now() - RETENCAO_FALHAS_MS).toISOString());
}

/**
 * Troca o código por um token de link mágico. O link gerado pelo admin não envia e-mail;
 * o navegador troca o hash por sessão com supabase.auth.verifyOtp.
 */
export async function entrarComCodigo(
  admin: SupabaseClient,
  codigo: string,
  ip: string,
): Promise<
  { ok: true; tokenHash: string } | { ok: false; motivo: "bloqueado" | "invalido" | "erro" }
> {
  const desde = new Date(Date.now() - JANELA_FALHAS_MS).toISOString();
  const { count, error: countErr } = await admin
    .from("operacao_login_falhas")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("criado_em", desde);
  if (countErr) {
    console.error("[operacaoCodigo] contar falhas", countErr);
    return { ok: false, motivo: "erro" };
  }
  if ((count ?? 0) >= FALHAS_MAX_POR_IP) return { ok: false, motivo: "bloqueado" };

  const { data: op, error: opErr } = await admin
    .from("operators")
    .select("id, user_id")
    .eq("access_code", codigo)
    .eq("is_active", true)
    .maybeSingle();
  if (opErr) {
    console.error("[operacaoCodigo] buscar código", opErr);
    return { ok: false, motivo: "erro" };
  }
  if (!op?.user_id || !(await canAccessOperacao(admin, op.user_id))) {
    await registrarFalha(admin, ip);
    return { ok: false, motivo: "invalido" };
  }

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(op.user_id);
  const email = userData?.user?.email;
  if (userErr || !email) {
    console.error("[operacaoCodigo] login técnico", userErr);
    return { ok: false, motivo: "erro" };
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    console.error("[operacaoCodigo] generateLink", linkErr);
    return { ok: false, motivo: "erro" };
  }

  // Acerto libera o IP: no balcão várias pessoas saem pela mesma rede.
  await Promise.all([
    admin.from("operators").update({ last_activity_at: new Date().toISOString() }).eq("id", op.id),
    admin.from("operacao_login_falhas").delete().eq("ip", ip),
  ]);

  return { ok: true, tokenHash };
}
