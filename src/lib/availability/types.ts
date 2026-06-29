export type ProductionSector = "CONFEITARIA" | "PADARIA" | "COZINHA";

export type ProdutoRegras = {
  produto_id: string;
  produto_tipo: "cesta" | "sobremesa";
  production_sector: ProductionSector;
  minimum_lead_time_hours: number;
  same_day_allowed: boolean;
  allowed_fulfillment_modes: ("delivery" | "retirada")[];
  allowed_unit_ids?: string[] | null;
  cutoff_time?: string | null;
  monday_first_slot?: string;
  weekend_extra_hours?: number;
  available_time_windows?: string[] | null;
};

export type CarrinhoItem = {
  produto_id: string;
  produto_tipo: "cesta" | "sobremesa";
  nome: string;
};

export type DisponibilidadeInput = {
  itens: CarrinhoItem[];
  fulfillmentMode: "delivery" | "retirada";
  unidadeId?: string;
  candidateDate?: string;
  candidateHorario?: string;
};

export type JanelaDisponivel = {
  label: string;
  inicioHora: number;
  fimHora: number;
};

export type DisponibilidadeResult = {
  valid: boolean;
  errors: string[];
  availableDates?: string[];
  availableWindows?: JanelaDisponivel[];
};
