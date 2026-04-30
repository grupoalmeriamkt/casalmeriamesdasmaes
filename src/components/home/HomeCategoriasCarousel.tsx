import { useMemo } from "react";
import { useAdmin } from "@/store/admin";

export function HomeCategoriasCarousel() {
  const categorias = useAdmin((s) => s.categorias);
  const cestas = useAdmin((s) => s.cestas);

  const comProdutos = useMemo(() => {
    const ativos = cestas.filter((c) => c.ativo && !c.arquivado);
    return [...categorias]
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .filter((cat) => ativos.some((p) => p.categoriaId === cat.id));
  }, [categorias, cestas]);

  if (comProdutos.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8">
      <h2 className="mb-4 font-serif text-2xl font-semibold text-charcoal sm:text-3xl">
        Categorias
      </h2>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
        <ul className="flex gap-3 sm:gap-4">
          {comProdutos.map((cat) => (
            <li key={cat.id} className="shrink-0">
              <a
                href={`#cat-${cat.id}`}
                className="group block w-32 sm:w-40"
              >
                <div className="aspect-square w-full overflow-hidden rounded-2xl bg-parchment ring-1 ring-sand/60 transition-all group-hover:ring-charcoal/40">
                  {cat.imagemCapa ? (
                    <img
                      src={cat.imagemCapa}
                      alt={cat.nome}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center font-serif text-2xl text-charcoal/30">
                      {cat.nome.charAt(0)}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-center text-sm font-semibold text-charcoal">
                  {cat.nome}
                </p>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
