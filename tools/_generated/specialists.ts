import { z } from "zod";
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
