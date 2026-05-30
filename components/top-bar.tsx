"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw, Sun, Moon } from "lucide-react";

function formatAge(ms: number | null): string {
  if (ms == null) return "never";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function TopBar() {
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncIso, setLastSyncIso] = useState<string | null>(null);
  const [syncAgeMs, setSyncAgeMs] = useState<number | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setLastSyncIso(new Date().toISOString());
        window.dispatchEvent(new CustomEvent("ads-dashboard:refresh", { detail: json }));
      } else {
        console.error("Refresh failed:", json);
      }
    } finally {
      setRefreshing(false);
    }
  }

  // Read syncedAt from the API every time the dashboard renders.
  useEffect(() => {
    fetch("/api/dashboard/state")
      .then((r) => r.json())
      .then((s) => s?.meta?.lastSyncAt && setLastSyncIso(s.meta.lastSyncAt))
      .catch(() => {});
  }, []);

  // Tick the live "sync age" once per second so the badge feels alive.
  useEffect(() => {
    function tick() {
      if (!lastSyncIso) {
        setSyncAgeMs(null);
        return;
      }
      setSyncAgeMs(Date.now() - new Date(lastSyncIso).getTime());
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastSyncIso]);

  // Auto-refresh dashboard state every 60s by dispatching the refresh event.
  useEffect(() => {
    const id = setInterval(() => {
      window.dispatchEvent(new CustomEvent("ads-dashboard:refresh"));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Theme toggle persisted to localStorage; controls .dark on <html>.
  useEffect(() => {
    const stored = (typeof window !== "undefined" && localStorage.getItem("ads-theme")) as "dark" | "light" | null;
    const preferred = stored ?? "dark";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(preferred);
    document.documentElement.classList.toggle("dark", preferred === "dark");
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("ads-theme", next);
  }

  const isFresh = syncAgeMs != null && syncAgeMs < 5 * 60 * 1000;

  return (
    <header className="border-b border-border sticky top-0 z-10 bg-background/90 backdrop-blur">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">Meta Ads Dashboard</h1>
        </div>
        <div className="text-xs text-muted-foreground hidden sm:block">
          Cold campaign · Business Owners US · $50/day
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className={`relative inline-flex h-2 w-2 rounded-full ${isFresh ? "bg-emerald-500" : "bg-amber-500"}`}>
              {isFresh && <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />}
            </span>
            <span>Synced {formatAge(syncAgeMs)}</span>
          </div>
          <button
            onClick={toggleTheme}
            className="inline-flex items-center justify-center rounded-md border border-border w-8 h-8 hover:bg-muted"
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Syncing..." : "Sync now"}
          </button>
        </div>
      </div>
    </header>
  );
}
