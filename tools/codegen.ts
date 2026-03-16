import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  isToolDeclaration,
  toolCapabilityValues,
  toolUpdateModeValues,
  type ToolDeclaration,
  type ToolManifest,
} from "./sdk";

const repoRoot = process.cwd();
const generatedDir = path.join(repoRoot, "tools/_generated");

const legacySchemaSchema = z.object({
  resource: z.string().min(1),
  capability: z.enum(toolCapabilityValues),
  description: z.string().min(1),
  destructive: z.boolean().optional(),
  idempotent: z.boolean().optional(),
  updateMode: z.enum(toolUpdateModeValues).optional(),
  parameters: z.record(z.string(), z.unknown()),
});

type GeneratedToolSource = {
  manifest: ToolManifest;
  declarationImportPath?: string;
  declarationExportName?: string;
};

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function escapeText(value: string): string {
  return JSON.stringify(value);
}

async function exists(filePath: string): Promise<boolean> {
  return await fs.access(filePath).then(() => true).catch(() => false);
}

async function findToolDirectories(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const directories: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const entryPath = path.join(rootDir, entry.name);
    const runPath = path.join(entryPath, "run.ts");
    const schemaPath = path.join(entryPath, "schema.json");
    const declarationPath = path.join(entryPath, "tool.ts");
    if (await exists(declarationPath)) {
      directories.push(entryPath);
      continue;
    }

    if (await exists(runPath) && await exists(schemaPath)) {
      directories.push(entryPath);
      continue;
    }

    directories.push(...(await findToolDirectories(entryPath)));
  }

  return directories;
}

async function loadDeclaredTool(directory: string): Promise<GeneratedToolSource | null> {
  const declarationPath = path.join(directory, "tool.ts");
  if (!(await exists(declarationPath))) {
    return null;
  }

  const moduleUrl = pathToFileURL(declarationPath).href;
  const loaded = await import(moduleUrl);
  const declarationEntry = Object.entries(loaded).find(([, value]) => isToolDeclaration(value));
  if (!declarationEntry) {
    throw new Error(`No tool declaration export found in ${toPosixPath(path.relative(repoRoot, declarationPath))}`);
  }

  const [exportName, declaration] = declarationEntry as [string, ToolDeclaration];
  const promptTexts = await Promise.all(
    declaration.prompt.files.map(async (promptFile) => {
      const promptPath = path.resolve(directory, promptFile);
      if (!(await exists(promptPath))) {
        throw new Error(
          `Tool ${declaration.name} references missing prompt file ${toPosixPath(path.relative(repoRoot, promptPath))}`,
        );
      }

      return (await fs.readFile(promptPath, "utf8")).trim();
    }),
  );

  const manifest: ToolManifest = {
    name: declaration.name,
    resource: declaration.resource,
    capability: declaration.capability,
    description: declaration.description,
    destructive: declaration.destructive,
    idempotent: declaration.idempotent,
    updateMode: declaration.updateMode,
    parameters: z.toJSONSchema(declaration.input, { io: "input" }),
    command: ["pnpm", "tsx", toPosixPath(path.relative(repoRoot, declarationPath))],
    prompt: promptTexts.filter(Boolean).join("\n\n").trim(),
  };

  return {
    manifest,
    declarationImportPath: toPosixPath(path.relative(generatedDir, declarationPath)).replace(/\.ts$/, ""),
    declarationExportName: exportName,
  };
}

async function loadLegacyTool(directory: string): Promise<GeneratedToolSource> {
  const schemaPath = path.join(directory, "schema.json");
  const promptPath = path.join(directory, "prompt.md");
  const rawSchema = await fs.readFile(schemaPath, "utf8");
  const schema = legacySchemaSchema.parse(JSON.parse(rawSchema));
  const prompt = (await exists(promptPath))
    ? (await fs.readFile(promptPath, "utf8")).trim()
    : "";

  return {
    manifest: {
      name: path.basename(directory),
      resource: schema.resource,
      capability: schema.capability,
      description: schema.description,
      destructive: schema.destructive,
      idempotent: schema.idempotent,
      updateMode: schema.updateMode,
      parameters: schema.parameters,
      command: ["pnpm", "tsx", toPosixPath(path.relative(repoRoot, path.join(directory, "run.ts")))],
      prompt,
    },
  };
}

