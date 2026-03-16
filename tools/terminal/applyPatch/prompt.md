Use `terminal.applyPatch` to create, modify, or delete files.

**Always read files with `terminal.bash` before patching.**

Patch format:
```
*** Begin Patch
*** Add File: path/to/new/file.ts
+line one
+line two
*** Update File: path/to/existing.ts
@@ context hint (a nearby unchanged line)
 context line
 context line
 context line
-old line to remove
+new line to add
 context line
 context line
 context line
*** Delete File: path/to/remove.ts
*** End Patch
```

Rules:
- Paths must be **relative** (never absolute)
- Include **3 lines of context** above and below each change
- Use `*** Move to: new/path.ts` after `*** Update File:` to rename
- The `@@ hint` line anchors the position in the file
