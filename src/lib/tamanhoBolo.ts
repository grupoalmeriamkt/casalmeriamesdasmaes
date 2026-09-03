import type { TamanhoVariante } from "@/lib/types";
import { ehCestaCafeAgrupada, ehCestaCafeSeparada } from "@/lib/cestasCafe";

/** Referência padrão das tortas Casa Almeria (P/M/G) quando o admin ainda não preencheu. */
export const TAMANHO_BOLO_PADRAO: Record<
  string,
  { diametro: string; peso: string; fatias: number; serve: string }
> = {
  P: { diametro: "15 cm", peso: "1 kg", fatias: 10, serve: "8 a 10 pessoas" },
  M: { diametro: "20 cm", peso: "1,5 kg", fatias: 16, serve: "12 a 16 pessoas" },
  G: { diametro: "25 cm", peso: "2,5 kg", fatias: 24, serve: "20 a 25 pessoas" },
};

export type TamanhoComResumo = {
  id: string;
  label: string;
  preco: number;
  imagem?: string;
  diametro?: string;
  fatias?: number;
  peso?: string;
  serve?: string;
  itens?: string[];
};

export function completarTamanhoBolo<T extends TamanhoComResumo>(t: T): T {
  const pad = TAMANHO_BOLO_PADRAO[t.label.trim().toUpperCase()];
  if (!pad) return t;
  return {
    ...t,
    diametro: t.diametro?.trim() || pad.diametro,
    peso: t.peso?.trim() || pad.peso,
    fatias: t.fatias && t.fatias > 0 ? t.fatias : pad.fatias,
    serve: t.serve?.trim() || pad.serve,
  };
}

export function completarTamanhosProduto<T extends { tamanhos?: TamanhoComResumo[] }>(
  produto: T,
): T {
  if (!produto.tamanhos?.length) return produto;
  return { ...produto, tamanhos: produto.tamanhos.map(completarTamanhoBolo) };
}

export function resumoTamanho(t: TamanhoComResumo): string {
  const c = completarTamanhoBolo(t);
  return [c.peso, c.serve].filter(Boolean).join(" · ");
}

const RE_BOLOS = /^bolos?$/i;
const RE_TORTAS = /^tortas?$/i;

/** Renomeia a categoria Tortas → Bolos para o header e a seção do cardápio. */
export function aplicarNomeCategoriaBolos<Cat extends { nome: string }>(
  categorias: Cat[],
): { categorias: Cat[]; mudou: boolean } {
  if (categorias.some((c) => RE_BOLOS.test((c.nome ?? "").trim()))) {
    return { categorias, mudou: false };
  }
  let mudou = false;
  const next = categorias.map((c) => {
    if (!RE_TORTAS.test((c.nome ?? "").trim())) return c;
    mudou = true;
    return { ...c, nome: "Bolos" };
  });
  return { categorias: next, mudou };
}

export function aplicarSubtituloComBolos(subtitulo: string): string {
  if (!subtitulo || /bolo/i.test(subtitulo)) return subtitulo;
  return subtitulo.replace(/cestas,\s*sobremesas/i, "Cestas, bolos, sobremesas");
}

export function aplicarTamanhosBoloPadrao<
  C extends { id?: string; nome?: string; tamanhos?: TamanhoVariante[] },
>(cestas: C[]): { cestas: C[]; mudou: boolean } {
  let mudou = false;
  const next = cestas.map((c) => {
    if (!c.tamanhos?.length) return c;
    if (ehCestaCafeAgrupada(c) || ehCestaCafeSeparada(c.id ?? "") || /cesta\s+(de\s+)?caf[eé]/i.test(c.nome ?? "")) {
      return c;
    }
    let local = false;
    const tamanhos = c.tamanhos.map((t) => {
      const filled = completarTamanhoBolo(t);
      if (
        filled.diametro !== t.diametro ||
        filled.peso !== t.peso ||
        filled.fatias !== t.fatias ||
        filled.serve !== t.serve
      ) {
        local = true;
        mudou = true;
        return filled;
      }
      return t;
    });
    return local ? { ...c, tamanhos } : c;
  });
  return { cestas: next, mudou };
}
