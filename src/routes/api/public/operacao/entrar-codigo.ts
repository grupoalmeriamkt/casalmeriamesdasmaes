import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient } from "@/integrations/supabase/client.server";
import { getRemoteIp, rateLimit } from "@/lib/rateLimit.server";
import { CODIGO_ACESSO_REGEX } from "@/lib/operacaoCodigo";
import { entrarComCodigo } from "@/lib/operacaoCodigo.server";

const BodySchema = z.object({
  codigo: z.string().trim().regex(CODIGO_ACESSO_REGEX),
});

export const Route = createFileRoute("/api/public/operacao/entrar-codigo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const limited = rateLimit(request, "public/operacao/entrar-codigo", {
          max: 10,
          windowMs: 60_000,
        });
        if (limited) return limited;

        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }
        const parsed = BodySchema.safeParse(json);
        if (!parsed.success) {
          return Response.json({ error: "codigo_invalido" }, { status: 400 });
        }

        const admin = getAdminClient();
        if (!admin) return Response.json({ error: "db" }, { status: 503 });

        const res = await entrarComCodigo(admin, parsed.data.codigo, getRemoteIp(request));
        if (res.ok) return Response.json({ tokenHash: res.tokenHash });
        if (res.motivo === "bloqueado") {
          return Response.json({ error: "muitas_tentativas" }, { status: 429 });
        }
        if (res.motivo === "invalido") {
          return Response.json({ error: "codigo_invalido" }, { status: 401 });
        }
        return Response.json({ error: "erro_interno" }, { status: 500 });
      },
    },
  },
});
