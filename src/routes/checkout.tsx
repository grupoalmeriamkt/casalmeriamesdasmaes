import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCarrinho, useCarrinhoTotal } from "@/store/carrinho";
import { formatBRL } from "@/store/pedido";
import { Logo } from "@/components/Logo";
import { ThemeApplier } from "@/components/ThemeApplier";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { upsertRascunho } from "@/lib/pedidos";
import { appendTamanhoAoNome } from "@/lib/cestaTamanho";
import { checkoutAccessHeaders, linkPagamentoAccess } from "@/lib/checkoutAccess";
import { ArrowLeft, Loader2, CheckCircle2, Tag, Lock, Clock, MapPin } from "lucide-react";
import {
  useAdmin,
  useCampanhaAtiva,
  useDatasAtivas,
  useHorariosAtivos,
  useTodosDias,
  useUnidadesAtivas,
  useUnidadesCadastradas,
} from "@/store/admin";
import { fbqTrack, newEventId, sendCapiEvent } from "@/lib/metaPixel";
import { trackBeginCheckout, trackAddPaymentInfo } from "@/lib/gtm";
import { buscarCep } from "@/lib/cep";
import {
  atendeAreaEntrega,
  atendeAreaEntregaFromTexto,
  MSG_AREA_ENTREGA,
  MSG_FORA_AREA,
  salvarCepEntrega,
} from "@/lib/entregaArea";
import { Calendar } from "@/components/ui/calendar";
import { formatDatePtBR, parseDateId, parseDatePtBRToDate, toISODateString } from "@/lib/dateUtils";
import { nowSP, todayISOSP, amanhaISOSP, minutosDoDiaSP } from "@/lib/timezone";
import {
  dataRetiradaBloqueada,
  horarioRetiradaBloqueado,
  REGRA_RETIRADA_PADRAO,
} from "@/lib/availability/retirada";
import {
  buildRegrasForItens,
  listAvailableDates,
  regraMaisRestritiva,
  type CarrinhoItem as AvailItem,
} from "@/lib/availability";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: "Checkout — Casa Almeria" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: CheckoutPage,
});

const onlyDigits = (v: string) => v.replace(/\D/g, "");

const ClienteSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(120),
  cpf: z.string().regex(/^\d{11}$/, "CPF inválido"),
  email: z.string().email("E-mail inválido").max(180),
  whatsapp: z.string().regex(/^\d{10,11}$/, "WhatsApp 10–11 dígitos"),
});

const EnderecoSchema = z.object({
  cep: z.string().regex(/^\d{8}$/, "CEP inválido"),
  numero: z.string().min(1, "Informe o número").max(10),
  complemento: z.string().max(80).optional(),
});

const CartaoSchema = z.object({
  holderName: z.string().min(2, "Nome no cartão"),
  number: z.string().regex(/^\d{13,19}$/, "Número inválido"),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2,4}$/, "MM/AA"),
  ccv: z.string().regex(/^\d{3,4}$/, "CCV"),
});

type Metodo = "PIX" | "CREDIT_CARD";

function maskCard(v: string) {
  const d = onlyDigits(v).slice(0, 19);
  return d.replace(/(.{4})/g, "$1 ").trim();
}
function maskExpiry(v: string) {
  const d = onlyDigits(v).slice(0, 4);
  if (d.length < 3) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}
function maskCpf(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function maskCep(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  return d.replace(/(\d{5})(\d)/, "$1-$2");
}
function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d)/, "($1) $2-$3");
  return d.replace(/(\d{2})(\d{5})(\d)/, "($1) $2-$3");
}

