import { NextResponse } from "next/server";
import { implementationReadiness } from "@/lib/implementation";

export async function GET() {
  return NextResponse.json(implementationReadiness());
}
