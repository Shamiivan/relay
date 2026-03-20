import { z } from "zod";
import { defineTool } from "../../sdk";
import type {
  ToolCapability,
  ToolDeclaration,
  ToolErrorInfo,
  ToolPrompt,
} from "../../sdk";
import { apolloRequest, type ApolloFetch } from "./client.ts";
import { ApolloApiError, ApolloResponseParseError } from "./errors.ts";

export const apolloObjectSchema = z.object({}).passthrough();

export function apolloToolError(error: unknown, fallbackMessage: string): ToolErrorInfo {
  if (error instanceof z.ZodError) {
    return { type: "validation", message: error.issues[0]?.message };
  }
  if (error instanceof ApolloResponseParseError) {
    return { type: "external_error", message: error.message };
  }
  if (error instanceof ApolloApiError) {
    if (error.status === 401 || error.status === 403) {
      return { type: "auth_error", message: error.message };
    }
    if (error.status === 404) {
      return { type: "not_found", message: error.message };
    }
    if (error.status === 429) {
      return { type: "rate_limit_error", message: error.message };
    }
    return { type: "external_error", message: error.message };
  }
  if (error instanceof Error && /APOLLO_API_KEY|auth|credential|token/i.test(error.message)) {
    return { type: "auth_error", message: error.message };
  }
  return {
    type: "external_error",
    message: error instanceof Error ? error.message : fallbackMessage,
  };
}

export async function callApolloRaw(
  path: string,
  body: unknown,
  options?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: ApolloFetch;
  },
): Promise<{ response: Record<string, unknown> }> {
  return {
    response: await apolloRequest(
      {
        path,
        body,
        responseSchema: apolloObjectSchema,
      },
      options,
    ),
  };
}

export function createApolloRawTool<TInput extends z.ZodType>(input: {
  name: string;
  resource: string;
  capability: ToolCapability;
  description: string;
  prompt: ToolPrompt;
  endpointPath: string;
  inputSchema: TInput;
  buildBody?: (value: z.output<TInput>) => unknown;
  destructive?: boolean;
  idempotent?: boolean;
  fallbackErrorMessage: string;
}): ToolDeclaration<string, TInput, z.ZodObject<{
  response: typeof apolloObjectSchema;
}>> {
  return defineTool({
    name: input.name,
    resource: input.resource,
    capability: input.capability,
    description: input.description,
    prompt: input.prompt,
    destructive: input.destructive,
    idempotent: input.idempotent,
    input: input.inputSchema,
    output: z.object({
      response: apolloObjectSchema,
    }),
    async handler({ input: parsedInput }) {
      return callApolloRaw(
        input.endpointPath,
        input.buildBody ? input.buildBody(parsedInput) : parsedInput,
      );
    },
    onError(error) {
      return apolloToolError(error, input.fallbackErrorMessage);
    },
  });
}
