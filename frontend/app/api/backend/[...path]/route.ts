import { NextRequest, NextResponse } from "next/server";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!["auth", "workspace"].includes(path[0])) return NextResponse.json({ detail: "Not found." }, { status: 404 });
  if (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ detail: "Invalid request origin." }, { status: 403 });
  }
  try {
    const response = await fetch(`${process.env.TALENTLENS_API_URL || "http://127.0.0.1:8000"}/${path.map(encodeURIComponent).join("/")}`, {
      method: request.method, headers: { "Content-Type": "application/json", Cookie: request.headers.get("cookie") || "" },
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.text(),
      cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(10000),
    });
    const headers = new Headers({ "Cache-Control": "no-store" });
    const cookie = response.headers.get("set-cookie");
    if (cookie) headers.set("set-cookie", cookie);
    if (response.status === 204) return new NextResponse(null, { status: 204, headers });
    return NextResponse.json(await response.json(), { status: response.status, headers });
  } catch {
    return NextResponse.json({ detail: "The backend is unavailable. Please retry after it starts." }, { status: 503 });
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
