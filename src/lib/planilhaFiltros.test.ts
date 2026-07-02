import { describe, expect, it } from "vitest";
import type { EncomendaLinha } from "@/lib/encomendasTable";
import { locaisPlanilhaOpcoes } from "@/lib/encomendasTable";
import {
  filtrarLinhasEncomenda,
  filtrosPlanilhaAtivos,
  produtosUnicosDasLinhas,
} from "@/lib/planilhaFiltros";

const linha = (overrides: Partial<EncomendaLinha> = {}): EncomendaLinha => ({
  linhaId: "1",
  pedidoId: "p1",
  dataChegada: "01/07/2026",
  dataRetirada: "03/07/2026",
  horarioRetirada: "09:00:00",
  diaSemana: "sexta-feira",
  nomeCliente: "Cliente",
  setor: "Cozinha",
  setorKey: "cozinha",
  productionSector: "COZINHA",
  produto: "Cesta Café",
  qtd: 1,
  localRetirada: "Retirada Noroeste",
  localKey: "retirada noroeste",
  unidadeId: "noroeste",
  ...overrides,
});

const locais = locaisPlanilhaOpcoes();

describe("filtrarLinhasEncomenda", () => {
  const linhas = [
    linha(),
    linha({
      linhaId: "2",
      productionSector: "CONFEITARIA",
      setor: "Confeitaria",
      setorKey: "confeitaria",
      produto: "Bolo",
      unidadeId: "asa-sul",
      localRetirada: "Retirada 104",
      localKey: "retirada 104",
    }),
  ];

  it("retorna todas quando filtros vazios", () => {
    expect(filtrarLinhasEncomenda(linhas, { setor: "", produto: "", localId: "" })).toHaveLength(2);
  });

  it("filtra por setor", () => {
    const out = filtrarLinhasEncomenda(linhas, { setor: "COZINHA", produto: "", localId: "" });
    expect(out).toHaveLength(1);
    expect(out[0].produto).toBe("Cesta Café");
  });

  it("filtra por produto", () => {
    const out = filtrarLinhasEncomenda(linhas, { setor: "", produto: "Bolo", localId: "" });
    expect(out).toHaveLength(1);
    expect(out[0].setor).toBe("Confeitaria");
  });

  it("filtra por local", () => {
    const out = filtrarLinhasEncomenda(
      linhas,
      { setor: "", produto: "", localId: "noroeste" },
      locais,
    );
    expect(out).toHaveLength(1);
    expect(out[0].localRetirada).toBe("Retirada Noroeste");
  });
});

describe("produtosUnicosDasLinhas", () => {
  it("lista produtos únicos ordenados", () => {
    const list = produtosUnicosDasLinhas([
      linha({ produto: "Zebra" }),
      linha({ produto: "Abacaxi" }),
      linha({ produto: "Zebra" }),
    ]);
    expect(list).toEqual(["Abacaxi", "Zebra"]);
  });
});

describe("filtrosPlanilhaAtivos", () => {
  it("detecta filtros ativos", () => {
    expect(filtrosPlanilhaAtivos({ setor: "", produto: "", localId: "" })).toBe(false);
    expect(filtrosPlanilhaAtivos({ setor: "COZINHA", produto: "", localId: "" })).toBe(true);
  });
});
