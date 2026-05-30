"use client";

import type { AdRow, DashboardState, AdVerdictTag } from "@/lib/state-types";
import { classifyCpr } from "@/lib/targets";
import { ExternalLink, Flame } from "lucide-react";

function fmtMoney(cents: number | null | undefined) {
  if (cents == null) return "-";
  return `$${(cents / 100).toFixed(2)}`;
}
function fmtPct(v: number | null | undefined) {
  if (v == null) return "-";
  return `${(v * 100).toFixed(2)}%`;
}

function statusBadge(status: string) {
  const s = status.toUpperCase();
  if (s.includes("ACTIVE")) return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  if (s.includes("PAUSED")) return "bg-muted text-muted-foreground border-border";
  return "bg-amber-500/10 text-amber-500 border-amber-500/20";
}

const VERDICT_STYLES: Record<AdVerdictTag, { label: string; cls: string }> = {
  winner: { label: "Winner", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  performing: { label: "Performing", cls: "bg-sky-500/10 text-sky-500 border-sky-500/30" },
  watch: { label: "Watch", cls: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  cull: { label: "Cull", cls: "bg-red-500/10 text-destructive border-destructive/30" },
  too_early: { label: "Too early", cls: "bg-muted text-muted-foreground border-border" },
};

function VerdictBadge({ ad }: { ad: AdRow }) {
  const v = VERDICT_STYLES[ad.verdict];
  return (
    <span
      title={ad.verdictReason}
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${v.cls}`}
    >
      {v.label}
    </span>
  );
}

function FatigueMeter({ score, reason }: { score: number; reason: string }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? "text-destructive bg-destructive/20"
    : score >= 0.4 ? "text-amber-500 bg-amber-500/20"
    : score > 0 ? "text-emerald-500 bg-emerald-500/20"
    : "text-muted-foreground bg-muted";

  return (
    <div className="flex items-center justify-end gap-1.5" title={reason}>
      <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color.split(" ")[1]}`} style={{ width: `${pct}%` }} />
      </div>
      {score >= 0.5 && <Flame className={`w-3.5 h-3.5 ${color.split(" ")[0]}`} />}
    </div>
  );
}

export function CreativeLeaderboard({ state }: { state: DashboardState }) {
  const ads = state.ads;

  return (
    <section className="rounded-xl border border-border bg-card mb-6">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold">Creative leaderboard</h2>
        <p className="text-xs text-muted-foreground">Sorted by CPR (lowest first). Hover verdict or fatigue for detail.</p>
      </div>
      {ads.length === 0 ? (
        <div className="px-5 py-8 text-sm text-muted-foreground">
          No ads with insights yet. After the campaign is ACTIVE and Meta returns 1+ row, ads appear here.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left px-5 py-2 font-medium">Ad</th>
                <th className="text-left px-3 py-2 font-medium">Verdict</th>
                <th className="text-right px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium">Spend</th>
                <th className="text-right px-3 py-2 font-medium">Impr</th>
                <th className="text-right px-3 py-2 font-medium">Link CTR</th>
                <th className="text-right px-3 py-2 font-medium">Regs</th>
                <th className="text-right px-3 py-2 font-medium">CPR</th>
                <th className="text-right px-3 py-2 font-medium">Freq</th>
                <th className="text-right px-3 py-2 font-medium">Days</th>
                <th className="text-right px-3 py-2 font-medium" title="Fatigue: frequency growth + CTR decay">Fatigue</th>
                <th className="text-right px-5 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {ads.map((a) => {
                const cls = classifyCpr(a.cprCents);
                const cprColor = cls === "green" ? "text-emerald-500" : cls === "yellow" ? "text-amber-500" : cls === "red" ? "text-destructive" : "text-muted-foreground";
                const adsManagerUrl = state.meta.adAccountId
                  ? `https://business.facebook.com/adsmanager/manage/ads?act=${state.meta.adAccountId.replace(/^act_/, "")}&selected_ad_ids=${a.adId}`
                  : "#";
                return (
                  <tr key={a.adId} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {a.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover bg-muted" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted" />
                        )}
                        <div>
                          <div className="font-medium">{a.adName}</div>
                          <div className="text-xs text-muted-foreground">{a.adId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3"><VerdictBadge ad={a} /></td>
                    <td className="px-3 py-3 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded border ${statusBadge(a.status)}`}>
                        {a.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(a.spendCents)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{a.impressions.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtPct(a.ctrLink)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{a.registrations}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${cprColor}`}>{fmtMoney(a.cprCents)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{a.frequency.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground" title={a.firstSeenDate ? `First impression on ${a.firstSeenDate}` : "Not yet seen"}>
                      {a.daysActive == null ? "-" : a.daysActive}
                    </td>
                    <td className="px-3 py-3">
                      <FatigueMeter score={a.fatigueScore} reason={a.fatigueReason} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <a href={adsManagerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
