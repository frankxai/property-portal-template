# Security Policy

This portal template is public-safe demo software. It must not contain real renter data, secrets, private access details, exact unapproved addresses, payment records, identity documents, or private owner financials.

## Supported Version

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Reporting

Do not open public issues for secrets, data exposure, auth bypasses, unsafe workflow behavior, or privacy incidents. Use a private GitHub security advisory or the private client channel for the production install.

## Production Requirements

Before using the portal with real renters, add:

- authenticated owner and renter sessions
- secure database adapter
- email or messaging adapter with owner approval
- encrypted object storage for documents
- audit log and retention policy
- monitoring, backup, and incident process
- legal review for local rental obligations

The demo runtime intentionally requires owner approval for inquiries, support, listing dry-runs, and agent outputs.
