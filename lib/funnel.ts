// Centralized funnel logic: dedup, test-email filtering, status rollup, cross-table join.
// This is the single source of truth for what counts as a "registration", "attended", etc.

export type FunnelRow = {
  email: string;
  firstName?: string;
  registrationTime?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  status?: string;             // Webinar Attendees Status
  pipelineStatus?: string;     // Framework Leads Pipeline Status
  source?: string;             // Framework Leads Source
};

export type FunnelCounts = {
  registrations: number;
  attended: number;
  callsBooked: number;
  enrollments: number;
  // raw counters for transparency
  metaPixelRegistrations?: number;
  testEmailsExcluded: number;
  duplicatesCollapsed: number;
};

// Add your own test addresses + substrings here so they're excluded from funnel attribution.
// Edit lib/funnel.ts during onboarding to add your team's emails.
const TEST_EMAILS = new Set<string>([
  // "you@yourdomain.com",
]);
const TEST_SUBSTRINGS: string[] = [
  "+test",
  // "yourlastname",
];

export function isTestEmail(rawEmail: string | undefined | null): boolean {
  if (!rawEmail) return true; // empty email is unusable
  const e = rawEmail.trim().toLowerCase();
  if (TEST_EMAILS.has(e)) return true;
  return TEST_SUBSTRINGS.some((s) => e.includes(s));
}

export function normalizeEmail(rawEmail: string | undefined | null): string {
  return (rawEmail || "").trim().toLowerCase();
}

// Status rollup priority. Higher = deeper in funnel.
// Rolls UP: Enrolled also counts as Attended + Registered.
const STATUS_RANK: Record<string, number> = {
  enrolled: 60,
  purchased: 55,
  "call completed": 50,
  "call booked": 45,
  show: 45,
  "no show": 30, // they registered but did not attend
  attended: 40,
  "reminder sent": 20,
  registered: 10,
};

function rank(s: string | undefined): number {
  if (!s) return 0;
  return STATUS_RANK[s.trim().toLowerCase()] ?? 0;
}

// Pick the row with the deepest funnel status. Tie-breaks by registration time (most recent).
function pickBest(a: FunnelRow, b: FunnelRow): FunnelRow {
  const aRank = Math.max(rank(a.status), rank(a.pipelineStatus));
  const bRank = Math.max(rank(b.status), rank(b.pipelineStatus));
  if (aRank !== bRank) return aRank > bRank ? a : b;
  const aTime = a.registrationTime ? Date.parse(a.registrationTime) : 0;
  const bTime = b.registrationTime ? Date.parse(b.registrationTime) : 0;
  return aTime >= bTime ? a : b;
}

// Merge two rows for the same email (one from each table). Carry over deepest signal.
function merge(a: FunnelRow, b: FunnelRow): FunnelRow {
  return {
    email: a.email,
    firstName: a.firstName || b.firstName,
    registrationTime: a.registrationTime || b.registrationTime,
    utmSource: a.utmSource || b.utmSource,
    utmMedium: a.utmMedium || b.utmMedium,
    utmCampaign: a.utmCampaign || b.utmCampaign,
    status: rank(a.status) >= rank(b.status) ? a.status : b.status,
    pipelineStatus: rank(a.pipelineStatus) >= rank(b.pipelineStatus) ? a.pipelineStatus : b.pipelineStatus,
    source: a.source || b.source,
  };
}

// Reduce many rows (potentially across tables) into one row per normalized email.
export function dedupe(rows: FunnelRow[]): { rows: FunnelRow[]; collapsed: number } {
  const byEmail = new Map<string, FunnelRow>();
  let collapsed = 0;
  for (const r of rows) {
    const e = normalizeEmail(r.email);
    if (!e) continue;
    const existing = byEmail.get(e);
    if (existing) {
      collapsed += 1;
      byEmail.set(e, merge(pickBest(existing, r), r));
    } else {
      byEmail.set(e, { ...r, email: e });
    }
  }
  return { rows: Array.from(byEmail.values()), collapsed };
}

export function filterTest(rows: FunnelRow[]): { rows: FunnelRow[]; excluded: number } {
  const kept: FunnelRow[] = [];
  let excluded = 0;
  for (const r of rows) {
    if (isTestEmail(r.email)) excluded += 1;
    else kept.push(r);
  }
  return { rows: kept, excluded };
}

// Only rows attributable to paid Meta.
export function isPaidMeta(r: FunnelRow): boolean {
  const src = (r.utmSource || "").toLowerCase();
  const med = (r.utmMedium || "").toLowerCase();
  return src === "meta" || med === "paid_social";
}

// Compute the funnel counts from a clean, deduped row set.
// Rules:
//   registrations = every row (each unique person who registered)
//   attended      = status in [attended, purchased, enrolled, show, call booked, call completed]
//   callsBooked   = status in [call booked, show, call completed, enrolled, purchased]
//   enrollments   = status in [enrolled, purchased]
export function rollup(rows: FunnelRow[]): Pick<FunnelCounts, "registrations" | "attended" | "callsBooked" | "enrollments"> {
  let registrations = 0;
  let attended = 0;
  let callsBooked = 0;
  let enrollments = 0;
  for (const r of rows) {
    registrations += 1;
    const top = Math.max(rank(r.status), rank(r.pipelineStatus));
    if (top >= 40) attended += 1;       // attended floor
    if (top >= 45) callsBooked += 1;    // call booked floor
    if (top >= 55) enrollments += 1;    // purchased floor (Enrolled or Purchased)
  }
  return { registrations, attended, callsBooked, enrollments };
}

// Full pipeline: filter test emails, dedupe, rollup. Returns enriched counts + the clean rows.
export function buildFunnel(rawRows: FunnelRow[], options?: { metaPixelRegistrations?: number }): { counts: FunnelCounts; rows: FunnelRow[] } {
  const f1 = filterTest(rawRows);
  const f2 = dedupe(f1.rows);
  const counts = rollup(f2.rows);
  return {
    counts: {
      ...counts,
      metaPixelRegistrations: options?.metaPixelRegistrations,
      testEmailsExcluded: f1.excluded,
      duplicatesCollapsed: f2.collapsed,
    },
    rows: f2.rows,
  };
}
