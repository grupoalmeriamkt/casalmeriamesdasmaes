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
    <section className="py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-baseline justify-between px-5 md:px-6 lg:px-8">
          <h2 className="font-serif text-[22px] font-semibold text-charcoal">
            Categorias
          </h2>
          <a
            href="#cardapio"
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-terracotta hover:text-terracotta/80"
          >
            Ver tudo
          </a>
        </div>

        {/* Horizontal scroll (mobile) */}
        <div
          className="scrollbar-hide overflow-x-auto pb-1 md:hidden"
          style={{ padding: "0 20px 4px" }}
        >
          <div className="flex gap-2.5">
            {comProdutos.map((cat) => (
              <a
                key={cat.id}
                href={`#cat-${cat.id}`}
                className="flex shrink-0 flex-col items-center gap-2 rounded-2xl border border-charcoal/8 bg-white transition-all duration-200 hover:border-charcoal/20 hover:shadow-soft"
                style={{ width: 96, padding: "14px 10px" }}
              >
                {/* Glyph */}
                <div
                  className="flex shrink-0 items-center justify-center overflow-hidden"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 11,
                    background: "#e8c89a",
                    color: "#8a5a1f",
                  }}
                >
                  {cat.imagemCapa ? (
                    <img
                      src={cat.imagemCapa}
                      alt={cat.nome}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-serif text-sm font-semibold">
                      {cat.nome.charAt(0)}
                    </span>
                  )}
                </div>
                <p className="text-center text-[12.5px] font-semibold text-charcoal leading-tight">
                  {cat.nome}
                </p>
                <p className="text-[10.5px] text-charcoal/50">{cat.count}</p>
              </a>
            ))}
          </div>
        </div>

        {/* Grid desktop */}
        <div className="hidden gap-3 px-6 md:grid md:grid-cols-4 lg:grid-cols-6 lg:px-8">
          {comProdutos.map((cat) => (
            <a
              key={cat.id}
              href={`#cat-${cat.id}`}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-charcoal/8 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft"
            >
              <div
                className="flex shrink-0 items-center justify-center overflow-hidden transition-colors group-hover:opacity-90"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  background: "#e8c89a",
                  color: "#8a5a1f",
                }}
              >
                {cat.imagemCapa ? (
                  <img
                    src={cat.imagemCapa}
                    alt={cat.nome}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <span className="font-serif text-base font-semibold">
                    {cat.nome.charAt(0)}
                  </span>
                )}
              </div>
              <div className="text-center">
                <p className="text-[13px] font-semibold text-charcoal">{cat.nome}</p>
                <p className="mt-0.5 text-[11px] text-charcoal/50">
                  {cat.count} produto{cat.count !== 1 ? "s" : ""}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
