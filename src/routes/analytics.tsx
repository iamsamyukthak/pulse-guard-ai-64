import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Shell, PageHeader } from "@/components/trustpulse/Shell";
import { money } from "@/components/trustpulse/badges";
import { useAlerts, useCases, useTransactions } from "@/lib/queries";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Fraud Analytics — TrustPulse" },
      {
        name: "description",
        content:
          "Decision mix, blocked exposure, top risk rules and analyst outcomes across the TrustPulse fraud engine.",
      },
      { property: "og:title", content: "Fraud Analytics — TrustPulse" },
      {
        property: "og:description",
        content: "Decision mix, blocked exposure and rule performance for the fraud engine.",
      },
    ],
  }),
  component: AnalyticsPage,
});

const DECISION_COLORS: Record<string, string> = {
  APPROVE: "var(--approve)",
  MONITOR: "var(--monitor)",
  STEP_UP: "var(--stepup)",
  BLOCK: "var(--block)",
};

function AnalyticsPage() {
  const { data: txns = [] } = useTransactions(300);
  const { data: alerts = [] } = useAlerts(200);
  const { data: cases = [] } = useCases();

  const decisionMix = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of txns) counts.set(t.decision, (counts.get(t.decision) ?? 0) + 1);
    return [...counts].map(([name, value]) => ({ name, value }));
  }, [txns]);

  const scoreBuckets = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    for (const t of txns) buckets[Math.min(Math.floor(t.risk_score / 20), 4)]!++;
    return buckets.map((count, i) => ({ range: `${i * 20}-${i * 20 + 19}`, count }));
  }, [txns]);

  const timeline = useMemo(() => {
    const rows = [...txns].reverse();
    let blocked = 0;
    return rows.map((t, i) => {
      if (t.decision === "BLOCK") blocked += Number(t.amount);
      return { i, score: t.risk_score, blocked: Math.round(blocked) };
    });
  }, [txns]);

  const topRules = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of alerts) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    return [...counts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
  }, [alerts]);

  const blockedValue = txns
    .filter((t) => t.decision === "BLOCK")
    .reduce((s, t) => s + Number(t.amount), 0);
  const confirmed = cases.filter((c) => c.resolution === "confirmed_fraud").length;
  const falsePositives = cases.filter((c) => c.resolution === "false_positive").length;
  const precision =
    confirmed + falsePositives > 0
      ? Math.round((confirmed / (confirmed + falsePositives)) * 100)
      : null;

  const stats = [
    { label: "Transactions scored", value: txns.length.toString() },
    { label: "Value blocked", value: money(blockedValue) },
    { label: "Open cases", value: cases.filter((c) => c.status !== "closed").length.toString() },
    { label: "Analyst precision", value: precision === null ? "—" : `${precision}%` },
  ];

  return (
    <Shell>
      <PageHeader
        title="Fraud Analytics"
        subtitle="Portfolio-level view of engine behaviour, exposure prevented and analyst feedback quality."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="panel p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {s.label}
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <section className="panel p-4 xl:col-span-2">
          <h2 className="text-sm font-semibold">Risk score & cumulative blocked exposure</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="i" hide />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  fillOpacity={0.15}
                />
                <Area
                  type="monotone"
                  dataKey="blocked"
                  stroke="var(--block)"
                  fill="var(--block)"
                  fillOpacity={0.08}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel p-4">
          <h2 className="text-sm font-semibold">Decision mix</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={decisionMix}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {decisionMix.map((d) => (
                    <Cell
                      key={d.name}
                      fill={DECISION_COLORS[d.name] ?? "var(--muted-foreground)"}
                      fillOpacity={0.75}
                      stroke="var(--background)"
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel p-4">
          <h2 className="text-sm font-semibold">Score distribution</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreBuckets}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="range"
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--accent)" }}
                  contentStyle={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="var(--primary)" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel p-4 xl:col-span-2">
          <h2 className="text-sm font-semibold">Top alert categories</h2>
          <ul className="mt-4 space-y-2.5">
            {topRules.map((r) => {
              const max = topRules[0]?.count ?? 1;
              return (
                <li key={r.name} className="text-xs">
                  <div className="flex justify-between font-mono uppercase tracking-wider">
                    <span>{r.name}</span>
                    <span className="tabular-nums text-muted-foreground">{r.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(r.count / max) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
            {topRules.length === 0 && (
              <li className="text-sm text-muted-foreground">
                Run a scenario in the simulator to populate analytics.
              </li>
            )}
          </ul>
        </section>
      </div>
    </Shell>
  );
}
