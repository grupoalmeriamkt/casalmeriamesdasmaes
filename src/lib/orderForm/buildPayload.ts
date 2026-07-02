import { computeExecutionAt } from "@/lib/executionAt";
import {
  buildRegrasForItens,
  resolveProductionSector,
  type CarrinhoItem,
} from "@/lib/availability";
import type { ManualOrderInput, ManualOrderItem } from "./types";

export type PedidoManualPayload = {
  origin: "manual";
  operator_id: string | null;
  cliente_nome: string;
  cliente_whatsapp: string;
  cliente_email: string | null;
  cliente_cpf: string | null;
  cesta: { nome: string; quantidade: number; preco: number } | null;
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

export function buildPedidoManualPayload(
  input: ManualOrderInput,
  operatorId: string | null,
): PedidoManualPayload {
  const cestaItem = input.itens.find((i) => i.produto_tipo === "cesta") ?? null;
  const sobremesaItens = input.itens.filter((i) => i.produto_tipo === "sobremesa");

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

  return {
    origin: "manual",
    operator_id: operatorId,
    cliente_nome: input.cliente.nome,
    cliente_whatsapp: input.cliente.whatsapp,
    cliente_email: emailTrim ? emailTrim : null,
    cliente_cpf: cpfTrim ? cpfTrim : null,
    cesta: cestaItem
      ? { nome: cestaItem.nome, quantidade: cestaItem.quantidade, preco: cestaItem.preco }
      : null,
    sobremesas: sobremesaItens.map((s) => ({
      nome: s.nome, quantidade: s.quantidade, preco: s.preco,
    })),
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
