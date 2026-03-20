import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { FileToolError } from "../lib.ts";
import { updateWorkspaceFile } from "./tool.ts";

test("updateWorkspaceFile replaces exact text once and returns a diff", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-update-"));
  const filePath = path.join(workspaceRoot, "artifacts/offer.md");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, "hello\nold line\nbye\n");

  const result = await updateWorkspaceFile({
    path: "artifacts/offer.md",
    oldText: "old line",
    newText: "new line",
  }, { workspaceRoot });

  assert.equal(result.replaced, true);
  assert.match(result.diff, /-old line/);
  assert.match(result.diff, /\+new line/);
  assert.equal(await readFile(filePath, "utf8"), "hello\nnew line\nbye\n");
});

test("updateWorkspaceFile requires the file to exist", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-update-"));

  await assert.rejects(
    updateWorkspaceFile({
      path: "artifacts/missing.md",
      oldText: "old",
      newText: "new",
    }, { workspaceRoot }),
    (error: unknown) => error instanceof FileToolError && error.type === "not_found",
  );
});

test("updateWorkspaceFile fails when oldText is missing or ambiguous", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-update-"));
  const filePath = path.join(workspaceRoot, "artifacts/offer.md");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, "repeat\nrepeat\n");

  await assert.rejects(
    updateWorkspaceFile({
      path: "artifacts/offer.md",
      oldText: "missing",
      newText: "new",
    }, { workspaceRoot }),
    (error: unknown) => error instanceof FileToolError && error.type === "match_not_found",
  );

  await assert.rejects(
    updateWorkspaceFile({
      path: "artifacts/offer.md",
      oldText: "repeat",
      newText: "new",
    }, { workspaceRoot }),
    (error: unknown) => error instanceof FileToolError && error.type === "match_not_unique",
  );
});

test("updateWorkspaceFile rejects binary replacement content", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-update-"));
  const filePath = path.join(workspaceRoot, "artifacts/offer.md");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, "hello\n");

  await assert.rejects(
    updateWorkspaceFile({
      path: "artifacts/offer.md",
      oldText: "hello",
      newText: "hi\u0000there",
    }, { workspaceRoot }),
    (error: unknown) => error instanceof FileToolError && error.type === "binary_not_supported",
  );
});

test("updateWorkspaceFile reports no_change when replacement is identical", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-update-"));
  const filePath = path.join(workspaceRoot, "artifacts/offer.md");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, "hello\n");

  await assert.rejects(
    updateWorkspaceFile({
      path: "artifacts/offer.md",
      oldText: "hello",
      newText: "hello",
    }, { workspaceRoot }),
    (error: unknown) => error instanceof FileToolError && error.type === "no_change",
  );
});

test("updateWorkspaceFile maps injected filesystem permission errors explicitly", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-update-"));
  const filePath = path.join(workspaceRoot, "artifacts/offer.md");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, "hello\n");

  await assert.rejects(
    updateWorkspaceFile({
      path: "artifacts/offer.md",
      oldText: "hello",
      newText: "approved",
    }, {
      workspaceRoot,
      writeFileAtomicallyImpl: async () => {
        const error = new Error("permission denied");
        Object.assign(error, { code: "EPERM" });
        throw error;
      },
    }),
    (error: unknown) => error instanceof FileToolError && error.type === "permission_denied",
  );
});
