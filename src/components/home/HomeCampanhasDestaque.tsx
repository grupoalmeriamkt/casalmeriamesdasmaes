import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAdmin } from "@/store/admin";
import { ArrowRight } from "lucide-react";

// Paleta de tons para os cards de campanha (cíclica)
const TONES = [
  {
    bg: "bg-charcoal",
    text: "text-white",
    sub: "text-white/65",
    eyebrow: "text-terracotta",
    btn: "bg-terracotta text-white hover:bg-terracotta/85",
    imgOverlay: "from-charcoal/60 to-transparent",
  },
  {
    bg: "bg-terracotta",
    text: "text-white",
    sub: "text-white/70",
    eyebrow: "text-white/80",
    btn: "bg-white text-charcoal hover:bg-white/90",
    imgOverlay: "from-terracotta/70 to-transparent",
  },
  {
    bg: "bg-[#f3ecdf]",
    text: "text-charcoal",
    sub: "text-charcoal/60",
    eyebrow: "text-terracotta",
    btn: "bg-charcoal text-white hover:bg-charcoal/85",
    imgOverlay: "from-[#f3ecdf]/70 to-transparent",
  },
] as const;

export function HomeCampanhasDestaque() {
  const campanhas = useAdmin((s) => s.campanhas);
  const destaques = useAdmin((s) => s.home.campanhasDestaque);
  const [activeIdx, setActiveIdx] = useState(0);

  const lista = useMemo(() => {
    return campanhas
      .filter((c) => c.status === "ativa" && destaques[c.id]?.ativo)
      .map((c) => ({ ...c, ordem: destaques[c.id]?.ordem ?? 0 }))
      .sort((a, b) => a.ordem - b.ordem);
  }, [campanhas, destaques]);

  if (lista.length === 0) return null;

  return (
    <section className="py-10 md:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Título da seção */}
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-serif text-2xl font-semibold text-charcoal md:text-3xl">
            Nossas campanhas
          </h2>
        </div>

        {/* ── Mobile: carousel horizontal com snap ── */}
        <div className="md:hidden">
          <div
            className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2"
            onScroll={(e) => {
              const el = e.currentTarget;
              const idx = Math.round(el.scrollLeft / (el.scrollWidth / lista.length));
              setActiveIdx(Math.min(idx, lista.length - 1));
            }}
          >
            {lista.map((c, i) => {
              const tone = TONES[i % TONES.length];
              return (
                <Link
                  key={c.id}
                  to="/$slug"
                  params={{ slug: c.slug }}
                  className={`relative flex w-[80vw] max-w-[296px] shrink-0 snap-start flex-col overflow-hidden rounded-[22px] ${tone.bg} p-5 transition-transform hover:scale-[1.02]`}
                  style={{ minHeight: 176 }}
                >
                  {c.imagemDestaque && (
                    <div className="absolute inset-0">
                      <img
                        src={c.imagemDestaque}
                        alt={c.nome}
                        className="h-full w-full object-cover opacity-20"
                      />
                    </div>
                  )}
                  <div className="relative flex flex-1 flex-col">
                    <p className={`mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${tone.eyebrow}`}>
                      Campanha
                    </p>
                    <h3 className={`font-serif text-xl font-semibold leading-tight ${tone.text}`}>
                      {c.textos?.titulo || c.nome}
                    </h3>
                    {c.textos?.subtitulo && (
                      <p className={`mt-1.5 line-clamp-2 text-xs leading-relaxed ${tone.sub}`}>
                        {c.textos.subtitulo}
                      </p>
                    )}
                    <div className="mt-auto pt-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold ${tone.btn} transition-colors`}>
                        Ver coleção
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Dot indicators */}
          {lista.length > 1 && (
            <div className="mt-3 flex justify-center gap-1.5">
              {lista.map((_, i) => (
                <span
                  key={i}
                  className={`block h-1.5 rounded-full bg-charcoal transition-all duration-300 ${
                    i === activeIdx ? "w-4 opacity-100" : "w-1.5 opacity-25"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Desktop: grid 3 colunas ── */}
        <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
          {lista.map((c, i) => {
            const tone = TONES[i % TONES.length];
            return (
              <Link
                key={c.id}
                to="/$slug"
                params={{ slug: c.slug }}
                className={`group relative flex flex-col overflow-hidden rounded-[22px] ${tone.bg} p-6 transition-all hover:-translate-y-0.5 hover:shadow-elevated`}
                style={{ minHeight: 200 }}
              >
                {c.imagemDestaque && (
                  <div className="absolute inset-0">
                    <img
                      src={c.imagemDestaque}
                      alt={c.nome}
                      className="h-full w-full object-cover opacity-15 transition-opacity duration-500 group-hover:opacity-25"
                    />
                  </div>
                )}
                <div className="relative flex flex-1 flex-col">
                  <p className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${tone.eyebrow}`}>
                    Campanha
                  </p>
                  <h3 className={`font-serif text-2xl font-semibold leading-tight ${tone.text}`}>
                    {c.textos?.titulo || c.nome}
                  </h3>
                  {c.textos?.subtitulo && (
                    <p className={`mt-2 line-clamp-2 text-sm leading-relaxed ${tone.sub}`}>
                      {c.textos.subtitulo}
                    </p>
                  )}
                  <div className="mt-auto pt-5">
                    <span className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold ${tone.btn} transition-colors`}>
                      Ver coleção
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
