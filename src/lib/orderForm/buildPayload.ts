import { computeExecutionAt } from "@/lib/executionAt";
import {
  buildRegrasForItens,
  resolveProductionSector,
  type CarrinhoItem,
} from "@/lib/availability";
import { appendTamanhoAoNome } from "@/lib/cestaTamanho";
import type { ManualOrderInput, ManualOrderItem } from "./types";

export type PedidoManualPayload = {
  origin: "manual";
  operator_id: string | null;
  cliente_nome: string;
  cliente_whatsapp: string;
  cliente_email: string | null;
  cliente_cpf: string | null;
  cesta: { nome: string; quantidade: number; preco: number; tamanho?: string } | null;
  sobremesas: { nome: string; quantidade: number; preco: number }[];
  tipo: string;
  endereco_ou_unidade: string;
  data_entrega: string | null;
  horario: string | null;
  pagamento: { metodo: string; status: string; observacoes_internas?: string };
  total: number;
  status: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_is_buyer: boolean;
  unidade_id: string | null;
  production_sector: string | null;
  execution_at: string | null;
};

export function calcularTotal(itens: ManualOrderItem[]): number {
  return itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
}

function itemKey(i: Pick<ManualOrderItem, "produto_id" | "tamanho">) {
  return `${i.produto_id}::${i.tamanho ?? ""}`;
}

export { itemKey as manualOrderItemKey };

function toLinhaSalva(i: ManualOrderItem) {
  return {
    nome: appendTamanhoAoNome(i.nome.replace(/\s*[·\-]\s*Tam\.\s*.+$/i, "").trim(), i.tamanho) || i.nome,
    quantidade: i.quantidade,
    preco: i.preco,
    ...(i.tamanho ? { tamanho: i.tamanho } : {}),
  };
}

export function buildPedidoManualPayload(
  input: ManualOrderInput,
  operatorId: string | null,
): PedidoManualPayload {
  const cestaItens = input.itens.filter((i) => i.produto_tipo === "cesta");
  const sobremesaItens = input.itens.filter((i) => i.produto_tipo === "sobremesa");
  const cestaItem = cestaItens[0] ?? null;
  // Demais cestas (ex.: outro sabor/tamanho) vão como linhas extras em sobremesas,
  // para não perder itens no schema atual (1 slot de cesta).
  const extrasComoSobremesa = cestaItens.slice(1).map(toLinhaSalva);

  const itensCarrinho: CarrinhoItem[] = input.itens.map((i) => ({
    produto_id: i.produto_id,
    produto_tipo: i.produto_tipo,
    nome: i.nome,
  }));
  const productionSector = itensCarrinho.length
    ? resolveProductionSector(itensCarrinho, buildRegrasForItens(itensCarrinho))
    : null;

  const emailTrim = input.cliente.email?.trim();
  const cpfTrim = input.cliente.cpf?.trim();

  const cestaSalva = cestaItem ? toLinhaSalva(cestaItem) : null;

  return {
    origin: "manual",
    operator_id: operatorId,
    cliente_nome: input.cliente.nome,
    cliente_whatsapp: input.cliente.whatsapp,
    cliente_email: emailTrim ? emailTrim : null,
    cliente_cpf: cpfTrim ? cpfTrim : null,
    cesta: cestaSalva
      ? {
          nome: cestaSalva.nome,
          quantidade: cestaSalva.quantidade,
          preco: cestaSalva.preco,
          ...(cestaSalva.tamanho ? { tamanho: cestaSalva.tamanho } : {}),
        }
      : null,
    sobremesas: [
      ...sobremesaItens.map((s) => ({
        nome: appendTamanhoAoNome(s.nome.replace(/\s*[·\-]\s*Tam\.\s*.+$/i, "").trim(), s.tamanho) || s.nome,
        quantidade: s.quantidade,
        preco: s.preco,
      })),
      ...extrasComoSobremesa.map(({ nome, quantidade, preco }) => ({ nome, quantidade, preco })),
    ],
    tipo: input.tipo,
    endereco_ou_unidade: input.enderecoOuUnidade,
    data_entrega: input.data ?? null,
    horario: input.horario ?? null,
    pagamento: {
      metodo: "",
      status: "aguardando_pagamento",
      ...(input.observacoes ? { observacoes_internas: input.observacoes } : {}),
    },
    total: calcularTotal(input.itens),
    status: "aguardando_pagamento",
    recipient_name: input.cliente.nome,
    recipient_phone: input.cliente.whatsapp,
    recipient_is_buyer: true,
    unidade_id: input.unidadeId ?? null,
    production_sector: productionSector,
    execution_at: computeExecutionAt(input.data ?? null, input.horario ?? null),
  };
}
