/** Setores exibidos na planilha ENCOMENDAS e gravados em pedidos.production_sector. */
export type SetorOperacional =
  | "CONFEITARIA"
  | "PADARIA"
  | "COZINHA"
  | "COZINHA_104_SUL"
  | "COZINHA_104_CONFEITARIA";

export const SETORES_OPERACAO_OPCOES: {
  value: SetorOperacional;
  label: string;
  key: string;
}[] = [
  { value: "CONFEITARIA", label: "Confeitaria", key: "confeitaria" },
  { value: "PADARIA", label: "Padaria", key: "padaria" },
  { value: "COZINHA", label: "Cozinha", key: "cozinha" },
  { value: "COZINHA_104_SUL", label: "Cozinha 104 Sul", key: "cozinha 104 sul" },
  {
    value: "COZINHA_104_CONFEITARIA",
    label: "Cozinha 104/ Confeitaria",
    key: "cozinha 104/ confeitaria",
  },
];

export const SETOR_OPERACAO_LABEL: Record<SetorOperacional, string> = {
  CONFEITARIA: "Confeitaria",
  PADARIA: "Padaria",
  COZINHA: "Cozinha",
  COZINHA_104_SUL: "Cozinha 104 Sul",
  COZINHA_104_CONFEITARIA: "Cozinha 104/ Confeitaria",
};

export const SETOR_OPERACAO_BADGE_PLANILHA: Record<string, string> = {
  confeitaria: "bg-pink-100 text-pink-800 border border-pink-300",
  padaria: "bg-green-100 text-green-800 border border-green-500",
  cozinha: "bg-violet-100 text-violet-900 border border-violet-400",
  "cozinha 104 sul": "bg-violet-100 text-violet-900 border border-violet-400",
  "cozinha 104/ confeitaria": "bg-blue-100 text-blue-900 border border-blue-400",
  outro: "bg-white text-charcoal border border-border",
};

const SETORES_VALIDOS = new Set<string>(SETORES_OPERACAO_OPCOES.map((s) => s.value));

export function isSetorOperacional(v: string | null | undefined): v is SetorOperacional {
  return !!v && SETORES_VALIDOS.has(v);
}

export function labelSetorOperacao(v: string | null | undefined): string {
  if (isSetorOperacional(v)) return SETOR_OPERACAO_LABEL[v];
  return "—";
}

export function badgeKeySetorOperacao(v: string | null | undefined): string {
  if (isSetorOperacional(v)) {
    return SETORES_OPERACAO_OPCOES.find((s) => s.value === v)?.key ?? "outro";
  }
  return "outro";
}
