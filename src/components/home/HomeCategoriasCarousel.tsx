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
    <section className="py-6 md:pb-12 md:pt-0">
      {/* ── Mobile: horizontal scroll ── */}
      <div className="md:hidden">
        <div className="mb-4 flex items-baseline justify-between px-5">
          <h2 className="font-serif text-[22px] font-semibold text-charcoal">
            Categorias
          </h2>
          <a href="#cardapio" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-terracotta">
            Ver tudo
          </a>
        </div>
        <div
          className="scrollbar-hide overflow-x-auto pb-1"
          style={{ padding: "0 20px 4px" }}
        >
          <div className="flex gap-2.5">
            {comProdutos.map((cat) => (
              <a
                key={cat.id}
                href={`#cat-${cat.id}`}
                className="flex shrink-0 flex-col items-center gap-2 rounded-2xl border border-charcoal/8 bg-white transition-all duration-200 hover:border-charcoal/20"
                style={{ width: 96, padding: "14px 10px" }}
              >
                <Glifo cat={cat} size={32} />
                <p className="text-center text-[12.5px] font-semibold leading-tight text-charcoal">
                  {cat.nome}
                </p>
                <p className="text-[10.5px] text-charcoal/50">{cat.count}</p>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Desktop: grid 6 colunas ── */}
      <div className="mx-auto hidden max-w-6xl px-6 md:block lg:px-8">
        <div className="mb-[22px] flex items-baseline justify-between">
          <h2
            className="font-serif font-semibold text-charcoal"
            style={{ fontSize: 30, letterSpacing: "-0.01em" }}
          >
            Categorias
          </h2>
          <a
            href="#cardapio"
            className="text-[13px] font-semibold uppercase tracking-[0.08em] text-terracotta hover:text-terracotta/80"
          >
            Ver tudo
          </a>
        </div>
        <div className="grid grid-cols-6 gap-3">
          {comProdutos.map((cat) => (
            <a
              key={cat.id}
              href={`#cat-${cat.id}`}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-charcoal/8 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-charcoal/16 hover:shadow-soft"
              style={{ padding: "24px 12px" }}
            >
              <Glifo cat={cat} size={48} />
              <div className="text-center">
                <p className="text-[14px] font-semibold text-charcoal">{cat.nome}</p>
                <p className="mt-0.5 text-[11.5px] text-charcoal/50">
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

function Glifo({ cat, size }: { cat: { nome: string; imagemCapa?: string }; size: number }) {
  const radius = Math.round(size * 0.35);
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden"
      style={{ width: size, height: size, borderRadius: radius, background: "#e8c89a", color: "#8a5a1f" }}
    >
      {cat.imagemCapa ? (
        <img src={cat.imagemCapa} alt={cat.nome} className="h-full w-full object-cover" />
      ) : (
        <span className="font-serif font-semibold" style={{ fontSize: size * 0.42 }}>
          {cat.nome.charAt(0)}
        </span>
      )}
    </div>
  );
}
