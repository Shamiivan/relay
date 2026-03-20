# Sales Prospect Research

Workflow for sales prospect discovery, account research, and outreach preparation.

Current tools:
- `web.search` for public web research
- `apollo.search_companies` for ICP-matched account discovery
- `apollo.search_people` for prospect discovery inside known target accounts
- `apollo.organization.search` for native Apollo organization search
- `apollo.organization.topPeople` for top contacts on known accounts
- `apollo.organization.jobPostings` for hiring-signal research
- `apollo.person.show` for single-person reads
- `apollo.person.match` for person resolution
- `apollo.person.bulkMatch` for batch person resolution
- `apollo.organization.show` for single-account reads
- `apollo.organization.enrich` for single-account enrichment
- `apollo.organization.bulkEnrich` for batch account enrichment
- `apollo.contact.bulkCreate` for contact sync into Apollo
- `apollo.contact.bulkUpdate` for contact updates in Apollo
- `apollo.account.bulkCreate` for account sync into Apollo
- `apollo.report.sync` for report sync operations
- `apollo.field.create` for Apollo custom field creation
- `instantly.account.search` for listing Instantly sending accounts
- `instantly.campaign.search` for listing existing Instantly campaigns
- `instantly.campaign.get`, `create`, `update`, `activate`, `pause`, and `delete` for campaign lifecycle control
- `instantly.campaign.duplicate`, `share`, `export`, and `fromExport` for campaign copy/share flows
- `instantly.campaign.variables.add`, `searchByContact`, `countLaunched`, and `sendingStatus` for campaign inspection and enrichment
- `instantly.email.search` for listing Instantly email activity
- `instantly.lead.add` for creating leads inside Instantly

Use this workflow only for sales-specific work such as prospecting, account research, campaign prep, and outbound messaging support.
Do not use it for generic web research when the user just wants information from the public web.
