---
intent: drive.copy
description: Copy the selected board-meeting reference document into the target folder
fields:
  fileId: "string: The source Drive file id to copy"
  name: "string: The name for the copied file"
  parentId: "string: Optional destination folder id"
---
Copy a file in Google Drive. Returns the new file's id, name, mimeType, and webViewLink.
