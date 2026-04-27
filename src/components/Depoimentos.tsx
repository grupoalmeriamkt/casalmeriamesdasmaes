export function Depoimentos() {
  const items = [
    {
      q: "Foi a manhã mais bonita do ano. Minha mãe abriu a cesta como se abrisse um livro de receitas antigo.",
      a: "Beatriz M.",
      l: "Asa Sul",
    },
    {
      q: "Tudo impecável — do pão à embalagem. Um presente que se sente, antes mesmo de provar.",
      a: "Carolina R.",
      l: "Noroeste",
    },
    {
      q: "Recebi de presente e me senti em uma trattoria no Mediterrâneo. Voltarei a encomendar.",
      a: "Helena P.",
      l: "Lago Sul",
    },
  ];

  return (
    <section className="bg-linen py-16 sm:py-24 md:py-32">
      <div className="container mx-auto px-4 sm:px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Quem recebe, sente</span>
          <h2 className="text-balance mt-4 font-serif text-[1.85rem] sm:text-4xl font-light leading-[1.1] text-charcoal md:text-5xl">
            Mães que <em className="italic text-terracotta">já receberam</em>.
          </h2>
          <div className="mx-auto mt-5 flex items-center justify-center gap-2 text-sm text-ink/70">
            <span className="text-terracotta tracking-widest">★★★★★</span>
            <span>4.9/5 · +200 entregas em Brasília</span>
          </div>
          <div className="mx-auto mt-6 h-px w-16 bg-sand" />
        </div>

        {/* Mobile: carrossel horizontal com snap. Desktop: grid */}
        <div className="mt-12 sm:mt-16 md:hidden">
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 -mx-4 scrollbar-hide">
            {items.map((it, i) => (
              <figure
                key={i}
                className="snap-center flex-none w-[85%] flex flex-col justify-between border border-sand/50 bg-card/60 p-6"
              >
                <span aria-hidden className="font-serif text-5xl leading-none text-terracotta/30">"</span>
                <blockquote className="mt-2 font-serif text-base italic leading-relaxed text-charcoal">
                  {it.q}
                </blockquote>
                <figcaption className="mt-6 border-t border-sand/40 pt-3">
                  <p className="text-sm font-medium text-charcoal">{it.a}</p>
                  <p className="text-[0.7rem] uppercase tracking-[0.2em] text-ink/60">{it.l}</p>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-ink/50">← arraste para ver mais →</p>
        </div>

        <div className="mx-auto mt-16 hidden max-w-6xl gap-8 md:grid md:grid-cols-3">
          {items.map((it, i) => (
            <figure
              key={i}
              className="flex flex-col justify-between border border-sand/50 bg-card/60 p-8 transition-colors hover:bg-card"
            >
              <span aria-hidden className="font-serif text-6xl leading-none text-terracotta/30">"</span>
              <blockquote className="mt-2 font-serif text-lg italic leading-relaxed text-charcoal">
                {it.q}
              </blockquote>
              <figcaption className="mt-8 border-t border-sand/40 pt-4">
                <p className="text-sm font-medium text-charcoal">{it.a}</p>
                <p className="text-xs uppercase tracking-[0.22em] text-ink/60">{it.l}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
