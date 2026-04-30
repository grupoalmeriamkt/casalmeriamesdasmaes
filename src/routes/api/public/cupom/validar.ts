import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient } from "@/integrations/supabase/client.server";

const BodySchema = z.object({
  codigo: z.string().trim().min(2).max(40),
  total: z.number().min(0).max(1_000_000),
});

export const Route = createFileRoute("/api/public/cupom/validar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        const parsed = BodySchema.safeParse(json);
        if (!parsed.success) {
          return Response.json({ error: "validation_error" }, { status: 400 });
        }
        const admin = getAdminClient();
        if (!admin) return Response.json({ error: "db" }, { status: 503 });

        const { data, error } = await admin.rpc("validar_cupom", {
          _codigo: parsed.data.codigo,
          _valor: parsed.data.total,
        });
        if (error) {
          console.error("[cupom/validar] rpc", error);
          return Response.json({ error: "db_error" }, { status: 500 });
        }
        const row = (data ?? [])[0] as
          | { valido: boolean; motivo: string; desconto: number; codigo: string }
          | undefined;
        if (!row) return Response.json({ valido: false, motivo: "Cupom não encontrado" });
        return Response.json({
          valido: row.valido,
          motivo: row.motivo,
          desconto: Number(row.desconto),
          codigo: row.codigo,
        });
      },
    },
  },
});
