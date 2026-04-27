export type Cesta = {
  id: string;
  nome: string;
  badge: string;
  preco: number;
  descricao: string;
  itens: string[];
  imagem: string;
};

export type Sobremesa = {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  imagem: string;
};

export type Unidade = {
  id: string;
  nome: string;
  endereco: string;
  lat?: number;
  lng?: number;
};

export type EnderecoEntrega = {
  cep: string;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
};

export type Pedido = {
  id: string;
  cesta?: { cesta: Cesta; quantidade: number };
  sobremesas: { sobremesa: Sobremesa; quantidade: number }[];
  cliente: { nome: string; whatsapp: string };
  entrega: {
    tipo: "delivery" | "retirada" | null;
    endereco?: EnderecoEntrega;
    unidade?: Unidade;
    data?: string;
    horario?: string;
  };
  pagamento?: { metodo: "pix" | "cartao"; status: "pendente" | "aprovado" };
  total: number;
  criadoEm: string;
};
