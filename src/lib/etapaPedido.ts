import type { CSSProperties } from "react";
import type { PaymentStatusNormalized } from "@/lib/paymentStatus";

/** Etapa de produção (separada do status de pagamento). */
export type FulfillmentStage = "confirmado" | "em_preparo" | "pronto" | "finalizado";

export const STAGE_ORDER: FulfillmentStage[] = [
  "confirmado",
  "em_preparo",
  "pronto",
  "finalizado",
];

export const STAGE_LABEL: Record<FulfillmentStage, string> = {
  confirmado: "Confirmado",
  em_preparo: "Em preparo",
  pronto: "Pronto",
  finalizado: "Finalizado",
};

/**
 * Próxima etapa a partir da atual. `null`/indefinido → "confirmado" (primeiro avanço);
 * "finalizado" → `null` (não há próxima).
 */
export function proximaEtapa(
  s: FulfillmentStage | null | undefined,
): FulfillmentStage | null {
  if (!s) return "confirmado";
  const i = STAGE_ORDER.indexOf(s);
  if (i < 0) return "confirmado";
  return STAGE_ORDER[i + 1] ?? null;
}

/** Índice 0-based da etapa (para o stepper). `null` → -1 (nada concluído). */
export function indiceEtapa(s: FulfillmentStage | null | undefined): number {
  if (!s) return -1;
  return STAGE_ORDER.indexOf(s);
}

export type Chip = { bg: string; fg: string; label: string };

/** Chips de etapa — hexes exatos do handoff. */
export const STAGE_CHIP: Record<FulfillmentStage, Chip> = {
  confirmado: { bg: "#E1ECF5", fg: "#2A5C8A", label: "Confirmado" },
  em_preparo: { bg: "#FAEFD3", fg: "#97700F", label: "Em preparo" },
  pronto: { bg: "#E2EFE3", fg: "#1E7A4F", label: "Pronto" },
  finalizado: { bg: "#ECE4D5", fg: "#7A7263", label: "Finalizado" },
};

const RASCUNHO_CHIP: Chip = { bg: "#ECE4D5", fg: "#7A7263", label: "Rascunho" };

export function stageChip(s: FulfillmentStage | null | undefined): Chip {
  return s ? STAGE_CHIP[s] : RASCUNHO_CHIP;
}

/** Chips de pagamento — hexes exatos do handoff. */
export const PAY_CHIP: Record<PaymentStatusNormalized, Chip> = {
  aprovado: { bg: "#E2EFE3", fg: "#1E7A4F", label: "Pago" },
  aguardando: { bg: "#FAEFD3", fg: "#97700F", label: "Aguardando" },
  vencido: { bg: "#F6E1E0", fg: "#B0414C", label: "Vencido" },
  cancelado: { bg: "#ECE4D5", fg: "#7A7263", label: "Cancelado" },
  rascunho: { bg: "#ECE4D5", fg: "#7A7263", label: "Rascunho" },
  abandonado: { bg: "#ECE4D5", fg: "#7A7263", label: "Abandonado" },
};

/** Chips de tipo (delivery/retirada) — hexes exatos do handoff. */
export const TYPE_CHIP: Record<"delivery" | "retirada", Chip> = {
  delivery: { bg: "#EAE2F3", fg: "#6B4FA0", label: "Delivery" },
  retirada: { bg: "#E5EDE6", fg: "#4A6B53", label: "Retirada" },
};

export function typeChip(tipo: string | null | undefined): Chip | null {
  if (tipo === "delivery") return TYPE_CHIP.delivery;
  if (tipo === "retirada") return TYPE_CHIP.retirada;
  return null;
}

/** Estilo inline de um chip (cores do handoff). */
export function chipStyle(c: Chip): CSSProperties {
  return { backgroundColor: c.bg, color: c.fg };
}
