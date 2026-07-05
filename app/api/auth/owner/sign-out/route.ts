import { NextResponse } from "next/server";
import { clearOwnerSessionCookie } from "@/lib/auth";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/admin/sign-in", request.url), 303);
  clearOwnerSessionCookie(response);
  return response;
}

export async function POST(request: Request) {
  return GET(request);
}
