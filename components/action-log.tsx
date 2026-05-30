"use client";

import type { ActionLogEntry, DashboardState } from "@/lib/state-types";
import { Activity, Bot, Pause, Play, TrendingUp, TrendingDown, FileEdit, Zap } from "lucide-react";

const ACTION_ICONS: Record<string, typeof Pause> = {
  pause_ad: Pause,
  pause_adset: Pause,
  resume_ad: Play,
  resume_adset: Play,
  increase_budget: TrendingUp,
  decrease_budget: TrendingDown,
  launch_creative: Zap,
  edit_creative: FileEdit,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function actionLabel(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ActionRow({ entry }: { entry: ActionLogEntry }) {
  const Icon = ACTION_ICONS[entry.action] ?? Bot;
  const isAI = entry.executor.toLowerCase().includes("claude") || entry.executor.toLowerCase().includes("ai");
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isAI ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="font-medium">{actionLabel(entry.action)}</span>
          <span className="text-xs text-muted-foreground">on</span>
          <code className="text-xs bg-muted/60 rounded px-1.5 py-0.5">{entry.targetId}</code>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{entry.reasoning}</p>
        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
          <span>{timeAgo(entry.createdAt)}</span>
          <span>·</span>
          <span className={isAI ? "text-primary" : ""}>{entry.executor}</span>
          {entry.result && (
            <>
              <span>·</span>
              <span>{entry.result}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ActionLog({ state }: { state: DashboardState }) {
  const entries = state.actionLog || [];
  return (
    <section className="rounded-xl border border-border bg-card mb-6">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Auto-action log</h2>
        </div>
        <span className="text-xs text-muted-foreground">{entries.length} action{entries.length === 1 ? "" : "s"} this week</span>
      </div>

      {entries.length === 0 ? (
        <div className="px-5 py-8 text-sm text-muted-foreground text-center">
          <Bot className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
          <p>No auto-actions yet.</p>
          <p className="text-xs mt-1">When Claude pauses creatives, shifts budget, or launches variants, it shows up here in real time.</p>
        </div>
      ) : (
        <div className="px-5 py-2">
          {entries.map((e) => (
            <ActionRow key={e.id} entry={e} />
          ))}
        </div>
      )}
    </section>
  );
}
