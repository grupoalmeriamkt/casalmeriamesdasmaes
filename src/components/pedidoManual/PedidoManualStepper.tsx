import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useManualOrder, ETAPAS, type Etapa } from "./useManualOrder";
import { LinkPagamentoAcoes } from "./LinkPagamentoAcoes";
import { PixQrCode } from "./PixQrCode";
import { obterOperadorAtual } from "@/lib/operators";
import { criarPedidoManual, gerarLinkPagamento, pagarDinheiro, gerarPix } from "@/lib/pedidos";
import { useCestasAtivas, useSobremesasAtivas, useUnidadesAtivas } from "@/store/admin";
import { calcularTotal } from "@/lib/orderForm/buildPayload";
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
  operador: "Operador responsavel",
  cliente: "Dados do cliente",
  produto: "Produtos",
  entrega: "Entrega ou retirada",
  revisao: "Revisao",
  pagamento: "Pagamento",
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PedidoManualStepper({ onFinalizado }: { onFinalizado: (id: string) => void }) {
  const { etapa, etapaIndex, state, patch, erros, avancar, voltar } = useManualOrder();
  const cestas = useCestasAtivas();
  const sobremesas = useSobremesasAtivas();
  const unidades = useUnidadesAtivas();

  const [criando, setCriando] = useState(false);
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [cpf, setCpf] = useState("");
  const [cpfConfirmado, setCpfConfirmado] = useState("");
  const [gerando, setGerando] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<null | "dinheiro" | "pix" | "cartao">(null);
  const [pagoDinheiro, setPagoDinheiro] = useState(false);
  const [pixResult, setPixResult] = useState<{
    qrImage: string;
    payload: string;
    expiraEm?: string | null;
  } | null>(null);

  // Auto-provisiona o operador logado ao abrir.
  useEffect(() => {
    (async () => {
      const op = await obterOperadorAtual();
      if (op) patch({ operador: op });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = useMemo(() => calcularTotal(state.itens), [state.itens]);

  // Datas/janelas disponiveis a partir das regras dos itens selecionados.
  const { datas, janelas } = useMemo(() => {
    if (state.itens.length === 0) return { datas: [] as string[], janelas: [] as string[] };
    const carrinho: CarrinhoItem[] = state.itens.map((i) => ({
      produto_id: i.produto_id, produto_tipo: i.produto_tipo, nome: i.nome,
    }));
    const regra = regraMaisRestritiva(buildRegrasForItens(carrinho));
    const now = new Date();
    const datas = listAvailableDates(regra, now, 21);
    const janelas = state.data
      ? getAvailableWindows(regra, state.data, now).map((j) => j.label)
      : [];
    return { datas, janelas };
  }, [state.itens, state.data]);

  const setQuantidade = (item: Omit<ManualOrderItem, "quantidade">, qtd: number) => {
    const restantes = state.itens.filter((i) => i.produto_id !== item.produto_id);
    patch({ itens: qtd > 0 ? [...restantes, { ...item, quantidade: qtd }] : restantes });
  };
  const getQtd = (produtoId: string) =>
    state.itens.find((i) => i.produto_id === produtoId)?.quantidade ?? 0;

  const criar = async () => {
    setCriando(true);
    const { operador, ...pedido } = state;
    const res = await criarPedidoManual(pedido);
    setCriando(false);
    if (!res.ok || !res.id) {
      toast.error("Nao foi possivel criar o pedido", { description: res.error });
      return;
    }
    setPedidoId(res.id);
    toast.success("Pedido criado! Gere o link de pagamento.");
  };

  const gerar = async () => {
    if (!pedidoId) return;
    const parsed = cpfParaLinkSchema.safeParse(cpf);
    if (!parsed.success) {
      toast.error("Informe um CPF valido para gerar o link.");
      return;
    }
    setCpfConfirmado(parsed.data);
    setGerando(true);
    if (metodo === "pix") {
      const res = await gerarPix(pedidoId, parsed.data);
      setGerando(false);
      if (!res.ok || !res.qrImage || !res.payload) {
        toast.error("Nao foi possivel gerar o PIX", { description: res.error });
        return;
      }
      setPixResult({ qrImage: res.qrImage, payload: res.payload, expiraEm: res.expiraEm });
      toast.success("PIX gerado!");
      return;
    }
    const res = await gerarLinkPagamento(pedidoId, parsed.data);
    setGerando(false);
    if (!res.ok || !res.invoiceUrl) {
      toast.error("Nao foi possivel gerar o link", { description: res.error });
      return;
    }
    setInvoiceUrl(res.invoiceUrl);
    toast.success("Link de pagamento gerado!");
  };

  const pagarComDinheiro = async () => {
    if (!pedidoId) return;
    setGerando(true);
    const res = await pagarDinheiro(pedidoId);
    setGerando(false);
    if (!res.ok) {
      toast.error("Nao foi possivel registrar o pagamento em dinheiro", { description: res.error });
      return;
    }
    setPagoDinheiro(true);
    toast.success("Pago em dinheiro!");
  };

  const regenerar = async () => {
    if (!pedidoId) return;
    if (!cpfConfirmado) {
      toast.error("CPF nao disponivel. Reinicie o processo de pagamento.");
      return;
    }
    setGerando(true);
    const res = await gerarLinkPagamento(pedidoId, cpfConfirmado);
    setGerando(false);
    if (!res.ok || !res.invoiceUrl) {
      toast.error("Nao foi possivel gerar o link", { description: res.error });
      return;
    }
    setInvoiceUrl(res.invoiceUrl);
    toast.success("Novo link de pagamento gerado!");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Indicador de progresso */}
      <ol className="mb-6 flex flex-wrap gap-2 text-xs">
        {ETAPAS.map((e, i) => (
          <li
            key={e}
            className={`rounded-full px-3 py-1 font-medium ${
              i === etapaIndex
                ? "bg-charcoal text-white"
                : i < etapaIndex
                  ? "bg-olive/15 text-olive"
                  : "bg-linen text-muted-foreground"
            }`}
          >
            {i + 1}. {TITULOS[e]}
          </li>
        ))}
      </ol>

      <h1 className="mb-4 text-xl font-bold text-charcoal">{TITULOS[etapa]}</h1>

      {/* Etapa: Operador */}
      {etapa === "operador" && (
        <div className="rounded-2xl border border-border bg-card p-4">
          {state.operador ? (
            <p className="text-sm text-charcoal">
              Responsavel: <strong>{state.operador.short_name || state.operador.name}</strong>
              <br />
              <span className="text-xs text-muted-foreground">{state.operador.email}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Identificando operador logado...</p>
          )}
        </div>
      )}

      {/* Etapa: Cliente */}
      {etapa === "cliente" && (
        <div className="grid gap-3">
          <Input placeholder="Nome do cliente*" value={state.cliente.nome}
            onChange={(e) => patch({ cliente: { ...state.cliente, nome: e.target.value } })} />
          <Input placeholder="WhatsApp* (DDD + numero)" value={state.cliente.whatsapp}
            onChange={(e) => patch({ cliente: { ...state.cliente, whatsapp: e.target.value } })} />
          <Input placeholder="E-mail (opcional)" value={state.cliente.email ?? ""}
            onChange={(e) => patch({ cliente: { ...state.cliente, email: e.target.value } })} />
          <Input placeholder="CPF (obrigatorio p/ gerar link)" value={state.cliente.cpf ?? ""}
            onChange={(e) => patch({ cliente: { ...state.cliente, cpf: e.target.value } })} />
        </div>
      )}

      {/* Etapa: Produto */}
      {etapa === "produto" && (
        <div className="grid gap-4">
          <div>
            <p className="mb-2 text-sm font-bold text-charcoal">Cestas</p>
            <ul className="grid gap-2">
              {cestas.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2">
                  <span className="min-w-0 truncate text-sm text-charcoal">
                    {c.nome} — {formatBRL(c.preco)}
                  </span>
                  <input type="number" min={0} className="w-16 rounded-md border border-border px-2 py-1 text-sm"
                    value={getQtd(c.id)}
                    onChange={(e) => setQuantidade(
                      { produto_id: c.id, produto_tipo: "cesta", nome: c.nome, preco: c.preco },
                      Math.max(0, Number(e.target.value) || 0),
                    )} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-bold text-charcoal">Sobremesas</p>
            <ul className="grid gap-2">
              {sobremesas.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2">
                  <span className="min-w-0 truncate text-sm text-charcoal">
                    {s.nome} — {formatBRL(s.preco)}
                  </span>
                  <input type="number" min={0} className="w-16 rounded-md border border-border px-2 py-1 text-sm"
                    value={getQtd(s.id)}
                    onChange={(e) => setQuantidade(
                      { produto_id: s.id, produto_tipo: "sobremesa", nome: s.nome, preco: s.preco },
                      Math.max(0, Number(e.target.value) || 0),
                    )} />
                </li>
              ))}
            </ul>
          </div>
          <p className="text-right text-sm font-bold text-charcoal">Total: {formatBRL(total)}</p>
        </div>
      )}

      {/* Etapa: Entrega/Retirada */}
      {etapa === "entrega" && (
        <div className="grid gap-3">
          <div className="flex gap-2">
            <Button variant={state.tipo === "retirada" ? "default" : "outline"} size="sm"
              onClick={() => patch({ tipo: "retirada", enderecoOuUnidade: "" })}>Retirada</Button>
            <Button variant={state.tipo === "delivery" ? "default" : "outline"} size="sm"
              onClick={() => patch({ tipo: "delivery", unidadeId: null })}>Entrega</Button>
          </div>

          {state.tipo === "retirada" ? (
            <select className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={state.unidadeId ?? ""}
              onChange={(e) => {
                const u = unidades.find((x) => x.id === e.target.value);
                patch({ unidadeId: e.target.value || null, enderecoOuUnidade: u?.nome ?? "" });
              }}>
              <option value="">Selecione a unidade</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          ) : (
            <Input placeholder="Endereco completo de entrega" value={state.enderecoOuUnidade}
              onChange={(e) => patch({ enderecoOuUnidade: e.target.value })} />
          )}

          <select className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={state.data ?? ""} onChange={(e) => patch({ data: e.target.value || null, horario: null })}>
            <option value="">Selecione a data</option>
            {datas.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <select className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={state.horario ?? ""} onChange={(e) => patch({ horario: e.target.value || null })}
            disabled={!state.data}>
            <option value="">Selecione o horario</option>
            {janelas.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>

          <Input placeholder="Observacoes (opcional)" value={state.observacoes ?? ""}
            onChange={(e) => patch({ observacoes: e.target.value })} />
        </div>
      )}

      {/* Etapa: Revisao */}
      {etapa === "revisao" && (
        <div className="grid gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-charcoal">
          <p><strong>Operador:</strong> {state.operador?.short_name || state.operador?.name}</p>
          <p><strong>Cliente:</strong> {state.cliente.nome} — {state.cliente.whatsapp}</p>
          <p><strong>Itens:</strong></p>
          <ul className="ml-4 list-disc">
            {state.itens.map((i) => (
              <li key={i.produto_id}>{i.quantidade}x {i.nome} — {formatBRL(i.preco * i.quantidade)}</li>
            ))}
          </ul>
          <p><strong>{state.tipo === "retirada" ? "Retirada" : "Entrega"}:</strong> {state.enderecoOuUnidade}</p>
          <p><strong>Data/Horario:</strong> {state.data} · {state.horario}</p>
          {state.observacoes && <p><strong>Obs.:</strong> {state.observacoes}</p>}
          <p className="text-right text-base font-bold">Total: {formatBRL(total)}</p>
        </div>
      )}

      {/* Etapa: Pagamento */}
      {etapa === "pagamento" && (
        <div className="grid gap-3">
          {!pedidoId ? (
            <Button onClick={criar} disabled={criando}>
              {criando ? "Criando pedido..." : "Confirmar e criar pedido"}
            </Button>
          ) : pagoDinheiro ? (
            <>
              <div className="rounded-2xl border border-border bg-linen/50 p-4">
                <p className="text-sm font-bold text-charcoal">Pedido pago em dinheiro</p>
              </div>
              <Button onClick={() => onFinalizado(pedidoId)}>Concluir</Button>
            </>
          ) : invoiceUrl ? (
            <>
              <LinkPagamentoAcoes
                invoiceUrl={invoiceUrl}
                whatsapp={state.cliente.whatsapp}
                email={state.cliente.email || undefined}
                onGerarNovo={regenerar}
                gerando={gerando}
              />
              <Button onClick={() => onFinalizado(pedidoId)}>Concluir</Button>
            </>
          ) : pixResult ? (
            <>
              <PixQrCode
                qrImage={pixResult.qrImage}
                payload={pixResult.payload}
                expiraEm={pixResult.expiraEm}
              />
              <Button onClick={() => onFinalizado(pedidoId)}>Concluir</Button>
            </>
          ) : metodo === "pix" || metodo === "cartao" ? (
            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground">
                Informe o CPF do cliente para{" "}
                {metodo === "pix" ? "gerar o PIX" : "gerar o link de pagamento"}.
              </p>
              <Input placeholder="CPF do cliente" value={cpf} onChange={(e) => setCpf(e.target.value)} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMetodo(null)}>Voltar</Button>
                <Button onClick={gerar} disabled={gerando}>
                  {gerando
                    ? "Gerando..."
                    : metodo === "pix"
                      ? "Gerar PIX"
                      : "Gerar link de pagamento"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <p className="mb-1 text-sm font-bold text-charcoal">Forma de pagamento</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={pagarComDinheiro} disabled={gerando}>
                  Dinheiro
                </Button>
                <Button variant="outline" onClick={() => setMetodo("pix")}>
                  PIX
                </Button>
                <Button variant="outline" onClick={() => setMetodo("cartao")}>
                  Cartão
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Erros de validacao da etapa atual */}
      {erros.length > 0 && etapa !== "pagamento" && (
        <ul className="mt-3 text-xs text-terracotta">
          {erros.map((e) => <li key={e}>• {e}</li>)}
        </ul>
      )}

      {/* Navegacao */}
      {etapa !== "pagamento" && (
        <div className="mt-6 flex justify-between">
          <Button variant="outline" onClick={voltar} disabled={etapaIndex === 0}>Voltar</Button>
          <Button onClick={avancar} disabled={erros.length > 0}>Avancar</Button>
        </div>
      )}
      {etapa === "pagamento" && !pedidoId && (
        <div className="mt-6 flex justify-start">
          <Button variant="outline" onClick={voltar}>Voltar</Button>
        </div>
      )}
    </div>
  );
}
