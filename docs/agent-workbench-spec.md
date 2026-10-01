# Governed Agent Workbench Spec

## Job

Let an authenticated owner move one bounded property task from mission to approved evidence, structured draft, and recorded review without opening an API client or implying that a draft was sent, published, or applied.

## Audience

Independent property owners, boutique agencies, and implementation partners operating a tenant-scoped Property Intelligence OS installation.

## First Read

- the MCP and model posture is visible before action
- the current stage and required next action are obvious
- the draft is grounded in owner-approved evidence
- hashes, risk, model, latency, and token receipts remain inspectable
- accepting a draft records a decision only; it does not execute the content

## Primary Flow

1. Create one draft-only mission for one property and measurable outcome.
2. Record an exact evidence excerpt with a source type and version identifier.
3. Generate one structured artifact using only the recorded evidence reference.
4. Inspect summary, draft, missing facts, risks, citations, model receipt, and output hash.
5. Accept, request revision, or reject with optional feedback.
6. Keep application, publication, messaging, pricing, availability, lease, refund, repair, and vendor actions outside the run.

## Failure Contract

- When the MCP control plane is not fully configured, the workbench remains readable but all write actions are unavailable.
- A failed stage stays failed; the browser never fabricates a receipt or advances the workflow.
- Changing a mission clears evidence, draft, and review state.
- Changing approved evidence clears the draft and review state.
- Every API failure shows a safe correlation-aware message returned by the server.
- Private renter data, access secrets, payment data, legal commitments, and prompt-like instructions are never acceptable evidence.

## Layout

- compact runtime posture and four-stage rail
- mission and evidence controls in the left operating lane
- draft inspection and review in the right decision lane
- single-column mobile composition with the next available action first
- no nested cards, decorative illustration, oversized dashboard type, or invisible disabled state

## Acceptance

- owner auth protects the page and all four write APIs
- connected mode can complete the full four-tool MCP loop
- disconnected mode is fail-closed and has no local draft fallback
- `contentApplied` remains `false` and `externalActionsPerformed` remains empty after generation and review
- desktop 1440px and mobile 390px captures have no root overflow, clipped controls, or incoherent overlap
- `validate`, `typecheck`, `build`, smoke, auth boundary, and visual QA pass
