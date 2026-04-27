import { useState } from "react";
import { useCestasAtivas, useAdmin } from "@/store/admin";
import type { Cesta } from "@/lib/types";
import { usePedido, formatBRL } from "@/store/pedido";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Check } from "lucide-react";

export function Produtos({ onContinuar }: { onContinuar: () => void }) {
  const cestaSelecionada = usePedido((s) => s.cesta);
  const setCesta = usePedido((s) => s.setCesta);
  const setQuantidade = usePedido((s) => s.setQuantidade);
  const cestas = useCestasAtivas();
  const textos = useAdmin((s) => s.textos);
  const [detalhe, setDetalhe] = useState<Cesta | null>(null);

  return (
    <section
      id="produtos"
      className={`bg-linen py-16 sm:py-24 md:py-28 ${cestaSelecionada ? "pb-32 sm:pb-40 md:pb-44" : ""}`}
    >
      <div className="container mx-auto px-4 sm:px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow-gold">Escolha a cesta dela</span>
          <h2 className="text-balance mt-3 font-serif text-[1.85rem] font-semibold leading-[1.1] text-charcoal sm:text-4xl md:text-5xl">
            Cestas pensadas para <em className="italic text-terracotta">cada tipo de mãe</em>.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-pretty text-[0.98rem] sm:text-base leading-relaxed text-ink/75">
            Curadas à mão, entregues quentes na manhã do Dia das Mães.
            Pix com 5% off ou cartão em até 3x.
          </p>
          <div className="mt-6 flex justify-center px-4">
            <span className="tag-prazo">{textos.badgePrazo}</span>
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:gap-8 md:grid-cols-2">
          {cestas.map((cesta) => {
            const sel = cestaSelecionada?.cesta.id === cesta.id;
            return (
              <article
                key={cesta.id}
                onClick={() => setCesta(cesta)}
                className={`group relative cursor-pointer overflow-hidden rounded-3xl bg-white transition-all hover:-translate-y-1 hover:shadow-soft ${
                  sel ? "ring-2 ring-terracotta" : "ring-1 ring-sand/60"
                }`}
              >
                {sel && (
                  <span className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-terracotta text-white shadow-warm">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                )}
                <div className="aspect-[16/10] w-full overflow-hidden bg-parchment">
                  <img
                    src={cesta.imagem}
                    alt={cesta.nome}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-5 sm:p-6">
                  <span className="inline-block rounded-full bg-olive px-3 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-white">
                    {cesta.badge}
                  </span>
                  <h3 className="mt-3 font-serif text-xl font-bold leading-tight text-charcoal sm:text-2xl">
                    {cesta.nome}
                  </h3>
                  <p className="mt-1 font-serif text-2xl font-semibold text-terracotta">
                    {formatBRL(cesta.preco)}
                  </p>
                  <p className="mt-3 text-[0.95rem] leading-relaxed text-ink/75">
                    {cesta.itens.slice(0, 5).join(" · ")}
                    {cesta.itens.length > 5 && "…"}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetalhe(cesta);
                    }}
                    className="mt-4 inline-flex w-full sm:w-auto items-center justify-center rounded-full border border-charcoal px-4 py-2 text-xs font-medium text-charcoal transition-colors hover:bg-charcoal hover:text-white"
                  >
                    Ver itens completos
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {cestaSelecionada && (
          <div className="mx-auto mt-12 max-w-2xl animate-fade-up rounded-2xl bg-white p-6 ring-1 ring-sand/60 sm:p-8">
            <div className="flex items-center gap-4">
              <img
                src={cestaSelecionada.cesta.imagem}
                alt=""
                className="h-16 w-16 flex-none rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-lg font-semibold text-charcoal">
                  {cestaSelecionada.cesta.nome}
                </p>
                <p className="text-sm text-terracotta">
                  {formatBRL(cestaSelecionada.cesta.preco)} cada
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantidade(cestaSelecionada.quantidade - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal/40 text-charcoal hover:bg-charcoal hover:text-linen"
                >
                  −
                </button>
                <span className="w-6 text-center font-serif text-lg">
                  {cestaSelecionada.quantidade}
                </span>
                <button
                  onClick={() => setQuantidade(cestaSelecionada.quantidade + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal/40 text-charcoal hover:bg-charcoal hover:text-linen"
                >
                  +
                </button>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-sand/60 pt-4">
              <span className="text-xs uppercase tracking-[0.2em] text-ink/60">
                Subtotal
              </span>
              <span className="font-serif text-2xl font-bold text-terracotta">
                {formatBRL(cestaSelecionada.cesta.preco * cestaSelecionada.quantidade)}
              </span>
            </div>
            <button
              onClick={onContinuar}
              className="mt-5 w-full rounded-xl bg-charcoal py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-charcoal/90"
            >
              Fazer meu pedido →
            </button>
          </div>
        )}
      </div>

      {/* Barra fixa no rodapé */}
      {cestaSelecionada && (
        <div className="fixed inset-x-0 bottom-0 z-40 animate-fade-up border-t border-sand/60 bg-linen/95 backdrop-blur-md shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)]">
          <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 md:px-10">
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <img
                src={cestaSelecionada.cesta.imagem}
                alt=""
                className="h-11 w-11 flex-none rounded-lg object-cover sm:h-12 sm:w-12"
              />
              <div className="min-w-0 text-left">
                <p className="truncate font-serif text-sm font-semibold text-charcoal sm:text-base">
                  {cestaSelecionada.cesta.nome}
                </p>
                <p className="whitespace-nowrap text-xs text-terracotta sm:text-sm">
                  {formatBRL(cestaSelecionada.cesta.preco * cestaSelecionada.quantidade)}
                  <span className="ml-2 text-[0.65rem] text-ink/60 sm:text-xs">
                    ({cestaSelecionada.quantidade}x)
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={onContinuar}
              className="inline-flex flex-none items-center justify-center gap-2 whitespace-nowrap rounded-full bg-terracotta px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-warm transition-all hover:bg-charcoal sm:px-8 sm:py-3 sm:text-sm sm:tracking-[0.18em]"
            >
              <span className="hidden sm:inline">Fazer meu pedido</span>
              <span className="sm:hidden">Pedir</span>
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      )}

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-lg overflow-hidden border-sand/60 bg-linen p-0">
          {detalhe && (
            <>
              <div className="relative aspect-[16/10]">
                <img
                  src={detalhe.imagem}
                  alt={detalhe.nome}
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-4 top-4 rounded-full bg-olive px-3 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-white">
                  {detalhe.badge}
                </span>
              </div>
              <div className="p-6 sm:p-8">
                <DialogHeader>
                  <DialogTitle className="font-serif text-2xl font-bold text-charcoal">
                    {detalhe.nome}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-ink/70">
                    {detalhe.descricao}
                  </DialogDescription>
                </DialogHeader>
                <p className="mt-3 font-serif text-2xl font-semibold text-terracotta">
                  {formatBRL(detalhe.preco)}
                </p>
                <ul className="mt-5 max-h-64 space-y-2 overflow-y-auto pr-2">
                  {detalhe.itens.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 border-b border-charcoal/5 pb-2 text-sm text-ink"
                    >
                      <span className="mt-1.5 block h-1.5 w-1.5 flex-none rounded-full bg-terracotta" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    setCesta(detalhe);
                    setDetalhe(null);
                  }}
                  className="mt-6 w-full rounded-xl bg-charcoal py-4 text-sm font-medium text-white hover:bg-charcoal/90"
                >
                  Adicionar ao pedido — {formatBRL(detalhe.preco)}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
