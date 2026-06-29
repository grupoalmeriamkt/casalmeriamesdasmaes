import { supabase } from "@/integrations/supabase/client";
import type { PedidoSalvo } from "@/store/admin";
import { pagamentoRelevante } from "@/lib/asaasStatus";
import { computeExecutionAt } from "@/lib/executionAt";

export type PagamentoAsaasRow = {
  id: string;
  asaas_payment_id: string;
  metodo: "PIX" | "CREDIT_CARD" | "BOLETO";
  status: string; // PENDING | CONFIRMED | RECEIVED | OVERDUE | REFUNDED | ...
  valor: number;
  cupom_codigo: string | null;
  cupom_desconto: number | null;
  cartao_brand: string | null;
  cartao_last4: string | null;
  criado_em: string;
};

export type PedidoRow = {
  id: string;
  criado_em: string;
  cliente_nome: string;
  cliente_whatsapp: string;
  cliente_cpf?: string | null;
  cliente_email?: string | null;
  cesta: { nome: string; quantidade: number; preco: number } | null;
  sobremesas: { nome: string; quantidade: number; preco: number }[];
  tipo: string;
  endereco_ou_unidade: string;
  data_entrega: string | null;
  horario: string | null;
  pagamento: {
    metodo: string;
    status: string;
    destinatario?: { nome: string; whatsapp: string } | null;
    extras?: {
      cartoes?: { nome: string; preco: number; mensagem: string }[];
      polaroids?: { nome: string; preco: number; arquivoUrl: string; arquivoNome: string }[];
    };
    cupom?: string | null;
    desconto?: number | null;
  };
  total: number;
  status: string;
  campanha_id?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  recipient_is_buyer?: boolean | null;
  unidade_id?: string | null;
  production_sector?: string | null;
  execution_at?: string | null;
  payment_status_raw?: string | null;
  payment_status_normalized?: string | null;
  payment_confirmed_at?: string | null;
  is_test?: boolean | null;
  archived_at?: string | null;
  archived_by?: string | null;
  conciliacao_pendente?: boolean | null;
  pagamentos?: PagamentoAsaasRow[];
};

type PedidoParcial = Partial<Omit<PedidoSalvo, "id" | "criadoEm">> & {
  cliente: { nome: string; whatsapp: string };
};

function toPayload(p: PedidoParcial, statusOverride?: string, campanhaId?: string) {
  const recipientIsBuyer = !p.destinatario;
  const recipientName = p.destinatario?.nome ?? p.cliente.nome;
  const recipientPhone = p.destinatario?.whatsapp ?? p.cliente.whatsapp;
  return {
    cliente_nome: p.cliente.nome,
    cliente_whatsapp: p.cliente.whatsapp,
    cesta: p.cesta ?? null,
    sobremesas: p.sobremesas ?? [],
    tipo: p.tipo ?? "",
    endereco_ou_unidade: p.enderecoOuUnidade ?? "",
    data_entrega: p.data ?? null,
    horario: p.horario ?? null,
    pagamento: {
      ...(p.pagamento ?? { metodo: "", status: statusOverride ?? "rascunho" }),
      destinatario: p.destinatario ?? null,
    },
    total: p.total ?? 0,
    status: statusOverride ?? p.pagamento?.status ?? "rascunho",
    campanha_id: campanhaId ?? null,
    recipient_name: recipientName,
    recipient_phone: recipientPhone,
    recipient_is_buyer: recipientIsBuyer,
    unidade_id: (p as { unidadeId?: string }).unidadeId ?? null,
    production_sector: (p as { productionSector?: string }).productionSector ?? null,
    execution_at: computeExecutionAt(p.data ?? null, p.horario ?? null),
  };
}

/** Cria/atualiza um rascunho de pedido. Usa RPC pública. */
export async function upsertRascunho(
  p: PedidoParcial,
  pedidoId?: string,
  campanhaId?: string,
): Promise<{ id: string; error: Error | null }> {
  const payload = toPayload(p, "rascunho", campanhaId);
  const { data, error } = await supabase.rpc("upsert_pedido_rascunho", {
    _pedido_id: pedidoId ?? null,
    _payload: payload,
  });
  if (error) {
    return { id: "", error: error as unknown as Error };
  }
  return { id: data as unknown as string, error: null };
}

/** Finaliza um pedido (status = aprovado/pendente). Atualiza rascunho se houver id. */
export async function finalizarPedido(
  p: Omit<PedidoSalvo, "id" | "criadoEm">,
  pedidoId?: string,
  campanhaId?: string,
): Promise<{ id: string; error: Error | null }> {
  const payload = toPayload(p, p.pagamento.status ?? "aprovado", campanhaId);
  const { data, error } = await supabase.rpc("upsert_pedido_rascunho", {
    _pedido_id: pedidoId ?? null,
    _payload: payload,
  });
  if (error) return { id: "", error: error as unknown as Error };
  return { id: data as unknown as string, error: null };
}

