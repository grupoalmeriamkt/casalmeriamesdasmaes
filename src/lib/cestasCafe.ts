/** Cestas de café da manhã P/M/G — produtos separados na loja e no admin. */

export const CESTA_CAFE_IDS = {
  p: "cesta-cafe-p",
  m: "cesta-cafe-m",
  g: "cesta-cafe-g",
} as const;

const RE_CESTA_CAFE = /cesta\s+(de\s+)?caf[eé](\s+da\s+manh[ãa])?/i;
const RE_TAMANHOS_PMG = /tamanhos?\s*p\s*,?\s*m\s*(e|,)?\s*g/i;
const IDS_SEPARADOS = new Set<string>(Object.values(CESTA_CAFE_IDS));

export type CestaCafeSeed = {
  id: string;
  nome: string;
  badge: string;
  preco: number;
  descricao: string;
  itens: string[];
  imagem: string;
  categoriaId: string;
};

export const CESTAS_CAFE_POR_TAMANHO: CestaCafeSeed[] = [
  {
    id: CESTA_CAFE_IDS.p,
    nome: "Cesta de Café da Manhã P",
    badge: "Tamanho P",
    preco: 150,
    descricao:
      "Cesta individual com croissant, petit four da casa, doce de chocolate, pães artesanais, suco de laranja, café e geleia.",
    imagem: "/cesta-cafe-p.jpg",
    categoriaId: "cat-cestas",
    itens: [
      "1x Caixa de petit four Casa Almeria Empório",
      "1x Doce de chocolate com granulado",
      "1x Croissant",
      "1x Pães artesanais da casa",
      "1x Suco de laranja natural",
      "1x Café drip 3 Corações",
      "1x Potinho de geleia",
    ],
  },
  {
    id: CESTA_CAFE_IDS.m,
    nome: "Cesta de Café da Manhã M",
    badge: "Tamanho M",
    preco: 260,
    descricao:
      "Cesta para compartilhar: croissant, cinnamon roll, slice cake, sanduíches, salada de frutas, sucos, café e acompanhamentos. Slice cake com sabor do dia.",
    imagem: "/cesta-cafe-m.jpg",
    categoriaId: "cat-cestas",
    itens: [
      "2x Suco de laranja natural",
      "1x Café drip 3 Corações",
      "1x Croissant",
      "1x Cinnamon roll",
      "1x Slice cake (sabor do dia)",
      "2x Sanduíches ou pães da casa",
      "1x Salada de frutas",
      "1x Potinho de granola",
      "1x Potinho de geleia",
      "1x Potinho de iogurte ou creme",
      "1x Potinho de pasta",
    ],
  },
  {
    id: CESTA_CAFE_IDS.g,
    nome: "Cesta de Café da Manhã G",
    badge: "Tamanho G",
    preco: 330,
    descricao:
      "A cesta completa para presentear: croissant, cinnamon roll, fatias de bolo, brigadeiros, queijo, salada de frutas, sucos, café e pães artesanais.",
    imagem: "/cesta-cafe-g.jpg",
    categoriaId: "cat-cestas",
    itens: [
      "2x Suco de laranja natural",
      "1x Café especial",
      "1x Croissant",
      "1x Cinnamon roll",
      "2x Fatias de bolo",
      "1x Pão baguete artesanal",
      "1x Seleção de pães da casa",
      "1x Pote com brigadeiros (4 un.)",
      "1x Queijo fatiado",
      "1x Salada de frutas",
      "1x Potinho de geleia",
      "1x Potinho de cream cheese ou requeijão",
    ],
  },
];

type CestaLike = {
  id: string;
  nome: string;
  preco: number;
  badge?: string;
  descricao?: string;
  itens?: string[];
  imagem?: string;
  tamanhos?: { label: string; preco: number }[];
  ativo?: boolean;
  arquivado?: boolean;
  categoriaId?: string;
};

type CampanhaLike = {
  slug?: string;
  produtosPrincipaisIds?: string[];
  upsellProdutoIds?: string[];
};

type CategoriaLike = {
  id: string;
  nome: string;
  ordem?: number;
};

const RE_NOME_CESTAS = /^cestas?$/i;

