-- Public-safe sample seed for local production-mode smoke tests.
-- Replace every value before handling real owner or renter data.
-- Requires db/schema.sql. If db/rls.sql is already applied, run this with a privileged migration role.

insert into organizations (id, name, plan, country)
values ('sample-org', 'Sample Property Studio', 'pilot', 'Germany')
on conflict (id) do update
set name = excluded.name,
    plan = excluded.plan,
    country = excluded.country;

insert into organization_members (id, organization_id, email, role)
values ('sample-owner', 'sample-org', 'owner@example.com', 'owner')
on conflict (organization_id, email) do update
set role = excluded.role;

insert into properties (
  id,
  organization_id,
  slug,
  name,
  status,
  public_area,
  city,
  country,
  approved_public_facts,
  private_owner_notes
)
values (
  'sample-property-urban-haven',
  'sample-org',
  'urban-haven-sample',
  'Urban Haven Sample',
  'approved',
  'Central neighborhood sample area',
  'Berlin',
  'Germany',
  '{"bedrooms":2,"maxOccupancy":3,"amenities":["Fast Wi-Fi","Workspace","Washer"],"rules":["No smoking","Quiet hours after 22:00"]}'::jsonb,
  '{"note":"Sample data only. Replace before production."}'::jsonb
)
on conflict (organization_id, slug) do update
set name = excluded.name,
    status = excluded.status,
    public_area = excluded.public_area,
    city = excluded.city,
    country = excluded.country,
    approved_public_facts = excluded.approved_public_facts,
    private_owner_notes = excluded.private_owner_notes,
    updated_at = now();

insert into units (id, property_id, name, status, bedrooms, max_occupancy, public_pricing, private_pricing)
values (
  'sample-unit-main',
  'sample-property-urban-haven',
  'Main Sample Unit',
  'available',
  2,
  3,
  '{"display":"Owner-approved price only"}'::jsonb,
  '{"note":"Do not store real pricing here until owner approval."}'::jsonb
)
on conflict (id) do update
set status = excluded.status,
    bedrooms = excluded.bedrooms,
    max_occupancy = excluded.max_occupancy,
    public_pricing = excluded.public_pricing,
    private_pricing = excluded.private_pricing,
    updated_at = now();

