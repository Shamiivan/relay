---
intent: web.fetch-llm
description: Search the web and retrieve pre-ranked content chunks via Brave LLM Context API
fields:
  query: "string: The search query to fetch web content for"
  count: "number: Maximum number of URLs to retrieve content from, from 1 to 20 (default 5)"
---
Search the web and return pre-ranked content chunks in one call. Combines search and page extraction. Use this when you need content from multiple sources without separate fetch calls.

## Examples

```bash
printf '{"query":"relay agent orchestration","count":5}' | workflows/public_web_search/tools/web.fetch-llm/run
printf '{"query":"open source LLM frameworks 2024","count":3}' | workflows/public_web_search/tools/web.fetch-llm/run
```
