import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient, getAppSecrets } from "@/integrations/supabase/client.server";
import { makeAsaasClient, AsaasError } from "@/integrations/asaas/client.server";
import type { AsaasCreatePayment, AsaasSplit } from "@/integrations/asaas/types";

const ItemSchema = z.object({
  nome: z.string().min(1).max(200),
  quantidade: z.number().int().min(1).max(99),
  preco: z.number().min(0).max(1_000_000),
});

const ClienteSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  cpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
  email: z.string().email().max(180),
  whatsapp: z.string().regex(/^\d{10,11}$/, "WhatsApp 10–11 dígitos"),
});

const CartaoSchema = z.object({
  holderName: z.string().min(2).max(120),
  number: z.string().regex(/^\d{13,19}$/),
  expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/),
  expiryYear: z.string().regex(/^\d{4}$/),
  ccv: z.string().regex(/^\d{3,4}$/),
});

const HolderInfoSchema = z.object({
  postalCode: z.string().regex(/^\d{8}$/),
  addressNumber: z.string().min(1).max(10),
  addressComplement: z.string().max(80).optional(),
});

const BodySchema = z
  .object({
    pedidoId: z.string().uuid(),
    cliente: ClienteSchema,
    itens: z.array(ItemSchema).min(1).max(50),
    total: z.number().min(1).max(1_000_000),
    metodo: z.enum(["PIX", "CREDIT_CARD"]),
    cupomCodigo: z.string().max(40).optional(),
    cartao: CartaoSchema.optional(),
    holderInfo: HolderInfoSchema.optional(),
  })
  .refine(
    (b) => b.metodo !== "CREDIT_CARD" || (b.cartao && b.holderInfo),
    "Cartão e dados do titular obrigatórios para CREDIT_CARD",
  );

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getRemoteIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "0.0.0.0"
  );
}

