import { NextResponse } from "next/server";
import { ownerAccessFromCookies } from "@/lib/auth";

export async function GET() {
  const access = await ownerAccessFromCookies();
  return NextResponse.json({
    ok: access.ok,
    role: access.ok ? access.role : null,
    mode: access.mode,
    auth: {
      mode: access.status.mode,
      configured: access.status.configured,
      productionSafe: access.status.productionSafe,
      missingEnv: access.status.missingEnv,
      detail: access.status.detail
    }
  });
}
