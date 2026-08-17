import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const scenarioKey = z.enum([
  "impossible_travel",
  "high_velocity",
  "account_takeover",
  "card_testing",
  "fraud_ring",
  "organic",
]);

export const runScenarioFn = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string }) => ({ key: scenarioKey.parse(d.key) }))
  .handler(async ({ data }) => {
    const { runScenario } = await import("./fraud.server");
    const results = await runScenario(data.key);
    return { results };
  });

export const caseActionFn = createServerFn({ method: "POST" })
  .inputValidator((d: { caseId: string; action: string; rationale?: string }) => ({
    caseId: z.string().uuid().parse(d.caseId),
    action: z.enum(["confirm_fraud", "false_positive", "escalate", "release"]).parse(d.action),
    rationale: z.string().max(2000).optional().parse(d.rationale),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: kase, error } = await supabaseAdmin
      .from("investigation_cases")
      .select("id, transaction_id, alert_id")
      .eq("id", data.caseId)
      .single();
    if (error || !kase) throw new Error("Case not found");

    const map = {
      confirm_fraud: { status: "closed", resolution: "confirmed_fraud", txn: "blocked", alert: "resolved" },
      false_positive: { status: "closed", resolution: "false_positive", txn: "approved", alert: "resolved" },
      escalate: { status: "escalated", resolution: null, txn: null, alert: "escalated" },
      release: { status: "closed", resolution: "released", txn: "approved", alert: "resolved" },
    } as const;
    const m = map[data.action];

    await supabaseAdmin
      .from("investigation_cases")
      .update({
        status: m.status,
        resolution: m.resolution,
        assigned_to: "Analyst",
        updated_at: new Date().toISOString(),
      })
      .eq("id", kase.id);

    if (m.txn)
      await supabaseAdmin
        .from("transactions")
        .update({ status: m.txn })
        .eq("id", kase.transaction_id);

    if (kase.alert_id)
      await supabaseAdmin.from("fraud_alerts").update({ status: m.alert }).eq("id", kase.alert_id);

    await supabaseAdmin.from("analyst_feedback").insert({
      case_id: kase.id,
      transaction_id: kase.transaction_id,
      label: data.action === "escalate" ? "escalated" : (m.resolution ?? data.action),
      rationale: data.rationale ?? "",
    });

    await supabaseAdmin.from("investigation_notes").insert({
      case_id: kase.id,
      author: "System",
      body: `Disposition recorded: ${data.action.replace("_", " ")}.${data.rationale ? ` Rationale: ${data.rationale}` : ""}`,
    });

    return { ok: true, status: m.status };
  });

export const addNoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: { caseId: string; body: string }) => ({
    caseId: z.string().uuid().parse(d.caseId),
    body: z.string().min(1).max(2000).parse(d.body),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("investigation_notes")
      .insert({ case_id: data.caseId, author: "Analyst", body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const copilotFn = createServerFn({ method: "POST" })
  .inputValidator((d: { transactionId: string; question: string }) => ({
    transactionId: z.string().uuid().parse(d.transactionId),
    question: z.string().min(2).max(500).parse(d.question),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { askCopilot } = await import("./copilot.server");

    const { data: txn } = await supabaseAdmin
      .from("transactions")
      .select(
        "*, accounts(account_number, users(full_name)), merchants(name), devices(fingerprint), ip_addresses(ip, city, country)",
      )
      .eq("id", data.transactionId)
      .single();
    if (!txn) throw new Error("Transaction not found");

    const { data: events } = await supabaseAdmin
      .from("risk_events")
      .select("rule_code, category, label, weight, detail")
      .eq("transaction_id", data.transactionId)
      .order("weight", { ascending: false });

    const { count: related } = await supabaseAdmin
      .from("transactions")
      .select("account_id", { count: "exact", head: true })
      .eq("device_id", txn.device_id ?? "");

    const t = txn as unknown as {
      id: string;
      amount: number;
      currency: string;
      channel: string;
      created_at: string;
      risk_score: number;
      decision: string;
      rule_score: number;
      anomaly_score: number;
      graph_score: number;
      explanation: string;
      accounts: { users: { full_name: string } } | null;
      merchants: { name: string } | null;
      devices: { fingerprint: string } | null;
      ip_addresses: { ip: string; city: string; country: string } | null;
    };

    const result = await askCopilot(
      {
        transaction: {
          id: t.id,
          amount: Number(t.amount),
          currency: t.currency,
          channel: t.channel,
          createdAt: t.created_at,
          riskScore: t.risk_score,
          decision: t.decision,
          ruleScore: t.rule_score,
          anomalyScore: t.anomaly_score,
          graphScore: t.graph_score,
          explanation: t.explanation,
        },
        customer: t.accounts?.users.full_name ?? "Unknown",
        merchant: t.merchants?.name ?? "Unknown",
        device: t.devices?.fingerprint ?? "Unknown",
        ip: t.ip_addresses?.ip ?? "Unknown",
        location: `${t.ip_addresses?.city ?? "?"}, ${t.ip_addresses?.country ?? "?"}`,
        signals: (events ?? []).map((e) => ({
          code: e.rule_code,
          category: e.category,
          label: e.label,
          weight: e.weight,
          detail: e.detail,
        })),
        relatedAccounts: related ?? 0,
        caseStatus: "open",
      },
      data.question,
    );

    return result;
  });

export const openCaseFn = createServerFn({ method: "POST" })
  .inputValidator((d: { alertId: string }) => ({ alertId: z.string().uuid().parse(d.alertId) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: alert } = await supabaseAdmin
      .from("fraud_alerts")
      .select("id, transaction_id, severity, title")
      .eq("id", data.alertId)
      .single();
    if (!alert) throw new Error("Alert not found");

    const { data: existing } = await supabaseAdmin
      .from("investigation_cases")
      .select("id")
      .eq("transaction_id", alert.transaction_id)
      .maybeSingle();
    if (existing) return { caseId: existing.id };

    const { data: kase, error } = await supabaseAdmin
      .from("investigation_cases")
      .insert({
        alert_id: alert.id,
        transaction_id: alert.transaction_id,
        title: alert.title,
        priority: alert.severity === "critical" ? "critical" : "high",
        status: "open",
      })
      .select("id")
      .single();
    if (error || !kase) throw new Error(error?.message ?? "Failed to open case");

    await supabaseAdmin
      .from("fraud_alerts")
      .update({ status: "investigating" })
      .eq("id", alert.id);

    return { caseId: kase.id };
  });
