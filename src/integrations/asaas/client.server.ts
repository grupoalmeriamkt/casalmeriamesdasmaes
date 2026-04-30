// SERVIDOR APENAS — chamadas autenticadas à API do Asaas.
import type {
  AsaasCreateCustomer,
  AsaasCustomer,
  AsaasCreatePayment,
  AsaasPayment,
  AsaasPixQrCode,
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
      return asaasFetch<AsaasCustomer>(apiKey, "/customers", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },

    async upsertCustomer(input: AsaasCreateCustomer): Promise<AsaasCustomer> {
      const existing = await this.findCustomerByCpf(input.cpfCnpj);
      if (existing) return existing;
      return this.createCustomer(input);
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
  };
}

export type AsaasClient = ReturnType<typeof makeAsaasClient>;
