import { NextResponse } from "next/server";
import { runtimeSnapshot } from "@/lib/runtime-store";

export async function GET() {
  return NextResponse.json(await runtimeSnapshot());
}
