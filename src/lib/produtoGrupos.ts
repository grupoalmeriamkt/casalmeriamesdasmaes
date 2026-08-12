const RE_ESPECIAL = /especial|campanha|namorados|natal|p[áa]scoa|dia d|m[ãa]es|pais/i;

export function grupoDaCesta(nome: string): "especial" | "padrao" {
  return RE_ESPECIAL.test(nome) ? "especial" : "padrao";
}

export function particionarCestas<T extends { nome: string }>(cestas: T[]) {
  const padrao: T[] = [];
  const especiais: T[] = [];
  for (const c of cestas) (grupoDaCesta(c.nome) === "especial" ? especiais : padrao).push(c);
  return { padrao, especiais };
}

export type ProdutoComTamanhos = {
  id: string;
  nome: string;
  preco: number;
  tamanhos?: { id: string; label: string; preco: number }[];
};

/** Expande cada produto em linhas selecionáveis (1 por tamanho P/M/G). */
export type LinhaProdutoTamanho = {
  lineId: string;
  produtoId: string;
  nome: string;
  preco: number;
  tamanho?: string;
};

export function expandirTamanhos(produtos: ProdutoComTamanhos[]): LinhaProdutoTamanho[] {
  const out: LinhaProdutoTamanho[] = [];
  for (const p of produtos) {
    if (p.tamanhos && p.tamanhos.length > 0) {
      for (const t of p.tamanhos) {
        out.push({
          lineId: `${p.id}::${t.id}`,
          produtoId: p.id,
          nome: `${p.nome} · Tam. ${t.label}`,
          preco: t.preco,
          tamanho: t.label,
        });
      }
    } else {
      out.push({
        lineId: p.id,
        produtoId: p.id,
        nome: p.nome,
        preco: p.preco,
      });
    }
  }
  return out;
}
