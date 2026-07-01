import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, requireAdmin } from "@/lib/authServer";

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancelar"), id: z.string().uuid() }),
  z.object({ action: z.literal("excluir"), id: z.string().uuid() }),
  z.object({
    action: z.literal("arquivar"),
    ids: z.array(z.string().uuid()).min(1).max(200),
  }),
  z.object({
    action: z.literal("desarquivar"),
    ids: z.array(z.string().uuid()).min(1).max(200),
  }),
  z.object({
    action: z.literal("atualizar_operacao"),
    id: z.string().uuid(),
    production_sector: z
      .enum([
        "CONFEITARIA",
        "PADARIA",
        "COZINHA",
        "COZINHA_104_SUL",
        "COZINHA_104_CONFEITARIA",
      ])
      .optional(),
    unidade_id: z.string().nullable().optional(),
    endereco_ou_unidade: z.string().optional(),
  }),
]);

export const Route = createFileRoute("/api/admin/pedidos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!(await requireAdmin(auth.admin, auth.user.id))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

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

        const { action } = parsed.data;

        if (action === "cancelar") {
          const { id } = parsed.data;
          const { error } = await auth.admin
            .from("pedidos")
            .update({ status: "cancelado" })
            .eq("id", id);
          if (error) {
            console.error("[admin/pedidos] cancelar error", error);
            return Response.json({ error: error.message }, { status: 500 });
          }
          return Response.json({ ok: true });
        }

        if (action === "excluir") {
          const { id } = parsed.data;
          // Pagamentos são excluídos em cascata pelo FK (ON DELETE CASCADE)
          const { error } = await auth.admin.from("pedidos").delete().eq("id", id);
          if (error) {
            console.error("[admin/pedidos] excluir error", error);
            return Response.json({ error: error.message }, { status: 500 });
          }
          return Response.json({ ok: true });
        }

        if (action === "arquivar") {
          const { ids } = parsed.data;
          const archivedBy = auth.user.email ?? auth.user.id;
          const { data, error } = await auth.admin
            .from("pedidos")
            .update({ archived_at: new Date().toISOString(), archived_by: archivedBy })
            .in("id", ids)
            .is("archived_at", null)
            .select("id");
          if (error) {
            console.error("[admin/pedidos] arquivar error", error);
            return Response.json({ error: error.message }, { status: 500 });
          }
          return Response.json({ ok: true, arquivados: data?.length ?? 0 });
        }

        if (action === "desarquivar") {
          const { ids } = parsed.data;
          const { data, error } = await auth.admin
            .from("pedidos")
            .update({ archived_at: null, archived_by: null })
            .in("id", ids)
            .not("archived_at", "is", null)
            .select("id");
          if (error) {
            console.error("[admin/pedidos] desarquivar error", error);
            return Response.json({ error: error.message }, { status: 500 });
          }
          return Response.json({ ok: true, desarquivados: data?.length ?? 0 });
        }

        if (action === "atualizar_operacao") {
          const { id, production_sector, unidade_id, endereco_ou_unidade } = parsed.data;
          const patch: Record<string, string | null> = {};
          if (production_sector !== undefined) patch.production_sector = production_sector;
          if (unidade_id !== undefined) patch.unidade_id = unidade_id;
          if (endereco_ou_unidade !== undefined) patch.endereco_ou_unidade = endereco_ou_unidade;
          if (Object.keys(patch).length === 0) {
            return Response.json({ error: "nenhum_campo" }, { status: 400 });
          }
          const { error } = await auth.admin.from("pedidos").update(patch).eq("id", id);
          if (error) {
            console.error("[admin/pedidos] atualizar_operacao error", error);
            return Response.json({ error: error.message }, { status: 500 });
          }
          return Response.json({ ok: true });
        }

        return Response.json({ error: "unknown_action" }, { status: 400 });
      },
    },
  },
});
