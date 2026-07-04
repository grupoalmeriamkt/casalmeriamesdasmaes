export type FalhaPagamento = {
  motivo: string;
  em: string;
  metodo: string;
};

export function parseFalhaPagamento(
  pagamento?: Record<string, unknown> | null,
): FalhaPagamento | null {
  const raw = pagamento?.falha_pagamento;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const motivo = typeof o.motivo === "string" ? o.motivo.trim() : "";
  if (!motivo) return null;
  return {
    motivo,
    em: typeof o.em === "string" ? o.em : "",
    metodo: typeof o.metodo === "string" ? o.metodo : "",
  };
}

export function mergeFalhaPagamento(
  existingPag: Record<string, unknown>,
  falha: FalhaPagamento,
): Record<string, unknown> {
  return {
    ...existingPag,
    metodo: falha.metodo.toLowerCase() === "credit_card" ? "credit_card" : existingPag.metodo,
    status: "aguardando_pagamento",
    falha_pagamento: falha,
  };
}

export function limparFalhaPagamento(existingPag: Record<string, unknown>): Record<string, unknown> {
  const next = { ...existingPag };
  delete next.falha_pagamento;
  return next;
}
