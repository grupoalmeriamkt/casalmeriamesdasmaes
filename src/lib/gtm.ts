// Helpers para enviar eventos ao Google Tag Manager via dataLayer.
// O script do GTM é injetado dinamicamente em src/components/GTMLoader.tsx
// quando o admin configura um gtmId em Integrações.

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function gtmPush(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

// Eventos padrão do funil
export const trackPageView = (path?: string) =>
  gtmPush("page_view", {
    page_path: path ?? (typeof window !== "undefined" ? window.location.pathname : ""),
  });

export const trackBeginCheckout = (params: Record<string, unknown> = {}) =>
  gtmPush("begin_checkout", params);

// "Inicio de cadastro" — quando o usuário começa a preencher seus dados
export const trackLeadStart = (params: Record<string, unknown> = {}) =>
  gtmPush("generate_lead", { lead_status: "started", ...params });

// "Cadastro completado" — quando nome + whatsapp foram salvos
export const trackLeadComplete = (params: Record<string, unknown> = {}) =>
  gtmPush("sign_up", { method: "whatsapp", ...params });

export const trackAddPaymentInfo = (params: Record<string, unknown> = {}) =>
  gtmPush("add_payment_info", params);

export const trackPurchase = (params: {
  transaction_id: string;
  value: number;
  currency?: string;
  items?: Record<string, unknown>[];
  [key: string]: unknown;
}) =>
  gtmPush("purchase", { currency: "BRL", ...params });
