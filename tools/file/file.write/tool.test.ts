import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { FileToolError } from "../lib.ts";
import { writeWorkspaceFile } from "./tool.ts";

test("writeWorkspaceFile creates a new file and parent directories", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-write-"));
  const result = await writeWorkspaceFile({
    path: "artifacts/run-1/offer.md",
    content: "# Offer\n",
    mode: "create",
  }, { workspaceRoot });

  assert.equal(result.created, true);
  assert.equal(result.path, "artifacts/run-1/offer.md");
  assert.equal(result.diff, undefined);
  assert.equal(await readFile(path.join(workspaceRoot, "artifacts/run-1/offer.md"), "utf8"), "# Offer\n");
});

test("writeWorkspaceFile returns a unified diff when replacing an existing file", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-write-"));
  const filePath = path.join(workspaceRoot, "artifacts/offer.md");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, "hello\nold line\n");

  const result = await writeWorkspaceFile({
    path: "artifacts/offer.md",
    content: "hello\nnew line\n",
    mode: "overwrite",
  }, { workspaceRoot });

  assert.equal(result.created, false);
  assert.match(result.diff ?? "", /^--- artifacts\/offer\.md/m);
  assert.match(result.diff ?? "", /-old line/);
  assert.match(result.diff ?? "", /\+new line/);
});

test("writeWorkspaceFile enforces create and overwrite modes", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-write-"));
  const filePath = path.join(workspaceRoot, "artifacts/offer.md");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, "hello\n");

  await assert.rejects(
    writeWorkspaceFile({
      path: "artifacts/offer.md",
      content: "updated\n",
      mode: "create",
    }, { workspaceRoot }),
    (error: unknown) => error instanceof FileToolError && error.type === "already_exists",
  );

  await assert.rejects(
    writeWorkspaceFile({
      path: "artifacts/missing.md",
      content: "updated\n",
      mode: "overwrite",
    }, { workspaceRoot }),
    (error: unknown) => error instanceof FileToolError && error.type === "not_found",
  );
});

test("writeWorkspaceFile rejects paths outside the workspace root", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-write-"));

  await assert.rejects(
    writeWorkspaceFile({
      path: "../outside.md",
      content: "nope",
      mode: "upsert",
    }, { workspaceRoot }),
    (error: unknown) => error instanceof FileToolError && error.type === "path_not_allowed",
  );
});

test("writeWorkspaceFile rejects binary content", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-write-"));

  await assert.rejects(
    writeWorkspaceFile({
      path: "artifacts/binary.txt",
      content: "hello\u0000world",
      mode: "upsert",
    }, { workspaceRoot }),
    (error: unknown) => error instanceof FileToolError && error.type === "binary_not_supported",
  );
});

test("writeWorkspaceFile maps injected filesystem permission errors explicitly", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-write-"));

  await assert.rejects(
    writeWorkspaceFile({
      path: "artifacts/protected.md",
      content: "blocked",
      mode: "upsert",
    }, {
      workspaceRoot,
      writeFileAtomicallyImpl: async () => {
        const error = new Error("permission denied");
        Object.assign(error, { code: "EACCES" });
        throw error;
      },
    }),
    (error: unknown) => error instanceof FileToolError && error.type === "permission_denied",
  );
});
