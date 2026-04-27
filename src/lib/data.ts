import type { Cesta, Sobremesa, Unidade } from "./types";

// Imagens Unsplash (café da manhã, cestas artesanais)
export const CESTAS: Cesta[] = [
  {
    id: "aconchego",
    nome: "Cesta Aconchego — Dia das Mães",
    badge: "Para 2 pessoas",
    preco: 255,
    descricao:
      "Um café da manhã afetuoso com pães artesanais, frios, doces e uma sobremesa especial em homenagem ao Dia das Mães.",
    imagem:
      "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=1400&q=80",
    itens: [
      "2x Drip coffee",
      "1x Salada de fruta com iogurte e granola",
      "2x Suco de laranja natural",
      "1x Porção de 4 pães de queijo",
      "1x Croissant",
      "1x Potinho de geleia de frutas vermelhas",
      "1x Potinho de requeijão",
      "1x Panini de focaccia de presunto royal e queijo",
      "1x Supreme especial Dia das Mães com geleia de frutas vermelhas",
      "1x Cookies",
      "1x Bolo de cenoura com calda e mini brigadeiro",
      "1x Petit four goiabinha em formato de coração (2 unidades)",
    ],
  },
  {
    id: "cafe-carinho",
    nome: "Cesta Café & Carinho — Dia das Mães",
    badge: "Para 4 pessoas",
    preco: 365,
    descricao:
      "Para reunir a família toda. Pães, frios, frutas, doces e duas sobremesas exclusivas para celebrar o dia dela.",
    imagem:
      "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=1400&q=80",
    itens: [
      "2x Drip coffee",
      "Uva Thompson",
      "1x Salada de fruta com iogurte e granola",
      "2x Suco de laranja natural",
      "6x Pães de queijo",
      "1x Cesta de pães (mini baguete, croissant e pedaço de focaccia)",
      "Presunto fatiado",
      "Queijo minas padrão fatiado",
      "1x Potinho de geleia de frutas vermelhas",
      "1x Potinho de requeijão",
      "1x Manteiga de ervas",
      "1x Croque Monsieur (metade)",
      "1x Sanduíche caprese no pão baguete",
      "1x Supreme especial Dia das Mães com geleia de frutas vermelhas",
      "1x Bolo mármore de pistache com brigadeiros",
      "1x Petit four goiabinha em formato de coração (2 unidades)",
      "1x Banoffee no pote",
    ],
  },
];

// TODO: preencher preço/descrição reais no painel admin
export const SOBREMESAS: Sobremesa[] = [
  {
    id: "travessa-morango",
    nome: "Travessa de Morango",
    descricao: "Camadas cremosas com morangos frescos.",
    preco: 65,
    imagem:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "cheesecake",
    nome: "Cheesecake",
    descricao: "Clássico com calda de frutas vermelhas.",
    preco: 58,
    imagem:
      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "mousse",
    nome: "Mousse",
    descricao: "Mousse aerada e levemente adocicada.",
    preco: 42,
    imagem:
      "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "banoffee",
    nome: "Banoffee",
    descricao: "Banana, doce de leite e chantilly.",
    preco: 52,
    imagem:
      "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80",
  },
];

// TODO: endereços reais no painel admin
export const UNIDADES: Unidade[] = [
  { id: "asa-sul", nome: "Asa Sul", endereco: "SCLS — Asa Sul, Brasília-DF" },
  { id: "noroeste", nome: "Noroeste", endereco: "CLNW — Noroeste, Brasília-DF" },
];

export const DATAS_ENTREGA = [
  { id: "10-05", label: "Sábado, 10 de maio de 2025" },
  { id: "11-05", label: "Domingo, 11 de maio de 2025" },
];

export const HORARIOS = [
  "Entre 06h e 07h",
  "Entre 07h e 08h",
  "Entre 08h e 09h",
  "Entre 09h e 10h",
];
