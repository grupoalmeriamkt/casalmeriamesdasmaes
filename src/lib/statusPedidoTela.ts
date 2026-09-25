import { normalizePaymentStatus, type PaymentStatusNormalized } from "@/lib/paymentStatus";
import { PEDIDO_EXPIRADO } from "@/lib/prazoPagamento";

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

/**
 * Fila do portal de operação: pedido aprovado que ainda não saiu da fila.
 * Sai da fila quem foi arquivado OU concluído (`concluido_at`) — mesmo corte que
 * a central de pedidos já aplica; sem ele, um pedido concluído na central
 * continuava aparecendo no portal com o selo "Concluído".
 */
export function pedidoNaFilaAprovados(
  p: {
    archivedAt?: string | null;
    concluidoAt?: string | null;
    pagamento?: { status?: string | null };
  },
  pedidoStatusInterno?: string | null,
): boolean {
  if (p.archivedAt || p.concluidoAt) return false;
  return statusKeyPedido(p.pagamento?.status, pedidoStatusInterno) === "aprovado";
}

/** Por que o pedido está na lista de recuperação da operação. */
export type MotivoRecuperacao = "aguardando" | "vencido" | "expirado";

export const MOTIVO_RECUPERACAO_LABEL: Record<MotivoRecuperacao, string> = {
  aguardando: "Aguardando pagamento",
  vencido: "Vencido",
  expirado: "Prazo esgotado",
};

/**
 * Pedido que a operação pode tentar recuperar: o cliente chegou à cobrança e não pagou.
 * Ficam de fora os aprovados, os rascunhos (nem geraram cobrança), os cancelados e
 * abandonados, e tudo que já foi arquivado ou concluído.
 */
export function motivoRecuperacaoPedido(
  p: {
    archivedAt?: string | null;
    concluidoAt?: string | null;
    pagamento?: { status?: string | null };
  },
  pedidoStatusInterno?: string | null,
): MotivoRecuperacao | null {
  if (p.archivedAt || p.concluidoAt) return null;
  if (pedidoStatusInterno === PEDIDO_EXPIRADO) return "expirado";
  const normalizado = normalizePaymentStatus(
    p.pagamento?.status ?? pedidoStatusInterno,
    pedidoStatusInterno ?? undefined,
  );
  if (normalizado === "aguardando") return "aguardando";
  if (normalizado === "vencido") return "vencido";
  return null;
}
