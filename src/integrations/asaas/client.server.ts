// SERVIDOR APENAS — chamadas autenticadas à API do Asaas.
import type {
  AsaasCreateCustomer,
  AsaasCustomer,
  AsaasCreatePayment,
  AsaasPayment,
  AsaasPixQrCode,
  AsaasWebhookConfig,
} from "./types";

const ASAAS_BASE = "https://api.asaas.com/v3";

export class AsaasError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Asaas API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    access_token: apiKey,
    "User-Agent": "casalmeria-checkout/1.0",
  };
}

async function asaasFetch<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const url = `${ASAAS_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(apiKey), ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new AsaasError(res.status, body);
  }
  return body as T;
}

export function makeAsaasClient(apiKey: string) {
  if (!apiKey) throw new Error("Asaas API key não configurada");

  return {
    async findCustomerByCpf(cpfCnpj: string): Promise<AsaasCustomer | null> {
      const data = await asaasFetch<{ data: AsaasCustomer[]; totalCount: number }>(
        apiKey,
        `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`,
      );
      return data.data?.[0] ?? null;
    },

    async createCustomer(input: AsaasCreateCustomer): Promise<AsaasCustomer> {
      // Por padrão o Asaas não notifica o cliente (e-mail/SMS/WhatsApp); a comunicação é nossa.
      return asaasFetch<AsaasCustomer>(apiKey, "/customers", {
        method: "POST",
        body: JSON.stringify({ notificationDisabled: true, ...input }),
      });
    },

    async updateCustomer(
      customerId: string,
      input: Partial<AsaasCreateCustomer>,
    ): Promise<AsaasCustomer> {
      return asaasFetch<AsaasCustomer>(apiKey, `/customers/${customerId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
    },

    async upsertCustomer(input: AsaasCreateCustomer): Promise<AsaasCustomer> {
      const existing = await this.findCustomerByCpf(input.cpfCnpj);
      if (!existing) return this.createCustomer(input);
      // Cliente antigo pode ter notificações ligadas: o Asaas mandaria o link da cobrança
      // por e-mail/SMS. Desliga antes de criar a cobrança; falha não impede a venda.
      if (existing.notificationDisabled !== true) {
        try {
          return await this.updateCustomer(existing.id, { notificationDisabled: true });
        } catch (e) {
          console.error("[asaas] desligar notificações do cliente", existing.id, e);
        }
      }
      return existing;
    },

    async createPayment(input: AsaasCreatePayment): Promise<AsaasPayment> {
      return asaasFetch<AsaasPayment>(apiKey, "/payments", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },

    async getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
      return asaasFetch<AsaasPixQrCode>(apiKey, `/payments/${paymentId}/pixQrCode`);
    },

    async getPayment(paymentId: string): Promise<AsaasPayment> {
      return asaasFetch<AsaasPayment>(apiKey, `/payments/${paymentId}`);
    },

    async deletePayment(paymentId: string): Promise<{ deleted?: boolean; id?: string }> {
      return asaasFetch<{ deleted?: boolean; id?: string }>(apiKey, `/payments/${paymentId}`, {
        method: "DELETE",
      });
    },

    /** Webhooks cadastrados na conta (fila de avisos de pagamento para o site). */
    async listWebhooks(): Promise<AsaasWebhookConfig[]> {
      const data = await asaasFetch<{ data?: AsaasWebhookConfig[] }>(apiKey, "/webhooks");
      return data.data ?? [];
    },

    /** Estorno total da cobrança (PIX ou cartão). */
    async refundPayment(paymentId: string): Promise<AsaasPayment> {
      return asaasFetch<AsaasPayment>(apiKey, `/payments/${paymentId}/refund`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
  };
}

export type AsaasClient = ReturnType<typeof makeAsaasClient>;
