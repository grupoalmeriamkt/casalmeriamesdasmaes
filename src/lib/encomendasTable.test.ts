import { describe, expect, it } from "vitest";
import {
  ENTREGA_MOTOBOY_ID,
  flattenPedidosParaLinhas,
  LOCAIS_RETIRADA_OPCOES,
  locaisPlanilhaOpcoes,
  resolveLocalOptionId,
} from "@/lib/encomendasTable";
import type { PedidoRow } from "@/lib/pedidos";
import type { PedidoSalvo } from "@/store/admin";
import { rowToPedidoSalvo } from "@/lib/pedidos";

const baseRow = (): PedidoRow => ({
  id: "abc-123",
  criado_em: "2026-06-29T10:00:00Z",
  cliente_nome: "Maria Freitas",
  cliente_whatsapp: "61999999999",
  cesta: { nome: "CHOCOFEE P", quantidade: 1, preco: 100 },
  sobremesas: [],
  tipo: "retirada",
  endereco_ou_unidade: "Asa Sul",
  data_entrega: "2026-06-29",
  horario: "Entre 17h e 18h",
  pagamento: { metodo: "pix", status: "CONFIRMED" },
  total: 100,
  status: "pago",
  unidade_id: "asa-sul",
  production_sector: "CONFEITARIA",
  execution_at: "2026-06-29T20:00:00.000Z",
  recipient_name: "Maria Freitas",
  recipient_phone: "61999999999",
  recipient_is_buyer: true,
  pagamentos: [],
});

const locaisOpcoes = locaisPlanilhaOpcoes();

describe("flattenPedidosParaLinhas", () => {
  it("gera linha no formato ENCOMENDAS", () => {
    const row = baseRow();
    const pedido = rowToPedidoSalvo(row);
    const linhas = flattenPedidosParaLinhas([pedido], [row], [
      { id: "asa-sul", nome: "Asa Sul", endereco: "", status: "ativa", raioEntregaKm: 0, horarioFuncionamento: {} as never },
    ]);

    expect(linhas).toHaveLength(1);
    expect(linhas[0].nomeCliente).toBe("Maria Freitas");
    expect(linhas[0].produto).toBe("CHOCOFEE P");
    expect(linhas[0].tamanho).toBeNull();
    expect(linhas[0].qtd).toBe(1);
    expect(linhas[0].setor).toBe("Confeitaria");
    expect(linhas[0].localRetirada).toBe("Retirada 104");
    expect(linhas[0].unidadeId).toBe("asa-sul");
    expect(linhas[0].dataChegada).toBe("29/06/2026");
    expect(linhas[0].dataRetirada).toBe("29/06/2026");
    expect(linhas[0].diaSemana).toMatch(/feira/);
  });

  it("infere unidadeId pelo nome quando unidade_id está vazio", () => {
    const row = { ...baseRow(), unidade_id: null, endereco_ou_unidade: "Noroeste" };
    const pedido = rowToPedidoSalvo(row);
    const linhas = flattenPedidosParaLinhas([pedido], [row], [
      { id: "noroeste", nome: "Noroeste", endereco: "", status: "ativa", raioEntregaKm: 0, horarioFuncionamento: {} as never },
    ]);

    expect(linhas[0].unidadeId).toBe("noroeste");
    expect(linhas[0].localRetirada).toBe("Retirada Noroeste");
    expect(resolveLocalOptionId(linhas[0].unidadeId, linhas[0].localRetirada, linhas[0].localKey, locaisOpcoes)).toBe(
      "noroeste",
    );
  });

  it("exibe Entrega Motoboy para pedidos delivery", () => {
    const row = {
      ...baseRow(),
      tipo: "delivery",
      unidade_id: null,
      endereco_ou_unidade: "SQN 102 Bloco A — Asa Norte",
    };
    const pedido = rowToPedidoSalvo(row);
    const linhas = flattenPedidosParaLinhas([pedido], [row], []);

    expect(linhas[0].localRetirada).toBe("Entrega Motoboy");
    expect(linhas[0].localKey).toBe("entrega motoboy");
    expect(linhas[0].unidadeId).toBeNull();
    expect(resolveLocalOptionId(linhas[0].unidadeId, linhas[0].localRetirada, linhas[0].localKey, locaisOpcoes)).toBe(
      ENTREGA_MOTOBOY_ID,
    );
  });

  it("extrai tamanho da cesta para coluna dedicada", () => {
    const row = {
      ...baseRow(),
      cesta: { nome: "Bolo de Pistache · Tam. M", quantidade: 1, preco: 280, tamanho: "M" },
    };
    const pedido = rowToPedidoSalvo(row);
    const linhas = flattenPedidosParaLinhas([pedido], [row], []);

    expect(linhas[0].produto).toBe("Bolo de Pistache");
    expect(linhas[0].tamanho).toBe("M");
  });

  it("mapeia unidadeId em rowToPedidoSalvo", () => {
    const row = baseRow();
    expect(rowToPedidoSalvo(row).unidadeId).toBe("asa-sul");
  });
});

describe("resolveLocalOptionId", () => {
  it("resolve por unidadeId", () => {
    expect(resolveLocalOptionId("asa-sul", "Retirada 104", "retirada 104", locaisOpcoes)).toBe("asa-sul");
  });

  it("resolve por label quando unidade_id é null", () => {
    expect(resolveLocalOptionId(null, "Retirada Noroeste", "retirada noroeste", locaisOpcoes)).toBe("noroeste");
  });

  it("resolve entrega motoboy", () => {
    expect(resolveLocalOptionId(null, "Entrega Motoboy", "entrega motoboy", locaisOpcoes)).toBe(ENTREGA_MOTOBOY_ID);
  });
});

describe("LOCAIS_RETIRADA_OPCOES", () => {
  it("tem as três opções da planilha", () => {
    expect(LOCAIS_RETIRADA_OPCOES.map((l) => l.label)).toEqual([
      "Retirada 104",
      "Retirada Noroeste",
      "Entrega Motoboy",
    ]);
  });

  it("não inclui SAAN", () => {
    expect(LOCAIS_RETIRADA_OPCOES.some((l) => l.id === "saan")).toBe(false);
  });
});