/** Garante uma categoria chamada "Cestas". Se `cat-cestas` foi renomeada (ex.: Tortas), cria outra. */
export function garantirCategoriaCestas<Cat extends CategoriaLike>(
  categorias: Cat[],
): { categorias: Cat[]; id: string; mudou: boolean } {
  const porNome = categorias.find((c) => RE_NOME_CESTAS.test((c.nome ?? "").trim()));
  if (porNome) return { categorias, id: porNome.id, mudou: false };

  const id = categorias.some((c) => c.id === "cat-cestas") ? "cat-cestas-cafe" : "cat-cestas";
  const nova = { id, nome: "Cestas", ordem: 0 } as Cat;
  return { categorias: [nova, ...categorias], id, mudou: true };
}

function precoDoTamanho(origem: CestaLike | undefined, label: string, fallback: number) {
  const t = origem?.tamanhos?.find((x) => {
    const l = String(x.label ?? "")
      .trim()
      .toUpperCase();
    return (
      l === label || l === `TAM. ${label}` || l.startsWith(`${label} `) || l.endsWith(` ${label}`)
    );
  });
  return typeof t?.preco === "number" && t.preco > 0 ? t.preco : fallback;
}

function labelsTamanho(c: CestaLike): string[] {
  return (c.tamanhos ?? []).map((t) =>
    String(t.label ?? "")
      .trim()
      .toUpperCase(),
  );
}

function temTamanho(labels: string[], letra: string): boolean {
  return labels.some(
    (l) =>
      l === letra || l === `TAM. ${letra}` || l.startsWith(`${letra} `) || l.endsWith(` ${letra}`),
  );
}

export function ehCestaCafeSeparada(id: string): boolean {
  return IDS_SEPARADOS.has(id);
}

function ehNomeCestaCafe(nome: string | undefined): boolean {
  return RE_CESTA_CAFE.test(nome ?? "");
}

/** Item do carrinho/checkout: cesta P/M/G separada ou nome de café da manhã. */
export function ehItemCestaCafe(item: { produtoId?: string; id?: string; nome?: string }): boolean {
  const id = item.produtoId || item.id || "";
  if (id && ehCestaCafeSeparada(id)) return true;
  return ehNomeCestaCafe(item.nome);
}

/** Cesta de café ainda cadastrada como um único produto com P/M/G. */
export function ehCestaCafeAgrupada(c: CestaLike): boolean {
  if (ehCestaCafeSeparada(c.id)) return false;
  // Só o nome vale: o selo "TAMANHOS P, M E G" também existe nas tortas.
  if (!ehNomeCestaCafe(c.nome)) return false;
  const labels = labelsTamanho(c);
  const pmg = ["P", "M", "G"].filter((l) => temTamanho(labels, l));
  return pmg.length >= 2 || (c.tamanhos?.length ?? 0) >= 2;
}

/** Bolo/torta com P/M/G — não é cesta de café. */
export function ehBoloComTamanhos(c: CestaLike): boolean {
  if (ehCestaCafeSeparada(c.id) || ehNomeCestaCafe(c.nome)) return false;
  const labels = labelsTamanho(c);
  const pmg = ["P", "M", "G"].filter((l) => temTamanho(labels, l));
  return pmg.length >= 2 || (c.tamanhos?.length ?? 0) >= 2;
}

/** Separa a cesta P/M/G em três produtos e troca o id na campanha cestas-cafe. */
export function aplicarCestasCafePorTamanho<
  C extends CestaLike,
  Camp extends CampanhaLike,
  Cat extends CategoriaLike,
