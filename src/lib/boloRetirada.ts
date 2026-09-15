import { parseTamanhoDoNome } from "./cestaTamanho";

/** Decisão da loja: bolos não são entregues, só retirados na loja. */
export const MSG_BOLO_ENTREGA_INDISPONIVEL =
  "Bolos são apenas para retirada na loja — não fazemos entrega de bolos.";

export const MSG_BOLO_SO_RETIRADA =
  "Bolos não são entregues, apenas retirados na loja. Escolha Retirada para finalizar o pedido.";

export const MSG_BOLO_PEDIDO_SEPARADO =
  "Seu pedido tem bolo, e bolos não são entregues — só retirada na loja. Para finalizar, escolha Retirada e retire tudo na loja, ou faça pedidos separados: um só com os bolos, para retirada, e outro com os demais itens, para entrega.";

const RE_NOME_BOLO = /\bbolos?\b|\bnaked\s*cakes?\b|\btortas?\b/i;
/** A categoria dos bolos está cadastrada como "Tortas" e aparece como "Bolos" no site. */
const RE_CATEGORIA_BOLO = /^(bolos?|tortas?)$/i;

type ProdutoCatalogo = { id?: string; nome?: string; categoriaId?: string | null };
type CategoriaCatalogo = { id: string; nome?: string };

export type CatalogoBolos = {
  produtos?: readonly ProdutoCatalogo[] | null;
  categorias?: readonly CategoriaCatalogo[] | null;
};

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Só pelo nome, ignorando o sufixo " · Tam. X": bolo, naked cake ou torta. */
export function ehNomeBolo(nome: string | null | undefined): boolean {
  return RE_NOME_BOLO.test(parseTamanhoDoNome(nome ?? "").nomeBase);
}

/**
 * Item é bolo pelo nome ou por estar na categoria Bolos/Tortas do catálogo.
 * No servidor o pedido só guarda o nome, então o produto é achado pelo nome sem tamanho.
 */
export function ehItemBolo(
  item: { produtoId?: string; nome?: string | null },
  catalogo?: CatalogoBolos,
): boolean {
  if (ehNomeBolo(item.nome)) return true;
  const produtos = catalogo?.produtos ?? [];
  const categorias = catalogo?.categorias ?? [];
  const idsCategoriaBolo = new Set(
    categorias.filter((c) => RE_CATEGORIA_BOLO.test((c.nome ?? "").trim())).map((c) => c.id),
  );
  if (produtos.length === 0 || idsCategoriaBolo.size === 0) return false;
  const nomeBase = normalizar(parseTamanhoDoNome(item.nome ?? "").nomeBase);
  const produto =
    (item.produtoId ? produtos.find((p) => p.id === item.produtoId) : undefined) ??
    produtos.find((p) => normalizar(p.nome ?? "") === nomeBase);
  return !!produto?.categoriaId && idsCategoriaBolo.has(produto.categoriaId);
}
