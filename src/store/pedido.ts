import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Cesta, Sobremesa, EnderecoEntrega, Unidade } from "@/lib/types";

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
  finalizarPedido: () => string;
  reset: () => void;
};

const initial: State = {
  sobremesas: {},
  cliente: { nome: "", whatsapp: "" },
  entregaTipo: null,
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
      finalizarPedido: () => {
        const id = `CA2025${Math.floor(1000 + Math.random() * 9000)}`;
        set({ pedidoId: id });
        return id;
      },
      reset: () => set({ ...initial, pedidoId: undefined }),
    }),
    { name: "casa-almeria-pedido" },
  ),
);

export const selectTotal = (s: State) => {
  const cestaTotal = s.cesta ? s.cesta.cesta.preco * s.cesta.quantidade : 0;
  const sobremesasTotal = Object.values(s.sobremesas).reduce(
    (acc, it) => acc + it.sobremesa.preco * it.quantidade,
    0,
  );
  return cestaTotal + sobremesasTotal;
};

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