function sortTools(tools: GeneratedToolSource[]): GeneratedToolSource[] {
  return [...tools].sort((left, right) => {
    const resourceOrder = left.manifest.resource.localeCompare(right.manifest.resource);
    if (resourceOrder !== 0) {
      return resourceOrder;
    }

    const capabilityOrder = left.manifest.capability.localeCompare(right.manifest.capability);
    if (capabilityOrder !== 0) {
      return capabilityOrder;
    }

    return left.manifest.name.localeCompare(right.manifest.name);
  });
}

function buildRegistryFile(tools: GeneratedToolSource[]): string {
  const imports = [
    'import type { ToolManifest } from "../sdk";',
    ...tools
      .filter((tool) => tool.declarationImportPath && tool.declarationExportName)
      .map(
        (tool) => `import { ${tool.declarationExportName} } from "${tool.declarationImportPath}";`,
      ),
  ];

  const manifests = tools.map((tool) => {
    const manifest = JSON.stringify(tool.manifest, null, 2);
    return tool.declarationExportName
      ? `  ${tool.manifest.name.replace(/\W/g, "_")}: ${manifest},`
      : `  ${tool.manifest.name.replace(/\W/g, "_")}: ${manifest},`;
  });

  const toolEntries = tools.map((tool) => `  ${JSON.stringify(tool.manifest.name)}: manifests.${tool.manifest.name.replace(/\W/g, "_")},`);
  const declaredToolEntries = tools
    .filter((tool) => tool.declarationExportName)
    .map((tool) => `  ${JSON.stringify(tool.manifest.name)}: ${tool.declarationExportName},`);

  return `${imports.join("\n")}

const manifests = {
${manifests.join("\n")}
} as const satisfies Record<string, ToolManifest>;

export const toolRegistry = {
${toolEntries.join("\n")}
} as const;

export const declaredTools = {
${declaredToolEntries.join("\n")}
} as const;

export const toolNames = Object.freeze(Object.keys(toolRegistry)) as readonly (keyof typeof toolRegistry)[];

export type GeneratedToolName = keyof typeof toolRegistry;

export function getTool(name: string): ToolManifest | undefined {
  return toolRegistry[name as GeneratedToolName];
}

export const allTools = Object.freeze(
  [...toolNames].map((name) => toolRegistry[name]),
);
`;
}

function buildModelToolsFile(tools: GeneratedToolSource[]): string {
  const modelToolEntries = tools.map((tool) => `  ${JSON.stringify(tool.manifest.name)}: {
    name: ${JSON.stringify(tool.manifest.name)},
    description: ${JSON.stringify(tool.manifest.description)},
    parameters: ${JSON.stringify(tool.manifest.parameters, null, 2)},
  },`);

  return `import type { ModelTool } from "../../packages/model/src";
import { toolNames, type GeneratedToolName } from "./registry";

export const modelToolsByName = {
${modelToolEntries.join("\n")}
} as const satisfies Record<GeneratedToolName, ModelTool>;

export function getModelTools(toolNamesToLoad: readonly string[]): ModelTool[] {
  return toolNamesToLoad.map((toolName) => {
    const tool = modelToolsByName[toolName as GeneratedToolName];
    if (!tool) {
      throw new Error(\`Unknown generated tool: \${toolName}\`);
    }

    return tool;
  });
}

export const allModelTools = toolNames.map((name) => modelToolsByName[name]);
`;
}

