/**
 * Shared config schema used by the worker.
 */
import { z } from "zod";

export const specialistConfigSchema = z.object({
  id: z.string().min(1),
  promptFile: z.string().min(1),
  tools: z.array(z.string()).min(1),
  maxTurns: z.number().int().positive(),
  contextFiles: z.array(z.string()).default([]),
});

export type SpecialistConfig = z.infer<typeof specialistConfigSchema>;
