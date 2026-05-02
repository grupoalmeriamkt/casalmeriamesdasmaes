// Meta Pixel (browser) + helpers para enviar eventos com deduplicação CAPI.
// O script do Pixel é injetado dinamicamente em src/components/MetaPixelLoader.tsx
// quando o admin configura um Pixel ID em Integrações.

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: (...args: unknown[]) => void;
    };
    _fbq?: unknown;
  }
}

export function isPixelReady(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

/** Gera um event_id estável para deduplicar Pixel + CAPI */
export function newEventId(prefix = "evt"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${rand}`;
}

type PixelEventName = "PageView" | "Lead" | "ViewContent" | "InitiateCheckout" | "AddPaymentInfo" | "Purchase";

export function fbqTrack(
  event: PixelEventName,
  params: Record<string, unknown> = {},
  eventId?: string,
) {
  if (!isPixelReady()) return;
  // window.fbq("track", "Lead", params, { eventID })
  window.fbq!("track", event, params, eventId ? { eventID: eventId } : undefined);
}

/**
 * Envia um evento ao backend para repasse via Conversions API.
 * Usa o mesmo event_id do Pixel para que o Meta deduplique.
 */
export async function sendCapiEvent(input: {
  pixelId: string;
  testEventCode?: string;
  eventName: PixelEventName;
  eventId: string;
  eventSourceUrl?: string;
  userData?: {
    email?: string;
    phone?: string; // só dígitos, com DDI
    firstName?: string;
    lastName?: string;
    externalId?: string;
  };
  customData?: Record<string, unknown>;
}): Promise<void> {
  if (!input.pixelId) return;
  // O Access Token NUNCA trafega pelo cliente — o servidor lê do banco.
  try {
    await fetch("/api/public/meta-capi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input,
        eventSourceUrl:
          input.eventSourceUrl ??
          (typeof window !== "undefined" ? window.location.href : undefined),
      }),
      keepalive: true,
    });
  } catch (err) {
    // Silencioso — não bloqueia UX
    console.warn("[meta-capi] falha ao enviar evento", err);
  }
}
