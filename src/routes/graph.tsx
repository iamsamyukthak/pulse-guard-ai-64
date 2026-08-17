import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell, PageHeader } from "@/components/trustpulse/Shell";
import { useRelationships, useTransactions, useWatchlist } from "@/lib/queries";

export const Route = createFileRoute("/graph")({
  head: () => ({
    meta: [
      { title: "Fraud Relationship Graph — TrustPulse" },
      {
        name: "description",
        content:
          "Explore how accounts, devices, IP addresses and merchants connect, exposing shared-entity fraud rings.",
      },
      { property: "og:title", content: "Fraud Relationship Graph — TrustPulse" },
      {
        property: "og:description",
        content: "Shared devices, IPs and merchants that reveal coordinated fraud rings.",
      },
    ],
  }),
  component: GraphPage,
});

type Node = {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  degree: number;
  risky: boolean;
};

function GraphPage() {
  const { data: rels = [] } = useRelationships();
  const { data: watchlist = [] } = useWatchlist();
  const { data: txns = [] } = useTransactions(200);
  const [selected, setSelected] = useState<string | null>(null);

  const watchValues = new Set(watchlist.map((w) => w.entity_value));

  const { nodes, edges } = useMemo(() => {
    const degree = new Map<string, number>();
    for (const r of rels) {
      degree.set(r.source_id, (degree.get(r.source_id) ?? 0) + 1);
      degree.set(r.target_id, (degree.get(r.target_id) ?? 0) + 1);
    }

    const byType: Record<string, { id: string; label: string; type: string }[]> = {
      account: [],
      device: [],
      ip: [],
      merchant: [],
    };
    const seen = new Set<string>();
    const accountLabel = new Map<string, string>();
    for (const t of txns) {
      if (t.accounts) accountLabel.set(t.account_id, t.accounts.users.full_name);
    }
    for (const r of rels) {
      if (!seen.has(r.source_id)) {
        seen.add(r.source_id);
        byType["account"]!.push({
          id: r.source_id,
          label: accountLabel.get(r.source_id) ?? r.source_label,
          type: "account",
        });
      }
      if (!seen.has(r.target_id)) {
        seen.add(r.target_id);
        (byType[r.target_type] ?? byType["merchant"]!).push({
          id: r.target_id,
          label: r.target_label,
          type: r.target_type,
        });
      }
    }

    const columns = ["account", "device", "ip", "merchant"];
    const width = 1000;
    const height = 560;
    const nodes: Node[] = [];
    columns.forEach((type, ci) => {
      const list = byType[type] ?? [];
      const x = 90 + (ci * (width - 180)) / Math.max(columns.length - 1, 1);
      list.forEach((n, i) => {
        nodes.push({
          ...n,
          x,
          y: 60 + ((i + 0.5) * (height - 120)) / Math.max(list.length, 1),
          degree: degree.get(n.id) ?? 1,
          risky: watchValues.has(n.label),
        });
      });
    });

    const pos = new Map(nodes.map((n) => [n.id, n]));
    const edges = rels
      .filter((r) => pos.has(r.source_id) && pos.has(r.target_id))
      .map((r) => ({
        id: r.id,
        from: pos.get(r.source_id)!,
        to: pos.get(r.target_id)!,
        weight: r.weight as number,
        relation: r.relation as string,
      }));

    return { nodes, edges };
  }, [rels, txns, watchValues]);

  const colorFor = (type: string, risky: boolean) =>
    risky
      ? "var(--block)"
      : type === "account"
        ? "var(--primary)"
        : type === "device"
          ? "var(--chart-5)"
          : type === "ip"
            ? "var(--monitor)"
            : "var(--approve)";

  const active = nodes.find((n) => n.id === selected);
  const activeEdges = active
    ? edges.filter((e) => e.from.id === active.id || e.to.id === active.id)
    : [];

  return (
    <Shell>
      <PageHeader
        title="Fraud Relationship Graph"
        subtitle="Accounts linked to shared devices, IPs and merchants. Fan-out here feeds the graph component of every risk score."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="panel grid-lines overflow-hidden">
          <svg viewBox="0 0 1000 560" className="h-[560px] w-full">
            {edges.map((e) => {
              const highlight =
                active && (e.from.id === active.id || e.to.id === active.id);
              return (
                <line
                  key={e.id}
                  x1={e.from.x}
                  y1={e.from.y}
                  x2={e.to.x}
                  y2={e.to.y}
                  stroke={highlight ? "var(--primary)" : "var(--border)"}
                  strokeWidth={highlight ? 2 : Math.min(1 + e.weight * 0.25, 3)}
                  opacity={active && !highlight ? 0.18 : 0.7}
                />
              );
            })}
            {nodes.map((n) => {
              const r = Math.min(8 + n.degree * 1.6, 20);
              const dim = active && active.id !== n.id && !activeEdges.some((e) => e.from.id === n.id || e.to.id === n.id);
              return (
                <g
                  key={n.id}
                  onClick={() => setSelected(n.id === selected ? null : n.id)}
                  className="cursor-pointer"
                  opacity={dim ? 0.25 : 1}
                >
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={r}
                    fill={colorFor(n.type, n.risky)}
                    fillOpacity={0.25}
                    stroke={colorFor(n.type, n.risky)}
                    strokeWidth={n.risky ? 2.5 : 1.5}
                  />
                  <text
                    x={n.x}
                    y={n.y + r + 12}
                    textAnchor="middle"
                    className="fill-muted-foreground font-mono"
                    style={{ fontSize: 9 }}
                  >
                    {n.label.length > 22 ? `${n.label.slice(0, 20)}…` : n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </section>

        <aside className="space-y-4">
          <div className="panel p-4">
            <h2 className="text-sm font-semibold">Legend</h2>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              {[
                ["Account", "var(--primary)"],
                ["Device", "var(--chart-5)"],
                ["IP address", "var(--monitor)"],
                ["Merchant", "var(--approve)"],
                ["Watchlisted", "var(--block)"],
              ].map(([label, color]) => (
                <li key={label} className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: color as string, opacity: 0.6 }}
                  />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-4">
            <h2 className="text-sm font-semibold">
              {active ? active.label : "Select a node"}
            </h2>
            {active ? (
              <div className="mt-3 space-y-2 text-xs">
                <div className="font-mono uppercase tracking-wider text-muted-foreground">
                  {active.type} · degree {active.degree}
                  {active.risky ? " · watchlisted" : ""}
                </div>
                <ul className="space-y-1.5">
                  {activeEdges.map((e) => (
                    <li key={e.id} className="rounded border border-border bg-surface-2/50 p-2">
                      <span className="font-mono">{e.relation}</span> ·{" "}
                      {e.from.id === active.id ? e.to.label : e.from.label} · {e.weight}×
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Click any node to isolate its connections. Nodes grow with the number of shared
                links — a large device or IP node is the signature of a fraud ring.
              </p>
            )}
          </div>
        </aside>
      </div>
    </Shell>
  );
}
