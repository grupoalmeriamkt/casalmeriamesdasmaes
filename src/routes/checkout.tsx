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
import { ArrowLeft, Loader2, CheckCircle2, Tag, Lock } from "lucide-react";
import { useAdmin } from "@/store/admin";
import { fbqTrack, newEventId, sendCapiEvent } from "@/lib/metaPixel";
import { trackBeginCheckout, trackAddPaymentInfo } from "@/lib/gtm";

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
  const firedInitiate = useRef(false);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [tipoEntrega, setTipoEntrega] = useState<"delivery" | "retirada">("retirada");
  const [enderecoStr, setEnderecoStr] = useState("");

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
      void sendCapiEvent({
        pixelId,
        testEventCode,
        eventName: "AddPaymentInfo",
        eventId,
        customData: { value: totalComDesconto, currency: "BRL", payment_type: metodo },
      });
    }
  }, [metodo, totalComDesconto, pixelId, testEventCode]);

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
      const sobremesas = itens.map((it) => ({
        nome: it.nome,
        quantidade: it.quantidade,
        preco: it.preco,
      }));

      // 1. cria/atualiza pedido como rascunho (subtotal sem desconto;
      // o /charge revalida cupom server-side e atualiza pedido.total = valorFinal)
      const { id: pedidoId, error: erRasc } = await upsertRascunho({
        cliente: { nome: cliente.data.nome, whatsapp: cliente.data.whatsapp },
        sobremesas,
        tipo: tipoEntrega,
        enderecoOuUnidade: tipoEntrega === "delivery" ? enderecoStr : "Retirada na loja",
        pagamento: { metodo: metodo.toLowerCase(), status: "pendente" },
        total,
      });
      if (erRasc || !pedidoId) throw erRasc ?? new Error("rascunho falhou");

      // 2. dispara cobrança
      const res = await fetch("/api/public/asaas/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId,
          cliente: {
            nome: cliente.data.nome,
            cpf: cliente.data.cpf,
            email: cliente.data.email,
            whatsapp: cliente.data.whatsapp,
          },
          itens: sobremesas,
          total, // subtotal (sem desconto) — backend revalida cupom e calcula desconto
          metodo,
          cupomCodigo: cupomAplicado?.codigo,
          cartao: cardData ?? undefined,
          holderInfo: holderInfo ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.motivo ?? "Falha no pagamento");
        return;
      }

      clear();
      navigate({
        to: "/sucesso/$id",
        params: { id: data.pagamentoId },
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
            <h2 className="mb-4 font-serif text-xl font-bold text-charcoal">Entrega</h2>
            <div className="mb-4 flex gap-2">
              {(["retirada", "delivery"] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTipoEntrega(t)}
                  className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-semibold capitalize transition-colors ${
                    tipoEntrega === t
                      ? "border-terracotta bg-terracotta/10 text-terracotta"
                      : "border-border text-charcoal hover:border-charcoal/40"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {tipoEntrega === "delivery" && (
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
            )}
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
                  key={it.produtoId}
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
