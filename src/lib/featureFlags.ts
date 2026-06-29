/** Feature flag: nova experiência operacional em /pedidos/{token} (preview até aceite). */
export function isOperacaoPedidosEnabled(): boolean {
  const vite =
    typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_FEATURE_OPERACAO_PEDIDOS;
  if (vite === "true" || vite === "1") return true;
  if (vite === "false" || vite === "0") return false;
  return false;
}

/** Server-side (rotas /api). */
export function isOperacaoPedidosEnabledServer(): boolean {
  if (typeof process !== "undefined" && process.env.FEATURE_OPERACAO_PEDIDOS === "true") {
    return true;
  }
  return isOperacaoPedidosEnabled();
}
