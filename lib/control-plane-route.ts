import { NextResponse } from "next/server";
import { controlPlaneConfiguration } from "./mcp-configuration.ts";

export function requireConfiguredControlPlane(operation: string, correlationId: string) {
  const config = controlPlaneConfiguration();
  if (config.configured) return null;
  console.error("Property OS control-plane configuration denied", {
    operation,
    correlationId,
    mode: config.partial ? "partial" : "disabled",
    issues: config.issues
  });
  return NextResponse.json({
    error: "The governed control plane is not configured. No work was recorded or started.",
    correlationId
  }, { status: 503 });
}

export function controlPlaneFailure(error: unknown, operation: string, correlationId: string) {
  console.error("Property OS control-plane operation failed", {
    operation,
    correlationId,
    code: error instanceof Error && "code" in error ? String(error.code) : "MCP_OPERATION_FAILED"
  });
  return NextResponse.json({
    error: "The governed control plane did not complete the operation. No local fallback, notification, or downstream work was started.",
    correlationId
  }, { status: 503 });
}
