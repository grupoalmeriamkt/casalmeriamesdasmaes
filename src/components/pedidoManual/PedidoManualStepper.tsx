import { useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { toast } from "sonner";
import { Banknote, QrCode, CreditCard, Check, Loader2, X, ScanLine, Nfc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useManualOrder, ETAPAS, type Etapa } from "./useManualOrder";
import { LinkPagamentoAcoes } from "./LinkPagamentoAcoes";
import { PixQrCode } from "./PixQrCode";
import { CartaoQrDisplay } from "./CartaoQrDisplay";
import {
  criarPedidoManual,
  gerarLinkPagamento,
  pagarDinheiro,
  pagarPos,
  gerarPix,
} from "@/lib/pedidos";
import { useCestasAtivas, useSobremesasAtivas, useUnidadesAtivas } from "@/store/admin";
import { calcularTotal } from "@/lib/orderForm/buildPayload";
import { particionarCestas } from "@/lib/produtoGrupos";
import { buscarCep, formatarEndereco } from "@/lib/cep";
import { montarEnderecoFinal } from "@/lib/enderecoEntrega";
import { cpfParaLinkSchema } from "@/lib/orderForm/schema";
import {
  buildRegrasForItens,
  regraMaisRestritiva,
  listAvailableDates,
  getAvailableWindows,
  type CarrinhoItem,
} from "@/lib/availability";
import type { ManualOrderItem } from "@/lib/orderForm/types";

const TITULOS: Record<Etapa, string> = {
  cliente: "Dados do cliente",
  produto: "Monte o pedido",
  entrega: "Entrega ou retirada",
  revisao: "Revisão",
  pagamento: "Pagamento",
};

const LEGENDAS: Record<Etapa, string> = {
  cliente: "Contato de quem recebe o pedido",
  produto: "Cestas e sobremesas",
  entrega: "Onde e quando entregar",
  revisao: "Confira antes de finalizar",
  pagamento: "Como o cliente vai pagar",
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function PedidoManualStepper({
  onFinalizado,
  onClose,
}: {
  onFinalizado: (id: string) => void;
  onClose?: () => void;
}) {
  const { etapa, etapaIndex, state, patch, erros, avancar, voltar } = useManualOrder();
  const cestas = useCestasAtivas();
  const sobremesas = useSobremesasAtivas();
  const unidades = useUnidadesAtivas();
  const isMobile = useIsMobile();

  const [criando, setCriando] = useState(false);
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [cpf, setCpf] = useState("");
  const [cpfConfirmado, setCpfConfirmado] = useState("");
  const [gerando, setGerando] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<null | "dinheiro" | "pix" | "cartao" | "cartao_qr" | "pos">(null);
  const [pagoDinheiro, setPagoDinheiro] = useState(false);
  const [cartaoQrPago, setCartaoQrPago] = useState(false);
  const [posPago, setPosPago] = useState(false);
  const [posBandeira, setPosBandeira] = useState("Visa");
  const [posTipo, setPosTipo] = useState<"credito" | "debito">("credito");
  const [posCpf, setPosCpf] = useState("");
  const [posNome, setPosNome] = useState("");
  const [pixResult, setPixResult] = useState<{
    qrImage: string;
    payload: string;
    expiraEm?: string | null;
  } | null>(null);

  const stepRef = useRef<HTMLDivElement>(null);

  const total = useMemo(() => calcularTotal(state.itens), [state.itens]);

  const { datas, janelas } = useMemo(() => {
    if (state.itens.length === 0) return { datas: [] as string[], janelas: [] as string[] };
    const carrinho: CarrinhoItem[] = state.itens.map((i) => ({
      produto_id: i.produto_id,
      produto_tipo: i.produto_tipo,
      nome: i.nome,
    }));
    const regra = regraMaisRestritiva(buildRegrasForItens(carrinho));
    const now = new Date();
    const datas = listAvailableDates(regra, now, 21);
    const janelas = state.data
      ? getAvailableWindows(regra, state.data, now).map((j) => j.label)
      : [];
    return { datas, janelas };
  }, [state.itens, state.data]);

  const datasSet = useMemo(() => new Set(datas), [datas]);

  /* GSAP: fade + slide suave a cada troca de etapa */
  useGSAP(
    () => {
      gsap.fromTo(
        stepRef.current,
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" },
      );
      gsap.fromTo(
        ".field-anim",
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.05, ease: "power2.out", delay: 0.05 },
      );
    },
    { dependencies: [etapa] },
  );

  const setQuantidade = (item: Omit<ManualOrderItem, "quantidade">, qtd: number) => {
    const restantes = state.itens.filter((i) => i.produto_id !== item.produto_id);
    patch({ itens: qtd > 0 ? [...restantes, { ...item, quantidade: qtd }] : restantes });
  };
  const getQtd = (produtoId: string) =>
    state.itens.find((i) => i.produto_id === produtoId)?.quantidade ?? 0;

  const [cep, setCep] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [tipoLocal, setTipoLocal] = useState<"casa" | "apartamento">("casa");
  const [numeroUnidade, setNumeroUnidade] = useState("");
  const preencherPorCep = async (valor: string) => {
    const limpo = valor.replace(/\D/g, "");
    if (limpo.length !== 8) return;
    setBuscandoCep(true);
    const end = await buscarCep(limpo);
    setBuscandoCep(false);
    if (!end) {
      toast.error("CEP não encontrado.");
      return;
    }
    patch({ enderecoOuUnidade: formatarEndereco(end) });
    toast.success("Endereço preenchido pelo CEP!");
  };

  const criar = async () => {
    setCriando(true);
    const pedido = state;
    const pedidoFinal =
      pedido.tipo === "delivery"
        ? {
            ...pedido,
            enderecoOuUnidade: montarEnderecoFinal({
              endereco: pedido.enderecoOuUnidade,
              tipoLocal,
              numeroUnidade,
            }),
          }
        : pedido;
    const res = await criarPedidoManual(pedidoFinal);
    setCriando(false);
    if (!res.ok || !res.id) {
      toast.error("Não foi possível criar o pedido", { description: res.error });
      return;
    }
    setPedidoId(res.id);
    toast.success("Pedido criado! Escolha a forma de pagamento.");
  };

  const gerar = async () => {
    if (!pedidoId) return;
    const parsed = cpfParaLinkSchema.safeParse(cpf);
    if (!parsed.success) {
      toast.error("Informe um CPF válido.");
      return;
    }
    setCpfConfirmado(parsed.data);
    setGerando(true);
    if (metodo === "pix") {
      const res = await gerarPix(pedidoId, parsed.data);
      setGerando(false);
      if (!res.ok || !res.qrImage || !res.payload) {
        toast.error("Não foi possível gerar o PIX", { description: res.error });
        return;
      }
      setPixResult({ qrImage: res.qrImage, payload: res.payload, expiraEm: res.expiraEm });
      toast.success("PIX gerado!");
      return;
    }
    const res = await gerarLinkPagamento(pedidoId, parsed.data);
    setGerando(false);
    if (!res.ok || !res.invoiceUrl) {
      toast.error("Não foi possível gerar o link", { description: res.error });
      return;
    }
    setInvoiceUrl(res.invoiceUrl);
    toast.success("Link gerado!");
  };

  const pagarComDinheiro = async () => {
    if (!pedidoId) return;
    setGerando(true);
    const res = await pagarDinheiro(pedidoId);
    setGerando(false);
    if (!res.ok) {
      toast.error("Não foi possível registrar o pagamento", { description: res.error });
      return;
    }
    setPagoDinheiro(true);
    toast.success("Pago em dinheiro!");
  };

  const pagarComPos = async () => {
    if (!pedidoId) return;
    const cpfLimpo = posCpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) {
      toast.error("Informe um CPF válido.");
      return;
    }
    if (posNome.trim().length < 2) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    setGerando(true);
    const res = await pagarPos(pedidoId, { bandeira: posBandeira, tipo: posTipo, cpf: cpfLimpo, nome: posNome.trim() });
    setGerando(false);
    if (!res.ok) {
      toast.error("Não foi possível registrar o pagamento", { description: res.error });
      return;
    }
    setPosPago(true);
    toast.success("Pago na maquininha!");
  };

  const regenerar = async () => {
    if (!pedidoId || !cpfConfirmado) {
      toast.error("CPF não disponível. Reinicie o pagamento.");
      return;
    }
    setGerando(true);
    const res = await gerarLinkPagamento(pedidoId, cpfConfirmado);
    setGerando(false);
    if (!res.ok || !res.invoiceUrl) {
      toast.error("Não foi possível gerar o link", { description: res.error });
      return;
    }
    setInvoiceUrl(res.invoiceUrl);
    toast.success("Novo link gerado!");
  };

  const pagamentoResolvido = pagoDinheiro || cartaoQrPago || posPago || !!invoiceUrl || !!pixResult;
  const mostrarNav = !(etapa === "pagamento" && (pedidoId || pagamentoResolvido));

  const handleAvancar = () => {
    avancar();
  };

  return (
    <div className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col gap-6 overflow-y-auto p-6">
      {/* Topo: título curto + fechar */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-olive">Novo pedido</p>
          <p className="text-sm text-muted-foreground">
            Etapa {etapaIndex + 1} de {ETAPAS.length}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Indicador de etapas segmentado */}
      <div className="flex gap-1.5">
        {ETAPAS.map((e, i) => (
          <div
            key={e}
            className={cn(
              "h-1 flex-1 rounded-full bg-muted transition-colors duration-500",
              i <= etapaIndex && "bg-olive",
            )}
          />
        ))}
      </div>

      {/* Conteúdo da etapa */}
      <div ref={stepRef} className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{TITULOS[etapa]}</h2>
          <p className="text-sm text-muted-foreground">{LEGENDAS[etapa]}</p>
        </div>

        {/* Cliente */}
        {etapa === "cliente" && (
          <div className="flex flex-col gap-4">
            <div className="field-anim flex flex-col gap-1.5">
              <Label htmlFor="pm-nome">Nome do cliente</Label>
              <Input id="pm-nome" placeholder="Maria Silva" value={state.cliente.nome}
                onChange={(e) => patch({ cliente: { ...state.cliente, nome: e.target.value } })} />
            </div>
            <div className="field-anim flex flex-col gap-1.5">
              <Label htmlFor="pm-wpp">WhatsApp</Label>
              <Input id="pm-wpp" placeholder="(61) 99999-8888" value={state.cliente.whatsapp}
                onChange={(e) => patch({ cliente: { ...state.cliente, whatsapp: e.target.value } })} />
            </div>
            <div className="field-anim flex flex-col gap-1.5">
              <Label htmlFor="pm-email">E-mail (opcional)</Label>
              <Input id="pm-email" type="email" placeholder="cliente@email.com" value={state.cliente.email ?? ""}
                onChange={(e) => patch({ cliente: { ...state.cliente, email: e.target.value } })} />
            </div>
            <div className="field-anim flex flex-col gap-1.5">
              <Label htmlFor="pm-cpf">CPF (necessário p/ PIX e cartão)</Label>
              <Input id="pm-cpf" placeholder="000.000.000-00" value={state.cliente.cpf ?? ""}
                onChange={(e) => patch({ cliente: { ...state.cliente, cpf: e.target.value } })} />
            </div>
          </div>
        )}

        {/* Produto */}
        {etapa === "produto" && (
          <div className="flex flex-col gap-4">
            {(() => {
              const { padrao, especiais } = particionarCestas(cestas);
              return (
                <>
                  {padrao.length > 0 && (
                    <ProdutoGrupo titulo="Cestas" itens={padrao} getQtd={getQtd}
                      onQtd={(c, q) => setQuantidade({ produto_id: c.id, produto_tipo: "cesta", nome: c.nome, preco: c.preco }, q)} />
                  )}
                  {especiais.length > 0 && (
                    <ProdutoGrupo titulo="Cestas Especiais / Campanha" itens={especiais} getQtd={getQtd}
                      onQtd={(c, q) => setQuantidade({ produto_id: c.id, produto_tipo: "cesta", nome: c.nome, preco: c.preco }, q)} />
                  )}
                </>
              );
            })()}
            <ProdutoGrupo titulo="Sobremesas" itens={sobremesas} getQtd={getQtd}
              onQtd={(s, q) => setQuantidade({ produto_id: s.id, produto_tipo: "sobremesa", nome: s.nome, preco: s.preco }, q)} />
            <div className="field-anim flex items-center justify-between rounded-lg bg-foreground px-4 py-3 text-background">
              <span className="text-sm opacity-70">Total</span>
              <span className="text-lg font-semibold">{formatBRL(total)}</span>
            </div>
          </div>
        )}

        {/* Entrega/Retirada */}
        {etapa === "entrega" && (
          <div className="flex flex-col gap-4">
            <div className="field-anim grid grid-cols-2 gap-1.5 rounded-lg bg-muted p-1">
              {(["retirada", "delivery"] as const).map((t) => (
                <button key={t}
                  onClick={() => patch(t === "retirada" ? { tipo: "retirada", enderecoOuUnidade: "" } : { tipo: "delivery", unidadeId: null })}
                  className={cn(
                    "rounded-md py-2 text-sm font-medium transition-all",
                    state.tipo === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                  )}>
                  {t === "retirada" ? "Retirada" : "Entrega"}
                </button>
              ))}
            </div>

            {state.tipo === "retirada" ? (
              <div className="field-anim flex flex-col gap-1.5">
                <Label>Unidade de retirada</Label>
                <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-olive/30"
                  value={state.unidadeId ?? ""}
                  onChange={(e) => {
                    const u = unidades.find((x) => x.id === e.target.value);
                    patch({ unidadeId: e.target.value || null, enderecoOuUnidade: u?.nome ?? "" });
                  }}>
                  <option value="">Selecione a unidade</option>
                  {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
            ) : (
              <>
              <div className="field-anim flex flex-col gap-1.5">
                <Label htmlFor="pm-cep">CEP</Label>
                <div className="relative">
                  <Input
                    id="pm-cep"
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={cep}
                    onChange={(e) => {
                      setCep(e.target.value);
                      if (e.target.value.replace(/\D/g, "").length === 8) preencherPorCep(e.target.value);
                    }}
                    onBlur={() => preencherPorCep(cep)}
                  />
                  {buscandoCep && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Digite o CEP e o endereço é preenchido automaticamente.</p>
              </div>
              <div className="field-anim flex flex-col gap-1.5">
                <Label htmlFor="pm-end">Endereço de entrega</Label>
                <Input id="pm-end" placeholder="Rua, número, complemento, bairro…" value={state.enderecoOuUnidade}
                  onChange={(e) => patch({ enderecoOuUnidade: e.target.value })} />
              </div>
              <div className="field-anim grid grid-cols-2 gap-1.5 rounded-lg bg-muted p-1">
                {(["casa", "apartamento"] as const).map((t) => (
                  <button key={t} type="button"
                    onClick={() => setTipoLocal(t)}
                    className={cn(
                      "rounded-md py-2 text-sm font-medium transition-all",
                      tipoLocal === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                    )}>
                    {t === "casa" ? "Casa" : "Apartamento"}
                  </button>
                ))}
              </div>
              <div className="field-anim flex flex-col gap-1.5">
                <Label htmlFor="pm-numero-unidade">Número (do ap ou da casa)</Label>
                <Input id="pm-numero-unidade" placeholder="Ex: 302" value={numeroUnidade}
                  onChange={(e) => setNumeroUnidade(e.target.value)} />
              </div>
              </>
            )}

            <div className="field-anim grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Data</Label>
                {isMobile ? (
                  <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-olive/30"
                    value={state.data ?? ""} onChange={(e) => patch({ data: e.target.value || null, horario: null })}>
                    <option value="">Selecione</option>
                    {datas.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button"
                        className="h-10 w-full rounded-md border bg-background px-3 text-left text-sm outline-none focus:ring-2 focus:ring-olive/30">
                        {state.data ?? "Selecione"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={state.data ? parseIso(state.data) : undefined}
                        onSelect={(d) => d && patch({ data: toIso(d), horario: null })}
                        disabled={(day) => !datasSet.has(toIso(day))}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Horário</Label>
                <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-olive/30 disabled:opacity-50"
                  value={state.horario ?? ""} onChange={(e) => patch({ horario: e.target.value || null })} disabled={!state.data}>
                  <option value="">Selecione</option>
                  {janelas.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>

            <div className="field-anim flex flex-col gap-1.5">
              <Label htmlFor="pm-obs">Observações (opcional)</Label>
              <Input id="pm-obs" placeholder="Mensagem, ponto de referência…" value={state.observacoes ?? ""}
                onChange={(e) => patch({ observacoes: e.target.value })} />
            </div>
          </div>
        )}

        {/* Revisão */}
        {etapa === "revisao" && (
          <div className="field-anim overflow-hidden rounded-lg border">
            <Linha rot="Cliente" val={`${state.cliente.nome} · ${state.cliente.whatsapp}`} />
            <div className="border-b px-4 py-2.5">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Itens</p>
              {state.itens.map((i) => (
                <div key={i.produto_id} className="flex justify-between text-sm">
                  <span>{i.quantidade}× {i.nome}</span>
                  <span>{formatBRL(i.preco * i.quantidade)}</span>
                </div>
              ))}
            </div>
            <Linha
              rot={state.tipo === "retirada" ? "Retirada" : "Entrega"}
              val={
                state.tipo === "delivery"
                  ? montarEnderecoFinal({
                      endereco: state.enderecoOuUnidade,
                      tipoLocal,
                      numeroUnidade,
                    })
                  : state.enderecoOuUnidade
              }
            />
            <Linha rot="Data / horário" val={`${state.data ?? "—"} · ${state.horario ?? "—"}`} />
            {state.observacoes && <Linha rot="Observações" val={state.observacoes} />}
            <div className="flex items-center justify-between bg-foreground px-4 py-3 text-background">
              <span className="text-sm opacity-70">Total</span>
              <span className="text-lg font-semibold">{formatBRL(total)}</span>
            </div>
          </div>
        )}

        {/* Pagamento */}
        {etapa === "pagamento" && (
          <div className="field-anim flex flex-col gap-3">
            {!pedidoId ? (
              <Button className="w-full" onClick={criar} disabled={criando}>
                {criando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando pedido…</> : "Confirmar e criar pedido"}
              </Button>
            ) : pagoDinheiro ? (
              <ResultadoOk titulo="Pago em dinheiro" desc="Pedido registrado como pago." onConcluir={() => onFinalizado(pedidoId)} />
            ) : cartaoQrPago ? (
              <ResultadoOk titulo="Pago no cartão!" desc="Pagamento confirmado pelo cliente." onConcluir={() => onFinalizado(pedidoId)} />
            ) : posPago ? (
              <ResultadoOk titulo="Pago na maquininha!" desc={`${posBandeira} · ${posTipo === "credito" ? "Crédito" : "Débito"}`} onConcluir={() => onFinalizado(pedidoId)} />
            ) : pixResult ? (
              <>
                <PixQrCode qrImage={pixResult.qrImage} payload={pixResult.payload} expiraEm={pixResult.expiraEm} />
                <Button className="w-full" onClick={() => onFinalizado(pedidoId)}>Concluir</Button>
              </>
            ) : invoiceUrl ? (
              <>
                <LinkPagamentoAcoes invoiceUrl={invoiceUrl} whatsapp={state.cliente.whatsapp}
                  email={state.cliente.email || undefined} onGerarNovo={regenerar} gerando={gerando} />
                <Button className="w-full" onClick={() => onFinalizado(pedidoId)}>Concluir</Button>
              </>
            ) : metodo === "cartao_qr" ? (
              <CartaoQrDisplay
                pedidoId={pedidoId}
                onPago={() => setCartaoQrPago(true)}
              />
            ) : metodo === "pix" || metodo === "cartao" ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Confirme o CPF do cliente para {metodo === "pix" ? "gerar o QR do PIX" : "gerar o link do cartão"}.
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pm-cpf2">Confirme o CPF, por favor</Label>
                  <Input id="pm-cpf2" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} />
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setMetodo(null)}>Voltar</Button>
                  <Button onClick={gerar} disabled={gerando}>
                    {gerando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando…</> : metodo === "pix" ? "Gerar PIX" : "Gerar link"}
                  </Button>
                </div>
              </div>
            ) : metodo === "pos" ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Preencha os dados da transação na maquininha.
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pm-pos-bandeira">Bandeira</Label>
                  <select
                    id="pm-pos-bandeira"
                    className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-olive/30"
                    value={posBandeira}
                    onChange={(e) => setPosBandeira(e.target.value)}
                  >
                    {["Visa", "Mastercard", "Elo", "Amex", "Hipercard", "Outra"].map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-muted p-1">
                  {(["credito", "debito"] as const).map((t) => (
                    <button key={t} type="button"
                      onClick={() => setPosTipo(t)}
                      className={cn(
                        "rounded-md py-2 text-sm font-medium transition-all",
                        posTipo === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                      )}>
                      {t === "credito" ? "Crédito" : "Débito"}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pm-pos-cpf">CPF do cliente</Label>
                  <Input id="pm-pos-cpf" placeholder="000.000.000-00" value={posCpf} onChange={(e) => setPosCpf(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pm-pos-nome">Nome do cliente</Label>
                  <Input id="pm-pos-nome" placeholder="Maria Silva" value={posNome} onChange={(e) => setPosNome(e.target.value)} />
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setMetodo(null)}>Voltar</Button>
                  <Button onClick={pagarComPos} disabled={gerando}>
                    {gerando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirmando…</> : "Confirmar pagamento na maquininha"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <MetodoCard icon={<Banknote className="h-5 w-5" />} titulo="Dinheiro" desc="Pago presencialmente, agora" onClick={pagarComDinheiro} disabled={gerando} />
                <MetodoCard icon={<QrCode className="h-5 w-5" />} titulo="PIX" desc="Gera o QR Code na hora" onClick={() => { setCpf(state.cliente.cpf ?? ""); setMetodo("pix"); }} />
                <MetodoCard icon={<CreditCard className="h-5 w-5" />} titulo="Cartão" desc="Link p/ WhatsApp / e-mail" onClick={() => { setCpf(state.cliente.cpf ?? ""); setMetodo("cartao"); }} />
                <MetodoCard icon={<ScanLine className="h-5 w-5" />} titulo="Cartão via QR" desc="Cliente escaneia e digita o cartão" onClick={() => setMetodo("cartao_qr")} />
                <MetodoCard icon={<Nfc className="h-5 w-5" />} titulo="POS (maquininha)" desc="Cielo — nasce pago na hora" onClick={() => { setPosCpf(state.cliente.cpf ?? ""); setPosNome(state.cliente.nome ?? ""); setMetodo("pos"); }} />
              </div>
            )}
          </div>
        )}

        {erros.length > 0 && etapa !== "pagamento" && (
          <ul className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {erros.map((e) => <li key={e}>• {e}</li>)}
          </ul>
        )}
      </div>

      {/* Navegação Voltar / Avançar */}
      {mostrarNav && (
        <div className="flex justify-between">
          <Button variant="outline" onClick={voltar} disabled={etapaIndex === 0}>
            Voltar
          </Button>
          {etapa !== "pagamento" && (
            <Button onClick={handleAvancar} disabled={erros.length > 0}>
              Avançar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Subcomponentes ---------- */

function ProdutoGrupo<T extends { id: string; nome: string; preco: number }>({
  titulo, itens, getQtd, onQtd,
}: {
  titulo: string;
  itens: T[];
  getQtd: (id: string) => number;
  onQtd: (item: T, qtd: number) => void;
}) {
  if (!itens.length) return null;
  return (
    <div className="field-anim flex flex-col gap-2">
      <Label>{titulo}</Label>
      <ul className="flex flex-col gap-2">
        {itens.map((it) => {
          const q = getQtd(it.id);
          return (
            <li key={it.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors",
                q > 0 ? "border-olive/40 bg-olive/5" : "bg-background",
              )}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{it.nome}</p>
                <p className="text-xs text-muted-foreground">{formatBRL(it.preco)}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => onQtd(it, Math.max(0, q - 1))} disabled={q === 0}
                  className="grid h-7 w-7 place-items-center rounded-full border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30">
                  −
                </button>
                <span className="w-5 text-center text-sm font-semibold">{q}</span>
                <button onClick={() => onQtd(it, q + 1)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-foreground text-background transition-transform hover:scale-105">
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Linha({ rot, val }: { rot: string; val: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b px-4 py-2.5 last:border-0">
      <span className="text-xs font-medium text-muted-foreground">{rot}</span>
      <span className="text-right text-sm">{val}</span>
    </div>
  );
}

function MetodoCard({
  icon, titulo, desc, onClick, disabled,
}: {
  icon: React.ReactNode;
  titulo: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="group flex items-center gap-3 rounded-lg border bg-background p-3 text-left transition-all hover:border-olive/50 hover:bg-muted/40 disabled:opacity-60">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-muted text-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}

function ResultadoOk({ titulo, desc, onConcluir }: { titulo: string; desc: string; onConcluir: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-olive/30 bg-olive/5 p-6 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-olive text-white">
        <Check className="h-6 w-6" />
      </div>
      <div>
        <p className="font-semibold">{titulo}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      <Button className="w-full" onClick={onConcluir}>Concluir</Button>
    </div>
  );
}
