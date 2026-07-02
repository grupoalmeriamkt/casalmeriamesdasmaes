import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy } from "lucide-react";

export function PixQrCode({
  qrImage,
  payload,
  expiraEm,
}: {
  qrImage: string;
  payload: string;
  expiraEm?: string | null;
}) {
  const copiar = () => {
    navigator.clipboard.writeText(payload);
    toast.success("Código copiado!");
  };

  return (
    <div className="rounded-2xl border border-border bg-linen/50 p-4">
      <p className="mb-3 text-sm font-bold text-charcoal">QR Code PIX</p>
      <div className="grid gap-4 sm:grid-cols-[220px_1fr] sm:items-start">
        <img
          src={`data:image/png;base64,${qrImage}`}
          alt="QR Code PIX"
          className="h-[220px] w-[220px] rounded-lg border border-border"
        />
        <div className="space-y-3">
          <div className="rounded-lg bg-white p-3 font-mono text-xs break-all text-charcoal ring-1 ring-border">
            {payload}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={copiar}>
            <Copy className="mr-1 h-3 w-3" /> Copiar código copia-e-cola
          </Button>
          {expiraEm && (
            <p className="text-xs text-charcoal/60">
              Expira em {new Date(expiraEm).toLocaleString("pt-BR")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
