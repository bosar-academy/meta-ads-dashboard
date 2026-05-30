"use client";

import { AlertTriangle, AlertCircle, TrendingDown, TrendingUp, CheckCircle2 } from "lucide-react";
import type { Anomaly, DashboardState } from "@/lib/state-types";

const STYLES: Record<Anomaly["severity"], { bg: string; text: string; Icon: typeof AlertTriangle; label: string }> = {
  alert: { bg: "bg-destructive/10 border-destructive/30", text: "text-destructive", Icon: AlertTriangle, label: "Alert" },
  warn: { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-500", Icon: AlertCircle, label: "Watch" },
  info: { bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-500", Icon: CheckCircle2, label: "Good" },
};

const METRIC_LABEL: Record<Anomaly["metric"], string> = {
  cpr: "CPR",
  cpm: "CPM",
  ctr: "Link CTR",
  spend: "Spend",
  regs: "Registrations",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AnomalyBanner({ state }: { state: DashboardState }) {
  const anomalies = state.anomalies || [];
  if (anomalies.length === 0) return null;

  return (
    <section className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {anomalies.map((a, i) => {
        const s = STYLES[a.severity];
        const Icon = s.Icon;
        const DirIcon = a.direction === "up" ? TrendingUp : TrendingDown;
        return (
          <div key={i} className={`rounded-xl border ${s.bg} px-4 py-3 flex items-start gap-3`}>
            <Icon className={`w-4 h-4 mt-0.5 ${s.text} shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium mb-0.5 flex-wrap">
                <span className={`uppercase tracking-wide ${s.text}`}>{s.label}</span>
                <span className="text-foreground">{METRIC_LABEL[a.metric]}</span>
                <DirIcon className={`w-3 h-3 ${s.text}`} />
                <span className={`tabular-nums ${s.text}`}>{Math.abs(a.changePct)}%</span>
                <span className="text-muted-foreground font-normal">on {fmtDate(a.date)}</span>
              </div>
              <p className="text-xs text-foreground/85 leading-relaxed">{a.message}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
