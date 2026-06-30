import type { SetorOperacional } from "@/lib/setoresOperacao";
import { SETORES_OPERACAO_OPCOES } from "@/lib/setoresOperacao";
import type { FiltrosOperacionais } from "@/lib/operacaoPedido";

type UnidadeOpt = { id: string; nome: string };

type Props = {
  filtros: FiltrosOperacionais;
  onChange: (patch: Partial<FiltrosOperacionais>) => void;
  unidades: UnidadeOpt[];
  contagemAprovados: number;
};

export function OperacaoFiltrosBar({
  filtros,
  onChange,
  unidades,
  contagemAprovados,
}: Props) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-linen/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Operação</span>
        <span className="rounded-full bg-olive/15 px-2.5 py-0.5 text-xs font-semibold text-olive">
          Aprovados: {contagemAprovados}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={filtros.setor ?? ""}
          onChange={(e) =>
            onChange({ setor: (e.target.value || "") as SetorOperacional | "" })
          }
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">Todos os setores</option>
          {SETORES_OPERACAO_OPCOES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={filtros.unidadeId ?? ""}
          onChange={(e) => onChange({ unidadeId: e.target.value || undefined })}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">Todas as unidades</option>
          {unidades.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>

        <select
          value={filtros.tipo ?? ""}
          onChange={(e) =>
            onChange({ tipo: (e.target.value || "") as "" | "delivery" | "retirada" })
          }
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="delivery">Entrega</option>
          <option value="retirada">Retirada</option>
        </select>

        <input
          type="date"
          value={filtros.dataExecucao ?? ""}
          onChange={(e) => onChange({ dataExecucao: e.target.value || undefined })}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          title="Data de execução"
        />

        <select
          value={filtros.ordenacao ?? "criado_desc"}
          onChange={(e) =>
            onChange({
              ordenacao: e.target.value as FiltrosOperacionais["ordenacao"],
            })
          }
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="criado_desc">Criação — mais recente</option>
          <option value="criado_asc">Criação — mais antiga</option>
          <option value="execution_asc">Execução — mais próxima</option>
          <option value="execution_desc">Execução — mais distante</option>
        </select>

        <label className="flex items-center gap-1.5 text-xs text-charcoal">
          <input
            type="checkbox"
            checked={!!filtros.mostrarArquivados}
            onChange={(e) => onChange({ mostrarArquivados: e.target.checked })}
          />
          Arquivados
        </label>

        <label className="flex items-center gap-1.5 text-xs text-charcoal">
          <input
            type="checkbox"
            checked={!!filtros.mostrarTestes}
            onChange={(e) => onChange({ mostrarTestes: e.target.checked })}
          />
          Testes
        </label>
      </div>
    </div>
  );
}
