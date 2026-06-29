import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient } from "@/integrations/supabase/client.server";
import {
  validateDisponibilidade,
  type CarrinhoItem,
} from "@/lib/availability";
import type { ProdutoRegras } from "@/lib/availability/types";

const bodySchema = z.object({
  itens: z.array(
    z.object({
      produto_id: z.string(),
      produto_tipo: z.enum(["cesta", "sobremesa"]),
      nome: z.string(),
    }),
  ),
  fulfillmentMode: z.enum(["delivery", "retirada"]),
  unidadeId: z.string().optional(),
  candidateDate: z.string().optional(),
  candidateHorario: z.string().optional(),
  horariosCampanha: z.array(z.string()).optional(),
});

async function loadDbRules(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  itens: CarrinhoItem[],
) {
  const ids = itens.map((i) => i.produto_id);
  const { data } = await admin
    .from("produto_regras")
    .select("*")
    .in("produto_id", ids);
  const map = new Map<string, Partial<ProdutoRegras>>();
  for (const row of data ?? []) {
    map.set(`${row.produto_tipo}:${row.produto_id}`, row as Partial<ProdutoRegras>);
  }
  return map;
}

export const Route = createFileRoute("/api/disponibilidade")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }
        const parsed = bodySchema.safeParse(json);
        if (!parsed.success) {
          return Response.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 });
        }

        const admin = getAdminClient();
        const dbRules = admin ? await loadDbRules(admin, parsed.data.itens) : new Map();

        const result = validateDisponibilidade(
          parsed.data,
          dbRules,
          parsed.data.horariosCampanha,
        );
        return Response.json(result);
      },
    },
  },
});
