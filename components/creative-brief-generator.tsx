"use client";

import { useState } from "react";
import type { DashboardState } from "@/lib/state-types";
import { Loader2, Sparkles, Wand2, Lightbulb, X } from "lucide-react";

type BriefAngle = {
  name: string;
  hook: string;
  format: string;
  script_outline: string;
  why_it_should_work: string;
  novelty_axis: string;
};

type Brief = {
  winning_dna?: string;
  new_angles?: BriefAngle[];
  error?: string;
};

export function CreativeBriefGenerator({ state }: { state: DashboardState }) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    setOpen(true);
    setBrief(null);
    const ads = state.ads || [];
    const winners = ads.filter((a) => a.verdict === "winner" || a.verdict === "performing").slice(0, 3);
    const losers = ads.filter((a) => a.verdict === "cull" || a.verdict === "watch").slice(0, 3);
    const topAds = (winners.length > 0 ? winners : ads.slice(0, 3)).map((a) => ({
      adName: a.adName,
      cprCents: a.cprCents,
      spendCents: a.spendCents,
      registrations: a.registrations,
      ctrLink: a.ctrLink,
    }));
    const losingAds = losers.map((a) => ({
      adName: a.adName,
      cprCents: a.cprCents,
      spendCents: a.spendCents,
      registrations: a.registrations,
      ctrLink: a.ctrLink,
    }));
    try {
      const res = await fetch("/api/insights/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topAds, losingAds }),
      });
      const json = await res.json();
      setBrief(json);
    } catch (e) {
      setBrief({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={generate}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        Generate next creative brief
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-start justify-center p-4 sm:p-8 overflow-y-auto" onClick={() => setOpen(false)}>
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl max-w-3xl w-full my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Next creative brief</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {loading && (
                <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Claude is reading your winners and proposing 3 new angles...
                </div>
              )}

              {brief?.error && (
                <p className="text-sm text-destructive">{brief.error}</p>
              )}

              {brief?.winning_dna && (
                <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4 mb-6">
                  <div className="flex items-center gap-2 text-emerald-500 text-xs uppercase tracking-wide font-semibold mb-1.5">
                    <Lightbulb className="w-4 h-4" />
                    Winning DNA
                  </div>
                  <p className="text-sm leading-relaxed">{brief.winning_dna}</p>
                </div>
              )}

              {brief?.new_angles && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">3 New Angles to Test</h3>
                  {brief.new_angles.map((a, i) => (
                    <div key={i} className="rounded-xl border border-border bg-muted/30 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-xs text-muted-foreground">Concept {i + 1}</div>
                          <h4 className="text-base font-semibold">{a.name}</h4>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{a.format}</span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-0.5">Hook</div>
                          <p className="font-medium italic">&ldquo;{a.hook}&rdquo;</p>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-0.5">Script outline</div>
                          <p className="text-foreground/80 leading-relaxed whitespace-pre-line">{a.script_outline}</p>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border">
                          <div>
                            <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-0.5">Why it should work</div>
                            <p className="text-xs text-foreground/70">{a.why_it_should_work}</p>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-0.5">Novelty axis</div>
                            <p className="text-xs text-foreground/70">{a.novelty_axis}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
