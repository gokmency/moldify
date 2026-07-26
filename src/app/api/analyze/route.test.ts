import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/analyze/route";

describe("POST /api/analyze", () => {
  it("returns deterministic orientation and estimates for the demo", async () => {
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demo: true }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.orientation).toMatch(/X|Y|Z/);
    expect(body.estimatedGenerationSeconds).toBeGreaterThan(0);
    expect(Array.isArray(body.warnings)).toBe(true);
  });

  it("rejects unsupported file types", async () => {
    const form = new FormData();
    form.append("file", new File(["not a mesh"], "part.txt", { type: "text/plain" }));
    const response = await POST(
      new Request("http://localhost/api/analyze", { method: "POST", body: form }),
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error).toContain("Unsupported");
  });
});

