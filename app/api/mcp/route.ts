import { handlePrincipalMcp } from "@/lib/principal-mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

export const POST = handlePrincipalMcp;
export const GET = handlePrincipalMcp;
export const HEAD = handlePrincipalMcp;
export const DELETE = handlePrincipalMcp;
export const PUT = handlePrincipalMcp;
export const PATCH = handlePrincipalMcp;
export const OPTIONS = handlePrincipalMcp;
