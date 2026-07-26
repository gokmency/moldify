/// <reference lib="webworker" />

import { BufferGeometry, Float32BufferAttribute } from "three";
import {
  GENERATION_STAGES,
  type GeometryWorkerRequest,
  type GeometryWorkerResponse,
} from "@/lib/geometry-worker-protocol";
import { generateMold } from "@/lib/manifold-engine";
import { analyzeGeometry } from "@/lib/mesh-analysis";
import { parseMeshBuffer } from "@/lib/mesh-loader";

const worker = self as DedicatedWorkerGlobalScope;

function geometryFromPositions(positions: ArrayBuffer) {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
  return geometry;
}

function positionsFromGeometry(geometry: BufferGeometry) {
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = nonIndexed.getAttribute("position");
  if (!position) throw new Error("Mesh has no vertex positions.");
  const positions = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    positions[index * 3] = position.getX(index);
    positions[index * 3 + 1] = position.getY(index);
    positions[index * 3 + 2] = position.getZ(index);
  }
  return positions.buffer;
}

function send(message: GeometryWorkerResponse, transfer: Transferable[] = []) {
  worker.postMessage(message, transfer);
}

worker.onmessage = async (event: MessageEvent<GeometryWorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === "analyze") {
      const geometry =
        request.source.kind === "file"
          ? await parseMeshBuffer(request.source.name, request.source.buffer)
          : geometryFromPositions(request.source.positions);
      const positions = positionsFromGeometry(geometry);
      send(
        {
          type: "analysis",
          jobId: request.jobId,
          result: analyzeGeometry(geometry),
          positions,
        },
        [positions],
      );
      geometry.dispose();
      return;
    }

    const geometry = geometryFromPositions(request.positions);
    const result = await generateMold(
      geometry,
      request.parameters,
      (stage) => {
        const current = GENERATION_STAGES.find((item) => item.id === stage);
        if (!current) return;
        send({
          type: "progress",
          jobId: request.jobId,
          stage,
          label: current.label,
          progress: current.progress,
        });
      },
      new URL("/manifold.wasm", worker.location.origin).href,
    );
    geometry.dispose();
    const upper = result.upper.slice().buffer;
    const lower = result.lower.slice().buffer;
    send(
      {
        type: "generated",
        jobId: request.jobId,
        upper,
        lower,
        stats: result.stats,
      },
      [upper, lower],
    );
  } catch (error) {
    send({
      type: "error",
      jobId: request.jobId,
      message: error instanceof Error ? error.message : "Geometry processing failed.",
    });
  }
};

export {};
