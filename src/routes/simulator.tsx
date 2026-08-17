import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Play, Loader2, Radar, MapPin, Zap, KeyRound, CreditCard, Users } from "lucide-react";
import { Shell, PageHeader } from "@/components/trustpulse/Shell";
import { DecisionBadge, ScoreChip, money, timeAgo } from "@/components/trustpulse/badges";
import { runScenarioFn } from "@/lib/fraud.functions";
import { useTransactions } from "@/lib/queries";

export const Route = createFileRoute("/simulator")({
  head: () => ({
    meta: [
      { title: "Attack Simulator — TrustPulse" },
      {
        name: "description",
        content:
          "Trigger impossible travel, velocity, account takeover, card testing and fraud ring attacks against the live TrustPulse risk engine.",
      },
      { property: "og:title", content: "Attack Simulator — TrustPulse" },
      {
        property: "og:description",
        content: "Trigger real attack scenarios and watch the fraud engine decide in real time.",
      },
    ],
  }),
  component: SimulatorPage,
});

const scenarios = [
  {
    key: "impossible_travel",
    name: "Impossible Travel",
    icon: MapPin,
    detail:
      "A $7 New York coffee, then a $1,890 card-present purchase from Moscow moments later.",
    engine: "Geo-velocity rule + behavioural amount anomaly",
  },
  {
    key: "high_velocity",
    name: "High Velocity Attack",
    icon: Zap,
    detail: "Eight payments hammered through one account in seconds.",
    engine: "60-second velocity rule + velocity drift anomaly",
  },
  {
    key: "account_takeover",
    name: "Account Takeover",
    icon: KeyRound,
    detail: "Emulated device on a Tor exit node draining funds into crypto cash-out.",
    engine: "Emulator + Tor + watchlist + first-seen device rules",
  },
  {
    key: "card_testing",
    name: "Card Testing",
    icon: CreditCard,
    detail: "Ten sub-$5 authorisations probing for live cards at a gift-card merchant.",
    engine: "Micro-authorisation pattern + merchant risk",
  },
  {
    key: "fraud_ring",
    name: "Fraud Ring",
    icon: Users,
    detail: "Five unrelated accounts cashing out through one shared device and IP.",
    engine: "Relationship graph fan-out + shared-entity analysis",
  },
] as const;

function SimulatorPage() {
  const run = useServerFn(runScenarioFn);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const { data: txns = [] } = useTransactions(25);

  const launch = async (key: string, name: string) => {
    setBusy(key);
    try {
      const res = await run({ data: { key } });
      const blocked = res.results.filter((r) => r.decision === "BLOCK").length;
      toast.success(`${name} complete`, {
        description: `${res.results.length} payments ingested · ${blocked} blocked by the engine.`,
      });
      void router.invalidate();
    } catch (e) {
      toast.error("Scenario failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Shell>
      <PageHeader
        title="Attack Simulator"
        subtitle="Each scenario injects genuine transactions through the same ingestion pipeline as organic traffic. The engine — not the scenario — decides the outcome."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {scenarios.map((s) => (
          <div key={s.key} className="panel grid-lines flex flex-col p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-md border border-primary/40 bg-primary/10 p-2 text-primary">
                <s.icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{s.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <Radar className="h-3 w-3" /> {s.engine}
            </div>
            <button
              onClick={() => void launch(s.key, s.name)}
              disabled={busy !== null}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy === s.key ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {busy === s.key ? "Running attack…" : "Launch attack"}
            </button>
          </div>
        ))}

        <div className="panel flex flex-col p-4">
          <h3 className="text-sm font-semibold">Organic baseline</h3>
          <p className="mt-1 flex-1 text-xs text-muted-foreground">
            Push a normal, low-risk payment to prove the engine is not just flagging everything.
          </p>
          <button
            onClick={() => void launch("organic", "Organic payment")}
            disabled={busy !== null}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            {busy === "organic" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Send legitimate payment
          </button>
        </div>
      </div>

      <section className="panel mt-5 overflow-hidden">
        <header className="border-b border-border px-4 py-3 text-sm font-semibold">
          Engine output (live)
        </header>
        <div className="max-h-[420px] divide-y divide-border/60 overflow-auto">
          {txns.map((t) => (
            <div key={t.id} className="row-in flex items-center gap-3 px-4 py-2.5 text-sm">
              <ScoreChip score={t.risk_score} />
              <DecisionBadge decision={t.decision} />
              <span className="font-mono text-xs tabular-nums">{money(Number(t.amount))}</span>
              <span className="truncate text-muted-foreground">
                {t.merchants?.name} · {t.accounts?.users.full_name}
              </span>
              <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                {t.scenario_tag ?? "organic"} · {timeAgo(t.created_at)}
              </span>
            </div>
          ))}
          {txns.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Launch a scenario to see the engine respond.
            </p>
          )}
        </div>
      </section>
    </Shell>
  );
}
