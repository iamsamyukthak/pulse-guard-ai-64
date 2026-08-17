import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Flag,
  Loader2,
  ShieldOff,
  ThumbsDown,
  Unlock,
} from "lucide-react";
import { Shell } from "@/components/trustpulse/Shell";
import { Copilot } from "@/components/trustpulse/Copilot";
import {
  CategoryTag,
  DecisionBadge,
  ScoreMeter,
  SeverityPill,
  money,
  timeAgo,
} from "@/components/trustpulse/badges";
import { addNoteFn, caseActionFn } from "@/lib/fraud.functions";
import {
  useCase,
  useNotes,
  useRelationships,
  useRiskEvents,
  useTransaction,
} from "@/lib/queries";

export const Route = createFileRoute("/cases/$caseId")({
  head: () => ({
    meta: [
      { title: "Case detail — TrustPulse" },
      {
        name: "description",
        content:
          "Inspect the risk factors, related entities, analyst notes and copilot findings behind a fraud decision.",
      },
      { property: "og:title", content: "Case detail — TrustPulse" },
      {
        property: "og:description",
        content: "Full evidence view for a blocked or challenged payment.",
      },
    ],
  }),
  component: CaseDetail,
});

const ACTIONS = [
  { key: "confirm_fraud", label: "Confirm fraud", icon: ShieldOff, tone: "block" },
  { key: "false_positive", label: "False positive", icon: ThumbsDown, tone: "approve" },
  { key: "escalate", label: "Escalate", icon: Flag, tone: "monitor" },
  { key: "release", label: "Release payment", icon: Unlock, tone: "muted" },
] as const;

function CaseDetail() {
  const { caseId } = Route.useParams();
  const { data: kase } = useCase(caseId);
  const { data: txn } = useTransaction(kase?.transaction_id ?? "");
  const { data: events = [] } = useRiskEvents(kase?.transaction_id);
  const { data: notes = [] } = useNotes(caseId);
  const { data: relationships = [] } = useRelationships();

  const act = useServerFn(caseActionFn);
  const addNote = useServerFn(addNoteFn);
  const [busy, setBusy] = useState<string | null>(null);
  const [rationale, setRationale] = useState("");
  const [note, setNote] = useState("");

  const related = relationships.filter(
    (r) =>
      r.target_id === txn?.device_id ||
      r.target_id === txn?.ip_id ||
      r.source_id === txn?.account_id,
  );

  const disposition = async (action: string, label: string) => {
    setBusy(action);
    try {
      await act({ data: { caseId, action, rationale } });
      toast.success(`${label} recorded`, {
        description: "Feedback stored for model learning and analytics.",
      });
      setRationale("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const submitNote = async () => {
    if (!note.trim()) return;
    setBusy("note");
    try {
      await addNote({ data: { caseId, body: note } });
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save note");
    } finally {
      setBusy(null);
    }
  };

  if (!kase || !txn) {
    return (
      <Shell>
        <div className="panel p-10 text-center text-sm text-muted-foreground">Loading case…</div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Link
        to="/cases"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to queue
      </Link>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <section className="panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityPill severity={kase.priority} />
              <h1 className="text-lg font-semibold">{kase.title}</h1>
              <span className="ml-auto font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {kase.status}
                {kase.resolution ? ` · ${kase.resolution.replace("_", " ")}` : ""}
              </span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
              <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-center">
                <div className="font-mono text-4xl font-bold tabular-nums">{txn.risk_score}</div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  risk score
                </div>
                <div className="mt-2">
                  <DecisionBadge decision={txn.decision} />
                </div>
              </div>
              <div className="space-y-3">
                <ScoreMeter score={txn.rule_score} label="Deterministic rules" />
                <ScoreMeter score={txn.anomaly_score} label="Behavioural anomaly" />
                <ScoreMeter score={txn.graph_score} label="Relationship graph" />
              </div>
            </div>

            <p className="mt-4 rounded-md border border-border bg-surface-2/40 p-3 text-sm text-muted-foreground">
              {txn.explanation}
            </p>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Amount", money(Number(txn.amount))],
                ["Customer", txn.accounts?.users.full_name ?? "—"],
                ["Merchant", txn.merchants?.name ?? "—"],
                ["Channel", txn.channel],
                ["Device", txn.devices?.fingerprint ?? "—"],
                [
                  "Location",
                  txn.ip_addresses
                    ? `${txn.ip_addresses.city}, ${txn.ip_addresses.country}`
                    : "—",
                ],
                ["IP", txn.ip_addresses?.ip ?? "—"],
                ["Occurred", timeAgo(txn.created_at)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 font-mono text-xs">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="panel overflow-hidden">
            <header className="border-b border-border px-4 py-3 text-sm font-semibold">
              Risk factors ({events.length})
            </header>
            <ul className="divide-y divide-border/60">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3 px-4 py-3">
                  <span className="mt-0.5 font-mono text-xs font-bold tabular-nums text-foreground">
                    +{e.weight}
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{e.label}</span>
                      <CategoryTag category={e.category} />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {e.rule_code}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{e.detail}</p>
                  </div>
                </li>
              ))}
              {events.length === 0 && (
                <li className="px-4 py-6 text-sm text-muted-foreground">No signals recorded.</li>
              )}
            </ul>
          </section>

          <section className="panel overflow-hidden">
            <header className="border-b border-border px-4 py-3 text-sm font-semibold">
              Related entities ({related.length})
            </header>
            <ul className="divide-y divide-border/60 text-sm">
              {related.slice(0, 12).map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {r.target_type}
                  </span>
                  <span className="font-mono text-xs">{r.target_label}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    {r.relation} · seen {r.weight}×
                  </span>
                </li>
              ))}
              {related.length === 0 && (
                <li className="px-4 py-6 text-sm text-muted-foreground">No linked entities yet.</li>
              )}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <section className="panel p-4">
            <h2 className="text-sm font-semibold">Analyst disposition</h2>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Rationale (stored with the feedback for future learning)…"
              rows={2}
              className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {ACTIONS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => void disposition(a.key, a.label)}
                  disabled={busy !== null}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                    a.tone === "block"
                      ? "border-block/50 bg-block/15 text-block hover:bg-block/25"
                      : a.tone === "approve"
                        ? "border-approve/40 bg-approve/15 text-approve hover:bg-approve/25"
                        : a.tone === "monitor"
                          ? "border-monitor/40 bg-monitor/15 text-monitor hover:bg-monitor/25"
                          : "border-border bg-surface-2 hover:bg-accent"
                  }`}
                >
                  {busy === a.key ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <a.icon className="h-3.5 w-3.5" />
                  )}
                  {a.label}
                </button>
              ))}
            </div>
          </section>

          <div className="h-[520px]">
            <Copilot transactionId={txn.id} />
          </div>

          <section className="panel overflow-hidden">
            <header className="border-b border-border px-4 py-3 text-sm font-semibold">
              Investigation notes ({notes.length})
            </header>
            <ul className="max-h-64 divide-y divide-border/60 overflow-auto">
              {notes.map((n) => (
                <li key={n.id} className="px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>{n.author}</span>
                    <span>{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="mt-1">{n.body}</p>
                </li>
              ))}
              {notes.length === 0 && (
                <li className="px-4 py-6 text-sm text-muted-foreground">No notes yet.</li>
              )}
            </ul>
            <div className="flex gap-2 border-t border-border p-3">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note…"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={() => void submitNote()}
                disabled={busy !== null || !note.trim()}
                className="inline-flex items-center rounded-md bg-primary px-3 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}
