import { useState } from "react";
import { FileText, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

/**
 * Botão que abre o comprovante de pagamento do Asaas (transactionReceiptUrl) do pedido.
 * Busca sob demanda no endpoint /api/public/comprovante/:pedidoId. Só faz sentido para
 * pedidos pagos. NÃO entra na folha de impressão (é uma ação de tela).
 */
export function ComprovanteAsaas({ pedidoId }: { pedidoId: string }) {
  const [carregando, setCarregando] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const abrir = async () => {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    setCarregando(true);
    try {
      const res = await fetch(`/api/public/comprovante/${pedidoId}`);
      const json = (await res.json()) as { receiptUrl?: string | null };
      const receipt = json.receiptUrl ?? null;
      if (!res.ok || !receipt) {
        toast.info("Comprovante ainda não disponível para este pedido.");
        return;
      }
      setUrl(receipt);
      window.open(receipt, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Não foi possível carregar o comprovante.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <button
      onClick={abrir}
      disabled={carregando}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-olive/40 bg-olive/5 px-4 py-2.5 text-sm font-semibold text-olive transition-colors hover:bg-olive/10 disabled:opacity-60"
    >
      {carregando ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> Buscando comprovante…</>
      ) : (
        <><FileText className="h-4 w-4" /> Ver comprovante de pagamento <ExternalLink className="h-3.5 w-3.5 opacity-60" /></>
      )}
    </button>
  );
}
