import { NextResponse } from "next/server";
import { requireOwnerApiAccess } from "@/lib/auth";
import { runtimeHealth } from "@/lib/runtime-contracts";

export async function GET(request: Request) {
  const denied = await requireOwnerApiAccess(request, "operations:read");
  if (denied) return denied;

  return NextResponse.json(runtimeHealth());
}
