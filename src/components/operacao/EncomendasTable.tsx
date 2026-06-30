import type { EncomendaLinha } from "@/lib/encomendasTable";
import { LOCAL_BADGE, SETOR_BADGE_PLANILHA } from "@/lib/encomendasTable";

type Props = {
  linhas: EncomendaLinha[];
  selectedIds: Set<string>;
  onTogglePedido: (pedidoId: string) => void;
  onAbrirPedido: (pedidoId: string) => void;
};

function badgeClass(map: Record<string, string>, key: string) {
  return map[key] ?? map.outro;
}

export function EncomendasTable({ linhas, selectedIds, onTogglePedido, onAbrirPedido }: Props) {
  if (linhas.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Nenhuma linha para exibir na planilha.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead>
          <tr className="bg-[#1e1b4b] text-left text-[11px] font-semibold uppercase tracking-wide text-white">
            <th className="w-10 px-2 py-2.5" aria-label="Selecionar" />
            <th className="px-3 py-2.5 whitespace-nowrap">Data de retirada</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Horário da retirada</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Dia da semana</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Nome do cliente</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Setor responsável</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Produto</th>
            <th className="px-3 py-2.5 whitespace-nowrap text-center">Qtd</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Local de retirada</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr
              key={l.linhaId}
              onClick={() => onAbrirPedido(l.pedidoId)}
              className={`cursor-pointer border-b border-border/40 transition-colors ${
                selectedIds.has(l.pedidoId) ? "bg-olive/10" : "bg-[#edf7ee] hover:bg-[#dcefdc]"
              }`}
              title="Clique para abrir o pedido"
            >
              <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(l.pedidoId)}
                  onChange={() => onTogglePedido(l.pedidoId)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 cursor-pointer rounded border-border accent-charcoal"
                  aria-label={`Selecionar pedido ${l.pedidoId.slice(-6)}`}
                />
              </td>
              <td className="px-3 py-2 whitespace-nowrap font-medium text-charcoal">
                {l.dataRetirada}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-charcoal">{l.horarioRetirada}</td>
              <td className="px-3 py-2 whitespace-nowrap capitalize text-charcoal">{l.diaSemana}</td>
              <td className="px-3 py-2 font-semibold text-charcoal">{l.nomeCliente}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${badgeClass(SETOR_BADGE_PLANILHA, l.setorKey)}`}
                >
                  {l.setor}
                </span>
              </td>
              <td className="px-3 py-2 font-medium text-charcoal">{l.produto}</td>
              <td className="px-3 py-2 text-center font-semibold text-charcoal">{l.qtd}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${badgeClass(LOCAL_BADGE, l.localKey)}`}
                >
                  {l.localRetirada}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
