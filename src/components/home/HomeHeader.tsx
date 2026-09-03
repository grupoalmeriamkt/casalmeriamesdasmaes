import { useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import { useAdmin } from "@/store/admin";
import { useCarrinhoTotal } from "@/store/carrinho";
import { aplicarCestasCafePorTamanho } from "@/lib/cestasCafe";
import { aplicarNomeCategoriaBolos } from "@/lib/tamanhoBolo";
import { ShoppingBag, Menu, X } from "lucide-react";

export function HomeHeader() {
  const categorias = useAdmin((s) => s.categorias);
  const cestas = useAdmin((s) => s.cestas);
  const { qtdItens } = useCarrinhoTotal();
  const [menuOpen, setMenuOpen] = useState(false);

  const catsComProduto = useMemo(() => {
    const { cestas: expandida, categorias: catsCafe } = aplicarCestasCafePorTamanho(
      cestas,
      [],
      categorias,
    );
    const { categorias: catsOut } = aplicarNomeCategoriaBolos(catsCafe);
    return catsOut
      .filter((cat) =>
        expandida.some((p) => p.ativo && !p.arquivado && p.categoriaId === cat.id),
      )
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }, [categorias, cestas]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-charcoal/10 bg-linen/95 backdrop-blur-md">
      {/* ── Mobile ── */}
      <div className="flex items-center justify-between px-4 py-3 md:hidden">
        {/* Logo */}
        <a href="/" className="shrink-0">
          <Logo />
        </a>

        {/* Carrinho + menu */}
        <div className="flex items-center gap-1">
          <CartButton qtd={qtdItens} />
          {catsComProduto.length > 0 && (
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-charcoal/8"
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile category menu */}
      {menuOpen && catsComProduto.length > 0 && (
        <nav className="border-t border-charcoal/8 px-4 pb-3 pt-2 md:hidden">
          <div className="flex flex-wrap gap-2">
            {catsComProduto.map((cat) => (
              <a
                key={cat.id}
                href={`#cat-${cat.id}`}
                onClick={() => setMenuOpen(false)}
                className="rounded-full bg-charcoal/6 px-3 py-1.5 text-xs font-semibold text-charcoal transition-colors hover:bg-charcoal hover:text-white"
              >
                {cat.nome}
              </a>
            ))}
          </div>
        </nav>
      )}

      {/* ── Desktop ── */}
      <div className="hidden md:block">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3 lg:px-8">
          {/* Logo */}
          <a href="/" className="shrink-0">
            <Logo />
          </a>

          {/* Nav pills */}
          {catsComProduto.length > 0 && (
            <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
              <a
                href="#cardapio"
                className="rounded-full px-3 py-1.5 text-sm font-medium text-charcoal/70 transition-colors hover:bg-charcoal/8 hover:text-charcoal"
              >
                Cardápio
              </a>
              {catsComProduto.map((cat) => (
                <a
                  key={cat.id}
                  href={`#cat-${cat.id}`}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-charcoal/70 transition-colors hover:bg-charcoal/8 hover:text-charcoal"
                >
                  {cat.nome}
                </a>
              ))}
            </nav>
          )}

          {/* Spacer se não há nav */}
          {catsComProduto.length === 0 && <div className="flex-1" />}

          {/* Sacola */}
          <div className="flex items-center gap-4">
            <CartButtonDesktop qtd={qtdItens} />
          </div>
        </div>
      </div>
    </header>
  );
}

function CartButton({ qtd }: { qtd: number }) {
  return (
    <div className="relative">
      <button
        aria-label="Carrinho"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal text-white transition-transform hover:scale-105 active:scale-95"
      >
        <ShoppingBag className="h-4.5 w-4.5" />
      </button>
      {qtd > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] font-bold text-white">
          {qtd}
        </span>
      )}
    </div>
  );
}

function CartButtonDesktop({ qtd }: { qtd: number }) {
  return (
    <button
      aria-label="Sacola"
      className="flex items-center gap-2 rounded-full bg-charcoal px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-charcoal/90 active:scale-95"
    >
      <ShoppingBag className="h-4 w-4" />
      <span>Sacola</span>
      {qtd > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta px-1.5 text-[10px] font-bold text-white">
          {qtd}
        </span>
      )}
    </button>
  );
}
