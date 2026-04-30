import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Tag, Lock, CheckCircle2, Zap, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePedido, formatBRL, selectTotal } from "@/store/pedido";
import { finalizarPedido } from "@/lib/pedidos";

const onlyDigits = (v: string) => v.replace(/\D/g, "");

const ClienteSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(120),
  cpf: z.string().regex(/^\d{11}$/, "CPF inválido"),
  email: z.string().email("E-mail inválido").max(180),
  whatsapp: z.string().regex(/^\d{10,11}$/, "WhatsApp 10–11 dígitos"),
});
const EnderecoSchema = z.object({
  cep: z.string().regex(/^\d{8}$/, "CEP inválido"),
  numero: z.string().min(1, "Número").max(10),
  complemento: z.string().max(80).optional(),
});
const CartaoSchema = z.object({
  holderName: z.string().min(2, "Nome no cartão"),
  number: z.string().regex(/^\d{13,19}$/, "Número inválido"),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2,4}$/, "MM/AA"),
  ccv: z.string().regex(/^\d{3,4}$/, "CCV"),
});

const maskCard = (v: string) =>
  onlyDigits(v)
    .slice(0, 19)
    .replace(/(.{4})/g, "$1 ")
    .trim();
const maskExpiry = (v: string) => {
  const d = onlyDigits(v).slice(0, 4);
  return d.length < 3 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
};
const maskCpf = (v: string) =>
  onlyDigits(v)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const maskCep = (v: string) =>
  onlyDigits(v)
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2");

type Metodo = "PIX" | "CREDIT_CARD";

type Props = {
  onVoltar: () => void;
  habilitarPix?: boolean;
  habilitarCartao?: boolean;
};

