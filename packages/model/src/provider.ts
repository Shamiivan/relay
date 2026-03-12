import type { ModelClient } from "./index";
import { createGeminiClient } from "./gemini";

export type ModelProviderEnv = {
  MODEL_PROVIDER: string;
  MODEL_NAME: string;
  GEMINI_API_KEY: string;
};

export function createModelClient(env: ModelProviderEnv): ModelClient {
  if (env.MODEL_PROVIDER === "gemini") {
    return createGeminiClient({
      MODEL_NAME: env.MODEL_NAME,
      GEMINI_API_KEY: env.GEMINI_API_KEY,
    });
  }

  throw new Error(`Unsupported model provider: ${env.MODEL_PROVIDER}`);
}
