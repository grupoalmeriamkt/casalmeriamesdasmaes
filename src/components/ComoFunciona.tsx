export function ComoFunciona() {
  const passos = [
    {
      n: "01",
      t: "Escolha",
      d: "Selecione a cesta que mais combina com ela. Cada uma é curada para um momento.",
    },
    {
      n: "02",
      t: "Personalize",
      d: "Conte para quem é, escreva um bilhete à mão e escolha entrega ou retirada.",
    },
    {
      n: "03",
      t: "Receba",
      d: "Entregamos quentinha entre 06h e 10h — você só precisa estar pronta para o sorriso dela.",
    },
  ];

  return (
    <section id="como-funciona" className="bg-parchment py-16 sm:py-24 md:py-32">
      <div className="container mx-auto px-4 sm:px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Como funciona</span>
          <h2 className="text-balance mt-4 font-serif text-[1.85rem] sm:text-4xl font-light leading-[1.1] text-charcoal md:text-5xl">
            Em <em className="italic text-terracotta">3 passos</em>, do carinho à porta dela.
          </h2>
          <div className="mx-auto mt-6 h-px w-16 bg-sand" />
        </div>

        <div className="mx-auto mt-14 sm:mt-16 grid max-w-5xl gap-10 sm:gap-12 md:grid-cols-3 md:gap-10">
          {passos.map((p) => (
            <div key={p.n} className="flex flex-col items-start text-left">
              <span className="font-serif text-5xl font-light italic text-terracotta">{p.n}</span>
              <div className="my-4 h-px w-10 bg-sand" />
              <h3 className="font-serif text-2xl font-normal text-charcoal">{p.t}</h3>
              <p className="mt-3 text-pretty text-[1rem] leading-relaxed text-ink/80">{p.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
