Use `terminal.bash` to run shell commands in the workspace.

Common uses:
- Read files: `cat src/utils.ts`
- List directories: `ls -la`
- Search code: `grep -r "pattern" src/` or `rg "pattern"`
- Run tests: `npx vitest run src/foo.test.ts`
- Git operations: `git status`, `git diff`
- Install / build: `pnpm install`, `pnpm build`

Always read files with `terminal.bash` before patching them.
Check exit code and stderr to detect failures.
