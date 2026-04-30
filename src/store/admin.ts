import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { CESTAS, SOBREMESAS, UNIDADES, DATAS_ENTREGA, HORARIOS } from "@/lib/data";
import type { Cesta, Sobremesa, Unidade } from "@/lib/types";

export type Tema = {
  primary: string;
  accent: string;
  background: string;
  modo: "claro" | "escuro";
  logoUrl?: string;
  logoUrlAlt?: string;
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

export type DiaSemana = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";

export type HorarioFuncionamento = Record<
  DiaSemana,
  { ativo: boolean; inicio: string; fim: string }
>;

export type UnidadeCadastrada = Unidade & {
  status: "ativa" | "inativa";
  raioEntregaKm: number;
  horarioFuncionamento: HorarioFuncionamento;
};

export type Categoria = {
  id: string;
  nome: string;
  imagemCapa?: string;
  ordem?: number;
};

export type HomeBanner = {
  imagemUrl: string;
  titulo: string;
  subtitulo: string;
  ctaLabel: string;
  ctaHref: string;
};

export type HomeCampanhaDestaque = { ativo: boolean; ordem: number };

export type HomeRodape = {
  enderecos: string;
  redes: { instagram: string; whatsapp: string; facebook: string };
  textoLivre: string;
};

export type Home = {
  banner: HomeBanner;
  campanhasDestaque: Record<string, HomeCampanhaDestaque>;
  rodape: HomeRodape;
};

// Mantido por compatibilidade — Quiz e Resumo ainda leem via selectors abaixo
// que agora resolvem a partir da campanha ativa.
export type EntregaConfig = {
  delivery: boolean;
  retirada: boolean;
  unidades: (Unidade & { ativa: boolean })[];
  datas: { id: string; label: string; ativa: boolean }[];
  horarios: { label: string; ativo: boolean }[];
  restricaoRaio: {
    ativo: boolean;
    unidadeBaseId: string;
    raioKm: number;
  };
};

export type QuizConfig = {
  delivery: boolean;
  retirada: boolean;
  unidadeIds: string[];
  datas: { id: string; label: string; ativa: boolean }[];
  horarios: { label: string; ativo: boolean }[];
  restricaoRaio: { ativo: boolean; unidadeBaseId: string; raioKm: number };
};

export type TaxaEntrega =
  | { tipo: "fixa"; valor: number }
  | { tipo: "faixa"; faixas: { ateKm: number; valor: number }[] };

export type CampanhaDelivery = {
  ativo: boolean;
  valorMinimo: number;
  taxa: TaxaEntrega;
  tempoEstimadoMin: number;
  tempoEstimadoMax: number;
  raioKm: number;
  bairros: string[];
  horario: HorarioFuncionamento;
  upsellAtivo: boolean;
  upsellProdutoIds: string[];
  datas: { id: string; label: string; ativa: boolean }[];
  horarios: { label: string; ativo: boolean }[];
};

export type CampanhaRetirada = {
  ativo: boolean;
  valorMinimo: number;
  tempoPreparoMin: number;
  tempoPreparoMax: number;
  horario: HorarioFuncionamento;
  enderecoRetirada: string;
  upsellAtivo: boolean;
  upsellProdutoIds: string[];
  datas: { id: string; label: string; ativa: boolean }[];
  horarios: { label: string; ativo: boolean }[];
};

export type CampanhaTextos = {
  titulo: string;
  subtitulo: string;
  boasVindas: string;
  confirmacao: string;
};

export type Campanha = {
  id: string;
  slug: string;
  nome: string;
  status: "ativa" | "pausada";
  imagemDestaque?: string;
  unidadeId?: string;
  delivery: CampanhaDelivery;
  retirada: CampanhaRetirada;
  // novos
  produtosPrincipaisIds: string[];
  dataInicio?: string;
  dataFim?: string;
  dataLimitePedidos?: string;
  textos: CampanhaTextos;
  // legado (compatibilidade com Quiz/Resumo durante a transição)
  upsellAtivo: boolean;
  upsellProdutoIds: string[];
  quiz: QuizConfig;
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

export type CestaAdmin = Cesta & {
  ativo: boolean;
  arquivado?: boolean;
  categoriaId?: string;
};

type AdminState = {
  tema: Tema;
  textos: Textos;
  cestas: CestaAdmin[];
  categorias: Categoria[];
  sobremesas: (Sobremesa & { ativo: boolean })[];
  unidades: UnidadeCadastrada[];
  campanhas: Campanha[];
  campanhaAtivaId: string;
  entrega: EntregaConfig; // legado — sincronizado a partir da campanha ativa
  pagamento: Pagamento;
  integracoes: Integracoes;
  geral: ConfigGeral;
  home: Home;
  pedidos: PedidoSalvo[];

  setTema: (t: Partial<Tema>) => void;
  setTextos: (t: Partial<Textos>) => void;

  setCesta: (id: string, patch: Partial<CestaAdmin>) => void;
  addCesta: () => void;
  removeCesta: (id: string) => void;
  arquivarCesta: (id: string, arquivado: boolean) => void;

  setCategoria: (id: string, patch: Partial<Categoria>) => void;
  addCategoria: (nome: string) => void;
  removeCategoria: (id: string) => void;

  setSobremesa: (id: string, patch: Partial<Sobremesa & { ativo: boolean }>) => void;
  addSobremesa: () => void;
  removeSobremesa: (id: string) => void;

  setUnidadeCadastrada: (id: string, patch: Partial<UnidadeCadastrada>) => void;
  addUnidadeCadastrada: () => void;
  removeUnidadeCadastrada: (id: string) => void;

  setCampanha: (id: string, patch: Partial<Campanha>) => void;
  setCampanhaQuiz: (id: string, patch: Partial<QuizConfig>) => void;
  setCampanhaDelivery: (id: string, patch: Partial<CampanhaDelivery>) => void;
  setCampanhaRetirada: (id: string, patch: Partial<CampanhaRetirada>) => void;
  addCampanha: () => void;
  removeCampanha: (id: string) => void;
  setCampanhaAtivaId: (id: string) => void;

  setEntrega: (patch: Partial<EntregaConfig>) => void; // legado
  setPagamento: (patch: Partial<Pagamento>) => void;
  setIntegracoes: (patch: Partial<Integracoes>) => void;
  setGeral: (patch: Partial<ConfigGeral>) => void;
  setHome: (patch: Partial<Home>) => void;
  setHomeBanner: (patch: Partial<HomeBanner>) => void;
  setHomeRodape: (patch: Partial<HomeRodape>) => void;
  setHomeCampanhaDestaque: (campanhaId: string, patch: Partial<HomeCampanhaDestaque>) => void;
  registrarPedido: (p: PedidoSalvo) => void;
  limparPedidos: () => void;
  resetTudo: () => void;
};

const HORARIO_FUNC_DEFAULT: HorarioFuncionamento = {
  seg: { ativo: true, inicio: "09:00", fim: "18:00" },
  ter: { ativo: true, inicio: "09:00", fim: "18:00" },
  qua: { ativo: true, inicio: "09:00", fim: "18:00" },
  qui: { ativo: true, inicio: "09:00", fim: "18:00" },
  sex: { ativo: true, inicio: "09:00", fim: "18:00" },
  sab: { ativo: true, inicio: "09:00", fim: "14:00" },
  dom: { ativo: false, inicio: "09:00", fim: "13:00" },
};

const initialUnidades: UnidadeCadastrada[] = UNIDADES.map((u) => ({
  ...u,
  status: "ativa",
  raioEntregaKm: 10,
  horarioFuncionamento: HORARIO_FUNC_DEFAULT,
}));

const datasDefault = () => DATAS_ENTREGA.map((d) => ({ ...d, ativa: true }));
const horariosDefault = () => HORARIOS.map((h) => ({ label: h, ativo: true }));

const deliveryDefault = (): CampanhaDelivery => ({
  ativo: true,
  valorMinimo: 0,
  taxa: { tipo: "fixa", valor: 0 },
  tempoEstimadoMin: 40,
  tempoEstimadoMax: 60,
  raioKm: 10,
  bairros: [],
  horario: HORARIO_FUNC_DEFAULT,
  upsellAtivo: true,
  upsellProdutoIds: [],
  datas: datasDefault(),
  horarios: horariosDefault(),
});

const retiradaDefault = (endereco = ""): CampanhaRetirada => ({
  ativo: true,
  valorMinimo: 0,
  tempoPreparoMin: 20,
  tempoPreparoMax: 30,
  horario: HORARIO_FUNC_DEFAULT,
  enderecoRetirada: endereco,
  upsellAtivo: false,
  upsellProdutoIds: [],
  datas: datasDefault(),
  horarios: horariosDefault(),
});

const textosDefault = (nome = "Campanha"): CampanhaTextos => ({
  titulo: nome,
  subtitulo: "",
  boasVindas: "",
  confirmacao: "",
});

const initialCampanha: Campanha = {
  id: "campanha-principal",
  slug: "principal",
  nome: "Campanha principal",
  status: "ativa",
  unidadeId: initialUnidades[0]?.id,
  delivery: deliveryDefault(),
  retirada: retiradaDefault(initialUnidades[0]?.endereco ?? ""),
  upsellAtivo: true,
  upsellProdutoIds: [],
  produtosPrincipaisIds: [],
  textos: textosDefault("Campanha principal"),
  quiz: {
    delivery: true,
    retirada: true,
    unidadeIds: initialUnidades.map((u) => u.id),
    datas: datasDefault(),
    horarios: horariosDefault(),
    restricaoRaio: {
      ativo: false,
      unidadeBaseId: initialUnidades[0]?.id ?? "",
      raioKm: 10,
    },
  },
};

const initialCategorias: Categoria[] = [
  { id: "cat-cestas", nome: "Cestas" },
  { id: "cat-sobremesas", nome: "Sobremesas" },
];

function entregaFromCampanha(
  campanha: Campanha,
  unidades: UnidadeCadastrada[],
): EntregaConfig {
  const ids = new Set(campanha.quiz.unidadeIds);
  return {
    delivery: campanha.delivery.ativo,
    retirada: campanha.retirada.ativo,
    unidades: unidades
      .filter((u) => ids.has(u.id))
      .map((u) => ({
        id: u.id,
        nome: u.nome,
        endereco: u.endereco,
        lat: u.lat,
        lng: u.lng,
        ativa: u.status === "ativa",
      })),
    datas: campanha.quiz.datas,
    horarios: campanha.quiz.horarios,
    restricaoRaio: campanha.quiz.restricaoRaio,
  };
}

const initial = {
  tema: {
    primary: "#1B2A4A",
    accent: "#D4A855",
    background: "#FAF6EF",
    modo: "claro" as const,
  },
  textos: {
    heroTitulo: "Sabores artesanais do Casa Almeria",
    heroSubtitulo:
      "Cestas, sobremesas e produtos cuidadosamente selecionados, com entrega ou retirada em Brasília.",
    badgePrazo: "",
    ctaPrincipal: "VER CARDÁPIO",
    taglineFooter: "pra alimentar corpo e alma",
    whatsapp: "5561999999999",
    msgConfirmacao:
      "Em breve entraremos em contato pelo WhatsApp para confirmar todos os detalhes.",
  },
  cestas: [
    ...CESTAS.map((c) => ({
      ...c,
      ativo: true,
      arquivado: false,
      categoriaId: "cat-cestas",
    })),
    ...SOBREMESAS.map((s) => ({
      id: s.id,
      nome: s.nome,
      badge: "Sobremesa",
      preco: s.preco,
      descricao: s.descricao,
      itens: [] as string[],
      imagem: s.imagem,
      ativo: true,
      arquivado: false,
      categoriaId: "cat-sobremesas",
    })),
  ] as CestaAdmin[],
  categorias: initialCategorias,
  sobremesas: SOBREMESAS.map((s) => ({ ...s, ativo: true })),
  unidades: initialUnidades,
  campanhas: [initialCampanha],
  campanhaAtivaId: initialCampanha.id,
  entrega: entregaFromCampanha(initialCampanha, initialUnidades),
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
  },
  home: {
    banner: {
      imagemUrl:
        "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=1600&q=80",
      titulo: "Casa Almeria",
      subtitulo: "Sabores artesanais com entrega ou retirada em Brasília",
      ctaLabel: "Ver cardápio",
      ctaHref: "#cardapio",
    },
    campanhasDestaque: {} as Record<string, HomeCampanhaDestaque>,
    rodape: {
      enderecos: "",
      redes: {
        instagram: "https://instagram.com",
        whatsapp: "https://wa.me/5561999999999",
        facebook: "",
      },
      textoLivre: "",
    },
  } as Home,
};

function syncEntregaLegado(state: AdminState): EntregaConfig {
  const campanha =
    state.campanhas.find((c) => c.id === state.campanhaAtivaId) ??
    state.campanhas[0];
  if (!campanha) return state.entrega;
  return entregaFromCampanha(campanha, state.unidades);
}

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
              nome: "Novo produto",
              badge: "Para X pessoas",
              preco: 0,
              descricao: "",
              itens: [],
              imagem:
                "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=1400&q=80",
              ativo: true,
              arquivado: false,
              categoriaId: s.categorias[0]?.id,
            },
          ],
        })),
      removeCesta: (id) =>
        set((s) => ({ cestas: s.cestas.filter((c) => c.id !== id) })),
      arquivarCesta: (id, arquivado) =>
        set((s) => ({
          cestas: s.cestas.map((c) => (c.id === id ? { ...c, arquivado } : c)),
        })),

      setCategoria: (id, patch) =>
        set((s) => ({
          categorias: s.categorias.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        })),
      addCategoria: (nome) =>
        set((s) => ({
          categorias: [
            ...s.categorias,
            { id: `cat-${Date.now()}`, nome: nome.trim() || "Nova categoria" },
          ],
        })),
      removeCategoria: (id) =>
        set((s) => ({
          categorias: s.categorias.filter((c) => c.id !== id),
          cestas: s.cestas.map((c) =>
            c.categoriaId === id ? { ...c, categoriaId: undefined } : c,
          ),
        })),

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

      setUnidadeCadastrada: (id, patch) =>
        set((s) => {
          const unidades = s.unidades.map((u) =>
            u.id === id ? { ...u, ...patch } : u,
          );
          const next = { ...s, unidades };
          return { unidades, entrega: syncEntregaLegado(next) };
        }),
      addUnidadeCadastrada: () =>
        set((s) => {
          const novoId = `u-${Date.now()}`;
          const unidades = [
            ...s.unidades,
            {
              id: novoId,
              nome: "Nova unidade",
              endereco: "",
              status: "ativa" as const,
              raioEntregaKm: 10,
              horarioFuncionamento: HORARIO_FUNC_DEFAULT,
            },
          ];
          return { unidades };
        }),
      removeUnidadeCadastrada: (id) =>
        set((s) => {
          const unidades = s.unidades.filter((u) => u.id !== id);
          const campanhas = s.campanhas.map((c) => ({
            ...c,
            quiz: {
              ...c.quiz,
              unidadeIds: c.quiz.unidadeIds.filter((uid) => uid !== id),
            },
          }));
          const next = { ...s, unidades, campanhas };
          return { unidades, campanhas, entrega: syncEntregaLegado(next) };
        }),

      setCampanha: (id, patch) =>
        set((s) => {
          const campanhas = s.campanhas.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          );
          const next = { ...s, campanhas };
          return { campanhas, entrega: syncEntregaLegado(next) };
        }),
      setCampanhaQuiz: (id, patch) =>
        set((s) => {
          const campanhas = s.campanhas.map((c) =>
            c.id === id ? { ...c, quiz: { ...c.quiz, ...patch } } : c,
          );
          const next = { ...s, campanhas };
          return { campanhas, entrega: syncEntregaLegado(next) };
        }),
      setCampanhaDelivery: (id, patch) =>
        set((s) => {
          const campanhas = s.campanhas.map((c) => {
            if (c.id !== id) return c;
            const delivery = { ...c.delivery, ...patch };
            // sincroniza quiz legado
            const quiz = {
              ...c.quiz,
              delivery: delivery.ativo,
              datas: delivery.datas,
              horarios: delivery.horarios,
            };
            return { ...c, delivery, quiz };
          });
          const next = { ...s, campanhas };
          return { campanhas, entrega: syncEntregaLegado(next) };
        }),
      setCampanhaRetirada: (id, patch) =>
        set((s) => {
          const campanhas = s.campanhas.map((c) => {
            if (c.id !== id) return c;
            const retirada = { ...c.retirada, ...patch };
            const quiz = { ...c.quiz, retirada: retirada.ativo };
            return { ...c, retirada, quiz };
          });
          const next = { ...s, campanhas };
          return { campanhas, entrega: syncEntregaLegado(next) };
        }),
      addCampanha: () =>
        set((s) => {
          const id = `camp-${Date.now()}`;
          const baseQuiz = s.campanhas[0]?.quiz ?? initialCampanha.quiz;
          const nova: Campanha = {
            id,
            slug: `campanha-${Date.now().toString(36)}`,
            nome: "Nova campanha",
            status: "ativa",
            unidadeId: s.unidades[0]?.id,
            delivery: deliveryDefault(),
            retirada: retiradaDefault(s.unidades[0]?.endereco ?? ""),
            upsellAtivo: false,
            upsellProdutoIds: [],
            produtosPrincipaisIds: [],
            textos: textosDefault("Nova campanha"),
            quiz: { ...baseQuiz },
          };
          return { campanhas: [...s.campanhas, nova] };
        }),
      removeCampanha: (id) =>
        set((s) => {
          const campanhas = s.campanhas.filter((c) => c.id !== id);
          const campanhaAtivaId =
            s.campanhaAtivaId === id
              ? (campanhas[0]?.id ?? "")
              : s.campanhaAtivaId;
          const next = { ...s, campanhas, campanhaAtivaId };
          return {
            campanhas,
            campanhaAtivaId,
            entrega: syncEntregaLegado(next),
          };
        }),
      setCampanhaAtivaId: (id) =>
        set((s) => {
          const next = { ...s, campanhaAtivaId: id };
          return { campanhaAtivaId: id, entrega: syncEntregaLegado(next) };
        }),

      setEntrega: (patch) =>
        set((s) => ({ entrega: { ...s.entrega, ...patch } })),
      setPagamento: (patch) =>
        set((s) => ({ pagamento: { ...s.pagamento, ...patch } })),
      setIntegracoes: (patch) =>
        set((s) => ({ integracoes: { ...s.integracoes, ...patch } })),
      setGeral: (patch) => set((s) => ({ geral: { ...s.geral, ...patch } })),

      setHome: (patch) => set((s) => ({ home: { ...s.home, ...patch } })),
      setHomeBanner: (patch) =>
        set((s) => ({ home: { ...s.home, banner: { ...s.home.banner, ...patch } } })),
      setHomeRodape: (patch) =>
        set((s) => ({
          home: {
            ...s.home,
            rodape: {
              ...s.home.rodape,
              ...patch,
              redes: { ...s.home.rodape.redes, ...(patch.redes ?? {}) },
            },
          },
        })),
      setHomeCampanhaDestaque: (campanhaId, patch) =>
        set((s) => {
          const atual = s.home.campanhasDestaque[campanhaId] ?? {
            ativo: false,
            ordem: 0,
          };
          return {
            home: {
              ...s.home,
              campanhasDestaque: {
                ...s.home.campanhasDestaque,
                [campanhaId]: { ...atual, ...patch },
              },
            },
          };
        }),

      registrarPedido: (p) =>
        set((s) => ({ pedidos: [p, ...s.pedidos].slice(0, 500) })),
      limparPedidos: () => set({ pedidos: [] }),

      resetTudo: () => set({ ...initial, pedidos: [] }),
    }),
    {
      name: "casa-almeria-admin",
      version: 8,
      partialize: (s) => ({
        tema: s.tema,
        textos: s.textos,
        cestas: s.cestas,
        categorias: s.categorias,
        sobremesas: s.sobremesas,
        unidades: s.unidades,
        campanhas: s.campanhas,
        campanhaAtivaId: s.campanhaAtivaId,
        entrega: s.entrega,
        pagamento: { ...s.pagamento, mpAccessToken: "" },
        integracoes: { ...s.integracoes, metaAccessToken: "", webhookUrl: "" },
        geral: s.geral,
        pedidos: s.pedidos,
      }),
      migrate: (state: any, _version) => {
        if (!state || typeof state !== "object") return state;

        // Cestas
        if (!Array.isArray(state.cestas) || state.cestas.length === 0) {
          state.cestas = initial.cestas;
        } else {
          state.cestas = state.cestas.map((c: any) => ({
            ativo: true,
            arquivado: false,
            categoriaId: c.categoriaId ?? "cat-cestas",
            ...c,
          }));
        }

        // Categorias — garantir Cestas + Sobremesas
        if (!Array.isArray(state.categorias) || state.categorias.length === 0) {
          state.categorias = initialCategorias;
        } else {
          if (!state.categorias.some((c: any) => c.id === "cat-cestas")) {
            state.categorias.unshift({ id: "cat-cestas", nome: "Cestas" });
          }
          if (!state.categorias.some((c: any) => c.id === "cat-sobremesas")) {
            state.categorias.push({ id: "cat-sobremesas", nome: "Sobremesas" });
          }
        }

        // Sobremesas — restaurar como produtos vinculados à categoria Sobremesas
        if (!Array.isArray(state.sobremesas) || state.sobremesas.length === 0) {
          state.sobremesas = SOBREMESAS.map((sb) => ({ ...sb, ativo: true }));
        }
        // Garante que TODOS os IDs da seed SOBREMESAS existem em state.cestas;
        // se foram excluídos manualmente, recria; se estavam arquivados/inativos
        // (apenas itens vindos da seed), restaura.
        const seedSobremesaIds = new Set(SOBREMESAS.map((s) => s.id));
        const cestasIndex = new Map<string, any>(
          state.cestas.map((c: any) => [c.id, c]),
        );
        for (const sb of SOBREMESAS) {
          const existente = cestasIndex.get(sb.id);
          if (!existente) {
            state.cestas.push({
              id: sb.id,
              nome: sb.nome,
              badge: "Sobremesa",
              preco: sb.preco,
              descricao: sb.descricao,
              itens: [],
              imagem: sb.imagem,
              ativo: true,
              arquivado: false,
              categoriaId: "cat-sobremesas",
            });
          } else if (seedSobremesaIds.has(existente.id)) {
            existente.arquivado = false;
            existente.ativo = true;
            if (!existente.categoriaId) existente.categoriaId = "cat-sobremesas";
          }
        }
        // Itens em state.sobremesas (se houver IDs novos não na seed) também
        // entram como produtos.
        const cestasIds2 = new Set(state.cestas.map((c: any) => c.id));
        for (const sb of state.sobremesas) {
          if (!cestasIds2.has(sb.id)) {
            state.cestas.push({
              id: sb.id,
              nome: sb.nome,
              badge: "Sobremesa",
              preco: sb.preco,
              descricao: sb.descricao,
              itens: [],
              imagem: sb.imagem,
              ativo: true,
              arquivado: false,
              categoriaId: "cat-sobremesas",
            });
          }
        }

        // Geral — remover campos antigos
        state.geral = { ativa: state.geral?.ativa ?? true };

        // Migra entrega legada para unidades + campanha principal
        const entregaLegada = state.entrega ?? {};
        if (!Array.isArray(state.unidades) || state.unidades.length === 0) {
          const fonteUnidades =
            Array.isArray(entregaLegada.unidades) && entregaLegada.unidades.length > 0
              ? entregaLegada.unidades
              : UNIDADES.map((u) => ({ ...u, ativa: true }));
          const raioPadrao = entregaLegada?.restricaoRaio?.raioKm ?? 10;
          state.unidades = fonteUnidades.map((u: any) => ({
            id: u.id,
            nome: u.nome,
            endereco: u.endereco ?? "",
            lat: u.lat,
            lng: u.lng,
            status: u.ativa === false ? "inativa" : "ativa",
            raioEntregaKm: raioPadrao,
            horarioFuncionamento: HORARIO_FUNC_DEFAULT,
          }));
        }

        if (!Array.isArray(state.campanhas) || state.campanhas.length === 0) {
          const baseQuiz: QuizConfig = {
            delivery: entregaLegada.delivery ?? true,
            retirada: entregaLegada.retirada ?? true,
            unidadeIds: state.unidades.map((u: any) => u.id),
            datas:
              Array.isArray(entregaLegada.datas) && entregaLegada.datas.length > 0
                ? entregaLegada.datas
                : datasDefault(),
            horarios:
              Array.isArray(entregaLegada.horarios) &&
              entregaLegada.horarios.length > 0
                ? entregaLegada.horarios
                : horariosDefault(),
            restricaoRaio: entregaLegada.restricaoRaio ?? {
              ativo: false,
              unidadeBaseId: state.unidades[0]?.id ?? "",
              raioKm: 10,
            },
          };
          state.campanhas = [
            {
              id: "campanha-principal",
              slug: "principal",
              nome: "Campanha principal",
              status: "ativa",
              unidadeId: state.unidades[0]?.id,
              delivery: { ...deliveryDefault(), ativo: baseQuiz.delivery, datas: baseQuiz.datas, horarios: baseQuiz.horarios, raioKm: baseQuiz.restricaoRaio.raioKm },
              retirada: retiradaDefault(state.unidades[0]?.endereco ?? ""),
              upsellAtivo: true,
              upsellProdutoIds: [],
              produtosPrincipaisIds: [],
              textos: textosDefault("Campanha principal"),
              quiz: baseQuiz,
            },
          ];
        } else {
          // Migra campanhas existentes para novo shape
          state.campanhas = state.campanhas.map((c: any) => {
            const quiz: QuizConfig = c.quiz ?? {
              delivery: true,
              retirada: true,
              unidadeIds: state.unidades.map((u: any) => u.id),
              datas: datasDefault(),
              horarios: horariosDefault(),
              restricaoRaio: {
                ativo: false,
                unidadeBaseId: state.unidades[0]?.id ?? "",
                raioKm: 10,
              },
            };
            const upsellProdutoIds: string[] = Array.isArray(c.upsellProdutoIds)
              ? c.upsellProdutoIds
              : c.upsellProdutoId
                ? [c.upsellProdutoId]
                : [];
            const unidadeId =
              c.unidadeId ??
              quiz.unidadeIds[0] ??
              state.unidades[0]?.id;
            const enderecoUnidade =
              state.unidades.find((u: any) => u.id === unidadeId)?.endereco ?? "";
            const delivery: CampanhaDelivery = c.delivery ?? {
              ...deliveryDefault(),
              ativo: quiz.delivery,
              datas: quiz.datas,
              horarios: quiz.horarios,
              raioKm: quiz.restricaoRaio?.raioKm ?? 10,
              upsellAtivo: !!c.upsellAtivo,
              upsellProdutoIds,
            };
            const retirada: CampanhaRetirada = c.retirada ?? {
              ...retiradaDefault(enderecoUnidade),
              ativo: quiz.retirada,
              datas: quiz.datas,
              horarios: quiz.horarios,
            };
            return {
              id: c.id,
              slug: c.slug,
              nome: c.nome,
              status: c.status ?? "ativa",
              unidadeId,
              delivery,
              retirada,
              upsellAtivo: !!c.upsellAtivo,
              upsellProdutoIds,
              produtosPrincipaisIds: Array.isArray(c.produtosPrincipaisIds)
                ? c.produtosPrincipaisIds
                : [],
              dataInicio: c.dataInicio,
              dataFim: c.dataFim,
              dataLimitePedidos: c.dataLimitePedidos,
              textos:
                c.textos && typeof c.textos === "object"
                  ? {
                      titulo: c.textos.titulo ?? c.nome ?? "",
                      subtitulo: c.textos.subtitulo ?? "",
                      boasVindas: c.textos.boasVindas ?? "",
                      confirmacao: c.textos.confirmacao ?? "",
                    }
                  : textosDefault(c.nome ?? "Campanha"),
              quiz,
            };
          });
        }
        if (!state.campanhaAtivaId) {
          state.campanhaAtivaId = state.campanhas[0].id;
        }

        if (state.pagamento && typeof state.pagamento === "object") {
          if (typeof state.pagamento.checkoutAtivo !== "boolean") {
            state.pagamento.checkoutAtivo = false;
          }
        }

        // Re-sincroniza entrega legada com a campanha ativa
        const campanhaAtiva =
          state.campanhas.find((c: any) => c.id === state.campanhaAtivaId) ??
          state.campanhas[0];
        state.entrega = entregaFromCampanha(campanhaAtiva, state.unidades);

        return state;
      },
    },
  ),
);

