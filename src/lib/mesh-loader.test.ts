import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  MAX_3MF_XML_BYTES,
  MAX_ABSOLUTE_COORDINATE,
  MAX_LOCAL_FILE_BYTES,
  MAX_TRIANGLE_COUNT,
  assert3mfXmlSize,
  assertCoordinate,
  assertTriangleCount,
  parseMeshBuffer,
  validateMeshFile,
} from "@/lib/mesh-loader";

describe("mesh resource limits", () => {
  it("accepts supported files inside the local size limit", () => {
    expect(validateMeshFile({ name: "part.stl", size: 1024 })).toBe("stl");
  });

  it("rejects oversized files and unsupported extensions", () => {
    expect(() =>
      validateMeshFile({
        name: "part.stl",
        size: MAX_LOCAL_FILE_BYTES + 1,
      }),
    ).toThrow("50 MB");
    expect(() => validateMeshFile({ name: "part.step", size: 1024 })).toThrow(
      "Unsupported",
    );
  });

  it("rejects excessive triangle and 3MF XML sizes", () => {
    expect(() => assertTriangleCount(MAX_TRIANGLE_COUNT + 1)).toThrow(
      "1,000,000",
    );
    expect(() => assert3mfXmlSize(MAX_3MF_XML_BYTES + 1)).toThrow("25 MB");
  });

  it("rejects invalid and extreme coordinate values", () => {
    expect(() => assertCoordinate(Number.NaN)).toThrow("invalid coordinate");
    expect(() => assertCoordinate(MAX_ABSOLUTE_COORDINATE + 1)).toThrow(
      "supported size range",
    );
  });

  it("rejects a 3MF archive without model geometry", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", "<Types />");
    const buffer = await zip.generateAsync({ type: "arraybuffer" });
    await expect(parseMeshBuffer("broken.3mf", buffer)).rejects.toThrow(
      "no model XML",
    );
  });
});
