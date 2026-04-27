import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { CESTAS, SOBREMESAS, UNIDADES, DATAS_ENTREGA, HORARIOS } from "@/lib/data";
import type { Cesta, Sobremesa, Unidade } from "@/lib/types";

export type Tema = {
  primary: string; // hex
  accent: string; // hex
  background: string; // hex
  modo: "claro" | "escuro";
  logoUrl?: string;
};

export type Textos = {
  heroTitulo: string;
  heroSubtitulo: string;
  badgePrazo: string;
  ctaPrincipal: string;
  taglineFooter: string;
  whatsapp: string;
  msgConfirmacao: string;
};

export type EntregaConfig = {
  delivery: boolean;
  retirada: boolean;
  unidades: (Unidade & { ativa: boolean })[];
  datas: { id: string; label: string; ativa: boolean }[];
  horarios: { label: string; ativo: boolean }[];
  restricaoRaio: {
    ativo: boolean;
    unidadeBaseId: string; // id da unidade que serve como centro
    raioKm: number;
  };
};

export type Pagamento = {
  checkoutAtivo: boolean;
  mpPublicKey: string;
  mpAccessToken: string;
  pix: boolean;
  cartao: boolean;
  parcelasMax: number;
};

export type Integracoes = {
  webhookUrl: string;
  dispararPagamento: boolean;
  dispararAbandono: boolean;
  minutosAbandono: number;
  instagramUrl: string;
  whatsappUrl: string;
  gtmId: string;
  metaPixelId: string;
  metaAccessToken: string;
  metaTestEventCode: string;
};

export type ConfigGeral = {
  ativa: boolean;
  msgManutencao: string;
  encerramento: string; // ISO date
  mostrarUpsell: boolean;
  mostrarInformacoes: boolean;
};

export type PedidoSalvo = {
  id: string;
  criadoEm: string;
  cliente: { nome: string; whatsapp: string };
  cesta?: { nome: string; quantidade: number; preco: number };
  sobremesas: { nome: string; quantidade: number; preco: number }[];
  tipo: string;
  enderecoOuUnidade: string;
  data?: string;
  horario?: string;
  pagamento: { metodo: string; status: string };
  total: number;
};

type AdminState = {
  tema: Tema;
  textos: Textos;
  cestas: (Cesta & { ativo: boolean })[];
  sobremesas: (Sobremesa & { ativo: boolean })[];
  entrega: EntregaConfig;
  pagamento: Pagamento;
  integracoes: Integracoes;
  geral: ConfigGeral;
  pedidos: PedidoSalvo[];

  setTema: (t: Partial<Tema>) => void;
  setTextos: (t: Partial<Textos>) => void;
  setCesta: (id: string, patch: Partial<Cesta & { ativo: boolean }>) => void;
  addCesta: () => void;
  removeCesta: (id: string) => void;
  setSobremesa: (id: string, patch: Partial<Sobremesa & { ativo: boolean }>) => void;
  addSobremesa: () => void;
  removeSobremesa: (id: string) => void;
  setEntrega: (patch: Partial<EntregaConfig>) => void;
  setPagamento: (patch: Partial<Pagamento>) => void;
  setIntegracoes: (patch: Partial<Integracoes>) => void;
  setGeral: (patch: Partial<ConfigGeral>) => void;
  registrarPedido: (p: PedidoSalvo) => void;
  limparPedidos: () => void;
  resetTudo: () => void;
};

