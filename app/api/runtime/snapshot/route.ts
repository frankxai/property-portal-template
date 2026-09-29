import { NextResponse } from "next/server";
import { requireOwnerApiAccess } from "@/lib/auth";
import { runtimeSnapshot } from "@/lib/runtime-store";

export async function GET(request: Request) {
  const denied = await requireOwnerApiAccess(request, "operations:read");
  if (denied) return denied;

  return NextResponse.json(await runtimeSnapshot());
}
