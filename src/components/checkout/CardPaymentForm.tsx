import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  maskCard,
  maskExpiry,
  maskCpf,
  maskCep,
  onlyDigits,
  submitCardCharge,
  sleep,
  pollStatus,
  type CardChargeResult,
} from "@/lib/checkout/cardCharge";

export type PedidoPublico = {
  id: string;
  status: string;
  cliente_nome: string;
  cliente_whatsapp: string;
  cliente_email: string | null;
  cpf_hint: string | null;
  itens: { nome: string; quantidade: number; preco: number }[];
  total: number;
};

type Erros = Partial<
  Record<"cpf" | "email" | "holderName" | "number" | "expiry" | "ccv" | "cep" | "numero", string>
>;

/**
 * Formulário só-cartão do checkout transparente. Ao enviar, segura "aguarde" ≥4s,
 * cobra via Asaas e chama onSuccess/onError. Faz um poll de fallback se o status
 * não vier final na hora.
 */
export function CardPaymentForm({
  pedido,
  onEnviando,
  onSuccess,
  onError,
}: {
  pedido: PedidoPublico;
  onEnviando: () => void;
  onSuccess: () => void;
  onError: (motivo: string) => void;
}) {
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState(pedido.cliente_email ?? "");
  const [holderName, setHolderName] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [ccv, setCcv] = useState("");
  const [cep, setCep] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);

  const validar = (): boolean => {
    const e: Erros = {};
    if (onlyDigits(cpf).length !== 11) e.cpf = "CPF deve ter 11 dígitos";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = "E-mail inválido";
    if (holderName.trim().length < 2) e.holderName = "Informe o nome no cartão";
    if (onlyDigits(number).length < 13) e.number = "Número do cartão inválido";
    if (!/^\d{2}\/\d{2}$/.test(expiry)) e.expiry = "Use MM/AA";
    if (onlyDigits(ccv).length < 3) e.ccv = "CVV inválido";
    if (onlyDigits(cep).length !== 8) e.cep = "CEP deve ter 8 dígitos";
    if (numero.trim().length < 1) e.numero = "Informe o número";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validar()) return;
    setEnviando(true);
    onEnviando();
    const [res] = await Promise.all([
      submitCardCharge({
        pedidoId: pedido.id,
        cliente: {
          nome: pedido.cliente_nome,
          whatsapp: pedido.cliente_whatsapp,
          cpf,
          email,
        },
        itens: pedido.itens,
        total: pedido.total,
        cartao: { holderName, number, expiry, ccv },
        endereco: { cep, numero, complemento },
      }),
      sleep(4000),
    ] as [Promise<CardChargeResult>, Promise<unknown>]);

    if (!res.ok) {
      setEnviando(false);
      setCcv("");
      onError(res.motivo);
      return;
    }
    const pago = res.status === "CONFIRMED" || res.status === "RECEIVED";
    if (pago) {
      onSuccess();
      return;
    }
    // Status não-final (raro em cartão) — poll de fallback
    const final = await pollStatus(res.pagamentoId, { intervalMs: 3000, maxAttempts: 5 });
    setEnviando(false);
    if (final?.pago) onSuccess();
    else onError("Pagamento em análise. O atendente confirmará em instantes.");
  };

  const inputCls = "bg-white";
  const err = (k: keyof Erros) =>
    erros[k] ? <p className="mt-1 text-xs text-terracotta">{erros[k]}</p> : null;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="cf-cpf">
            Seu CPF {pedido.cpf_hint && <span className="text-charcoal/40">({pedido.cpf_hint})</span>}
          </Label>
          <Input id="cf-cpf" inputMode="numeric" placeholder="000.000.000-00" className={inputCls}
            value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} />
          {err("cpf")}
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="cf-email">E-mail</Label>
          <Input id="cf-email" type="email" placeholder="voce@email.com" className={inputCls}
            value={email} onChange={(e) => setEmail(e.target.value)} />
          {err("email")}
        </div>
      </div>

      <div className="rounded-xl border bg-white/60 p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-charcoal/50">
          <Lock className="h-3 w-3" /> Dados do cartão
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cf-holder">Nome impresso no cartão</Label>
            <Input id="cf-holder" placeholder="NOME COMO NO CARTÃO" className={inputCls}
              value={holderName} onChange={(e) => setHolderName(e.target.value.toUpperCase())} />
            {err("holderName")}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cf-num">Número do cartão</Label>
            <Input id="cf-num" inputMode="numeric" placeholder="0000 0000 0000 0000" className={inputCls}
              value={number} onChange={(e) => setNumber(maskCard(e.target.value))} />
            {err("number")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cf-exp">Validade</Label>
              <Input id="cf-exp" inputMode="numeric" placeholder="MM/AA" className={inputCls}
                value={expiry} onChange={(e) => setExpiry(maskExpiry(e.target.value))} />
              {err("expiry")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cf-ccv">CVV</Label>
              <Input id="cf-ccv" inputMode="numeric" placeholder="123" className={inputCls}
                value={ccv} onChange={(e) => setCcv(onlyDigits(e.target.value).slice(0, 4))} />
              {err("ccv")}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1 flex flex-col gap-1.5">
          <Label htmlFor="cf-cep">CEP</Label>
          <Input id="cf-cep" inputMode="numeric" placeholder="00000-000" className={inputCls}
            value={cep} onChange={(e) => setCep(maskCep(e.target.value))} />
          {err("cep")}
        </div>
        <div className="col-span-1 flex flex-col gap-1.5">
          <Label htmlFor="cf-numero">Número</Label>
          <Input id="cf-numero" inputMode="numeric" placeholder="123" className={inputCls}
            value={numero} onChange={(e) => setNumero(e.target.value)} />
          {err("numero")}
        </div>
        <div className="col-span-1 flex flex-col gap-1.5">
          <Label htmlFor="cf-compl">Compl.</Label>
          <Input id="cf-compl" placeholder="apto" className={inputCls}
            value={complemento} onChange={(e) => setComplemento(e.target.value)} />
        </div>
      </div>

      <Button type="submit" disabled={enviando}
        className="h-12 w-full bg-charcoal text-base text-white hover:bg-charcoal/90">
        {enviando ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando…</>
        ) : (
          <>Pagar {pedido.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</>
        )}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-charcoal/40">
        <Lock className="h-3 w-3" /> Pagamento processado com segurança pela Asaas
      </p>
    </form>
  );
}
