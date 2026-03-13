export { gmail } from "../gmail/src";
export { gsheets } from "../gsheets/src";

import { gmail } from "../gmail/src";
import { gsheets } from "../gsheets/src";

export const providers = {
  gmail,
  gsheets,
} as const;