const initial = {
  tema: {
    primary: "#1B2A4A",
    accent: "#D4A855",
    background: "#FAF6EF",
    modo: "claro" as const,
  },
  textos: {
    heroTitulo: "Presenteie sua mãe com um café da manhã inesquecível",
    heroSubtitulo: "Cestas artesanais com entrega ou retirada em Brasília",
    badgePrazo: "Encomendas encerram quinta-feira, 07 de maio",
    ctaPrincipal: "MONTAR MEU PEDIDO",
    taglineFooter: "pra alimentar corpo e alma",
    whatsapp: "5561999999999",
    msgConfirmacao:
      "Em breve entraremos em contato pelo WhatsApp para confirmar todos os detalhes.",
  },
  cestas: CESTAS.map((c) => ({ ...c, ativo: true })),
  sobremesas: SOBREMESAS.map((s) => ({ ...s, ativo: true })),
  entrega: {
    delivery: true,
    retirada: true,
    unidades: UNIDADES.map((u) => ({ ...u, ativa: true })),
    datas: DATAS_ENTREGA.map((d) => ({ ...d, ativa: true })),
    horarios: HORARIOS.map((h) => ({ label: h, ativo: true })),
    restricaoRaio: {
      ativo: false,
      unidadeBaseId: UNIDADES[0]?.id ?? "",
      raioKm: 10,
    },
  },
  pagamento: {
    checkoutAtivo: false,
    mpPublicKey: "",
    mpAccessToken: "",
    pix: true,
    cartao: true,
    parcelasMax: 3,
  },
  integracoes: {
    webhookUrl: "",
    dispararPagamento: true,
    dispararAbandono: true,
    minutosAbandono: 10,
    instagramUrl: "https://instagram.com",
    whatsappUrl: "https://wa.me/5561999999999",
    gtmId: "",
    metaPixelId: "",
    metaAccessToken: "",
    metaTestEventCode: "",
  },
  geral: {
    ativa: true,
    msgManutencao:
      "Estamos preparando algo especial. Volte em breve.",
    encerramento: "2026-05-08",
    mostrarUpsell: true,
    mostrarInformacoes: true,
  },
};

