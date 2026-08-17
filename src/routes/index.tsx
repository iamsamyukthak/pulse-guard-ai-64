import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle, ShieldCheck, Gauge, Timer } from "lucide-react";
import { Shell, PageHeader } from "@/components/trustpulse/Shell";
import {
  DecisionBadge,
  ScoreChip,
  SeverityPill,
  money,
  timeAgo,
} from "@/components/trustpulse/badges";
import { useAlerts, useCases, useMetrics, useTransactions } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TrustPulse — Real-Time Payment Fraud Operations" },
      {
        name: "description",
        content:
          "Live payment fraud intelligence: real-time risk scoring, alerts, investigation cases and an evidence-grounded AI copilot.",
      },
      { property: "og:title", content: "TrustPulse — Real-Time Payment Fraud Operations" },
      {
        property: "og:description",
        content:
          "Live payment fraud intelligence: real-time risk scoring, alerts, investigation cases and an evidence-grounded AI copilot.",
      },
    ],
  }),
  component: OperationsPage,
});

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  hint: string;
  tone?: "primary" | "block" | "approve" | "monitor";
}) {
  const toneClass = {
    primary: "text-primary",
    block: "text-block",
    approve: "text-approve",
    monitor: "text-monitor",
  }[tone];
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </div>
      <div className="mt-2 font-mono text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function OperationsPage() {
  const { data: txns = [] } = useTransactions(80);
  const { data: alerts = [] } = useAlerts(20);
  const { data: cases = [] } = useCases();
  const { data: metrics = [] } = useMetrics();

  const stats = useMemo(() => {
    const blocked = txns.filter((t) => t.decision === "BLOCK").length;
    const exposure = txns
      .filter((t) => t.decision === "BLOCK")
      .reduce((a, t) => a + Number(t.amount), 0);
    const latencies = metrics
      .filter((m) => m.metric_key === "decision_latency_ms")
      .slice(0, 50)
      .map((m) => Number(m.metric_value));
    const avgLatency = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;
    return {
      volume: txns.length,
      blocked,
      exposure,
      avgLatency,
      openCases: cases.filter((c) => c.status !== "closed").length,
    };
  }, [txns, metrics, cases]);

  return (
    <Shell>
      <PageHeader
        title="Fraud Operations"
        subtitle="Every payment is enriched, scored by the risk engine and streamed here in real time."
        actions={
          <Link
            to="/simulator"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Run an attack scenario
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Gauge}
          label="Recent volume"
          value={String(stats.volume)}
          hint="payments in the live window"
        />
        <Stat
          icon={ShieldCheck}
          label="Blocked"
          value={String(stats.blocked)}
          hint={`${money(stats.exposure)} exposure prevented`}
          tone="block"
        />
        <Stat
          icon={AlertTriangle}
          label="Open cases"
          value={String(stats.openCases)}
          hint={`${alerts.filter((a) => a.status === "open").length} open alerts`}
          tone="monitor"
        />
        <Stat
          icon={Timer}
          label="Decision latency"
          value={`${stats.avgLatency}ms`}
          hint="mean engine round-trip"
          tone="approve"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="panel overflow-hidden">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Live transaction stream</h2>
            <span className="font-mono text-[11px] text-muted-foreground">
              {txns.length} events
            </span>
          </header>
          <div className="max-h-[620px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Merchant</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Geo</th>
                  <th className="px-4 py-2 text-center font-medium">Score</th>
                  <th className="px-4 py-2 font-medium">Decision</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="row-in border-t border-border/60 hover:bg-surface-2/60">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">
                      {timeAgo(t.created_at)}
                    </td>
                    <td className="px-4 py-2">
                      {t.accounts?.users.full_name ?? "—"}
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {t.accounts?.account_number}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {t.merchants?.name ?? "—"}
                      <div className="text-[10px] text-muted-foreground">{t.channel}</div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {money(Number(t.amount))}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {t.ip_addresses ? `${t.ip_addresses.city}, ${t.ip_addresses.country}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <ScoreChip score={t.risk_score} />
                    </td>
                    <td className="px-4 py-2">
                      <DecisionBadge decision={t.decision} />
                    </td>
                  </tr>
                ))}
                {txns.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No payments yet. Launch a scenario from the Attack Simulator.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Alert feed</h2>
            <span className="font-mono text-[11px] text-muted-foreground">{alerts.length}</span>
          </header>
          <div className="max-h-[620px] divide-y divide-border/60 overflow-auto">
            {alerts.map((a) => (
              <Link
                key={a.id}
                to="/cases"
                className="row-in block px-4 py-3 transition-colors hover:bg-surface-2/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <SeverityPill severity={a.severity} />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {timeAgo(a.created_at)}
                  </span>
                </div>
                <div className="mt-1.5 text-sm font-medium">{a.title}</div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.description}</p>
              </Link>
            ))}
            {alerts.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No alerts. The engine raises one automatically above score 70.
              </p>
            )}
          </div>
        </section>
      </div>
    </Shell>
  );
}
