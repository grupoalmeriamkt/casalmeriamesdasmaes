import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient, getAppSecrets } from "@/integrations/supabase/client.server";
import { rateLimit } from "@/lib/rateLimit.server";
import {
  checkoutAccessDenied,
  readCheckoutAccessToken,
  verifyPedidoAccess,
} from "@/lib/checkoutAccess.server";

const ItemSchema = z.object({
  title: z.string().min(1).max(256),
  quantity: z.number().int().min(1).max(999),
  unit_price: z.number().min(0).max(1_000_000),
});

const BodySchema = z.object({
  items: z.array(ItemSchema).min(1).max(50),
  payer: z
    .object({
      name: z.string().max(120).optional(),
      phone: z.string().max(32).optional(),
    })
    .optional(),
  externalReference: z.string().uuid(),
  backUrls: z
    .object({
      success: z.string().url(),
      failure: z.string().url(),
      pending: z.string().url(),
    })
    .optional(),
  installments: z.number().int().min(1).max(24).optional(),
  notificationUrl: z.string().url().optional(),
});

export const Route = createFileRoute("/api/public/mp-preference")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const limited = rateLimit(request, "public/mp-preference", { max: 20, windowMs: 60_000 });
        if (limited) return limited;

        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const parsed = BodySchema.safeParse(json);
        if (!parsed.success) {
          return Response.json(
            { error: "validation_error", details: parsed.error.flatten() },
            { status: 400 },
          );
        }

        // Token NUNCA vem do cliente.
        const secrets = await getAppSecrets();
        const accessToken = secrets.mpAccessToken;
        if (!accessToken) {
          return Response.json(
            { error: "mp_not_configured" },
            { status: 503 },
          );
        }

        const {
          items,
          payer,
          externalReference,
          backUrls,
          installments,
          notificationUrl,
        } = parsed.data;

        const admin = getAdminClient();
        if (!admin) {
          return Response.json({ error: "db_unavailable" }, { status: 503 });
        }

        const checkoutAccess = readCheckoutAccessToken(request);
        if (!(await verifyPedidoAccess(admin, externalReference, checkoutAccess))) {
          return checkoutAccessDenied();
        }

        const { data: pedido, error: pedidoErr } = await admin
          .from("pedidos")
          .select("total, status")
          .eq("id", externalReference)
          .maybeSingle();
        if (pedidoErr || !pedido) {
          return Response.json({ error: "pedido_nao_encontrado" }, { status: 404 });
        }
        if (pedido.status === "pago" || pedido.status === "cancelado") {
          return Response.json({ error: "pedido_indisponivel" }, { status: 409 });
        }

        const itemsTotal = Number(
          items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0).toFixed(2),
        );
        const totalPedido = Number(pedido.total ?? 0);
        if (totalPedido <= 0 || Math.abs(itemsTotal - totalPedido) > 0.01) {
          return Response.json({ error: "total_mismatch" }, { status: 400 });
        }

        const [firstName, ...rest] = (payer?.name ?? "").trim().split(/\s+/);
        const phoneDigits = (payer?.phone ?? "").replace(/\D/g, "");

        const preference: Record<string, unknown> = {
          items: items.map((it, idx) => ({
            id: `item-${idx}`,
            title: it.title,
            quantity: it.quantity,
            unit_price: it.unit_price,
            currency_id: "BRL",
          })),
          payment_methods: {
            installments: installments ?? 3,
          },
        };

        if (firstName) {
          preference.payer = {
            name: firstName,
            surname: rest.join(" ") || undefined,
            phone: phoneDigits
              ? {
                  area_code: phoneDigits.slice(0, 2),
                  number: phoneDigits.slice(2),
                }
              : undefined,
          };
        }
        if (externalReference) preference.external_reference = externalReference;
        if (backUrls) {
          preference.back_urls = backUrls;
          preference.auto_return = "approved";
        }
        if (notificationUrl) preference.notification_url = notificationUrl;

        try {
          const res = await fetch(
            "https://api.mercadopago.com/checkout/preferences",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(preference),
            },
          );
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            console.error("[mp-preference] erro MP", res.status, body);
            return Response.json(
              { error: "mp_api_error", status: res.status },
              { status: 502 },
            );
          }
          return Response.json({
            ok: true,
            id: body.id,
            init_point: body.init_point,
            sandbox_init_point: body.sandbox_init_point,
          });
        } catch (err) {
          console.error("[mp-preference] fetch falhou", err);
          return Response.json({ error: "network_error" }, { status: 502 });
        }
      },
    },
  },
});
