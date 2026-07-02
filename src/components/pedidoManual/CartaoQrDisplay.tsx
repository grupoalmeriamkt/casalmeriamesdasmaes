import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Copy, Smartphone } from "lucide-react";

/**
 * Exibe um QR Code apontando para o checkout transparente (/pagar/{pedidoId}).
 * O cliente escaneia, paga no próprio celular; este componente faz polling do
 * status do pedido e chama onPago() quando confirma.
 */
export function CartaoQrDisplay({
  pedidoId,
  onPago,
}: {
  pedidoId: string;
  onPago: () => void;
}) {
  const [url, setUrl] = useState("");
  const onPagoRef = useRef(onPago);
  onPagoRef.current = onPago;

  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setUrl(`${origin}/pagar/${pedidoId}`);
  }, [pedidoId]);

  // Polling do status do pedido enquanto o QR está visível.
  useEffect(() => {
    let attempts = 0;
    const MAX = 150; // ~10 min a cada 4s
    const timer = setInterval(async () => {
      attempts += 1;
      if (attempts > MAX) {
        clearInterval(timer);
        return;
      }
      try {
        const res = await fetch(`/api/public/pedido/${pedidoId}`);
        if (res.status === 409) {
          clearInterval(timer);
          onPagoRef.current();
          return;
        }
        if (res.ok) {
          const json = (await res.json()) as { pedido?: { status?: string } };
          if (json.pedido?.status === "pago") {
            clearInterval(timer);
            onPagoRef.current();
          }
        }
      } catch {
        /* rede — tenta de novo no próximo tick */
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [pedidoId]);

  const copiar = () => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border bg-muted/30 p-5 text-center">
      <div className="flex items-center gap-2 text-sm font-medium text-charcoal">
        <Smartphone className="h-4 w-4 text-olive" />
        Peça para o cliente escanear
      </div>
      <div className="rounded-xl border bg-white p-3">
        {url ? (
          <QRCodeSVG value={url} size={200} level="M" marginSize={1} />
        ) : (
          <div className="h-[200px] w-[200px]" />
        )}
      </div>
      <p className="max-w-[16rem] text-xs text-muted-foreground">
        O cliente digita o próprio cartão numa página segura. Esta tela confirma o pagamento
        automaticamente.
      </p>
      <div className="flex items-center gap-2 text-xs font-medium text-olive">
        <span className="h-2 w-2 animate-pulse rounded-full bg-olive" />
        Aguardando o cliente pagar…
      </div>
      <button
        onClick={copiar}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-charcoal"
      >
        <Copy className="h-3 w-3" /> Copiar link
      </button>
    </div>
  );
}
