import { supabase } from "@/integrations/supabase/client";
import type { PedidoSalvo } from "@/store/admin";
import type { ManualOrderInput } from "@/lib/orderForm/types";
import { pagamentoRelevante } from "@/lib/asaasStatus";
import { computeExecutionAt } from "@/lib/executionAt";
import {
  parseUpsertPedidoResult,
  saveCheckoutAccess,
} from "@/lib/checkoutAccess";
import {
  buildRegrasForItens,
  resolveProductionSector,
  type CarrinhoItem,
} from "@/lib/availability";
import type { SetorOperacional } from "@/lib/setoresOperacao";
import type { FulfillmentStage } from "@/lib/etapaPedido";

export type PagamentoAsaasRow = {
  id: string;
  asaas_payment_id: string;
  metodo: "PIX" | "CREDIT_CARD" | "BOLETO" | null;
  status: string; // PENDING | CONFIRMED | RECEIVED | OVERDUE | REFUNDED | ...
  valor: number;
  cupom_codigo: string | null;
  cupom_desconto: number | null;
  cartao_brand: string | null;
  cartao_last4: string | null;
  invoice_url?: string | null;
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
  fulfillment_stage?: string | null;
  fulfillment_stage_at?: string | null;
  origin?: string | null;
  operator_id?: string | null;
  operador?: { id: string; name: string; short_name: string | null } | null;
  pagamentos?: PagamentoAsaasRow[];
};

type PedidoParcial = Partial<Omit<PedidoSalvo, "id" | "criadoEm">> & {
  cliente: { nome: string; whatsapp: string };
};

