// Pure-function insights helpers: fatigue scoring, anomaly detection, decision triggers, phase.
// These run inside the API route - no I/O.

import { CAMPAIGN_TARGETS, findCurrentGate } from "./targets";
import type {
  Anomaly,
  CampaignPhase,
  DecisionTrigger,
  HeatmapCell,
  TrendPoint,
} from "./state-types";

// ---------- Fatigue ----------
// A creative is "fatiguing" when frequency rises AND CTR or CPR worsens.
export function scoreFatigue(input: {
  frequency: number;
  ctrLink: number;
  cprCents: number | null;
  daysActive: number | null;
  spendCents: number;
}): { score: number; reason: string } {
  const { frequency, ctrLink, cprCents, daysActive, spendCents } = input;

  if (spendCents < 3000) return { score: 0, reason: "Not enough spend to read fatigue yet" };

  let score = 0;
  const reasons: string[] = [];

  if (frequency >= 3) {
    score += 0.5;
    reasons.push(`freq ${frequency.toFixed(2)}`);
  } else if (frequency >= 2) {
    score += 0.25;
    reasons.push(`freq ${frequency.toFixed(2)} (warming)`);
  }

  if (ctrLink < 0.01) {
    score += 0.3;
    reasons.push(`CTR ${(ctrLink * 100).toFixed(2)}% below 1%`);
  } else if (ctrLink < 0.015) {
    score += 0.15;
    reasons.push(`CTR ${(ctrLink * 100).toFixed(2)}% soft`);
  }

  if (cprCents != null && cprCents > 4000) {
    score += 0.2;
    reasons.push(`CPR $${(cprCents / 100).toFixed(0)} above $40`);
  }

  if (daysActive != null && daysActive >= 7) {
    score += 0.1;
    reasons.push(`${daysActive}d active`);
  }

  score = Math.min(1, score);
  if (score === 0) return { score: 0, reason: "Healthy" };
  return { score, reason: reasons.join(" · ") };
}

