import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, ExternalLink, MessageCircle, Mail, RefreshCw } from "lucide-react";
import { enviarLinkPorEmail } from "@/lib/pedidos";

export function LinkPagamentoAcoes({
  invoiceUrl, whatsapp, email, onGerarNovo, gerando,
}: {
  invoiceUrl: string;
  whatsapp?: string;
  email?: string;
  onGerarNovo?: () => void;
  gerando?: boolean;
}) {
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  const copiar = () => {
    navigator.clipboard.writeText(invoiceUrl);
    toast.success("Link copiado!");
  };
  const zap = whatsapp
    ? `https://wa.me/55${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Ola! Aqui esta o link para pagamento do seu pedido: ${invoiceUrl}`,
      )}`
    : null;
  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(
        "Link de pagamento - Casa Almeria",
      )}&body=${encodeURIComponent(
        `Ola! Segue o link para pagamento do seu pedido: ${invoiceUrl}`,
      )}`
    : null;

  const enviarEmail = async () => {
    if (!email) return;
    setEnviandoEmail(true);
    try {
      const res = await enviarLinkPorEmail(email, invoiceUrl);
      if (res.ok) {
        toast.success("E-mail enviado!");
      } else {
        toast.error(res.error ?? "Erro ao enviar e-mail");
      }
    } finally {
      setEnviandoEmail(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-linen/50 p-4">
      <p className="mb-2 text-sm font-bold text-charcoal">Link de pagamento</p>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-border">
        <code className="min-w-0 flex-1 truncate text-xs text-charcoal">{invoiceUrl}</code>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={copiar}>
          <Copy className="mr-1 h-3 w-3" /> Copiar
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1 h-3 w-3" /> Abrir
          </a>
        </Button>
        {zap && (
          <Button size="sm" variant="outline" asChild>
            <a href={zap} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
            </a>
          </Button>
        )}
        {email ? (
          <Button size="sm" variant="outline" onClick={enviarEmail} disabled={enviandoEmail}>
            <Mail className="mr-1 h-3 w-3" /> {enviandoEmail ? "Enviando…" : "E-mail"}
          </Button>
        ) : mailto ? (
          <Button size="sm" variant="outline" asChild>
            <a href={mailto}>
              <Mail className="mr-1 h-3 w-3" /> E-mail
            </a>
          </Button>
        ) : null}
        {onGerarNovo && (
          <Button size="sm" variant="outline" onClick={onGerarNovo} disabled={gerando}>
            <RefreshCw className={`mr-1 h-3 w-3 ${gerando ? "animate-spin" : ""}`} /> Gerar novo
          </Button>
        )}
      </div>
    </div>
  );
}
