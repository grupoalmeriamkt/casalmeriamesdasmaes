export const RESERVED_SLUGS = new Set<string>([
  "admin",
  "pedido",
  "pedidos",
  "api",
  "checkout",
  "q",
  "",
]);

/** Normaliza um slug: lowercase, somente [a-z0-9-], sem hífens duplos ou nas pontas. */
export function normalizarSlug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type ValidacaoSlug =
  | { ok: true; slug: string }
  | { ok: false; motivo: "vazio" | "reservado" | "duplicado" | "invalido"; mensagem: string };

export function validarSlug(
  bruto: string,
  jaUsados: string[],
): ValidacaoSlug {
  const slug = normalizarSlug(bruto);
  if (!slug) {
    return { ok: false, motivo: "vazio", mensagem: "Informe um slug." };
  }
  if (slug.length < 2) {
    return {
      ok: false,
      motivo: "invalido",
      mensagem: "Slug muito curto (mín. 2 caracteres).",
    };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return {
      ok: false,
      motivo: "reservado",
      mensagem: `"${slug}" é um slug reservado do sistema.`,
    };
  }
  if (jaUsados.includes(slug)) {
    return {
      ok: false,
      motivo: "duplicado",
      mensagem: `Slug "${slug}" já está em uso por outra campanha.`,
    };
  }
  return { ok: true, slug };
}

/** Garante slug único, sufixando -2, -3 etc. se necessário. */
export function gerarSlugUnico(base: string, jaUsados: string[]): string {
  const baseNorm = normalizarSlug(base) || "campanha";
  if (!jaUsados.includes(baseNorm) && !RESERVED_SLUGS.has(baseNorm)) {
    return baseNorm;
  }
  let i = 2;
  while (jaUsados.includes(`${baseNorm}-${i}`) || RESERVED_SLUGS.has(`${baseNorm}-${i}`)) {
    i++;
  }
  return `${baseNorm}-${i}`;
}
