import { cn } from "@/lib/utils";

const decisionStyles: Record<string, string> = {
  APPROVE: "bg-approve/15 text-approve border-approve/40",
  MONITOR: "bg-monitor/15 text-monitor border-monitor/40",
  STEP_UP: "bg-stepup/15 text-stepup border-stepup/40",
  BLOCK: "bg-block/20 text-block border-block/50",
};

const decisionLabel: Record<string, string> = {
  APPROVE: "APPROVE",
  MONITOR: "MONITOR",
  STEP_UP: "STEP-UP",
  BLOCK: "BLOCK",
};

export function DecisionBadge({
  decision,
  className,
}: {
  decision: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider",
        decisionStyles[decision] ?? decisionStyles["MONITOR"],
        className,
      )}
    >
      {decisionLabel[decision] ?? decision}
    </span>
  );
}

export function scoreTone(score: number) {
  if (score >= 90) return "block";
  if (score >= 70) return "stepup";
  if (score >= 40) return "monitor";
  return "approve";
}

export function ScoreChip({ score }: { score: number }) {
  const tone = scoreTone(score);
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-9 items-center justify-center rounded-md border px-1.5 font-mono text-xs font-bold tabular-nums",
        tone === "block" && "border-block/50 bg-block/20 text-block",
        tone === "stepup" && "border-stepup/40 bg-stepup/15 text-stepup",
        tone === "monitor" && "border-monitor/40 bg-monitor/15 text-monitor",
        tone === "approve" && "border-approve/40 bg-approve/15 text-approve",
      )}
    >
      {score}
    </span>
  );
}

export function ScoreMeter({ score, label }: { score: number; label?: string }) {
  const tone = scoreTone(score);
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span className="font-mono tabular-nums text-foreground">{score}</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            tone === "block" && "bg-block",
            tone === "stepup" && "bg-stepup",
            tone === "monitor" && "bg-monitor",
            tone === "approve" && "bg-approve",
          )}
          style={{ width: `${Math.max(score, 2)}%` }}
        />
      </div>
    </div>
  );
}

export function SeverityPill({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "bg-block/20 text-block border-block/50",
    high: "bg-stepup/15 text-stepup border-stepup/40",
    medium: "bg-monitor/15 text-monitor border-monitor/40",
    low: "bg-approve/15 text-approve border-approve/40",
  };
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        map[severity] ?? map["medium"],
      )}
    >
      {severity}
    </span>
  );
}

export function CategoryTag({ category }: { category: string }) {
  const map: Record<string, string> = {
    rule: "text-primary border-primary/40 bg-primary/10",
    anomaly: "text-monitor border-monitor/40 bg-monitor/10",
    graph: "text-chart-5 border-chart-5/40 bg-chart-5/10",
  };
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        map[category] ?? map["rule"],
      )}
    >
      {category}
    </span>
  );
}

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export const timeAgo = (iso: string) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
