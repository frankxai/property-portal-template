import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { applyStress, evaluateInvestment, investmentSchema, type InvestmentResult } from "./investment-model.ts";

export const PRINCIPAL_MCP_MAX_BYTES = 32 * 1024;
const BODY_TIMEOUT_MS = 5_000;
const financialNumber = z.number().finite();
const optionalRatio = financialNumber.nullable();
const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const reviewDomainSchema = z.enum(["acquisition", "ownership", "tenancy", "kleinanzeigen"]);
const reviewPlaybooks = {
  acquisition: {
    procedure: [
      "Define the owner's required return, liquidity reserve, decision date and financing constraints. Separate seller claims, document evidence and unverified assumptions.",
      "Reconcile purchase costs, initial capex, rent roll, vacancy, non-recoverable costs and maintenance reserve. Date each source and record any conflicts.",
      "Run underwrite_property only after the numeric assumptions are explicit. Review monthly amortization aggregated annually, the fixed-rate expiry, refinancing debt and the exit assumption.",
      "Run coordinated vacancy, refinance, capex and exit-cap-rate downside cases. Inspect the weakest cash-flow year and reserve-adjusted coverage, not only IRR.",
      "Produce a decision memo with a proposed outcome conditional on named evidence, downside liquidity requirement, unresolved questions, responsible reviewer and next decision date. Keep market value and tax treatment unconfirmed until supported.",
    ],
    requiredEvidence: ["Dated seller material and permission to use it", "Anonymized rent roll and lease terms", "Operating-cost history and recovery split", "Condition survey and capex estimates", "Financing term sheet and repayment schedule", "Dated comparable evidence for rent and terminal value"],
    decisionBoundary: "A calculated scenario is not a verified valuation or purchase instruction. The owner decides after evidence and financing conditions are resolved.",
    primarySources: [{ title: "BGB §535: obligations relevant to rental assumptions", url: "https://www.gesetze-im-internet.de/bgb/__535.html" }],
  },
  ownership: {
    procedure: [
      "Separate a new acquisition from transferring an existing asset. Establish the actual tax year, tax residence, ownership, use and acquisition history before comparing structures.",
      "Compare private ownership, a directly owned property company, and a holding company with property subsidiaries. Model acquisition, operations, financing, distributions and exit separately.",
      "Do not treat KStG §8b participation rules as a general rental-income exemption. Check corporate tax for each relevant year and assess any GewStG §9 reduction against the entity's actual activities and conditions.",
      "Account for transfer taxes and transaction costs, existing debt and lender consent, recurring administration, withdrawal needs, retained cash and asset versus share exit. Avoid a headline tax-rate comparison detached from cash reaching the owner.",
      "Prepare comparable cash-flow cases and a list of fact-specific questions for the Steuerberater and notary. Record their conclusions, effective dates and assumptions before proposing a transfer or incorporation.",
    ],
    requiredEvidence: ["Tax residence and relevant tax years", "Existing legal entities, ownership and activities", "Asset use, acquisition dates and tax basis", "Financing and transfer restrictions", "Planned owner withdrawals and reinvestment", "Expected holding period and exit route", "Transaction-cost estimates and adviser assessment"],
    decisionBoundary: "This is a review procedure, not a recommendation to form a holding or move a property. Eligibility, rates and transfer consequences require the actual facts and current professional review.",
    primarySources: [
      { title: "BMF: corporate income tax and tax-year changes", url: "https://www.bundesfinanzministerium.de/Content/DE/Glossareintraege/K/koerperschaftsteuer.html?view=renderHelp" },
      { title: "KStG §8b: corporate participations", url: "https://www.gesetze-im-internet.de/kstg_1977/__8b.html" },
      { title: "GewStG §9: trade-tax reductions and conditions", url: "https://www.gesetze-im-internet.de/gewstg/__9.html" },
    ],
  },
  tenancy: {
    procedure: [
      "Describe the issue using an anonymous case alias, observed facts, dates and the relevant property system. Keep tenant identity and sensitive documents in the authenticated case system.",
      "Triage immediate health, safety and property-damage urgency. Identify who can inspect or make the situation safe and which facts remain unverified.",
      "Review the relevant contract terms, maintenance history, dated notices and supporting evidence. Check the applicable legal basis and jurisdiction before proposing a legal action.",
      "Prepare an owner action with a responsible person, evidence needed, response deadline and proposed communication. Escalate disputed liability, rent changes or termination to a qualified reviewer.",
      "Keep correspondence as a draft until the owner approves it. Record delivery evidence and completion only after an authorized external system confirms them.",
    ],
    requiredEvidence: ["Anonymized issue chronology and urgency", "Relevant contract excerpts", "Dated condition evidence and previous reports", "Prior owner actions and contractor findings", "Proposed response and reviewer"],
    decisionBoundary: "The playbook cannot access tenant records, determine legal rights in a specific dispute, send messages or execute tenant actions.",
    primarySources: [{ title: "BGB §535: landlord and tenant obligations", url: "https://www.gesetze-im-internet.de/bgb/__535.html" }],
  },
  kleinanzeigen: {
    procedure: [
      "Use content supplied by the owner with permission, or an authorized export. Preserve the original source URL, capture date and the distinction between source statements and analyst assumptions.",
      "Treat a URL as a reference until its content is actually supplied or retrieved through a separately authorized capability. Never claim that this MCP service fetched, synchronized or monitored a listing.",
      "Normalize property facts and missing fields; reconcile duplicate source identifiers and retain provenance when revised material arrives. Ask for missing financial assumptions before underwriting.",
      "For outbound OpenImmo delivery, confirm a booked Kleinanzeigen professional partnership and provisioned FTP access with the provider. Credentials belong in the authorized integration's secret store, not a chat or listing payload.",
      "Prepare a reviewed listing or integration handoff with evidence, owner approval and delivery checks. This service performs no scraping, automatic posting, marketplace search or messaging.",
    ],
    requiredEvidence: ["Permission to use the supplied content", "Source URL and actual capture date", "Original supplied listing or authorized export", "Property facts and missing-field register", "For outbound integration: booked partnership and provider-confirmed connection setup", "Owner-reviewed listing draft"],
    decisionBoundary: "The linked provider documentation describes a professional outbound integration. It does not establish access to a public search API or to marketplace accounts through this service.",
    primarySources: [{ title: "Kleinanzeigen professional help: software interfaces", url: "https://hilfe-gewerblich.kleinanzeigen.de/artikel/schnittstellen" }],
  },
} satisfies Record<z.infer<typeof reviewDomainSchema>, {
  procedure: string[]; requiredEvidence: string[]; decisionBoundary: string;
  primarySources: { title: string; url: string }[];
}>;

