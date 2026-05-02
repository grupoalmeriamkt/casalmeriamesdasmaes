import { useMemo } from "react";
import { useAdmin } from "@/store/admin";

export function HomeCategoriasCarousel() {
  const categorias = useAdmin((s) => s.categorias);
  const cestas = useAdmin((s) => s.cestas);

  const comProdutos = useMemo(() => {
    const ativos = cestas.filter((c) => c.ativo && !c.arquivado);
    return [...categorias]
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((cat) => ({
        ...cat,
        count: ativos.filter((p) => p.categoriaId === cat.id).length,
      }))
      .filter((cat) => cat.count > 0);
  }, [categorias, cestas]);

  if (comProdutos.length === 0) return null;

  return (
    <section className="py-8 md:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-serif text-2xl font-semibold text-charcoal md:text-3xl">
            Categorias
          </h2>
          <a
            href="#cardapio"
            className="text-xs font-semibold uppercase tracking-widest text-terracotta hover:text-terracotta/80"
          >
            Ver tudo
          </a>
        </div>

        {/* ── Mobile: horizontal scroll ── */}
        <div className="scrollbar-hide -mx-4 overflow-x-auto px-4 pb-1 md:hidden">
          <ul className="flex gap-3">
            {comProdutos.map((cat) => (
              <li key={cat.id} className="shrink-0">
                <a href={`#cat-${cat.id}`} className="group flex flex-col items-center gap-2">
                  {/* Glyph */}
                  <div className="relative h-[72px] w-[72px] overflow-hidden rounded-2xl bg-terracotta/12 transition-all duration-200 group-hover:bg-terracotta/22 group-hover:shadow-warm">
                    {cat.imagemCapa ? (
                      <img
                        src={cat.imagemCapa}
                        alt={cat.nome}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-serif text-2xl font-semibold text-terracotta">
                        {cat.nome.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className="max-w-[80px] text-center text-xs font-semibold text-charcoal">
                    {cat.nome}
                  </p>
                  <p className="text-[10px] text-charcoal/40">{cat.count}</p>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Desktop: grid até 6 colunas ── */}
        <div className="hidden gap-3 md:grid md:grid-cols-4 lg:grid-cols-6">
          {comProdutos.map((cat) => (
            <a
              key={cat.id}
              href={`#cat-${cat.id}`}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-transparent p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-charcoal/10 hover:bg-white hover:shadow-soft"
            >
              {/* Glyph */}
              <div className="relative h-16 w-16 overflow-hidden rounded-[18px] bg-terracotta/12 transition-colors group-hover:bg-terracotta/20">
                {cat.imagemCapa ? (
                  <img
                    src={cat.imagemCapa}
                    alt={cat.nome}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-serif text-2xl font-semibold text-terracotta">
                    {cat.nome.charAt(0)}
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-charcoal">{cat.nome}</p>
                <p className="mt-0.5 text-[11px] text-charcoal/40">{cat.count} produto{cat.count !== 1 ? "s" : ""}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
