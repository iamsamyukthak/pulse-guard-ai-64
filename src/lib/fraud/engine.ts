/**
 * TrustPulse risk engine — deterministic, pure TypeScript.
 * Runs identically on the server (ingestion) and in the browser (replay / explainability).
 * The engine is authoritative: no LLM ever computes or alters a score.
 */

export type SignalCategory = "rule" | "anomaly" | "graph";

export interface RiskSignal {
  code: string;
  category: SignalCategory;
  label: string;
  weight: number;
  detail: string;
}

export type Decision = "APPROVE" | "MONITOR" | "STEP_UP" | "BLOCK";

export interface TxnContext {
  amount: number;
  channel: string;
  createdAt: string;
  account: {
    avgTxnAmount: number;
    stddevTxnAmount: number;
    balance: number;
    status: string;
  };
  user: {
    country: string;
    homeLat: number;
    homeLon: number;
    riskTier: string;
  };
  device: {
    fingerprint: string;
    isEmulator: boolean;
    trustScore: number;
    isNewForAccount: boolean;
  };
  ip: {
    ip: string;
    country: string;
    city: string;
    lat: number;
    lon: number;
    isProxy: boolean;
    isTor: boolean;
    reputation: number;
  };
  merchant: {
    name: string;
    category: string;
    country: string;
    riskRating: number;
  };
  history: {
    txnLast60s: number;
    txnLast1h: number;
    amountLast1h: number;
    microTxnLast5m: number;
    distinctMerchantsLast10m: number;
    prior?: { lat: number; lon: number; createdAt: string; city: string } | undefined;
  };
  watchlistHits: { entityType: string; entityValue: string; reason: string; severity: string }[];
  graph: {
    accountsSharingDevice: number;
    accountsSharingIp: number;
    linkedFraudConfirmations: number;
  };
}

