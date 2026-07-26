import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMETERS,
  moldParameterSchema,
  PARAMETER_RANGES,
} from "@/lib/mold-types";

describe("mold parameter contract", () => {
  it("accepts the default parameter set", () => {
    expect(moldParameterSchema.parse(DEFAULT_PARAMETERS)).toEqual(DEFAULT_PARAMETERS);
  });

  it("locks all numeric fields to the PRD ranges", () => {
    for (const [key, range] of Object.entries(PARAMETER_RANGES)) {
      expect(
        moldParameterSchema.safeParse({
          ...DEFAULT_PARAMETERS,
          [key]: range.min - range.step,
        }).success,
      ).toBe(false);
      expect(
        moldParameterSchema.safeParse({
          ...DEFAULT_PARAMETERS,
          [key]: range.max + range.step,
        }).success,
      ).toBe(false);
    }
  });
});

