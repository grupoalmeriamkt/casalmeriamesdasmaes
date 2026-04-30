import { usePedido, formatBRL, selectTotal } from "@/store/pedido";
import { useAdmin } from "@/store/admin";
import { inserirPedido } from "@/lib/pedidos";
import { trackPurchase } from "@/lib/gtm";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Zap, CreditCard } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PedidoExtrasView } from "@/components/PedidoExtrasView";

type Props = { onConcluir: () => void; onVoltar: () => void };

export function Resumo({ onConcluir, onVoltar }: Props) {
  const cesta = usePedido((s) => s.cesta);
  const sobremesas = usePedido((s) => s.sobremesas);
  const cliente = usePedido((s) => s.cliente);
  const entregaTipo = usePedido((s) => s.entregaTipo);
  const endereco = usePedido((s) => s.endereco);
  const unidade = usePedido((s) => s.unidade);
  const data = usePedido((s) => s.data);
  const horario = usePedido((s) => s.horario);
  const total = usePedido(selectTotal);
  const finalizar = usePedido((s) => s.finalizarPedido);
  const pedidoId = usePedido((s) => s.pedidoId);
  const extras = usePedido((s) => s.extras);

  const pagamentoCfg = useAdmin((s) => s.pagamento);
  const integracoes = useAdmin((s) => s.integracoes);

  const tabsDisponiveis: ("pix" | "cartao")[] = [
    ...(pagamentoCfg.pix ? ["pix" as const] : []),
    ...(pagamentoCfg.cartao ? ["cartao" as const] : []),
  ];
  const [tab, setTab] = useState<"pix" | "cartao">(tabsDisponiveis[0] ?? "pix");
  const [processando, setProcessando] = useState(false);

  const pagar = async () => {
    setProcessando(true);

    const pedidoPayload = {
      cliente,
      cesta: cesta
        ? {
            nome: cesta.cesta.nome,
            quantidade: cesta.quantidade,
            preco: cesta.cesta.preco,
          }
        : undefined,
      sobremesas: Object.values(sobremesas).map((s) => ({
        nome: s.sobremesa.nome,
        quantidade: s.quantidade,
        preco: s.sobremesa.preco,
      })),
      tipo: entregaTipo ?? "",
      enderecoOuUnidade:
        entregaTipo === "delivery" && endereco
          ? `${endereco.rua}, ${endereco.numero} — ${endereco.bairro}, ${endereco.cidade}-${endereco.estado}`
          : (unidade?.nome ?? ""),
      data,
      horario,
      pagamento: {
        metodo: tab,
        status: "aprovado",
        extras: {
          cartoes: extras.cartoes.map((c) => ({
            nome: c.nome,
            preco: c.preco,
            mensagem: c.mensagem,
          })),
          polaroids: extras.polaroids.map((p) => ({
            nome: p.nome,
            preco: p.preco,
            arquivoUrl: p.arquivoUrl,
            arquivoNome: p.arquivoNome,
          })),
        },
      },
      total,
    };

    // Salva no banco (Supabase)
    const { id, error } = await inserirPedido(pedidoPayload, pedidoId);
    if (error) {
      console.error(error);
      toast.error("Não conseguimos registrar seu pedido. Tente novamente.");
      setProcessando(false);
      return;
    }

    // Limpa carrinho local
    finalizar();

    // GTM purchase
    trackPurchase({
      transaction_id: id ?? `local-${Date.now()}`,
      value: total,
      currency: "BRL",
      payment_type: tab,
      items: [
        ...(cesta
          ? [{
              item_name: cesta.cesta.nome,
              quantity: cesta.quantidade,
              price: cesta.cesta.preco,
            }]
          : []),
        ...Object.values(sobremesas).map((s) => ({
          item_name: s.sobremesa.nome,
          quantity: s.quantidade,
          price: s.sobremesa.preco,
        })),
      ],
    });

    // Webhook (fire-and-forget)
    if (integracoes.webhookUrl && integracoes.dispararPagamento) {
      fetch(integracoes.webhookUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento: "pedido_concluido",
          timestamp: new Date().toISOString(),
          pedido_id: id,
          cliente,
          total,
          pagamento: { metodo: tab, status: "aprovado" },
        }),
      }).catch(() => {});
    }

    setProcessando(false);
    toast.success("Pagamento confirmado!");
    onConcluir();
  };

  return (
    <section className="bg-background py-16 md:py-24">
      <div className="container mx-auto max-w-5xl px-4 md:px-6">
        <button
          onClick={onVoltar}
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-charcoal"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          {/* Resumo */}
          <div className="rounded-2xl bg-linen p-6 ring-1 ring-border md:p-8">
            <h2 className="text-xl font-bold text-charcoal">Resumo do pedido</h2>
            <div className="my-5 space-y-3">
              {cesta && (
                <div className="flex items-center gap-3">
                  <img
                    src={cesta.cesta.imagem}
                    alt=""
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-charcoal">
                      {cesta.cesta.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      × {cesta.quantidade}
                    </p>
                  </div>
                  <span className="font-semibold text-charcoal">
                    {formatBRL(cesta.cesta.preco * cesta.quantidade)}
                  </span>
                </div>
              )}
              {Object.values(sobremesas).map(({ sobremesa, quantidade }) => (
                <div key={sobremesa.id} className="flex items-center gap-3">
                  <img
                    src={sobremesa.imagem}
                    alt=""
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-charcoal">
                      {sobremesa.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      × {quantidade}
                    </p>
                  </div>
                  <span className="font-semibold text-charcoal">
                    {formatBRL(sobremesa.preco * quantidade)}
                  </span>
                </div>
              ))}
            </div>

            <dl className="space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="font-medium text-charcoal">{cliente.nome}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tipo</dt>
                <dd className="font-medium capitalize text-charcoal">
                  {entregaTipo}
                </dd>
              </div>
              {entregaTipo === "delivery" && endereco && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Endereço</dt>
                  <dd className="text-right text-charcoal">
                    {endereco.rua}, {endereco.numero} — {endereco.bairro}
                  </dd>
                </div>
              )}
              {entregaTipo === "retirada" && unidade && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Unidade</dt>
                  <dd className="text-charcoal">{unidade.nome}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Data</dt>
                <dd className="text-charcoal">{data}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Horário</dt>
                <dd className="text-charcoal">{horario}</dd>
              </div>
            </dl>

            <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-3xl font-bold text-terracotta">
                {formatBRL(total)}
              </span>
            </div>
          </div>

          {/* Pagamento */}
          <div className="rounded-2xl bg-card p-6 shadow-soft ring-1 ring-border md:p-8">
            <h2 className="text-xl font-bold text-charcoal">Como deseja pagar?</h2>

            <div
              className="mt-5 grid gap-2 rounded-lg bg-muted p-1"
              style={{ gridTemplateColumns: `repeat(${tabsDisponiveis.length || 1}, minmax(0,1fr))` }}
            >
              {pagamentoCfg.pix && (
                <button
                  onClick={() => setTab("pix")}
                  className={`flex items-center justify-center gap-2 rounded-md py-2 text-sm font-semibold transition-all ${
                    tab === "pix"
                      ? "bg-card text-charcoal shadow-soft"
                      : "text-muted-foreground"
                  }`}
                >
                  <Zap className="h-4 w-4" /> PIX
                </button>
              )}
              {pagamentoCfg.cartao && (
                <button
                  onClick={() => setTab("cartao")}
                  className={`flex items-center justify-center gap-2 rounded-md py-2 text-sm font-semibold transition-all ${
                    tab === "cartao"
                      ? "bg-card text-charcoal shadow-soft"
                      : "text-muted-foreground"
                  }`}
                >
                  <CreditCard className="h-4 w-4" /> Cartão (até {pagamentoCfg.parcelasMax}x)
                </button>
              )}
            </div>

            <div className="mt-6 space-y-3 text-sm text-muted-foreground">
              {tab === "pix" ? (
                <>
                  <p>⚡ Pagamento instantâneo, confirmação imediata.</p>
                  <p className="text-xs">
                    QR Code válido por 30 minutos após a geração.
                  </p>
                </>
              ) : (
                <>
                  <p>💳 Em até 3x sem juros no cartão de crédito.</p>
                  <p className="text-xs">Pagamento processado via Mercado Pago.</p>
                </>
              )}
            </div>

            <Button
              size="lg"
              disabled={processando}
              onClick={pagar}
              className="mt-6 w-full bg-terracotta text-charcoal hover:bg-terracotta/90"
            >
              {processando
                ? "Processando..."
                : tab === "pix"
                  ? "Gerar QR Code PIX"
                  : "Pagar com cartão"}
            </Button>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Integração Mercado Pago disponível na próxima fase.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
