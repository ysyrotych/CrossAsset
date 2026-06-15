import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY;
  return NextResponse.json({
    hasKey: !!key,
    keyLength: key?.length ?? 0,
    keyPrefix: key ? key.slice(0, 10) + "..." : null,
    nodeEnv: process.env.NODE_ENV,
  });
}
