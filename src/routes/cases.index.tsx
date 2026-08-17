import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { FolderOpen, Loader2 } from "lucide-react";
import { Shell, PageHeader } from "@/components/trustpulse/Shell";
import { DecisionBadge, ScoreChip, SeverityPill, money, timeAgo } from "@/components/trustpulse/badges";
import { useAlerts, useCases } from "@/lib/queries";
import { openCaseFn } from "@/lib/fraud.functions";

export const Route = createFileRoute("/cases/")({
  head: () => ({
    meta: [
      { title: "Investigation Cases — TrustPulse" },
      {
        name: "description",
        content:
          "Work fraud cases: inspect risk factors, review related entities, query the AI copilot and record dispositions.",
      },
      { property: "og:title", content: "Investigation Cases — TrustPulse" },
      {
        property: "og:description",
        content: "Fraud investigation queue with evidence, related entities and analyst dispositions.",
      },
    ],
  }),
  component: CasesPage,
});

function CasesPage() {
  const { data: cases = [] } = useCases();
  const { data: alerts = [] } = useAlerts(30);
  const openCase = useServerFn(openCaseFn);
  const [busy, setBusy] = useState<string | null>(null);

  const casedTxns = new Set(cases.map((c) => c.transaction_id));
  const uncased = alerts.filter((a) => !casedTxns.has(a.transaction_id));

  const promote = async (alertId: string) => {
    setBusy(alertId);
    try {
      await openCase({ data: { alertId } });
      toast.success("Case opened");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to open case");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Shell>
      <PageHeader
        title="Investigation Queue"
        subtitle="Cases are opened automatically for blocked payments. Alerts below score 90 can be promoted manually."
      />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="panel overflow-hidden">
          <header className="border-b border-border px-4 py-3 text-sm font-semibold">
            Cases ({cases.length})
          </header>
          <div className="divide-y divide-border/60">
            {cases.map((c) => (
              <Link
                key={c.id}
                to="/cases/$caseId"
                params={{ caseId: c.id }}
                className="row-in block px-4 py-3 transition-colors hover:bg-surface-2/60"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityPill severity={c.priority} />
                  <span className="text-sm font-medium">{c.title}</span>
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {c.status}
                    {c.resolution ? ` · ${c.resolution.replace("_", " ")}` : ""}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {c.transactions && (
                    <>
                      <ScoreChip score={c.transactions.risk_score} />
                      <DecisionBadge decision={c.transactions.decision} />
                      <span className="font-mono">{money(Number(c.transactions.amount))}</span>
                      <span className="font-mono">{c.transactions.scenario_tag ?? "organic"}</span>
                    </>
                  )}
                  <span className="ml-auto font-mono">{timeAgo(c.created_at)}</span>
                </div>
              </Link>
            ))}
            {cases.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No cases yet — run an attack scenario to generate one.
              </p>
            )}
          </div>
        </section>

        <section className="panel overflow-hidden">
          <header className="border-b border-border px-4 py-3 text-sm font-semibold">
            Alerts without a case ({uncased.length})
          </header>
          <div className="divide-y divide-border/60">
            {uncased.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <SeverityPill severity={a.severity} />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {timeAgo(a.created_at)}
                  </span>
                </div>
                <div className="mt-1.5 text-sm">{a.title}</div>
                <button
                  onClick={() => void promote(a.id)}
                  disabled={busy !== null}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {busy === a.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FolderOpen className="h-3.5 w-3.5" />
                  )}
                  Open case
                </button>
              </div>
            ))}
            {uncased.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Every alert already has a case.
              </p>
            )}
          </div>
        </section>
      </div>
    </Shell>
  );
}
