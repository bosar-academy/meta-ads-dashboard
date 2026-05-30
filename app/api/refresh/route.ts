import { NextRequest, NextResponse } from "next/server";

// On-demand refresh button. Same logic as cron but invoked from the UI.
// We just delegate to the cron route so the logic lives in one place.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const url = new URL("/api/cron/sync-meta", req.url);
  const cronSecret = process.env.CRON_SECRET || "";
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return NextResponse.json(json, { status: res.status });
}
