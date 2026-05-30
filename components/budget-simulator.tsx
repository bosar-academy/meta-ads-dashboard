"use client";

import { useState } from "react";
import { Calculator, Info } from "lucide-react";
import type { DashboardState } from "@/lib/state-types";

function fmtMoney(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

export function BudgetSimulator({ state }: { state: DashboardState }) {
  const currentDaily = state.scorecard.budget.dailyCents;
  const [dailyCents, setDailyCents] = useState(currentDaily);

  const last7 = state.scorecard.last7;
  const baselineSpend7 = last7.spendCents;
  const baselineRegs7 = last7.registrations;
  const baselineCpr = last7.cprCents;

  // Estimate regs at the new budget: scale linearly, then apply diminishing returns above 1.5x current.
  const scale = currentDaily > 0 ? dailyCents / currentDaily : 1;
  const diminish = scale > 1.5 ? 0.85 : scale > 1 ? 0.95 : 1;
  const monthlySpend = dailyCents * 30;
  const projectedRegs7 = baselineRegs7 > 0 ? Math.round(baselineRegs7 * scale * diminish) : 0;
  const projectedRegs30 = projectedRegs7 * (30 / 7);
  const projectedCpr = projectedRegs30 > 0 ? Math.round(monthlySpend / projectedRegs30) : null;

  // Funnel projection using historical conversion rates from this campaign.
  const f = state.funnel;
  const regsToAttended = f.registrations > 0 ? f.attended / f.registrations : 0.3;
  const attendedToCalls = f.attended > 0 ? f.callsBooked / f.attended : 0.2;
  const callsToEnrolled = f.callsBooked > 0 ? f.enrollments / f.callsBooked : 0.25;

  const projAttended = Math.round(projectedRegs30 * regsToAttended);
  const projCalls = Math.round(projAttended * attendedToCalls);
  const projEnrolled = Math.round(projCalls * callsToEnrolled);

  const SLIDER_MIN = Math.max(1000, Math.round(currentDaily * 0.3));
  const SLIDER_MAX = Math.round(currentDaily * 3);

  return (
    <section className="rounded-xl border border-border bg-card p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Calculator className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">Budget what-if simulator</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Projects 30-day outcomes from current 7d CPR + your funnel conversion rates. Assumes mild diminishing returns above 1.5x.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs text-muted-foreground">Daily budget</span>
            <span className="text-2xl font-semibold tabular-nums">{fmtMoney(dailyCents)}<span className="text-sm text-muted-foreground font-normal">/day</span></span>
          </div>
          <input
            type="range"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={500}
            value={dailyCents}
            onChange={(e) => setDailyCents(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{fmtMoney(SLIDER_MIN)}</span>
            <span className="text-primary">current: {fmtMoney(currentDaily)}</span>
            <span>{fmtMoney(SLIDER_MAX)}</span>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border">
            <div className="text-xs text-muted-foreground mb-1">Projected 30-day spend</div>
            <div className="text-xl font-bold tabular-nums">{fmtMoney(monthlySpend)}</div>
            {baselineCpr != null && (
              <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Baseline 7d CPR: ${(baselineCpr / 100).toFixed(2)} · {baselineRegs7} regs on {fmtMoney(baselineSpend7)}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground mb-2">Projected 30-day funnel</div>
          {[
            { label: "Registrations", value: projectedRegs30, sub: projectedCpr ? `~${fmtMoney(projectedCpr)} CPR` : "" },
            { label: "Attended", value: projAttended, sub: `${Math.round(regsToAttended * 100)}% show rate` },
            { label: "Calls booked", value: projCalls, sub: `${Math.round(attendedToCalls * 100)}% attend->call` },
            { label: "Enrolled", value: projEnrolled, sub: `${Math.round(callsToEnrolled * 100)}% close` },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <div className="w-28 text-sm">{row.label}</div>
              <div className="flex-1 text-right">
                <span className="text-lg font-semibold tabular-nums">{row.value.toLocaleString()}</span>
                {row.sub && <span className="text-[10px] text-muted-foreground ml-2">{row.sub}</span>}
              </div>
            </div>
          ))}
          {projEnrolled > 0 && (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Projected revenue @ $4,500</span>
              <span className="text-base font-bold text-emerald-500 tabular-nums">${(projEnrolled * 4500).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
