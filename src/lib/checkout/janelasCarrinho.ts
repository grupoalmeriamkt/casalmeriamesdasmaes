import {
  buildRegrasForItens,
  getAvailableWindows,
  regraMaisRestritiva,
  type CarrinhoItem,
  type ProdutoRegras,
} from "@/lib/availability";

/**
 * Regra do carrinho montada como a cobrança monta (todos os itens como "cesta", regra pelo nome),
 * para o checkout só oferecer data e horário que o servidor aceita.
 */
export function regraDoCarrinho(
  itens: readonly { produtoId: string; nome: string }[],
): ProdutoRegras | null {
  if (itens.length === 0) return null;
  const carrinho: CarrinhoItem[] = itens.map((it) => ({
    produto_id: it.produtoId,
    produto_tipo: "cesta",
    nome: it.nome,
  }));
  return regraMaisRestritiva(buildRegrasForItens(carrinho));
}

/** Horários aceitos na data: antecedência mínima do carrinho e primeiro horário de segunda. */
export function horariosAceitos(
  regra: ProdutoRegras | null,
  isoDate: string,
  agora: Date,
  labels: readonly string[],
): Set<string> {
  if (!regra) return new Set(labels);
  return new Set(getAvailableWindows(regra, isoDate, agora, [...labels]).map((w) => w.label));
}
