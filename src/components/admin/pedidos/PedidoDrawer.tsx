import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Chip } from "./Chip";
import { PedidoExtrasView } from "@/components/PedidoExtrasView";
import { formatBRL } from "@/store/pedido";
import { rowToPedidoOperacional } from "@/lib/operacaoPedido";
import type { PedidoRow } from "@/lib/pedidos";
import {
  PAY_CHIP,
  STAGE_ORDER,
  STAGE_LABEL,
  indiceEtapa,
  proximaEtapa,
  stageChip,
  typeChip,
} from "@/lib/etapaPedido";
import { MessageCircle, Printer, ArrowRight, CheckCircle2 } from "lucide-react";

const SERIF = { fontFamily: "Spectral, serif" } as const;

type Props = {
  row: PedidoRow | null;
  campanhaNome?: string;
  onOpenChange: (open: boolean) => void;
  onAvancarEtapa: (id: string) => void;
  onMarcarPago: (id: string) => void;
  onImprimir: (row: PedidoRow) => void;
  loading?: boolean;
};

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em]"
        style={{ color: "#9A917F" }}
      >
        {titulo}
      </div>
      {children}
    </div>
  );
}

export function PedidoDrawer({
  row,
  campanhaNome,
  onOpenChange,
  onAvancarEtapa,
  onMarcarPago,
  onImprimir,
  loading,
}: Props) {
  const open = !!row;
  if (!row) {
    return (
      <Sheet open={false} onOpenChange={onOpenChange}>
        <SheetContent side="right" />
      </Sheet>
    );
  }

  const p = rowToPedidoOperacional(row);
  const codigo = row.id.slice(0, 8);
  const pay = p.paymentStatusNormalized ? PAY_CHIP[p.paymentStatusNormalized] : null;
  const stg = stageChip(p.fulfillmentStage);
  const tip = typeChip(row.tipo);
  const idxEtapa = indiceEtapa(p.fulfillmentStage);
  const prox = proximaEtapa(p.fulfillmentStage);

  const cesta = row.cesta;
  const sobremesas = row.sobremesas ?? [];
  const extras = row.pagamento?.extras;
  const subtotal =
    (cesta ? cesta.preco * cesta.quantidade : 0) +
    sobremesas.reduce((a, s) => a + s.preco * s.quantidade, 0) +
    (extras?.cartoes ?? []).reduce((a, c) => a + c.preco, 0) +
    (extras?.polaroids ?? []).reduce((a, pl) => a + pl.preco, 0);
  const desconto = Number(row.pagamento?.desconto ?? 0);
  const frete = Math.max(0, Number(row.total) - subtotal + desconto);
  const isRetirada = row.tipo === "retirada";
  const whatsapp = p.recipientPhone?.replace(/\D/g, "");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[470px] max-w-[94vw] flex-col gap-0 border-l-0 p-0 sm:max-w-[94vw]"
        style={{ backgroundColor: "#F7F1E6", fontFamily: "'Hanken Grotesk', system-ui, sans-serif" }}
      >
        {/* Header */}
        <div className="border-b px-6 pb-5 pt-6" style={{ borderColor: "#E4DAC8" }}>
          <div className="pr-8 text-xs" style={{ fontFamily: "monospace", color: "#9A917F" }}>
            #{codigo}
          </div>
          <div className="mt-1.5 text-[24px] font-bold leading-tight" style={{ ...SERIF, color: "#1C2A39" }}>
            {p.recipientName}
          </div>
          <div className="mt-1 text-[13px]" style={{ color: "#8A8170" }}>
            {p.recipientPhone}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip chip={pay} />
            <Chip chip={stg} />
            <Chip chip={tip} />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6" style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          {/* Stepper */}
          <Secao titulo="Etapa de produção">
            <div className="flex items-start">
              {STAGE_ORDER.map((s, i) => {
                const done = i < idxEtapa;
                const atual = i === idxEtapa;
                return (
                  <div key={s} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold"
                      style={
                        done || atual
                          ? { backgroundColor: "#16202C", color: "#F7F2E8", boxShadow: atual ? "0 0 0 5px rgba(22,32,44,.13)" : undefined }
                          : { backgroundColor: "#E7DDCB", color: "#9A917F" }
                      }
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                    <div
                      className="text-center text-[11px] font-semibold leading-tight"
                      style={{ color: done || atual ? "#1C2A39" : "#9A917F" }}
                    >
                      {STAGE_LABEL[s]}
                    </div>
                  </div>
                );
              })}
            </div>
          </Secao>

          {/* Itens */}
          <Secao titulo="Itens">
            <div className="rounded-xl border p-4" style={{ backgroundColor: "#FCF9F2", borderColor: "#EAE0CE" }}>
              {cesta && (
                <LinhaItem nome={`${cesta.quantidade}× ${cesta.nome}`} valor={cesta.preco * cesta.quantidade} />
              )}
              {sobremesas.map((s, i) => (
                <LinhaItem key={`s-${i}`} nome={`${s.quantidade}× ${s.nome}`} valor={s.preco * s.quantidade} />
              ))}
              <div className="mt-3 border-t pt-3" style={{ borderColor: "#EFE6D5" }}>
                <LinhaTotal nome="Subtotal" valor={formatBRL(subtotal)} muted />
                {desconto > 0 && <LinhaTotal nome="Desconto" valor={`- ${formatBRL(desconto)}`} muted />}
                <LinhaTotal
                  nome={isRetirada ? "Retirada" : "Frete"}
                  valor={frete > 0 ? formatBRL(frete) : "Grátis"}
                  freteGratis={frete <= 0}
                  muted
                />
                <div className="flex items-center justify-between pt-1.5 text-[15px] font-bold" style={{ color: "#1C2A39" }}>
                  <span>Total</span>
                  <span>{formatBRL(Number(row.total))}</span>
                </div>
              </div>
            </div>
            {(extras?.cartoes?.length || extras?.polaroids?.length) ? (
              <div className="mt-3">
                <PedidoExtrasView cartoes={extras?.cartoes} polaroids={extras?.polaroids} variant="admin" />
              </div>
            ) : null}
          </Secao>

          {/* Entrega */}
          <Secao titulo={isRetirada ? "Retirada" : "Entrega"}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-[13px]">
              <Campo label="Data" valor={row.data_entrega ?? "—"} />
              <Campo label="Janela" valor={row.horario ?? "—"} />
              <Campo label={isRetirada ? "Unidade" : "Endereço"} valor={row.endereco_ou_unidade || "—"} full />
              {campanhaNome && <Campo label="Campanha" valor={campanhaNome} full />}
            </div>
          </Secao>

          {/* Pagamento */}
          <Secao titulo="Pagamento">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-[13px]">
              <Campo label="Método" valor={row.pagamento?.metodo || "—"} />
              <Campo label="Valor" valor={formatBRL(Number(row.total))} />
              {p.paymentConfirmedAt && (
                <Campo label="Pago em" valor={new Date(p.paymentConfirmedAt).toLocaleString("pt-BR")} full />
              )}
            </div>
          </Secao>

          {/* Cliente */}
          {whatsapp && (
            <Secao titulo="Cliente">
              <a
                href={`https://wa.me/55${whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold"
                style={{ borderColor: "#D9CDB6", color: "#1C2A39" }}
              >
                <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
              </a>
            </Secao>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 border-t px-6 py-4" style={{ borderColor: "#E4DAC8", backgroundColor: "#F2EBDD" }}>
          {p.paymentStatusNormalized !== "aprovado" && (
            <button
              type="button"
              disabled={loading}
              onClick={() => onMarcarPago(row.id)}
              className="rounded-[10px] px-3.5 py-2.5 text-[13px] font-bold disabled:opacity-50"
              style={{ backgroundColor: "#16202C", color: "#F7F2E8" }}
            >
              Marcar pago
            </button>
          )}
          {prox && (
            <button
              type="button"
              disabled={loading}
              onClick={() => onAvancarEtapa(row.id)}
              className="inline-flex items-center gap-1.5 rounded-[10px] border px-3.5 py-2.5 text-[13px] font-semibold disabled:opacity-50"
              style={{ borderColor: "#D9CDB6", color: "#1C2A39" }}
            >
              Avançar p/ {STAGE_LABEL[prox]} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onImprimir(row)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] border px-3.5 py-2.5 text-[13px] font-semibold"
            style={{ borderColor: "#D9CDB6", color: "#1C2A39" }}
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LinhaItem({ nome, valor }: { nome: string; valor: number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-[14px]" style={{ color: "#1C2A39" }}>
      <span className="font-semibold">{nome}</span>
      <span className="font-bold">{formatBRL(valor)}</span>
    </div>
  );
}

function LinhaTotal({
  nome,
  valor,
  muted,
  freteGratis,
}: {
  nome: string;
  valor: string;
  muted?: boolean;
  freteGratis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[13px]" style={{ color: muted ? "#8A8170" : "#1C2A39" }}>
      <span>{nome}</span>
      <span style={freteGratis ? { color: "#1E7A4F", fontWeight: 600 } : undefined}>{valor}</span>
    </div>
  );
}

function Campo({ label, valor, full }: { label: string; valor: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <div className="mb-0.5" style={{ color: "#9A917F" }}>
        {label}
      </div>
      <div className="font-semibold" style={{ color: "#1C2A39" }}>
        {valor}
      </div>
    </div>
  );
}
