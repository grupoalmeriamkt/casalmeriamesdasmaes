import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCarrinho, useCarrinhoTotal } from "@/store/carrinho";
import { formatBRL } from "@/store/pedido";
import { ShoppingCart, Trash2, Minus, Plus } from "lucide-react";

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const itens = useCarrinho((s) => s.itens);
  const setQtd = useCarrinho((s) => s.setQtd);
  const remove = useCarrinho((s) => s.remove);
  const { qtdItens, total } = useCarrinhoTotal();
  const navigate = useNavigate();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Abrir carrinho"
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-terracotta text-white shadow-elevated transition-transform hover:scale-105 sm:bottom-8 sm:right-8"
        >
          <ShoppingCart className="h-6 w-6" />
          {qtdItens > 0 && (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-charcoal px-1.5 text-xs font-bold text-white ring-2 ring-background">
              {qtdItens}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Seu carrinho</SheetTitle>
        </SheetHeader>

        {itens.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
            Seu carrinho está vazio.
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-3 overflow-y-auto py-4">
              {itens.map((it) => (
                <li
                  key={it.produtoId}
                  className="flex gap-3 rounded-lg bg-card p-3 ring-1 ring-border"
                >
                  <img
                    src={it.imagem}
                    alt={it.nome}
                    className="h-16 w-16 shrink-0 rounded object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-charcoal">
                      {it.nome}
                    </p>
                    <p className="text-xs font-bold text-terracotta">
                      {formatBRL(it.preco)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => setQtd(it.produtoId, it.quantidade - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-semibold">
                        {it.quantidade}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => setQtd(it.produtoId, it.quantidade + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto h-7 w-7 text-terracotta"
                        onClick={() => remove(it.produtoId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-border pt-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-serif text-xl font-bold text-charcoal">
                  {formatBRL(total)}
                </span>
              </div>
              <Button
                onClick={() => {
                  setOpen(false);
                  navigate({ to: "/checkout" });
                }}
                className="w-full bg-terracotta text-white hover:bg-terracotta/90"
              >
                Finalizar pedido
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
