import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Falta ?code en el callback" }, { status: 400 });
  }
  try {
    await exchangeCodeForTokens(code);
    // Detrás del reverse proxy, req.url resuelve a la URL interna (0.0.0.0:3000),
    // que no es navegable. Usamos la URL pública configurada para el redirect.
    const base = process.env.NEXT_PUBLIC_BASE_URL?.trim() || new URL(req.url).origin;
    return NextResponse.redirect(new URL("/?gmail=connected", base));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error intercambiando código" },
      { status: 500 },
    );
  }
}
