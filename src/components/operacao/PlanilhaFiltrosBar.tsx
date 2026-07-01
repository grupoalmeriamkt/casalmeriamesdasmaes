import type { FiltrosPlanilha } from "@/lib/planilhaFiltros";
import { filtrosPlanilhaAtivos } from "@/lib/planilhaFiltros";
import { SETORES_OPERACAO_OPCOES } from "@/lib/setoresOperacao";
import type { SetorOperacional } from "@/lib/setoresOperacao";

type LocalOpt = { id: string; label: string };

type Props = {
  filtros: FiltrosPlanilha;
  produtos: string[];
  locais: LocalOpt[];
  onChange: (patch: Partial<FiltrosPlanilha>) => void;
  onLimpar: () => void;
};

export function PlanilhaFiltrosBar({
  filtros,
  produtos,
  locais,
  onChange,
  onLimpar,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-linen/50 px-2 py-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-xs">
        Filtrar
      </span>

      <select
        value={filtros.setor}
        onChange={(e) =>
          onChange({ setor: (e.target.value || "") as SetorOperacional | "" })
        }
        className="rounded-md border border-border bg-background px-2 py-1 text-xs"
        aria-label="Filtrar por setor"
      >
        <option value="">Todos os setores</option>
        {SETORES_OPERACAO_OPCOES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        value={filtros.produto}
        onChange={(e) => onChange({ produto: e.target.value })}
        className="max-w-[12rem] rounded-md border border-border bg-background px-2 py-1 text-xs"
        aria-label="Filtrar por produto"
      >
        <option value="">Todos os produtos</option>
        {produtos.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <select
        value={filtros.localId}
        onChange={(e) => onChange({ localId: e.target.value })}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs"
        aria-label="Filtrar por local"
      >
        <option value="">Todos os locais</option>
        {locais.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>

      {filtrosPlanilhaAtivos(filtros) && (
        <button
          type="button"
          onClick={onLimpar}
          className="text-xs text-muted-foreground hover:text-terracotta"
        >
          ✕ Limpar filtros
        </button>
      )}
    </div>
  );
}