const investmentResultSchema = z.object({
  totalCost: financialNumber,
  initialEquity: financialNumber,
  years: z.array(z.object({
    year: financialNumber,
    scheduledRent: financialNumber,
    effectiveRent: financialNumber,
    operatingCosts: financialNumber,
    maintenanceReserve: financialNumber,
    noi: financialNumber,
    cashAvailableForDebtService: financialNumber,
    interest: financialNumber,
    principal: financialNumber,
    debtService: financialNumber,
    cashFlow: financialNumber,
    closingDebt: financialNumber,
    coverageAfterReserve: optionalRatio,
  })),
  grossYieldPct: financialNumber,
  initialLtvPct: financialNumber,
  exitValue: financialNumber,
  exitProceeds: financialNumber,
  equityMultiple: optionalRatio,
  irrPct: optionalRatio,
  npv: financialNumber,
  assumptions: z.array(z.string()),
});

const stressSchema = z.strictObject({
  vacancyDeltaPct: financialNumber.min(0).max(30).describe("Add percentage points to vacancy, capped at 100% by the model."),
  refinanceRateDeltaPct: financialNumber.min(0).max(15).describe("Add percentage points to the refinance rate after the fixed-rate term; does not change the initial rate."),
  capexOverrunPct: financialNumber.min(0).max(100).describe("Increase initial capital expenditure by this percentage, funded with additional equity."),
  exitCapRateDeltaPct: financialNumber.min(0).max(10).describe("Add percentage points to the terminal capitalization rate."),
});

