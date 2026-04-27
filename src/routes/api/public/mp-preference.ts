import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const ItemSchema = z.object({
  title: z.string().min(1).max(256),
  quantity: z.number().int().min(1).max(999),
  unit_price: z.number().min(0).max(1_000_000),
});

const BodySchema = z.object({
  accessToken: z.string().min(20).max(500),
  items: z.array(ItemSchema).min(1).max(50),
  payer: z
    .object({
      name: z.string().max(120).optional(),
      phone: z.string().max(32).optional(),
    })
    .optional(),
  externalReference: z.string().max(128).optional(),
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

        const {
          accessToken,
          items,
          payer,
          externalReference,
          backUrls,
          installments,
          notificationUrl,
        } = parsed.data;

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
              { error: "mp_api_error", status: res.status, body },
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
