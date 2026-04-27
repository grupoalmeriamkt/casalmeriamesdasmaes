export function Experiencia() {
  return (
    <section id="experiencia" className="bg-linen py-16 sm:py-24 md:py-32">
      <div className="container mx-auto grid gap-16 px-6 md:grid-cols-12 md:gap-20 md:px-10">
        {/* Image left */}
        <div className="md:col-span-5">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2px] shadow-soft">
            <img
              src="https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=1200&q=85"
              alt="Detalhe de pães e flores sobre linho"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <p className="mt-4 text-center font-serif text-xs italic tracking-[0.18em] text-ink/60 uppercase">
            Pães acabados de sair do forno
          </p>
        </div>

        {/* Copy right */}
        <div className="flex flex-col justify-center md:col-span-7 md:pl-8">
          <span className="eyebrow mb-6">A experiência</span>
          <h2 className="text-balance font-serif text-[1.85rem] sm:text-4xl font-light leading-[1.1] text-charcoal md:text-5xl">
            Ela vai lembrar dessa manhã.
            <br />
            <em className="italic text-terracotta">Por muito tempo.</em>
          </h2>

          <div className="my-8 h-px w-20 bg-sand" />

          <p className="max-w-xl text-pretty text-[1.05rem] sm:text-lg leading-relaxed text-ink">
            Imagine ela abrindo a porta às 8h da manhã. Pão ainda quente, queijo curado em casa,
            geleia feita ontem, flores frescas e um bilhete escrito por você. É isso que entregamos
            — não uma cesta, uma cena.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-6 border-t border-sand/40 pt-8 md:grid-cols-3">
            <div>
              <p className="font-serif text-3xl italic text-terracotta sm:text-4xl">12+</p>
              <p className="mt-1 text-[0.7rem] uppercase tracking-[0.18em] text-ink/60 sm:text-xs sm:tracking-[0.2em]">itens artesanais</p>
            </div>
            <div>
              <p className="font-serif text-3xl italic text-terracotta sm:text-4xl">100%</p>
              <p className="mt-1 text-[0.7rem] uppercase tracking-[0.18em] text-ink/60 sm:text-xs sm:tracking-[0.2em]">feito à mão</p>
            </div>
            <div className="col-span-2 md:col-span-1">
              <p className="font-serif text-3xl italic text-terracotta sm:text-4xl">06h–10h</p>
              <p className="mt-1 text-[0.7rem] uppercase tracking-[0.18em] text-ink/60 sm:text-xs sm:tracking-[0.2em]">entrega na manhã</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
