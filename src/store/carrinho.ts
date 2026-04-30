import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

export type CarrinhoItem = {
  produtoId: string;
  nome: string;
  preco: number;
  imagem: string;
  quantidade: number;
};

type State = {
  itens: CarrinhoItem[];
};

type Actions = {
  add: (item: Omit<CarrinhoItem, "quantidade">, quantidade?: number) => void;
  setQtd: (produtoId: string, q: number) => void;
  remove: (produtoId: string) => void;
  clear: () => void;
};

export const useCarrinho = create<State & Actions>()(
  persist(
    (set) => ({
      itens: [],
      add: (item, quantidade = 1) =>
        set((s) => {
          const existente = s.itens.find((it) => it.produtoId === item.produtoId);
          if (existente) {
            return {
              itens: s.itens.map((it) =>
                it.produtoId === item.produtoId
                  ? { ...it, quantidade: it.quantidade + quantidade }
                  : it,
              ),
            };
          }
          return { itens: [...s.itens, { ...item, quantidade }] };
        }),
      setQtd: (produtoId, q) =>
        set((s) => ({
          itens: s.itens
            .map((it) =>
              it.produtoId === produtoId ? { ...it, quantidade: Math.max(1, q) } : it,
            )
            .filter((it) => it.quantidade > 0),
        })),
      remove: (produtoId) =>
        set((s) => ({ itens: s.itens.filter((it) => it.produtoId !== produtoId) })),
      clear: () => set({ itens: [] }),
    }),
    { name: "casa-almeria-carrinho" },
  ),
);

export const useCarrinhoTotal = () =>
  useCarrinho(
    useShallow((s) => ({
      qtdItens: s.itens.reduce((acc, it) => acc + it.quantidade, 0),
      total: s.itens.reduce((acc, it) => acc + it.preco * it.quantidade, 0),
    })),
  );
