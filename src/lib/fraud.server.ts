/**
 * Server-only fraud pipeline: context enrichment -> risk engine -> persistence.
 * Never imported by client code directly (blocked by the .server filename rule).
 */
import { assessTransaction, type TxnContext } from "./fraud/engine";
import { SCENARIOS, type ScenarioKey } from "./fraud/scenarios";

type Admin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

export interface TxnSpec {
  accountId: string;
  merchantId: string;
  deviceId: string;
  ipId: string;
  amount: number;
  channel: string;
  scenarioTag?: string | null;
  createdAt?: string;
}

export interface IngestResult {
  transactionId: string;
  riskScore: number;
  decision: string;
  alertId: string | null;
  caseId: string | null;
}

async function buildContext(db: Admin, spec: TxnSpec): Promise<TxnContext> {
  const createdAt = spec.createdAt ?? new Date().toISOString();

  const [{ data: account }, { data: device }, { data: ip }, { data: merchant }] =
    await Promise.all([
      db
        .from("accounts")
        .select("*, users(*)")
        .eq("id", spec.accountId)
        .single(),
      db.from("devices").select("*").eq("id", spec.deviceId).single(),
      db.from("ip_addresses").select("*").eq("id", spec.ipId).single(),
      db.from("merchants").select("*").eq("id", spec.merchantId).single(),
    ]);

  if (!account || !device || !ip || !merchant)
    throw new Error("Enrichment failed: missing entity reference");

  const user = (account as unknown as { users: Record<string, unknown> }).users as {
    country: string;
    home_lat: number;
    home_lon: number;
    risk_tier: string;
  };

  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { data: recent } = await db
    .from("transactions")
    .select("id, amount, created_at, merchant_id, device_id, ip_id, ip_addresses(lat, lon, city)")
    .eq("account_id", spec.accountId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = recent ?? [];
  const now = new Date(createdAt).getTime();
  const within = (ms: number) =>
    rows.filter((r) => now - new Date(r.created_at as string).getTime() <= ms);

  const priorRow = rows[0] as
    | { created_at: string; ip_addresses: { lat: number; lon: number; city: string } | null }
    | undefined;

  const [deviceAccounts, ipAccounts, deviceHistory, watchlist] = await Promise.all([
    db.from("transactions").select("account_id").eq("device_id", spec.deviceId).limit(500),
    db.from("transactions").select("account_id").eq("ip_id", spec.ipId).limit(500),
    db
      .from("transactions")
      .select("id")
      .eq("account_id", spec.accountId)
      .eq("device_id", spec.deviceId)
      .limit(1),
    db
      .from("watchlist_entities")
      .select("*")
      .in("entity_value", [ip.ip, device.fingerprint, merchant.name]),
  ]);

  const uniq = (arr: { account_id: string }[] | null) =>
    new Set((arr ?? []).map((r) => r.account_id)).size;

  const { data: confirmed } = await db
    .from("analyst_feedback")
    .select("transaction_id, label, transactions!inner(device_id, ip_id)")
    .eq("label", "confirmed_fraud")
    .limit(200);

  const linkedFraud = (confirmed ?? []).filter((f) => {
    const t = (f as unknown as { transactions: { device_id: string; ip_id: string } })
      .transactions;
    return t && (t.device_id === spec.deviceId || t.ip_id === spec.ipId);
  }).length;

  return {
    amount: spec.amount,
    channel: spec.channel,
    createdAt,
    account: {
      avgTxnAmount: Number(account.avg_txn_amount),
      stddevTxnAmount: Number(account.stddev_txn_amount),
      balance: Number(account.balance),
      status: account.status as string,
    },
    user: {
      country: user.country,
      homeLat: user.home_lat,
      homeLon: user.home_lon,
      riskTier: user.risk_tier,
    },
    device: {
      fingerprint: device.fingerprint as string,
      isEmulator: device.is_emulator as boolean,
      trustScore: device.trust_score as number,
      isNewForAccount: (deviceHistory.data ?? []).length === 0,
    },
    ip: {
      ip: ip.ip as string,
      country: ip.country as string,
      city: ip.city as string,
      lat: ip.lat as number,
      lon: ip.lon as number,
      isProxy: ip.is_proxy as boolean,
      isTor: ip.is_tor as boolean,
      reputation: ip.reputation as number,
    },
    merchant: {
      name: merchant.name as string,
      category: merchant.category as string,
      country: merchant.country as string,
      riskRating: merchant.risk_rating as number,
    },
    history: {
      txnLast60s: within(60_000).length,
      txnLast1h: rows.length,
      amountLast1h: rows.reduce((a, r) => a + Number(r.amount), 0),
      microTxnLast5m: within(300_000).filter((r) => Number(r.amount) < 5).length,
      distinctMerchantsLast10m: new Set(within(600_000).map((r) => r.merchant_id)).size,
      prior:
        priorRow && priorRow.ip_addresses
          ? {
              lat: priorRow.ip_addresses.lat,
              lon: priorRow.ip_addresses.lon,
              city: priorRow.ip_addresses.city,
              createdAt: priorRow.created_at,
            }
          : undefined,
    },
    watchlistHits: (watchlist.data ?? []).map((w) => ({
      entityType: w.entity_type as string,
      entityValue: w.entity_value as string,
      reason: w.reason as string,
      severity: w.severity as string,
    })),
    graph: {
      accountsSharingDevice: uniq(deviceAccounts.data as { account_id: string }[] | null),
      accountsSharingIp: uniq(ipAccounts.data as { account_id: string }[] | null),
      linkedFraudConfirmations: linkedFraud,
    },
  };
}

const severityFor = (score: number) =>
  score >= 90 ? "critical" : score >= 70 ? "high" : "medium";

const statusFor = (decision: string) =>
  decision === "BLOCK"
    ? "blocked"
    : decision === "STEP_UP"
      ? "challenged"
      : decision === "MONITOR"
        ? "monitored"
        : "approved";

async function linkEntities(
  db: Admin,
  spec: TxnSpec,
  labels: { account: string; device: string; ip: string; merchant: string },
) {
  const edges = [
    { t: "device", id: spec.deviceId, label: labels.device, relation: "used_device" },
    { t: "ip", id: spec.ipId, label: labels.ip, relation: "used_ip" },
    { t: "merchant", id: spec.merchantId, label: labels.merchant, relation: "paid_merchant" },
  ];
  for (const e of edges) {
    const { data: existing } = await db
      .from("fraud_relationships")
      .select("id, weight")
      .eq("source_id", spec.accountId)
      .eq("target_id", e.id)
      .maybeSingle();
    if (existing) {
      await db
        .from("fraud_relationships")
        .update({ weight: (existing.weight as number) + 1 })
        .eq("id", existing.id);
    } else {
      await db.from("fraud_relationships").insert({
        source_type: "account",
        source_id: spec.accountId,
        source_label: labels.account,
        target_type: e.t,
        target_id: e.id,
        target_label: e.label,
        relation: e.relation,
        weight: 1,
      });
    }
  }
}

export async function ingestTransaction(spec: TxnSpec): Promise<IngestResult> {
  const db = await admin();
  const started = Date.now();
  const ctx = await buildContext(db, spec);
  const assessment = assessTransaction(ctx);

  const { data: txn, error } = await db
    .from("transactions")
    .insert({
      account_id: spec.accountId,
      merchant_id: spec.merchantId,
      device_id: spec.deviceId,
      ip_id: spec.ipId,
      amount: spec.amount,
      channel: spec.channel,
      status: statusFor(assessment.decision),
      risk_score: assessment.riskScore,
      decision: assessment.decision,
      rule_score: assessment.ruleScore,
      anomaly_score: assessment.anomalyScore,
      graph_score: assessment.graphScore,
      signals: assessment.signals as unknown as Record<string, unknown>[],
      explanation: assessment.explanation,
      scenario_tag: spec.scenarioTag ?? null,
      created_at: spec.createdAt ?? new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !txn) throw new Error(error?.message ?? "Failed to persist transaction");

  if (assessment.signals.length) {
    await db.from("risk_events").insert(
      assessment.signals.map((s) => ({
        transaction_id: txn.id,
        rule_code: s.code,
        category: s.category,
        label: s.label,
        weight: s.weight,
        detail: s.detail,
      })),
    );
  }

  await linkEntities(db, spec, {
    account: ctx.account.status ? `Account ${spec.accountId.slice(0, 8)}` : "Account",
    device: ctx.device.fingerprint,
    ip: ctx.ip.ip,
    merchant: ctx.merchant.name,
  });

  let alertId: string | null = null;
  let caseId: string | null = null;

  if (assessment.riskScore >= 70) {
    const { data: alert } = await db
      .from("fraud_alerts")
      .insert({
        transaction_id: txn.id,
        severity: severityFor(assessment.riskScore),
        title: `${assessment.decision === "BLOCK" ? "Blocked" : "Challenged"} payment · $${spec.amount.toFixed(2)} · ${ctx.merchant.name}`,
        description: assessment.explanation,
        status: "open",
      })
      .select("id")
      .single();
    alertId = alert?.id ?? null;

    if (assessment.decision === "BLOCK" && alertId) {
      const { data: kase } = await db
        .from("investigation_cases")
        .insert({
          alert_id: alertId,
          transaction_id: txn.id,
          title: `Case · ${ctx.merchant.name} · $${spec.amount.toFixed(2)}`,
          priority: assessment.riskScore >= 95 ? "critical" : "high",
          status: "open",
        })
        .select("id")
        .single();
      caseId = kase?.id ?? null;
    }
  }

  await db.from("system_metrics").insert({
    metric_key: "decision_latency_ms",
    metric_value: Date.now() - started,
    detail: assessment.decision,
  });

  return {
    transactionId: txn.id,
    riskScore: assessment.riskScore,
    decision: assessment.decision,
    alertId,
    caseId,
  };
}

/* ------------------------------ Scenario runner ---------------------------- */

export async function runScenario(key: ScenarioKey): Promise<IngestResult[]> {
  const db = await admin();
  const scenario = SCENARIOS[key];
  const specs = scenario.build();
  const results: IngestResult[] = [];
  for (const spec of specs) {
    results.push(await ingestTransaction(spec));
    await new Promise((r) => setTimeout(r, scenario.delayMs));
  }
  await db.from("system_metrics").insert({
    metric_key: "scenario_run",
    metric_value: specs.length,
    detail: key,
  });
  return results;
}
