import JSZip from "jszip";
import { NextResponse } from "next/server";
import { generateMold } from "@/lib/manifold-engine";
import {
  MAX_FUNCTION_PAYLOAD_BYTES,
  parseMeshBuffer,
  validateMeshFile,
} from "@/lib/mesh-loader";
import { moldParameterSchema } from "@/lib/mold-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.formData();
    const rawParameters = body.get("parameters");
    if (typeof rawParameters !== "string") {
      return NextResponse.json({ error: "Mold parameters are required." }, { status: 400 });
    }
    const parameters = moldParameterSchema.parse(JSON.parse(rawParameters));
    const file = body.get("file");
    let geometry = null;
    if (file instanceof File) {
      validateMeshFile(file, MAX_FUNCTION_PAYLOAD_BYTES);
      geometry = await parseMeshBuffer(file.name, await file.arrayBuffer());
    }
    const generated = await generateMold(geometry, parameters);
    const archive = new JSZip();
    archive.file("Upper Mold.stl", generated.upper);
    archive.file("Lower Mold.stl", generated.lower);
    archive.file("moldify-job.json", JSON.stringify(generated.stats, null, 2));
    const zip = await archive.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    if (zip.byteLength > MAX_FUNCTION_PAYLOAD_BYTES) {
      return NextResponse.json(
        {
          error:
            "Generated archive exceeds the hosted API response limit. Use the browser studio to generate and download each STL locally.",
        },
        { status: 413 },
      );
    }
    return new NextResponse(Buffer.from(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="Moldify Mold.zip"',
        "X-Moldify-Upper-Triangles": String(generated.stats.upperTriangles),
        "X-Moldify-Lower-Triangles": String(generated.stats.lowerTriangles),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mold generation failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
