import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(`${process.env.TALENTLENS_API_URL || "http://127.0.0.1:8000"}/demo/workspace`, {
      cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ detail: "The sample-data backend is unavailable. Retry after it starts." }, { status: 503 });
  }
}
