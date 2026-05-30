"use client";

import { CheckCircle2, Circle, AlertCircle, AlertTriangle, Clock, ClipboardList, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { DashboardState, DecisionTrigger } from "@/lib/state-types";

function fmtMoney(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

const TRIGGER_STYLES: Record<DecisionTrigger["status"], { dot: string; bg: string; text: string; Icon: typeof AlertCircle }> = {
  ok: { dot: "bg-emerald-500", bg: "bg-emerald-500/5 border-emerald-500/20", text: "text-emerald-500", Icon: CheckCircle2 },
  watch: { dot: "bg-amber-500", bg: "bg-amber-500/5 border-amber-500/20", text: "text-amber-500", Icon: AlertCircle },
  alert: { dot: "bg-destructive", bg: "bg-destructive/5 border-destructive/30", text: "text-destructive", Icon: AlertTriangle },
  pending: { dot: "bg-muted-foreground", bg: "bg-muted/40 border-border", text: "text-muted-foreground", Icon: Clock },
};

function PhaseCard({ phase }: { phase: DashboardState["phase"] }) {
  const pacePct = phase.spendPaceBudgetCents > 0 ? Math.min(100, (phase.spendPaceCents / phase.spendPaceBudgetCents) * 100) : 0;
  const phaseProgressPct = phase.totalDays && phase.daysIn != null ? Math.min(100, (phase.daysIn / phase.totalDays) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Current phase</div>
          <h3 className="text-base font-semibold">{phase.label}</h3>
        </div>
        {phase.daysIn != null && phase.totalDays && (
          <div className="text-xs text-muted-foreground tabular-nums">
            Day {phase.daysIn} / {phase.totalDays}
          </div>
        )}
      </div>

      {phase.totalDays && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
          <div className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all" style={{ width: `${phaseProgressPct}%` }} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-xs mb-4">
        <div>
          <div className="text-muted-foreground mb-1">MTD spend pace</div>
          <div className="text-lg font-semibold tabular-nums">
            {fmtMoney(phase.spendPaceCents)} <span className="text-xs text-muted-foreground font-normal">/ {fmtMoney(phase.spendPaceBudgetCents)}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-emerald-500/70" style={{ width: `${pacePct}%` }} />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2">Exit criteria</div>
          <ul className="space-y-1">
            {phase.exitCriteria.map((c, i) => (
              <li key={i} className="flex items-center gap-1.5">
                {c.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span className={c.done ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function TriggerCard({ trigger }: { trigger: DecisionTrigger }) {
  const s = TRIGGER_STYLES[trigger.status];
  const Icon = s.Icon;
  return (
    <div className={`rounded-lg border ${s.bg} p-3 flex items-start gap-3`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${s.text}`} />
      <div className="flex-1">
        <div className="text-sm font-medium">{trigger.label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{trigger.detail}</div>
      </div>
    </div>
  );
}

export function PlanVisual({ state }: { state: DashboardState }) {
  const [planOpen, setPlanOpen] = useState(false);
  const [planText, setPlanText] = useState<string | null>(null);

  async function loadPlan() {
    if (planText) {
      setPlanOpen((o) => !o);
      return;
    }
    setPlanOpen(true);
    const res = await fetch("/api/plan");
    const j = await res.json();
    setPlanText(j.plan || "Plan file not bundled.");
  }

  return (
    <section className="space-y-4 mb-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <PhaseCard phase={state.phase} />
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Decision triggers</h3>
              <span className="text-xs text-muted-foreground">{state.triggers.filter((t) => t.status === "alert").length} alerts</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {state.triggers.map((t) => (
                <TriggerCard key={t.id} trigger={t} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <button
          onClick={loadPlan}
          className="w-full px-5 py-3 flex items-center gap-2 text-sm font-medium hover:bg-muted/40 transition-colors"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${planOpen ? "rotate-90" : ""}`} />
          <ClipboardList className="w-4 h-4 text-muted-foreground" />
          <span>Full campaign plan (markdown)</span>
          <span className="ml-auto text-xs text-muted-foreground">For the AI, not for you</span>
        </button>
        {planOpen && (
          <pre className="px-5 pb-5 text-xs text-foreground/70 whitespace-pre-wrap font-mono leading-relaxed max-h-[50vh] overflow-y-auto border-t border-border pt-4">
            {planText ?? "Loading..."}
          </pre>
        )}
      </div>
    </section>
  );
}
