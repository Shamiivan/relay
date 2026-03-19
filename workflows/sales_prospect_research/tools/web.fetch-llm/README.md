---
intent: web.fetch-llm
description: Search the web and retrieve pre-ranked content chunks via Brave LLM Context API
fields:
  query: "string: The search query to fetch web content for"
  count: "number: Maximum number of URLs to retrieve content from, from 1 to 20 (default 5)"
---
Search the web and return pre-ranked content chunks in one call. Combines search and page extraction. Use this when you need content from multiple sources at once without separate fetch calls.

## Examples

```bash
printf '{"query":"B2B SaaS pricing strategies","count":5}' | workflows/sales_prospect_research/tools/web.fetch-llm/run
printf '{"query":"site:linkedin.com Acme Corp leadership team","count":3}' | workflows/sales_prospect_research/tools/web.fetch-llm/run
```
