import { normalizePaymentStatus, type PaymentStatusNormalized } from "@/lib/paymentStatus";

/** Balde de status usado nas telas de pedidos (abas, kanban, filtros). */
export type StatusKey = "aprovado" | "pendente" | "rascunho" | "abandonado";

export function statusKeyFromNormalized(n: PaymentStatusNormalized): StatusKey {
  if (n === "aprovado") return "aprovado";
  if (n === "rascunho") return "rascunho";
  if (n === "cancelado" || n === "abandonado") return "abandonado";
  return "pendente";
}

/**
 * Deriva o balde de status de um pedido para as telas (lista/kanban/planilha).
 *
 * Defesa em profundidade: recomputa SEMPRE a partir do pagamento relevante
 * (`pagamentoStatus`, que rowToPedidoSalvo já resolve via pagamentoRelevante) +
 * o status interno do pedido. NÃO confia na coluna `payment_status_normalized`,
 * que pode ficar desatualizada quando o webhook do Asaas se perde ou a
 * conciliação diária atrasa — jogando um pedido já pago no balde "Aguardando".
 * Mesmo conserto do commit 692e28f, agora aplicado às telas.
 *
 * @param pagamentoStatus  status do pagamento relevante (ex.: "RECEIVED", "PENDING")
 * @param pedidoStatusInterno  status interno do pedido (rascunho/abandonado/cancelado/pago/…)
 */
export function statusKeyPedido(
  pagamentoStatus: string | null | undefined,
  pedidoStatusInterno?: string | null,
): StatusKey {
  const raw = pagamentoStatus || pedidoStatusInterno || "";
  const pedidoStatus = pedidoStatusInterno ?? pagamentoStatus ?? undefined;
  return statusKeyFromNormalized(normalizePaymentStatus(raw, pedidoStatus));
}
