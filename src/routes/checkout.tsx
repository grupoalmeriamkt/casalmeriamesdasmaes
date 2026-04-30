import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCarrinho, useCarrinhoTotal } from "@/store/carrinho";
import { formatBRL } from "@/store/pedido";
import { useAdmin } from "@/store/admin";
import { Logo } from "@/components/Logo";
import { ThemeApplier } from "@/components/ThemeApplier";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { finalizarPedido } from "@/lib/pedidos";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Casa Almeria" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CheckoutPage,
});

const ClienteSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(120),
  whatsapp: z
    .string()
    .trim()
    .min(10, "WhatsApp inválido")
    .max(20)
    .regex(/^[\d\s()+-]+$/, "Apenas números"),
});

function CheckoutPage() {
  const itens = useCarrinho((s) => s.itens);
  const clear = useCarrinho((s) => s.clear);
  const { total } = useCarrinhoTotal();
  const pagamentoCfg = useAdmin((s) => s.pagamento);
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [tipo, setTipo] = useState<"delivery" | "retirada">("retirada");
  const [endereco, setEndereco] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  if (itens.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-linen p-6 text-center">
        <ThemeApplier />
        <Logo />
        <p className="text-charcoal">Seu carrinho está vazio.</p>
        <Link to="/" className="text-terracotta underline">
          Voltar ao cardápio
        </Link>
        <Toaster position="bottom-right" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = ClienteSchema.safeParse({ nome, whatsapp });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErros({
        nome: flat.nome?.[0] ?? "",
        whatsapp: flat.whatsapp?.[0] ?? "",
      });
      return;
    }
    if (tipo === "delivery" && endereco.trim().length < 6) {
      setErros({ endereco: "Informe o endereço de entrega" });
      return;
    }
    setErros({});
    setEnviando(true);

    try {
      // Persistir pedido como rascunho/pendente
      const sobremesas = itens.map((it) => ({
        nome: it.nome,
        quantidade: it.quantidade,
        preco: it.preco,
      }));
      const { id: pedidoId, error } = await finalizarPedido({
        cliente: { nome: parsed.data.nome, whatsapp: parsed.data.whatsapp },
        sobremesas,
        tipo,
        enderecoOuUnidade: tipo === "delivery" ? endereco : "Retirada na loja",
        pagamento: { metodo: "pix", status: "pendente" },
        total,
      });
      if (error) throw error;

      // Tenta criar preference no Mercado Pago
      if (pagamentoCfg.checkoutAtivo) {
        const origin = window.location.origin;
        const res = await fetch("/api/public/mp-preference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: itens.map((it) => ({
              title: it.nome,
              quantity: it.quantidade,
              unit_price: it.preco,
            })),
            payer: { name: parsed.data.nome, phone: parsed.data.whatsapp },
            externalReference: pedidoId,
            backUrls: {
              success: `${origin}/?pedido=ok`,
              failure: `${origin}/checkout`,
              pending: `${origin}/?pedido=pendente`,
            },
            installments: pagamentoCfg.parcelasMax,
          }),
        });
        const data = await res.json();
        if (data?.init_point) {
          clear();
          window.location.href = data.init_point;
          return;
        }
      }

      // Sem MP → confirma e volta
      clear();
      toast.success("Pedido recebido! Em breve entraremos em contato.");
      navigate({ to: "/" });
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível finalizar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-linen">
      <ThemeApplier />
      <header className="bg-charcoal">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo variant="light" />
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Continuar comprando
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[1fr_360px]">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl bg-white p-6 ring-1 ring-border"
        >
          <h1 className="font-serif text-2xl font-bold text-charcoal">
            Finalizar pedido
          </h1>

          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome completo</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={120}
              required
            />
            {erros.nome && (
              <p className="text-xs text-terracotta">{erros.nome}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wpp">WhatsApp</Label>
            <Input
              id="wpp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(61) 99999-9999"
              maxLength={20}
              required
            />
            {erros.whatsapp && (
              <p className="text-xs text-terracotta">{erros.whatsapp}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Como deseja receber?</Label>
            <div className="flex gap-2">
              {(["retirada", "delivery"] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-semibold capitalize transition-colors ${
                    tipo === t
                      ? "border-terracotta bg-terracotta/10 text-terracotta"
                      : "border-border text-charcoal hover:border-charcoal/40"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {tipo === "delivery" && (
            <div className="space-y-1.5">
              <Label htmlFor="end">Endereço completo</Label>
              <Input
                id="end"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro, complemento"
                maxLength={250}
                required
              />
              {erros.endereco && (
                <p className="text-xs text-terracotta">{erros.endereco}</p>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={enviando}
            className="w-full bg-terracotta text-white hover:bg-terracotta/90"
          >
            {enviando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…
              </>
            ) : pagamentoCfg.checkoutAtivo ? (
              "Pagar com Mercado Pago"
            ) : (
              "Confirmar pedido"
            )}
          </Button>
        </form>

        <aside className="h-fit rounded-2xl bg-white p-5 ring-1 ring-border">
          <h2 className="mb-3 font-serif text-lg font-bold text-charcoal">
            Resumo
          </h2>
          <ul className="space-y-2 text-sm">
            {itens.map((it) => (
              <li
                key={it.produtoId}
                className="flex justify-between gap-3 border-b border-border/60 pb-2"
              >
                <span className="text-charcoal">
                  {it.nome} × {it.quantidade}
                </span>
                <span className="font-semibold text-charcoal">
                  {formatBRL(it.preco * it.quantidade)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between font-serif text-lg font-bold text-charcoal">
            <span>Total</span>
            <span className="text-terracotta">{formatBRL(total)}</span>
          </div>
        </aside>
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}
