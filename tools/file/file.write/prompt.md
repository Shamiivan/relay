Write a local file inside the current workspace.

Use this to create a new file, replace an existing file, or upsert a workflow artifact.

- `create` fails if the file already exists
- `overwrite` fails if the file does not exist
- `upsert` creates or replaces depending on current state
- paths must stay inside the workspace root
- binary content is not supported
