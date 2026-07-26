import { NextResponse } from "next/server";
import { createDemoBufferGeometry } from "@/lib/demo-geometry";
import { analyzeGeometry } from "@/lib/mesh-analysis";
import { parseMeshBuffer, validateMeshFile } from "@/lib/mesh-loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let geometry;
    if (contentType.includes("multipart/form-data")) {
      const body = await request.formData();
      const file = body.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "A mesh file is required." }, { status: 400 });
      }
      validateMeshFile(file);
      geometry = await parseMeshBuffer(file.name, await file.arrayBuffer());
    } else {
      const body = (await request.json().catch(() => ({}))) as { demo?: boolean };
      if (!body.demo) {
        return NextResponse.json({ error: "A mesh file or demo request is required." }, { status: 400 });
      }
      geometry = createDemoBufferGeometry();
    }
    return NextResponse.json(analyzeGeometry(geometry));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to analyze the mesh." },
      { status: 422 },
    );
  }
}

