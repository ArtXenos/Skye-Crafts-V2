import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

/**
 * Check a form in the browser with the same zod schema the Server Action
 * uses, but submit what the person typed ("raw"), not the converted values:
 * the server always does its own parsing (for example pesos to centavos), so
 * converting twice would be wrong.
 */
export function formResolver<TSchema extends z.ZodType<unknown, FieldValues>>(schema: TSchema) {
  return zodResolver(schema, undefined, { raw: true }) as unknown as Resolver<z.input<TSchema>>;
}
