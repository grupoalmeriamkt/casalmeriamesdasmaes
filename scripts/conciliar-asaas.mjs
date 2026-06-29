/**
 * Concilia pagamentos pendentes com a API do Asaas.
 * Uso: node scripts/conciliar-asaas.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const env = {};
  for (const line of readFileSync(resolve(root, ".env"), "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    env[line.slice(0, i)] = line.slice(i + 1);
  }
  return env;
}

const ASAAS_FINAL_PAID = new Set(["CONFIRMED", "RECEIVED"]);
const ASAAS_FINAL_DONE = new Set([
  ...ASAAS_FINAL_PAID,
  "REFUNDED",
  "REFUND_REQUESTED",
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
  "PAYMENT_DELETED",
  "OVERDUE",
]);
const STATUS_PRIORITY = {
  CONFIRMED: 100,
  RECEIVED: 100,
  PENDING: 20,
  AWAITING_RISK_ANALYSIS: 15,
  OVERDUE: 10,
};

function pagamentoRelevante(lista) {
  if (!lista?.length) return undefined;
  return [...lista].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 0;
    const pb = STATUS_PRIORITY[b.status] ?? 0;
    if (pb !== pa) return pb - pa;
    return b.criado_em.localeCompare(a.criado_em);
  })[0];
}

function pedidoStatusFromAsaas(status) {
  if (ASAAS_FINAL_PAID.has(status)) return "pago";
  if (status === "OVERDUE") return "vencido";
  if (["REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "PAYMENT_DELETED"].includes(status))
    return "cancelado";
  return "aguardando_pagamento";
}

async function getAsaasPayment(apiKey, paymentId) {
  const res = await fetch(`https://api.asaas.com/v3/payments/${paymentId}`, {
    headers: { access_token: apiKey, "User-Agent": "casalmeria-reconcile/1.0" },
  });
  if (!res.ok) throw new Error(`Asaas ${res.status}`);
  return res.json();
}

async function atualizarPedido(admin, pedidoId) {
  const [{ data: pagamentos }, { data: pedido }] = await Promise.all([
    admin.from("pagamentos").select("id, asaas_payment_id, status, criado_em").eq("pedido_id", pedidoId),
    admin.from("pedidos").select("status, pagamento").eq("id", pedidoId).maybeSingle(),
  ]);
  if (!pedido || pedido.status === "cancelado") return false;
  const rel = pagamentoRelevante(pagamentos ?? []);
  const novoStatus = rel ? pedidoStatusFromAsaas(rel.status) : pedido.status;
  const existingPag = pedido.pagamento ?? {};
  const precisa =
    pedido.status !== novoStatus ||
    (rel && existingPag.status !== rel.status) ||
    (rel && existingPag.asaas_payment_id !== rel.asaas_payment_id);
  if (!precisa) return false;
  const { error } = await admin
    .from("pedidos")
    .update({
      status: novoStatus,
      pagamento: {
        ...existingPag,
        ...(rel
          ? { status: rel.status, asaas_payment_id: rel.asaas_payment_id, pagamento_id: rel.id }
          : {}),
      },
    })
    .eq("id", pedidoId);
  if (error) throw error;
  return true;
}

const env = loadEnv();
const admin = createClient(env.EXTERNAL_SUPABASE_URL, env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: secrets } = await admin.from("app_secrets").select("payload").eq("id", "default").maybeSingle();
const apiKey = secrets?.payload?.asaasApiKey;
if (!apiKey) {
  console.error("Asaas API key não configurada em app_secrets");
  process.exit(1);
}

const { data: rows } = await admin
  .from("pagamentos")
  .select("id, pedido_id, asaas_payment_id, status")
  .not("asaas_payment_id", "is", null)
  .order("criado_em", { ascending: false });

let pagamentosAtualizados = 0;
let pedidosAtualizados = 0;
const pedidosAfetados = new Set();

for (const row of rows ?? []) {
  if (ASAAS_FINAL_DONE.has(row.status)) continue;
  try {
    const asaasPayment = await getAsaasPayment(apiKey, row.asaas_payment_id);
    if (asaasPayment.status === row.status) continue;
    const { error } = await admin
      .from("pagamentos")
      .update({ status: asaasPayment.status, raw_response: asaasPayment })
      .eq("id", row.id);
    if (error) throw error;
    pagamentosAtualizados += 1;
    pedidosAfetados.add(row.pedido_id);
    console.log(`✓ pagamento ${row.asaas_payment_id}: ${row.status} → ${asaasPayment.status}`);
  } catch (e) {
    console.error(`✗ pagamento ${row.asaas_payment_id}:`, e.message);
  }
}

const [{ data: pedidosComPendencia }, { data: pedidosAguardando }] = await Promise.all([
  admin.from("pagamentos").select("pedido_id").in("status", ["PENDING", "AWAITING_RISK_ANALYSIS"]).not("asaas_payment_id", "is", null),
  admin.from("pedidos").select("id").eq("status", "aguardando_pagamento"),
]);
for (const p of pedidosComPendencia ?? []) pedidosAfetados.add(p.pedido_id);
for (const p of pedidosAguardando ?? []) pedidosAfetados.add(p.id);

for (const pedidoId of pedidosAfetados) {
  try {
    const ok = await atualizarPedido(admin, pedidoId);
    if (ok) {
      pedidosAtualizados += 1;
      console.log(`✓ pedido ${pedidoId.slice(0, 8)} atualizado`);
    }
  } catch (e) {
    console.error(`✗ pedido ${pedidoId}:`, e.message);
  }
}

console.log(`\nResumo: ${pagamentosAtualizados} pagamento(s), ${pedidosAtualizados} pedido(s) atualizados.`);
