// Reads the campaign plan markdown copied to public/plan.md at deploy time.
// Used by the "Plan inline" panel and as context to the AI summary call.

import { promises as fs } from "node:fs";
import path from "node:path";

let cached: string | null = null;
let cachedAt = 0;
const TTL_MS = 5 * 60 * 1000;

export async function readPlan(): Promise<string> {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) return cached;
  const p = path.join(process.cwd(), "public", "plan.md");
  try {
    const txt = await fs.readFile(p, "utf8");
    cached = txt;
    cachedAt = now;
    return txt;
  } catch {
    return "No campaign plan loaded yet. Copy public/plan.md.template to public/plan.md and fill in your campaign details (or run the install prompt to do this interactively).";
  }
}
