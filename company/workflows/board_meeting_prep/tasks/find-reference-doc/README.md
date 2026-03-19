---
intent: find_reference_doc
description: Prepare the next Drive search for board-meeting reference documents
fields:
  userRequest: "string: The user request to interpret"
---
Given the user's request, prepare a board-meeting-specific Drive search plan.

This task does not call Google APIs. It prepares the next Drive search by choosing a reasonable query, max result count, and search rationale.

Output: query (string), maxResults (number), rationale (string)

Prefer broad board-related queries first when the user has not named a specific document.