>(
  cestas: C[],
  campanhas: Camp[],
  categorias: Cat[] = [] as Cat[],
): { cestas: C[]; campanhas: Camp[]; categorias: Cat[]; mudou: boolean } {
  const origens = cestas.filter(ehCestaCafeAgrupada);
  const origem = origens[0];
  const nextCestas = [...cestas];
  const index = new Map(nextCestas.map((c, i) => [c.id, i] as const));
  const catCestas = garantirCategoriaCestas(categorias);
  const categoriaCestasId = catCestas.id;
  const nextCategorias = catCestas.categorias;
  let mudou = catCestas.mudou;

  for (const seed of CESTAS_CAFE_POR_TAMANHO) {
    const label = seed.id === CESTA_CAFE_IDS.p ? "P" : seed.id === CESTA_CAFE_IDS.m ? "M" : "G";
    const preco = precoDoTamanho(origem, label, seed.preco);
    const i = index.get(seed.id);
    if (i === undefined) {
      nextCestas.push({
        ...seed,
        preco,
        categoriaId: categoriaCestasId,
        ativo: true,
        arquivado: false,
      } as unknown as C);
      index.set(seed.id, nextCestas.length - 1);
      mudou = true;
      continue;
    }
    const atual = nextCestas[i];
    const imagemVazia = !atual.imagem || /unsplash|placeholder/i.test(atual.imagem);
    const itensVazios = !atual.itens?.length;
    const descricaoGenerica =
      !atual.descricao || /tamanhos p, m e g|slice cake disponível/i.test(atual.descricao);
    const nomeGenerico =
      !atual.nome ||
      /tamanhos p, m e g|· Tam\./i.test(atual.nome) ||
      atual.nome === "Cesta de Café da Manhã";
    const aindaAgrupada = (atual.tamanhos?.length ?? 0) > 0;
    const categoriaErrada = atual.categoriaId !== categoriaCestasId;
    if (
      imagemVazia ||
      itensVazios ||
      descricaoGenerica ||
      nomeGenerico ||
      aindaAgrupada ||
      categoriaErrada
    ) {
      nextCestas[i] = {
        ...atual,
        nome: nomeGenerico ? seed.nome : atual.nome,
        badge: atual.badge && !RE_TAMANHOS_PMG.test(atual.badge) ? atual.badge : seed.badge,
        preco: atual.preco > 0 ? atual.preco : preco,
        descricao: descricaoGenerica ? seed.descricao : atual.descricao,
        itens: itensVazios ? seed.itens : atual.itens,
        imagem: imagemVazia ? seed.imagem : atual.imagem,
        categoriaId: categoriaCestasId,
        ativo: true,
        arquivado: false,
        tamanhos: aindaAgrupada ? undefined : atual.tamanhos,
      };
      mudou = true;
    }
  }

  for (const agrupada of origens) {
    const i = index.get(agrupada.id);
    if (i !== undefined && (nextCestas[i].ativo !== false || !nextCestas[i].arquivado)) {
      nextCestas[i] = {
        ...nextCestas[i],
        ativo: false,
        arquivado: true,
      };
      mudou = true;
    }
  }

  // O selo "TAMANHOS P, M E G" fez o filtro antigo arquivar as tortas. Reabre.
  for (let i = 0; i < nextCestas.length; i++) {
    const c = nextCestas[i];
    if (!ehBoloComTamanhos(c)) continue;
    if (c.ativo !== false && !c.arquivado) continue;
    nextCestas[i] = { ...c, ativo: true, arquivado: false };
    mudou = true;
  }

  const novosIds = CESTAS_CAFE_POR_TAMANHO.map((s) => s.id);
  const origemIds = new Set(origens.map((o) => o.id));
  const nextCampanhas = campanhas.map((camp) => {
    const ids = camp.produtosPrincipaisIds ?? [];
    const temNovos = novosIds.every((id) => ids.includes(id));
    const mencionaOrigem = ids.some((id) => origemIds.has(id));
    const ehCestasCafe = camp.slug === "cestas-cafe";

    if (temNovos && !mencionaOrigem) return camp;

    if (!mencionaOrigem && !ehCestasCafe) return camp;

    let nextIds = ids.filter((id) => !origemIds.has(id));
    for (const id of novosIds) {
      if (!nextIds.includes(id)) nextIds.push(id);
    }
    if (ehCestasCafe && nextIds.length === 0) nextIds = [...novosIds];

    const upsell = (camp.upsellProdutoIds ?? []).map((id) =>
      origemIds.has(id) ? novosIds[1] : id,
    );

    mudou = true;
    return {
      ...camp,
      produtosPrincipaisIds: nextIds,
      ...(camp.upsellProdutoIds ? { upsellProdutoIds: upsell } : {}),
    };
  });

  return { cestas: nextCestas, campanhas: nextCampanhas, categorias: nextCategorias, mudou };
}
