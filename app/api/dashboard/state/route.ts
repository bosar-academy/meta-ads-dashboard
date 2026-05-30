import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getAccountRollup,
  getAccountTimeseries,
  getAdCumulative,
  listCampaignAds,
  extractRegistrations,
  toCents,
  toFloat,
  toInt,
} from "@/lib/meta";
import { getFunnelCounts } from "@/lib/airtable";
import { CAMPAIGN_TARGETS, classifyAd } from "@/lib/targets";
import { buildHeatmap, buildPhase, buildTriggers, detectAnomalies, scoreFatigue } from "@/lib/insights";
import type { ActionLogEntry } from "@/lib/state-types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const LAUNCH_DATE_ISO = process.env.META_CAMPAIGN_LAUNCH_DATE || "";

function daysSince(dateIso: string): number | null {
  if (!dateIso) return null;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export async function GET() {
  try {
    const [
      today,
      yesterday,
      week,
      last30,
      weekTimeseries,
      ads,
      adCumulative,
      latestSnapshot,
      firstSeenRows,
      actionLogRaw,
    ] = await Promise.all([
      getAccountRollup("today").catch(() => null),
      getAccountRollup("yesterday").catch(() => null),
      getAccountRollup("last_7d").catch(() => null),
      getAccountRollup("last_30d").catch(() => null),
      getAccountTimeseries("last_14d").catch(() => []),
      listCampaignAds().catch(() => []),
      getAdCumulative("last_30d").catch(() => []),
      prisma.snapshot.findFirst({ orderBy: { capturedAt: "desc" } }).catch(() => null),
      prisma.adDaily
        .groupBy({
          by: ["adId"],
          where: { impressions: { gt: 0 } },
          _min: { date: true },
        })
        .catch(() => [] as Array<{ adId: string; _min: { date: string | null } }>),
      prisma.actionLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }).catch(() => []),
    ]);

    const firstSeenByAd = new Map<string, string>();
    for (const row of firstSeenRows) {
      if (row._min?.date) firstSeenByAd.set(row.adId, row._min.date);
    }
    function daysBetween(iso: string | null): number | null {
      if (!iso) return null;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      const ms = Date.now() - d.getTime();
      return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
    }

    function pack(row: typeof today) {
      if (!row) return { spendCents: 0, impressions: 0, linkClicks: 0, registrations: 0, cprCents: null, ctrLink: 0, cpmCents: 0, frequency: 0 };
      const spendCents = toCents(row.spend);
      const impressions = toInt(row.impressions);
      const linkClicks = toInt(row.inline_link_clicks);
      const regs = extractRegistrations(row);
      return {
        spendCents,
        impressions,
        linkClicks,
        registrations: regs,
        cprCents: regs > 0 ? Math.round(spendCents / regs) : null,
        ctrLink: impressions > 0 ? linkClicks / impressions : 0,
        cpmCents: impressions > 0 ? Math.round((spendCents / impressions) * 1000) : 0,
        frequency: toFloat(row.frequency),
      };
    }

    const last30Pack = pack(last30);
    const funnel = await getFunnelCounts(30, last30Pack.registrations).catch(() => ({
      registrations: 0,
      attended: 0,
      callsBooked: 0,
      enrollments: 0,
      metaPixelRegistrations: last30Pack.registrations,
      testEmailsExcluded: 0,
      duplicatesCollapsed: 0,
    }));

    const adsByCpr = adCumulative.map((row) => {
      const spendCents = toCents(row.spend);
      const impressions = toInt(row.impressions);
      const linkClicks = toInt(row.inline_link_clicks);
      const regs = extractRegistrations(row);
      const meta = ads.find((a) => a.id === row.ad_id);
      const ctrLink = impressions > 0 ? linkClicks / impressions : 0;
      const cprCents = regs > 0 ? Math.round(spendCents / regs) : null;
      const adId = row.ad_id || "";
      const frequency = toFloat(row.frequency);
      const verdict = classifyAd({ spendCents, registrations: regs, cprCents, ctrLink });
      const firstSeen = firstSeenByAd.get(adId) ?? null;
      const daysActive = daysBetween(firstSeen);
      const fatigue = scoreFatigue({ frequency, ctrLink, cprCents, daysActive, spendCents });
      return {
        adId,
        adName: row.ad_name || meta?.name || row.ad_id || "",
        status: meta?.effective_status || meta?.status || "UNKNOWN",
        thumbnailUrl: meta?.thumbnail_url || null,
        spendCents,
        impressions,
        linkClicks,
        ctrLink,
        registrations: regs,
        cprCents,
        frequency,
        verdict: verdict.verdict,
        verdictReason: verdict.reason,
        firstSeenDate: firstSeen,
        daysActive,
        fatigueScore: fatigue.score,
        fatigueReason: fatigue.reason,
      };
    }).sort((a, b) => {
      if (a.cprCents == null && b.cprCents == null) return b.spendCents - a.spendCents;
      if (a.cprCents == null) return 1;
      if (b.cprCents == null) return -1;
      return a.cprCents - b.cprCents;
    });

    const trend = weekTimeseries.map((row) => {
      const spendCents = toCents(row.spend);
      const impressions = toInt(row.impressions);
      const linkClicks = toInt(row.inline_link_clicks);
      const regs = extractRegistrations(row);
      return {
        date: row.date_start || "",
        spendCents,
        impressions,
        linkClicks,
        registrations: regs,
        cprCents: regs > 0 ? Math.round(spendCents / regs) : null,
        cpmCents: impressions > 0 ? Math.round((spendCents / impressions) * 1000) : 0,
        ctrLink: impressions > 0 ? linkClicks / impressions : 0,
        frequency: toFloat(row.frequency),
      };
    });

    const dsl = daysSince(LAUNCH_DATE_ISO);
    const last30Spend = toCents(last30?.spend);
    const last7Reg = week ? extractRegistrations(week) : 0;
    const eventsThisWeek = last7Reg;
    const learningProgress = Math.min(1, eventsThisWeek / CAMPAIGN_TARGETS.learning_phase.events_per_week_for_exit);

    const week7Pack = pack(week);
    const heatmap = buildHeatmap(trend);
    const anomalies = detectAnomalies(trend);
    const triggers = buildTriggers({
      cprCentsLast7: week7Pack.cprCents,
      frequencyLast7: week7Pack.frequency,
      registrationsThisWeek: eventsThisWeek,
      daysSinceLaunch: dsl,
      ads: adsByCpr.map((a) => ({ fatigueScore: a.fatigueScore, adName: a.adName })),
    });
    const phase = buildPhase({
      daysSinceLaunch: dsl,
      spendCentsMTD: last30Spend,
      monthlyBudgetCents: CAMPAIGN_TARGETS.monthly_budget_cents,
      registrationsThisWeek: eventsThisWeek,
    });

    const stale = latestSnapshot ? Date.now() - new Date(latestSnapshot.capturedAt).getTime() : null;

    const actionLog: ActionLogEntry[] = actionLogRaw.map((row) => ({
      id: row.id,
      createdAt: new Date(row.createdAt).toISOString(),
      action: row.action,
      targetId: row.targetId,
      reasoning: row.reasoning,
      executor: row.executor,
      result: row.result,
    }));

    return NextResponse.json({
      meta: {
        adAccountId: process.env.META_AD_ACCOUNT_ID ?? null,
        campaignId: process.env.META_CAMPAIGN_ID ?? null,
        launchDate: LAUNCH_DATE_ISO || null,
        daysSinceLaunch: dsl,
        lastSyncAt: latestSnapshot?.capturedAt ?? null,
        lastSyncAgeMs: stale,
      },
      scorecard: {
        today: pack(today),
        yesterday: pack(yesterday),
        last7: week7Pack,
        last30: { ...last30Pack, spendCents: last30Spend },
        eventsThisWeek,
        learningProgress,
        learningEventsTarget: CAMPAIGN_TARGETS.learning_phase.events_per_week_for_exit,
        budget: {
          dailyCents: CAMPAIGN_TARGETS.daily_budget_cents,
          monthlyCents: CAMPAIGN_TARGETS.monthly_budget_cents,
        },
      },
      trend,
      heatmap,
      ads: adsByCpr,
      funnel: {
        metaPixelImpressions: last30Pack.impressions,
        metaPixelLinkClicks: last30Pack.linkClicks,
        registrations: funnel.registrations,
        attended: funnel.attended,
        callsBooked: funnel.callsBooked,
        enrollments: funnel.enrollments,
        metaPixelRegistrations: funnel.metaPixelRegistrations ?? last30Pack.registrations,
        testEmailsExcluded: funnel.testEmailsExcluded,
        duplicatesCollapsed: funnel.duplicatesCollapsed,
      },
      anomalies,
      actionLog,
      phase,
      triggers,
      targets: CAMPAIGN_TARGETS,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
