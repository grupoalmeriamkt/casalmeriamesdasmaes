import type { EncomendaLinha, LocalOpcaoRef } from "@/lib/encomendasTable";
import { resolveLocalOptionId } from "@/lib/encomendasTable";
import type { SetorOperacional } from "@/lib/setoresOperacao";
import { SETORES_OPERACAO_OPCOES } from "@/lib/setoresOperacao";

export type FiltrosPlanilha = {
  setor: SetorOperacional | "";
  produto: string;
  localId: string;
};

export const FILTROS_PLANILHA_VAZIOS: FiltrosPlanilha = {
  setor: "",
  produto: "",
  localId: "",
};

export function filtrosPlanilhaAtivos(f: FiltrosPlanilha): boolean {
  return !!(f.setor || f.produto || f.localId);
}

function linhaMatchSetor(l: EncomendaLinha, setor: SetorOperacional): boolean {
  if (l.productionSector === setor) return true;
  const meta = SETORES_OPERACAO_OPCOES.find((s) => s.value === setor);
  if (!meta) return false;
  return (
    l.setorKey === meta.key ||
    l.setor.toLowerCase() === meta.label.toLowerCase()
  );
}

/** Filtra linhas da planilha por setor, produto e local. */
export function filtrarLinhasEncomenda(
  linhas: EncomendaLinha[],
  f: FiltrosPlanilha,
  locaisOpcoes: LocalOpcaoRef[] = [],
): EncomendaLinha[] {
  if (!filtrosPlanilhaAtivos(f)) return linhas;

  return linhas.filter((l) => {
    if (f.setor && !linhaMatchSetor(l, f.setor)) return false;
    if (f.produto && l.produto !== f.produto) return false;
    if (f.localId) {
      const id = resolveLocalOptionId(
        l.unidadeId,
        l.localRetirada,
        l.localKey,
        locaisOpcoes,
      );
      if (id !== f.localId) return false;
    }
    return true;
  });
}

/** Lista única de produtos nas linhas, ordenada alfabeticamente. */
export function produtosUnicosDasLinhas(linhas: EncomendaLinha[]): string[] {
  const set = new Set<string>();
  for (const l of linhas) {
    if (l.produto && l.produto !== "(sem produto)") set.add(l.produto);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
