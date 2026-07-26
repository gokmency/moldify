import { describe, expect, it } from "vitest";
import { createDemoBufferGeometry } from "@/lib/demo-geometry";
import { analyzeGeometry } from "@/lib/mesh-analysis";
import { generateMold } from "@/lib/manifold-engine";
import { DEFAULT_PARAMETERS } from "@/lib/mold-types";

describe("geometry pipeline", () => {
  it("analyzes the procedural demo part", () => {
    const result = analyzeGeometry(createDemoBufferGeometry());
    expect(result.orientation).toMatch(/X|Y|Z/);
    expect(result.estimatedGenerationSeconds).toBeGreaterThan(0);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.bounds.size.every((value) => value > 0)).toBe(true);
  });

  it("generates separate non-empty upper and lower STL files", async () => {
    const output = await generateMold(null, DEFAULT_PARAMETERS);
    expect(output.upper.byteLength).toBeGreaterThan(84);
    expect(output.lower.byteLength).toBeGreaterThan(84);
    expect(output.upper).not.toEqual(output.lower);
    expect(output.stats.watertight).toBe(true);
  });

  it("changes lower mold geometry when pins are disabled", async () => {
    const withPins = await generateMold(null, DEFAULT_PARAMETERS);
    const withoutPins = await generateMold(null, {
      ...DEFAULT_PARAMETERS,
      pinsEnabled: false,
    });
    expect(withPins.lower.byteLength).not.toBe(withoutPins.lower.byteLength);
  });

  it("reports real generation stages in order", async () => {
    const stages: string[] = [];
    await generateMold(null, DEFAULT_PARAMETERS, (stage) => stages.push(stage));
    expect(stages).toEqual([
      "prepare",
      "cavity",
      "features",
      "export",
      "complete",
    ]);
  });
});