const portfolioSchema = z.strictObject({
  assets: z.array(z.strictObject({
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/).describe("Unique anonymous alias, for example asset-01. Do not use names, addresses or account identifiers."),
    input: investmentSchema,
  })).min(1).max(12).describe("One to twelve properties, with every assumption supplied explicitly."),
  stress: stressSchema,
}).superRefine(({ assets }, context) => {
  if (new Set(assets.map(({ id }) => id)).size !== assets.length) {
    context.addIssue({ code: "custom", path: ["assets"], message: "Asset aliases must be unique." });
  }
});

const metricsSchema = z.object({
  totalCost: financialNumber,
  initialEquity: financialNumber,
  yearOneNoi: financialNumber,
  yearOneDebtService: financialNumber,
  yearOneCashFlow: financialNumber,
  minimumCoverageAfterReserve: optionalRatio,
  exitValue: financialNumber,
  closingDebt: financialNumber,
  exitProceeds: financialNumber,
  equityMultiple: optionalRatio,
  irrPct: optionalRatio,
  npv: financialNumber,
});

const totalsSchema = z.object({
  totalCost: financialNumber,
  initialEquity: financialNumber,
  yearOneNoi: financialNumber,
  yearOneDebtService: financialNumber,
  yearOneCashFlow: financialNumber,
});

function metrics(result: InvestmentResult) {
  const yearOne = result.years[0];
  const coverage = result.years.flatMap(({ coverageAfterReserve }) => coverageAfterReserve === null ? [] : [coverageAfterReserve]);
  return {
    totalCost: result.totalCost,
    initialEquity: result.initialEquity,
    yearOneNoi: yearOne.noi,
    yearOneDebtService: yearOne.debtService,
    yearOneCashFlow: yearOne.cashFlow,
    minimumCoverageAfterReserve: coverage.length ? Math.min(...coverage) : null,
    exitValue: result.exitValue,
    closingDebt: result.years[result.years.length - 1].closingDebt,
    exitProceeds: result.exitProceeds,
    equityMultiple: result.equityMultiple,
    irrPct: result.irrPct,
    npv: result.npv,
  };
}

function totals(results: ReturnType<typeof metrics>[]) {
  return results.reduce((sum, item) => ({
    totalCost: sum.totalCost + item.totalCost,
    initialEquity: sum.initialEquity + item.initialEquity,
    yearOneNoi: sum.yearOneNoi + item.yearOneNoi,
    yearOneDebtService: sum.yearOneDebtService + item.yearOneDebtService,
    yearOneCashFlow: sum.yearOneCashFlow + item.yearOneCashFlow,
  }), { totalCost: 0, initialEquity: 0, yearOneNoi: 0, yearOneDebtService: 0, yearOneCashFlow: 0 });
}

function resultContent<T extends Record<string, unknown>>(structuredContent: T) {
  return { structuredContent, content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }] };
}

function calculationError() {
  return {
    isError: true,
    content: [{ type: "text" as const, text: "Calculation could not be completed within the supported model ranges. Review the assumptions and reduce stress values if necessary." }],
  };
}

