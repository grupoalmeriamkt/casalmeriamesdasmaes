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
