import { NextResponse } from "next/server";
import { runtimeHealth } from "@/lib/runtime-contracts";

export async function GET() {
  return NextResponse.json(runtimeHealth());
}
