---
intent: time.now
description: Get the current date and time
fields: {}
---
Returns the current time. Takes no input — call it to know today's date before searching or referencing documents.

## Usage

```
workflows/board_meeting_prep/tools/time.now/run
```

## Output

```json
{
  "iso": "2026-03-18T14:30:00.000Z",
  "local": "3/18/2026, 2:30:00 PM",
  "timestamp": 1742308200000
}
```

Always call this first when the user refers to "today", "last week", "next meeting", or any relative date.
