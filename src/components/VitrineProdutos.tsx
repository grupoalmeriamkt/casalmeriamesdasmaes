import { useMemo } from "react";
import { useAdmin, type CestaAdmin } from "@/store/admin";
import { formatBRL } from "@/store/pedido";
import { Button } from "@/components/ui/button";

type Props = {
  onEscolher: (cesta: CestaAdmin) => void;
};

export function VitrineProdutos({ onEscolher }: Props) {
  const cestas = useAdmin((s) => s.cestas);
  const categorias = useAdmin((s) => s.categorias);

  const ativos = useMemo(
    () => cestas.filter((c) => c.ativo && !c.arquivado),
    [cestas],
  );

  const grupos = useMemo(() => {
    const out: { categoria: string; produtos: CestaAdmin[] }[] = [];
    for (const cat of categorias) {
      const lista = ativos.filter((p) => p.categoriaId === cat.id);
      if (lista.length > 0) out.push({ categoria: cat.nome, produtos: lista });
    }
    const semCat = ativos.filter(
      (p) => !p.categoriaId || !categorias.find((c) => c.id === p.categoriaId),
    );
    if (semCat.length > 0) out.push({ categoria: "Outros", produtos: semCat });
    return out;
  }, [ativos, categorias]);

  if (ativos.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nenhum produto disponível no momento.
      </p>
    );
  }

  return (
    <div className="space-y-12">
      {grupos.map((g) => (
        <section key={g.categoria}>
          <h2 className="mb-4 font-serif text-2xl font-semibold text-charcoal sm:text-3xl">
            {g.categoria}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.produtos.map((p) => (
              <article
                key={p.id}
                className="group overflow-hidden rounded-2xl bg-white ring-1 ring-sand/60 transition-all hover:-translate-y-0.5 hover:shadow-soft"
              >
                <div className="aspect-[16/10] w-full overflow-hidden bg-parchment">
                  <img
                    src={p.imagem}
                    alt={p.nome}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-4 sm:p-5">
                  <span className="inline-block rounded-full bg-olive px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-white">
                    {p.badge}
                  </span>
                  <h3 className="mt-2 font-serif text-lg font-bold text-charcoal sm:text-xl">
                    {p.nome}
                  </h3>
                  <p className="mt-0.5 font-serif text-xl font-semibold text-terracotta">
                    {formatBRL(p.preco)}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink/60">
                    {p.descricao || p.itens.slice(0, 4).join(" · ")}
                  </p>
                  <Button
                    onClick={() => onEscolher(p)}
                    className="mt-4 w-full bg-charcoal hover:bg-charcoal/90"
                  >
                    Quero esse
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
