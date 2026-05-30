// Meta Graph API v25 client. We hit insights endpoints directly via REST.

const GRAPH_BASE = "https://graph.facebook.com/v25.0";

function token() {
  const t = process.env.META_MARKETING_TOKEN;
  if (!t) throw new Error("META_MARKETING_TOKEN not set");
  return t;
}
function adAccountId() {
  const v = process.env.META_AD_ACCOUNT_ID;
  if (!v) throw new Error("META_AD_ACCOUNT_ID not set");
  return v;
}
function campaignId(): string | undefined {
  return process.env.META_CAMPAIGN_ID || undefined;
}
function customConversionId(): string | undefined {
  return process.env.META_CUSTOM_CONVERSION_ID || undefined;
}

export type MetaInsightAction = { action_type: string; value: string };

export type MetaInsightRow = {
  ad_id?: string;
  ad_name?: string;
  campaign_id?: string;
  adset_id?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  inline_link_clicks?: string;
  ctr?: string;          // % whole click-through
  cpc?: string;
  cpm?: string;
  frequency?: string;
  date_start?: string;
  date_stop?: string;
  actions?: MetaInsightAction[];
};

const FIELDS_AD = [
  "ad_id",
  "ad_name",
  "campaign_id",
  "adset_id",
  "spend",
  "impressions",
  "clicks",
  "inline_link_clicks",
  "ctr",
  "cpc",
  "cpm",
  "frequency",
  "date_start",
  "date_stop",
  "actions",
].join(",");

const FIELDS_AGGREGATE = [
  "spend",
  "impressions",
  "clicks",
  "inline_link_clicks",
  "ctr",
  "cpc",
  "cpm",
  "frequency",
  "actions",
].join(",");

async function fetchInsights(params: Record<string, string | undefined>): Promise<MetaInsightRow[]> {
  const url = new URL(`${GRAPH_BASE}/${adAccountId()}/insights`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, v);
  }
  url.searchParams.set("access_token", token());
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Meta insights ${res.status}: ${txt}`);
  }
  const json = await res.json();
  return (json.data ?? []) as MetaInsightRow[];
}

const filterCampaign = () => {
  const cid = campaignId();
  if (!cid) return undefined; // no campaign filter - account-wide
  return JSON.stringify([{ field: "campaign.id", operator: "IN", value: [cid] }]);
};

// Convert "last_Nd" to an explicit time_range that INCLUDES today.
// Meta's date_preset "last_Nd" excludes today (date_stop = yesterday) - using time_range
// with until=today fixes this.
// For other windows ("today", "yesterday", "maximum"), fall back to date_preset.
function windowToParams(window: string): Record<string, string> {
  const m = window.match(/^last_(\d+)d$/);
  if (!m) {
    return { date_preset: window };
  }
  const days = parseInt(m[1], 10);
  const today = new Date();
  const since = new Date(today);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    time_range: JSON.stringify({ since: fmt(since), until: fmt(today) }),
  };
}

// Account-level rollup over a window (e.g. "today", "yesterday", "last_30d")
export async function getAccountRollup(window: string): Promise<MetaInsightRow | null> {
  const rows = await fetchInsights({
    level: "account",
    fields: FIELDS_AGGREGATE,
    ...windowToParams(window),
    filtering: filterCampaign(),
  });
  return rows[0] ?? null;
}

// Per-ad daily breakdown over a window
export async function getAdDaily(window: string): Promise<MetaInsightRow[]> {
  return fetchInsights({
    level: "ad",
    fields: FIELDS_AD,
    ...windowToParams(window),
    time_increment: "1",
    filtering: filterCampaign(),
  });
}

// Per-ad cumulative over a window (no daily breakdown)
export async function getAdCumulative(window: string): Promise<MetaInsightRow[]> {
  return fetchInsights({
    level: "ad",
    fields: FIELDS_AD,
    ...windowToParams(window),
    filtering: filterCampaign(),
  });
}

// Account-level daily timeseries - used to power sparklines
export async function getAccountTimeseries(window: string): Promise<MetaInsightRow[]> {
  return fetchInsights({
    level: "account",
    fields: FIELDS_AGGREGATE,
    ...windowToParams(window),
    time_increment: "1",
    filtering: filterCampaign(),
  });
}

// Pull live ad metadata (status + creative thumbnails) from Marketing API.
export type AdSummary = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  creative_id?: string;
  thumbnail_url?: string;
};

export async function listCampaignAds(): Promise<AdSummary[]> {
  const url = new URL(`${GRAPH_BASE}/${campaignId()}/ads`);
  url.searchParams.set(
    "fields",
    "id,name,status,effective_status,creative{id,thumbnail_url}"
  );
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", token());
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Meta ads list ${res.status}: ${txt}`);
  }
  const json = await res.json();
  type RawAd = {
    id: string;
    name: string;
    status: string;
    effective_status: string;
    creative?: { id?: string; thumbnail_url?: string };
  };
  return (json.data ?? []).map((a: RawAd) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    effective_status: a.effective_status,
    creative_id: a.creative?.id,
    thumbnail_url: a.creative?.thumbnail_url,
  }));
}

// Extract registration count from actions[] array on insights row.
export function extractRegistrations(row: MetaInsightRow): number {
  if (!row.actions) return 0;
  const ccId = customConversionId();
  const tag = `offsite_conversion.custom.${ccId}`;
  const match = row.actions.find((a) => a.action_type === tag);
  if (match) return Number(match.value || 0);
  // Fallback: sum any offsite_conversion.fb_pixel_custom that includes our id (defensive)
  const fallback = row.actions.find(
    (a) => a.action_type === "offsite_conversion.fb_pixel_lead"
  );
  return Number(fallback?.value || 0);
}

export function toCents(money: string | undefined | null): number {
  if (!money) return 0;
  const n = parseFloat(money);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

export function toFloat(s: string | undefined | null): number {
  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

export function toInt(s: string | undefined | null): number {
  if (!s) return 0;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? 0 : n;
}

// ----- Write actions (v2 placeholders, exposed for future use) -----

export async function pauseAd(adId: string): Promise<{ ok: boolean; raw: unknown }> {
  const url = new URL(`${GRAPH_BASE}/${adId}`);
  const body = new URLSearchParams({ status: "PAUSED", access_token: token() });
  const res = await fetch(url.toString(), { method: "POST", body });
  return { ok: res.ok, raw: await res.json().catch(() => ({})) };
}

export async function setAdsetBudget(adsetId: string, dailyCents: number): Promise<{ ok: boolean; raw: unknown }> {
  const url = new URL(`${GRAPH_BASE}/${adsetId}`);
  const body = new URLSearchParams({
    daily_budget: String(dailyCents),
    access_token: token(),
  });
  const res = await fetch(url.toString(), { method: "POST", body });
  return { ok: res.ok, raw: await res.json().catch(() => ({})) };
}
