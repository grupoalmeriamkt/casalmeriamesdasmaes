import type { CarrinhoItem, ProdutoRegras } from "./types";

/** Defaults quando não há registro em produto_regras. */
export function defaultRegras(item: CarrinhoItem): ProdutoRegras {
  const nome = item.nome.toLowerCase();
  const isCpd =
    item.produto_tipo === "sobremesa" ||
    /bolo|torta|pão|pao|brigadeiro|petit|confeitaria|padaria/.test(nome);

  if (isCpd) {
    return {
      produto_id: item.produto_id,
      produto_tipo: item.produto_tipo,
      production_sector: /pão|pao|padaria/.test(nome) ? "PADARIA" : "CONFEITARIA",
      minimum_lead_time_hours: 24,
      same_day_allowed: false,
      allowed_fulfillment_modes: ["retirada"],
      monday_first_slot: "12:00",
      weekend_extra_hours: 0,
    };
  }

  return {
    produto_id: item.produto_id,
    produto_tipo: item.produto_tipo,
    production_sector: "COZINHA",
    minimum_lead_time_hours: 4,
    same_day_allowed: true,
    allowed_fulfillment_modes: ["delivery", "retirada"],
    monday_first_slot: "06:00",
    weekend_extra_hours: 0,
  };
}

export function mergeRegras(
  item: CarrinhoItem,
  db?: Partial<ProdutoRegras> | null,
): ProdutoRegras {
  const base = defaultRegras(item);
  if (!db) return base;
  return {
    ...base,
    ...db,
    produto_id: item.produto_id,
    produto_tipo: item.produto_tipo,
    allowed_fulfillment_modes: (db.allowed_fulfillment_modes ??
      base.allowed_fulfillment_modes) as ("delivery" | "retirada")[],
  };
}

export function regraMaisRestritiva(regras: ProdutoRegras[]): ProdutoRegras {
  return regras.reduce((acc, r) => {
    const lead = Math.max(acc.minimum_lead_time_hours, r.minimum_lead_time_hours);
    const sameDay = acc.same_day_allowed && r.same_day_allowed;
    const modes = acc.allowed_fulfillment_modes.filter((m) =>
      r.allowed_fulfillment_modes.includes(m),
    );
    const mondaySlot =
      parseSlot(acc.monday_first_slot ?? "12:00") >= parseSlot(r.monday_first_slot ?? "12:00")
        ? acc.monday_first_slot ?? "12:00"
        : r.monday_first_slot ?? "12:00";
    return {
      ...acc,
      minimum_lead_time_hours: lead,
      same_day_allowed: sameDay,
      allowed_fulfillment_modes: modes.length ? modes : ["retirada"],
      monday_first_slot: mondaySlot,
      weekend_extra_hours: Math.max(acc.weekend_extra_hours ?? 0, r.weekend_extra_hours ?? 0),
      production_sector: acc.minimum_lead_time_hours >= r.minimum_lead_time_hours
        ? acc.production_sector
        : r.production_sector,
    };
  });
}

function parseSlot(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 12) * 60 + (m ?? 0);
}

export function resolveProductionSector(itens: CarrinhoItem[], regras: ProdutoRegras[]) {
  const restritiva = regraMaisRestritiva(regras);
  return restritiva.production_sector;
}