export function CheckoutAsaas({ onVoltar, habilitarPix = true, habilitarCartao = true }: Props) {
  const navigate = useNavigate();
  const pedidoState = usePedido((s) => s);
  const total = usePedido(selectTotal);

  const metodosDisponiveis: Metodo[] = [
    ...(habilitarPix ? (["PIX"] as const) : []),
    ...(habilitarCartao ? (["CREDIT_CARD"] as const) : []),
  ];
  const [metodo, setMetodo] = useState<Metodo>(metodosDisponiveis[0] ?? "PIX");

  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");

  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCcv, setCardCcv] = useState("");
  const [cep, setCep] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");

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
    if (cupomAplicado) void aplicarCupom(cupomAplicado.codigo, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

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

  async function pagar() {
    setErros({});
    const cliente = ClienteSchema.safeParse({
      nome: pedidoState.cliente.nome,
      cpf: onlyDigits(cpf),
      email,
      whatsapp: onlyDigits(pedidoState.cliente.whatsapp),
    });
    if (!cliente.success) {
      const f = cliente.error.flatten().fieldErrors;
      setErros({
        cpf: f.cpf?.[0] ?? "",
        email: f.email?.[0] ?? "",
        nome: f.nome?.[0] ?? "",
        whatsapp: f.whatsapp?.[0] ?? "",
      });
      if (f.nome?.[0] || f.whatsapp?.[0]) {
        toast.error("Volte e revise nome/WhatsApp");
      }
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
      cardData = {
        holderName: cartao.data.holderName,
        number: cartao.data.number,
        expiryMonth: mm,
        expiryYear: yyRaw.length === 2 ? `20${yyRaw}` : yyRaw,
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
      const sobremesas = [
        ...(pedidoState.cesta
          ? [
              {
                nome: pedidoState.cesta.cesta.nome,
                quantidade: pedidoState.cesta.quantidade,
                preco: pedidoState.cesta.cesta.preco,
              },
            ]
          : []),
        ...Object.values(pedidoState.sobremesas).map((s) => ({
          nome: s.sobremesa.nome,
          quantidade: s.quantidade,
          preco: s.sobremesa.preco,
        })),
      ];

      const enderecoOuUnidade =
        pedidoState.entregaTipo === "delivery" && pedidoState.endereco
          ? `${pedidoState.endereco.rua}, ${pedidoState.endereco.numero} — ${pedidoState.endereco.bairro}, ${pedidoState.endereco.cidade}-${pedidoState.endereco.estado}`
          : (pedidoState.unidade?.nome ?? "");

      const { id: pedidoId, error } = await finalizarPedido(
        {
          cliente: pedidoState.cliente,
          cesta: pedidoState.cesta
            ? {
                nome: pedidoState.cesta.cesta.nome,
                quantidade: pedidoState.cesta.quantidade,
                preco: pedidoState.cesta.cesta.preco,
              }
            : undefined,
          sobremesas: Object.values(pedidoState.sobremesas).map((s) => ({
            nome: s.sobremesa.nome,
            quantidade: s.quantidade,
            preco: s.sobremesa.preco,
          })),
          tipo: pedidoState.entregaTipo ?? "",
          enderecoOuUnidade,
          data: pedidoState.data,
          horario: pedidoState.horario,
          pagamento: {
            metodo: metodo.toLowerCase(),
            status: "pendente",
            extras: pedidoState.extras,
          },
          total: totalComDesconto,
        },
        pedidoState.pedidoId,
      );
      if (error || !pedidoId) throw error ?? new Error("Falha ao registrar pedido");

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
          total,
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

      navigate({ to: "/pedido/sucesso/$id", params: { id: data.pagamentoId } });
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível finalizar o pagamento. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  const erroLine = (k: string) =>
    erros[k] ? <p className="mt-1 text-xs text-terracotta">{erros[k]}</p> : null;

  return (
    <section className="animate-fade-up space-y-5">
      <div>
        <p className="eyebrow-gold mb-2">Quase lá!</p>
        <h1 className="font-serif text-3xl font-semibold leading-tight text-charcoal sm:text-[2rem]">
          Seu <em className="italic text-terracotta">pedido</em>
        </h1>
        <p className="mt-2 text-sm text-ink/65">Preencha seus dados e pague com segurança</p>
      </div>

      {/* Resumo */}
      <div className="rounded-2xl bg-white p-4 ring-1 ring-sand/60 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold text-charcoal">Resumo</h3>
        <ul className="space-y-1.5 text-sm">
          {pedidoState.cesta && (
            <li className="flex justify-between">
              <span className="text-charcoal">
                {pedidoState.cesta.cesta.nome} × {pedidoState.cesta.quantidade}
              </span>
              <span className="font-semibold text-charcoal">
                {formatBRL(pedidoState.cesta.cesta.preco * pedidoState.cesta.quantidade)}
              </span>
            </li>
          )}
          {Object.values(pedidoState.sobremesas).map((s) => (
            <li key={s.sobremesa.id} className="flex justify-between">
              <span className="text-charcoal">
                {s.sobremesa.nome} × {s.quantidade}
              </span>
              <span className="font-semibold text-charcoal">
                {formatBRL(s.sobremesa.preco * s.quantidade)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-sand/60 pt-3 text-sm">
          <div className="flex justify-between text-ink/70">
            <span>Subtotal</span>
            <span>{formatBRL(total)}</span>
          </div>
          {cupomAplicado && (
            <div className="flex justify-between text-emerald-700">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> {cupomAplicado.codigo}
              </span>
              <span>−{formatBRL(cupomAplicado.desconto)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-sand/60 pt-2 text-base font-semibold">
            <span className="text-charcoal">Total</span>
            <span className="font-serif text-2xl font-bold text-terracotta">
              {formatBRL(totalComDesconto)}
            </span>
          </div>
        </div>
      </div>

      {/* Cupom */}
      <div className="rounded-2xl bg-white p-4 ring-1 ring-sand/60 sm:p-5">
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

      {/* Dados fiscais */}
      <div className="rounded-2xl bg-white p-4 ring-1 ring-sand/60 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold text-charcoal">Dados para o pagamento</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
            />
            {erroLine("cpf")}
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              maxLength={180}
            />
            {erroLine("email")}
          </div>
        </div>
      </div>

      {/* Pagamento */}
      <div className="rounded-2xl bg-white p-4 ring-1 ring-sand/60 sm:p-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-charcoal">Forma de pagamento</h3>
          <span className="inline-flex items-center gap-1 text-xs text-ink/60">
            <Lock className="h-3 w-3" /> Asaas
          </span>
        </div>

        {metodosDisponiveis.length > 1 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {metodosDisponiveis.map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMetodo(m)}
                className={`flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold transition-colors ${
                  metodo === m ? "bg-charcoal text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {m === "PIX" ? <Zap className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                {m === "PIX" ? "PIX" : "Cartão"}
              </button>
            ))}
          </div>
        )}

        {metodo === "PIX" ? (
          <p className="mt-4 text-sm text-ink/70">
            Após confirmar, mostraremos o QR Code e o código copia-e-cola. A confirmação é
            automática.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="cardName">Nome impresso no cartão</Label>
              <Input
                id="cardName"
                value={cardName}
                onChange={(e) => setCardName(e.target.value.toUpperCase())}
                maxLength={120}
              />
              {erroLine("cardName")}
            </div>
            <div className="sm:col-span-2">
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
            <div>
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
            <div>
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
            <div>
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
            <div>
              <Label htmlFor="numero">Número</Label>
              <Input
                id="numero"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                maxLength={10}
              />
              {erroLine("numero")}
            </div>
            <div className="sm:col-span-2">
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
      </div>

      <Button
        disabled={enviando}
        onClick={pagar}
        className="w-full bg-terracotta py-6 text-base font-semibold text-white hover:bg-terracotta/90"
      >
        {enviando ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando…
          </>
        ) : (
          `Pagar ${formatBRL(totalComDesconto)}`
        )}
      </Button>

      <button
        type="button"
        onClick={onVoltar}
        className="mx-auto block text-xs text-ink/60 hover:text-charcoal"
      >
        ← Voltar
      </button>
    </section>
  );
}