// ---------- Anomalies ----------
// Compare the latest day to the trailing 7-day mean.
export function detectAnomalies(trend: TrendPoint[]): Anomaly[] {
  if (trend.length < 4) return [];
  const out: Anomaly[] = [];
  const latest = trend[trend.length - 1];
  const baseline = trend.slice(Math.max(0, trend.length - 8), trend.length - 1);
  if (baseline.length < 3) return [];

  function avg(pick: (p: TrendPoint) => number | null): number | null {
    const vals = baseline.map(pick).filter((v): v is number => v != null && v > 0);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function delta(latestVal: number | null, baseVal: number | null): number | null {
    if (latestVal == null || baseVal == null || baseVal === 0) return null;
    return (latestVal - baseVal) / baseVal;
  }

  // For CPM and CPR: lower is better, so DROPS are positive (info), SPIKES are negative (warn/alert).
  const cpmDelta = delta(latest.cpmCents, avg((p) => p.cpmCents));
  if (cpmDelta != null && Math.abs(cpmDelta) >= 0.2) {
    const isPositive = cpmDelta < 0;
    out.push({
      metric: "cpm",
      direction: cpmDelta > 0 ? "up" : "down",
      changePct: Math.round(cpmDelta * 100),
      date: latest.date,
      message: cpmDelta > 0
        ? `CPM spiked ${Math.abs(Math.round(cpmDelta * 100))}% vs 7d avg. Auction heating up - watch creative fatigue.`
        : `CPM dropped ${Math.abs(Math.round(cpmDelta * 100))}% vs 7d avg. Cheaper reach - good signal.`,
      severity: isPositive ? "info" : Math.abs(cpmDelta) >= 0.4 ? "alert" : "warn",
    });
  }

  const cprDelta = delta(latest.cprCents, avg((p) => p.cprCents));
  if (cprDelta != null && Math.abs(cprDelta) >= 0.2) {
    const isPositive = cprDelta < 0;
    out.push({
      metric: "cpr",
      direction: cprDelta > 0 ? "up" : "down",
      changePct: Math.round(cprDelta * 100),
      date: latest.date,
      message: cprDelta > 0
        ? `CPR spiked ${Math.abs(Math.round(cprDelta * 100))}% vs 7d avg. Costlier registrations - check creatives.`
        : `CPR improved ${Math.abs(Math.round(cprDelta * 100))}% vs 7d avg. Cheaper conversions - scaling room.`,
      severity: isPositive ? "info" : Math.abs(cprDelta) >= 0.4 ? "alert" : "warn",
    });
  }

  // For CTR: higher is better. JUMPS are positive (info), FALLS are negative (warn).
  const ctrDelta = delta(latest.ctrLink, avg((p) => p.ctrLink));
  if (ctrDelta != null && Math.abs(ctrDelta) >= 0.25) {
    const isPositive = ctrDelta > 0;
    out.push({
      metric: "ctr",
      direction: ctrDelta > 0 ? "up" : "down",
      changePct: Math.round(ctrDelta * 100),
      date: latest.date,
      message: ctrDelta > 0
        ? `Link CTR jumped ${Math.abs(Math.round(ctrDelta * 100))}% vs 7d avg. Creative is connecting.`
        : `Link CTR fell ${Math.abs(Math.round(ctrDelta * 100))}% vs 7d avg. Hook is losing audience.`,
      severity: isPositive ? "info" : "warn",
    });
  }

  return out;
}

// ---------- Heatmap ----------
// 14-day intensity heatmap. Intensity = combined performance score (low CPR + decent regs = bright).
export function buildHeatmap(trend: TrendPoint[]): HeatmapCell[] {
  if (trend.length === 0) return [];
  const maxRegs = Math.max(...trend.map((p) => p.registrations), 1);
  return trend.map((p) => {
    const cprScore = p.cprCents == null ? 0 : Math.max(0, 1 - (p.cprCents - 2000) / 6000);
    const regScore = p.registrations / maxRegs;
    const intensity = Math.min(1, 0.6 * cprScore + 0.4 * regScore);
    return {
      date: p.date,
      intensity,
      spendCents: p.spendCents,
      registrations: p.registrations,
      cprCents: p.cprCents,
    };
  });
}

// ---------- Decision triggers ----------
export function buildTriggers(input: {
  cprCentsLast7: number | null;
  frequencyLast7: number;
  registrationsThisWeek: number;
  daysSinceLaunch: number | null;
  ads: { fatigueScore: number; adName: string }[];
}): DecisionTrigger[] {
  const t = CAMPAIGN_TARGETS;
  const triggers: DecisionTrigger[] = [];

  if (input.cprCentsLast7 == null) {
    triggers.push({
      id: "cpr-band",
      label: "CPR vs target band",
      status: "pending",
      detail: "No registrations yet - waiting for first events.",
    });
  } else {
    const c = input.cprCentsLast7;
    const lo = t.cpr.week1_2_band.lo;
    const hi = t.cpr.week1_2_band.hi;
    if (c <= hi && c >= lo) {
      triggers.push({ id: "cpr-band", label: "CPR vs target band", status: "ok", detail: `In $${lo / 100}-$${hi / 100} band ($${(c / 100).toFixed(0)}).` });
    } else if (c < lo) {
      triggers.push({ id: "cpr-band", label: "CPR vs target band", status: "ok", detail: `Below target band ($${(c / 100).toFixed(0)}). Scaling room.` });
    } else if (c <= t.cpr.red_floor_cents) {
      triggers.push({ id: "cpr-band", label: "CPR vs target band", status: "watch", detail: `Above band ($${(c / 100).toFixed(0)} vs $${hi / 100}).` });
    } else {
      triggers.push({ id: "cpr-band", label: "CPR vs target band", status: "alert", detail: `Red zone ($${(c / 100).toFixed(0)} > $${t.cpr.red_floor_cents / 100}). Cull losers.` });
    }
  }

  if (input.frequencyLast7 >= 3) {
    triggers.push({ id: "freq", label: "Frequency cap", status: "alert", detail: `Freq ${input.frequencyLast7.toFixed(2)} - audience saturating, refresh creative.` });
  } else if (input.frequencyLast7 >= t.freq_alert_threshold) {
    triggers.push({ id: "freq", label: "Frequency cap", status: "watch", detail: `Freq ${input.frequencyLast7.toFixed(2)} approaching cap.` });
  } else {
    triggers.push({ id: "freq", label: "Frequency cap", status: "ok", detail: `Freq ${input.frequencyLast7.toFixed(2)} healthy.` });
  }

  const lp = t.learning_phase.events_per_week_for_exit;
  if (input.registrationsThisWeek >= lp) {
    triggers.push({ id: "learning", label: "Learning phase exit", status: "ok", detail: `${input.registrationsThisWeek}/${lp} events this week. Exited.` });
  } else {
    triggers.push({
      id: "learning",
      label: "Learning phase exit",
      status: input.registrationsThisWeek >= lp * 0.5 ? "watch" : "pending",
      detail: `${input.registrationsThisWeek}/${lp} events this week.`,
    });
  }

  const fatigued = input.ads.filter((a) => a.fatigueScore >= 0.6);
  if (fatigued.length > 0) {
    triggers.push({
      id: "fatigue",
      label: "Creative fatigue",
      status: "alert",
      detail: `${fatigued.length} creative(s) fatiguing: ${fatigued.slice(0, 2).map((a) => a.adName).join(", ")}.`,
    });
  } else {
    triggers.push({ id: "fatigue", label: "Creative fatigue", status: "ok", detail: "All creatives healthy." });
  }

  const gate = input.daysSinceLaunch != null ? findCurrentGate(input.daysSinceLaunch) : null;
  if (gate) {
    triggers.push({ id: "gate", label: "Decision gate", status: "pending", detail: gate.label });
  }

  return triggers;
}

// ---------- Phase ----------
export function buildPhase(input: {
  daysSinceLaunch: number | null;
  spendCentsMTD: number;
  monthlyBudgetCents: number;
  registrationsThisWeek: number;
}): CampaignPhase {
  const d = input.daysSinceLaunch;
  let label = "Pre-launch";
  let totalDays: number | null = null;

  if (d == null) {
    label = "Pre-launch";
  } else if (d < 7) {
    label = "Week 1 - Learning";
    totalDays = 7;
  } else if (d < 14) {
    label = "Week 2 - First CPR Read";
    totalDays = 14;
  } else if (d < 21) {
    label = "Week 3 - Scaling Decision";
    totalDays = 21;
  } else if (d < 28) {
    label = "Week 4 - Month 2 Plan";
    totalDays = 28;
  } else {
    label = `Month 2+ - Day ${d}`;
    totalDays = null;
  }

  const exitCriteria: { label: string; done: boolean }[] = [];
  exitCriteria.push({
    label: `${CAMPAIGN_TARGETS.learning_phase.events_per_week_for_exit} events/week`,
    done: input.registrationsThisWeek >= CAMPAIGN_TARGETS.learning_phase.events_per_week_for_exit,
  });
  exitCriteria.push({
    label: `$${(CAMPAIGN_TARGETS.learning_phase.real_signal_min_spend_cents / 100).toFixed(0)} cumulative spend`,
    done: input.spendCentsMTD >= CAMPAIGN_TARGETS.learning_phase.real_signal_min_spend_cents,
  });
  if (d != null) {
    exitCriteria.push({
      label: `${totalDays ?? 7} days elapsed`,
      done: totalDays != null && d >= totalDays,
    });
  }

  return {
    label,
    daysIn: d,
    totalDays,
    spendPaceCents: input.spendCentsMTD,
    spendPaceBudgetCents: input.monthlyBudgetCents,
    exitCriteria,
  };
}