function CheckoutPage() {
  const itens = useCarrinho((s) => s.itens);
  const clear = useCarrinho((s) => s.clear);
  const { total } = useCarrinhoTotal();
  const navigate = useNavigate();
  const pixelId = useAdmin((s) => s.integracoes.metaPixelId);
  const testEventCode = useAdmin((s) => s.integracoes.metaTestEventCode);
  const entregaConfig = useAdmin((s) => s.entrega);
  const campanhaAtiva = useCampanhaAtiva();
  const firedInitiate = useRef(false);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [tipoEntrega, setTipoEntrega] = useState<"delivery" | "retirada">("retirada");
  const [unidadeId, setUnidadeId] = useState("");
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [enderecoStr, setEnderecoStr] = useState("");
  const [cepEntrega, setCepEntrega] = useState("");
  const [foraArea, setForaArea] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const podeRetirada = entregaConfig.retirada !== false;
  const podeDelivery = entregaConfig.delivery !== false;
  const unidadesCampanha = useUnidadesAtivas();
  const unidadesCadastradas = useUnidadesCadastradas();
  const unidades = useMemo(
    () =>
      unidadesCampanha.length > 0
        ? unidadesCampanha
        : unidadesCadastradas.filter((u) => u.status === "ativa"),
    [unidadesCampanha, unidadesCadastradas],
  );
  const datasCampanha = useDatasAtivas(tipoEntrega);
  const horariosCampanha = useHorariosAtivos(tipoEntrega);
  const todosDias = useTodosDias(tipoEntrega);

  const agoraSP = nowSP();
  const hojeISO = todayISOSP(agoraSP);
  const amanhaISO = amanhaISOSP(agoraSP);
  const minutosAgoraSP = minutosDoDiaSP();
  const ctxAntecedencia = { minutosAgoraSP, amanhaISO };

  const datasDisponiveis = useMemo(() => {
    const filtradas = datasCampanha.filter((d) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.id)) return true;
      if (d.id < hojeISO) return false;
      if (dataRetiradaBloqueada(d.id, hojeISO, REGRA_RETIRADA_PADRAO, ctxAntecedencia)) return false;
      return true;
    });
    if (filtradas.length > 0 || todosDias) return filtradas;
    const carrinho: AvailItem[] = itens.map((it) => ({
      produto_id: it.produtoId,
      produto_tipo: "cesta",
      nome: it.nome,
    }));
    const regra = regraMaisRestritiva(buildRegrasForItens(carrinho));
    return listAvailableDates(regra, agoraSP, 14).map((iso) => {
      const [y, m, day] = iso.split("-").map(Number);
      return { id: iso, label: formatDatePtBR(new Date(y, m - 1, day, 12)), ativa: true };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasCampanha, todosDias, hojeISO, itens, tipoEntrega]);

  const dataSelecionadaISO = useMemo(() => {
    const byId = datasDisponiveis.find((d) => d.label === data)?.id;
    if (byId && /^\d{4}-\d{2}-\d{2}$/.test(byId)) return byId;
    const parsed = data ? parseDatePtBRToDate(data) : null;
    return parsed ? toISODateString(parsed) : undefined;
  }, [data, datasDisponiveis]);

  const horariosDisponiveis = useMemo(() => {
    const fonte =
      horariosCampanha.length > 0
        ? horariosCampanha
        : [
            { label: "Entre 08h e 09h", ativo: true },
            { label: "Entre 09h e 10h", ativo: true },
            { label: "Entre 10h e 12h", ativo: true },
            { label: "Entre 12h e 14h", ativo: true },
            { label: "Entre 14h e 16h", ativo: true },
            { label: "Entre 16h e 18h", ativo: true },
          ];
    return fonte.filter((h) => {
      if (!h.ativo) return false;
      if (
        dataSelecionadaISO &&
        horarioRetiradaBloqueado(
          h.label,
          dataSelecionadaISO,
          { minutosAgoraSP, amanhaISO },
          REGRA_RETIRADA_PADRAO,
        )
      ) {
        return false;
      }
      if (dataSelecionadaISO === hojeISO) {
        const m = h.label.match(/Entre (\d{1,2})h e (\d{1,2})h/);
        if (m) return parseInt(m[2], 10) * 60 > minutosAgoraSP;
      }
      return true;
    });
  }, [horariosCampanha, dataSelecionadaISO, minutosAgoraSP, amanhaISO, hojeISO]);

  useEffect(() => {
    if (tipoEntrega === "delivery" && !podeDelivery && podeRetirada) setTipoEntrega("retirada");
    if (tipoEntrega === "retirada" && !podeRetirada && podeDelivery) setTipoEntrega("delivery");
  }, [podeDelivery, podeRetirada, tipoEntrega]);

  useEffect(() => {
    if (tipoEntrega !== "retirada") return;
    if (unidades.length === 1 && !unidadeId) setUnidadeId(unidades[0].id);
  }, [tipoEntrega, unidades, unidadeId]);

  useEffect(() => {
    if (horario && !horariosDisponiveis.some((h) => h.label === horario)) {
      setHorario("");
    }
  }, [horario, horariosDisponiveis]);

  const [cep, setCep] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");

  const [metodo, setMetodo] = useState<Metodo>("PIX");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCcv, setCardCcv] = useState("");

  const [cupomInput, setCupomInput] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState<{
    codigo: string;
    desconto: number;
  } | null>(null);
  const [validandoCupom, setValidandoCupom] = useState(false);

  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  const totalComDesconto = useMemo(
    () => Math.max(0, total - (cupomAplicado?.desconto ?? 0)),
    [total, cupomAplicado],
  );

  useEffect(() => {
    if (cupomAplicado) {
      // Reaplica para garantir desconto correto se total mudar
      void aplicarCupom(cupomAplicado.codigo, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // InitiateCheckout — dispara uma única vez ao entrar na página de checkout
  useEffect(() => {
    if (firedInitiate.current) return;
    firedInitiate.current = true;
    const eventId = newEventId("ic");
    fbqTrack("InitiateCheckout", { value: total, currency: "BRL", num_items: itens.length }, eventId);
    trackBeginCheckout({ value: total, currency: "BRL", num_items: itens.length });
    if (pixelId) {
      void sendCapiEvent({
        pixelId,
        testEventCode,
        eventName: "InitiateCheckout",
        eventId,
        customData: { value: total, currency: "BRL", num_items: itens.length },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AddPaymentInfo — dispara ao mudar o método de pagamento
  const prevMetodo = useRef<string | null>(null);
  useEffect(() => {
    if (prevMetodo.current === null) {
      prevMetodo.current = metodo;
      return;
    }
    if (prevMetodo.current === metodo) return;
    prevMetodo.current = metodo;
    const eventId = newEventId("api");
    fbqTrack("AddPaymentInfo", { value: totalComDesconto, currency: "BRL", payment_type: metodo }, eventId);
    trackAddPaymentInfo({ value: totalComDesconto, currency: "BRL", payment_type: metodo });
    if (pixelId) {
      const [firstName, ...rest] = nome.trim().split(/\s+/);
      void sendCapiEvent({
        pixelId,
        testEventCode,
        eventName: "AddPaymentInfo",
        eventId,
        userData: {
          email: email.trim() || undefined,
          phone: whatsapp ? `55${whatsapp.replace(/\D/g, "")}` : undefined,
          firstName: firstName || undefined,
          lastName: rest.join(" ") || undefined,
        },
        customData: { value: totalComDesconto, currency: "BRL", payment_type: metodo },
      });
    }
  }, [metodo, totalComDesconto, pixelId, testEventCode, nome, email, whatsapp]);

  async function aplicarCupom(codigo: string, silent = false) {
    if (!codigo.trim()) return;
    setValidandoCupom(true);
    try {
      const res = await fetch("/api/public/cupom/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: codigo.trim(), total }),
      });
      const data = await res.json();
      if (data?.valido) {
        setCupomAplicado({ codigo: data.codigo, desconto: data.desconto });
        if (!silent) toast.success(`Cupom aplicado: −${formatBRL(data.desconto)}`);
      } else {
        setCupomAplicado(null);
        if (!silent) toast.error(data?.motivo ?? "Cupom inválido");
      }
    } catch {
      if (!silent) toast.error("Erro ao validar cupom");
    } finally {
      setValidandoCupom(false);
    }
  }

  if (itens.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-linen p-6 text-center">
        <ThemeApplier />
        <Logo />
        <p className="text-charcoal">Seu carrinho está vazio.</p>
        <Link to="/" className="text-terracotta underline">
          Voltar ao cardápio
        </Link>
        <Toaster position="bottom-right" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErros({});

    const cliente = ClienteSchema.safeParse({
      nome,
      cpf: onlyDigits(cpf),
      email,
      whatsapp: onlyDigits(whatsapp),
    });
    if (!cliente.success) {
      const f = cliente.error.flatten().fieldErrors;
      setErros({
        nome: f.nome?.[0] ?? "",
        cpf: f.cpf?.[0] ?? "",
        email: f.email?.[0] ?? "",
        whatsapp: f.whatsapp?.[0] ?? "",
      });
      return;
    }
    if (tipoEntrega === "delivery" && enderecoStr.trim().length < 6) {
      setErros({ endereco: "Informe o endereço de entrega" });
      return;
    }
    if (tipoEntrega === "delivery" && (foraArea || !atendeAreaEntregaFromTexto(enderecoStr))) {
      setForaArea(true);
      setErros({ endereco: MSG_FORA_AREA });
      toast.error(MSG_FORA_AREA);
      return;
    }
    if (tipoEntrega === "retirada" && !unidadeId) {
      setErros({ unidade: "Selecione a loja de retirada" });
      toast.error("Selecione a loja de retirada");
      return;
    }
    if (!data) {
      setErros({ data: "Selecione a data" });
      toast.error("Selecione a data");
      return;
    }
    if (!horario) {
      setErros({ horario: "Selecione o horário" });
      toast.error("Selecione o horário");
      return;
    }

    let cardData: {
      number: string;
      expiryMonth: string;
      expiryYear: string;
      ccv: string;
      holderName: string;
    } | null = null;
    let holderInfo: {
      postalCode: string;
      addressNumber: string;
      addressComplement?: string;
    } | null = null;

    if (metodo === "CREDIT_CARD") {
      const cartao = CartaoSchema.safeParse({
        holderName: cardName,
        number: onlyDigits(cardNumber),
        expiry: cardExpiry,
        ccv: cardCcv,
      });
      const end = EnderecoSchema.safeParse({
        cep: onlyDigits(cep),
        numero,
        complemento: complemento || undefined,
      });
      if (!cartao.success || !end.success) {
        const cf = cartao.success ? {} : cartao.error.flatten().fieldErrors;
        const ef = end.success ? {} : end.error.flatten().fieldErrors;
        setErros({
          cardName: cf.holderName?.[0] ?? "",
          cardNumber: cf.number?.[0] ?? "",
          cardExpiry: cf.expiry?.[0] ?? "",
          cardCcv: cf.ccv?.[0] ?? "",
          cep: ef.cep?.[0] ?? "",
          numero: ef.numero?.[0] ?? "",
        });
        return;
      }
      const [mm, yyRaw] = cartao.data.expiry.split("/");
      const yyyy = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;
      cardData = {
        holderName: cartao.data.holderName,
        number: cartao.data.number,
        expiryMonth: mm,
        expiryYear: yyyy,
        ccv: cartao.data.ccv,
      };
      holderInfo = {
        postalCode: end.data.cep,
        addressNumber: end.data.numero,
        addressComplement: end.data.complemento,
      };
    }

    setEnviando(true);
    try {
      const linhas = itens.map((it) => ({
        nome: appendTamanhoAoNome(it.nome, it.tamanho),
        quantidade: it.quantidade,
        preco: it.preco,
        ...(it.tamanho ? { tamanho: it.tamanho } : {}),
      }));
      const [primeiro, ...demais] = linhas;

      // 1. cria/atualiza pedido como rascunho (subtotal sem desconto;
      // o /charge revalida cupom server-side e atualiza pedido.total = valorFinal)
      const { id: pedidoId, error: erRasc } = await upsertRascunho(
        {
        cliente: { nome: cliente.data.nome, whatsapp: cliente.data.whatsapp },
        cesta: primeiro
          ? {
              nome: primeiro.nome,
              quantidade: primeiro.quantidade,
              preco: primeiro.preco,
              ...(primeiro.tamanho ? { tamanho: primeiro.tamanho } : {}),
            }
          : undefined,
        sobremesas: demais.map(({ nome, quantidade, preco }) => ({ nome, quantidade, preco })),
        tipo: tipoEntrega,
        enderecoOuUnidade:
          tipoEntrega === "delivery"
            ? enderecoStr
            : (unidades.find((u) => u.id === unidadeId)?.nome ?? "Retirada na loja"),
        unidadeId: tipoEntrega === "retirada" ? unidadeId : undefined,
        data,
        horario,
        pagamento: { metodo: metodo.toLowerCase(), status: "pendente" },
        total,
        },
        undefined,
        campanhaAtiva?.id,
      );
      if (erRasc || !pedidoId) throw erRasc ?? new Error("rascunho falhou");

      // 2. dispara cobrança
      const res = await fetch("/api/public/asaas/charge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...checkoutAccessHeaders(pedidoId),
        },
        body: JSON.stringify({
          pedidoId,
          cliente: {
            nome: cliente.data.nome,
            cpf: cliente.data.cpf,
            email: cliente.data.email,
            whatsapp: cliente.data.whatsapp,
          },
          itens: linhas.map(({ nome, quantidade, preco }) => ({ nome, quantidade, preco })),
          total, // subtotal (sem desconto) — backend revalida cupom e calcula desconto
          metodo,
          cupomCodigo: cupomAplicado?.codigo,
          cartao: cardData ?? undefined,
          holderInfo: holderInfo ?? undefined,
        }),
      });
      const cobranca = await res.json();
      if (!res.ok) {
        toast.error(cobranca?.motivo ?? "Falha no pagamento");
        return;
      }

      linkPagamentoAccess(pedidoId, cobranca.pagamentoId as string);
      clear();
      navigate({
        to: "/sucesso/$id",
        params: { id: cobranca.pagamentoId },
      });
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível finalizar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  const erroLine = (k: string) =>
    erros[k] ? <p className="text-xs text-terracotta">{erros[k]}</p> : null;

  return (
    <div className="min-h-screen bg-linen">
      <ThemeApplier />
      <header className="bg-charcoal">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo variant="light" />
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Continuar comprando
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-[1fr_400px]">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contato */}
          <section className="rounded-2xl bg-white p-6 ring-1 ring-border">
            <h2 className="mb-4 font-serif text-xl font-bold text-charcoal">Contato</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  maxLength={120}
                />
                {erroLine("nome")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  required
                />
                {erroLine("cpf")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wpp">WhatsApp</Label>
                <Input
                  id="wpp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
                  placeholder="(61) 99999-9999"
                  required
                />
                {erroLine("whatsapp")}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={180}
                />
                {erroLine("email")}
              </div>
            </div>
          </section>

          {/* Entrega */}
          <section className="rounded-2xl bg-white p-6 ring-1 ring-border">
            <h2 className="mb-4 font-serif text-xl font-bold text-charcoal">Entrega ou retirada</h2>
            <div className="mb-4 flex gap-2">
              {(["retirada", "delivery"] as const)
                .filter((t) => (t === "retirada" ? podeRetirada : podeDelivery))
                .map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => {
                    setTipoEntrega(t);
                    setData("");
                    setHorario("");
                    if (t !== "retirada") setUnidadeId("");
                  }}
                  className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                    tipoEntrega === t
                      ? "border-terracotta bg-terracotta/10 text-terracotta"
                      : "border-border text-charcoal hover:border-charcoal/40"
                  }`}
                >
                  {t === "retirada" ? "Retirada" : "Entrega"}
                </button>
              ))}
            </div>
            {tipoEntrega === "retirada" && (
              <div className="mb-4 space-y-2">
                <Label>Loja de retirada</Label>
                {unidades.length === 0 ? (
                  <p className="text-xs text-terracotta">Nenhuma loja disponível no momento.</p>
                ) : (
                  <div className="space-y-2">
                    {unidades.map((u) => {
                      const sel = unidadeId === u.id;
                      return (
                        <button
                          type="button"
                          key={u.id}
                          onClick={() => setUnidadeId(u.id)}
                          className={`flex w-full items-center gap-3 rounded-xl border-2 bg-white p-3 text-left transition-all ${
                            sel
                              ? "border-terracotta bg-terracotta/5"
                              : "border-border hover:border-charcoal/40"
                          }`}
                        >
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                              sel ? "bg-terracotta text-white" : "bg-linen text-charcoal"
                            }`}
                          >
                            <MapPin className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-charcoal">{u.nome}</p>
                            {u.endereco ? (
                              <p className="truncate text-xs text-charcoal/60">{u.endereco}</p>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {erroLine("unidade")}
              </div>
            )}
            {tipoEntrega === "delivery" && (
              <div className="space-y-3">
                <p className="rounded-lg bg-linen px-3 py-2 text-xs leading-relaxed text-charcoal/80">
                  {MSG_AREA_ENTREGA}
                </p>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="cep-entrega">CEP</Label>
                    <Input
                      id="cep-entrega"
                      inputMode="numeric"
                      value={cepEntrega}
                      onChange={(e) => {
                        setCepEntrega(maskCep(e.target.value));
                        if (foraArea) setForaArea(false);
                      }}
                      placeholder="00000-000"
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={buscandoCep}
                    onClick={async () => {
                      const limpo = onlyDigits(cepEntrega);
                      if (limpo.length !== 8) {
                        toast.error("CEP inválido");
                        return;
                      }
                      setBuscandoCep(true);
                      const d = await buscarCep(limpo);
                      setBuscandoCep(false);
                      if (!d) {
                        toast.error("CEP não encontrado");
                        return;
                      }
                      const linha = [d.street, d.neighborhood, `${d.city}/${d.state}`]
                        .filter(Boolean)
                        .join(", ");
                      setEnderecoStr(linha);
                      const ok = atendeAreaEntrega({
                        city: d.city,
                        neighborhood: d.neighborhood,
                        street: d.street,
                        state: d.state,
                      });
                      salvarCepEntrega({
                        cep: limpo,
                        neighborhood: d.neighborhood,
                        city: d.city,
                        atende: ok,
                      });
                      setForaArea(!ok);
                      if (!ok) toast.error(MSG_FORA_AREA);
                      else toast.success("Endereço encontrado — área atendida.");
                    }}
                    className="bg-charcoal text-white hover:bg-charcoal/90"
                  >
                    {buscandoCep ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end">Endereço completo</Label>
                  <Input
                    id="end"
                    value={enderecoStr}
                    onChange={(e) => setEnderecoStr(e.target.value)}
                    placeholder="Rua, número, bairro, complemento"
                    maxLength={250}
                    required
                  />
                  {erroLine("endereco")}
                </div>
                {foraArea && (
                  <p className="rounded-lg bg-terracotta/10 px-3 py-2 text-xs text-terracotta">
                    {MSG_FORA_AREA}
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 space-y-3 border-t border-border pt-5">
              <div>
                <Label>Data {tipoEntrega === "retirada" ? "da retirada" : "da entrega"}</Label>
                {todosDias ? (
                  <div className="mt-2 flex justify-center">
                    <Calendar
                      mode="single"
                      selected={data ? parseDatePtBRToDate(data) : undefined}
                      disabled={(day) => {
                        const iso = toISODateString(day);
                        if (iso < hojeISO) return true;
                        return dataRetiradaBloqueada(iso, hojeISO, REGRA_RETIRADA_PADRAO, ctxAntecedencia);
                      }}
                      fromMonth={new Date()}
                      onSelect={(day) => {
                        if (!day) return;
                        const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12);
                        setData(formatDatePtBR(d));
                        setHorario("");
                      }}
                    />
                  </div>
                ) : datasDisponiveis.length === 0 ? (
                  <p className="mt-2 text-xs text-terracotta">Nenhuma data disponível no momento.</p>
                ) : datasDisponiveis.length > 4 ? (
                  (() => {
                    const datasIds = new Set(
                      datasDisponiveis.map((d) => d.id).filter((id) => /^\d{4}-\d{2}-\d{2}$/.test(id)),
                    );
                    const selectedDatum = datasDisponiveis.find((d) => d.label === data);
                    const selectedDate =
                      selectedDatum?.id && /^\d{4}-\d{2}-\d{2}$/.test(selectedDatum.id)
                        ? (() => {
                            const [y, m, day] = selectedDatum.id.split("-").map(Number);
                            return new Date(y, m - 1, day, 12);
                          })()
                        : undefined;
                    return (
                      <div className="mt-2 flex justify-center">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          disabled={(day) => !datasIds.has(toISODateString(day))}
                          onSelect={(day) => {
                            if (!day) return;
                            const iso = toISODateString(day);
                            const found = datasDisponiveis.find((d) => d.id === iso);
                            if (found) {
                              setData(found.label);
                              setHorario("");
                            }
                          }}
                        />
                      </div>
                    );
                  })()
                ) : (
                  <div
                    className={`mt-2 grid gap-2 ${
                      datasDisponiveis.length === 3 ? "grid-cols-3" : "grid-cols-2"
                    }`}
                  >
                    {datasDisponiveis.map((d) => {
                      const sel = data === d.label;
                      const parsed = parseDateId(d.id);
                      const semana = parsed?.semana ?? (d.label.split(",")[0]?.trim() || d.label);
                      const numero = parsed?.dia ?? "•";
                      const mesAno = parsed?.mesAno ?? "";
                      return (
                        <button
                          type="button"
                          key={d.id}
                          onClick={() => {
                            setData(d.label);
                            setHorario("");
                          }}
                          className={`min-h-[68px] rounded-xl border-2 p-3 text-center transition-all ${
                            sel
                              ? "border-terracotta bg-terracotta text-white"
                              : "border-border bg-white text-charcoal hover:border-charcoal/40"
                          }`}
                        >
                          <div className={`font-serif text-2xl font-bold leading-none ${sel ? "text-white" : "text-charcoal"}`}>
                            {numero}
                          </div>
                          <div className={`mt-1 text-xs font-medium ${sel ? "text-white" : "text-charcoal"}`}>
                            {semana}
                          </div>
                          {mesAno ? (
                            <div className={`mt-0.5 text-[10px] ${sel ? "text-white/80" : "text-charcoal/50"}`}>
                              {mesAno}
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
                {erroLine("data")}
              </div>

              {data ? (
                <div>
                  <Label>Horário</Label>
                  {horariosDisponiveis.length === 0 ? (
                    <p className="mt-2 text-xs text-terracotta">Nenhum horário disponível nesta data.</p>
                  ) : (
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {horariosDisponiveis.map((h) => {
                        const sel = horario === h.label;
                        return (
                          <button
                            type="button"
                            key={h.label}
                            onClick={() => setHorario(h.label)}
                            className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2.5 text-xs font-medium transition-all sm:text-sm ${
                              sel
                                ? "border-terracotta bg-terracotta text-white"
                                : "border-border bg-white text-charcoal hover:border-charcoal/40"
                            }`}
                          >
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{h.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {erroLine("horario")}
                </div>
              ) : null}
            </div>
          </section>

          {/* Pagamento */}
          <section className="rounded-2xl bg-white p-6 ring-1 ring-border">
            <h2 className="mb-1 font-serif text-xl font-bold text-charcoal">Pagamento</h2>
            <p className="mb-4 inline-flex items-center gap-1 text-xs text-charcoal/70">
              <Lock className="h-3 w-3" /> Pagamento processado com segurança via Asaas
            </p>

            <div className="mb-4 grid grid-cols-2 gap-2">
              {(["PIX", "CREDIT_CARD"] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMetodo(m)}
                  className={`rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                    metodo === m
                      ? "border-terracotta bg-terracotta/10 text-terracotta"
                      : "border-border text-charcoal hover:border-charcoal/40"
                  }`}
                >
                  {m === "PIX" ? "PIX" : "Cartão de Crédito"}
                </button>
              ))}
            </div>

            {metodo === "PIX" ? (
              <div className="rounded-lg bg-linen p-4 text-sm text-charcoal/80">
                Após confirmar, você verá o QR Code e o código copia-e-cola para pagar. A
                confirmação é automática.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cardName">Nome impresso no cartão</Label>
                  <Input
                    id="cardName"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value.toUpperCase())}
                    maxLength={120}
                  />
                  {erroLine("cardName")}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cardNumber">Número do cartão</Label>
                  <Input
                    id="cardNumber"
                    inputMode="numeric"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(maskCard(e.target.value))}
                    placeholder="0000 0000 0000 0000"
                  />
                  {erroLine("cardNumber")}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cardExpiry">Validade</Label>
                  <Input
                    id="cardExpiry"
                    inputMode="numeric"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(maskExpiry(e.target.value))}
                    placeholder="MM/AA"
                  />
                  {erroLine("cardExpiry")}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cardCcv">CCV</Label>
                  <Input
                    id="cardCcv"
                    inputMode="numeric"
                    value={cardCcv}
                    onChange={(e) => setCardCcv(onlyDigits(e.target.value).slice(0, 4))}
                    placeholder="000"
                  />
                  {erroLine("cardCcv")}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cep">CEP do titular</Label>
                  <Input
                    id="cep"
                    inputMode="numeric"
                    value={cep}
                    onChange={(e) => setCep(maskCep(e.target.value))}
                    placeholder="00000-000"
                  />
                  {erroLine("cep")}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="numero">Número</Label>
                  <Input
                    id="numero"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    maxLength={10}
                  />
                  {erroLine("numero")}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="complemento">Complemento (opcional)</Label>
                  <Input
                    id="complemento"
                    value={complemento}
                    onChange={(e) => setComplemento(e.target.value)}
                    maxLength={80}
                  />
                </div>
              </div>
            )}
          </section>

          <Button
            type="submit"
            disabled={enviando}
            className="w-full bg-terracotta py-6 text-base font-semibold text-white hover:bg-terracotta/90"
          >
            {enviando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando…
              </>
            ) : (
              `Pagar ${formatBRL(totalComDesconto)}`
            )}
          </Button>
        </form>

        <aside className="h-fit space-y-4">
          <div className="rounded-2xl bg-white p-5 ring-1 ring-border">
            <h2 className="mb-3 font-serif text-lg font-bold text-charcoal">Resumo do pedido</h2>
            <ul className="space-y-2 text-sm">
              {itens.map((it) => (
                <li
                  key={`${it.produtoId}::${it.tamanho ?? ""}`}
                  className="flex justify-between gap-3 border-b border-border/60 pb-2"
                >
                  <span className="text-charcoal">
                    {it.nome} × {it.quantidade}
                  </span>
                  <span className="font-semibold text-charcoal">
                    {formatBRL(it.preco * it.quantidade)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between text-charcoal/80">
                <span>Subtotal</span>
                <span>{formatBRL(total)}</span>
              </div>
              {cupomAplicado && (
                <div className="flex justify-between text-emerald-700">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Cupom {cupomAplicado.codigo}
                  </span>
                  <span>−{formatBRL(cupomAplicado.desconto)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 font-serif text-lg font-bold text-charcoal">
                <span>Total</span>
                <span className="text-terracotta">{formatBRL(totalComDesconto)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 ring-1 ring-border">
            <Label className="mb-2 inline-flex items-center gap-1 text-sm">
              <Tag className="h-4 w-4" /> Cupom de desconto
            </Label>
            {cupomAplicado ? (
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-emerald-50 px-2 py-1 text-sm font-semibold text-emerald-700">
                  {cupomAplicado.codigo}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCupomAplicado(null);
                    setCupomInput("");
                  }}
                  className="text-xs text-charcoal/70 underline"
                >
                  Remover
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={cupomInput}
                  onChange={(e) => setCupomInput(e.target.value.toUpperCase())}
                  placeholder="ALMERIA10"
                  maxLength={40}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={validandoCupom || !cupomInput.trim()}
                  onClick={() => aplicarCupom(cupomInput)}
                >
                  {validandoCupom ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
                </Button>
              </div>
            )}
          </div>
        </aside>
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}
