// Shape returned by /api/dashboard/state. Keep in sync with route.ts.

export type Bucket = {
  spendCents: number;
  impressions: number;
  linkClicks: number;
  registrations: number;
  cprCents: number | null;
  ctrLink: number;
  cpmCents: number;
  frequency: number;
};

export type AdVerdictTag = "too_early" | "winner" | "performing" | "watch" | "cull";

export type AdRow = {
  adId: string;
  adName: string;
  status: string;
  thumbnailUrl: string | null;
  spendCents: number;
  impressions: number;
  linkClicks: number;
  ctrLink: number;
  registrations: number;
  cprCents: number | null;
  frequency: number;
  verdict: AdVerdictTag;
  verdictReason: string;
  firstSeenDate: string | null;
  daysActive: number | null;
  fatigueScore: number;       // 0 (fresh) .. 1 (dying)
  fatigueReason: string;
};

export type TrendPoint = {
  date: string;
  spendCents: number;
  impressions: number;
  linkClicks: number;
  registrations: number;
  cprCents: number | null;
  cpmCents: number;
  ctrLink: number;
  frequency: number;
};

export type HeatmapCell = {
  date: string;          // YYYY-MM-DD
  intensity: number;     // 0..1
  spendCents: number;
  registrations: number;
  cprCents: number | null;
};

export type FunnelData = {
  metaPixelImpressions: number;
  metaPixelLinkClicks: number;
  registrations: number;
  attended: number;
  callsBooked: number;
  enrollments: number;
  metaPixelRegistrations: number;
  testEmailsExcluded: number;
  duplicatesCollapsed: number;
};

export type Anomaly = {
  metric: "cpr" | "cpm" | "ctr" | "spend" | "regs";
  direction: "up" | "down";
  changePct: number;
  date: string;
  message: string;
  severity: "info" | "warn" | "alert";
};

export type ActionLogEntry = {
  id: string;
  createdAt: string;
  action: string;
  targetId: string;
  reasoning: string;
  executor: string;
  result?: string | null;
};

export type DecisionTrigger = {
  id: string;
  label: string;
  status: "ok" | "watch" | "alert" | "pending";
  detail: string;
};

export type CampaignPhase = {
  label: string;
  daysIn: number | null;
  totalDays: number | null;
  spendPaceCents: number;
  spendPaceBudgetCents: number;
  exitCriteria: { label: string; done: boolean }[];
};

export type DashboardState = {
  meta: {
    adAccountId: string | null;
    campaignId: string | null;
    launchDate: string | null;
    daysSinceLaunch: number | null;
    lastSyncAt: string | null;
    lastSyncAgeMs: number | null;
  };
  scorecard: {
    today: Bucket;
    yesterday: Bucket;
    last7: Bucket;
    last30: Bucket & { spendCents: number };
    eventsThisWeek: number;
    learningProgress: number;
    learningEventsTarget: number;
    budget: { dailyCents: number; monthlyCents: number };
  };
  trend: TrendPoint[];
  heatmap: HeatmapCell[];
  ads: AdRow[];
  funnel: FunnelData;
  anomalies: Anomaly[];
  actionLog: ActionLogEntry[];
  phase: CampaignPhase;
  triggers: DecisionTrigger[];
  targets: unknown;
};