function toPayload(p: PedidoParcial, statusOverride?: string, campanhaId?: string) {
  const recipientIsBuyer = !p.destinatario;
  const recipientName = p.destinatario?.nome ?? p.cliente.nome;
  const recipientPhone = p.destinatario?.whatsapp ?? p.cliente.whatsapp;

  // Setor de produção derivado dos itens (best-effort, pelo nome do produto).
  const itensCarrinho: CarrinhoItem[] = [];
  if (p.cesta?.nome)
    itensCarrinho.push({ produto_id: p.cesta.nome, produto_tipo: "cesta", nome: p.cesta.nome });
  for (const s of p.sobremesas ?? [])
    itensCarrinho.push({ produto_id: s.nome, produto_tipo: "sobremesa", nome: s.nome });
  const productionSector =
    (p as { productionSector?: string }).productionSector ??
    (itensCarrinho.length
      ? resolveProductionSector(itensCarrinho, buildRegrasForItens(itensCarrinho))
      : null);

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
    unidade_id: p.unidadeId ?? null,
    production_sector: productionSector,
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
  const parsed = parseUpsertPedidoResult(data);
  if (!parsed) return { id: "", error: new Error("Resposta inválida do servidor") };
  if (parsed.accessToken) saveCheckoutAccess(parsed.id, parsed.accessToken);
  return { id: parsed.id, error: null };
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
  const parsed = parseUpsertPedidoResult(data);
  if (!parsed) return { id: "", error: new Error("Resposta inválida do servidor") };
  if (parsed.accessToken) saveCheckoutAccess(parsed.id, parsed.accessToken);
  return { id: parsed.id, error: null };
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
    const token = await getAuthToken();
    if (!token) return [];
    const res = await fetch("/api/public/admin/pedidos", {
      headers: { Authorization: `Bearer ${token}` },
    });
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

/** Arquiva pedidos selecionados (soft delete). Requer admin autenticado. */
export async function arquivarPedidos(
  ids: string[],
): Promise<{ ok: boolean; arquivados?: number; error?: string }> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: "Não autenticado" };
  try {
    const res = await fetch("/api/admin/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "arquivar", ids }),
    });
    const json = (await res.json()) as { ok?: boolean; arquivados?: number; error?: string };
    return res.ok
      ? { ok: true, arquivados: json.arquivados ?? ids.length }
      : { ok: false, error: json.error ?? "Erro desconhecido" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

/** Restaura pedidos arquivados. Requer admin autenticado. */
export async function desarquivarPedidos(
  ids: string[],
): Promise<{ ok: boolean; desarquivados?: number; error?: string }> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: "Não autenticado" };
  try {
    const res = await fetch("/api/admin/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "desarquivar", ids }),
    });
    const json = (await res.json()) as { ok?: boolean; desarquivados?: number; error?: string };
    return res.ok
      ? { ok: true, desarquivados: json.desarquivados ?? ids.length }
      : { ok: false, error: json.error ?? "Erro desconhecido" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

/** Define a etapa de produção de um pedido. Requer admin autenticado. */
export async function setEtapaPedido(
  id: string,
  stage: FulfillmentStage,
): Promise<{ ok: boolean; error?: string }> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: "Não autenticado" };
  try {
    const res = await fetch("/api/admin/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "set_etapa", id, stage }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    return res.ok ? { ok: true } : { ok: false, error: json.error ?? "Erro desconhecido" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

/** Avança a etapa de produção de vários pedidos (finalizado permanece). */
export async function avancarEtapaPedidos(
  ids: string[],
): Promise<{ ok: boolean; avancados?: number; error?: string }> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: "Não autenticado" };
  try {
    const res = await fetch("/api/admin/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "avancar_etapa", ids }),
    });
    const json = (await res.json()) as { ok?: boolean; avancados?: number; error?: string };
    return res.ok
      ? { ok: true, avancados: json.avancados ?? 0 }
      : { ok: false, error: json.error ?? "Erro desconhecido" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

/** Marca pedidos como pagos manualmente (override). Requer admin autenticado. */
export async function marcarComoPago(
  ids: string[],
): Promise<{ ok: boolean; pagos?: number; error?: string }> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: "Não autenticado" };
  try {
    const res = await fetch("/api/admin/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "marcar_pago", ids }),
    });
    const json = (await res.json()) as { ok?: boolean; pagos?: number; error?: string };
    return res.ok
      ? { ok: true, pagos: json.pagos ?? ids.length }
      : { ok: false, error: json.error ?? "Erro desconhecido" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

/** Atualiza setor e/ou local de retirada. Requer admin autenticado. */
export async function atualizarPedidoOperacao(
  id: string,
  campos: {
    production_sector?: SetorOperacional;
    unidade_id?: string | null;
    endereco_ou_unidade?: string;
    tipo?: "delivery" | "retirada";
  },
): Promise<{ ok: boolean; error?: string }> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: "Não autenticado" };
  try {
    const res = await fetch("/api/admin/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "atualizar_operacao", id, ...campos }),
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
    unidadeId: r.unidade_id ?? undefined,
    data: r.data_entrega ?? undefined,
    horario: r.horario ?? undefined,
    pagamento: {
      ...r.pagamento,
      status: rel?.status ?? r.pagamento?.status ?? r.status ?? "",
    },
    total: Number(r.total),
    archivedAt: r.archived_at ?? null,
  };
}

/** Cria um pedido manual (origem = manual). Requer admin autenticado. */
export async function criarPedidoManual(
  pedido: ManualOrderInput,
): Promise<{ ok: boolean; id?: string; accessToken?: string; error?: string }> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: "Nao autenticado" };
  try {
    const res = await fetch("/api/admin/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "criar_manual", pedido }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      id?: string;
      accessToken?: string;
      error?: string;
    };
    if (res.ok && json.id && json.accessToken) {
      saveCheckoutAccess(json.id, json.accessToken);
    }
    return res.ok
      ? { ok: true, id: json.id, accessToken: json.accessToken }
      : { ok: false, error: json.error ?? "Erro" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

/** Gera um link de pagamento Asaas para o pedido. Requer admin autenticado. */
export async function gerarLinkPagamento(
  id: string,
  cpf: string,
): Promise<{ ok: boolean; invoiceUrl?: string; pagamentoId?: string; error?: string }> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: "Nao autenticado" };
  try {
    const res = await fetch("/api/admin/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "gerar_link", id, cpf }),
    });
    const json = (await res.json()) as {
      ok?: boolean; invoiceUrl?: string; pagamentoId?: string; error?: string;
    };
    return res.ok
      ? { ok: true, invoiceUrl: json.invoiceUrl, pagamentoId: json.pagamentoId }
      : { ok: false, error: json.error ?? "Erro" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

/** Marca pedido como pago em dinheiro (offline). Requer admin autenticado. */
export async function pagarDinheiro(id: string): Promise<{ ok: boolean; error?: string }> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: "Nao autenticado" };
  try {
    const res = await fetch("/api/admin/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "pagar_dinheiro", id }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    return res.ok ? { ok: true } : { ok: false, error: json.error ?? "Erro" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

/** Gera cobranca PIX via Asaas para o pedido. Requer admin autenticado. */
export async function gerarPix(
  id: string,
  cpf: string,
): Promise<{
  ok: boolean;
  pagamentoId?: string;
  qrImage?: string;
  payload?: string;
  expiraEm?: string | null;
  error?: string;
}> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: "Nao autenticado" };
  try {
    const res = await fetch("/api/admin/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "gerar_pix", id, cpf }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      pagamentoId?: string;
      qrImage?: string;
      payload?: string;
      expiraEm?: string | null;
      error?: string;
    };
    return res.ok
      ? {
          ok: true,
          pagamentoId: json.pagamentoId,
          qrImage: json.qrImage,
          payload: json.payload,
          expiraEm: json.expiraEm,
        }
      : { ok: false, error: json.error ?? "Erro" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

/** Envia o link de pagamento por e-mail para o cliente. Requer admin autenticado. */
export async function enviarLinkPorEmail(
  to: string,
  invoiceUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: "Não autenticado" };
  const html = `<p>Olá! Segue o link para pagamento do seu pedido:</p><p><a href="${invoiceUrl}">${invoiceUrl}</a></p><p>Casa Almeria</p>`;
  try {
    const res = await fetch("/api/admin/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "send", to, subject: "Link de pagamento — Casa Almeria", html }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    return res.ok ? { ok: true } : { ok: false, error: json.error ?? "Erro" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

export { rowToPedidoOperacional } from "@/lib/operacaoPedido";
