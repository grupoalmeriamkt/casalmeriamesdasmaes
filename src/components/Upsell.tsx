import { useMemo } from "react";
import { useSobremesasAtivas, useCampanhaAtiva, useAdmin } from "@/store/admin";
import { usePedido, formatBRL } from "@/store/pedido";
import { Button } from "@/components/ui/button";

type Props = { onFinalizar: () => void; onPular: () => void };

export function Upsell({ onFinalizar, onPular }: Props) {
  const sobremesas = usePedido((s) => s.sobremesas);
  const toggle = usePedido((s) => s.toggleSobremesa);
  const setQtd = usePedido((s) => s.setSobremesaQtd);
  const tipo = usePedido((s) => s.tipo);
  const sobremesasFallback = useSobremesasAtivas();
  const campanha = useCampanhaAtiva();
  const cestas = useAdmin((s) => s.cestas);

  // Itens vindos da campanha ativa (upsell por modo: delivery / retirada).
  const lista = useMemo(() => {
    if (!campanha) return sobremesasFallback;
    const ids =
      tipo === "retirada"
        ? campanha.retirada.upsellAtivo
          ? campanha.retirada.upsellProdutoIds
          : []
        : campanha.delivery.upsellAtivo
          ? campanha.delivery.upsellProdutoIds
          : [];
    if (ids.length > 0) {
      const mapeados = ids
        .map((id) => cestas.find((c) => c.id === id && c.ativo && !c.arquivado))
        .filter(Boolean)
        .map((c) => ({
          id: c!.id,
          nome: c!.nome,
          descricao: c!.descricao,
          preco: c!.preco,
          imagem: c!.imagem,
        }));
      if (mapeados.length > 0) return mapeados;
    }
    return sobremesasFallback;
  }, [campanha, tipo, cestas, sobremesasFallback]);

  const totalAdicionadas = Object.values(sobremesas).reduce(
    (acc, it) => acc + it.sobremesa.preco * it.quantidade,
    0,
  );

  return (
    <section className="bg-linen py-16 md:py-24">
      <div className="container mx-auto px-4 md:px-6">
        <div className="mb-12 text-center">
          <span className="mb-3 inline-block rounded-full bg-sand/15 px-4 py-1.5 text-xs font-semibold text-terracotta">
            Entregue junto com sua cesta
          </span>
          <h2 className="text-balance text-2xl sm:text-3xl font-bold text-charcoal md:text-4xl">
            Aproveite e adicione algo a mais 🍓
          </h2>
          <p className="mt-3 text-muted-foreground">
            Surpreenda ainda mais com uma opção especial da Casa
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {lista.map((s: { id: string; nome: string; descricao: string; preco: number; imagem: string }) => {
            const sel = sobremesas[s.id];
            return (
              <article
                key={s.id}
                className={`overflow-hidden rounded-2xl bg-card shadow-soft transition-all ${
                  sel ? "ring-2 ring-terracotta" : "ring-1 ring-border"
                }`}
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={s.imagem}
                    alt={s.nome}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-charcoal">{s.nome}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.descricao}
                  </p>
                  <p className="mt-2 font-bold text-terracotta">
                    {formatBRL(s.preco)}
                  </p>
                  {sel ? (
                    <div className="mt-3 flex items-center justify-between rounded-lg bg-olive/10 p-2">
                      <button
                        onClick={() => setQtd(s.id, sel.quantidade - 1)}
                        className="h-7 w-7 rounded-md bg-card font-bold text-charcoal shadow-soft"
                      >
                        −
                      </button>
                      <span className="font-semibold text-olive">
                        ✓ {sel.quantidade}
                      </span>
                      <button
                        onClick={() => setQtd(s.id, sel.quantidade + 1)}
                        className="h-7 w-7 rounded-md bg-card font-bold text-charcoal shadow-soft"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="mt-3 w-full border-terracotta text-charcoal hover:bg-terracotta hover:text-charcoal"
                      onClick={() => toggle(s)}
                    >
                      + Adicionar
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mx-auto mt-10 max-w-2xl space-y-3">
          {totalAdicionadas > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-card px-5 py-3 shadow-soft ring-1 ring-border">
              <span className="text-sm text-muted-foreground">
                Adicionados
              </span>
              <span className="font-bold text-charcoal">
                {formatBRL(totalAdicionadas)}
              </span>
            </div>
          )}
          <Button
            size="lg"
            className="w-full bg-charcoal text-white hover:bg-charcoal/90"
            onClick={onFinalizar}
          >
            Finalizar pedido →
          </Button>
          <button
            onClick={onPular}
            className="block w-full text-center text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-charcoal"
          >
            Pular e ir para o pagamento
          </button>
        </div>
      </div>
    </section>
  );
}
