/** Token padrão do portal de operação (seed da migration operacao_portal). */
export const PORTAL_OPERACAO_TOKEN_PADRAO = "eb18ba2c5d29e3784d5145b95e57d9e3";

export function isTokenPortalOperacao(
  urlToken: string,
  portalToken?: string | null,
): boolean {
  const t = urlToken.trim();
  if (portalToken && t === portalToken) return true;
  return t === PORTAL_OPERACAO_TOKEN_PADRAO;
}

export function resolvePortalOperacaoToken(portalToken?: string | null): string {
  return portalToken?.trim() || PORTAL_OPERACAO_TOKEN_PADRAO;
}