// Stable fallbacks
const FALLBACK_CESTAS: CestaAdmin[] = CESTAS.map((c) => ({
  ...c,
  ativo: true,
  arquivado: false,
  categoriaId: "cat-cestas",
}));
const FALLBACK_SOBREMESAS = SOBREMESAS.map((sb) => ({ ...sb, ativo: true }));

export const useCestasAtivas = () =>
  useAdmin(
    useShallow((s) => {
      if (!Array.isArray(s.cestas) || s.cestas.length === 0) return FALLBACK_CESTAS;
      const ativas = s.cestas.filter(
        (c) => c.ativo !== false && c.arquivado !== true,
      );
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

export const useUnidadesCadastradas = () =>
  useAdmin(useShallow((s) => s.unidades));

export const useUnidadesAtivas = () =>
  useAdmin(
    useShallow((s) => {
      const camp =
        s.campanhas.find((c) => c.id === s.campanhaAtivaId) ?? s.campanhas[0];
      if (!camp) return [];
      const ids = new Set(camp.quiz.unidadeIds);
      // Retorna referências originais do store para preservar identidade
      // entre renders (necessário para useShallow funcionar).
      return s.unidades.filter((u) => u.status === "ativa" && ids.has(u.id));
    }),
  );

export const useDatasAtivas = () =>
  useAdmin(
    useShallow((s) => {
      const camp =
        s.campanhas.find((c) => c.id === s.campanhaAtivaId) ?? s.campanhas[0];
      return camp ? camp.quiz.datas.filter((d) => d.ativa) : [];
    }),
  );

export const useHorariosAtivos = () =>
  useAdmin(
    useShallow((s) => {
      const camp =
        s.campanhas.find((c) => c.id === s.campanhaAtivaId) ?? s.campanhas[0];
      return camp ? camp.quiz.horarios.filter((h) => h.ativo) : [];
    }),
  );

export const useCampanhas = () => useAdmin(useShallow((s) => s.campanhas));
export const useCampanhaAtiva = () =>
  useAdmin(
    useShallow(
      (s) =>
        s.campanhas.find((c) => c.id === s.campanhaAtivaId) ?? s.campanhas[0],
    ),
  );
export const useCategorias = () => useAdmin(useShallow((s) => s.categorias));

// Backwards-compat
export const selectCestasAtivas = (s: AdminState) => {
  if (!Array.isArray(s.cestas) || s.cestas.length === 0) return FALLBACK_CESTAS;
  const ativas = s.cestas.filter(
    (c) => c.ativo !== false && c.arquivado !== true,
  );
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
  return false;
};

/**
 * Garante que todos os produtos seed de SOBREMESAS existam em state.cestas
 * (cria se ausentes; desarquiva/ativa se foram arquivados). Usado em runtime
 * após carregar config remota, sem depender da migração de versão.
 */
export function garantirSobremesas() {
  const state = useAdmin.getState();
  const seedIds = new Set(SOBREMESAS.map((s) => s.id));
  const cestas = [...state.cestas];
  const index = new Map(cestas.map((c) => [c.id, c] as const));
  let mudou = false;

  // garante categoria
  let categorias = state.categorias;
  if (!categorias.some((c) => c.id === "cat-sobremesas")) {
    categorias = [...categorias, { id: "cat-sobremesas", nome: "Sobremesas" }];
    mudou = true;
  }

  for (const sb of SOBREMESAS) {
    const existente = index.get(sb.id);
    if (!existente) {
      cestas.push({
        id: sb.id,
        nome: sb.nome,
        badge: "Sobremesa",
        preco: sb.preco,
        descricao: sb.descricao,
        itens: [],
        imagem: sb.imagem,
        ativo: true,
        arquivado: false,
        categoriaId: "cat-sobremesas",
      });
      mudou = true;
    } else if (seedIds.has(existente.id)) {
      if (existente.arquivado || existente.ativo === false || !existente.categoriaId) {
        const idx = cestas.findIndex((c) => c.id === existente.id);
        cestas[idx] = {
          ...existente,
          arquivado: false,
          ativo: true,
          categoriaId: existente.categoriaId ?? "cat-sobremesas",
        };
        mudou = true;
      }
    }
  }

  if (mudou) useAdmin.setState({ cestas, categorias });
}
