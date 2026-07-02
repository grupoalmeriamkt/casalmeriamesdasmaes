import { useState } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PedidoManualStepper } from "./PedidoManualStepper";

/**
 * Botão "Novo Pedido" que abre o fluxo de criação manual num pop-up.
 * `onCriado` é chamado ao concluir um pedido (ex.: recarregar a lista).
 */
export function PedidoManualModal({
  onCriado,
  triggerClassName,
}: {
  onCriado?: () => void;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={
            triggerClassName ??
            "inline-flex items-center gap-1.5 rounded-md bg-olive px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-olive/90"
          }
        >
          <Plus className="h-4 w-4" /> Novo Pedido
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-w-md gap-0 border bg-card p-0 shadow-xl [&>button]:hidden sm:rounded-lg"
      >
        <DialogTitle className="sr-only">Novo pedido manual</DialogTitle>
        <PedidoManualStepper
          onClose={() => setOpen(false)}
          onFinalizado={() => {
            setOpen(false);
            onCriado?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
