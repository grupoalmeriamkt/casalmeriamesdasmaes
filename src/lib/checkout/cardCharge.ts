/**
 * Utilitários de cobrança de cartão para o checkout transparente (/pagar/$id).
 * Reaproveita o endpoint público POST /api/public/asaas/charge (metodo CREDIT_CARD),
 * que valida itens/total/cupom server-side contra o pedido do banco.
 */

export const onlyDigits = (s: string) => s.replace(/\D/g, "");

export function maskCard(v: string) {
  return onlyDigits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}
export function maskExpiry(v: string) {
  const d = onlyDigits(v).slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
}
export function maskCpf(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
export function maskCep(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type CardChargeInput = {
  pedidoId: string;
  cliente: { nome: string; whatsapp: string; cpf: string; email: string };
  itens: { nome: string; quantidade: number; preco: number }[];
  total: number;
  cartao: { holderName: string; number: string; expiry: string; ccv: string };
  endereco: { cep: string; numero: string; complemento?: string };
};

export type CardChargeResult =
  | { ok: true; status: string; pagamentoId: string; cartao?: { last4?: string; brand?: string } }
  | { ok: false; motivo: string };

/** Envia a cobrança de cartão. Erros do Asaas voltam com `motivo` legível. */
export async function submitCardCharge(input: CardChargeInput): Promise<CardChargeResult> {
  const [mm, yyRaw = ""] = input.cartao.expiry.split("/");
  const cardData = {
    holderName: input.cartao.holderName.trim(),
    number: onlyDigits(input.cartao.number),
    expiryMonth: mm,
    expiryYear: yyRaw.length === 2 ? `20${yyRaw}` : yyRaw,
    ccv: onlyDigits(input.cartao.ccv),
  };
  const holderInfo = {
    postalCode: onlyDigits(input.endereco.cep),
    addressNumber: input.endereco.numero,
    addressComplement: input.endereco.complemento?.trim() || undefined,
  };
  try {
    const res = await fetch("/api/public/asaas/charge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pedidoId: input.pedidoId,
        cliente: {
          nome: input.cliente.nome,
          cpf: onlyDigits(input.cliente.cpf),
          email: input.cliente.email.trim(),
          whatsapp: onlyDigits(input.cliente.whatsapp),
        },
        itens: input.itens,
        total: input.total,
        metodo: "CREDIT_CARD",
        cartao: cardData,
        holderInfo,
      }),
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* resposta não-JSON */
    }
    if (!res.ok) {
      return {
        ok: false,
        motivo: (data.motivo as string) ?? (data.error as string) ?? `Erro ${res.status}`,
      };
    }
    return {
      ok: true,
      status: (data.status as string) ?? "CONFIRMED",
      pagamentoId: data.pagamentoId as string,
      cartao: data.cartao as { last4?: string; brand?: string } | undefined,
    };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : "Erro de rede" };
  }
}

/** Consulta o status até virar final (pago) ou esgotar as tentativas. */
export async function pollStatus(
  pagamentoId: string,
  { intervalMs = 3000, maxAttempts = 5 } = {},
): Promise<{ status: string; pago: boolean } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`/api/public/asaas/status/${pagamentoId}`);
      if (res.ok) {
        const d = (await res.json()) as { status: string; pago: boolean };
        if (d.pago) return d;
      }
    } catch {
      /* rede — tenta de novo */
    }
    if (i < maxAttempts - 1) await sleep(intervalMs);
  }
  return null;
}
