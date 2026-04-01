import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { uploadWorkspacePathToDrive } from "./tool.ts";

function createFakeClient() {
  const calls: Record<string, unknown>[] = [];
  let nextId = 1;

  return {
    calls,
    client: {
      files: {
        async create(args: Record<string, unknown>) {
          calls.push(args);
          const requestBody = (args.requestBody ?? {}) as Record<string, unknown>;
          const name = typeof requestBody.name === "string" ? requestBody.name : `item-${nextId}`;
          const mimeType = typeof requestBody.mimeType === "string"
            ? requestBody.mimeType
            : "application/octet-stream";
          const parents = Array.isArray(requestBody.parents)
            ? requestBody.parents.filter((value): value is string => typeof value === "string")
            : [];

          return {
            data: {
              id: `id-${nextId++}`,
              name,
              mimeType,
              webViewLink: `https://drive.test/${name}`,
              parents,
              modifiedTime: "2026-03-31T00:00:00.000Z",
              driveId: "",
              owners: [],
            },
          };
        },
      },
    },
  };
}

test("uploadWorkspacePathToDrive uploads one local file", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-drive-upload-"));
  const filePath = path.join(workspaceRoot, "artifacts", "notes.txt");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, "hello drive\n", "utf8");
  const fake = createFakeClient();

  const result = await uploadWorkspacePathToDrive({
    localPath: "artifacts/notes.txt",
    parentId: "drive-parent",
    mimeType: "text/plain",
  }, {
    workspaceRoot,
    client: fake.client,
  });

  assert.equal(result.kind, "file");
  assert.equal(result.localPath, "artifacts/notes.txt");
  assert.equal(result.uploadedFiles, 1);
  assert.equal(result.createdFolders, 0);
  assert.equal(result.root.name, "notes.txt");
  assert.equal(fake.calls.length, 1);
  const firstCall = fake.calls[0] ?? {};
  assert.deepEqual((firstCall.requestBody as Record<string, unknown>).parents, ["drive-parent"]);
  assert.equal((firstCall.media as Record<string, unknown>).mimeType, "text/plain");
});

test("uploadWorkspacePathToDrive uploads folders recursively", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-drive-upload-"));
  await mkdir(path.join(workspaceRoot, "bundle", "nested"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "bundle", "root.txt"), "root\n", "utf8");
  await writeFile(path.join(workspaceRoot, "bundle", "nested", "child.txt"), "child\n", "utf8");
  const fake = createFakeClient();

  const result = await uploadWorkspacePathToDrive({
    localPath: "bundle",
    parentId: "drive-parent",
  }, {
    workspaceRoot,
    client: fake.client,
  });

  assert.equal(result.kind, "folder");
  assert.equal(result.root.name, "bundle");
  assert.equal(result.createdFolders, 2);
  assert.equal(result.uploadedFiles, 2);
  assert.equal(fake.calls.length, 4);
  assert.equal(((fake.calls[0] ?? {}).requestBody as Record<string, unknown>).mimeType, "application/vnd.google-apps.folder");
  assert.equal(((fake.calls[1] ?? {}).requestBody as Record<string, unknown>).mimeType, "application/vnd.google-apps.folder");
});

test("uploadWorkspacePathToDrive rejects paths outside the workspace", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-drive-upload-"));
  const fake = createFakeClient();

  await assert.rejects(
    uploadWorkspacePathToDrive({
      localPath: "../outside.txt",
    }, {
      workspaceRoot,
      client: fake.client,
    }),
    (error: unknown) => error instanceof Error && "type" in error && error.type === "path_not_allowed",
  );
});
