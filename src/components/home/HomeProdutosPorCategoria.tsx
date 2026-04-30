import { useMemo } from "react";
import { useAdmin } from "@/store/admin";
import { useCarrinho } from "@/store/carrinho";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/store/pedido";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export function HomeProdutosPorCategoria() {
  const categorias = useAdmin((s) => s.categorias);
  const cestas = useAdmin((s) => s.cestas);
  const add = useCarrinho((s) => s.add);

  const grupos = useMemo(() => {
    const ativos = cestas.filter((c) => c.ativo && !c.arquivado);
    const cats = [...categorias].sort(
      (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0),
    );
    const out: { id: string; nome: string; produtos: typeof ativos }[] = [];
    for (const cat of cats) {
      const lista = ativos.filter((p) => p.categoriaId === cat.id);
      if (lista.length) out.push({ id: cat.id, nome: cat.nome, produtos: lista });
    }
    const semCat = ativos.filter(
      (p) => !p.categoriaId || !cats.find((c) => c.id === p.categoriaId),
    );
    if (semCat.length) out.push({ id: "outros", nome: "Outros", produtos: semCat });
    return out;
  }, [categorias, cestas]);

  if (grupos.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nenhum produto disponível no momento.
      </p>
    );
  }

  return (
    <div id="cardapio" className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6 md:px-8">
      {grupos.map((g) => (
        <section key={g.id} id={`cat-${g.id}`} className="scroll-mt-20">
          <h2 className="mb-4 font-serif text-2xl font-semibold text-charcoal sm:text-3xl">
            {g.nome}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.produtos.map((p) => (
              <article
                key={p.id}
                className="group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-sand/60 transition-all hover:-translate-y-0.5 hover:shadow-soft"
              >
                <div className="aspect-[16/10] w-full overflow-hidden bg-parchment">
                  <img
                    src={p.imagem}
                    alt={p.nome}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  {p.badge && (
                    <span className="inline-block w-fit rounded-full bg-olive px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-white">
                      {p.badge}
                    </span>
                  )}
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
                    onClick={() => {
                      add({
                        produtoId: p.id,
                        nome: p.nome,
                        preco: p.preco,
                        imagem: p.imagem,
                      });
                      toast.success(`${p.nome} adicionado ao carrinho`);
                    }}
                    className="mt-auto w-full bg-charcoal pt-4 hover:bg-charcoal/90"
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Adicionar
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
