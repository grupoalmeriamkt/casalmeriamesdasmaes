import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePedido, formatBRL, selectTotal, selectPrecoEfetivo } from "@/store/pedido";
import { upsertRascunho, finalizarPedido } from "@/lib/pedidos";
import { montarMensagemWhats, montarLinkWhats } from "@/lib/whatsappMsg";
import { fbqTrack, newEventId, sendCapiEvent } from "@/lib/metaPixel";
import { trackBeginCheckout, trackLeadStart, trackLeadComplete, trackPurchase } from "@/lib/gtm";
import {
  useAdmin,
  useProdutosDaCampanhaAtiva,
  useSobremesasAtivas,
  useUnidadesAtivas,
  useDatasAtivas,
  useHorariosAtivos,
  useTodosDias,
  useCampanhaAtiva,
  calcTaxaEntrega,
} from "@/store/admin";
import type { Cesta } from "@/lib/types";
import { distanciaKm, geocodificarEndereco, geocodificarCep, geocodificarViaBrasilAPI, encontrarZonaComTolerancia } from "@/lib/geo";
import { parseDateId, toISODateString, formatDatePtBR, parseDatePtBRToDate } from "@/lib/dateUtils";
import { Calendar } from "@/components/ui/calendar";
import type { ZonaEntrega } from "@/store/admin";
import { Logo } from "@/components/Logo";
import { useIsPreview } from "@/components/admin/PreviewContext";
import { Textarea } from "@/components/ui/textarea";
import { CheckoutAsaas } from "@/components/CheckoutAsaas";
import { uploadPolaroid } from "@/lib/uploadPolaroid";
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
  Mail,
  Camera,
  Upload,
} from "lucide-react";

type Props = {
  onConcluir: () => void;
  onVoltar: () => void;
  initialStep?: number;
  initialPersonalizacao?: boolean;
};

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

