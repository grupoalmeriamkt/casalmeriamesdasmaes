import { calcTaxaEntrega, type CampanhaDelivery, type ZonaEntrega } from "@/store/admin";

/** Frete do checkout da loja: zona (se houver) ou taxa fixa/faixa da campanha. */
export function taxaEntregaDoPedido(
  tipo: "delivery" | "retirada",
  delivery: CampanhaDelivery | undefined,
  zona: ZonaEntrega | null = null,
): number {
  if (tipo !== "delivery") return 0;
  if (delivery?.zonas?.ativo && zona) return calcTaxaEntrega(zona.taxa);
  return calcTaxaEntrega(delivery?.taxa);
}
