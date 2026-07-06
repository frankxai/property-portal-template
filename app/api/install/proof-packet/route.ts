import { NextResponse } from "next/server";
import { requireOwnerApiAccess } from "@/lib/auth";
import { createInstallProofPacket } from "@/lib/install-proof";

export async function GET(request: Request) {
  const denied = await requireOwnerApiAccess(request);
  if (denied) return denied;

  return NextResponse.json(createInstallProofPacket());
}
