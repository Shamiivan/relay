import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  getTool,
} from "../tools/_generated/registry";
import {
  isWorkflowDeclaration,
  type WorkflowDeclaration,
} from "./sdk";

const repoRoot = process.cwd();
const workflowsRoot = path.join(repoRoot, "workflows");
const generatedDir = path.join(workflowsRoot, "_generated");

type GeneratedWorkflowSource = {
  declaration: WorkflowDeclaration;
  exportName: string;
  declarationImportPath: string;
  prompt: string;
};

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join("");
}

async function exists(filePath: string): Promise<boolean> {
  return await fs.access(filePath).then(() => true).catch(() => false);
}

async function findWorkflowDeclarations(rootDir: string): Promise<string[]> {
  if (!(await exists(rootDir))) {
    return [];
  }

  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const declarationFiles: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "_generated") {
      continue;
    }

    const workflowPath = path.join(rootDir, entry.name, "workflow.ts");
    if (await exists(workflowPath)) {
      declarationFiles.push(workflowPath);
    }
  }

  return declarationFiles;
}

async function loadDeclaredWorkflow(workflowPath: string): Promise<GeneratedWorkflowSource> {
  const moduleUrl = pathToFileURL(workflowPath).href;
  const loaded = await import(moduleUrl);
  const declarationEntry = Object.entries(loaded).find(([, value]) => isWorkflowDeclaration(value));
  if (!declarationEntry) {
    throw new Error(`No workflow declaration export found in ${toPosixPath(path.relative(repoRoot, workflowPath))}`);
  }

  const [exportName, declaration] = declarationEntry as [string, WorkflowDeclaration];
  const directory = path.dirname(workflowPath);
  const promptTexts = await Promise.all(
    declaration.prompt.files.map(async (promptFile) => {
      const promptPath = path.resolve(directory, promptFile);
      if (!(await exists(promptPath))) {
        throw new Error(
          `Workflow ${declaration.name} references missing prompt file ${toPosixPath(path.relative(repoRoot, promptPath))}`,
        );
      }

      return (await fs.readFile(promptPath, "utf8")).trim();
    }),
  );

  for (const toolName of declaration.tools) {
    if (!getTool(toolName)) {
      throw new Error(
        `Workflow ${declaration.name} references unknown tool ${toolName}`,
      );
    }
  }

  const stepNames = Object.keys(declaration.steps);
  if (!stepNames.includes(declaration.initialStep)) {
    throw new Error(`Workflow ${declaration.name} initialStep ${declaration.initialStep} is not declared in steps`);
  }

  return {
    declaration,
    exportName,
    declarationImportPath: toPosixPath(path.relative(generatedDir, workflowPath)).replace(/\.ts$/, ""),
    prompt: promptTexts.filter(Boolean).join("\n\n").trim(),
  };
}

function buildRegistryFile(workflows: GeneratedWorkflowSource[]): string {
  const imports = workflows.map((workflow) =>
    `import { ${workflow.exportName} } from "${workflow.declarationImportPath}";`
  );
  const registryEntries = workflows.map((workflow) =>
    `  ${JSON.stringify(workflow.declaration.name)}: ${workflow.exportName},`
  );
  const promptEntries = workflows.map((workflow) =>
    `  ${JSON.stringify(workflow.declaration.name)}: ${JSON.stringify(workflow.prompt)},`
  );

  return `${imports.join("\n")}

export const workflowRegistry = {
${registryEntries.join("\n")}
} as const;

export const workflowPrompts = {
${promptEntries.join("\n")}
} as const satisfies Record<keyof typeof workflowRegistry, string>;

export const workflowNames = Object.freeze(
  Object.keys(workflowRegistry),
) as readonly (keyof typeof workflowRegistry)[];

export type WorkflowName = keyof typeof workflowRegistry;

export function getWorkflow(name: string) {
  return workflowRegistry[name as WorkflowName];
}

export function getWorkflowPrompt(name: string): string {
  return workflowPrompts[name as WorkflowName] ?? "";
}
`;
}

function buildTypesFile(workflows: GeneratedWorkflowSource[]): string {
  const imports = workflows.map((workflow) =>
    `import { ${workflow.exportName} } from "${workflow.declarationImportPath}";`
  );
  const typeEntries = workflows.map((workflow) => {
    const baseName = toPascalCase(workflow.declaration.name);
    return `export type ${baseName}WorkflowState = InferWorkflowState<typeof ${workflow.exportName}>;
export type ${baseName}WorkflowStepName = InferWorkflowStepName<typeof ${workflow.exportName}>;`;
  });

  return `import type { InferWorkflowState, InferWorkflowStepName } from "../sdk";
import { workflowNames } from "./registry";
${imports.join("\n")}

export type WorkflowName = (typeof workflowNames)[number];
${typeEntries.join("\n")}
`;
}

async function main(): Promise<void> {
  const workflowPaths = await findWorkflowDeclarations(workflowsRoot);
  const workflows = await Promise.all(workflowPaths.map(loadDeclaredWorkflow));
  workflows.sort((left, right) => left.declaration.name.localeCompare(right.declaration.name));

  await fs.mkdir(generatedDir, { recursive: true });
  await fs.writeFile(path.join(generatedDir, "registry.ts"), buildRegistryFile(workflows), "utf8");
  await fs.writeFile(path.join(generatedDir, "types.ts"), buildTypesFile(workflows), "utf8");
}

void main();
