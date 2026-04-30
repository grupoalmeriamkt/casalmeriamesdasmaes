import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useAdmin } from "@/store/admin";

export function HomeCampanhasDestaque() {
  const campanhas = useAdmin((s) => s.campanhas);
  const destaques = useAdmin((s) => s.home.campanhasDestaque);

  const lista = useMemo(() => {
    return campanhas
      .filter((c) => c.status === "ativa" && destaques[c.id]?.ativo)
      .map((c) => ({ ...c, ordem: destaques[c.id]?.ordem ?? 0 }))
      .sort((a, b) => a.ordem - b.ordem);
  }, [campanhas, destaques]);

  if (lista.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:px-8">
      <h2 className="mb-5 font-serif text-2xl font-semibold text-charcoal sm:text-3xl">
        Campanhas em destaque
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((c) => (
          <Link
            key={c.id}
            to="/$slug"
            params={{ slug: c.slug }}
            className="group overflow-hidden rounded-2xl bg-white ring-1 ring-sand/60 transition-all hover:-translate-y-0.5 hover:shadow-soft"
          >
            <div className="aspect-[16/9] w-full overflow-hidden bg-parchment">
              {c.imagemDestaque ? (
                <img
                  src={c.imagemDestaque}
                  alt={c.nome}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-charcoal/5 text-charcoal/40">
                  Sem imagem
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-serif text-lg font-bold text-charcoal">
                {c.textos?.titulo || c.nome}
              </h3>
              {c.textos?.subtitulo && (
                <p className="mt-1 line-clamp-2 text-xs text-ink/60">
                  {c.textos.subtitulo}
                </p>
              )}
              <span className="mt-3 inline-block rounded-full bg-charcoal px-4 py-1.5 text-xs font-semibold text-white">
                Acessar campanha
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
