import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Copy, Smartphone } from "lucide-react";
import {
  checkoutAccessHeaders,
  pagarUrl,
  saveCheckoutAccess,
} from "@/lib/checkoutAccess";

/**
 * Exibe um QR Code apontando para o checkout transparente (/pagar/{pedidoId}?access=...).
 * O cliente escaneia, paga no próprio celular; este componente faz polling do
 * status do pedido e chama onPago() quando confirma.
 */
export function CartaoQrDisplay({
  pedidoId,
  accessToken,
  onPago,
}: {
  pedidoId: string;
  accessToken?: string | null;
  onPago: () => void;
}) {
  const [url, setUrl] = useState("");
  const onPagoRef = useRef(onPago);
  onPagoRef.current = onPago;

  useEffect(() => {
    if (accessToken) saveCheckoutAccess(pedidoId, accessToken);
    if (accessToken) {
      setUrl(pagarUrl(pedidoId, accessToken));
    } else {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setUrl(`${origin}/pagar/${pedidoId}`);
    }
  }, [pedidoId, accessToken]);

  useEffect(() => {
    let attempts = 0;
    const MAX = 150;
    const timer = setInterval(async () => {
      attempts += 1;
      if (attempts > MAX) {
        clearInterval(timer);
        return;
      }
      try {
        const res = await fetch(`/api/public/pedido/${pedidoId}`, {
          headers: checkoutAccessHeaders(pedidoId),
        });
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

  if (!url) return null;

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border bg-white p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-charcoal">
        <Smartphone className="h-4 w-4 text-olive" />
        Cliente paga no celular
      </div>
      <QRCodeSVG value={url} size={180} level="M" />
      <p className="max-w-xs text-center text-xs text-muted-foreground">
        Escaneie o QR Code ou copie o link para o cliente finalizar o pagamento no cartão.
      </p>
      <button
        type="button"
        onClick={copiar}
        className="inline-flex items-center gap-2 text-sm font-medium text-olive hover:underline"
      >
        <Copy className="h-4 w-4" />
        Copiar link de pagamento
      </button>
    </div>
  );
}
