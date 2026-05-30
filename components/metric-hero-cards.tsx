"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp, DollarSign } from "lucide-react";
import type { DashboardState, TrendPoint } from "@/lib/state-types";
import { CAMPAIGN_TARGETS } from "@/lib/targets";

type SeriesPoint = { date: string; value: number | null };

function avg(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null && x > 0);
  if (v.length === 0) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function deltaPct(latest: number | null, baseline: number | null): number | null {
  if (latest == null || baseline == null || baseline === 0) return null;
  return ((latest - baseline) / baseline) * 100;
}

function readingLine(metric: "cpr" | "cpm", latest: number | null, baseline: number | null, band: { lo: number; hi: number }, hint?: string): string {
  if (latest == null) return "Awaiting first events.";
  const inBand = latest >= band.lo && latest <= band.hi;
  const d = deltaPct(latest, baseline);
  const trendWord = d == null ? "steady" : d > 5 ? "climbing" : d < -5 ? "improving" : "steady";

  if (metric === "cpr") {
    if (latest < band.lo) return `Below target band - scaling room. ${hint ?? ""}`.trim();
    if (inBand) return `Holding inside target band, ${trendWord}.`;
    if (latest <= CAMPAIGN_TARGETS.cpr.red_floor_cents) return `Above band, watch the trend.`;
    return `In red zone, cull losers immediately.`;
  }
  // cpm
  if (inBand) return `Auction healthy, ${trendWord}.`;
  if (latest < band.lo) return `Cheap inventory, expand reach.`;
  return `Auction expensive, ${trendWord}. Test fresh creative angles.`;
}

function HeroCard({
  title,
  Icon,
  series,
  format,
  band,
  bandLabel,
  reading,
  delta,
}: {
  title: string;
  Icon: typeof TrendingUp;
  series: SeriesPoint[];
  format: (v: number | null | undefined) => string;
  band: { lo: number; hi: number };
  bandLabel: string;
  reading: string;
  delta: number | null;
}) {
  const latest = series.length > 0 ? series[series.length - 1].value : null;
  const inBand = latest != null && latest >= band.lo && latest <= band.hi;
  const deltaIcon = delta == null ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const DeltaIcon = deltaIcon;
  const deltaColor =
    delta == null
      ? "text-muted-foreground"
      : (title.includes("CPR") || title.includes("CPM"))
        ? delta > 5 ? "text-destructive" : delta < -5 ? "text-emerald-500" : "text-muted-foreground"
        : delta > 5 ? "text-emerald-500" : delta < -5 ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 relative overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${inBand ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{title}</div>
            <div className="text-2xl font-bold tabular-nums">{format(latest)}</div>
          </div>
        </div>

        {delta != null && (
          <div className={`flex items-center gap-1 text-xs font-medium ${deltaColor}`}>
            <DeltaIcon className="w-3.5 h-3.5" />
            {Math.abs(delta).toFixed(1)}%
            <span className="text-muted-foreground font-normal">vs 7d avg</span>
          </div>
        )}
      </div>

      <div className="h-20 -mx-2 mb-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={inBand ? "#10b981" : "#f59e0b"} stopOpacity={0.4} />
                <stop offset="100%" stopColor={inBand ? "#10b981" : "#f59e0b"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", fontSize: 11, borderRadius: 8 }}
              formatter={(v: unknown) => format(typeof v === "number" ? v : null)}
              labelFormatter={(l: unknown) => String(l ?? "")}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={inBand ? "#10b981" : "#f59e0b"}
              strokeWidth={2}
              fill={`url(#grad-${title})`}
              connectNulls
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] mb-2">
        <span className="text-muted-foreground">{bandLabel}</span>
        <div className="flex-1 mx-3 h-1 rounded-full bg-muted overflow-hidden relative">
          <div className="absolute inset-y-0 bg-emerald-500/30" style={{ left: "30%", right: "30%" }} />
        </div>
      </div>

      <p className="text-xs text-foreground/80 leading-relaxed">
        <span className="text-primary mr-1">AI:</span>
        {reading}
      </p>
    </div>
  );
}

export function MetricHeroCards({ state }: { state: DashboardState }) {
  const trend = state.trend;
  if (trend.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 mb-6 text-sm text-muted-foreground">
        No trend data yet. Hero metrics populate after the campaign collects daily insights.
      </section>
    );
  }

  const trendWithMoney = trend.map((p: TrendPoint) => ({
    date: p.date.slice(5),
    cpr: p.cprCents != null ? p.cprCents / 100 : null,
    cpm: p.cpmCents > 0 ? p.cpmCents / 100 : null,
  }));

  const cprSeries: SeriesPoint[] = trendWithMoney.map((p) => ({ date: p.date, value: p.cpr }));
  const cpmSeries: SeriesPoint[] = trendWithMoney.map((p) => ({ date: p.date, value: p.cpm }));

  const cprLatest = cprSeries[cprSeries.length - 1]?.value ?? null;
  const cpmLatest = cpmSeries[cpmSeries.length - 1]?.value ?? null;
  const cprBaseline = avg(cprSeries.slice(0, -1).map((p) => p.value));
  const cpmBaseline = avg(cpmSeries.slice(0, -1).map((p) => p.value));

  const cprBand = {
    lo: CAMPAIGN_TARGETS.cpr.week1_2_band.lo / 100,
    hi: CAMPAIGN_TARGETS.cpr.week1_2_band.hi / 100,
  };
  const cpmBand = {
    lo: CAMPAIGN_TARGETS.cpm.lo_cents / 100,
    hi: CAMPAIGN_TARGETS.cpm.hi_cents / 100,
  };

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <HeroCard
        title="CPR (Cost per Registration)"
        Icon={DollarSign}
        series={cprSeries}
        format={(v) => (v == null ? "-" : `$${v.toFixed(2)}`)}
        band={cprBand}
        bandLabel={`Target $${cprBand.lo}-$${cprBand.hi}`}
        reading={readingLine("cpr", cprLatest != null ? cprLatest * 100 : null, cprBaseline != null ? cprBaseline * 100 : null, CAMPAIGN_TARGETS.cpr.week1_2_band)}
        delta={deltaPct(cprLatest, cprBaseline)}
      />
      <HeroCard
        title="CPM (Cost per 1k Impressions)"
        Icon={TrendingUp}
        series={cpmSeries}
        format={(v) => (v == null ? "-" : `$${v.toFixed(2)}`)}
        band={cpmBand}
        bandLabel={`Target $${cpmBand.lo}-$${cpmBand.hi}`}
        reading={readingLine("cpm", cpmLatest != null ? cpmLatest * 100 : null, cpmBaseline != null ? cpmBaseline * 100 : null, { lo: CAMPAIGN_TARGETS.cpm.lo_cents, hi: CAMPAIGN_TARGETS.cpm.hi_cents })}
        delta={deltaPct(cpmLatest, cpmBaseline)}
      />
    </section>
  );
}
