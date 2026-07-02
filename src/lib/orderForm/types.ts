export type ManualOrderItem = {
  produto_id: string;
  produto_tipo: "cesta" | "sobremesa";
  nome: string;
  preco: number;
  quantidade: number;
};

export type ManualOrderInput = {
  cliente: { nome: string; whatsapp: string; email?: string; cpf?: string };
  itens: ManualOrderItem[];
  tipo: "delivery" | "retirada";
  enderecoOuUnidade: string;
  unidadeId?: string | null;
  data?: string | null;
  horario?: string | null;
  observacoes?: string;
};
