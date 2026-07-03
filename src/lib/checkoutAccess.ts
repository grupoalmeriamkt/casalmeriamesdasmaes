const STORAGE_PREFIX = "checkout_access_";

export function saveCheckoutAccess(pedidoId: string, token: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(`${STORAGE_PREFIX}${pedidoId}`, token);
}

export function getCheckoutAccess(pedidoId: string): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(`${STORAGE_PREFIX}${pedidoId}`);
}

export function checkoutAccessHeaders(pedidoId: string): Record<string, string> {
  const token = getCheckoutAccess(pedidoId);
  return token ? { "X-Checkout-Access": token } : {};
}

/** Associa o token do pedido ao pagamento (página de sucesso usa pagamentoId na URL). */
export function linkPagamentoAccess(pedidoId: string, pagamentoId: string): void {
  const token = getCheckoutAccess(pedidoId);
  if (!token || typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(`${STORAGE_PREFIX}pag_${pagamentoId}`, token);
}

export function checkoutAccessHeadersForPagamento(
  pedidoId: string | null | undefined,
  pagamentoId: string,
): Record<string, string> {
  if (typeof sessionStorage !== "undefined") {
    const byPag = sessionStorage.getItem(`${STORAGE_PREFIX}pag_${pagamentoId}`);
    if (byPag) return { "X-Checkout-Access": byPag };
  }
  if (pedidoId) return checkoutAccessHeaders(pedidoId);
  return {};
}

/** Monta URL de pagamento com token embutido (QR / link compartilhado). */
export function pagarUrl(pedidoId: string, accessToken: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams({ access: accessToken });
  return `${origin}/pagar/${pedidoId}?${params.toString()}`;
}

export type UpsertPedidoResult = { id: string; accessToken: string };

/** Normaliza retorno da RPC upsert_pedido_rascunho (uuid legado ou jsonb novo). */
export function parseUpsertPedidoResult(data: unknown): UpsertPedidoResult | null {
  if (typeof data === "string" && data.length > 0) {
    return { id: data, accessToken: "" };
  }
  if (data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    const id = row.id;
    if (typeof id === "string" && id.length > 0) {
      const accessToken =
        typeof row.access_token === "string" ? row.access_token : "";
      return { id, accessToken };
    }
  }
  return null;
}