function buildPromptsFile(tools: GeneratedToolSource[]): string {
  const promptEntries = tools.map((tool) => `  ${JSON.stringify(tool.manifest.name)}: ${escapeText(tool.manifest.prompt)},`);

  return `import { type GeneratedToolName } from "./registry";

export const toolPrompts = {
${promptEntries.join("\n")}
} as const satisfies Record<GeneratedToolName, string>;

export function getToolPrompt(toolName: string): string {
  return toolPrompts[toolName as GeneratedToolName] ?? "";
}
`;
}

function buildSpecialistsFile(): string {
  return `import { z } from "zod";
import { specialistConfigSchema as baseSpecialistConfigSchema } from "../../packages/contracts/src";
import { toolNames } from "./registry";

const toolNameSchema = z.string().refine(
  (value) => toolNames.includes(value as (typeof toolNames)[number]),
  { message: "Unknown tool in specialist config." },
);

export const generatedSpecialistConfigSchema = baseSpecialistConfigSchema.extend({
  tools: z.array(toolNameSchema).min(1),
});

export function parseSpecialistConfig(value: unknown) {
  return generatedSpecialistConfigSchema.parse(value);
}
`;
}

function buildTypesFile(tools: GeneratedToolSource[]): string {
  const declaredImports = tools
    .filter((tool) => tool.declarationImportPath && tool.declarationExportName)
    .map((tool) => `import { ${tool.declarationExportName} } from "${tool.declarationImportPath}";`);

  const declaredTypes = tools
    .filter((tool) => tool.declarationExportName)
    .map((tool) => {
      const baseName = tool.declarationExportName!.replace(/Tool$/, "");
      const typeName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
      return `export type ${typeName}Input = InferToolInput<typeof ${tool.declarationExportName}>;
export type ${typeName}Output = InferToolOutput<typeof ${tool.declarationExportName}>;`;
    });

  return `import type { InferToolInput, InferToolOutput } from "../sdk";
import { toolNames } from "./registry";
${declaredImports.join("\n")}

export type ToolName = (typeof toolNames)[number];
${declaredTypes.join("\n")}
`;
}

async function main(): Promise<void> {
  const toolDirectories = await findToolDirectories(path.join(repoRoot, "tools"));
  const generatedTools = sortTools(
    await Promise.all(
      toolDirectories.map(async (directory) => {
        return await loadDeclaredTool(directory) ?? await loadLegacyTool(directory);
      }),
    ),
  );
  const knownToolNames = new Set(generatedTools.map((tool) => tool.manifest.name));
  const specialistDir = path.join(repoRoot, "configs/specialists");
  if (await exists(specialistDir)) {
    const specialistFiles = await fs.readdir(specialistDir);
    for (const specialistFile of specialistFiles) {
      if (!specialistFile.endsWith(".json")) {
        continue;
      }

      const specialistPath = path.join(specialistDir, specialistFile);
      const rawSpecialist = JSON.parse(await fs.readFile(specialistPath, "utf8")) as {
        tools?: unknown;
      };
      const specialistTools = Array.isArray(rawSpecialist.tools) ? rawSpecialist.tools : [];
      for (const toolName of specialistTools) {
        if (typeof toolName !== "string" || knownToolNames.has(toolName)) {
          continue;
        }

        throw new Error(
          `Unknown tool ${toolName} in ${toPosixPath(path.relative(repoRoot, specialistPath))}`,
        );
      }
    }
  }

  await fs.mkdir(generatedDir, { recursive: true });
  await fs.writeFile(path.join(generatedDir, "registry.ts"), buildRegistryFile(generatedTools), "utf8");
  await fs.writeFile(path.join(generatedDir, "model-tools.ts"), buildModelToolsFile(generatedTools), "utf8");
  await fs.writeFile(path.join(generatedDir, "prompts.ts"), buildPromptsFile(generatedTools), "utf8");
  await fs.writeFile(path.join(generatedDir, "specialists.ts"), buildSpecialistsFile(), "utf8");
  await fs.writeFile(path.join(generatedDir, "types.ts"), buildTypesFile(generatedTools), "utf8");
}

void main();
