type PrimitiveFieldType = "string" | "number" | "boolean";

type FieldDeclaration<TType extends PrimitiveFieldType = PrimitiveFieldType> = {
  type: TType;
  description?: string;
};

export type IntentDeclaration = {
  name: string;
  intent: string;
  description?: string;
  fields: Record<string, FieldDeclaration>;
};

export const field = {
  string(description?: string) {
    return { type: "string", description } as const;
  },
  number(description?: string) {
    return { type: "number", description } as const;
  },
  boolean(description?: string) {
    return { type: "boolean", description } as const;
  },
};

export function defineIntent<
  const TName extends string,
  const TIntent extends string,
  const TFields extends Record<string, FieldDeclaration>,
>(declaration: {
  name: TName;
  intent: TIntent;
  description?: string;
  fields: TFields;
}) {
  return declaration;
}

export const ClarificationRequest = defineIntent({
  name: "ClarificationRequest",
  intent: "request_more_information",
  description: "you can request more information from me",
  fields: {
    message: field.string(),
  },
});

export const DoneForNow = defineIntent({
  name: "DoneForNow",
  intent: "done_for_now",
  fields: {
    message: field.string("message to send to the user about the work that was done."),
  },
});

export const determineNextStepContract = [
  ClarificationRequest,
  DoneForNow,
] as const satisfies readonly IntentDeclaration[];

type ContractEntry = (typeof determineNextStepContract)[number];

type OutputField<TField extends FieldDeclaration> =
  TField["type"] extends "string" ? string
  : TField["type"] extends "number" ? number
  : TField["type"] extends "boolean" ? boolean
  : never;

export type DetermineNextStepOutput = {
  [TEntry in ContractEntry as TEntry["intent"]]: {
    intent: TEntry["intent"];
  } & {
    [TField in keyof TEntry["fields"]]: OutputField<TEntry["fields"][TField] & FieldDeclaration>;
  };
}[ContractEntry["intent"]];
