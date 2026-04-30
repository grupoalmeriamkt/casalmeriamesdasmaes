import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ThemeApplier } from "@/components/ThemeApplier";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useAdmin } from "@/store/admin";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Copy, Loader2, MessageCircle, Clock, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/sucesso/$id")({
  head: () => ({
    meta: [
      { title: "Pedido recebido — Casa Almeria" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SucessoPage,
});

type Pagamento = {
  id: string;
  metodo: "PIX" | "CREDIT_CARD" | "BOLETO";
  status: string;
  valor: number;
  pix_qrcode_payload: string | null;
  pix_qrcode_image: string | null;
  pix_expira_em: string | null;
  cartao_last4: string | null;
  cartao_brand: string | null;
  pedido_id: string;
};

const PAGO_STATUSES = new Set(["CONFIRMED", "RECEIVED"]);
const FALHOU_STATUSES = new Set(["REFUNDED", "PAYMENT_DELETED", "CHARGEBACK_REQUESTED"]);

function SucessoPage() {
  const { id } = Route.useParams();
  const [pagamento, setPagamento] = useState<Pagamento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [statusLive, setStatusLive] = useState<string | null>(null);

  const whatsappUrl = useAdmin((s) => s.home.rodape.redes.whatsapp);

  useEffect(() => {
    let cancelled = false;
    async function fetchPagamento() {
      const { data, error } = await supabase
        .from("pagamentos")
        .select(
          "id, metodo, status, valor, pix_qrcode_payload, pix_qrcode_image, pix_expira_em, cartao_last4, cartao_brand, pedido_id",
        )
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        // Fallback via RPC pública (caso RLS bloqueie SELECT direto)
        const { data: statusData } = await supabase.rpc("pagamento_status", {
          _pagamento_id: id,
        });
        const row = (statusData ?? [])[0];
        if (row) {
          setStatusLive(row.status);
        }
      } else {
        setPagamento(data as Pagamento);
        setStatusLive(data.status);
      }
      setCarregando(false);
    }
    void fetchPagamento();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Polling do status enquanto não está pago
  useEffect(() => {
    if (!pagamento) return;
    if (PAGO_STATUSES.has(statusLive ?? "")) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/public/asaas/status/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setStatusLive(data.status);
        if (PAGO_STATUSES.has(data.status)) {
          toast.success("Pagamento confirmado!");
        }
      } catch {
        /* ignore */
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [pagamento, statusLive, id]);

  const pago = PAGO_STATUSES.has(statusLive ?? "");
  const falhou = FALHOU_STATUSES.has(statusLive ?? "");

  const wppHref = useMemo(() => {
    const base = whatsappUrl?.startsWith("http")
      ? whatsappUrl
      : `https://wa.me/${(whatsappUrl ?? "").replace(/\D/g, "")}`;
    const sep = base.includes("?") ? "&" : "?";
    const msg = encodeURIComponent(`Olá! Tenho uma dúvida sobre meu pedido (pagamento ${id}).`);
    return `${base}${sep}text=${msg}`;
  }, [whatsappUrl, id]);

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linen">
        <ThemeApplier />
        <Loader2 className="h-6 w-6 animate-spin text-charcoal" />
      </div>
    );
  }

  if (!pagamento) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-linen p-6 text-center">
        <ThemeApplier />
        <Logo />
        <p className="text-charcoal">Pagamento não encontrado.</p>
        <Link to="/" className="text-terracotta underline">
          Voltar
        </Link>
        <Toaster position="bottom-right" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linen">
      <ThemeApplier />
      <header className="bg-charcoal">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo variant="light" />
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Início
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        {/* Hero */}
        <section className="rounded-2xl bg-white p-8 text-center ring-1 ring-border">
          {pago ? (
            <>
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
              <h1 className="mt-3 font-serif text-3xl font-bold text-charcoal">
                Pedido confirmado!
              </h1>
              <p className="mt-2 text-charcoal/80">
                Seu pagamento foi recebido. Em breve entraremos em contato pelo WhatsApp.
              </p>
            </>
          ) : falhou ? (
            <>
              <h1 className="font-serif text-3xl font-bold text-charcoal">
                Pagamento não concluído
              </h1>
              <p className="mt-2 text-charcoal/80">
                Houve um problema com seu pagamento. Tente novamente ou fale com a gente.
              </p>
            </>
          ) : (
            <>
              <Clock className="mx-auto h-14 w-14 text-amber-500" />
              <h1 className="mt-3 font-serif text-3xl font-bold text-charcoal">
                {pagamento.metodo === "PIX" ? "Aguardando seu PIX" : "Processando pagamento"}
              </h1>
              <p className="mt-2 text-charcoal/80">
                {pagamento.metodo === "PIX"
                  ? "Pague o PIX abaixo. A confirmação é automática."
                  : "Estamos confirmando seu pagamento. Isso leva poucos segundos."}
              </p>
            </>
          )}
        </section>

        {/* PIX QR Code */}
        {pagamento.metodo === "PIX" && !pago && pagamento.pix_qrcode_image && (
          <section className="rounded-2xl bg-white p-6 ring-1 ring-border">
            <h2 className="mb-4 font-serif text-xl font-bold text-charcoal">QR Code PIX</h2>
            <div className="grid gap-6 sm:grid-cols-[220px_1fr] sm:items-start">
              <img
                src={`data:image/png;base64,${pagamento.pix_qrcode_image}`}
                alt="QR Code PIX"
                className="h-[220px] w-[220px] rounded-lg border border-border"
              />
              <div className="space-y-3">
                <p className="text-sm text-charcoal/80">
                  Abra o app do seu banco, escolha pagar com PIX e escaneie o QR Code, ou copie o
                  código abaixo:
                </p>
                <div className="rounded-lg bg-linen p-3 font-mono text-xs break-all text-charcoal">
                  {pagamento.pix_qrcode_payload}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (pagamento.pix_qrcode_payload) {
                      navigator.clipboard.writeText(pagamento.pix_qrcode_payload);
                      toast.success("Código copiado!");
                    }
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar código copia-e-cola
                </Button>
                {pagamento.pix_expira_em && (
                  <p className="text-xs text-charcoal/60">
                    Expira em {new Date(pagamento.pix_expira_em).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Cartão */}
        {pagamento.metodo === "CREDIT_CARD" && (
          <section className="rounded-2xl bg-white p-6 ring-1 ring-border">
            <h2 className="mb-2 font-serif text-xl font-bold text-charcoal">Cartão de Crédito</h2>
            <p className="text-sm text-charcoal/80">
              {pagamento.cartao_brand?.toUpperCase()} •••• {pagamento.cartao_last4}
            </p>
          </section>
        )}

        {/* Resumo */}
        <section className="rounded-2xl bg-white p-6 ring-1 ring-border">
          <div className="flex items-center justify-between">
            <span className="text-charcoal/80">Total</span>
            <span className="font-serif text-2xl font-bold text-terracotta">
              {pagamento.valor.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-charcoal/60">
            <span>Identificador do pagamento</span>
            <span className="font-mono">{pagamento.id.slice(0, 8)}</span>
          </div>
        </section>

        {/* CTA WhatsApp */}
        <section className="rounded-2xl bg-emerald-50 p-6 ring-1 ring-emerald-200">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-serif text-lg font-bold text-charcoal">Tem alguma dúvida?</h3>
              <p className="text-sm text-charcoal/80">
                Fale com a gente pelo WhatsApp — respondemos rapidinho.
              </p>
            </div>
            <a href={wppHref} target="_blank" rel="noreferrer">
              <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
                <MessageCircle className="mr-2 h-4 w-4" />
                Conversar no WhatsApp
              </Button>
            </a>
          </div>
        </section>
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}
