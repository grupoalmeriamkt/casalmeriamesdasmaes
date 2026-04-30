import { useState, useEffect } from "react";
import { usePedido, formatBRL, selectTotal } from "@/store/pedido";
import { upsertRascunho, finalizarPedido } from "@/lib/pedidos";
import { montarMensagemWhats, montarLinkWhats } from "@/lib/whatsappMsg";
import { fbqTrack, newEventId, sendCapiEvent } from "@/lib/metaPixel";
import {
  trackBeginCheckout,
  trackLeadStart,
  trackLeadComplete,
  trackPurchase,
} from "@/lib/gtm";
import {
  useAdmin,
  useProdutosDaCampanhaAtiva,
  useSobremesasAtivas,
  useUnidadesAtivas,
  useDatasAtivas,
  useHorariosAtivos,
  useCampanhaAtiva,
} from "@/store/admin";
import type { Cesta } from "@/lib/types";
import { distanciaKm, geocodificarEndereco } from "@/lib/geo";
import { Logo } from "@/components/Logo";
import { useIsPreview } from "@/components/admin/PreviewContext";
import { toast } from "sonner";
import {
  Loader2,
  Check,
  Truck,
  Store,
  MapPin,
  Clock,
  Plus,
  MessageCircle,
  CreditCard,
} from "lucide-react";

type Props = { onConcluir: () => void; onVoltar: () => void; initialStep?: number };

const TITULOS = [
  "ESCOLHA SUA CESTA",
  "SEUS DADOS",
  "ENTREGA",
  "DATA E HORÁRIO",
  "REVISÃO E ENVIO",
] as const;

const maskWhats = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{0,4})(\d{0,4})/, (_, a, b, c) =>
      [a && `(${a})`, b && ` ${b}`, c && `-${c}`].filter(Boolean).join(""),
    );
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
};

const maskCep = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

