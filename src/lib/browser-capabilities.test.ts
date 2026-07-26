import { describe, expect, it } from "vitest";
import { browserSupportFromSignals } from "@/lib/browser-capabilities";

describe("browser capability checks", () => {
  it("accepts a browser with every required local capability", () => {
    expect(
      browserSupportFromSignals({
        worker: true,
        wasm: true,
        webgl: true,
        download: true,
      }),
    ).toEqual({ supported: true, missing: [] });
  });

  it("reports each missing capability", () => {
    expect(
      browserSupportFromSignals({
        worker: false,
        wasm: true,
        webgl: false,
        download: true,
      }),
    ).toEqual({
      supported: false,
      missing: ["worker", "webgl"],
    });
  });
});
