"use client";

import { CAMPAIGN_TARGETS, classifyCpr, findCurrentGate } from "@/lib/targets";
import type { DashboardState } from "@/lib/state-types";

function fmtMoney(cents: number | null | undefined) {
  if (cents == null) return "-";
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtPct(v: number | null | undefined) {
  if (v == null) return "-";
  return `${(v * 100).toFixed(2)}%`;
}

function cprColor(cls: ReturnType<typeof classifyCpr>) {
  switch (cls) {
    case "green": return "text-emerald-500";
    case "yellow": return "text-amber-500";
    case "red": return "text-destructive";
    default: return "text-muted-foreground";
  }
}

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${accent ?? ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export function Scorecard({ state }: { state: DashboardState }) {
  const sc = state.scorecard;
  const dsl = state.meta.daysSinceLaunch;
  const gate = dsl != null ? findCurrentGate(dsl) : null;
  const cprCls = classifyCpr(sc.last7.cprCents);
  const learningPct = Math.round(sc.learningProgress * 100);

  const todaySpend = sc.today.spendCents;
  const dailyBudget = sc.budget.dailyCents;
  const monthlySpend = sc.last30.spendCents;
  const monthlyBudget = sc.budget.monthlyCents;

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <Card
        label="Today spend"
        value={fmtMoney(todaySpend)}
        sub={`Plan: ${fmtMoney(dailyBudget)}/day`}
      />
      <Card
        label="MTD spend"
        value={fmtMoney(monthlySpend)}
        sub={`Budget: ${fmtMoney(monthlyBudget)}`}
      />
      <Card
        label="7d CPR"
        value={fmtMoney(sc.last7.cprCents)}
        sub={`Target ≤ ${fmtMoney(CAMPAIGN_TARGETS.cpr.target_ceiling_cents)}`}
        accent={cprColor(cprCls)}
      />
      <Card
        label="Learning phase"
        value={`${sc.eventsThisWeek}/${sc.learningEventsTarget}`}
        sub={`${learningPct}% to exit (50 evt/wk)`}
      />
      <Card
        label="7d link CTR"
        value={fmtPct(sc.last7.ctrLink)}
        sub={`Target ${fmtPct(CAMPAIGN_TARGETS.ctr_link.video.lo)}-${fmtPct(CAMPAIGN_TARGETS.ctr_link.video.hi)}`}
      />
      <Card
        label="7d CPM"
        value={fmtMoney(sc.last7.cpmCents)}
        sub={`Target ${fmtMoney(CAMPAIGN_TARGETS.cpm.lo_cents)}-${fmtMoney(CAMPAIGN_TARGETS.cpm.hi_cents)}`}
      />
      <Card
        label="Days since launch"
        value={dsl == null ? "not active" : String(dsl)}
        sub={state.meta.launchDate ? `Launched ${state.meta.launchDate}` : "Set META_CAMPAIGN_LAUNCH_DATE"}
      />
      <Card
        label="Decision gate"
        value={gate?.label.split(":")[0] || "Pre-launch"}
        sub={gate?.label.split(":")[1]?.trim() || "Awaiting first events"}
      />
    </section>
  );
}
