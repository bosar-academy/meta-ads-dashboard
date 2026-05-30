"use client";

import type { DashboardState } from "@/lib/state-types";
import { CAMPAIGN_TARGETS } from "@/lib/targets";
import { Eye, MousePointerClick, UserCheck, Users, Phone, GraduationCap, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";

function pct(num: number, den: number) {
  if (den === 0) return null;
  return (num / den) * 100;
}

function fmtPct(v: number | null) {
  if (v == null) return "-";
  return `${v.toFixed(1)}%`;
}

function fmtMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

type Band = { lo: number; hi: number };
function rateColor(p: number | null, band?: Band): string {
  if (p == null) return "text-muted-foreground";
  if (!band) return "text-foreground/70";
  if (p >= band.lo && p <= band.hi) return "text-emerald-500";
  if (p < band.lo * 0.6 || p > band.hi * 1.5) return "text-destructive";
  return "text-amber-500";
}

type Step = {
  label: string;
  value: number;
  base: number;
  icon: LucideIcon;
  bandPct?: Band;
  bandLabel?: string;
  sourceNote?: string;
};

export function Funnel({ state }: { state: DashboardState }) {
  const f = state.funnel;
  const t = CAMPAIGN_TARGETS.funnel_assumptions;

  const steps: Step[] = [
    {
      label: "Impressions",
      value: f.metaPixelImpressions,
      base: f.metaPixelImpressions,
      icon: Eye,
      sourceNote: "Meta",
    },
    {
      label: "Link clicks",
      value: f.metaPixelLinkClicks,
      base: f.metaPixelImpressions,
      icon: MousePointerClick,
      bandPct: { lo: 2.5, hi: 5 },
      bandLabel: "CTR target 2.5-5%",
      sourceNote: "Meta",
    },
    {
      label: "Registrations",
      value: f.registrations,
      base: f.metaPixelLinkClicks,
      icon: Users,
      bandPct: { lo: t.lp_conversion.lo * 100, hi: t.lp_conversion.hi * 100 },
      bandLabel: `LP conv ${Math.round(t.lp_conversion.lo * 100)}-${Math.round(t.lp_conversion.hi * 100)}%`,
      sourceNote: `Airtable deduped (Meta pixel: ${f.metaPixelRegistrations})`,
    },
    {
      label: "Attended",
      value: f.attended,
      base: f.registrations,
      icon: UserCheck,
      bandPct: { lo: 30, hi: 50 },
      bandLabel: "Show rate 30-50%",
      sourceNote: "EverWebinar -> Airtable",
    },
    {
      label: "Calls booked",
      value: f.callsBooked,
      base: f.attended,
      icon: Phone,
      bandPct: { lo: 15, hi: 35 },
      bandLabel: "Attend -> call 15-35%",
      sourceNote: "Framework Leads",
    },
    {
      label: "Enrollments",
      value: f.enrollments,
      base: f.callsBooked,
      icon: GraduationCap,
      bandPct: { lo: t.call_to_close_rate * 100 - 10, hi: t.call_to_close_rate * 100 + 10 },
      bandLabel: `Close ${Math.round(t.call_to_close_rate * 100)}%`,
      sourceNote: "Framework Leads",
    },
  ];

  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <section className="rounded-xl border border-border bg-card mb-6">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold">Full-funnel (paid Meta, last 30d)</h2>
        <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
          <span>CAC ceiling {fmtMoney(CAMPAIGN_TARGETS.cac_target.ceiling_cents)}</span>
          <span>·</span>
          <span>Cost/call $250-500</span>
          {(f.duplicatesCollapsed > 0 || f.testEmailsExcluded > 0) && (
            <span className="inline-flex items-center gap-1 text-emerald-500" title="Deduplication and test-email filter applied">
              <Info className="w-3 h-3" />
              {f.duplicatesCollapsed > 0 && `${f.duplicatesCollapsed} dup${f.duplicatesCollapsed > 1 ? "s" : ""} collapsed`}
              {f.duplicatesCollapsed > 0 && f.testEmailsExcluded > 0 && ", "}
              {f.testEmailsExcluded > 0 && `${f.testEmailsExcluded} test row${f.testEmailsExcluded > 1 ? "s" : ""} excluded`}
            </span>
          )}
        </div>
      </div>
      <div className="px-5 py-4 space-y-2.5">
        {steps.map((s, i) => {
          const widthPct = Math.max(2, (s.value / max) * 100);
          const conversionPct = i === 0 ? null : pct(s.value, s.base);
          const Icon = s.icon;
          const color = rateColor(conversionPct, s.bandPct);

          return (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-40 flex items-center gap-2 text-sm">
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{s.label}</span>
              </div>

              <div className="flex-1 h-9 bg-muted/60 rounded-lg relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/80 to-primary/50 transition-all"
                  style={{ width: `${widthPct}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-3 text-sm">
                  <span className="font-semibold tabular-nums">{s.value.toLocaleString()}</span>
                  {s.sourceNote && (
                    <span className="text-[10px] text-foreground/60 hidden sm:inline">{s.sourceNote}</span>
                  )}
                </div>
              </div>

              <div className="w-32 text-right text-xs">
                {conversionPct != null ? (
                  <>
                    <div className={`font-semibold ${color}`}>{fmtPct(conversionPct)}</div>
                    {s.bandLabel && <div className="text-[10px] text-muted-foreground">{s.bandLabel}</div>}
                  </>
                ) : (
                  <div className="text-muted-foreground">top of funnel</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
