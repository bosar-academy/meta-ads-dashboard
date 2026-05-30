// Airtable readers - OPTIONAL.
//
// If AIRTABLE_ENABLED=true (with AIRTABLE_API_KEY + AIRTABLE_BASE_ID + table IDs set),
// the dashboard's funnel block pulls deeper attribution data from Airtable:
//   - Webinar / registration attendance status
//   - Sales pipeline status (calls booked, enrollments)
//
// If disabled, the funnel block falls back to Meta-only data
// (impressions → clicks → registrations from the custom conversion).
//
// To enable, set in .env.local:
//   AIRTABLE_ENABLED=true
//   AIRTABLE_API_KEY=keyXXX
//   AIRTABLE_BASE_ID=appXXX
//   AIRTABLE_REGISTRATIONS_TABLE_ID=tblXXX   (the table that stores registrations / opt-ins with UTM source)
//   AIRTABLE_LEADS_TABLE_ID=tblYYY            (OPTIONAL: a separate sales pipeline table with calls/enrollments status)

import { buildFunnel, isPaidMeta, type FunnelCounts, type FunnelRow } from "./funnel";

const API_BASE = "https://api.airtable.com/v0";

function airtableEnabled(): boolean {
  return process.env.AIRTABLE_ENABLED === "true";
}

function registrationsTableId(): string | undefined {
  return process.env.AIRTABLE_REGISTRATIONS_TABLE_ID || undefined;
}
function leadsTableId(): string | undefined {
  return process.env.AIRTABLE_LEADS_TABLE_ID || undefined;
}

function clean(s: string | undefined): string | undefined {
  return s?.trim().replace(/(\\[nrt])+$/g, "").trim();
}
function key() {
  const k = clean(process.env.AIRTABLE_API_KEY);
  if (!k) throw new Error("AIRTABLE_API_KEY not set");
  return k;
}
function baseId() {
  const b = clean(process.env.AIRTABLE_BASE_ID);
  if (!b) throw new Error("AIRTABLE_BASE_ID not set");
  return b;
}

type AirtableRecord = {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
};

async function listRecords(tableId: string, filterByFormula: string | null, maxRecords = 1000): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`${API_BASE}/${baseId()}/${tableId}`);
    if (filterByFormula) url.searchParams.set("filterByFormula", filterByFormula);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${key()}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Airtable ${res.status}: ${txt}`);
    }
    const json = await res.json();
    all.push(...(json.records as AirtableRecord[]));
    offset = json.offset;
    if (all.length >= maxRecords) break;
  } while (offset);
  return all;
}

function s(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

// Expected field names in your registrations table.
// If your column names differ, edit them here.
function mapRegistration(r: AirtableRecord): FunnelRow {
  return {
    email: s(r.fields["Email"]) || "",
    firstName: s(r.fields["First Name"]),
    registrationTime: s(r.fields["Registration Time"]) || r.createdTime,
    utmSource: s(r.fields["UTM Source"]),
    utmMedium: s(r.fields["UTM Medium"]),
    utmCampaign: s(r.fields["UTM Campaign"]),
    status: s(r.fields["Status"]),
  };
}

// Expected field names in your sales-pipeline / leads table.
function mapLead(r: AirtableRecord): FunnelRow {
  return {
    email: s(r.fields["Email"]) || "",
    firstName: s(r.fields["First Name"]),
    registrationTime: r.createdTime,
    utmSource: s(r.fields["UTM Source"]),
    utmMedium: s(r.fields["UTM Medium"]),
    utmCampaign: s(r.fields["UTM Campaign"]),
    pipelineStatus: s(r.fields["Pipeline Status"]),
    source: s(r.fields["Source"]),
  };
}

// Build the paid-Meta funnel for the last N days. Joins both tables, dedupes, filters test emails.
// Returns zero counts if Airtable is disabled.
export async function getFunnelCounts(daysBack: number, metaPixelRegistrations?: number): Promise<FunnelCounts> {
  if (!airtableEnabled()) {
    return { registrations: metaPixelRegistrations ?? 0, attended: 0, callsBooked: 0, enrollments: 0, metaPixelRegistrations, testEmailsExcluded: 0, duplicatesCollapsed: 0 };
  }

  const regTableId = registrationsTableId();
  const leadsTbl = leadsTableId();

  if (!regTableId) {
    // Airtable enabled but no registrations table configured - skip.
    return { registrations: metaPixelRegistrations ?? 0, attended: 0, callsBooked: 0, enrollments: 0, metaPixelRegistrations, testEmailsExcluded: 0, duplicatesCollapsed: 0 };
  }

  const sinceFormula = `IS_AFTER(CREATED_TIME(), DATEADD(NOW(), -${daysBack}, 'days'))`;

  const [regRaw, leadsRaw] = await Promise.all([
    listRecords(regTableId, sinceFormula).catch(() => [] as AirtableRecord[]),
    leadsTbl
      ? listRecords(leadsTbl, sinceFormula).catch(() => [] as AirtableRecord[])
      : Promise.resolve([] as AirtableRecord[]),
  ]);

  const regRows = regRaw.map(mapRegistration);
  const leadRows = leadsRaw.map(mapLead);

  // Registrations table carries the paid-Meta attribution. Take only paid-Meta rows.
  const paidMetaRegRows = regRows.filter(isPaidMeta);
  const paidMetaEmails = new Set(paidMetaRegRows.map((r) => (r.email || "").toLowerCase()));

  // Pull only Leads whose email appears in paid-Meta registrations.
  const attributedLeadRows = leadRows.filter((r) => paidMetaEmails.has((r.email || "").toLowerCase()));

  const combined = [...paidMetaRegRows, ...attributedLeadRows];
  const { counts } = buildFunnel(combined, { metaPixelRegistrations });
  return counts;
}

// Re-export the deeper inspection helper for the per-lead inspector in the UI.
// Returns empty array if Airtable is disabled.
export async function getCleanFunnelRows(daysBack: number): Promise<FunnelRow[]> {
  if (!airtableEnabled()) return [];

  const regTableId = registrationsTableId();
  const leadsTbl = leadsTableId();
  if (!regTableId) return [];

  const sinceFormula = `IS_AFTER(CREATED_TIME(), DATEADD(NOW(), -${daysBack}, 'days'))`;
  const [regRaw, leadsRaw] = await Promise.all([
    listRecords(regTableId, sinceFormula).catch(() => [] as AirtableRecord[]),
    leadsTbl
      ? listRecords(leadsTbl, sinceFormula).catch(() => [] as AirtableRecord[])
      : Promise.resolve([] as AirtableRecord[]),
  ]);
  const regRows = regRaw.map(mapRegistration).filter(isPaidMeta);
  const paidMetaEmails = new Set(regRows.map((r) => (r.email || "").toLowerCase()));
  const leadRows = leadsRaw.map(mapLead).filter((r) => paidMetaEmails.has((r.email || "").toLowerCase()));
  const { rows } = buildFunnel([...regRows, ...leadRows]);
  return rows;
}
