import { NextResponse } from "next/server";
import { requireOwnerApiAccess } from "@/lib/auth";
import { implementationReadiness } from "@/lib/implementation";

export async function GET(request: Request) {
  const denied = await requireOwnerApiAccess(request);
  if (denied) return denied;

  return NextResponse.json(implementationReadiness());
}
