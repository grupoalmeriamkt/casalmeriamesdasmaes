import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createHash } from "crypto";

const BodySchema = z.object({
  pixelId: z.string().regex(/^\d{6,20}$/),
  accessToken: z.string().min(20).max(500),
  testEventCode: z.string().max(64).optional().or(z.literal("")),
  eventName: z.enum(["PageView", "Lead", "ViewContent", "InitiateCheckout", "Purchase"]),
  eventId: z.string().min(4).max(128),
  eventSourceUrl: z.string().url().max(2000).optional(),
  userData: z
    .object({
      email: z.string().email().max(254).optional(),
      phone: z.string().max(32).optional(),
      firstName: z.string().max(100).optional(),
      lastName: z.string().max(100).optional(),
      externalId: z.string().max(128).optional(),
    })
    .optional(),
  customData: z.record(z.string(), z.unknown()).optional(),
});

const sha256 = (v: string) =>
  createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

const onlyDigits = (v: string) => v.replace(/\D/g, "");

export const Route = createFileRoute("/api/public/meta-capi")({
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
          pixelId,
          accessToken,
          testEventCode,
          eventName,
          eventId,
          eventSourceUrl,
          userData,
          customData,
        } = parsed.data;

        // Hash dos PII conforme exigência da Meta
        const user_data: Record<string, unknown> = {
          client_user_agent: request.headers.get("user-agent") ?? undefined,
          client_ip_address:
            request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
            request.headers.get("x-real-ip") ??
            undefined,
        };

        if (userData?.email) user_data.em = [sha256(userData.email)];
        if (userData?.phone) user_data.ph = [sha256(onlyDigits(userData.phone))];
        if (userData?.firstName) user_data.fn = [sha256(userData.firstName)];
        if (userData?.lastName) user_data.ln = [sha256(userData.lastName)];
        if (userData?.externalId) user_data.external_id = [sha256(userData.externalId)];

        const payload: Record<string, unknown> = {
          data: [
            {
              event_name: eventName,
              event_time: Math.floor(Date.now() / 1000),
              event_id: eventId,
              event_source_url: eventSourceUrl,
              action_source: "website",
              user_data,
              custom_data: customData ?? {},
            },
          ],
        };
        if (testEventCode) payload.test_event_code = testEventCode;

        const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${encodeURIComponent(
          accessToken,
        )}`;

        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            console.error("[meta-capi] erro Meta API", res.status, body);
            return Response.json(
              { error: "meta_api_error", status: res.status, body },
              { status: 502 },
            );
          }
          return Response.json({ ok: true, meta: body });
        } catch (err) {
          console.error("[meta-capi] fetch falhou", err);
          return Response.json({ error: "network_error" }, { status: 502 });
        }
      },
    },
  },
});
