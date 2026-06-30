import { describe, expect, it } from "vitest";
import { flattenPedidosParaLinhas } from "@/lib/encomendasTable";
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
    expect(linhas[0].qtd).toBe(1);
    expect(linhas[0].setor).toBe("Confeitaria");
    expect(linhas[0].localRetirada).toBe("Asa Sul");
    expect(linhas[0].diaSemana).toMatch(/feira/);
  });
});
