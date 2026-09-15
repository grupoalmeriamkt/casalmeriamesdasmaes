/**
 * Faxina única no Asaas para ninguém pagar pedido que não existe mais:
 *  1. Desliga as notificações (e-mail/SMS/WhatsApp com link de cobrança) dos clientes.
 *  2. Cancela cobranças ainda abertas de pedidos excluídos, cancelados ou expirados.
 *
 * Uso:
 *   node scripts/asaas-bloquear-links.mjs              simulação (não altera nada)
 *   node scripts/asaas-bloquear-links.mjs --aplicar    aplica
 *   --so-clientes | --so-cobrancas                     roda só uma das etapas
 *   --cpf 00000000000                                  só o cliente desse CPF (etapa 1)
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

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
const cpfIdx = args.indexOf("--cpf");
const cpf = cpfIdx >= 0 ? args[cpfIdx + 1] : null;
const rodarClientes = !args.includes("--so-cobrancas");
const rodarCobrancas = !args.includes("--so-clientes") && !cpf;

const COBRANCA_ABERTA = new Set(["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"]);
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

const env = loadEnv();
const admin = createClient(env.EXTERNAL_SUPABASE_URL, env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: secrets } = await admin
  .from("app_secrets")
  .select("payload")
  .eq("id", "default")
  .maybeSingle();
const apiKey = secrets?.payload?.asaasApiKey;
if (!apiKey) {
  console.error("Asaas API key não configurada em app_secrets");
  process.exit(1);
}

async function asaas(path, init = {}) {
  const res = await fetch(`https://api.asaas.com/v3${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      "User-Agent": "casalmeria-bloquear-links/1.0",
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`Asaas ${res.status} ${path}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
}

async function desligarNotificacoes() {
  let offset = 0;
  const r = { clientes: 0, jaDesligados: 0, desligados: 0, erros: 0 };
  const filtro = cpf ? `&cpfCnpj=${encodeURIComponent(cpf)}` : "";
  for (;;) {
    const page = await asaas(`/customers?limit=100&offset=${offset}${filtro}`);
    for (const c of page.data ?? []) {
      if (c.deleted) continue;
      r.clientes += 1;
      if (c.notificationDisabled === true) {
        r.jaDesligados += 1;
        continue;
      }
      if (!aplicar) {
        r.desligados += 1;
        continue;
      }
      try {
        const atualizado = await asaas(`/customers/${c.id}`, {
          method: "PUT",
          body: JSON.stringify({ notificationDisabled: true }),
        });
        if (atualizado?.notificationDisabled !== true) {
          throw new Error("Asaas não confirmou notificationDisabled=true");
        }
        r.desligados += 1;
      } catch (e) {
        r.erros += 1;
        console.error(`✗ cliente ${c.id}:`, e.message);
      }
      await pausa(120);
    }
    if (!page.hasMore) break;
    offset += 100;
  }
  console.log(
    `Clientes ativos: ${r.clientes} | já desligados: ${r.jaDesligados} | ` +
      `${aplicar ? "desligados agora" : "a desligar"}: ${r.desligados} | erros: ${r.erros}`,
  );
}

async function cancelarCobrancasDePedidosEncerrados() {
  const pedidos = new Map();
  const { data: excluidos, error: e1 } = await admin.from("pedidos_excluidos").select("pedido_id");
  if (e1) throw e1;
  for (const e of excluidos ?? []) pedidos.set(e.pedido_id, "excluído");
  const { data: encerrados, error: e2 } = await admin
    .from("pedidos")
    .select("id, status")
    .in("status", ["cancelado", "expirado"]);
  if (e2) throw e2;
  for (const p of encerrados ?? []) pedidos.set(p.id, p.status);

  const r = { pedidos: pedidos.size, abertas: 0, canceladas: 0, erros: 0 };
  for (const [pedidoId, motivo] of pedidos) {
    let page;
    try {
      page = await asaas(`/payments?externalReference=${pedidoId}&limit=100`);
    } catch (e) {
      r.erros += 1;
      console.error(`✗ listar cobranças do pedido ${pedidoId}:`, e.message);
      continue;
    }
    for (const pay of page.data ?? []) {
      if (pay.deleted || !COBRANCA_ABERTA.has(pay.status)) continue;
      r.abertas += 1;
      console.log(
        `${aplicar ? "→ cancelando" : "• aberta"} ${pay.id} | pedido ${pedidoId} (${motivo}) | ` +
          `R$ ${pay.value} ${pay.billingType} ${pay.status}`,
      );
      if (!aplicar) continue;
      try {
        await asaas(`/payments/${pay.id}`, { method: "DELETE" });
        await admin
          .from("pagamentos")
          .update({ status: "PAYMENT_DELETED" })
          .eq("asaas_payment_id", pay.id);
        r.canceladas += 1;
      } catch (e) {
        r.erros += 1;
        console.error(`✗ cobrança ${pay.id}:`, e.message);
      }
      await pausa(120);
    }
    await pausa(60);
  }
  console.log(
    `Pedidos excluídos/cancelados/expirados: ${r.pedidos} | cobranças abertas: ${r.abertas} | ` +
      `canceladas: ${r.canceladas} | erros: ${r.erros}`,
  );
}

console.log(aplicar ? "== APLICANDO ==" : "== SIMULAÇÃO (use --aplicar para alterar) ==");
if (rodarClientes) await desligarNotificacoes();
if (rodarCobrancas) await cancelarCobrancasDePedidosEncerrados();
