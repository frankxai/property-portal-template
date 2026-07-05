# Product Roadmap

## Phase 0: Template That Works

Goal: a landlord or agency can clone the portal, edit approved property content, run validation, and show a premium renter-facing experience without live integrations.

Success:

- property page renders from approved data
- renter portal answers approved facts
- inquiry and support forms return owner approval routes
- listing drafts show missing facts and manual/API publication mode
- setup, integrations, and agent-run admin views exist
- validation, typecheck, build, and smoke checks pass

## Phase 1: Brother Private Install

Goal: the private install becomes useful for one real owner before productizing.

Success:

- one real property profile is approved
- first property media rights are known
- renter FAQ covers recurring questions
- urgent escalation path is documented privately
- owner can review inquiry/support drafts weekly
- own-site and Kleinanzeigen listing drafts are manually publishable

## Phase 2: Hosted Self-Service Product

Goal: a house owner or boutique agency can sign up and run their own workspace.

Required modules:

- organization and member model
- owner onboarding wizard
- secure runtime database
- media and document storage
- email notifications
- weekly owner digest
- approval queue
- audit log
- billing for software subscription

## Phase 3: Agency Mode

Goal: agencies can manage multiple owners and properties without losing governance.

Required modules:

- multi-owner portfolio dashboard
- white-label domain settings
- role-based permissions
- reusable property templates
- channel publication queue
- team assignment and SLA views
- exportable owner reports

## Phase 4: Approved Integrations

Goal: reduce manual work only where official access and rollback are proven.

Promotion order:

1. Resend email notifications.
2. Supabase or Neon runtime database.
3. Vercel Blob or Supabase Storage for media.
4. Cal.com viewing and handover scheduling.
5. EstateSync dry-run publishing.
6. ImmoScout24 API dry-run publishing.
7. WhatsApp with consent and templates.
8. Stripe subscriptions for SaaS billing.
9. Document signing after legal review.

## Product Guardrail

The best version of the product is not fully autonomous first. It is the most trusted owner-controlled system: fast drafts, premium portals, fewer repeated questions, and visible approval discipline.
