import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient } from "@/integrations/supabase/client.server";

const CupomCreateSchema = z.object({
  codigo: z.string().trim().min(2).max(40),
  tipo: z.enum(["percentual", "fixo"]),
  valor: z.number().positive(),
  ativo: z.boolean().default(true),
  validade: z.string().nullable().optional(),
  uso_max: z.number().int().positive().nullable().optional(),
  valor_minimo: z.number().min(0).nullable().optional(),
  campanha_ids: z.array(z.string()).nullable().optional(),
  produto_ids: z.array(z.string()).nullable().optional(),
});

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }),
  z.object({ action: z.literal("create"), data: CupomCreateSchema }),
  z.object({
    action: z.literal("update"),
    id: z.string().uuid(),
    data: CupomCreateSchema.partial(),
  }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
]);

async function checkFilterColumns(admin: NonNullable<ReturnType<typeof getAdminClient>>): Promise<boolean> {
  try {
    const { error } = await admin
      .from("cupons")
      .select("campanha_ids")
      .limit(0);
    return !error;
  } catch {
    return false;
  }
}

async function authenticate(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return { admin, user: data.user };
}

export const Route = createFileRoute("/api/admin/cupons")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return new Response("unauthorized", { status: 401 });
        const { admin } = auth;

        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const parsed = BodySchema.safeParse(json);
        if (!parsed.success) {
          return Response.json({ error: "validation_error", issues: parsed.error.issues }, { status: 400 });
        }

        const body = parsed.data;

        if (body.action === "list") {
          const { data, error } = await admin
            .from("cupons")
            .select("*")
            .order("criado_em", { ascending: false });
          if (error) return Response.json({ error: error.message }, { status: 500 });
          return Response.json({ cupons: data });
        }

        if (body.action === "create") {
          const hasFilterCols = await checkFilterColumns(admin);

          const insertData: Record<string, unknown> = {
            codigo: body.data.codigo.toUpperCase(),
            tipo: body.data.tipo,
            valor: body.data.valor,
            ativo: body.data.ativo ?? true,
            validade: body.data.validade || null,
            uso_max: body.data.uso_max ?? null,
            valor_minimo: body.data.valor_minimo ?? null,
          };
          if (hasFilterCols) {
            insertData.campanha_ids = body.data.campanha_ids ?? null;
            insertData.produto_ids = body.data.produto_ids ?? null;
          }

          const { data, error } = await admin
            .from("cupons")
            .insert(insertData)
            .select()
            .single();
          if (error) return Response.json({ error: error.message }, { status: 500 });
          return Response.json({ cupom: data });
        }

        if (body.action === "update") {
          const hasFilterCols = await checkFilterColumns(admin);
          const updateData: Record<string, unknown> = {};
          if (body.data.codigo) updateData.codigo = body.data.codigo.toUpperCase();
          if (body.data.tipo !== undefined) updateData.tipo = body.data.tipo;
          if (body.data.valor !== undefined) updateData.valor = body.data.valor;
          if (body.data.ativo !== undefined) updateData.ativo = body.data.ativo;
          if ("validade" in body.data) updateData.validade = body.data.validade || null;
          if (body.data.uso_max !== undefined) updateData.uso_max = body.data.uso_max ?? null;
          if (body.data.valor_minimo !== undefined) updateData.valor_minimo = body.data.valor_minimo ?? null;
          if (hasFilterCols) {
            if (body.data.campanha_ids !== undefined) updateData.campanha_ids = body.data.campanha_ids ?? null;
            if (body.data.produto_ids !== undefined) updateData.produto_ids = body.data.produto_ids ?? null;
          }
          updateData.atualizado_em = new Date().toISOString();

          const { data, error } = await admin
            .from("cupons")
            .update(updateData)
            .eq("id", body.id)
            .select()
            .single();
          if (error) return Response.json({ error: error.message }, { status: 500 });
          return Response.json({ cupom: data });
        }

        if (body.action === "delete") {
          const { error } = await admin.from("cupons").delete().eq("id", body.id);
          if (error) return Response.json({ error: error.message }, { status: 500 });
          return Response.json({ ok: true });
        }

        return new Response("unknown action", { status: 400 });
      },
    },
  },
});
