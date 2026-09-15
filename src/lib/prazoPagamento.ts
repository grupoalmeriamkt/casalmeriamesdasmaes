/**
 * Prazo para pagar um pedido. O cronômetro começa quando o cliente abre a tela de
 * pagamento (ou quando a equipe gera o PIX/link). Acabou o tempo sem pagamento, o
 * pedido vira "expirado" e não aceita nova cobrança — o cliente monta outro pedido.
 */

export const PEDIDO_EXPIRADO = "expirado";

export const PRAZO_PAGAMENTO_MS = 2 * 60_000;

/** Confirmação que chega até 1 min depois do prazo ainda é aceita (banco/Asaas atrasam). */
export const TOLERANCIA_CONFIRMACAO_MS = 60_000;

export const MSG_PRAZO_EXPIRADO =
  "O tempo para pagamento acabou. Monte um novo pedido para continuar.";

function instante(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

export function calcularPrazoPagamento(now: Date = new Date()): string {
  return new Date(now.getTime() + PRAZO_PAGAMENTO_MS).toISOString();
}

export function prazoEsgotado(
  expiraEm: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const t = instante(expiraEm);
  return t !== null && now.getTime() >= t;
}

export function confirmacaoForaDoPrazo(
  expiraEm: string | null | undefined,
  confirmadoEm: Date,
): boolean {
  const t = instante(expiraEm);
  return t !== null && confirmadoEm.getTime() > t + TOLERANCIA_CONFIRMACAO_MS;
}

export function segundosRestantes(
  expiraEm: string | null | undefined,
  now: Date = new Date(),
): number {
  const t = instante(expiraEm);
  if (t === null) return 0;
  return Math.max(0, Math.ceil((t - now.getTime()) / 1000));
}

export function formatarContagem(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Decide o que fazer com um pagamento que o Asaas confirmou.
 * - `confirmadoEm` conhecido (webhook/polling ao vivo): estorna se passou do prazo + tolerância.
 * - Horário desconhecido (conciliação tardia): só estorna pedido já expirado — a expiração
 *   conferiu no Asaas que a cobrança não estava paga, então o pagamento veio depois.
 */
export function decidirConfirmacao(input: {
  pedidoStatus: string | null | undefined;
  expiraEm: string | null | undefined;
  confirmadoEm?: Date | null;
}): "aceitar" | "estornar" {
  if (input.pedidoStatus === "pago") return "aceitar";
  if (!input.expiraEm) return "aceitar";
  if (input.confirmadoEm) {
    return confirmacaoForaDoPrazo(input.expiraEm, input.confirmadoEm) ? "estornar" : "aceitar";
  }
  return input.pedidoStatus === PEDIDO_EXPIRADO ? "estornar" : "aceitar";
}

/** `dateCreated` dos eventos do Asaas vem em horário de Brasília: "2026-09-15 14:03:22". */
export function parseDataHoraAsaas(valor: string | null | undefined): Date | null {
  const m = valor?.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
