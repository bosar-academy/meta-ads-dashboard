// Mental anchors used as the success ruler when reading performance.
//
// These are PLACEHOLDER values matching a typical $50/day cold lead-gen campaign
// targeting ~$30 CPR. Adjust to YOUR actual unit economics:
//   - Edit the numbers below directly, OR
//   - During the install prompt, the onboarding wizard will offer to overwrite this
//     file with your real targets (CPR bands, CAC range, decision gates).
//
// All money values are in CENTS (1000 = $10.00) for consistency with Meta API.

export const CAMPAIGN_TARGETS = {
  daily_budget_cents: 5000,         // $50/day
  monthly_budget_cents: 200_000,    // $2,000 base
  unlock_budget_cents: 100_000,     // +$1K conditional unlock at week 2

  cpr: {
    green_max_cents: 2500,          // <= $25 = on track
    yellow_max_cents: 4000,         // $25-40 = yellow flag
    red_floor_cents: 6000,          // > $60 = red flag
    target_ceiling_cents: 3000,     // $30 plan target
    week1_2_band: { lo: 2000, hi: 4000 },
    week3_4_band: { lo: 1000, hi: 2500 },
    month2_3_band: { lo: 800, hi: 1500 },
  },

  cpm: { lo_cents: 2000, hi_cents: 4000 },
  ctr_link: {
    static: { lo: 0.015, hi: 0.035 },
    video: { lo: 0.025, hi: 0.05 },
  },
  freq_alert_threshold: 2.0,        // >2 frequency/wk = alert

  funnel_assumptions: {
    reg_to_call_rate: 0.10,         // 8-15% B2B replay typical
    call_to_close_rate: 0.30,       // 25-35% on $4K B2B
    lp_conversion: { lo: 0.25, hi: 0.40 },
  },

  cac_target: { lo_cents: 80_000, hi_cents: 120_000, ceiling_cents: 100_000 },
  cost_per_call_cents: { lo: 25_000, hi: 50_000 },

  learning_phase: {
    events_per_week_for_exit: 50,
    real_signal_min_spend_cents: 150_000,
  },

  // Decision triggers (cumulative spend in cents)
  decision_gates: [
    { day: 3, spend_cents: 15_000, label: "Day 3: first read CPM/CTR" },
    { day: 7, spend_cents: 35_000, label: "Week 1: first CPR ballpark; spot creative bombs" },
    { day: 14, spend_cents: 70_000, label: "Week 2: +$1K unlock if CPR<=$50 and CAC trend<=$1500" },
    { day: 21, spend_cents: 105_000, label: "Week 3: build 1% LAL if registrant seed > 50" },
    { day: 28, spend_cents: 154_000, label: "Week 4: month 2 plan decision" },
  ],
} as const;

export function classifyCpr(cprCents: number | null): "green" | "yellow" | "red" | "noevents" {
  if (cprCents == null || cprCents <= 0) return "noevents";
  const t = CAMPAIGN_TARGETS.cpr;
  if (cprCents <= t.green_max_cents) return "green";
  if (cprCents <= t.yellow_max_cents) return "yellow";
  return "red";
}

export function findCurrentGate(daysSinceLaunch: number): typeof CAMPAIGN_TARGETS.decision_gates[number] | null {
  const gates = CAMPAIGN_TARGETS.decision_gates;
  let last: (typeof gates)[number] | null = null;
  for (const g of gates) {
    if (daysSinceLaunch >= g.day) last = g;
  }
  return last;
}

// Per-ad verdict. Tuned to avoid false declarations during learning phase.
// Thresholds derived from CAMPAIGN_TARGETS but inlined for clarity.
export type AdVerdict = "too_early" | "winner" | "performing" | "watch" | "cull";

export const AD_VERDICT_THRESHOLDS = {
  too_early_min_spend_cents: 3000,        // $30
  too_early_min_regs: 3,
  cull_min_cpr_cents: 6000,               // $60
  cull_min_spend_cents: 5000,             // $50
  watch_max_cpr_cents: 6000,              // $60
  watch_min_cpr_cents: 4000,              // $40
  winner_max_cpr_cents: 2500,             // $25
  winner_min_ctr: 0.015,                  // 1.5%
  low_ctr_warning: 0.01,                  // 1%
  performing_max_cpr_cents: 4000,         // $40
} as const;

export function classifyAd(input: {
  spendCents: number;
  registrations: number;
  cprCents: number | null;
  ctrLink: number;
}): { verdict: AdVerdict; reason: string } {
  const t = AD_VERDICT_THRESHOLDS;
  const { spendCents, registrations, cprCents, ctrLink } = input;
  const spendDollars = spendCents / 100;
  const cprDollars = cprCents != null ? cprCents / 100 : null;
  const ctrPct = ctrLink * 100;

  if (spendCents < t.too_early_min_spend_cents || registrations < t.too_early_min_regs) {
    return {
      verdict: "too_early",
      reason: `Too early - $${spendDollars.toFixed(0)} spent, ${registrations} regs (need $${t.too_early_min_spend_cents / 100}+ and ${t.too_early_min_regs}+ regs)`,
    };
  }

  if (cprCents != null && cprCents > t.cull_min_cpr_cents && spendCents >= t.cull_min_spend_cents) {
    return {
      verdict: "cull",
      reason: `Cull - $${cprDollars!.toFixed(0)} CPR over $${spendDollars.toFixed(0)} spent (>$60 with $50+ spend)`,
    };
  }

  if (cprCents != null && cprCents > t.watch_min_cpr_cents && cprCents <= t.watch_max_cpr_cents) {
    return {
      verdict: "watch",
      reason: `Watch - $${cprDollars!.toFixed(0)} CPR in the $40-60 yellow zone`,
    };
  }

  if (cprCents != null && cprCents <= t.performing_max_cpr_cents && ctrLink < t.low_ctr_warning) {
    return {
      verdict: "watch",
      reason: `Watch - $${cprDollars!.toFixed(0)} CPR but ${ctrPct.toFixed(2)}% CTR (low engagement, likely to regress)`,
    };
  }

  if (
    cprCents != null &&
    cprCents <= t.winner_max_cpr_cents &&
    ctrLink >= t.winner_min_ctr &&
    spendCents >= t.too_early_min_spend_cents
  ) {
    return {
      verdict: "winner",
      reason: `Winner - $${cprDollars!.toFixed(0)} CPR with ${ctrPct.toFixed(2)}% CTR over $${spendDollars.toFixed(0)}`,
    };
  }

  if (cprCents != null && cprCents <= t.performing_max_cpr_cents) {
    return {
      verdict: "performing",
      reason: `Performing - $${cprDollars!.toFixed(0)} CPR inside the $40 ceiling`,
    };
  }

  // Fallback (shouldn't hit unless cpr is null but regs >= 3)
  return {
    verdict: "too_early",
    reason: "Insufficient signal",
  };
}