export const useAdmin = create<AdminState>()(
  persist(
    (set) => ({
      ...initial,
      pedidos: [],


      setTema: (t) => set((s) => ({ tema: { ...s.tema, ...t } })),
      setTextos: (t) => set((s) => ({ textos: { ...s.textos, ...t } })),

      setCesta: (id, patch) =>
        set((s) => ({
          cestas: s.cestas.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      addCesta: () =>
        set((s) => ({
          cestas: [
            ...s.cestas,
            {
              id: `cesta-${Date.now()}`,
              nome: "Nova cesta",
              badge: "Para X pessoas",
              preco: 0,
              descricao: "",
              itens: [],
              imagem:
                "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=1400&q=80",
              ativo: true,
            },
          ],
        })),
      removeCesta: (id) =>
        set((s) => ({ cestas: s.cestas.filter((c) => c.id !== id) })),

      setSobremesa: (id, patch) =>
        set((s) => ({
          sobremesas: s.sobremesas.map((sb) =>
            sb.id === id ? { ...sb, ...patch } : sb,
          ),
        })),
      addSobremesa: () =>
        set((s) => ({
          sobremesas: [
            ...s.sobremesas,
            {
              id: `sobremesa-${Date.now()}`,
              nome: "Nova sobremesa",
              descricao: "",
              preco: 0,
              imagem:
                "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80",
              ativo: true,
            },
          ],
        })),
      removeSobremesa: (id) =>
        set((s) => ({ sobremesas: s.sobremesas.filter((sb) => sb.id !== id) })),

      setEntrega: (patch) => set((s) => ({ entrega: { ...s.entrega, ...patch } })),
      setPagamento: (patch) =>
        set((s) => ({ pagamento: { ...s.pagamento, ...patch } })),
      setIntegracoes: (patch) =>
        set((s) => ({ integracoes: { ...s.integracoes, ...patch } })),
      setGeral: (patch) => set((s) => ({ geral: { ...s.geral, ...patch } })),

      registrarPedido: (p) =>
        set((s) => ({ pedidos: [p, ...s.pedidos].slice(0, 500) })),
      limparPedidos: () => set({ pedidos: [] }),

      resetTudo: () => set({ ...initial, pedidos: [] }),
    }),
    {
      name: "casa-almeria-admin",
      version: 4,
      partialize: (s) => ({
        tema: s.tema,
        textos: s.textos,
        cestas: s.cestas,
        sobremesas: s.sobremesas,
        entrega: s.entrega,
        pagamento: s.pagamento,
        integracoes: s.integracoes,
        geral: s.geral,
        pedidos: s.pedidos,
      }),
      // Heal corrupted/empty persisted state by falling back to current defaults.
      migrate: (state: any, _version) => {
        if (!state || typeof state !== "object") return state;
        if (!Array.isArray(state.cestas) || state.cestas.length === 0) {
          state.cestas = CESTAS.map((c) => ({ ...c, ativo: true }));
        } else {
          // Ensure every persisted basket has the `ativo` flag (older versions may not)
          state.cestas = state.cestas.map((c: any) => ({
            ativo: true,
            ...c,
          }));
        }
        if (!Array.isArray(state.sobremesas) || state.sobremesas.length === 0) {
          state.sobremesas = SOBREMESAS.map((sb) => ({ ...sb, ativo: true }));
        }
        // Heal stale closing date from older versions
        if (state.geral && typeof state.geral === "object") {
          const today = new Date();
          const enc = state.geral.encerramento
            ? new Date(`${state.geral.encerramento}T23:59:59`)
            : null;
          if (!enc || enc < today) {
            state.geral.encerramento = "2026-05-08";
          }
        }
        // Garante que entrega.restricaoRaio existe (versões anteriores não tinham)
        if (state.entrega && typeof state.entrega === "object") {
          if (
            !state.entrega.restricaoRaio ||
            typeof state.entrega.restricaoRaio !== "object"
          ) {
            const primeiraUnidadeId = Array.isArray(state.entrega.unidades)
              ? state.entrega.unidades[0]?.id
              : "";
            state.entrega.restricaoRaio = {
              ativo: false,
              unidadeBaseId: primeiraUnidadeId ?? "",
              raioKm: 10,
            };
          }
        }
        return state;
      },
    },
  ),
);

// Stable fallbacks — referenced once, never re-created (avoids infinite re-renders)
const FALLBACK_CESTAS = CESTAS.map((c) => ({ ...c, ativo: true }));
const FALLBACK_SOBREMESAS = SOBREMESAS.map((sb) => ({ ...sb, ativo: true }));

/**
 * IMPORTANTE: Em Zustand v5, retornar referência nova (ex.: array do `.filter()`)
 * a cada render causa "Maximum update depth exceeded". Use os hooks abaixo,
 * que envolvem o seletor com `useShallow`.
 */
export const useCestasAtivas = () =>
  useAdmin(
    useShallow((s) => {
      if (!Array.isArray(s.cestas) || s.cestas.length === 0) return FALLBACK_CESTAS;
      const ativas = s.cestas.filter((c) => c.ativo !== false);
      return ativas.length === 0 ? FALLBACK_CESTAS : ativas;
    }),
  );
export const useSobremesasAtivas = () =>
  useAdmin(
    useShallow((s) => {
      if (!Array.isArray(s.sobremesas) || s.sobremesas.length === 0)
        return FALLBACK_SOBREMESAS;
      const ativas = s.sobremesas.filter((sb) => sb.ativo !== false);
      return ativas.length === 0 ? FALLBACK_SOBREMESAS : ativas;
    }),
  );
export const useUnidadesAtivas = () =>
  useAdmin(useShallow((s) => s.entrega.unidades.filter((u) => u.ativa)));
export const useDatasAtivas = () =>
  useAdmin(useShallow((s) => s.entrega.datas.filter((d) => d.ativa)));
export const useHorariosAtivos = () =>
  useAdmin(useShallow((s) => s.entrega.horarios.filter((h) => h.ativo)));

// Backwards-compat (usar apenas com useShallow no chamador)
export const selectCestasAtivas = (s: AdminState) => {
  if (!Array.isArray(s.cestas) || s.cestas.length === 0) return FALLBACK_CESTAS;
  const ativas = s.cestas.filter((c) => c.ativo !== false);
  return ativas.length === 0 ? FALLBACK_CESTAS : ativas;
};
export const selectSobremesasAtivas = (s: AdminState) => {
  if (!Array.isArray(s.sobremesas) || s.sobremesas.length === 0) return FALLBACK_SOBREMESAS;
  const ativas = s.sobremesas.filter((sb) => sb.ativo !== false);
  return ativas.length === 0 ? FALLBACK_SOBREMESAS : ativas;
};
export const selectUnidadesAtivas = (s: AdminState) =>
  s.entrega.unidades.filter((u) => u.ativa);
export const selectDatasAtivas = (s: AdminState) =>
  s.entrega.datas.filter((d) => d.ativa);
export const selectHorariosAtivos = (s: AdminState) =>
  s.entrega.horarios.filter((h) => h.ativo);

export const isEncerrado = (_encerramentoIso: string) => {
  // Encomendas sempre ABERTAS na home. O encerramento por data foi desativado
  // a pedido do cliente — controle agora é manual via admin (futuro).
  return false;
};
