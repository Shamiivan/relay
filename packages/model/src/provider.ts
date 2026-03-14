import type { ModelAdapter } from "./index";
import { createGeminiClient } from "./gemini";

export type ModelProviderEnv = {
  MODEL_PROVIDER: string;
  MODEL_NAME: string;
  GEMINI_API_KEY: string;
};

export function createModelAdapter(env: ModelProviderEnv): ModelAdapter {
  if (env.MODEL_PROVIDER === "gemini") {
    return createGeminiClient({
      MODEL_NAME: env.MODEL_NAME,
      GEMINI_API_KEY: env.GEMINI_API_KEY,
    });
  }

  throw new Error(`Unsupported model provider: ${env.MODEL_PROVIDER}`);
}

export const createModelClient = createModelAdapter;