/** No database, identity provider, listing fetcher, or model API is reachable from this server. */
export function createPrincipalMcpServer() {
  const server = new McpServer({ name: "property-principal-calculations", version: "1.0.0" }, {
    instructions: "Use get_property_review_playbook for a dated owner-review procedure. Calculate only from explicit numeric assumptions supplied in this conversation. The service has no saved portfolio, documents, accounts, live rates or listing access. Ask for missing assumptions instead of inventing them. Results are nominal pre-tax scenarios in EUR, not a valuation or tax recommendation. Use underwrite_property for an annual schedule and stress_property_portfolio for up to 12 anonymous assets. Explain null ratios and returned assumptions.",
  });

  const playbookOutput = z.object({
    domain: reviewDomainSchema,
    reviewedAt: z.literal("2026-09-12"),
    sourceStatus: z.literal("dated_reference_links_not_fetched_during_tool_call"),
    procedure: z.array(z.string()),
    requiredEvidence: z.array(z.string()),
    decisionBoundary: z.string(),
    primarySources: z.array(z.object({ title: z.string(), url: z.url() })),
  });
  server.registerTool("get_property_review_playbook", {
    title: "Get an owner review playbook",
    description: "Use this when the user needs a senior owner review procedure for acquisition, ownership/holding structure, tenancy, or Kleinanzeigen. Returns a dated reusable procedure, required evidence, decision boundaries and primary reference links. It reads no private data, fetches no sources, gives no fact-specific legal or tax recommendation, and performs no external action. Recheck applicable sources before a legal or tax conclusion.",
    inputSchema: z.strictObject({ domain: reviewDomainSchema.describe("The owner-review domain to prepare.") }),
    outputSchema: playbookOutput,
    annotations,
    _meta: { securitySchemes: [{ type: "noauth" }] },
  }, async ({ domain }) => resultContent(playbookOutput.parse({
    domain, reviewedAt: "2026-09-12", sourceStatus: "dated_reference_links_not_fetched_during_tool_call", ...reviewPlaybooks[domain],
  })));

  const underwritingOutput = z.object({
    calculationBasis: z.literal("user_supplied_assumptions"),
    currency: z.literal("EUR"),
    model: z.literal("nominal_pre_tax"),
    result: investmentResultSchema,
  });

  server.registerTool("underwrite_property", {
    title: "Underwrite a property",
    description: "Use this when the user supplies a property's financial assumptions and wants an annual cash-flow and amortization schedule, refinancing scenario, exit proceeds, equity IRR and NPV. All monetary inputs are EUR. Computes from supplied assumptions only; cannot fetch listings, value a home, retrieve a portfolio or determine taxes. Ask for all missing inputs before calling.",
    inputSchema: investmentSchema,
    outputSchema: underwritingOutput,
    annotations,
    _meta: { securitySchemes: [{ type: "noauth" }] },
  }, async (input) => {
    try {
      return resultContent(underwritingOutput.parse({
        calculationBasis: "user_supplied_assumptions", currency: "EUR", model: "nominal_pre_tax", result: evaluateInvestment(input),
      }));
    } catch {
      return calculationError();
    }
  });

  const portfolioOutput = z.object({
    calculationBasis: z.literal("user_supplied_assumptions"),
    currency: z.literal("EUR"),
    model: z.literal("nominal_pre_tax"),
    stress: stressSchema,
    assets: z.array(z.object({
      id: z.string(),
      horizonYears: financialNumber,
      stressedInput: investmentSchema,
      baseline: metricsSchema,
      downside: metricsSchema,
      yearOneCashFlowDelta: financialNumber,
      npvDelta: financialNumber,
      assumptions: z.array(z.string()),
    })),
    portfolio: z.object({ baseline: totalsSchema, downside: totalsSchema, yearOneCashFlowDelta: financialNumber, additionalInitialEquity: financialNumber }),
    interpretation: z.string(),
  });

  server.registerTool("stress_property_portfolio", {
    title: "Stress a property portfolio",
    description: "Use this when the user supplies 1–12 properties and four explicit downside shocks to compare vacancy, refinancing, initial capex and exit-cap-rate exposure. Returns baseline/downside metrics per anonymous asset and aggregate first-year cash flow and equity. Does not retrieve or store a portfolio, rank real investments, calculate taxes, or average asset IRRs. Call underwrite_property for a full annual schedule.",
    inputSchema: portfolioSchema,
    outputSchema: portfolioOutput,
    annotations,
    _meta: { securitySchemes: [{ type: "noauth" }] },
  }, async ({ assets: inputs, stress }) => {
    try {
      const assets = inputs.map(({ id, input }) => {
        const baseline = metrics(evaluateInvestment(input));
        const stressedInput = applyStress(input, stress);
        const result = evaluateInvestment(stressedInput);
        const downside = metrics(result);
        return {
          id, horizonYears: input.horizonYears, stressedInput, baseline, downside,
          yearOneCashFlowDelta: downside.yearOneCashFlow - baseline.yearOneCashFlow,
          npvDelta: downside.npv - baseline.npv,
          assumptions: result.assumptions,
        };
      });
      const baseline = totals(assets.map((asset) => asset.baseline));
      const downside = totals(assets.map((asset) => asset.downside));
      return resultContent(portfolioOutput.parse({
        calculationBasis: "user_supplied_assumptions", currency: "EUR", model: "nominal_pre_tax", stress, assets,
        portfolio: {
          baseline, downside,
          yearOneCashFlowDelta: downside.yearOneCashFlow - baseline.yearOneCashFlow,
          additionalInitialEquity: downside.initialEquity - baseline.initialEquity,
        },
        interpretation: "Portfolio totals cover initial equity and year one only. Asset horizons and discount rates remain separate; IRRs are not averaged. Vacancy is capped at 100%; stressedInput shows the assumptions actually evaluated. Null ratios are undefined, not zero. No tax, lender covenant or market-value conclusion is implied.",
      }));
    } catch {
      return calculationError();
    }
  });

  return server;
}

