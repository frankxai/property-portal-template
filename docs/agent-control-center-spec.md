# Agent Control Center Spec

## Job

Give an owner one place to assign bounded work, understand what agents may do, see whether runtime proof is durable, and judge the system against outcomes rather than automation theater.

## Primary User Flow

1. Owner opens `/admin/control-center` through owner auth.
2. Owner chooses one specialist and one property scope.
3. Owner states one objective and one measurable success condition.
4. Portal records a draft-only mission, audit event, persistence receipt, and owner notification receipt.
5. Specialist observes approved facts and produces a bounded artifact.
6. Independent review checks privacy, compliance, facts, and visual quality as applicable.
7. Owner approves, rejects, requests changes, or stops.
8. Any controlled internal transition requires an exact server receipt and ends with audit plus undo evidence.

## Page Hierarchy

- runtime and authority posture
- specialist, mission, proof, and unsafe-action metrics
- compact mission composer
- authority boundary and blocked actions
- six-state lifecycle
- specialist mandates and expected proof
- owner, renter, property, support, partner, and platform scorecard

## State Contract

- `planned`: mission exists; no work or commitment implied
- `grounding`: assigned facts and evidence are being inspected
- `drafting`: artifact is in progress and remains non-authoritative
- `owner-review`: decision requested with risks and missing evidence
- `verified`: accepted artifact and outcome evidence recorded
- `stopped`: owner or policy ended the mission

## Failure Behavior

- A failed runtime write returns `503`; no owner notification or downstream work starts.
- Missing property scope, objective, or success metric returns `400`.
- Unauthenticated API access is denied.
- Notification failure is visible and keeps manual owner review active.
- Database mode without the v0.2 schema is unhealthy, not silently downgraded to demo storage.

## Quality Bar

The surface is a quiet operating console: compact headings, predictable tables, clear status, restrained color, no decorative filler, stable responsive layout, and no implication that queued work has executed. Desktop and mobile screenshots must show no overlap or horizontal page overflow.

## Production Boundary

Mission creation is implemented against demo memory and tenant-scoped Postgres. The transition tables are substrate only until the MCP receipt lifecycle is implemented transactionally in production storage and tested under concurrency. No external action is enabled by this route.