export function Quiz({
  onConcluir,
  onVoltar,
  initialStep = 1,
  initialPersonalizacao = false,
}: Props) {
  const isPreview = useIsPreview();
  const [step, setStep] = useState(initialStep);
  const [mostrarPersonalizacao, setMostrarPersonalizacao] = useState(initialPersonalizacao);

  // Pedido store
  const cesta = usePedido((s) => s.cesta);
  const setCesta = usePedido((s) => s.setCesta);
  const tamanhoId = usePedido((s) => s.tamanhoId);
  const setTamanho = usePedido((s) => s.setTamanho);
  const setQuantidade = usePedido((s) => s.setQuantidade);
  const sobremesas = usePedido((s) => s.sobremesas);
  const toggleSobremesa = usePedido((s) => s.toggleSobremesa);
  const cliente = usePedido((s) => s.cliente);
  const setCliente = usePedido((s) => s.setCliente);
  const email = usePedido((s) => s.email);
  const setEmail = usePedido((s) => s.setEmail);
  const destinatario = usePedido((s) => s.destinatario);
  const setDestinatario = usePedido((s) => s.setDestinatario);
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
  const extras = usePedido((s) => s.extras);
  const setCartao = usePedido((s) => s.setCartao);
  const removeCartao = usePedido((s) => s.removeCartao);
  const setPolaroid = usePedido((s) => s.setPolaroid);
  const removePolaroid = usePedido((s) => s.removePolaroid);
  const subtotal = usePedido(selectTotal);
  const precoEfetivo = usePedido(selectPrecoEfetivo);

  // Admin store
  const cestasAtivas = useProdutosDaCampanhaAtiva();
  const cestasAdmin = useAdmin((s) => s.cestas);
  const sobremesasAtivas = useSobremesasAtivas();
  const unidades = useUnidadesAtivas();
  const datas = useDatasAtivas(entregaTipo);
  const horarios = useHorariosAtivos(entregaTipo);
  const todosDias = useTodosDias(entregaTipo);

  // Filtro de datas e horários passados
  const agoraISO = toISODateString(new Date());
  const horaAtual = new Date().getHours();
  const datasDisponiveis = datas.filter(
    (d) => !/^\d{4}-\d{2}-\d{2}$/.test(d.id) || d.id >= agoraISO,
  );
  // Em modo todosDias o calendário livre não popula datasDisponiveis,
  // então comparamos o label selecionado com o label de hoje para saber se é hoje.
  const hoje = new Date();
  const hojeLabel = formatDatePtBR(
    new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12),
  );
  const dataSelecionadaId =
    datasDisponiveis.find((d) => d.label === data)?.id ??
    (data === hojeLabel ? agoraISO : undefined);
  const horariosDisponiveis =
    dataSelecionadaId === agoraISO
      ? horarios.filter((h) => {
          const m = h.label.match(/Entre (\d{1,2})h e (\d{1,2})h/);
          return m ? parseInt(m[2], 10) > horaAtual : true;
        })
      : horarios;
  const entregaConfig = useAdmin((s) => s.entrega);
  const pagamento = useAdmin((s) => s.pagamento);
  const textosGlobais = useAdmin((s) => s.textos);
  const campanhaAtiva = useCampanhaAtiva();

  const [zonaEntregaAtual, setZonaEntregaAtual] = useState<ZonaEntrega | null>(null);

  const taxaEntrega = entregaTipo === "delivery"
    ? (() => {
        const zonasConfig = campanhaAtiva?.delivery?.zonas;
        if (zonasConfig?.ativo && zonaEntregaAtual) {
          return calcTaxaEntrega(zonaEntregaAtual.taxa);
        }
        return calcTaxaEntrega(campanhaAtiva?.delivery?.taxa);
      })()
    : 0;
  const total = subtotal + taxaEntrega;
  const textosCampanha = campanhaAtiva?.textos;
  const titulosPasso = [
    textosCampanha?.passo1Label || TITULOS[0],
    textosCampanha?.passo2Label || TITULOS[1],
    textosCampanha?.passo3Label || TITULOS[2],
    textosCampanha?.passo4Label || TITULOS[3],
    textosCampanha?.passo5Label || TITULOS[4],
  ];
  // Mantém compat com `textos.badgePrazo` (texto global).
  const textos = textosGlobais;

  // Local form state
  const [nome, setNome] = useState(cliente.nome);
  const [whats, setWhats] = useState(cliente.whatsapp);
  const [emailInput, setEmailInput] = useState(email);
  const [outraPessoa, setOutraPessoa] = useState(!!destinatario);
  const [destNome, setDestNome] = useState(destinatario?.nome ?? "");
  const [destWhats, setDestWhats] = useState(destinatario?.whatsapp ?? "");
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

  useEffect(() => {
    if (entregaTipo !== "delivery") setZonaEntregaAtual(null);
  }, [entregaTipo]);

  useEffect(() => {
    if (entregaTipo === "delivery" && !entregaConfig.delivery) {
      usePedido.setState({ entregaTipo: entregaConfig.retirada ? "retirada" : null });
    }
    if (entregaTipo === "retirada" && !entregaConfig.retirada) {
      usePedido.setState({ entregaTipo: entregaConfig.delivery ? "delivery" : null });
    }
  }, [entregaConfig.delivery, entregaConfig.retirada]);
  const [detalhe, setDetalhe] = useState<Cesta | null>(null);
  const [modalTamanhoId, setModalTamanhoId] = useState<string | undefined>(undefined);
  const [modalQuantidade, setModalQuantidade] = useState(1);
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

      const zonasConfig = campanhaAtiva?.delivery?.zonas;
      const usandoZonas = zonasConfig?.ativo && zonasConfig.zonas.length > 0;

      if (usandoZonas) {
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
        // Sequência: BrasilAPI (melhor p/ DF) → Nominatim CEP → Nominatim endereço
        let coords = await geocodificarViaBrasilAPI(limpo);
        if (!coords) coords = await geocodificarCep(limpo);
        if (!coords) coords = await geocodificarEndereco(consulta);

        if (!coords) {
          // Geocodificação falhou em todas as fontes — aceita com aviso (não rejeita o cliente)
          console.warn(`[delivery] CEP ${limpo} — geocodificação falhou em todas as fontes.`);
          const zonaFallback = zonasConfig!.zonas[0];
          setZonaEntregaAtual(zonaFallback);
          toast.success(
            `Endereço aceito — ${zonaFallback.nome}. Confirmaremos a disponibilidade pelo WhatsApp.`,
          );
          return;
        }
        const zona = encontrarZonaComTolerancia(coords, zonasConfig!.zonas);
        if (!zona) {
          setForaDeRaio(true);
          console.warn(
            `[delivery] CEP ${limpo} → lat=${coords.lat.toFixed(5)}, lng=${coords.lng.toFixed(5)} — fora de todas as zonas.`,
          );
          toast.error(
            "Este endereço está fora da nossa área de entrega. Tente outro CEP ou escolha a opção de retirada.",
          );
          return;
        }
        setZonaEntregaAtual(zona);
        toast.success(`Endereço confirmado — ${zona.nome}.`);
        return;
      } else {
        // Validação por raio (se ativa no admin)
        const restr = entregaConfig.restricaoRaio;
        if (restr?.ativo) {
          const base = entregaConfig.unidades.find((u) => u.id === restr.unidadeBaseId);
          if (!base || base.lat == null || base.lng == null) {
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
              const dist = distanciaKm({ lat: base.lat, lng: base.lng }, coords);
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
      destinatario: st.destinatario ?? null,
      cesta: st.cesta
        ? {
            nome: st.cesta.cesta.nome,
            quantidade: st.cesta.quantidade,
            preco: selectPrecoEfetivo(st),
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
        (st.cesta ? selectPrecoEfetivo(st) * st.cesta.quantidade : 0) +
        Object.values(st.sobremesas).reduce((a, s) => a + s.sobremesa.preco * s.quantidade, 0) +
        st.extras.cartoes.reduce((a, c) => a + c.preco, 0) +
        st.extras.polaroids.reduce((a, p) => a + p.preco, 0) +
        taxaEntrega,
      ...extras,
    } as Parameters<typeof upsertRascunho>[0];
    const { id, error } = await upsertRascunho(payload, st.pedidoId, campanhaAtiva?.id);
    if (!error && id && id !== st.pedidoId) {
      usePedido.getState().setPedidoId(id);
    }
  };

  const avancar = () => {
    if (step === 1) {
      // Mobile: fixed footer button acts as "Adicionar ao pedido" when modal is open
      if (detalhe) {
        if (detalhe.tamanhos && detalhe.tamanhos.length > 0 && !modalTamanhoId) {
          toast.error("Escolha um tamanho para continuar.");
          return;
        }
        setCesta(detalhe);
        if (modalTamanhoId) setTamanho(modalTamanhoId);
        setQuantidade(modalQuantidade);
        setDetalhe(null);
        setStep(2);
        return;
      }
      if (!cesta) return toast.error("Escolha uma cesta para continuar.");
      if (cesta.cesta.tamanhos && cesta.cesta.tamanhos.length > 0 && !tamanhoId) {
        return toast.error("Escolha um tamanho para continuar.");
      }
      return setStep(2);
    }
    if (step === 2) {
      if (nome.trim().length < 3) return toast.error("Informe seu nome completo.");
      if (whats.replace(/\D/g, "").length < 10) return toast.error("Informe um WhatsApp válido.");
      if (outraPessoa) {
        if (destNome.trim().length < 3) return toast.error("Informe o nome de quem vai receber.");
        if (destWhats.replace(/\D/g, "").length < 10) return toast.error("Informe o WhatsApp de quem vai receber.");
        setDestinatario({ nome: destNome.trim(), whatsapp: destWhats });
      } else {
        setDestinatario({ nome: nome.trim(), whatsapp: whats });
      }
      setCliente({ nome, whatsapp: whats });
      setEmail(emailInput.trim());
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
              email: emailInput.trim() || undefined,
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
        const zonasAtivas = !!(
          campanhaAtiva?.delivery?.zonas?.ativo &&
          (campanhaAtiva?.delivery?.zonas?.zonas?.length ?? 0) > 0
        );
        if (zonasAtivas && !zonaEntregaAtual)
          return toast.error(
            "Clique em 'Buscar' para validar seu CEP antes de continuar.",
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
      const precisaPersonalizar = extras.cartoes.length > 0 || extras.polaroids.length > 0;
      if (precisaPersonalizar && !mostrarPersonalizacao) {
        setMostrarPersonalizacao(true);
        return;
      }
      // Validações do passo de personalização
      if (mostrarPersonalizacao) {
        for (const c of extras.cartoes) {
          if (c.mensagem.trim().length < 3) {
            return toast.error(`Escreva a mensagem do "${c.nome}".`);
          }
        }
        for (const p of extras.polaroids) {
          if (!p.arquivoUrl) {
            return toast.error(`Envie a foto do "${p.nome}".`);
          }
        }
        setMostrarPersonalizacao(false);
      }
      return setStep(5);
    }
    if (step === 5) {
      onConcluir();
    }
  };

  const voltar = () => {
    if (step === 4 && mostrarPersonalizacao) {
      setMostrarPersonalizacao(false);
      return;
    }
    if (step === 5 && (extras.cartoes.length > 0 || extras.polaroids.length > 0)) {
      // Permite revisitar a personalização ao voltar do resumo
      setMostrarPersonalizacao(true);
      setStep(4);
      return;
    }
    return step === 1 ? onVoltar() : setStep((s) => s - 1);
  };

  const progresso = (step / 5) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-linen">
      {/* Header navy */}
      <header className="sticky top-0 z-30 bg-charcoal">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 md:px-8">
          <Logo variant="light" />
          {textosCampanha?.eyebrow && (
            <span className="badge-mae">{textosCampanha.eyebrow}</span>
          )}
        </div>
        <div className="mx-auto w-full max-w-2xl px-4 pb-4 sm:px-6 md:px-8">
          <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-linen/55">
            Passo {step} de 5 — {titulosPasso[step - 1]}
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
              <p className="eyebrow-gold mb-2">
                {textosCampanha?.passo1Eyebrow || "Presenteie com carinho"}
              </p>
              <h1 className="font-serif text-3xl font-semibold leading-tight text-charcoal sm:text-[2rem]">
                {textosCampanha?.passo1Titulo || (
                  <>Qual <em className="italic text-terracotta">cesta</em> você escolhe?</>
                )}
              </h1>
              {textosCampanha?.subtitulo && (
                <p className="mt-2 text-sm text-ink/65">{textosCampanha.subtitulo}</p>
              )}
            </div>

            {(() => {
              // Badge de prazo do Passo 1: badge manual da campanha (override) →
              // senão derivado de "Data limite para encomendas" (dataLimitePedidos).
              // Sem badge manual e sem data definida, não exibe nada (evita texto global defasado).
              const prazo = textosCampanha?.passo1Badge
                ? textosCampanha.passo1Badge
                : campanhaAtiva?.dataLimitePedidos
                  ? (() => {
                      const d = new Date(campanhaAtiva.dataLimitePedidos.slice(0, 10) + "T12:00:00");
                      return `Encomendas encerram ${d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}`;
                    })()
                  : null;
              return prazo ? <div className="tag-prazo">{prazo}</div> : null;
            })()}

            {textosCampanha?.boasVindas && (
              <p className="rounded-xl bg-charcoal/5 p-3 text-sm text-charcoal">
                {textosCampanha.boasVindas}
              </p>
            )}

            {cestasAtivas.length === 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                Esta campanha ainda não tem produtos configurados. Volte em breve ou entre em
                contato com a loja.
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {cestasAtivas.map((c) => {
                const sel = cesta?.cesta.id === c.id;
                const temTamanhos = c.tamanhos && c.tamanhos.length > 0;
                const tamSelecionado = sel && tamanhoId
                  ? c.tamanhos?.find((t) => t.id === tamanhoId)
                  : undefined;
                return (
                  <article
                    key={c.id}
                    onClick={() => {
                      if (temTamanhos) {
                        setModalTamanhoId(cesta?.cesta.id === c.id ? tamanhoId : undefined);
                        setModalQuantidade(cesta?.cesta.id === c.id ? cesta.quantidade : 1);
                        setDetalhe(c);
                      } else {
                        setCesta(c);
                      }
                    }}
                    className={`group relative cursor-pointer overflow-hidden rounded-2xl bg-white transition-all hover:-translate-y-0.5 hover:shadow-soft ${
                      sel ? "ring-2 ring-terracotta shadow-warm" : "shadow-sm"
                    }`}
                  >
                    {sel && (
                      <span className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-terracotta text-white shadow-warm">
                        <Check className="h-4 w-4" strokeWidth={3} />
                      </span>
                    )}
                    <div className="aspect-[16/10] w-full overflow-hidden">
                      <img
                        src={tamSelecionado?.imagem || c.imagem}
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
                        {temTamanhos
                          ? tamSelecionado
                            ? formatBRL(tamSelecionado.preco)
                            : `A partir de ${formatBRL(Math.min(...c.tamanhos!.map((t) => t.preco)))}`
                          : formatBRL(c.preco)}
                      </p>
                      {tamSelecionado && (
                        <p className="mt-0.5 text-xs font-medium text-terracotta/70">
                          Tamanho {tamSelecionado.label}
                          {tamSelecionado.diametro ? ` · ${tamSelecionado.diametro}` : ""}
                        </p>
                      )}
                      {c.descricao ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink/60">
                          {c.descricao}
                        </p>
                      ) : (
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink/60">
                          {c.itens.slice(0, 5).join(" · ")}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalTamanhoId(cesta?.cesta.id === c.id ? tamanhoId : undefined);
                          setModalQuantidade(cesta?.cesta.id === c.id ? cesta.quantidade : 1);
                          setDetalhe(c);
                        }}
                        className="mt-3 inline-block rounded-full border border-charcoal px-4 py-2 text-xs font-medium text-charcoal transition-colors active:bg-charcoal active:text-white"
                      >
                        {temTamanhos ? "Escolher tamanho →" : "Ver itens completos"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <BotoesNav
              onAvancar={avancar}
              onVoltar={voltar}
              disabled={detalhe ? false : !cesta}
              avancarLabel={detalhe ? "Adicionar ao pedido →" : "Continuar →"}
            />
          </section>
        )}

        {/* ============== STEP 2 — Dados ============== */}
        {step === 2 && (
          <section className="animate-fade-up space-y-5">
            <div>
              <p className="eyebrow-gold mb-2">{textosCampanha?.passo2Eyebrow || "Identificação"}</p>
              <h1 className="font-serif text-3xl font-semibold leading-tight text-charcoal sm:text-[2rem]">
                {textosCampanha?.passo2Titulo || (
                  <>Quem está <em className="italic text-terracotta">pedindo?</em></>
                )}
              </h1>
              <p className="mt-2 text-sm text-ink/65">{textosCampanha?.passo2Subtitulo || "Para confirmarmos seu pedido pelo WhatsApp"}</p>
            </div>

            {cesta && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-charcoal/5 px-3.5 py-3">
                <span className="truncate text-sm font-medium text-charcoal">
                  {cesta.cesta.nome}
                </span>
                <span className="whitespace-nowrap font-serif text-base font-bold text-terracotta">
                  {formatBRL(precoEfetivo * cesta.quantidade)}
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
            <CampoInput
              label="E-mail (opcional)"
              value={emailInput}
              onChange={setEmailInput}
              placeholder="seu@email.com"
              inputMode="email"
            />

            {/* Destinatário */}
            <div className="space-y-3">
              <div>
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-terracotta">{textosCampanha?.passo2DestinatarioLabel || "Destinatário"}</p>
                <p className="font-serif text-lg font-semibold leading-tight text-charcoal">
                  {textosCampanha?.passo2DestinatarioTitulo || "Quem irá receber o pedido? 🎁"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOutraPessoa(true)}
                  className={`rounded-xl border-2 py-3 text-sm font-medium transition-all ${
                    outraPessoa
                      ? "border-charcoal bg-charcoal text-white"
                      : "border-sand/70 bg-white text-charcoal hover:border-charcoal/40"
                  }`}
                >
                  Outra Pessoa
                </button>
                <button
                  type="button"
                  onClick={() => setOutraPessoa(false)}
                  className={`rounded-xl border-2 py-3 text-sm font-medium transition-all ${
                    !outraPessoa
                      ? "border-charcoal bg-charcoal text-white"
                      : "border-sand/70 bg-white text-charcoal hover:border-charcoal/40"
                  }`}
                >
                  Eu mesmo(a)
                </button>
              </div>
              {outraPessoa && (
                <div className="animate-fade-up space-y-3 rounded-2xl bg-charcoal/5 p-4">
                  <CampoInput
                    label="Nome de quem vai receber"
                    value={destNome}
                    onChange={setDestNome}
                    placeholder="Nome completo"
                  />
                  <CampoInput
                    label="WhatsApp de quem vai receber"
                    value={destWhats}
                    onChange={(v) => setDestWhats(maskWhats(v))}
                    placeholder="(61) 99999-9999"
                    inputMode="numeric"
                  />
                </div>
              )}
            </div>

            <BotoesNav onAvancar={avancar} onVoltar={voltar} />
          </section>
        )}

        {/* ============== STEP 3 — Entrega ============== */}
        {step === 3 && (
          <section className="animate-fade-up space-y-5">
            <div>
              <p className="eyebrow-gold mb-2">{textosCampanha?.passo3Eyebrow || "Logística"}</p>
              <h1 className="font-serif text-3xl font-semibold leading-tight text-charcoal sm:text-[2rem]">
                {textosCampanha?.passo3Titulo || (
                  <>Como prefere <em className="italic text-terracotta">receber?</em></>
                )}
              </h1>
              <p className="mt-2 text-sm text-ink/65">
                {textosCampanha?.passo3Subtitulo || "Entregas e retiradas conforme disponibilidade"}
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
                    entregaTipo === "delivery" ? "bg-charcoal text-white" : "bg-linen text-charcoal"
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

            {entregaTipo === "delivery" && entregaConfig.delivery && (
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
                    Este endereço está fora da nossa área de entrega. Tente um CEP mais próximo ou
                    escolha a opção de retirada.
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
                {zonaEntregaAtual && (
                  <div className="flex items-center justify-between rounded-xl bg-olive/10 px-3 py-2.5 ring-1 ring-olive/30">
                    <div className="flex items-center gap-1.5 text-sm text-charcoal">
                      <Check className="h-4 w-4 text-olive shrink-0" />
                      <span className="font-medium">{zonaEntregaAtual.nome}</span>
                    </div>
                    <span className="text-sm font-semibold text-charcoal">
                      {taxaEntrega > 0 ? formatBRL(taxaEntrega) : "Grátis"}
                    </span>
                  </div>
                )}
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
                    entregaTipo === "retirada" ? "bg-charcoal text-white" : "bg-linen text-charcoal"
                  }`}
                >
                  <Store className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-charcoal">Retirada na loja</p>
                  <p className="truncate text-xs text-ink/60">Escolha a unidade mais próxima</p>
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
        {step === 4 && !mostrarPersonalizacao && (
          <section className="animate-fade-up space-y-6">
            <div>
              <p className="eyebrow-gold mb-2">{textosCampanha?.passo4Eyebrow || "Agendamento"}</p>
              <h1 className="font-serif text-3xl font-semibold leading-tight text-charcoal sm:text-[2rem]">
                {entregaTipo === "retirada" ? (
                  <>
                    Quando deseja <em className="italic text-terracotta">Retirar?</em>
                  </>
                ) : (
                  <>
                    Quando deseja <em className="italic text-terracotta">receber?</em>
                  </>
                )}
              </h1>
              <p className="mt-2 text-sm text-ink/65">
                {entregaTipo === "retirada"
                  ? "Escolha o melhor dia e horário para retirar"
                  : "Escolha o melhor dia e horário para você"}
              </p>
            </div>

            <div>
              <p className="mb-3 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-charcoal/70">
                Dia da entrega
              </p>
              {todosDias ? (
                /* ── Calendário livre — campanha sem restrição de data ── */
                (() => {
                  const hoje = new Date();
                  hoje.setHours(0, 0, 0, 0);
                  const selectedDate = parseDatePtBRToDate(data ?? "");
                  return (
                    <div className="flex justify-center">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        disabled={(date) => {
                          const d = new Date(date);
                          d.setHours(0, 0, 0, 0);
                          return d < hoje;
                        }}
                        fromMonth={new Date()}
                        onSelect={(date) => {
                          if (!date) return;
                          const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
                          setData(formatDatePtBR(d));
                          setHorario("");
                        }}
                      />
                    </div>
                  );
                })()
              ) : datasDisponiveis.length > 4 ? (
                /* ── Calendário para muitas datas ── */
                (() => {
                  const datasIds = new Set(
                    datasDisponiveis.map((d) => d.id).filter((id) => /^\d{4}-\d{2}-\d{2}$/.test(id)),
                  );
                  const selectedDatum = datasDisponiveis.find((d) => d.label === data);
                  const selectedDate = selectedDatum?.id && /^\d{4}-\d{2}-\d{2}$/.test(selectedDatum.id)
                    ? (() => {
                        const [y, m, day] = selectedDatum.id.split("-").map(Number);
                        return new Date(y, m - 1, day, 12);
                      })()
                    : undefined;
                  const sortedIds = [...datasIds].sort();
                  const fromParts = sortedIds[0]?.split("-").map(Number);
                  const toParts = sortedIds[sortedIds.length - 1]?.split("-").map(Number);
                  const fromMonth = fromParts ? new Date(fromParts[0], fromParts[1] - 1, 1) : undefined;
                  const toMonth = toParts ? new Date(toParts[0], toParts[1] - 1, 1) : undefined;
                  return (
                    <div className="flex justify-center">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        disabled={(date) => !datasIds.has(toISODateString(date))}
                        onSelect={(date) => {
                          if (!date) return;
                          const iso = toISODateString(date);
                          const found = datasDisponiveis.find((d) => d.id === iso);
                          if (found) {
                            setData(found.label);
                            setHorario("");
                          }
                        }}
                        fromMonth={fromMonth}
                        toMonth={toMonth}
                      />
                    </div>
                  );
                })()
              ) : (
                /* ── Cards para até 4 datas ── */
                <div
                  className={`grid gap-3 ${
                    datasDisponiveis.length === 3 ? "grid-cols-3" : "grid-cols-2"
                  }`}
                >
                  {datasDisponiveis.map((d) => {
                    const sel = data === d.label;
                    const parsed = parseDateId(d.id);
                    const semana = parsed?.semana ?? (d.label.split(",")[0]?.trim() || d.label);
                    const numero = parsed?.dia ?? (d.label.split(",")[1]?.trim().split(" ")?.[0] || "•");
                    const mesAno = parsed?.mesAno ?? "";
                    return (
                      <button
                        key={d.id}
                        onClick={() => {
                          setData(d.label);
                          setHorario("");
                        }}
                        className={`min-h-[72px] rounded-2xl border-2 p-4 text-center transition-all active:scale-[0.97] ${
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
                        {mesAno && (
                          <div className={`mt-0.5 text-xs ${sel ? "text-linen/70" : "text-charcoal/50"}`}>
                            {mesAno}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {data && (
              <div className="animate-fade-up">
                <p className="mb-3 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-charcoal/70">
                  Janela de horário
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {horariosDisponiveis.map((h) => {
                    const sel = horario === h.label;
                    return (
                      <button
                        key={h.label}
                        onClick={() => setHorario(h.label)}
                        className={`flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-2 py-3 text-xs font-medium transition-all active:scale-[0.97] sm:text-sm ${
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

            {(() => {
              if (!horario || !campanhaAtiva?.upsell?.ativo) return null;
              const itens = campanhaAtiva.upsell.itens ?? [];
              type Card = {
                key: string;
                tipo: "produto" | "cartao" | "polaroid";
                nome: string;
                descricao?: string;
                preco: number;
                imagem?: string;
                added: boolean;
                onToggle: () => void;
              };
              const cards: Card[] = [];
              for (const i of itens) {
                if (i.tipo === "produto") {
                  const p = cestasAdmin.find(
                    (c) => c.id === i.produtoId && c.ativo && !c.arquivado,
                  );
                  if (!p) continue;
                  const added = !!sobremesas[p.id];
                  cards.push({
                    key: `prod-${p.id}`,
                    tipo: "produto",
                    nome: p.nome,
                    descricao: p.descricao,
                    preco: p.preco,
                    imagem: p.imagem,
                    added,
                    onToggle: () =>
                      toggleSobremesa({
                        id: p.id,
                        nome: p.nome,
                        descricao: p.descricao,
                        preco: p.preco,
                        imagem: p.imagem,
                      }),
                  });
                } else if (i.tipo === "cartao") {
                  const added = extras.cartoes.some((c) => c.itemId === i.itemId);
                  cards.push({
                    key: `cart-${i.itemId}`,
                    tipo: "cartao",
                    nome: i.nome,
                    descricao: `Cartãozinho com mensagem (até ${i.maxCaracteres} caracteres)`,
                    preco: i.preco,
                    added,
                    onToggle: () =>
                      added
                        ? removeCartao(i.itemId)
                        : setCartao({
                            itemId: i.itemId,
                            nome: i.nome,
                            preco: i.preco,
                            mensagem: "",
                          }),
                  });
                } else if (i.tipo === "polaroid") {
                  const added = extras.polaroids.some((p) => p.itemId === i.itemId);
                  cards.push({
                    key: `pol-${i.itemId}`,
                    tipo: "polaroid",
                    nome: i.nome,
                    descricao: "Foto polaroid impressa (você envia a imagem)",
                    preco: i.preco,
                    added,
                    onToggle: () =>
                      added
                        ? removePolaroid(i.itemId)
                        : setPolaroid({
                            itemId: i.itemId,
                            nome: i.nome,
                            preco: i.preco,
                            arquivoUrl: "",
                            arquivoNome: "",
                          }),
                  });
                }
              }
              if (cards.length === 0) return null;
              return (
                <div className="animate-fade-up space-y-3 border-t border-sand/60 pt-5">
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-charcoal">
                      Quer adicionar algo a mais? ✨
                    </h3>
                    <p className="text-xs text-ink/60">Entregue junto com sua cesta</p>
                  </div>
                  {cards.map((s) => (
                    <button
                      key={s.key}
                      onClick={s.onToggle}
                      className={`flex w-full items-center gap-3 rounded-xl border-2 bg-white p-3 text-left transition-all ${
                        s.added
                          ? "border-olive bg-olive/[0.04]"
                          : "border-sand/70 hover:border-terracotta/60"
                      }`}
                    >
                      {s.imagem ? (
                        <img
                          src={s.imagem}
                          alt=""
                          className="h-12 w-12 flex-none rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-linen text-charcoal">
                          {s.tipo === "cartao" ? (
                            <Mail className="h-5 w-5" />
                          ) : (
                            <Camera className="h-5 w-5" />
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-charcoal">{s.nome}</p>
                        {s.descricao && (
                          <p className="line-clamp-1 text-[11px] text-ink/55">{s.descricao}</p>
                        )}
                        <p className="text-xs text-ink/60">{formatBRL(s.preco)}</p>
                      </div>
                      <span
                        className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-white transition-colors ${
                          s.added ? "bg-olive" : "bg-charcoal"
                        }`}
                      >
                        {s.added ? (
                          <Check className="h-4 w-4" strokeWidth={3} />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })()}

            <BotoesNav
              onAvancar={avancar}
              onVoltar={voltar}
              avancarLabel={
                extras.cartoes.length > 0 || extras.polaroids.length > 0
                  ? "Personalizar →"
                  : "Ver resumo do pedido →"
              }
            />
          </section>
        )}

        {/* ============== STEP 4.5 — Personalização (cartão / polaroid) ============== */}
        {step === 4 && mostrarPersonalizacao && (
          <PersonalizacaoExtras onAvancar={avancar} onVoltar={voltar} />
        )}

        {/* ============== STEP 5 — Resumo + Pagamento ============== */}
        {step === 5 && pagamento.checkoutAtivo && (
          <CheckoutAsaas
            onVoltar={voltar}
            habilitarPix={pagamento.pix}
            habilitarCartao={pagamento.cartao}
            taxaEntrega={taxaEntrega}
          />
        )}

        {step === 5 && !pagamento.checkoutAtivo && (
          <section className="animate-fade-up space-y-5">
            <div>
              <p className="eyebrow-gold mb-2">{textosCampanha?.passo5Eyebrow || "Quase lá!"}</p>
              <h1 className="font-serif text-3xl font-semibold leading-tight text-charcoal sm:text-[2rem]">
                {textosCampanha?.passo5Titulo || (
                  <>Seu <em className="italic text-terracotta">pedido</em></>
                )}
              </h1>
              <p className="mt-2 text-sm text-ink/65">{textosCampanha?.passo5Subtitulo || "Revise e escolha como pagar"}</p>
            </div>

            {/* Itens e valores */}
            <div className="rounded-2xl bg-white p-4 ring-1 ring-sand/60 sm:p-5">
              <h3 className="mb-3 text-sm font-semibold text-charcoal">Itens</h3>
              <ul className="space-y-1.5 text-sm">
                {cesta && (
                  <li className="flex justify-between">
                    <span className="text-charcoal">
                      {cesta.cesta.nome}
                      {tamanhoId
                        ? (() => {
                            const t = cesta.cesta.tamanhos?.find((t) => t.id === tamanhoId);
                            return t ? ` · Tam. ${t.label}` : "";
                          })()
                        : ""}
                      {" "}× {cesta.quantidade}
                    </span>
                    <span className="font-semibold text-charcoal">
                      {formatBRL(precoEfetivo * cesta.quantidade)}
                    </span>
                  </li>
                )}
                {Object.values(sobremesas).map((s) => (
                  <li key={s.sobremesa.id} className="flex justify-between">
                    <span className="text-charcoal">
                      {s.sobremesa.nome} × {s.quantidade}
                    </span>
                    <span className="font-semibold text-charcoal">
                      {formatBRL(s.sobremesa.preco * s.quantidade)}
                    </span>
                  </li>
                ))}
                {extras.cartoes.map((c) => (
                  <li key={`c-${c.itemId}`} className="flex justify-between">
                    <span className="text-charcoal">💌 {c.nome}</span>
                    <span className="font-semibold text-charcoal">{formatBRL(c.preco)}</span>
                  </li>
                ))}
                {extras.polaroids.map((p) => (
                  <li key={`p-${p.itemId}`} className="flex justify-between">
                    <span className="text-charcoal">📸 {p.nome}</span>
                    <span className="font-semibold text-charcoal">{formatBRL(p.preco)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-1.5 border-t border-sand/60 pt-3 text-sm">
                <div className="flex justify-between text-ink/70">
                  <span>Subtotal</span>
                  <span>{formatBRL(subtotal)}</span>
                </div>
                {entregaTipo === "delivery" && (
                  <div className="flex justify-between text-ink/70">
                    <span>Taxa de entrega</span>
                    <span>{taxaEntrega > 0 ? formatBRL(taxaEntrega) : "Grátis"}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-sand/60 pt-2">
                  <span className="text-sm font-medium text-charcoal">Total</span>
                  <span className="font-serif text-2xl font-bold text-terracotta">
                    {formatBRL(total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Detalhes do pedido */}
            <div className="rounded-2xl bg-white p-4 ring-1 ring-sand/60 sm:p-5">
              <h3 className="mb-1 text-sm font-semibold text-charcoal">Detalhes</h3>
              <ResumoLinha
                label="Entrega"
                valor={
                  entregaTipo === "delivery" ? "Delivery" : `Retirada — ${unidade?.nome ?? ""}`
                }
              />
              <ResumoLinha
                label={entregaTipo === "delivery" ? "Endereço" : "Unidade"}
                valor={
                  entregaTipo === "delivery" && endereco
                    ? `${endereco.rua}, ${endereco.numero}${endereco.complemento ? ", " + endereco.complemento : ""} — ${endereco.bairro}, ${endereco.cidade}-${endereco.estado}`
                    : (unidade?.endereco ?? "—")
                }
              />
              <ResumoLinha label="Data e horário" valor={`${data ?? ""} · ${horario ?? ""}`} />
              <ResumoLinha label="Quem pediu" valor={`${cliente.nome} · ${cliente.whatsapp}`} />
              {destinatario && (
                <ResumoLinha
                  label="Quem recebe"
                  valor={`${destinatario.nome} · ${destinatario.whatsapp}`}
                />
              )}
              {entregaTipo === "retirada" && campanhaAtiva?.retirada?.enderecoRetirada && (
                <ResumoLinha
                  label="Observação de retirada"
                  valor={campanhaAtiva.retirada.enderecoRetirada}
                />
              )}
            </div>

            {pagamento.checkoutAtivo ? (
              <div className="rounded-2xl bg-charcoal/5 p-4 text-sm text-charcoal ring-1 ring-charcoal/15">
                <p className="font-medium">💳 Pagamento online via Mercado Pago</p>
                <p className="mt-1 text-xs text-ink/70">
                  Ao confirmar, você será redirecionado ao Checkout seguro do Mercado Pago para
                  pagar com PIX, cartão ou boleto.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-olive/10 p-4 text-sm text-charcoal ring-1 ring-olive/30">
                <p className="font-medium">📲 Envio do pedido pelo WhatsApp</p>
                <p className="mt-1 text-xs text-ink/70">
                  Ao confirmar, abriremos o WhatsApp com a mensagem do seu pedido pronta para enviar
                  à nossa equipe. O pagamento será combinado diretamente na conversa.
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
                  destinatario: st.destinatario ?? null,
                  cesta: st.cesta
                    ? {
                        nome: st.cesta.cesta.nome,
                        quantidade: st.cesta.quantidade,
                        preco: selectPrecoEfetivo(st),
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
                    extras: st.extras,
                  },
                  total,
                };
                const { id } = await finalizarPedido(payload, st.pedidoId, campanhaAtiva?.id);
                if (id) usePedido.getState().setPedidoId(id);

                trackPurchase({
                  transaction_id: id || `local-${Date.now()}`,
                  value: total,
                  currency: "BRL",
                  payment_type: usandoMp ? "mercadopago" : "whatsapp",
                  items: [
                    ...(cesta
                      ? [
                          {
                            item_name: cesta.cesta.nome,
                            quantity: cesta.quantidade,
                            price: precoEfetivo,
                          },
                        ]
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
                      ? [
                          {
                            title: cesta.cesta.nome,
                            quantity: cesta.quantidade,
                            unit_price: precoEfetivo,
                          },
                        ]
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
                      toast.error("Mercado Pago não configurado. Avise o administrador.");
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
                  destinatario: st.destinatario,
                  cesta: st.cesta
                    ? (() => {
                        const tam = st.tamanhoId
                          ? st.cesta.cesta.tamanhos?.find((t) => t.id === st.tamanhoId)
                          : undefined;
                        return {
                          cesta: {
                            nome: st.cesta.cesta.nome + (tam ? ` · Tam. ${tam.label}` : ""),
                            preco: selectPrecoEfetivo(st),
                          },
                          quantidade: st.cesta.quantidade,
                        };
                      })()
                    : undefined,
                  sobremesas,
                  entregaTipo,
                  endereco,
                  unidade,
                  data,
                  horario,
                  total,
                  pedidoId: id || st.pedidoId,
                  extras: st.extras,
                });
                const link = montarLinkWhats(textos.whatsapp, mensagem);
                window.open(link, "_blank", "noopener");
                setEnviando(false);
                onConcluir();
              }}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60 ${
                pagamento.checkoutAtivo ? "bg-charcoal" : "bg-[#25D366]"
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
          {/*
            Mobile  : bottom sheet, single column (imagem topo + conteúdo embaixo)
            Desktop : dialog centralizado, duas colunas (imagem esquerda | conteúdo direita)
          */}
          <div
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-linen sm:max-w-3xl sm:flex-row sm:rounded-3xl"
            style={{ maxHeight: "min(90vh, 680px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Coluna imagem ── */}
            <div className="relative aspect-[16/10] w-full flex-none overflow-hidden sm:aspect-auto sm:w-[42%]">
              <img
                src={
                  detalhe.tamanhos?.find((t) => t.id === modalTamanhoId)?.imagem ||
                  detalhe.imagem
                }
                alt={detalhe.nome}
                className="h-full w-full object-cover"
              />
              {/* Botão fechar — sempre visível sobre a imagem */}
              <button
                onClick={() => setDetalhe(null)}
                className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-charcoal/60 text-white backdrop-blur-sm active:bg-charcoal/90"
              >
                ✕
              </button>
            </div>

            {/* ── Coluna conteúdo ── */}
            <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:pb-5">
              <span className="inline-block rounded-full bg-olive px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-white">
                {detalhe.badge}
              </span>
              <h3 className="mt-2 font-serif text-xl font-bold text-charcoal sm:text-2xl">{detalhe.nome}</h3>
              <p className="mt-1 font-serif text-xl font-semibold text-terracotta sm:text-2xl">
                {detalhe.tamanhos && detalhe.tamanhos.length > 0
                  ? modalTamanhoId
                    ? formatBRL(detalhe.tamanhos.find((t) => t.id === modalTamanhoId)?.preco ?? detalhe.preco)
                    : `A partir de ${formatBRL(Math.min(...detalhe.tamanhos.map((t) => t.preco)))}`
                  : formatBRL(detalhe.preco)}
              </p>

              {detalhe.descricao && (
                <p className="mt-2 text-sm leading-relaxed text-ink/70">{detalhe.descricao}</p>
              )}

              {/* Cards de tamanho comparativos */}
              {detalhe.tamanhos && detalhe.tamanhos.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-charcoal/60">
                    Escolha o tamanho
                  </p>
                  <div className={`grid gap-2 ${detalhe.tamanhos.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                    {detalhe.tamanhos.map((t) => {
                      const tamSel = modalTamanhoId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setModalTamanhoId(t.id)}
                          className={`flex min-h-[90px] flex-col items-center gap-1 rounded-2xl border-2 px-1.5 py-2.5 text-center transition-all active:scale-[0.97] sm:min-h-[100px] sm:py-3 ${
                            tamSel
                              ? "border-terracotta bg-terracotta/5 shadow-sm"
                              : "border-charcoal/15 bg-white"
                          }`}
                        >
                          <span className={`font-serif text-xl font-bold sm:text-2xl ${tamSel ? "text-terracotta" : "text-charcoal"}`}>
                            {t.label}
                          </span>
                          <div className="w-full space-y-0.5">
                            {t.diametro && (
                              <div className="flex flex-col">
                                <span className="text-[9px] font-medium uppercase tracking-wide text-charcoal/40">Diâmetro</span>
                                <span className="text-[11px] font-semibold text-charcoal">{t.diametro}</span>
                              </div>
                            )}
                            {t.fatias && (
                              <div className="flex flex-col">
                                <span className="text-[9px] font-medium uppercase tracking-wide text-charcoal/40">Fatias</span>
                                <span className="text-[11px] font-semibold text-charcoal">~{t.fatias}</span>
                              </div>
                            )}
                            {t.peso && (
                              <div className="flex flex-col">
                                <span className="text-[9px] font-medium uppercase tracking-wide text-charcoal/40">Peso</span>
                                <span className="text-[11px] font-semibold text-charcoal">{t.peso}</span>
                              </div>
                            )}
                          </div>
                          <span className={`mt-auto font-serif text-xs font-bold sm:text-sm ${tamSel ? "text-terracotta" : "text-charcoal/70"}`}>
                            {formatBRL(t.preco)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Itens — 2 colunas no desktop para economizar altura */}
              {(() => {
                const tamSelModal = detalhe.tamanhos?.find((t) => t.id === modalTamanhoId);
                const itensExibidos =
                  tamSelModal?.itens && tamSelModal.itens.length > 0
                    ? tamSelModal.itens
                    : detalhe.itens;
                return (
                  itensExibidos.length > 0 && (
                    <ul className="mt-3 grid gap-x-3 gap-y-1.5 sm:grid-cols-2">
                      {itensExibidos.map((i) => (
                        <li key={i} className="flex items-start gap-2 border-b border-charcoal/5 pb-1.5 text-xs text-ink sm:text-sm">
                          <span className="mt-1 block h-1.5 w-1.5 flex-none rounded-full bg-terracotta" />
                          <span>{i}</span>
                        </li>
                      ))}
                    </ul>
                  )
                );
              })()}

              {/* Espaçador para empurrar quantidade + botão para o fundo no desktop */}
              <div className="flex-1" />

              {/* Quantidade + Total */}
              {(() => {
                const precoUnit = detalhe.tamanhos?.find((t) => t.id === modalTamanhoId)?.preco ?? detalhe.preco;
                const totalModal = precoUnit * modalQuantidade;
                return (
                  <div className="mt-4 overflow-hidden rounded-xl bg-charcoal/5">
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-charcoal/70">
                        Quantidade
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setModalQuantidade(Math.max(1, modalQuantidade - 1))}
                          className="flex h-11 w-11 items-center justify-center rounded-full border border-charcoal/40 text-charcoal active:bg-charcoal active:text-linen"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-serif text-lg">{modalQuantidade}</span>
                        <button
                          type="button"
                          onClick={() => setModalQuantidade(modalQuantidade + 1)}
                          className="flex h-11 w-11 items-center justify-center rounded-full border border-charcoal/40 text-charcoal active:bg-charcoal active:text-linen"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    {(modalTamanhoId || !detalhe.tamanhos?.length) && (
                      <div className="flex items-center justify-between border-t border-charcoal/10 px-4 py-2">
                        <span className="text-xs text-charcoal/50">
                          {formatBRL(precoUnit)} × {modalQuantidade}
                        </span>
                        <span className="font-serif text-base font-bold text-terracotta">
                          {formatBRL(totalModal)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              <button
                onClick={() => {
                  if (detalhe.tamanhos && detalhe.tamanhos.length > 0 && !modalTamanhoId) {
                    toast.error("Escolha um tamanho para continuar.");
                    return;
                  }
                  setCesta(detalhe);
                  if (modalTamanhoId) setTamanho(modalTamanhoId);
                  setQuantidade(modalQuantidade);
                  setDetalhe(null);
                  setStep(2);
                }}
                className="mt-2 hidden w-full rounded-xl bg-charcoal py-4 text-sm font-medium text-white active:bg-charcoal/80 sm:block"
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
        className="w-full rounded-xl border-[1.5px] border-sand/80 bg-white px-4 py-3 text-base text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-charcoal"
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      {/* Spacer mobile: reserva espaço para a barra não cobrir conteúdo */}
      <div className="h-24 sm:hidden" />

      {/* Desktop: fluxo normal */}
      <div className="hidden sm:block space-y-2 pt-2">
        <button
          onClick={onAvancar}
          disabled={disabled}
          className="w-full rounded-xl bg-charcoal py-4 text-sm font-medium tracking-wide text-white transition-colors hover:bg-charcoal/90 disabled:cursor-not-allowed disabled:bg-charcoal/40"
        >
          {avancarLabel}
        </button>
        <button onClick={onVoltar} className="mx-auto block text-xs text-ink/60 hover:text-charcoal">
          ← Voltar
        </button>
      </div>

      {/* Mobile: portal em document.body — evita stacking context de ancestors animados */}
      {mounted && createPortal(
        <div
          className="fixed bottom-0 left-0 right-0 z-[9999] flex gap-2 border-t border-sand/40 bg-white/95 px-4 py-3 backdrop-blur-sm sm:hidden"
          style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={onVoltar}
            aria-label="Voltar"
            className="flex h-12 w-12 flex-none items-center justify-center rounded-xl border border-sand bg-white text-lg text-charcoal transition-colors hover:bg-sand/30"
          >
            ←
          </button>
          <button
            onClick={onAvancar}
            disabled={disabled}
            className="h-12 flex-1 rounded-xl bg-charcoal text-sm font-medium tracking-wide text-white transition-colors hover:bg-charcoal/90 disabled:cursor-not-allowed disabled:bg-charcoal/40"
          >
            {avancarLabel}
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

function PersonalizacaoExtras({
  onAvancar,
  onVoltar,
}: {
  onAvancar: () => void;
  onVoltar: () => void;
}) {
  const extras = usePedido((s) => s.extras);
  const setCartao = usePedido((s) => s.setCartao);
  const setPolaroid = usePedido((s) => s.setPolaroid);
  const campanhaAtiva = useCampanhaAtiva();
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const getMaxCaracteres = (itemId: string): number => {
    const found = (campanhaAtiva?.upsell?.itens ?? []).find(
      (i) => i.tipo === "cartao" && i.itemId === itemId,
    );
    return found && found.tipo === "cartao" ? found.maxCaracteres : 150;
  };

  const handleFile = async (
    polaroid: { itemId: string; nome: string; preco: number },
    file: File,
  ) => {
    setUploading((u) => ({ ...u, [polaroid.itemId]: true }));
    const result = await uploadPolaroid(file);
    setUploading((u) => ({ ...u, [polaroid.itemId]: false }));
    if (!result.ok) {
      toast.error(result.erro);
      return;
    }
    setPolaroid({
      itemId: polaroid.itemId,
      nome: polaroid.nome,
      preco: polaroid.preco,
      arquivoUrl: result.url,
      arquivoNome: result.nome,
    });
    toast.success("Foto enviada!");
  };

  return (
    <section className="animate-fade-up space-y-6">
      <div>
        <p className="eyebrow-gold mb-2">Personalização</p>
        <h1 className="font-serif text-3xl font-semibold leading-tight text-charcoal sm:text-[2rem]">
          Deixe seu pedido <em className="italic text-terracotta">único</em>
        </h1>
        <p className="mt-2 text-sm text-ink/65">
          Preencha os detalhes dos itens que você adicionou
        </p>
      </div>

      {extras.cartoes.map((c) => {
        const max = getMaxCaracteres(c.itemId);
        return (
          <div
            key={`cartao-${c.itemId}`}
            className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-sand/60 sm:p-5"
          >
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-terracotta" />
              <h3 className="font-serif text-base font-semibold text-charcoal">{c.nome}</h3>
            </div>
            <p className="text-xs text-ink/60">Escreva a mensagem que vai no cartãozinho</p>
            <Textarea
              value={c.mensagem}
              maxLength={max}
              onChange={(e) =>
                setCartao({
                  itemId: c.itemId,
                  nome: c.nome,
                  preco: c.preco,
                  mensagem: e.target.value,
                })
              }
              placeholder="Ex.: Para a melhor mãe do mundo, com todo amor..."
              className="min-h-[110px] rounded-xl border-[1.5px] border-sand/80 bg-white text-base text-ink"
            />
            <div className="flex justify-end text-[11px] text-ink/55">
              {c.mensagem.length} / {max}
            </div>
          </div>
        );
      })}

      {extras.polaroids.map((p) => {
        const enviada = !!p.arquivoUrl;
        const isUploading = !!uploading[p.itemId];
        return (
          <div
            key={`pol-${p.itemId}`}
            className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-sand/60 sm:p-5"
          >
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-terracotta" />
              <h3 className="font-serif text-base font-semibold text-charcoal">{p.nome}</h3>
            </div>
            <p className="text-xs text-ink/60">
              Envie a foto que será impressa (JPG ou PNG, até 10 MB)
            </p>
            <label
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-sm font-medium transition-colors ${
                enviada
                  ? "border-olive bg-olive/[0.06] text-olive"
                  : "border-sand/80 bg-linen/40 text-charcoal hover:border-terracotta hover:text-terracotta"
              } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : enviada ? (
                <>
                  <Check className="h-4 w-4" strokeWidth={3} />
                  <span className="truncate">{p.arquivoNome}</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Escolher foto
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleFile(p, file);
                }}
              />
            </label>
            {enviada && (
              <p className="text-center text-[11px] text-ink/55">
                Foto recebida com sucesso. Você pode trocar clicando acima.
              </p>
            )}
          </div>
        );
      })}

      <BotoesNav onAvancar={onAvancar} onVoltar={onVoltar} avancarLabel="Ver resumo do pedido →" />
    </section>
  );
}
