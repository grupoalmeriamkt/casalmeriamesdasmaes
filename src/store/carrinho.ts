import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

export type CarrinhoItem = {
  produtoId: string;
  nome: string;
  preco: number;
  imagem: string;
  quantidade: number;
  tamanho?: string;
};

export function carrinhoLineKey(it: { produtoId: string; tamanho?: string }) {
  return `${it.produtoId}::${it.tamanho ?? ""}`;
}

type State = {
  itens: CarrinhoItem[];
};

type Actions = {
  add: (item: Omit<CarrinhoItem, "quantidade">, quantidade?: number) => void;
  setQtd: (lineKey: string, q: number) => void;
  remove: (lineKey: string) => void;
  clear: () => void;
};

export const useCarrinho = create<State & Actions>()(
  persist(
    (set) => ({
      itens: [],
      add: (item, quantidade = 1) =>
        set((s) => {
          const key = carrinhoLineKey(item);
          const existente = s.itens.find((it) => carrinhoLineKey(it) === key);
          if (existente) {
            return {
              itens: s.itens.map((it) =>
                carrinhoLineKey(it) === key
                  ? { ...it, quantidade: it.quantidade + quantidade }
                  : it,
              ),
            };
          }
          return { itens: [...s.itens, { ...item, quantidade }] };
        }),
      setQtd: (lineKey, q) =>
        set((s) => ({
          itens: s.itens
            .map((it) =>
              carrinhoLineKey(it) === lineKey ? { ...it, quantidade: Math.max(0, q) } : it,
            )
            .filter((it) => it.quantidade > 0),
        })),
      remove: (lineKey) =>
        set((s) => ({ itens: s.itens.filter((it) => carrinhoLineKey(it) !== lineKey) })),
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