export const Route = createFileRoute("/api/public/asaas/charge")({
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
        const body = parsed.data;

        const admin = getAdminClient();
        if (!admin) {
          return Response.json({ error: "supabase_not_configured" }, { status: 503 });
        }

        const secrets = await getAppSecrets();
        if (!secrets.asaasApiKey) {
          return Response.json({ error: "asaas_not_configured" }, { status: 503 });
        }
        const asaas = makeAsaasClient(secrets.asaasApiKey);

        // Valida cupom server-side (defesa contra manipulação do total no cliente)
        let descontoAplicado = 0;
        let cupomValido: string | undefined;
        if (body.cupomCodigo) {
          const { data: cupomRes, error: cupomErr } = await admin.rpc("validar_cupom", {
            _codigo: body.cupomCodigo,
            _valor: body.total,
          });
          if (cupomErr) {
            console.error("[asaas/charge] validar_cupom erro", cupomErr);
            return Response.json({ error: "cupom_check_failed" }, { status: 500 });
          }
          const row = (cupomRes ?? [])[0] as
            | { valido: boolean; motivo: string; desconto: number; codigo: string }
            | undefined;
          if (!row?.valido) {
            return Response.json(
              { error: "cupom_invalido", motivo: row?.motivo ?? "Cupom inválido" },
              { status: 400 },
            );
          }
          descontoAplicado = Number(row.desconto);
          cupomValido = row.codigo;
        }

        const valorFinal = Math.max(1, Number((body.total - descontoAplicado).toFixed(2)));

        // Confere pedido existe e pertence ao fluxo
        const { data: pedido, error: pedErr } = await admin
          .from("pedidos")
          .select("id, total, status")
          .eq("id", body.pedidoId)
          .maybeSingle();
        if (pedErr || !pedido) {
          return Response.json({ error: "pedido_nao_encontrado" }, { status: 404 });
        }

        // Asaas: customer + payment
        try {
          const customer = await asaas.upsertCustomer({
            name: body.cliente.nome,
            cpfCnpj: body.cliente.cpf,
            email: body.cliente.email,
            mobilePhone: body.cliente.whatsapp,
            externalReference: body.cliente.cpf,
          });

          const split: AsaasSplit[] | undefined = secrets.asaasWalletId
            ? [{ walletId: secrets.asaasWalletId, percentualValue: 100 }]
            : undefined;

          const description = body.itens
            .map((i) => `${i.quantidade}x ${i.nome}`)
            .join(" | ")
            .slice(0, 480);

          const paymentInput: AsaasCreatePayment = {
            customer: customer.id,
            billingType: body.metodo,
            value: valorFinal,
            dueDate: todayPlus(body.metodo === "PIX" ? 1 : 0),
            description,
            externalReference: body.pedidoId,
            remoteIp: getRemoteIp(request),
            split,
          };

          if (body.metodo === "CREDIT_CARD" && body.cartao && body.holderInfo) {
            paymentInput.creditCard = body.cartao;
            paymentInput.creditCardHolderInfo = {
              name: body.cliente.nome,
              email: body.cliente.email,
              cpfCnpj: body.cliente.cpf,
              phone: body.cliente.whatsapp,
              mobilePhone: body.cliente.whatsapp,
              postalCode: body.holderInfo.postalCode,
              addressNumber: body.holderInfo.addressNumber,
              addressComplement: body.holderInfo.addressComplement,
            };
          }

          const payment = await asaas.createPayment(paymentInput);

          let pixPayload: string | null = null;
          let pixImage: string | null = null;
          let pixExpiraEm: string | null = null;
          if (body.metodo === "PIX") {
            const qr = await asaas.getPixQrCode(payment.id);
            pixPayload = qr.payload;
            pixImage = qr.encodedImage;
            pixExpiraEm = qr.expirationDate ? new Date(qr.expirationDate).toISOString() : null;
          }

          const pagamentoRow = {
            pedido_id: body.pedidoId,
            asaas_payment_id: payment.id,
            asaas_customer_id: customer.id,
            metodo: body.metodo,
            status: payment.status,
            valor: valorFinal,
            cupom_codigo: cupomValido ?? null,
            cupom_desconto: descontoAplicado || null,
            pix_qrcode_payload: pixPayload,
            pix_qrcode_image: pixImage,
            pix_expira_em: pixExpiraEm,
            cartao_last4: payment.creditCard?.creditCardNumber ?? null,
            cartao_brand: payment.creditCard?.creditCardBrand ?? null,
            cartao_token: payment.creditCard?.creditCardToken ?? null,
            raw_response: payment as unknown as Record<string, unknown>,
          };

          const { data: pagamentoIns, error: insErr } = await admin
            .from("pagamentos")
            .insert(pagamentoRow)
            .select("id")
            .single();
          if (insErr) {
            console.error("[asaas/charge] insert pagamentos", insErr);
            return Response.json({ error: "db_error" }, { status: 500 });
          }

          // Atualiza pedido com snapshot do pagamento (mantém compatibilidade com pagamento jsonb)
          await admin
            .from("pedidos")
            .update({
              cliente_cpf: body.cliente.cpf,
              cliente_email: body.cliente.email,
              pagamento: {
                metodo: body.metodo.toLowerCase(),
                status: payment.status,
                pagamento_id: pagamentoIns.id,
                asaas_payment_id: payment.id,
                cupom: cupomValido ?? null,
                desconto: descontoAplicado || 0,
              },
              status:
                body.metodo === "CREDIT_CARD" && payment.status === "CONFIRMED"
                  ? "pago"
                  : "aguardando_pagamento",
            })
            .eq("id", body.pedidoId);

          return Response.json({
            ok: true,
            pagamentoId: pagamentoIns.id,
            asaasPaymentId: payment.id,
            metodo: body.metodo,
            status: payment.status,
            valor: valorFinal,
            desconto: descontoAplicado,
            pix:
              body.metodo === "PIX"
                ? {
                    payload: pixPayload,
                    image: pixImage,
                    expiraEm: pixExpiraEm,
                  }
                : null,
            cartao:
              body.metodo === "CREDIT_CARD"
                ? {
                    last4: payment.creditCard?.creditCardNumber ?? null,
                    brand: payment.creditCard?.creditCardBrand ?? null,
                  }
                : null,
          });
        } catch (e) {
          if (e instanceof AsaasError) {
            console.error("[asaas/charge] AsaasError", e.status, e.body);
            const motivo =
              (e.body as { errors?: { description?: string }[] })?.errors?.[0]?.description ??
              "Falha no processamento do pagamento";
            return Response.json(
              { error: "asaas_error", status: e.status, motivo, body: e.body },
              { status: e.status === 400 ? 400 : 502 },
            );
          }
          console.error("[asaas/charge] erro", e);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
