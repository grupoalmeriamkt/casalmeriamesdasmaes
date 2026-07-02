import { Pencil, Printer, X } from "lucide-react";
import type { PedidoSalvo } from "@/store/admin";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { DetalhesPedido } from "@/components/operacao/PedidoDetalheContent";

type Props = {
  pedido: PedidoSalvo | null;
  onClose: () => void;
  onEditar: (p: PedidoSalvo) => void;
  onImprimir: (p: PedidoSalvo) => void;
};

export function PedidoDetalheMobileSheet({
  pedido,
  onClose,
  onEditar,
  onImprimir,
}: Props) {
  return (
    <Sheet open={!!pedido} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="pedidos-detalhe-sheet flex max-h-[92dvh] flex-col gap-0 rounded-t-[1.25rem] border-0 p-0 [&>button.absolute]:hidden"
      >
        <div className="shrink-0 border-b border-black/6 bg-white px-4 pb-3 pt-2">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/12" aria-hidden />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-left text-base font-semibold text-charcoal">
                Pedido #{pedido?.id.slice(-6).toUpperCase()}
              </SheetTitle>
              {pedido && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(pedido.criadoEm).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/5 text-charcoal"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {pedido && <DetalhesPedido p={pedido} variant="mobile" />}
        </div>

        {pedido && (
          <div className="shrink-0 border-t border-black/6 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-11 rounded-xl"
                onClick={() => onEditar(pedido)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button
                className="h-11 rounded-xl bg-charcoal text-white hover:bg-charcoal/90"
                onClick={() => onImprimir(pedido)}
              >
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
