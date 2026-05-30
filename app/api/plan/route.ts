import { NextResponse } from "next/server";
import { readPlan } from "@/lib/plan-context";

export const dynamic = "force-static";

export async function GET() {
  const plan = await readPlan();
  return NextResponse.json({ plan });
}
