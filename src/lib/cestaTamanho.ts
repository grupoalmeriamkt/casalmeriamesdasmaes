/** Sufixo gravado no checkout: " · Tam. M" */
const TAMANHO_SUFFIX_RE = /\s*[·\-]\s*Tam\.\s*(.+)$/i;

export type CestaItemSalvo = {
  nome: string;
  quantidade: number;
  preco: number;
  tamanho?: string;
};

export function parseTamanhoDoNome(nome: string): { nomeBase: string; tamanho: string | null } {
  const m = nome.match(TAMANHO_SUFFIX_RE);
  if (!m) return { nomeBase: nome.trim(), tamanho: null };
  return {
    nomeBase: nome.slice(0, m.index).trim(),
    tamanho: m[1].trim(),
  };
}

export function appendTamanhoAoNome(nome: string, tamanho?: string | null): string {
  if (!tamanho) return nome;
  const { nomeBase } = parseTamanhoDoNome(nome);
  return `${nomeBase} · Tam. ${tamanho}`;
}

export function resolveCestaItem(item: CestaItemSalvo): {
  nomeBase: string;
  tamanho: string | null;
  quantidade: number;
} {
  const parsed = parseTamanhoDoNome(item.nome);
  return {
    nomeBase: parsed.nomeBase,
    tamanho: item.tamanho ?? parsed.tamanho,
    quantidade: item.quantidade,
  };
}

export function buildCestaPayloadFromState(cesta: {
  cesta: { nome: string; tamanhos?: { id: string; label: string; preco: number }[] };
  quantidade: number;
}, tamanhoId: string | undefined, preco: number): CestaItemSalvo | undefined {
  const tam = tamanhoId ? cesta.cesta.tamanhos?.find((t) => t.id === tamanhoId) : undefined;
  return {
    nome: appendTamanhoAoNome(cesta.cesta.nome, tam?.label),
    quantidade: cesta.quantidade,
    preco,
    ...(tam ? { tamanho: tam.label } : {}),
  };
}