class RequestBoundaryError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) throw new RequestBoundaryError(400, "Invalid Content-Length.");
    if (Number(declaredLength) > PRINCIPAL_MCP_MAX_BYTES) throw new RequestBoundaryError(413, "Request body exceeds 32 KiB.");
  }
  const encoding = request.headers.get("content-encoding");
  if (encoding && encoding !== "identity") throw new RequestBoundaryError(415, "Compressed request bodies are not supported.");
  if (!request.body) throw new RequestBoundaryError(400, "A JSON-RPC request body is required.");

  const reader = request.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const bytes = await Promise.race([
      (async () => {
        const chunks: Uint8Array[] = [];
        let length = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > PRINCIPAL_MCP_MAX_BYTES) throw new RequestBoundaryError(413, "Request body exceeds 32 KiB.");
          chunks.push(value);
        }
        const body = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
        return body;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new RequestBoundaryError(408, "Request body timed out.")), BODY_TIMEOUT_MS);
      }),
    ]);
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new RequestBoundaryError(400, "Invalid JSON."); }
    // One operation per request bounds synchronous computation and avoids duplicate batch IDs.
    if (Array.isArray(parsed)) throw new RequestBoundaryError(400, "Send one JSON-RPC message per request.");
    return parsed;
  } finally {
    clearTimeout(timer);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function boundaryResponse(status: number, message: string) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: status === 500 ? -32603 : -32600, message } }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

/** Streamable HTTP in JSON response mode; every request has a new server and transport. */
export async function handlePrincipalMcp(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const sameOrigin = new URL(request.url).origin;
  if (origin && ![sameOrigin, "https://chatgpt.com", "https://www.chatgpt.com"].includes(origin)) {
    return boundaryResponse(403, "Origin is not allowed.");
  }

  // This input-only service never emits server notifications, so it exposes no GET SSE stream.
  // MCP permits 405 for servers that do not offer a standalone stream.
  if (request.method === "GET" || request.method === "HEAD") {
    const response = boundaryResponse(405, "Use POST for the MCP calculation endpoint.");
    response.headers.set("Allow", "POST, DELETE, OPTIONS");
    return response;
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      "Allow": "POST, DELETE, OPTIONS",
      "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, MCP-Protocol-Version, MCP-Session-Id",
      ...(origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}),
      "Cache-Control": "no-store",
    } });
  }

  let server: McpServer | undefined;
  try {
    const parsedBody = request.method === "POST" ? await readBoundedJson(request) : undefined;
    server = createPrincipalMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    // Initialization, version negotiation, schemas, notifications, and unsupported methods use the SDK.
    const response = await transport.handleRequest(request, { parsedBody });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    if (origin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Vary", "Origin");
    }
    return response;
  } catch (error) {
    return error instanceof RequestBoundaryError
      ? boundaryResponse(error.status, error.message)
      : boundaryResponse(500, "The calculation service could not process this request.");
  } finally {
    // JSON responses are complete when handleRequest resolves. Nothing is kept across users.
    await server?.close().catch(() => undefined);
  }
}
