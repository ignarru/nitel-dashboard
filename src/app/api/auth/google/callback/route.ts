import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Falta ?code en el callback" }, { status: 400 });
  }
  try {
    await exchangeCodeForTokens(code);
    return NextResponse.redirect(new URL("/?gmail=connected", req.url));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error intercambiando código" },
      { status: 500 },
    );
  }
}
