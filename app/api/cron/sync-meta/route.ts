import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getAccountRollup,
  getAdDaily,
  getAccountTimeseries,
  extractRegistrations,
  toCents,
  toFloat,
  toInt,
} from "@/lib/meta";
import { getFunnelCounts } from "@/lib/airtable";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

async function runSync() {
  const window = "last_30d";

  const [rollup, adDaily, timeseries, funnel] = await Promise.all([
    getAccountRollup(window),
    getAdDaily(window),
    getAccountTimeseries(window),
    getFunnelCounts(30).catch((err) => {
      console.warn("Airtable funnel fetch failed:", err);
      return { registrations: 0, callsBooked: 0, enrollments: 0, total: 0 };
    }),
  ]);

  const accountSpendCents = toCents(rollup?.spend);
  const accountImpressions = toInt(rollup?.impressions);
  const accountClicks = toInt(rollup?.clicks);
  const accountLinkClicks = toInt(rollup?.inline_link_clicks);
  const accountRegistrations = rollup ? extractRegistrations(rollup) : 0;
  const cprCents = accountRegistrations > 0
    ? Math.round(accountSpendCents / accountRegistrations)
    : null;
  const ctrLink = accountImpressions > 0
    ? accountLinkClicks / accountImpressions
    : null;
  const cpmCents = accountImpressions > 0
    ? Math.round((accountSpendCents / accountImpressions) * 1000)
    : null;
  const frequency = toFloat(rollup?.frequency) || null;

  await prisma.snapshot.create({
    data: {
      window,
      spendCents: accountSpendCents,
      impressions: accountImpressions,
      clicks: accountClicks,
      linkClicks: accountLinkClicks,
      registrations: accountRegistrations,
      callsBooked: funnel.callsBooked,
      enrollments: funnel.enrollments,
      cprCents,
      ctrLink,
      cpmCents,
      frequency,
      raw: JSON.stringify({ rollup, timeseries }),
    },
  });

  // Upsert per-ad daily rows
  for (const r of adDaily) {
    if (!r.ad_id || !r.date_start) continue;
    const spendCents = toCents(r.spend);
    const linkClicks = toInt(r.inline_link_clicks);
    const impressions = toInt(r.impressions);
    const regs = extractRegistrations(r);
    const ctr = impressions > 0 ? linkClicks / impressions : 0;
    const adCprCents = regs > 0 ? Math.round(spendCents / regs) : null;
    await prisma.adDaily.upsert({
      where: { date_adId: { date: r.date_start, adId: r.ad_id } },
      create: {
        date: r.date_start,
        adId: r.ad_id,
        adName: r.ad_name || r.ad_id,
        status: "UNKNOWN",
        spendCents,
        impressions,
        linkClicks,
        ctrLink: ctr,
        registrations: regs,
        cprCents: adCprCents,
        frequency: toFloat(r.frequency),
      },
      update: {
        adName: r.ad_name || r.ad_id,
        spendCents,
        impressions,
        linkClicks,
        ctrLink: ctr,
        registrations: regs,
        cprCents: adCprCents,
        frequency: toFloat(r.frequency),
      },
    });
  }

  return {
    snapshot: {
      spendCents: accountSpendCents,
      registrations: accountRegistrations,
      cprCents,
      cpmCents,
      ctrLink,
      callsBooked: funnel.callsBooked,
      enrollments: funnel.enrollments,
    },
    adsWritten: adDaily.length,
  };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sync-meta failed:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
