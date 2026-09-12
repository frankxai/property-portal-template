# Connect the calculation service to ChatGPT

The Principal workspace exposes a real MCP endpoint at `/api/mcp`. It calculates property underwriting and portfolio downside from numeric assumptions provided with each tool call, and supplies reusable owner-review procedures. It does not connect a ChatGPT account to the owner database, tenant records, documents, banking, or Kleinanzeigen. The owner portal's existing authentication remains separate.

## Add it in ChatGPT

Use the public HTTPS deployment's origin followed by `/api/mcp`. A Vercel URL behind deployment protection is not directly reachable by ChatGPT; use the deliberately published calculation service URL. An operator must verify that exact endpoint before sharing it.

1. In ChatGPT on the web, open **Settings → Security and login → Developer mode**.
2. Open **Plugins**, select the **plus** button and create a developer-mode connection named **Property Principal**.
3. Enter the deployed HTTPS `/api/mcp` endpoint. Select **No Authentication**: this connection only exposes input-based computation and public review procedures.
4. Review the three discovered tools below. Create a new conversation and select the connection from the Developer mode tools menu.
5. After a service update, refresh the connection's metadata and start a new conversation.

OpenAI currently documents developer mode for Pro, Plus, Business, Enterprise and Education accounts on the web. Actual availability also depends on account and workspace policy. This is a developer-mode connection, not a published directory listing or automatic installation into another person's account. Setup verified against the official documentation on 12 September 2026. [OpenAI developer mode](https://developers.openai.com/api/docs/guides/developer-mode), [Connect and test your plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt).

## What the tools do

| Tool | Input | Result |
| --- | --- | --- |
| `underwrite_property` | All acquisition, income, cost, financing and exit assumptions | Annual loan amortization, refinancing, cash flow, exit proceeds, equity IRR and NPV |
| `stress_property_portfolio` | 1–12 anonymous asset aliases with complete assumptions, plus four downside shocks | Per-asset baseline/downside metrics, first-year portfolio cash-flow change and additional initial equity |
| `get_property_review_playbook` | One domain: acquisition, ownership, tenancy or kleinanzeigen | Senior owner-review procedure, required evidence and dated primary reference links |

Amounts are in EUR. Percentage fields use percentage values: `3.8` means 3.8%. Vacancy, refinance and exit-cap-rate shocks add **percentage points**. Capex shock increases initial capex by a **relative percentage**; the extra cost is equity-funded. Vacancy is capped at 100%, with the actual stressed inputs returned. Stress that exceeds another supported model range is rejected.

All tools return structured results and an equivalent readable JSON result. Calculations are nominal and pre-tax, with the engine's assumptions included. Undefined ratios return `null`; portfolio IRRs are never averaged. The review playbooks include primary sources reviewed on 12 September 2026, not a live source lookup on each call. The tools do not certify market value, select a holding structure, apply German tax law to a specific case, or decide whether a landlord may take a legal action.

## First calculation

Select Property Principal and ask:

> Use underwrite_property with the explicit assumptions below. Show annual cash flow, debt at refinancing, exit proceeds, equity IRR and NPV. Explain what the model assumes. These figures are a fictional scenario, not my portfolio.

```json
{
  "purchasePrice": 1250000,
  "acquisitionCostPct": 10,
  "initialCapex": 95000,
  "monthlyColdRent": 8500,
  "vacancyPct": 5,
  "annualOperatingCosts": 9000,
  "annualMaintenanceReserve": 8000,
  "rentGrowthPct": 2,
  "costGrowthPct": 2,
  "loanAmount": 850000,
  "interestRatePct": 3.8,
  "amortizationYears": 30,
  "fixedRateYears": 5,
  "refinanceRatePct": 4.5,
  "horizonYears": 10,
  "exitCapRatePct": 5,
  "sellingCostPct": 3,
  "discountRatePct": 8
}
```

Follow with:

> Use stress_property_portfolio for this scenario as asset-01: add 5 percentage points of vacancy, 2 points to refinancing, 20% to initial capex and 1 point to the exit capitalization rate. Compare cash flow, required equity and exit proceeds. Then use underwrite_property with the returned stressedInput for the full downside schedule.

Ask ChatGPT to request missing assumptions before making a call. A request such as “read my tenants” or “find listings on Kleinanzeigen” must not be routed to either calculator.

For the reusable review procedure, ask: “Use get_property_review_playbook for ownership. Build an evidence request for comparing private ownership, a property company and a holding with subsidiaries. Keep existing-asset transfer costs and a new acquisition separate.” The tool returns a procedure and reference links; it does not assume either structure is suitable.

## Data and deployment boundary

The MCP handler does not persist inputs or outputs, read application data, fetch URLs, issue messages, or call a model API. Numeric assumptions supplied from ChatGPT are transmitted to this service to calculate a response; this is not a calculation confined to the browser. ChatGPT conversation handling and hosting infrastructure remain subject to their own policies. Do not supply personal identifiers, addresses or account details in asset aliases.

The implementation uses the official MCP TypeScript SDK with a fresh stateless server and Web Standards Streamable HTTP transport per request. JSON response mode supports initialization, tool discovery and calls without shared sessions. GET returns 405 because the service emits no server-initiated notifications. It limits requests to 32 KiB, one JSON-RPC message per request, 12 assets and validated numeric model ranges. Responses are not cached, and calculation failures do not reveal internal exception details.

No application API key, owner passcode or database connection is required for these three tools. Ordinary hosting resource limits still apply. Tenant/admin access, persistence and external integrations require their own authenticated system; enabling this endpoint does not activate those integrations.

## Verification

Build the app, then run the official SDK client against the built Next.js route:

```sh
npm run build
node scripts/principal-mcp-smoke.mjs
```

The script starts and stops an isolated local production server. To check the exact public deployment, set `PRINCIPAL_MCP_URL` to its complete HTTPS `/api/mcp` URL and run the script. It verifies initialize → list → call, annotations, strict schemas, deterministic concurrent client results, finite numeric output, 12-asset scenarios, invalid arguments, unsupported methods and oversized streamed bodies.

Protocol tests establish endpoint compatibility. The final account-level test is to connect it in the recipient's ChatGPT account, inspect discovered tools and run the two sample prompts. A successfully deployed endpoint alone does not prove that his workspace permits developer-mode connections.