/** Mantido por compatibilidade — usa finalizarPedido. */
export async function inserirPedido(p: Omit<PedidoSalvo, "id" | "criadoEm">, pedidoId?: string) {
  return finalizarPedido(p, pedidoId);
}

/** Lista pedidos via endpoint server-side (que usa service_role e bypassa RLS). */
export async function conciliarPagamentosAsaas(): Promise<{
  ok: boolean;
  pagamentosAtualizados?: number;
  pedidosAtualizados?: number;
}> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { ok: false };

    const res = await fetch("/api/admin/conciliar-asaas", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      console.error("Erro ao conciliar Asaas:", res.status);
      return { ok: false };
    }
    const json = (await res.json()) as {
      pagamentosAtualizados?: number;
      pedidosAtualizados?: number;
    };
    return {
      ok: true,
      pagamentosAtualizados: json.pagamentosAtualizados,
      pedidosAtualizados: json.pedidosAtualizados,
    };
  } catch (e) {
    console.error("Erro ao conciliar Asaas:", e);
    return { ok: false };
  }
}

/** Lista pedidos via endpoint server-side (que usa service_role e bypassa RLS). */
export async function listarPedidos(): Promise<PedidoRow[]> {
  try {
    const res = await fetch("/api/public/admin/pedidos");
    if (!res.ok) {
      console.error("Erro ao listar pedidos:", res.status);
      return [];
    }
    const json = (await res.json()) as { pedidos?: PedidoRow[] };
    return json.pedidos ?? [];
  } catch (e) {
    console.error("Erro ao listar pedidos:", e);
    return [];
  }
}

/** Lista pedidos via token público (para a tela da cozinha). */
export async function listarPedidosPorToken(token: string, senha?: string): Promise<PedidoRow[]> {
  const { data, error } = await supabase.rpc("pedidos_por_token", {
    _token: token,
    _senha: senha ?? null,
  });
  if (error) {
    console.error("Erro ao listar pedidos por token:", error);
    return [];
  }
  return (data ?? []) as PedidoRow[];
}

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

/** Cancela um pedido (status → "cancelado"). Requer admin autenticado. */
export async function cancelarPedido(id: string): Promise<{ ok: boolean; error?: string }> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: "Não autenticado" };
  try {
    const res = await fetch("/api/admin/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "cancelar", id }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    return res.ok ? { ok: true } : { ok: false, error: json.error ?? "Erro desconhecido" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

/** Exclui um pedido permanentemente (cascata para pagamentos). Requer admin autenticado. */
export async function excluirPedido(id: string): Promise<{ ok: boolean; error?: string }> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: "Não autenticado" };
  try {
    const res = await fetch("/api/admin/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "excluir", id }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    return res.ok ? { ok: true } : { ok: false, error: json.error ?? "Erro desconhecido" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

/** Edita campos de um pedido via token público (link compartilhado). */
export async function editarPedidoPorToken(
  token: string,
  pedidoId: string,
  campos: Partial<{
    cliente_nome: string;
    cliente_whatsapp: string;
    endereco_ou_unidade: string;
    data_entrega: string | null;
    horario: string | null;
  }>,
  destinatario?: { nome: string; whatsapp: string } | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/pedidos/editar-por-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, pedido_id: pedidoId, campos, destinatario }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    return res.ok ? { ok: true } : { ok: false, error: json.error ?? "Erro desconhecido" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

/** Converte row do banco em PedidoSalvo para reaproveitar UI antiga. */
export function rowToPedidoSalvo(r: PedidoRow): PedidoSalvo {
  const rel = pagamentoRelevante(r.pagamentos ?? []);
  const destinatario =
    r.recipient_is_buyer === false && r.pagamento?.destinatario
      ? r.pagamento.destinatario
      : r.pagamento?.destinatario ??
        (r.recipient_name
          ? { nome: r.recipient_name, whatsapp: r.recipient_phone ?? "" }
          : null);
  return {
    id: r.id,
    criadoEm: r.criado_em,
    cliente: { nome: r.cliente_nome, whatsapp: r.cliente_whatsapp },
    destinatario,
    cesta: r.cesta ?? undefined,
    sobremesas: r.sobremesas ?? [],
    tipo: r.tipo,
    enderecoOuUnidade: r.endereco_ou_unidade,
    data: r.data_entrega ?? undefined,
    horario: r.horario ?? undefined,
    pagamento: {
      ...r.pagamento,
      status: rel?.status ?? r.pagamento?.status ?? r.status ?? "",
    },
    total: Number(r.total),
  };
}

export { rowToPedidoOperacional } from "@/lib/operacaoPedido";