export interface RiskAssessment {
  riskScore: number;
  decision: Decision;
  ruleScore: number;
  anomalyScore: number;
  graphScore: number;
  signals: RiskSignal[];
  explanation: string;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/* ----------------------------- 1. Rule engine ----------------------------- */

export function evaluateRules(ctx: TxnContext): RiskSignal[] {
  const s: RiskSignal[] = [];
  const push = (code: string, label: string, weight: number, detail: string) =>
    s.push({ code, category: "rule", label, weight, detail });

  if (ctx.history.prior) {
    const km = haversineKm(
      ctx.history.prior.lat,
      ctx.history.prior.lon,
      ctx.ip.lat,
      ctx.ip.lon,
    );
    const hours =
      (new Date(ctx.createdAt).getTime() -
        new Date(ctx.history.prior.createdAt).getTime()) /
      3_600_000;
    const speed = hours > 0 ? km / hours : km > 50 ? 99_999 : 0;
    if (km > 500 && speed > 900) {
      push(
        "R_IMPOSSIBLE_TRAVEL",
        "Impossible travel",
        45,
        `${Math.round(km)} km from ${ctx.history.prior.city} in ${(hours * 60).toFixed(0)} min (${Math.round(speed)} km/h implied).`,
      );
    }
  }

  if (ctx.ip.isTor) push("R_TOR_EXIT", "Tor exit node", 30, `IP ${ctx.ip.ip} is a known Tor exit.`);
  else if (ctx.ip.isProxy) push("R_PROXY", "Anonymising proxy / VPN", 18, `IP ${ctx.ip.ip} resolves to an anonymising network.`);

  if (ctx.ip.reputation < 20)
    push("R_BAD_IP_REP", "Poor IP reputation", 15, `Reputation score ${ctx.ip.reputation}/100.`);

  if (ctx.ip.country !== ctx.user.country)
    push(
      "R_GEO_MISMATCH",
      "Country mismatch",
      12,
      `Payment from ${ctx.ip.country} but account home country is ${ctx.user.country}.`,
    );

  if (ctx.device.isEmulator)
    push("R_EMULATOR", "Emulated / headless device", 25, `Device ${ctx.device.fingerprint} reports an emulator signature.`);

  if (ctx.device.isNewForAccount)
    push("R_NEW_DEVICE", "First-seen device", 14, `Device ${ctx.device.fingerprint} has never transacted on this account.`);

  if (ctx.device.trustScore < 30)
    push("R_LOW_TRUST_DEVICE", "Low device trust", 12, `Device trust ${ctx.device.trustScore}/100.`);

  if (ctx.history.txnLast60s >= 4)
    push(
      "R_VELOCITY_60S",
      "Velocity burst",
      32,
      `${ctx.history.txnLast60s} payments on this account in the last 60 seconds.`,
    );
  else if (ctx.history.txnLast1h >= 12)
    push("R_VELOCITY_1H", "Elevated hourly velocity", 16, `${ctx.history.txnLast1h} payments in the last hour.`);

  if (ctx.history.microTxnLast5m >= 5)
    push(
      "R_CARD_TESTING",
      "Card-testing pattern",
      35,
      `${ctx.history.microTxnLast5m} micro-authorisations (<$5) in 5 minutes.`,
    );

  if (ctx.merchant.riskRating >= 75)
    push(
      "R_HIGH_RISK_MERCHANT",
      "High-risk merchant",
      18,
      `${ctx.merchant.name} (${ctx.merchant.category}) carries a ${ctx.merchant.riskRating}/100 risk rating.`,
    );

  if (ctx.amount > ctx.account.balance)
    push("R_OVER_BALANCE", "Amount exceeds balance", 10, `Requested $${ctx.amount.toFixed(2)} vs balance $${ctx.account.balance.toFixed(2)}.`);

  if (ctx.amount >= 2000)
    push("R_LARGE_AMOUNT", "Large-value payment", 12, `$${ctx.amount.toFixed(2)} is above the $2,000 review threshold.`);

  for (const w of ctx.watchlistHits)
    push(
      "R_WATCHLIST",
      `Watchlist hit: ${w.entityType}`,
      w.severity === "critical" ? 28 : 18,
      `${w.entityValue} — ${w.reason}`,
    );

  if (ctx.account.status !== "active")
    push("R_ACCOUNT_STATE", "Account not in good standing", 15, `Account status is ${ctx.account.status}.`);

  return s;
}

/* --------------------- 2. Behavioural anomaly detection -------------------- */
/**
 * Isolation-Forest-style scoring: each feature is isolated against the account's
 * own historical distribution; the mean normalised isolation depth becomes the score.
 */
export function evaluateAnomalies(ctx: TxnContext): {
  score: number;
  signals: RiskSignal[];
} {
  const signals: RiskSignal[] = [];
  const parts: number[] = [];

  const sd = Math.max(ctx.account.stddevTxnAmount, 1);
  const z = (ctx.amount - ctx.account.avgTxnAmount) / sd;
  const amountIsolation = clamp((Math.abs(z) / 6) * 100);
  parts.push(amountIsolation);
  if (Math.abs(z) >= 3)
    signals.push({
      code: "A_AMOUNT_ZSCORE",
      category: "anomaly",
      label: "Amount far from behavioural baseline",
      weight: Math.round(clamp(amountIsolation * 0.35)),
      detail: `$${ctx.amount.toFixed(2)} is ${z.toFixed(1)}σ from the account mean of $${ctx.account.avgTxnAmount.toFixed(2)}.`,
    });

  const hour = new Date(ctx.createdAt).getUTCHours();
  const oddHour = hour >= 1 && hour <= 5;
  parts.push(oddHour ? 55 : 8);
  if (oddHour)
    signals.push({
      code: "A_ODD_HOUR",
      category: "anomaly",
      label: "Out-of-pattern hour",
      weight: 8,
      detail: `Executed at ${String(hour).padStart(2, "0")}:00 UTC, outside this account's normal activity window.`,
    });

  const velocityIsolation = clamp((ctx.history.txnLast1h / 15) * 100);
  parts.push(velocityIsolation);
  if (ctx.history.txnLast1h >= 6)
    signals.push({
      code: "A_VELOCITY_DRIFT",
      category: "anomaly",
      label: "Velocity above behavioural norm",
      weight: Math.round(clamp(velocityIsolation * 0.25)),
      detail: `${ctx.history.txnLast1h} payments in one hour vs a typical 1–2.`,
    });

  const merchantIsolation = clamp((ctx.history.distinctMerchantsLast10m / 6) * 100);
  parts.push(merchantIsolation);
  if (ctx.history.distinctMerchantsLast10m >= 4)
    signals.push({
      code: "A_MERCHANT_SPRAY",
      category: "anomaly",
      label: "Merchant spraying",
      weight: 10,
      detail: `${ctx.history.distinctMerchantsLast10m} distinct merchants touched in 10 minutes.`,
    });

  const deviceIsolation = ctx.device.isNewForAccount ? 70 : clamp(100 - ctx.device.trustScore);
  parts.push(deviceIsolation);

  const score = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  return { score: clamp(score), signals };
}

/* ------------------------ 3. Relationship / graph -------------------------- */

export function evaluateGraph(ctx: TxnContext): {
  score: number;
  signals: RiskSignal[];
} {
  const signals: RiskSignal[] = [];
  let score = 0;

  if (ctx.graph.accountsSharingDevice >= 3) {
    score += 45;
    signals.push({
      code: "G_DEVICE_FANOUT",
      category: "graph",
      label: "Device shared across accounts",
      weight: 26,
      detail: `${ctx.graph.accountsSharingDevice} distinct accounts have transacted from ${ctx.device.fingerprint}.`,
    });
  } else if (ctx.graph.accountsSharingDevice === 2) {
    score += 15;
    signals.push({
      code: "G_DEVICE_PAIR",
      category: "graph",
      label: "Device shared with another account",
      weight: 8,
      detail: `2 accounts share device ${ctx.device.fingerprint}.`,
    });
  }

  if (ctx.graph.accountsSharingIp >= 3) {
    score += 30;
    signals.push({
      code: "G_IP_FANOUT",
      category: "graph",
      label: "IP shared across accounts",
      weight: 18,
      detail: `${ctx.graph.accountsSharingIp} accounts transacting from ${ctx.ip.ip}.`,
    });
  }

  if (ctx.graph.linkedFraudConfirmations > 0) {
    score += 35;
    signals.push({
      code: "G_CONFIRMED_LINK",
      category: "graph",
      label: "Linked to confirmed fraud",
      weight: 24,
      detail: `${ctx.graph.linkedFraudConfirmations} confirmed-fraud transaction(s) share this device or IP.`,
    });
  }

  return { score: clamp(score), signals };
}

/* --------------------------- 4. Fusion + decision -------------------------- */

export function decisionFor(score: number): Decision {
  if (score >= 90) return "BLOCK";
  if (score >= 70) return "STEP_UP";
  if (score >= 40) return "MONITOR";
  return "APPROVE";
}

export function assessTransaction(ctx: TxnContext): RiskAssessment {
  const ruleSignals = evaluateRules(ctx);
  const anomaly = evaluateAnomalies(ctx);
  const graph = evaluateGraph(ctx);

  const ruleScore = clamp(ruleSignals.reduce((a, r) => a + r.weight, 0));
  const anomalyScore = anomaly.score;
  const graphScore = graph.score;

  const fused = 0.55 * ruleScore + 0.25 * anomalyScore + 0.2 * graphScore;
  // A single decisive rule must never be diluted away by calm sub-scores.
  const dominant = Math.max(...ruleSignals.map((r) => r.weight), 0);
  const floor = dominant >= 45 ? 92 : dominant >= 32 ? 74 : dominant >= 25 ? 55 : 0;

  const riskScore = clamp(Math.round(Math.max(fused, floor)));
  const signals = [...ruleSignals, ...anomaly.signals, ...graph.signals].sort(
    (a, b) => b.weight - a.weight,
  );
  const decision = decisionFor(riskScore);

  return {
    riskScore,
    decision,
    ruleScore,
    anomalyScore,
    graphScore,
    signals,
    explanation: buildExplanation(riskScore, decision, signals),
  };
}

/* ------------------------- 5. Explainability layer ------------------------- */

export function buildExplanation(
  score: number,
  decision: Decision,
  signals: RiskSignal[],
): string {
  if (signals.length === 0)
    return `Scored ${score}/100 — no risk signals fired. Behaviour matches the account baseline, so the payment was auto-approved.`;
  const top = signals.slice(0, 3).map((s) => s.label.toLowerCase());
  const verb: Record<Decision, string> = {
    APPROVE: "approved with signals logged for monitoring",
    MONITOR: "flagged for passive monitoring",
    STEP_UP: "held for step-up authentication",
    BLOCK: "blocked outright",
  };
  return `Scored ${score}/100 and ${verb[decision]}. Primary drivers: ${top.join(", ")}. ${signals.length} signal(s) contributed across rules, behavioural anomaly and relationship analysis.`;
}

export const DECISION_META: Record<
  Decision,
  { label: string; tone: string; range: string }
> = {
  APPROVE: { label: "Approve", tone: "approve", range: "0–39" },
  MONITOR: { label: "Monitor", tone: "monitor", range: "40–69" },
  STEP_UP: { label: "Step-up auth", tone: "stepup", range: "70–89" },
  BLOCK: { label: "Block", tone: "block", range: "90–100" },
};
