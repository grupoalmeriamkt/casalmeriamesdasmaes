import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient } from "@/integrations/supabase/client.server";

const CAMPOS_PERMITIDOS = [
  "cliente_nome",
  "cliente_whatsapp",
  "endereco_ou_unidade",
  "data_entrega",
  "horario",
] as const;

type CampoPermitido = (typeof CAMPOS_PERMITIDOS)[number];

const BodySchema = z.object({
  token: z.string().min(1),
  pedido_id: z.string().uuid(),
  campos: z.record(z.string(), z.string().nullable()),
  destinatario: z
    .object({ nome: z.string(), whatsapp: z.string() })
    .nullable()
    .optional(),
});

export const Route = createFileRoute("/api/pedidos/editar-por-token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const admin = getAdminClient();
        if (!admin) return Response.json({ error: "db_unavailable" }, { status: 503 });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }

        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "invalid_body" }, { status: 400 });
        }

        const { token, pedido_id, campos, destinatario } = parsed.data;

        // Valida token
        const { data: tokenValido, error: tokenError } = await admin.rpc(
          "validar_token_pedidos",
          { _token: token, _senha: null },
        );
        if (tokenError || !tokenValido) {
          return Response.json({ error: "token_invalido" }, { status: 403 });
        }

        // Filtra apenas campos permitidos
        const update: Partial<Record<CampoPermitido, string | null>> = {};
        for (const [chave, valor] of Object.entries(campos)) {
          if ((CAMPOS_PERMITIDOS as readonly string[]).includes(chave)) {
            update[chave as CampoPermitido] = valor;
          }
        }

        if (Object.keys(update).length === 0 && destinatario === undefined) {
          return Response.json({ error: "nenhum_campo_valido" }, { status: 400 });
        }

        // Se destinatario veio, atualiza dentro do JSON pagamento
        if (destinatario !== undefined) {
          const { data: pedidoAtual, error: fetchError } = await admin
            .from("pedidos")
            .select("pagamento")
            .eq("id", pedido_id)
            .single();

          if (fetchError || !pedidoAtual) {
            return Response.json({ error: "pedido_nao_encontrado" }, { status: 404 });
          }

          const pagamentoAtualizado = {
            ...(pedidoAtual.pagamento as object),
            destinatario,
          };

          const { error: updatePagErr } = await admin
            .from("pedidos")
            .update({ pagamento: pagamentoAtualizado })
            .eq("id", pedido_id);

          if (updatePagErr) {
            console.error("[editar-por-token] erro pagamento", updatePagErr);
            return Response.json({ error: updatePagErr.message }, { status: 500 });
          }
        }

        if (Object.keys(update).length > 0) {
          const { error } = await admin.from("pedidos").update(update).eq("id", pedido_id);
          if (error) {
            console.error("[editar-por-token] erro update", error);
            return Response.json({ error: error.message }, { status: 500 });
          }
        }

        return Response.json({ ok: true });
      },
    },
  },
});
