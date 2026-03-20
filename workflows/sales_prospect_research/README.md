# Sales Prospect Research

Use `sales_prospect_research` for sales prospect discovery, account research, and outbound campaign operations.

Available tool groups:
- Web research: `web.search`, `web.fetch`
- Apollo discovery and enrichment: `apollo.search_companies`, `apollo.search_people`, `apollo.organization.search`, `apollo.organization.show`, `apollo.organization.enrich`, `apollo.organization.bulkEnrich`, `apollo.organization.jobPostings`, `apollo.organization.topPeople`, `apollo.person.show`, `apollo.person.match`, `apollo.person.bulkMatch`, `apollo.report.sync`
- Apollo mutations: `apollo.contact.bulkCreate`, `apollo.contact.bulkUpdate`, `apollo.account.bulkCreate`, `apollo.field.create`
- Instantly discovery and reads: `instantly.account.search`, `instantly.campaign.search`, `instantly.campaign.get`, `instantly.campaign.searchByContact`, `instantly.campaign.countLaunched`, `instantly.campaign.sendingStatus`, `instantly.email.search`, `instantly.campaign.export`
- Instantly mutations: `instantly.campaign.create`, `instantly.campaign.update`, `instantly.campaign.activate`, `instantly.campaign.pause`, `instantly.campaign.delete`, `instantly.campaign.duplicate`, `instantly.campaign.share`, `instantly.campaign.fromExport`, `instantly.campaign.variables.add`, `instantly.lead.add`
- Workspace file tools: `file.write`, `file.update`

Use this workflow only for sales-specific work such as prospecting, account research, CRM sync, and campaign prep.
Do not use it for generic public-web fact-finding when the user only needs information and no sales systems are involved.
