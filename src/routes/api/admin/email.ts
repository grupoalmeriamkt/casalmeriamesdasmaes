import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, requireAdmin } from "@/lib/authServer";
import { dispatchEmail } from "@/lib/emailDispatch.server";
import { isResendConfigured } from "@/integrations/resend/client.server";

const BodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("test"),
    to: z.string().email(),
  }),
  z.object({
    action: z.literal("send"),
    to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
    subject: z.string().min(1).max(200),
    html: z.string().min(1),
    text: z.string().optional(),
  }),
]);

export const Route = createFileRoute("/api/admin/email")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!(await requireAdmin(auth.admin, auth.user.id))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

        return Response.json({ configured: isResendConfigured() });
      },

      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!(await requireAdmin(auth.admin, auth.user.id))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

        if (!isResendConfigured()) {
          return Response.json({ error: "resend_not_configured" }, { status: 503 });
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

        if (parsed.data.action === "test") {
          const html = "<p>Congrats on sending your <strong>first email</strong>!</p>";
          const result = await dispatchEmail(auth.admin, {
            tipo: "teste",
            to: parsed.data.to,
            subject: "Teste — Casa Almeria",
            html,
            text: "Congrats on sending your first email!",
            metadata: { html, text: "Congrats on sending your first email!" },
          });
          if (!result.ok) {
            return Response.json({ error: result.error }, { status: 400 });
          }
          return Response.json({ ok: true, id: result.resendId, logId: result.logId });
        }

        const { to, subject, html, text } = parsed.data;
        const result = await dispatchEmail(auth.admin, {
          tipo: "manual",
          to,
          subject,
          html,
          text,
          metadata: { html, text },
        });
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: 400 });
        }
        return Response.json({ ok: true, id: result.resendId, logId: result.logId });
      },
    },
  },
});
