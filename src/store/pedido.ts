import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Cesta, Sobremesa, EnderecoEntrega, Unidade } from "@/lib/types";

export type CartaoExtra = {
  itemId: string;
  nome: string;
  preco: number;
  mensagem: string;
};

export type PolaroidExtra = {
  itemId: string;
  nome: string;
  preco: number;
  arquivoUrl: string;
  arquivoNome: string;
};

export type Extras = {
  cartoes: CartaoExtra[];
  polaroids: PolaroidExtra[];
};

type State = {
  cesta?: { cesta: Cesta; quantidade: number };
  sobremesas: Record<string, { sobremesa: Sobremesa; quantidade: number }>;
  cliente: { nome: string; whatsapp: string };
  entregaTipo: "delivery" | "retirada" | null;
  endereco?: EnderecoEntrega;
  unidade?: Unidade;
  data?: string;
  horario?: string;
  pedidoId?: string;
  extras: Extras;
};

type Actions = {
  setCesta: (cesta: Cesta) => void;
  setQuantidade: (q: number) => void;
  toggleSobremesa: (s: Sobremesa) => void;
  setSobremesaQtd: (id: string, q: number) => void;
  setCliente: (c: { nome: string; whatsapp: string }) => void;
  setEntregaTipo: (t: "delivery" | "retirada") => void;
  setEndereco: (e: EnderecoEntrega) => void;
  setUnidade: (u: Unidade) => void;
  setData: (d: string) => void;
  setHorario: (h: string) => void;
  setPedidoId: (id: string) => void;
  setCartao: (c: CartaoExtra) => void;
  removeCartao: (itemId: string) => void;
  setPolaroid: (p: PolaroidExtra) => void;
  removePolaroid: (itemId: string) => void;
  finalizarPedido: () => string;
  reset: () => void;
};

const initial: State = {
  sobremesas: {},
  cliente: { nome: "", whatsapp: "" },
  entregaTipo: null,
  extras: { cartoes: [], polaroids: [] },
};

export const usePedido = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...initial,
      setCesta: (cesta) => set({ cesta: { cesta, quantidade: 1 } }),
      setQuantidade: (quantidade) => {
        const c = get().cesta;
        if (c) set({ cesta: { ...c, quantidade: Math.max(1, quantidade) } });
      },
      toggleSobremesa: (s) =>
        set((st) => {
          const next = { ...st.sobremesas };
          if (next[s.id]) delete next[s.id];
          else next[s.id] = { sobremesa: s, quantidade: 1 };
          return { sobremesas: next };
        }),
      setSobremesaQtd: (id, q) =>
        set((st) => {
          const next = { ...st.sobremesas };
          if (next[id]) next[id] = { ...next[id], quantidade: Math.max(1, q) };
          return { sobremesas: next };
        }),
      setCliente: (cliente) => set({ cliente }),
      setEntregaTipo: (entregaTipo) => set({ entregaTipo }),
      setEndereco: (endereco) => set({ endereco }),
      setUnidade: (unidade) => set({ unidade }),
      setData: (data) => set({ data }),
      setHorario: (horario) => set({ horario }),
      setPedidoId: (pedidoId) => set({ pedidoId }),
      setCartao: (c) =>
        set((st) => {
          const cartoes = st.extras.cartoes.filter((x) => x.itemId !== c.itemId);
          return { extras: { ...st.extras, cartoes: [...cartoes, c] } };
        }),
      removeCartao: (itemId) =>
        set((st) => ({
          extras: {
            ...st.extras,
            cartoes: st.extras.cartoes.filter((x) => x.itemId !== itemId),
          },
        })),
      setPolaroid: (p) =>
        set((st) => {
          const polaroids = st.extras.polaroids.filter((x) => x.itemId !== p.itemId);
          return { extras: { ...st.extras, polaroids: [...polaroids, p] } };
        }),
      removePolaroid: (itemId) =>
        set((st) => ({
          extras: {
            ...st.extras,
            polaroids: st.extras.polaroids.filter((x) => x.itemId !== itemId),
          },
        })),
      finalizarPedido: () => {
        const id = `CA2025${Math.floor(1000 + Math.random() * 9000)}`;
        set({ pedidoId: id });
        return id;
      },
      reset: () => set({ ...initial, pedidoId: undefined }),
    }),
    {
      name: "casa-almeria-pedido",
      version: 2,
      migrate: (state: any, _v) => {
        if (!state) return state;
        if (!state.extras || typeof state.extras !== "object") {
          state.extras = { cartoes: [], polaroids: [] };
        } else {
          state.extras.cartoes = Array.isArray(state.extras.cartoes)
            ? state.extras.cartoes
            : [];
          state.extras.polaroids = Array.isArray(state.extras.polaroids)
            ? state.extras.polaroids
            : [];
        }
        return state;
      },
    },
  ),
);

export const selectTotal = (s: State) => {
  const cestaTotal = s.cesta ? s.cesta.cesta.preco * s.cesta.quantidade : 0;
  const sobremesasTotal = Object.values(s.sobremesas).reduce(
    (acc, it) => acc + it.sobremesa.preco * it.quantidade,
    0,
  );
  const cartoesTotal = s.extras.cartoes.reduce((a, c) => a + c.preco, 0);
  const polaroidsTotal = s.extras.polaroids.reduce((a, p) => a + p.preco, 0);
  return cestaTotal + sobremesasTotal + cartoesTotal + polaroidsTotal;
};

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
