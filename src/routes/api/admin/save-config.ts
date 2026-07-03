// API route server-side para salvar configurações usando service role (bypass RLS).
// Requer Authorization: Bearer <supabase_access_token> — verifica que o usuário está autenticado.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, requireAdmin } from "@/lib/authServer";

const BodySchema = z.object({
  publicPayload: z.record(z.string(), z.unknown()),
  secrets: z
    .object({
      metaAccessToken: z.string().optional(),
      mpAccessToken: z.string().optional(),
      webhookUrl: z.string().optional(),
    })
    .optional(),
});

export const Route = createFileRoute("/api/admin/save-config")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return new Response("unauthorized", { status: 401 });
        if (!(await requireAdmin(auth.admin, auth.user.id))) {
          return new Response("forbidden", { status: 403 });
        }
        const { admin } = auth;

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

        const { publicPayload, secrets } = parsed.data;

        // Salva config pública (sem segredos) — service role bypassa RLS
        const { error: configErr } = await admin.from("app_config").upsert(
          {
            id: "default",
            payload: publicPayload,
            atualizado_em: new Date().toISOString(),
          },
          { onConflict: "id" },
        );
        if (configErr) {
          console.error("[save-config] app_config upsert error", configErr);
          return Response.json({ error: configErr.message }, { status: 500 });
        }

        // Salva segredos se houver campos preenchidos
        if (secrets) {
          const hasAny = Object.values(secrets).some(Boolean);
          if (hasAny) {
            const { data: existing } = await admin
              .from("app_secrets")
              .select("payload")
              .eq("id", "default")
              .maybeSingle();
            const current = (existing?.payload as Record<string, string>) ?? {};
            const merged = { ...current };
            if (secrets.metaAccessToken) merged.metaAccessToken = secrets.metaAccessToken;
            if (secrets.mpAccessToken) merged.mpAccessToken = secrets.mpAccessToken;
            if (secrets.webhookUrl) merged.webhookUrl = secrets.webhookUrl;

            const { error: secErr } = await admin.from("app_secrets").upsert(
              { id: "default", payload: merged, atualizado_em: new Date().toISOString() },
              { onConflict: "id" },
            );
            if (secErr) {
              console.error("[save-config] app_secrets upsert error", secErr);
              return Response.json({ error: secErr.message }, { status: 500 });
            }
          }
        }

        return Response.json({ ok: true });
      },
    },
  },
});
