"use client";

import { useEffect, useState, useCallback } from "react";
import type { DashboardState } from "@/lib/state-types";
import { AISummaryPanel } from "@/components/ai-summary-panel";
import { AnomalyBanner } from "@/components/anomaly-banner";
import { Scorecard } from "@/components/scorecard";
import { MetricHeroCards } from "@/components/metric-hero-cards";
import { CreativeLeaderboard } from "@/components/creative-leaderboard";
import { CreativeBriefGenerator } from "@/components/creative-brief-generator";
import { Funnel } from "@/components/funnel";
import { ActionLog } from "@/components/action-log";
import { BudgetSimulator } from "@/components/budget-simulator";
import { PlanVisual } from "@/components/plan-visual";
import { AlertTriangle, Loader2 } from "lucide-react";

export default function DashboardHome() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/state", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `${res.status}`);
        setState(null);
      } else {
        setState(json as DashboardState);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    function handler() {
      load();
    }
    window.addEventListener("ads-dashboard:refresh", handler);
    return () => window.removeEventListener("ads-dashboard:refresh", handler);
  }, [load]);

  if (loading && !state) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
        <div className="flex items-center gap-2 mb-2 text-destructive font-medium">
          <AlertTriangle className="w-4 h-4" /> Failed to load dashboard
        </div>
        <p className="text-foreground/80">{error}</p>
        <p className="text-xs text-muted-foreground mt-2">
          Likely causes: META_MARKETING_TOKEN missing or expired, or Turso connection failing. Check Vercel env vars.
        </p>
      </div>
    );
  }

  if (!state) return null;

  return (
    <>
      <AISummaryPanel state={state} />
      <AnomalyBanner state={state} />
      <Scorecard state={state} />
      <MetricHeroCards state={state} />
      <Funnel state={state} />

      <section className="flex items-center justify-between mb-3 mt-2">
        <div>
          <h2 className="text-base font-semibold">Creative leaderboard</h2>
          <p className="text-xs text-muted-foreground">Sorted by CPR. Watch the fatigue column for ads about to die.</p>
        </div>
        <CreativeBriefGenerator state={state} />
      </section>
      <CreativeLeaderboard state={state} />

      <ActionLog state={state} />
      <BudgetSimulator state={state} />
      <PlanVisual state={state} />

      <footer className="text-xs text-muted-foreground py-6">
        Last sync: {state.meta.lastSyncAt ? new Date(state.meta.lastSyncAt).toLocaleString() : "never"} ·
        Campaign {state.meta.campaignId} · Account {state.meta.adAccountId}
      </footer>
    </>
  );
}
