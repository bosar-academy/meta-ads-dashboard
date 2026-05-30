import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

type AdInput = { adName?: string; cprCents?: number | null; spendCents?: number; registrations?: number; ctrLink?: number };

function fmtMoney(cents: number | undefined | null) {
  if (!cents) return "$0";
  return `$${(cents / 100).toFixed(2)}`;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  let body: { topAds?: AdInput[]; losingAds?: AdInput[] } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const winners = (body.topAds ?? []).slice(0, 3);
  const losers = (body.losingAds ?? []).slice(0, 3);

  if (winners.length === 0) {
    return NextResponse.json({ error: "No winning ads yet to extract DNA from. Wait for more spend." }, { status: 400 });
  }

  const winnerLines = winners.map((a) => `- ${a.adName} | CPR ${a.cprCents != null ? fmtMoney(a.cprCents) : "n/a"} | CTR ${((a.ctrLink ?? 0) * 100).toFixed(2)}% | spend ${fmtMoney(a.spendCents)} | ${a.registrations} regs`).join("\n");
  const loserLines = losers.map((a) => `- ${a.adName} | CPR ${a.cprCents != null ? fmtMoney(a.cprCents) : "n/a"} | CTR ${((a.ctrLink ?? 0) * 100).toFixed(2)}% | spend ${fmtMoney(a.spendCents)}`).join("\n");

  // Read the campaign brief from public/plan.md if present so the AI is grounded in the user's specific offer.
  const planContext = await import("@/lib/plan-context").then((m) => m.readPlan()).catch(() => "");

  const prompt = `You are a senior performance creative strategist analyzing a Meta ad campaign.

Campaign context (from the user's plan):
${planContext.slice(0, 2000)}

Your job: given the current winning and losing ads below, propose 3 new creative angles to test next week. Extract WHY winners are winning (hook, format, audience signal) and design variants that double down on the working pattern with novel approaches.

WINNING ADS (low CPR, high CTR):
${winnerLines}

${loserLines ? `LOSING ADS (high CPR or low CTR):\n${loserLines}\n` : ""}

Return ONLY this JSON shape:
{
  "winning_dna": "1-2 sentences extracting the pattern that's working - hook style, audience hint, format clue.",
  "new_angles": [
    {
      "name": "Concept name (3-5 words)",
      "hook": "First 3 seconds of script or visual. Exact words/visual.",
      "format": "Video / Static / Carousel / Reel",
      "script_outline": "30-second script in 3-4 lines.",
      "why_it_should_work": "1 sentence tying it back to winning DNA.",
      "novelty_axis": "What's different from current winners (visual style, hook angle, audience cut, format)"
    }
  ]
}

Rules:
- NO em dashes anywhere.
- 3 angles total. Each must be genuinely novel, not a tiny tweak.
- Ground recommendations in the campaign context above. Stay on-brand and on-audience.
- Hooks must be conversational, not corporate.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "Model returned no JSON", raw: text }, { status: 502 });
    }
    return NextResponse.json(JSON.parse(match[0]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Brief generation failed: ${msg}` }, { status: 500 });
  }
}
