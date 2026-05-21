import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/gmail";

export async function GET() {
  try {
    return NextResponse.redirect(getAuthUrl());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error generando auth URL" },
      { status: 500 },
    );
  }
}
