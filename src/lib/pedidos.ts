import { supabase } from "@/integrations/supabase/client";
import type { PedidoSalvo } from "@/store/admin";

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
    extras?: {
      cartoes?: { nome: string; preco: number; mensagem: string }[];
      polaroids?: { nome: string; preco: number; arquivoUrl: string; arquivoNome: string }[];
    };
  };
  total: number;
  status: string;
  pagamentos?: PagamentoAsaasRow[];
};

type PedidoParcial = Partial<Omit<PedidoSalvo, "id" | "criadoEm">> & {
  cliente: { nome: string; whatsapp: string };
};

function toPayload(p: PedidoParcial, statusOverride?: string) {
  return {
    cliente_nome: p.cliente.nome,
    cliente_whatsapp: p.cliente.whatsapp,
    cesta: p.cesta ?? null,
    sobremesas: p.sobremesas ?? [],
    tipo: p.tipo ?? "",
    endereco_ou_unidade: p.enderecoOuUnidade ?? "",
    data_entrega: p.data ?? null,
    horario: p.horario ?? null,
    pagamento: p.pagamento ?? { metodo: "", status: statusOverride ?? "rascunho" },
    total: p.total ?? 0,
    status: statusOverride ?? p.pagamento?.status ?? "rascunho",
  };
}

/** Cria/atualiza um rascunho de pedido. Usa RPC pública. */
export async function upsertRascunho(
  p: PedidoParcial,
  pedidoId?: string,
): Promise<{ id: string; error: Error | null }> {
  const payload = toPayload(p, "rascunho");
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
): Promise<{ id: string; error: Error | null }> {
  const payload = toPayload(p, p.pagamento.status ?? "aprovado");
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

/** Converte row do banco em PedidoSalvo para reaproveitar UI antiga. */
export function rowToPedidoSalvo(r: PedidoRow): PedidoSalvo {
  return {
    id: r.id,
    criadoEm: r.criado_em,
    cliente: { nome: r.cliente_nome, whatsapp: r.cliente_whatsapp },
    cesta: r.cesta ?? undefined,
    sobremesas: r.sobremesas ?? [],
    tipo: r.tipo,
    enderecoOuUnidade: r.endereco_ou_unidade,
    data: r.data_entrega ?? undefined,
    horario: r.horario ?? undefined,
    pagamento: r.pagamento,
    total: Number(r.total),
  };
}
