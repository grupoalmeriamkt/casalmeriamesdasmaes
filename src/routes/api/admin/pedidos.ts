import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, requireAdmin, canAccessCozinha, canAccessOperacao } from "@/lib/authServer";
import { manualOrderSchema } from "@/lib/orderForm/schema";
import { buildPedidoManualPayload } from "@/lib/orderForm/buildPayload";
import { ensureOperator } from "@/lib/operatorsServer";
import { getAppSecrets } from "@/integrations/supabase/client.server";
import { makeAsaasClient } from "@/integrations/asaas/client.server";
import type { AsaasCreatePayment } from "@/integrations/asaas/types";
import { notificarOpsPedidoPago } from "@/lib/opsNotify.server";
import { buildPagamentoManualPatch } from "@/lib/pedidoSync";

function deriveDueDate(dataEntrega: string | null): string {
  // Asaas exige YYYY-MM-DD. Usa a data de entrega se valida; senao hoje + 2 dias.
  if (dataEntrega && /^\d{4}-\d{2}-\d{2}$/.test(dataEntrega)) return dataEntrega;
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancelar"), id: z.string().uuid() }),
  z.object({
    action: z.literal("excluir"),
    id: z.string().uuid(),
    motivo: z.string().trim().min(3).max(500),
    excluidoPor: z.string().optional(),
  }),
  z.object({
    action: z.literal("arquivar"),
    ids: z.array(z.string().uuid()).min(1).max(200),
  }),
  z.object({
    action: z.literal("desarquivar"),
    ids: z.array(z.string().uuid()).min(1).max(200),
  }),
  z.object({
    action: z.literal("criar_manual"),
    pedido: manualOrderSchema,
  }),
  z.object({
    action: z.literal("gerar_link"),
    id: z.string().uuid(),
    cpf: z
      .string()
      .trim()
      .transform((v) => v.replace(/\D/g, ""))
      .pipe(z.string().regex(/^\d{11}$/, "CPF invalido")),
  }),
  z.object({
    action: z.literal("pagar_dinheiro"),
    id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("pagar_pos"),
    id: z.string().uuid(),
    pos: z.object({
      bandeira: z.string().min(1).max(30),
      tipo: z.enum(["credito", "debito"]),
      cpf: z
        .string()
        .transform((s) => s.replace(/\D/g, ""))
        .pipe(z.string().regex(/^\d{11}$/)),
      nome: z.string().min(2).max(120),
    }),
  }),
  z.object({
    action: z.literal("gerar_pix"),
    id: z.string().uuid(),
    cpf: z
      .string()
      .trim()
      .transform((v) => v.replace(/\D/g, ""))
      .pipe(z.string().regex(/^\d{11}$/, "CPF invalido")),
  }),
  z.object({
    action: z.literal("atualizar_operacao"),
    id: z.string().uuid(),
    production_sector: z
      .enum([
        "CONFEITARIA",
        "PADARIA",
        "COZINHA",
        "COZINHA_104_SUL",
        "COZINHA_104_CONFEITARIA",
      ])
      .optional(),
    unidade_id: z.string().nullable().optional(),
    endereco_ou_unidade: z.string().optional(),
    tipo: z.enum(["delivery", "retirada"]).optional(),
  }),
  z.object({
    action: z.literal("set_etapa"),
    id: z.string().uuid(),
    stage: z.enum(["confirmado", "em_preparo", "pronto", "finalizado"]),
  }),
  z.object({
    action: z.literal("avancar_etapa"),
    ids: z.array(z.string().uuid()).min(1).max(200),
  }),
  z.object({
    action: z.literal("marcar_pago"),
    ids: z.array(z.string().uuid()).min(1).max(200),
  }),
]);

const STAGE_ORDER = ["confirmado", "em_preparo", "pronto", "finalizado"] as const;

