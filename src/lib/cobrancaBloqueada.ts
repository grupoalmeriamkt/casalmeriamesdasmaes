import { ASAAS_FINAL_PAID, isCobrancaAsaasCancelavel } from "@/lib/asaasStatus";
import { PEDIDO_EXPIRADO, prazoEsgotado } from "@/lib/prazoPagamento";

/**
 * O que fazer com uma cobrança do Asaas cujo pedido não pode mais ser pago:
 * - `cancelar_cobranca`: pedido excluído/cancelado e cobrança ainda aberta (link morre).
 * - `estornar`: pedido excluído/cancelado e o cliente pagou mesmo assim.
 * - `expirar_pedido`: prazo de pagamento vencido e cobrança aberta (expira e cancela).
 * Pagamento de pedido expirado segue a regra de tolerância de aplicarPrazoNaConfirmacao.
 */
export type AcaoCobrancaBloqueada = "cancelar_cobranca" | "estornar" | "expirar_pedido";

export function decidirAcaoCobranca(input: {
  statusAsaas: string;
  pedidoStatus: string | null | undefined;
  pedidoExcluido: boolean;
  expiraEm: string | null | undefined;
  /** O pagamento já constava como pago antes deste evento (evento repetido/tardio). */
  jaPagoAntes: boolean;
  now?: Date;
}): AcaoCobrancaBloqueada | null {
  const status = input.statusAsaas.trim();
  if (!status) return null;
  const pago = ASAAS_FINAL_PAID.has(status);
  const aberta = !pago && isCobrancaAsaasCancelavel(status);
  const encerrado = input.pedidoExcluido || input.pedidoStatus === "cancelado";

  if (encerrado) {
    if (aberta) return "cancelar_cobranca";
    // Baixa manual no Asaas é decisão da equipe; pagamento antigo não é mexido.
    if (pago && !input.jaPagoAntes && status !== "RECEIVED_IN_CASH") return "estornar";
    return null;
  }

  if (
    aberta &&
    input.pedidoStatus !== "pago" &&
    (input.pedidoStatus === PEDIDO_EXPIRADO || prazoEsgotado(input.expiraEm, input.now))
  ) {
    return "expirar_pedido";
  }
  return null;
}
