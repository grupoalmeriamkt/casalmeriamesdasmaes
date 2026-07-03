import { useState } from "react";
import type { ManualOrderInput } from "@/lib/orderForm/types";
import type { Operator } from "@/lib/operators";

export type ManualOrderState = ManualOrderInput & { operador: Operator | null };

export const ETAPAS = ["operador", "cliente", "produto", "entrega", "revisao", "pagamento"] as const;
export type Etapa = (typeof ETAPAS)[number];

export const estadoInicial: ManualOrderState = {
  operador: null,
  cliente: { nome: "", whatsapp: "", email: "", cpf: "" },
  itens: [],
  tipo: "retirada",
  enderecoOuUnidade: "",
  unidadeId: null,
  data: null,
  horario: null,
  observacoes: "",
};

/** Validacao pura por etapa — retorna lista de erros (vazia = pode avancar). */
export function validarEtapa(etapa: Etapa, s: ManualOrderState): string[] {
  const erros: string[] = [];
  // Operador responsável é opcional — sem trava para avançar.
  if (etapa === "cliente") {
    if (s.cliente.nome.trim().length < 3) erros.push("Informe o nome do cliente.");
    if (s.cliente.whatsapp.replace(/\D/g, "").length < 10) erros.push("Informe um WhatsApp valido.");
  }
  if (etapa === "produto" && s.itens.length === 0) {
    erros.push("Selecione ao menos um produto.");
  }
  if (etapa === "entrega") {
    if (s.tipo === "retirada" && !s.unidadeId) erros.push("Selecione a unidade de retirada.");
    if (s.tipo === "delivery" && s.enderecoOuUnidade.trim().length === 0) {
      erros.push("Informe o endereco de entrega.");
    }
    if (!s.data) erros.push("Selecione a data.");
    if (!s.horario) erros.push("Selecione o horario.");
  }
  return erros;
}

export function useManualOrder() {
  const [etapaIndex, setEtapaIndex] = useState(0);
  const [state, setState] = useState<ManualOrderState>(estadoInicial);
  const etapa = ETAPAS[etapaIndex];

  const patch = (p: Partial<ManualOrderState>) => setState((s) => ({ ...s, ...p }));
  const erros = validarEtapa(etapa, state);
  const avancar = () => {
    if (erros.length === 0 && etapaIndex < ETAPAS.length - 1) setEtapaIndex((i) => i + 1);
  };
  const voltar = () => setEtapaIndex((i) => Math.max(0, i - 1));

  return { etapa, etapaIndex, state, patch, erros, avancar, voltar, setEtapaIndex };
}
