export const ASAAS_FINAL_PAID = new Set(["CONFIRMED", "RECEIVED"]);
export const ASAAS_FINAL_FAILED = new Set([
  "REFUNDED",
  "REFUND_REQUESTED",
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
  "PAYMENT_DELETED",
]);
export const ASAAS_FINAL_DONE = new Set([
  ...ASAAS_FINAL_PAID,
  ...ASAAS_FINAL_FAILED,
  "OVERDUE",
]);

export type PagamentoLike = {
  id?: string;
  asaas_payment_id?: string;
  status: string;
  criado_em: string;
};

const STATUS_PRIORITY: Record<string, number> = {
  CONFIRMED: 100,
  RECEIVED: 100,
  PENDING: 20,
  AWAITING_RISK_ANALYSIS: 15,
  OVERDUE: 10,
  REFUND_REQUESTED: 5,
  REFUNDED: 1,
  PAYMENT_DELETED: 1,
};

/** Escolhe o pagamento mais relevante: pago tem prioridade sobre tentativas pendentes mais novas. */
export function pagamentoRelevante<T extends PagamentoLike>(lista: T[]): T | undefined {
  if (lista.length === 0) return undefined;
  return [...lista].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 0;
    const pb = STATUS_PRIORITY[b.status] ?? 0;
    if (pb !== pa) return pb - pa;
    return b.criado_em.localeCompare(a.criado_em);
  })[0];
}

export function pedidoStatusFromAsaas(status: string): string {
  if (ASAAS_FINAL_PAID.has(status)) return "pago";
  if (status === "OVERDUE") return "vencido";
  if (ASAAS_FINAL_FAILED.has(status)) return "cancelado";
  return "aguardando_pagamento";
}

export function pedidoStatusFromPagamentos(
  pagamentos: PagamentoLike[],
  pedidoStatus?: string,
): string {
  if (pedidoStatus === "cancelado") return "cancelado";
  const rel = pagamentoRelevante(pagamentos);
  if (rel) return pedidoStatusFromAsaas(rel.status);
  return pedidoStatus ?? "aguardando_pagamento";
}

export const ASAAS_STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Pago",
  RECEIVED: "Recebido",
  PENDING: "Aguardando pagamento",
  OVERDUE: "Vencido",
  REFUNDED: "Estornado",
  REFUND_REQUESTED: "Estorno em andamento",
  CHARGEBACK_REQUESTED: "Chargeback",
  CHARGEBACK_DISPUTE: "Chargeback",
  PAYMENT_DELETED: "Cancelado",
  AWAITING_RISK_ANALYSIS: "Em análise",
  pago: "Pago",
  credit_card: "Cartão de crédito",
  CREDIT_CARD: "Cartão de crédito",
  pix: "PIX",
  PIX: "PIX",
  boleto: "Boleto",
  BOLETO: "Boleto",
  aguardando_pagamento: "Aguardando pagamento",
  vencido: "Vencido",
  cancelado: "Cancelado",
  aprovado: "Aprovado",
  pendente: "Aguardando pagamento",
  rascunho: "Em preenchimento",
  abandonado: "Abandonado",
};

export const TIPO_PEDIDO_LABEL: Record<string, string> = {
  delivery: "Entrega",
  retirada: "Retirada",
};

export function labelStatusPagamento(status?: string): string {
  if (!status) return "—";
  return ASAAS_STATUS_LABEL[status] ?? ASAAS_STATUS_LABEL[status.toLowerCase()] ?? status;
}

export function labelTipoPedido(tipo?: string): string {
  if (!tipo) return "—";
  return TIPO_PEDIDO_LABEL[tipo] ?? tipo;
}
