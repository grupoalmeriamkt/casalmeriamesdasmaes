// Helper server-side para enviar eventos diretamente à Meta Conversions API.
// Importar APENAS em código de servidor (api routes, server functions).
import { createHash } from "crypto";

type CapiEventName = "PageView" | "Lead" | "ViewContent" | "InitiateCheckout" | "AddPaymentInfo" | "Purchase";

const sha256 = (v: string) =>
  createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

const onlyDigits = (v: string) => v.replace(/\D/g, "");

export async function sendCapiEventServer(input: {
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
  eventName: CapiEventName;
  eventId: string;
  eventSourceUrl?: string;
  userAgent?: string;
  ipAddress?: string;
  userData?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    externalId?: string;
  };
  customData?: Record<string, unknown>;
}): Promise<void> {
  const { pixelId, accessToken, testEventCode, eventName, eventId, userData, customData } = input;
  if (!pixelId || !accessToken) return;

  const user_data: Record<string, unknown> = {
    client_user_agent: input.userAgent,
    client_ip_address: input.ipAddress,
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
        event_source_url: input.eventSourceUrl,
        action_source: "website",
        user_data,
        custom_data: customData ?? {},
      },
    ],
  };
  if (testEventCode) payload.test_event_code = testEventCode;

  try {
    const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("[meta-capi-server] erro Meta API", res.status, body);
    }
  } catch (err) {
    console.error("[meta-capi-server] fetch falhou", err);
  }
}
