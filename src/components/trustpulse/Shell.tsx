import { Link } from "@tanstack/react-router";
import { Activity, FolderSearch, Network, ShieldAlert, Swords, BarChart3 } from "lucide-react";
import type { ReactNode } from "react";
import { useLiveFraudFeed } from "@/lib/queries";

const nav = [
  { to: "/", label: "Operations", icon: Activity },
  { to: "/simulator", label: "Attack Simulator", icon: Swords },
  { to: "/cases", label: "Cases", icon: FolderSearch },
  { to: "/graph", label: "Fraud Graph", icon: Network },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  useLiveFraudFeed();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4">
          <Link to="/" className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-tight">
              Trust<span className="text-primary">Pulse</span>
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
              fraud ops
            </span>
          </Link>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                activeProps={{ className: "bg-surface-2 text-foreground" }}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="live-dot absolute inline-flex h-2 w-2 rounded-full text-approve" />
              <span className="inline-flex h-2 w-2 rounded-full bg-approve" />
            </span>
            LIVE
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-6">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
