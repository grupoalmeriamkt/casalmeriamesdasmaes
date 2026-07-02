export type MetodoPagamento = "PIX" | "CREDIT_CARD" | "BOLETO";

/** Converte o billingType do Asaas no nosso enum de metodo. Retorna null para UNDEFINED/desconhecido. */
export function mapBillingTypeToMetodo(
  billingType: string | null | undefined,
): MetodoPagamento | null {
  switch (billingType) {
    case "PIX":
    case "CREDIT_CARD":
    case "BOLETO":
      return billingType;
    default:
      return null;
  }
}
