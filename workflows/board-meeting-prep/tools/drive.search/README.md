---
intent: drive.search
description: Search Google Drive for board-meeting-related folders and documents
fields:
  query: "string: The Google Drive query to execute"
  maxResults: "number: Maximum files to return"
---
Search Google Drive using a query string. Returns a list of matching files with metadata including id, name, mimeType, webViewLink, parents, modifiedTime, driveId, and owners.