export const Route = createFileRoute("/api/admin/pedidos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }

        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "invalid_body" }, { status: 400 });
        }

        const { action } = parsed.data;
        const isAdmin = await requireAdmin(auth.admin, auth.user.id);
        const canCozinha = await canAccessCozinha(auth.admin, auth.user.id);
        const canOperacao = await canAccessOperacao(auth.admin, auth.user.id);

        if (!isAdmin && !canCozinha && !canOperacao) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

        if (!isAdmin && !canCozinha && canOperacao) {
          const allowed = action === "arquivar" || action === "criar_manual";
          if (!allowed) {
            return Response.json({ error: "forbidden" }, { status: 403 });
          }
        }

        if (action === "cancelar") {
          const { id } = parsed.data;
          const { error } = await auth.admin
            .from("pedidos")
            .update({ status: "cancelado" })
            .eq("id", id);
          if (error) {
            console.error("[admin/pedidos] cancelar error", error);
            return Response.json({ error: error.message }, { status: 500 });
          }
          return Response.json({ ok: true });
        }

        if (action === "excluir") {
          const { id, motivo, excluidoPor } = parsed.data;

          const { data: pedidoRow, error: pedidoErr } = await auth.admin
            .from("pedidos")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          if (pedidoErr || !pedidoRow) {
            console.error("[admin/pedidos] excluir select error", pedidoErr);
            return Response.json({ error: "pedido_nao_encontrado" }, { status: 404 });
          }

          const { error: archiveErr } = await auth.admin.from("pedidos_excluidos").insert({
            pedido_id: id,
            pedido_snapshot: pedidoRow,
            motivo,
            excluido_por: excluidoPor ?? null,
          });
          if (archiveErr) {
            console.error("[admin/pedidos] excluir archive error", archiveErr);
            return Response.json({ error: archiveErr.message }, { status: 500 });
          }

          // Pagamentos são excluídos em cascata pelo FK (ON DELETE CASCADE)
          const { error } = await auth.admin.from("pedidos").delete().eq("id", id);
          if (error) {
            console.error("[admin/pedidos] excluir error", error);
            return Response.json({ error: error.message }, { status: 500 });
          }
          return Response.json({ ok: true });
        }

        if (action === "arquivar") {
          const { ids } = parsed.data;
          const archivedBy = auth.user.email ?? auth.user.id;
          const agora = new Date().toISOString();
          const { data, error } = await auth.admin
            .from("pedidos")
            .update({
              archived_at: agora,
              archived_by: archivedBy,
              fulfillment_stage: "finalizado",
              fulfillment_stage_at: agora,
            })
            .in("id", ids)
            .is("archived_at", null)
            .select("id");
          if (error) {
            console.error("[admin/pedidos] arquivar error", error);
            return Response.json({ error: error.message }, { status: 500 });
          }
          return Response.json({ ok: true, arquivados: data?.length ?? 0 });
        }

        if (action === "desarquivar") {
          const { ids } = parsed.data;
          const { data, error } = await auth.admin
            .from("pedidos")
            .update({ archived_at: null, archived_by: null })
            .in("id", ids)
            .not("archived_at", "is", null)
            .select("id");
          if (error) {
            console.error("[admin/pedidos] desarquivar error", error);
            return Response.json({ error: error.message }, { status: 500 });
          }
          return Response.json({ ok: true, desarquivados: data?.length ?? 0 });
        }

        if (action === "atualizar_operacao") {
          const { id, production_sector, unidade_id, endereco_ou_unidade, tipo } = parsed.data;
          const patch: Record<string, string | null> = {};
          if (production_sector !== undefined) patch.production_sector = production_sector;
          if (unidade_id !== undefined) patch.unidade_id = unidade_id;
          if (endereco_ou_unidade !== undefined) patch.endereco_ou_unidade = endereco_ou_unidade;
          if (tipo !== undefined) patch.tipo = tipo;
          if (Object.keys(patch).length === 0) {
            return Response.json({ error: "nenhum_campo" }, { status: 400 });
          }
          const { error } = await auth.admin.from("pedidos").update(patch).eq("id", id);
          if (error) {
            console.error("[admin/pedidos] atualizar_operacao error", error);
            return Response.json({ error: error.message }, { status: 500 });
          }
          return Response.json({ ok: true });
        }

        if (action === "set_etapa") {
          const { id, stage } = parsed.data;
          const { error } = await auth.admin
            .from("pedidos")
            .update({ fulfillment_stage: stage, fulfillment_stage_at: new Date().toISOString() })
            .eq("id", id);
          if (error) {
            console.error("[admin/pedidos] set_etapa error", error);
            return Response.json({ error: error.message }, { status: 500 });
          }
          return Response.json({ ok: true });
        }

        if (action === "avancar_etapa") {
          const { ids } = parsed.data;
          const { data: rows, error: selErr } = await auth.admin
            .from("pedidos")
            .select("id, fulfillment_stage")
            .in("id", ids);
          if (selErr) {
            console.error("[admin/pedidos] avancar_etapa select error", selErr);
            return Response.json({ error: selErr.message }, { status: 500 });
          }
          // Agrupa por próxima etapa (finalizado permanece).
          const grupos: Record<string, string[]> = {};
          for (const r of rows ?? []) {
            const cur = (r.fulfillment_stage as string | null) ?? null;
            const idx = cur ? STAGE_ORDER.indexOf(cur as (typeof STAGE_ORDER)[number]) : -1;
            const next = idx < 0 ? "confirmado" : STAGE_ORDER[idx + 1];
            if (!next) continue;
            (grupos[next] ??= []).push(r.id as string);
          }
          const agora = new Date().toISOString();
          let avancados = 0;
          for (const [stage, gids] of Object.entries(grupos)) {
            const { error } = await auth.admin
              .from("pedidos")
              .update({ fulfillment_stage: stage, fulfillment_stage_at: agora })
              .in("id", gids);
            if (error) {
              console.error("[admin/pedidos] avancar_etapa update error", error);
              return Response.json({ error: error.message }, { status: 500 });
            }
            avancados += gids.length;
          }
          return Response.json({ ok: true, avancados });
        }

        if (action === "marcar_pago") {
          const { ids } = parsed.data;
          const { data, error } = await auth.admin
            .from("pedidos")
            .update({
              status: "pago",
              payment_status_normalized: "aprovado",
              payment_confirmed_at: new Date().toISOString(),
            })
            .in("id", ids)
            .select("id");
          if (error) {
            console.error("[admin/pedidos] marcar_pago error", error);
            return Response.json({ error: error.message }, { status: 500 });
          }
          for (const row of data ?? []) {
            notificarOpsPedidoPago(row.id).catch((e) => console.error("[opsNotify]", e));
          }
          return Response.json({ ok: true, pagos: data?.length ?? 0 });
        }

        if (action === "criar_manual") {
          const { pedido } = parsed.data;
          const op = await ensureOperator(auth.admin, auth.user.id, {
            name: (auth.user.user_metadata?.name as string) ?? auth.user.email ?? "Operador",
            email: auth.user.email ?? null,
          });
          const payload = buildPedidoManualPayload(pedido, op?.id ?? null);
          const { data, error } = await auth.admin
            .from("pedidos")
            .insert(payload)
            .select("id, access_token")
            .single();
          if (error) {
            console.error("[admin/pedidos] criar_manual error", error);
            return Response.json({ error: error.message }, { status: 500 });
          }
          return Response.json({
            ok: true,
            id: data.id,
            accessToken: data.access_token as string,
          });
        }

        if (action === "gerar_link") {
          const { id, cpf } = parsed.data;

          const secrets = await getAppSecrets();
          if (!secrets.asaasApiKey) {
            return Response.json({ error: "asaas_not_configured" }, { status: 503 });
          }
          const asaas = makeAsaasClient(secrets.asaasApiKey);

          const { data: pedido, error: pedidoErr } = await auth.admin
            .from("pedidos")
            .select("id, cliente_nome, cliente_whatsapp, cliente_email, total, data_entrega")
            .eq("id", id)
            .maybeSingle();
          if (pedidoErr || !pedido) {
            return Response.json({ error: "pedido_nao_encontrado" }, { status: 404 });
          }
          if (!pedido.total || Number(pedido.total) <= 0) {
            return Response.json({ error: "total_invalido" }, { status: 400 });
          }

          let customer;
          try {
            customer = await asaas.upsertCustomer({
              name: pedido.cliente_nome,
              cpfCnpj: cpf,
              email: pedido.cliente_email ?? undefined,
              mobilePhone: pedido.cliente_whatsapp ?? undefined,
              externalReference: id,
            });
          } catch (e) {
            console.error("[admin/pedidos] gerar_link customer error", e);
            return Response.json({ error: "asaas_customer_error" }, { status: 502 });
          }

          const paymentInput: AsaasCreatePayment = {
            customer: customer.id,
            billingType: "UNDEFINED",
            value: Number(pedido.total),
            dueDate: deriveDueDate(pedido.data_entrega),
            description: `Pedido ${id.slice(0, 8)} - Casa Almeria`,
            externalReference: id,
          };

          let payment;
          try {
            payment = await asaas.createPayment(paymentInput);
          } catch (e) {
            console.error("[admin/pedidos] gerar_link payment error", e);
            return Response.json({ error: "asaas_payment_error" }, { status: 502 });
          }

          const { data: pagamento, error: insErr } = await auth.admin
            .from("pagamentos")
            .insert({
              pedido_id: id,
              asaas_payment_id: payment.id,
              asaas_customer_id: customer.id,
              metodo: null,
              status: payment.status,
              valor: Number(pedido.total),
              invoice_url: payment.invoiceUrl ?? null,
              raw_response: payment as unknown as Record<string, unknown>,
            })
            .select("id, invoice_url")
            .single();
          if (insErr) {
            console.error("[admin/pedidos] gerar_link insert error", insErr);
            return Response.json({ error: "db_insert_error" }, { status: 500 });
          }

          return Response.json({
            ok: true,
            pagamentoId: pagamento.id,
            invoiceUrl: pagamento.invoice_url,
          });
        }

        if (action === "pagar_dinheiro") {
          const { id } = parsed.data;
          const { data: pedido, error: pErr } = await auth.admin
            .from("pedidos")
            .select("pagamento")
            .eq("id", id)
            .maybeSingle();
          if (pErr || !pedido) {
            return Response.json({ error: "pedido_nao_encontrado" }, { status: 404 });
          }
          const pagAtual = (pedido.pagamento as Record<string, unknown>) ?? {};
          const { error } = await auth.admin
            .from("pedidos")
            .update(
              buildPagamentoManualPatch({
                pagamentoAtual: pagAtual,
                metodo: "dinheiro",
                confirmedAt: new Date().toISOString(),
              }),
            )
            .eq("id", id);
          if (error) {
            console.error("[admin/pedidos] pagar_dinheiro", error);
            return Response.json({ error: "db_error" }, { status: 500 });
          }
          notificarOpsPedidoPago(id).catch((e) => console.error("[opsNotify]", e));
          return Response.json({ ok: true });
        }

        if (action === "pagar_pos") {
          const { id, pos } = parsed.data;
          const { data: pedido, error: pErr } = await auth.admin
            .from("pedidos")
            .select("pagamento")
            .eq("id", id)
            .maybeSingle();
          if (pErr || !pedido) {
            return Response.json({ error: "pedido_nao_encontrado" }, { status: 404 });
          }
          const pagAtual = (pedido.pagamento as Record<string, unknown>) ?? {};
          const { error } = await auth.admin
            .from("pedidos")
            .update(
              buildPagamentoManualPatch({
                pagamentoAtual: pagAtual,
                metodo: "pos",
                confirmedAt: new Date().toISOString(),
                pos,
              }),
            )
            .eq("id", id);
          if (error) {
            console.error("[admin/pedidos] pagar_pos", error);
            return Response.json({ error: "db_error" }, { status: 500 });
          }
          notificarOpsPedidoPago(id).catch((e) => console.error("[opsNotify]", e));
          return Response.json({ ok: true });
        }

        if (action === "gerar_pix") {
          const { id, cpf } = parsed.data;

          const secrets = await getAppSecrets();
          if (!secrets.asaasApiKey) {
            return Response.json({ error: "asaas_not_configured" }, { status: 503 });
          }
          const asaas = makeAsaasClient(secrets.asaasApiKey);

          const { data: pedido, error: pedidoErr } = await auth.admin
            .from("pedidos")
            .select("id, cliente_nome, cliente_whatsapp, cliente_email, total, data_entrega")
            .eq("id", id)
            .maybeSingle();
          if (pedidoErr || !pedido) {
            return Response.json({ error: "pedido_nao_encontrado" }, { status: 404 });
          }
          if (!pedido.total || Number(pedido.total) <= 0) {
            return Response.json({ error: "total_invalido" }, { status: 400 });
          }

          let customer;
          try {
            customer = await asaas.upsertCustomer({
              name: pedido.cliente_nome,
              cpfCnpj: cpf,
              email: pedido.cliente_email ?? undefined,
              mobilePhone: pedido.cliente_whatsapp ?? undefined,
              externalReference: id,
            });
          } catch (e) {
            console.error("[admin/pedidos] gerar_pix customer error", e);
            return Response.json({ error: "asaas_customer_error" }, { status: 502 });
          }

          const paymentInput: AsaasCreatePayment = {
            customer: customer.id,
            billingType: "PIX",
            value: Number(pedido.total),
            dueDate: deriveDueDate(pedido.data_entrega),
            description: `Pedido ${id.slice(0, 8)} - Casa Almeria`,
            externalReference: id,
          };

          let payment;
          try {
            payment = await asaas.createPayment(paymentInput);
          } catch (e) {
            console.error("[admin/pedidos] gerar_pix payment error", e);
            return Response.json({ error: "asaas_payment_error" }, { status: 502 });
          }

          let qr;
          try {
            qr = await asaas.getPixQrCode(payment.id);
          } catch (e) {
            console.error("[admin/pedidos] gerar_pix qrcode error", e);
            return Response.json({ error: "asaas_pix_error" }, { status: 502 });
          }

          const pixExpiraEm = qr.expirationDate ? new Date(qr.expirationDate).toISOString() : null;

          const { data: pagamento, error: insErr } = await auth.admin
            .from("pagamentos")
            .insert({
              pedido_id: id,
              asaas_payment_id: payment.id,
              asaas_customer_id: customer.id,
              metodo: "PIX",
              status: payment.status,
              valor: Number(pedido.total),
              invoice_url: payment.invoiceUrl ?? null,
              pix_qrcode_payload: qr.payload,
              pix_qrcode_image: qr.encodedImage,
              pix_expira_em: pixExpiraEm,
              raw_response: payment as unknown as Record<string, unknown>,
            })
            .select("id")
            .single();
          if (insErr) {
            console.error("[admin/pedidos] gerar_pix insert error", insErr);
            return Response.json({ error: "db_insert_error" }, { status: 500 });
          }

          return Response.json({
            ok: true,
            pagamentoId: pagamento.id,
            qrImage: qr.encodedImage,
            payload: qr.payload,
            expiraEm: pixExpiraEm,
          });
        }

        return Response.json({ error: "unknown_action" }, { status: 400 });
      },
    },
  },
});
