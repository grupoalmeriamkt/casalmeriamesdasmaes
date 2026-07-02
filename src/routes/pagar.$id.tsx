import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeApplier } from "@/components/ThemeApplier";
import { Button } from "@/components/ui/button";
import { CardPaymentForm, type PedidoPublico } from "@/components/checkout/CardPaymentForm";

export const Route = createFileRoute("/pagar/$id")({
  head: () => ({
    meta: [
      { title: "Pagamento — Casa Almeria" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PagarPage,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Estado = "loading" | "form" | "aguarde" | "sucesso" | "erro" | "indisponivel";

function PagarPage() {
  const { id } = Route.useParams();
  const [estado, setEstado] = useState<Estado>("loading");
  const [pedido, setPedido] = useState<PedidoPublico | null>(null);
  const [motivo, setMotivo] = useState<string>("");
  const [msgIndisponivel, setMsgIndisponivel] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/public/pedido/${id}`);
        if (res.status === 409) {
          setEstado("sucesso"); // já pago — mostra confirmação
          return;
        }
        if (res.status === 410) {
          setMsgIndisponivel("Este pedido foi cancelado.");
          setEstado("indisponivel");
          return;
        }
        if (!res.ok) {
          setMsgIndisponivel("Pedido não encontrado ou link inválido.");
          setEstado("indisponivel");
          return;
        }
        const json = (await res.json()) as { pedido: PedidoPublico };
        setPedido(json.pedido);
        setEstado("form");
      } catch {
        setMsgIndisponivel("Não foi possível carregar o pedido. Tente novamente.");
        setEstado("indisponivel");
      }
    })();
  }, [id]);

  return (
    <>
      <ThemeApplier />
      <div className="min-h-screen bg-linen px-4 py-8">
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
          <Logo />

          <div className="w-full rounded-2xl border bg-card p-6 shadow-sm">
            {estado === "loading" && (
              <div className="flex flex-col items-center gap-3 py-10 text-charcoal/50">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Carregando pedido…</p>
              </div>
            )}

            {estado === "form" && pedido && (
              <div className="flex flex-col gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-olive">
                    Pagamento seguro
                  </p>
                  <h1 className="font-serif text-2xl text-charcoal">Olá, {pedido.cliente_nome.split(" ")[0]}!</h1>
                  <p className="text-sm text-charcoal/50">Confira seu pedido e pague com cartão.</p>
                </div>

                <div className="overflow-hidden rounded-xl border">
                  {pedido.itens.map((it, idx) => (
                    <div key={idx} className="flex justify-between border-b px-4 py-2.5 text-sm last:border-0">
                      <span className="text-charcoal">{it.quantidade}× {it.nome}</span>
                      <span className="text-charcoal/70">{brl(it.preco * it.quantidade)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between bg-charcoal px-4 py-3 text-white">
                    <span className="text-sm opacity-70">Total</span>
                    <span className="font-serif text-xl">{brl(pedido.total)}</span>
                  </div>
                </div>

                <CardPaymentForm
                  pedido={pedido}
                  onEnviando={() => setEstado("aguarde")}
                  onSuccess={() => setEstado("sucesso")}
                  onError={(m) => {
                    setMotivo(m);
                    setEstado("erro");
                  }}
                />
              </div>
            )}

            {estado === "aguarde" && (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-olive" />
                <div>
                  <p className="font-serif text-xl text-charcoal">Aguarde…</p>
                  <p className="text-sm text-charcoal/50">Estamos confirmando seu pagamento.</p>
                </div>
              </div>
            )}

            {estado === "sucesso" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <CheckCircle2 className="h-14 w-14 text-olive" />
                <div>
                  <p className="font-serif text-2xl text-charcoal">Pagamento confirmado!</p>
                  <p className="text-sm text-charcoal/50">
                    Obrigado 💚 Seu pedido está garantido. Pode fechar esta página.
                  </p>
                </div>
              </div>
            )}

            {estado === "erro" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <XCircle className="h-14 w-14 text-terracotta" />
                <div>
                  <p className="font-serif text-xl text-charcoal">Não foi possível concluir</p>
                  <p className="text-sm text-charcoal/50">{motivo}</p>
                </div>
                <Button onClick={() => setEstado("form")} className="bg-charcoal text-white hover:bg-charcoal/90">
                  Tentar novamente
                </Button>
              </div>
            )}

            {estado === "indisponivel" && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <XCircle className="h-12 w-12 text-charcoal/30" />
                <p className="text-sm text-charcoal/60">{msgIndisponivel}</p>
              </div>
            )}
          </div>

          <p className="text-xs text-charcoal/30">Casa Almeria · pagamento processado pela Asaas</p>
        </div>
      </div>
    </>
  );
}
