export function Informacoes() {
  const items = [
    { t: "Prazo", d: "Encomendas até quinta-feira, 07 de maio." },
    { t: "Entrega e retirada", d: "Sábado 10/05 e domingo 11/05." },
    { t: "Janela da manhã", d: "Entregas entre 06h e 10h, em janelas de 1 hora." },
    { t: "Retirada", d: "104 Sul · Noroeste, Brasília." },
  ];
  return (
    <section className="bg-charcoal py-24 text-linen md:py-32">
      <div className="container mx-auto px-4 sm:px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-[0.72rem] font-medium uppercase tracking-[0.28em] text-sand">
            Informações
          </span>
          <h2 className="text-balance mt-4 font-serif text-[1.85rem] sm:text-4xl font-light leading-[1.1] text-linen md:text-5xl">
            Tudo que você precisa <em className="italic text-sand">saber</em>.
          </h2>
          <div className="mx-auto mt-6 h-px w-16 bg-sand/60" />
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-px overflow-hidden border border-sand/20 md:grid-cols-2">
          {items.map((it) => (
            <div key={it.t} className="bg-charcoal p-8 md:p-10">
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.28em] text-sand">
                {it.t}
              </p>
              <p className="mt-3 font-serif text-xl font-light leading-relaxed text-linen">
                {it.d}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