export function Quiz({ onConcluir, onVoltar, initialStep = 1 }: Props) {
  const isPreview = useIsPreview();
  const [step, setStep] = useState(initialStep);

  // Pedido store
  const cesta = usePedido((s) => s.cesta);
  const setCesta = usePedido((s) => s.setCesta);
  const setQuantidade = usePedido((s) => s.setQuantidade);
  const sobremesas = usePedido((s) => s.sobremesas);
  const toggleSobremesa = usePedido((s) => s.toggleSobremesa);
  const cliente = usePedido((s) => s.cliente);
  const setCliente = usePedido((s) => s.setCliente);
  const entregaTipo = usePedido((s) => s.entregaTipo);
  const setEntregaTipo = usePedido((s) => s.setEntregaTipo);
  const endereco = usePedido((s) => s.endereco);
  const setEndereco = usePedido((s) => s.setEndereco);
  const unidade = usePedido((s) => s.unidade);
  const setUnidade = usePedido((s) => s.setUnidade);
  const data = usePedido((s) => s.data);
  const setData = usePedido((s) => s.setData);
  const horario = usePedido((s) => s.horario);
  const setHorario = usePedido((s) => s.setHorario);
  const total = usePedido(selectTotal);

  // Admin store
  const cestasAtivas = useProdutosDaCampanhaAtiva();
  const sobremesasAtivas = useSobremesasAtivas();
  const unidades = useUnidadesAtivas();
  const datas = useDatasAtivas();
  const horarios = useHorariosAtivos();
  const entregaConfig = useAdmin((s) => s.entrega);
  const pagamento = useAdmin((s) => s.pagamento);
  const textosGlobais = useAdmin((s) => s.textos);
  const campanhaAtiva = useCampanhaAtiva();
  const textosCampanha = campanhaAtiva?.textos;
  // Mantém compat com `textos.badgePrazo` (texto global).
  const textos = textosGlobais;

  // Local form state
  const [nome, setNome] = useState(cliente.nome);
  const [whats, setWhats] = useState(cliente.whatsapp);
  const [cep, setCep] = useState(endereco?.cep ?? "");
  const [end, setEnd] = useState({
    rua: endereco?.rua ?? "",
    numero: endereco?.numero ?? "",
    complemento: endereco?.complemento ?? "",
    bairro: endereco?.bairro ?? "",
    cidade: endereco?.cidade ?? "",
    estado: endereco?.estado ?? "",
  });
  const [buscando, setBuscando] = useState(false);
  const [foraDeRaio, setForaDeRaio] = useState(false);
  const [detalhe, setDetalhe] = useState<Cesta | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (isPreview) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (step === 1) trackBeginCheckout({ value: total, currency: "BRL" });
    if (step === 2) trackLeadStart();
  }, [step, isPreview]);

  const buscarCep = async () => {
    if (isPreview) {
      setEnd({
        rua: "Rua Exemplo",
        numero: "123",
        complemento: "",
        bairro: "Centro",
        cidade: "Brasília",
        estado: "DF",
      });
      toast.success("Endereço de exemplo (prévia).");
      return;
    }
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) return toast.error("CEP inválido");
    setBuscando(true);
    setForaDeRaio(false);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const d = await r.json();
      if (d.erro) throw new Error();
      const novoEnd = {
        rua: d.logradouro || "",
        bairro: d.bairro || "",
        cidade: d.localidade || "",
        estado: d.uf || "",
      };
      setEnd((s) => ({ ...s, ...novoEnd }));

      // Validação por raio (se ativa no admin)
      const restr = entregaConfig.restricaoRaio;
      if (restr?.ativo) {
        const base = entregaConfig.unidades.find(
          (u) => u.id === restr.unidadeBaseId,
        );
        if (!base || base.lat == null || base.lng == null) {
          // Sem coordenadas configuradas: avisa mas não bloqueia.
          toast.warning(
            "Restrição de entrega ativa, mas a unidade base não tem coordenadas. Confirmaremos a viabilidade pelo WhatsApp.",
          );
        } else {
          const consulta = [
            novoEnd.rua,
            novoEnd.bairro,
            novoEnd.cidade,
            novoEnd.estado,
            limpo,
            "Brasil",
          ]
            .filter(Boolean)
            .join(", ");
          const coords = await geocodificarEndereco(consulta);
          if (!coords) {
            toast.warning(
              "Não conseguimos confirmar a distância automaticamente. Vamos validar pelo WhatsApp.",
            );
          } else {
            const dist = distanciaKm(
              { lat: base.lat, lng: base.lng },
              coords,
            );
            if (dist > restr.raioKm) {
              setForaDeRaio(true);
              toast.error(
                `Endereço a ${dist.toFixed(1)} km da loja — fora do raio de ${restr.raioKm} km. Tente a opção de retirada.`,
              );
              return;
            }
          }
        }
      }

      toast.success("Endereço encontrado!");
    } catch {
      toast.error("CEP não encontrado");
    } finally {
      setBuscando(false);
    }
  };

  const salvarRascunho = async (extras: Record<string, unknown> = {}) => {
    if (isPreview) return;
    const st = usePedido.getState();
    const nomeAtual = (extras.nome as string) ?? st.cliente.nome;
    const whatsAtual = (extras.whatsapp as string) ?? st.cliente.whatsapp;
    if (!nomeAtual || whatsAtual.replace(/\D/g, "").length < 10) return;
    const payload = {
      cliente: { nome: nomeAtual, whatsapp: whatsAtual },
      cesta: st.cesta
        ? {
            nome: st.cesta.cesta.nome,
            quantidade: st.cesta.quantidade,
            preco: st.cesta.cesta.preco,
          }
        : undefined,
      sobremesas: Object.values(st.sobremesas).map((s) => ({
        nome: s.sobremesa.nome,
        quantidade: s.quantidade,
        preco: s.sobremesa.preco,
      })),
      tipo: st.entregaTipo ?? "",
      enderecoOuUnidade:
        st.entregaTipo === "delivery" && st.endereco
          ? `${st.endereco.rua}, ${st.endereco.numero} — ${st.endereco.bairro}, ${st.endereco.cidade}-${st.endereco.estado}`
          : (st.unidade?.nome ?? ""),
      data: st.data,
      horario: st.horario,
      pagamento: { metodo: "", status: "rascunho" },
      total:
        (st.cesta ? st.cesta.cesta.preco * st.cesta.quantidade : 0) +
        Object.values(st.sobremesas).reduce(
          (a, s) => a + s.sobremesa.preco * s.quantidade,
          0,
        ),
      ...extras,
    } as Parameters<typeof upsertRascunho>[0];
    const { id, error } = await upsertRascunho(payload, st.pedidoId);
    if (!error && id && id !== st.pedidoId) {
      usePedido.getState().setPedidoId(id);
    }
  };

  const avancar = () => {
    if (step === 1) {
      if (!cesta) return toast.error("Escolha uma cesta para continuar.");
      return setStep(2);
    }
    if (step === 2) {
      if (nome.trim().length < 3) return toast.error("Informe seu nome completo.");
      if (whats.replace(/\D/g, "").length < 10) return toast.error("Informe um WhatsApp válido.");
      setCliente({ nome, whatsapp: whats });
      // grava rascunho com nome+whatsapp para a cozinha ver mesmo se não concluir
      salvarRascunho({ cliente: { nome, whatsapp: whats } });
      if (!isPreview) {
        trackLeadComplete();
        // Meta Ads: Lead (Pixel + CAPI deduplicado)
        const integ = useAdmin.getState().integracoes;
        if (integ.metaPixelId) {
          const eventId = newEventId("lead");
          const [firstName, ...rest] = nome.trim().split(/\s+/);
          fbqTrack("Lead", { content_name: "Quiz - Dados" }, eventId);
          void sendCapiEvent({
            pixelId: integ.metaPixelId,
            testEventCode: integ.metaTestEventCode,
            eventName: "Lead",
            eventId,
            userData: {
              phone: `55${whats.replace(/\D/g, "")}`,
              firstName,
              lastName: rest.join(" ") || undefined,
            },
            customData: { content_name: "Quiz - Dados" },
          });
        }
      }
      return setStep(3);
    }
    if (step === 3) {
      if (!entregaTipo) return toast.error("Escolha entrega ou retirada.");
      if (entregaTipo === "delivery") {
        if (!end.rua || !end.numero || !end.bairro)
          return toast.error("Preencha o endereço completo.");
        if (foraDeRaio)
          return toast.error(
            "Este endereço está fora da nossa área de entrega. Escolha retirada ou outro CEP.",
          );
        setEndereco({ cep, ...end });
      } else if (!unidade) return toast.error("Escolha uma unidade de retirada.");
      salvarRascunho();
      return setStep(4);
    }
    if (step === 4) {
      if (!data) return toast.error("Escolha um dia.");
      if (!horario) return toast.error("Escolha um horário.");
      salvarRascunho();
      return setStep(5);
    }
    if (step === 5) {
      onConcluir();
    }
  };

  const voltar = () => (step === 1 ? onVoltar() : setStep((s) => s - 1));

  const progresso = (step / 5) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-linen">
      {/* Header navy */}
      <header className="sticky top-0 z-30 bg-charcoal">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 md:px-8">
          <Logo variant="light" />
          <span className="badge-mae">🌸 Dia das Mães</span>
        </div>
        <div className="mx-auto w-full max-w-2xl px-4 pb-4 sm:px-6 md:px-8">
          <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-linen/55">
            Passo {step} de 5 — {TITULOS[step - 1]}
          </p>
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-linen/15">
            <div
              className="h-full rounded-full bg-terracotta transition-all duration-500"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
        {/* ============== STEP 1 — Escolha da cesta ============== */}
        {step === 1 && (
          <section className="animate-fade-up space-y-5">
            <div>
              <p className="eyebrow-gold mb-2">Presenteie com carinho</p>
              <h1 className="font-serif text-3xl font-semibold leading-tight text-charcoal sm:text-[2rem]">
                Qual <em className="italic text-terracotta">cesta</em> você escolhe?
              </h1>
              <p className="mt-2 text-sm text-ink/65">
                Feitas artesanalmente para o Dia das Mães
              </p>
            </div>

            {textos.badgePrazo && (
              <div className="tag-prazo">📦 {textos.badgePrazo}</div>
            )}

            {textosCampanha?.boasVindas && (
              <p className="rounded-xl bg-charcoal/5 p-3 text-sm text-charcoal">
                {textosCampanha.boasVindas}
              </p>
            )}

            {cestasAtivas.length === 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                Esta campanha ainda não tem produtos configurados. Volte em breve
                ou entre em contato com a loja.
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {cestasAtivas.map((c) => {
                const sel = cesta?.cesta.id === c.id;
                return (
                  <article
                    key={c.id}
                    onClick={() => setCesta(c)}
                    className={`group relative cursor-pointer overflow-hidden rounded-2xl bg-white transition-all hover:-translate-y-0.5 hover:shadow-soft ${
                      sel ? "ring-2 ring-terracotta" : "ring-1 ring-sand/60"
                    }`}
                  >
                    {sel && (
                      <span className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-terracotta text-white shadow-warm">
                        <Check className="h-4 w-4" strokeWidth={3} />
                      </span>
                    )}
                    <div className="aspect-[16/10] w-full overflow-hidden bg-parchment">
                      <img
                        src={c.imagem}
                        alt={c.nome}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-4 sm:p-5">
                      <span className="inline-block rounded-full bg-olive px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-white">
                        {c.badge}
                      </span>
                      <h3 className="mt-2 font-serif text-lg font-bold text-charcoal sm:text-xl">
                        {c.nome}
                      </h3>
                      <p className="mt-0.5 font-serif text-xl font-semibold text-terracotta">
                        {formatBRL(c.preco)}
                      </p>
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink/60">
                        {c.itens.slice(0, 5).join(" · ")}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetalhe(c);
                        }}
                        className="mt-3 inline-block rounded-full border border-charcoal px-3.5 py-1 text-xs font-medium text-charcoal transition-colors hover:bg-charcoal hover:text-white"
                      >
                        Ver itens completos
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {cesta && (
              <div className="rounded-xl bg-charcoal/5 p-3.5 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-charcoal/70">
                    Quantidade
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantidade(cesta.quantidade - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-charcoal/40 text-charcoal hover:bg-charcoal hover:text-linen"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-serif text-lg">
                      {cesta.quantidade}
                    </span>
                    <button
                      onClick={() => setQuantidade(cesta.quantidade + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-charcoal/40 text-charcoal hover:bg-charcoal hover:text-linen"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}

            <BotoesNav onAvancar={avancar} onVoltar={voltar} disabled={!cesta} />
          </section>
        )}

        {/* ============== STEP 2 — Dados ============== */}
        {step === 2 && (
          <section className="animate-fade-up space-y-5">
            <div>
              <p className="eyebrow-gold mb-2">Identificação</p>
              <h1 className="font-serif text-3xl font-semibold leading-tight text-charcoal sm:text-[2rem]">
                Quem está <em className="italic text-terracotta">pedindo?</em>
              </h1>
              <p className="mt-2 text-sm text-ink/65">
                Para confirmarmos seu pedido pelo WhatsApp
              </p>
            </div>

            {cesta && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-charcoal/5 px-3.5 py-3">
                <span className="truncate text-sm font-medium text-charcoal">
                  {cesta.cesta.nome}
                </span>
                <span className="whitespace-nowrap font-serif text-base font-bold text-terracotta">
                  {formatBRL(cesta.cesta.preco * cesta.quantidade)}
                </span>
              </div>
            )}

            <CampoInput
              label="Nome completo"
              value={nome}
              onChange={setNome}
              placeholder="Seu nome"
            />
            <CampoInput
              label="WhatsApp"
              value={whats}
              onChange={(v) => setWhats(maskWhats(v))}
              placeholder="(61) 99999-9999"
              inputMode="numeric"
            />

            <BotoesNav onAvancar={avancar} onVoltar={voltar} />
          </section>
        )}

        {/* ============== STEP 3 — Entrega ============== */}
        {step === 3 && (
          <section className="animate-fade-up space-y-5">
            <div>
              <p className="eyebrow-gold mb-2">Logística</p>
              <h1 className="font-serif text-3xl font-semibold leading-tight text-charcoal sm:text-[2rem]">
                Como prefere <em className="italic text-terracotta">receber?</em>
              </h1>
              <p className="mt-2 text-sm text-ink/65">
                Entregas e retiradas conforme disponibilidade
              </p>
            </div>

            {entregaConfig.delivery && (
              <button
                type="button"
                onClick={() => setEntregaTipo("delivery")}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-white p-4 text-left transition-all ${
                  entregaTipo === "delivery"
                    ? "border-charcoal bg-charcoal/[0.03]"
                    : "border-sand/70 hover:border-charcoal/50"
                }`}
              >
                <div
                  className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl transition-colors ${
                    entregaTipo === "delivery"
                      ? "bg-charcoal text-white"
                      : "bg-linen text-charcoal"
                  }`}
                >
                  <Truck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-charcoal">Delivery</p>
                  <p className="truncate text-xs text-ink/60">
                    Entregamos no seu endereço em Brasília
                  </p>
                </div>
              </button>
            )}

            {entregaTipo === "delivery" && (
              <div className="animate-fade-up space-y-4 rounded-2xl bg-white p-4 ring-1 ring-sand/60 sm:p-5">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <CampoInput
                      label="CEP"
                      value={cep}
                      onChange={(v) => {
                        setCep(maskCep(v));
                        if (foraDeRaio) setForaDeRaio(false);
                      }}
                      placeholder="00000-000"
                      inputMode="numeric"
                    />
                  </div>
                  <button
                    onClick={buscarCep}
                    disabled={buscando}
                    className="flex h-[46px] items-center justify-center rounded-xl bg-charcoal px-4 text-sm font-medium text-white hover:bg-charcoal/90 disabled:opacity-60"
                  >
                    {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                  </button>
                </div>
                {foraDeRaio && (
                  <p className="rounded-lg bg-terracotta/10 px-3 py-2 text-xs text-terracotta">
                    Este endereço está fora da nossa área de entrega. Tente um
                    CEP mais próximo ou escolha a opção de retirada.
                  </p>
                )}
                <CampoInput
                  label="Rua"
                  value={end.rua}
                  onChange={(v) => setEnd((s) => ({ ...s, rua: v }))}
                  placeholder="Logradouro"
                />
                <div className="grid grid-cols-2 gap-3">
                  <CampoInput
                    label="Número"
                    value={end.numero}
                    onChange={(v) => setEnd((s) => ({ ...s, numero: v }))}
                    placeholder="Nº"
                  />
                  <CampoInput
                    label="Complemento"
                    value={end.complemento}
                    onChange={(v) => setEnd((s) => ({ ...s, complemento: v }))}
                    placeholder="Apto..."
                  />
                </div>
                <CampoInput
                  label="Bairro"
                  value={end.bairro}
                  onChange={(v) => setEnd((s) => ({ ...s, bairro: v }))}
                  placeholder="Bairro"
                />
                <div className="grid grid-cols-[1fr_80px] gap-3">
                  <CampoInput
                    label="Cidade"
                    value={end.cidade}
                    onChange={(v) => setEnd((s) => ({ ...s, cidade: v }))}
                    placeholder="Cidade"
                  />
                  <CampoInput
                    label="UF"
                    value={end.estado}
                    onChange={(v) => setEnd((s) => ({ ...s, estado: v.toUpperCase().slice(0, 2) }))}
                    placeholder="DF"
                  />
                </div>
              </div>
            )}

            {entregaConfig.retirada && (
              <button
                type="button"
                onClick={() => setEntregaTipo("retirada")}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-white p-4 text-left transition-all ${
                  entregaTipo === "retirada"
                    ? "border-charcoal bg-charcoal/[0.03]"
                    : "border-sand/70 hover:border-charcoal/50"
                }`}
              >
                <div
                  className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl transition-colors ${
                    entregaTipo === "retirada"
                      ? "bg-charcoal text-white"
                      : "bg-linen text-charcoal"
                  }`}
                >
                  <Store className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-charcoal">Retirada na loja</p>
                  <p className="truncate text-xs text-ink/60">
                    Escolha a unidade mais próxima
                  </p>
                </div>
              </button>
            )}

            {entregaTipo === "retirada" && (
              <div className="animate-fade-up space-y-3">
                {horarios.length > 0 && (
                  <div className="rounded-2xl border border-sand/70 bg-linen/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/70">
                      Janela de horário para retirada
                    </p>
                    <p className="mt-1 text-sm text-ink/80">
                      {horarios.map((h) => h.label).join(" · ")}
                    </p>
                  </div>
                )}
                {unidades.map((u) => {
                  const sel = unidade?.id === u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => setUnidade(u)}
                      className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-white p-4 text-left transition-all ${
                        sel
                          ? "border-charcoal bg-charcoal/[0.03]"
                          : "border-sand/70 hover:border-charcoal/50"
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl transition-colors ${
                          sel ? "bg-charcoal text-white" : "bg-linen text-charcoal"
                        }`}
                      >
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-charcoal">{u.nome}</p>
                        <p className="truncate text-xs text-ink/60">{u.endereco}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <BotoesNav onAvancar={avancar} onVoltar={voltar} />
          </section>
        )}

        {/* ============== STEP 4 — Data e Horário + Upsell ============== */}
        {step === 4 && (
          <section className="animate-fade-up space-y-6">
            <div>
              <p className="eyebrow-gold mb-2">Agendamento</p>
              <h1 className="font-serif text-3xl font-semibold leading-tight text-charcoal sm:text-[2rem]">
                Quando deseja <em className="italic text-terracotta">receber?</em>
              </h1>
              <p className="mt-2 text-sm text-ink/65">
                Escolha o melhor dia e horário para você
              </p>
            </div>

            <div>
              <p className="mb-3 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-charcoal/70">
                Dia da entrega
              </p>
              <div className="grid grid-cols-2 gap-3">
                {datas.map((d) => {
                  const sel = data === d.label;
                  // tenta extrair "10/05" e "Sábado"
                  const partes = d.label.split(",").map((s) => s.trim());
                  const semana = partes[0] || d.label;
                  const numero = partes[1]?.split("/")?.[0] || "•";
                  return (
                    <button
                      key={d.id}
                      onClick={() => {
                        setData(d.label);
                        setHorario("");
                      }}
                      className={`rounded-2xl border-2 p-4 text-center transition-all ${
                        sel
                          ? "border-charcoal bg-charcoal text-linen"
                          : "border-sand/70 bg-white text-charcoal hover:border-charcoal/50"
                      }`}
                    >
                      <div
                        className={`font-serif text-3xl font-bold leading-none ${
                          sel ? "text-terracotta" : "text-charcoal"
                        }`}
                      >
                        {numero}
                      </div>
                      <div className={`mt-1 text-sm font-medium ${sel ? "text-white" : "text-ink"}`}>
                        {semana}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {data && (
              <div className="animate-fade-up">
                <p className="mb-3 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-charcoal/70">
                  Janela de horário
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {horarios.map((h) => {
                    const sel = horario === h.label;
                    return (
                      <button
                        key={h.label}
                        onClick={() => setHorario(h.label)}
                        className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-2 py-3 text-xs font-medium transition-all sm:text-sm ${
                          sel
                            ? "border-terracotta bg-terracotta text-white"
                            : "border-sand/70 bg-white text-charcoal hover:border-charcoal/40"
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        <span className="truncate">{h.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {horario && sobremesasAtivas.length > 0 && (
              <div className="animate-fade-up space-y-3 border-t border-sand/60 pt-5">
                <div>
                  <h3 className="font-serif text-lg font-semibold text-charcoal">
                    Quer adicionar uma sobremesa? 🍓
                  </h3>
                  <p className="text-xs text-ink/60">Entregue junto com sua cesta</p>
                </div>
                {sobremesasAtivas.map((s) => {
                  const added = !!sobremesas[s.id];
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSobremesa(s)}
                      className={`flex w-full items-center gap-3 rounded-xl border-2 bg-white p-3 text-left transition-all ${
                        added ? "border-olive bg-olive/[0.04]" : "border-sand/70 hover:border-terracotta/60"
                      }`}
                    >
                      <img
                        src={s.imagem}
                        alt=""
                        className="h-12 w-12 flex-none rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-charcoal">{s.nome}</p>
                        <p className="text-xs text-ink/60">{formatBRL(s.preco)}</p>
                      </div>
                      <span
                        className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-white transition-colors ${
                          added ? "bg-olive" : "bg-charcoal"
                        }`}
                      >
                        {added ? <Check className="h-4 w-4" strokeWidth={3} /> : <Plus className="h-4 w-4" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <BotoesNav onAvancar={avancar} onVoltar={voltar} avancarLabel="Ver resumo do pedido →" />
          </section>
        )}

        {/* ============== STEP 5 — Resumo + Pagamento ============== */}
        {step === 5 && (
          <section className="animate-fade-up space-y-5">
            <div>
              <p className="eyebrow-gold mb-2">Quase lá!</p>
              <h1 className="font-serif text-3xl font-semibold leading-tight text-charcoal sm:text-[2rem]">
                Seu <em className="italic text-terracotta">pedido</em>
              </h1>
              <p className="mt-2 text-sm text-ink/65">Revise e escolha como pagar</p>
            </div>

            <div className="rounded-2xl bg-white p-4 ring-1 ring-sand/60 sm:p-5">
              <ResumoLinha label="Produto" valor={cesta ? `${cesta.cesta.nome} (${cesta.quantidade}x)` : "—"} />
              {Object.values(sobremesas).length > 0 && (
                <ResumoLinha
                  label="Sobremesas"
                  valor={Object.values(sobremesas).map((s) => s.sobremesa.nome).join(", ")}
                />
              )}
              <ResumoLinha
                label="Entrega"
                valor={entregaTipo === "delivery" ? "Delivery" : `Retirada — ${unidade?.nome ?? ""}`}
              />
              <ResumoLinha
                label={entregaTipo === "delivery" ? "Endereço" : "Unidade"}
                valor={
                  entregaTipo === "delivery" && endereco
                    ? `${endereco.rua}, ${endereco.numero}${endereco.complemento ? ", " + endereco.complemento : ""} — ${endereco.bairro}, ${endereco.cidade}-${endereco.estado}`
                    : unidade?.endereco ?? "—"
                }
              />
              <ResumoLinha label="Data e horário" valor={`${data ?? ""} · ${horario ?? ""}`} />
              <ResumoLinha label="Cliente" valor={`${cliente.nome} · ${cliente.whatsapp}`} />
              <div className="mt-3 flex items-center justify-between border-t border-sand/60 pt-4">
                <span className="text-sm font-medium text-charcoal">Total</span>
                <span className="font-serif text-2xl font-bold text-terracotta">
                  {formatBRL(total)}
                </span>
              </div>
            </div>

            {pagamento.checkoutAtivo ? (
              <div className="rounded-2xl bg-charcoal/5 p-4 text-sm text-charcoal ring-1 ring-charcoal/15">
                <p className="font-medium">💳 Pagamento online via Mercado Pago</p>
                <p className="mt-1 text-xs text-ink/70">
                  Ao confirmar, você será redirecionado ao Checkout seguro do
                  Mercado Pago para pagar com PIX, cartão ou boleto.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-olive/10 p-4 text-sm text-charcoal ring-1 ring-olive/30">
                <p className="font-medium">📲 Envio do pedido pelo WhatsApp</p>
                <p className="mt-1 text-xs text-ink/70">
                  Ao confirmar, abriremos o WhatsApp com a mensagem do seu pedido pronta
                  para enviar à nossa equipe. O pagamento será combinado diretamente na
                  conversa.
                </p>
              </div>
            )}

            <button
              disabled={enviando}
              onClick={async () => {
                if (isPreview) {
                  toast.info("Prévia: pedido não é enviado.");
                  onConcluir();
                  return;
                }
                setEnviando(true);
                const st = usePedido.getState();
                const usandoMp = pagamento.checkoutAtivo;
                const payload = {
                  cliente: st.cliente,
                  cesta: st.cesta
                    ? {
                        nome: st.cesta.cesta.nome,
                        quantidade: st.cesta.quantidade,
                        preco: st.cesta.cesta.preco,
                      }
                    : undefined,
                  sobremesas: Object.values(st.sobremesas).map((s) => ({
                    nome: s.sobremesa.nome,
                    quantidade: s.quantidade,
                    preco: s.sobremesa.preco,
                  })),
                  tipo: st.entregaTipo ?? "",
                  enderecoOuUnidade:
                    st.entregaTipo === "delivery" && st.endereco
                      ? `${st.endereco.rua}, ${st.endereco.numero} — ${st.endereco.bairro}, ${st.endereco.cidade}-${st.endereco.estado}`
                      : (st.unidade?.nome ?? ""),
                  data: st.data,
                  horario: st.horario,
                  pagamento: {
                    metodo: usandoMp ? "mercadopago" : "whatsapp",
                    status: "pendente",
                  },
                  total,
                };
                const { id } = await finalizarPedido(payload, st.pedidoId);
                if (id) usePedido.getState().setPedidoId(id);

                trackPurchase({
                  transaction_id: id || `local-${Date.now()}`,
                  value: total,
                  currency: "BRL",
                  payment_type: usandoMp ? "mercadopago" : "whatsapp",
                  items: [
                    ...(cesta
                      ? [{
                          item_name: cesta.cesta.nome,
                          quantity: cesta.quantidade,
                          price: cesta.cesta.preco,
                        }]
                      : []),
                    ...Object.values(sobremesas).map((s) => ({
                      item_name: s.sobremesa.nome,
                      quantity: s.quantidade,
                      price: s.sobremesa.preco,
                    })),
                  ],
                });

                if (usandoMp) {
                  const items = [
                    ...(cesta
                      ? [{
                          title: cesta.cesta.nome,
                          quantity: cesta.quantidade,
                          unit_price: cesta.cesta.preco,
                        }]
                      : []),
                    ...Object.values(sobremesas).map((s) => ({
                      title: s.sobremesa.nome,
                      quantity: s.quantidade,
                      unit_price: s.sobremesa.preco,
                    })),
                  ];
                  try {
                    // Token NUNCA é enviado pelo cliente — servidor lê do banco.
                    const res = await fetch("/api/public/mp-preference", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        items,
                        payer: {
                          name: cliente.nome,
                          phone: cliente.whatsapp,
                        },
                        externalReference: id || st.pedidoId,
                        installments: pagamento.parcelasMax,
                      }),
                    });
                    const body = await res.json();
                    if (res.status === 503) {
                      toast.error(
                        "Mercado Pago não configurado. Avise o administrador.",
                      );
                      setEnviando(false);
                      return;
                    }
                    if (!res.ok || !body.init_point) {
                      console.error("[mp] erro", body);
                      toast.error("Não foi possível iniciar o pagamento.");
                      setEnviando(false);
                      return;
                    }
                    window.location.href = body.init_point;
                    return;
                  } catch (err) {
                    console.error("[mp] fetch falhou", err);
                    toast.error("Falha ao conectar ao Mercado Pago.");
                    setEnviando(false);
                    return;
                  }
                }

                const mensagem = montarMensagemWhats({
                  cliente,
                  cesta,
                  sobremesas,
                  entregaTipo,
                  endereco,
                  unidade,
                  data,
                  horario,
                  total,
                  pedidoId: id || st.pedidoId,
                });
                const link = montarLinkWhats(textos.whatsapp, mensagem);
                window.open(link, "_blank", "noopener");
                setEnviando(false);
                onConcluir();
              }}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60 ${
                pagamento.checkoutAtivo
                  ? "bg-charcoal"
                  : "bg-[#25D366]"
              }`}
            >
              {pagamento.checkoutAtivo ? (
                <CreditCard className="h-5 w-5" />
              ) : (
                <MessageCircle className="h-5 w-5" />
              )}
              {enviando
                ? "Processando..."
                : pagamento.checkoutAtivo
                  ? "Pagar com Mercado Pago"
                  : "Enviar pedido pelo WhatsApp"}
            </button>

            <button
              onClick={voltar}
              className="mx-auto block text-xs text-ink/60 hover:text-charcoal"
            >
              ← Voltar
            </button>
          </section>
        )}
      </main>

      {/* Modal de detalhes da cesta */}
      {detalhe && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/70 backdrop-blur-sm sm:items-center"
          onClick={() => setDetalhe(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-linen sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex justify-end bg-linen px-4 pt-4">
              <button
                onClick={() => setDetalhe(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-charcoal/10 text-charcoal hover:bg-charcoal/20"
              >
                ✕
              </button>
            </div>
            <div className="px-5 pb-6">
              <span className="inline-block rounded-full bg-olive px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-white">
                {detalhe.badge}
              </span>
              <h3 className="mt-2 font-serif text-2xl font-bold text-charcoal">{detalhe.nome}</h3>
              <p className="mt-1 font-serif text-2xl font-semibold text-terracotta">
                {formatBRL(detalhe.preco)}
              </p>
              <ul className="mt-4 space-y-2">
                {detalhe.itens.map((i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 border-b border-charcoal/5 pb-2 text-sm text-ink"
                  >
                    <span className="mt-1.5 block h-1.5 w-1.5 flex-none rounded-full bg-terracotta" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  setCesta(detalhe);
                  setDetalhe(null);
                }}
                className="mt-5 w-full rounded-xl bg-charcoal py-4 text-sm font-medium text-white hover:bg-charcoal/90"
              >
                Adicionar ao pedido →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Subcomponentes ---------- */

function CampoInput({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[0.7rem] font-medium uppercase tracking-[0.16em] text-charcoal">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full rounded-xl border-[1.5px] border-sand/80 bg-white px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-charcoal"
      />
    </div>
  );
}

function ResumoLinha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-charcoal/5 py-2 last:border-b-0">
      <span className="text-xs text-ink/60">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium text-ink">{valor}</span>
    </div>
  );
}

function BotoesNav({
  onAvancar,
  onVoltar,
  disabled,
  avancarLabel = "Continuar →",
}: {
  onAvancar: () => void;
  onVoltar: () => void;
  disabled?: boolean;
  avancarLabel?: string;
}) {
  return (
    <div className="space-y-2 pt-2">
      <button
        onClick={onAvancar}
        disabled={disabled}
        className="w-full rounded-xl bg-charcoal py-4 text-sm font-medium tracking-wide text-white transition-colors hover:bg-charcoal/90 disabled:cursor-not-allowed disabled:bg-charcoal/40"
      >
        {avancarLabel}
      </button>
      <button
        onClick={onVoltar}
        className="mx-auto block text-xs text-ink/60 hover:text-charcoal"
      >
        ← Voltar
      </button>
    </div>
  );
}
