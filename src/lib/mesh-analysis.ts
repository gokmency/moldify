import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  Raycaster,
  Vector3,
} from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import type { AnalysisResult } from "@/lib/mold-types";

Mesh.prototype.raycast = acceleratedRaycast;

function edgeStats(geometry: BufferGeometry) {
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = nonIndexed.getAttribute("position");
  const edgeCounts = new Map<string, number>();
  const key = (a: Vector3, b: Vector3) => {
    const left = `${a.x.toFixed(5)},${a.y.toFixed(5)},${a.z.toFixed(5)}`;
    const right = `${b.x.toFixed(5)},${b.y.toFixed(5)},${b.z.toFixed(5)}`;
    return left < right ? `${left}|${right}` : `${right}|${left}`;
  };
  const points = [new Vector3(), new Vector3(), new Vector3()];
  for (let i = 0; i < position.count; i += 3) {
    points.forEach((point, index) => point.fromBufferAttribute(position, i + index));
    for (const [a, b] of [
      [0, 1],
      [1, 2],
      [2, 0],
    ]) {
      const edge = key(points[a], points[b]);
      edgeCounts.set(edge, (edgeCounts.get(edge) ?? 0) + 1);
    }
  }
  const boundaryEdges = [...edgeCounts.values()].filter((count) => count !== 2).length;
  return { boundaryEdges, totalEdges: edgeCounts.size };
}

export function analyzeGeometry(geometry: BufferGeometry): AnalysisResult {
  if (!geometry.getAttribute("position") || geometry.getAttribute("position").count < 3) {
    throw new Error("Mesh contains no usable triangles.");
  }
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
  const box = geometry.boundingBox ?? new Box3().setFromBufferAttribute(
    geometry.getAttribute("position") as BufferAttribute,
  );
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const { boundaryEdges, totalEdges } = edgeStats(geometry);
  const manifoldScore = Math.max(0, 1 - boundaryEdges / Math.max(1, totalEdges));

  const axisSizes = { X: size.y * size.z, Y: size.x * size.z, Z: size.x * size.y };
  const maxArea = Math.max(...Object.values(axisSizes));
  const minArea = Math.min(...Object.values(axisSizes));
  const orientationScores = {
    X: Math.round(100 * (1 - (axisSizes.X - minArea) / Math.max(1, maxArea))),
    Y: Math.round(100 * (1 - (axisSizes.Y - minArea) / Math.max(1, maxArea))),
    Z: Math.round(100 * (1 - (axisSizes.Z - minArea) / Math.max(1, maxArea))),
  };
  const orientation = (Object.entries(orientationScores).sort(
    (a, b) => b[1] - a[1],
  )[0][0] || "Z") as "X" | "Y" | "Z";

  const mesh = new Mesh(geometry);
  geometry.boundsTree = new MeshBVH(geometry);
  const raycaster = new Raycaster();
  const directions = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];
  let multiHitRays = 0;
  for (const direction of directions) {
    const origin = center.clone().addScaledVector(direction, -Math.max(size.x, size.y, size.z) * 1.5);
    raycaster.set(origin, direction);
    if (raycaster.intersectObject(mesh, false).length > 2) multiHitRays += 1;
  }
  const undercutRisk = Math.min(0.95, 0.12 + multiHitRays * 0.2 + (1 - manifoldScore) * 0.45);
  const trappedRegionRisk = Math.min(0.9, multiHitRays * 0.18 + (1 - manifoldScore) * 0.5);
  const warnings: string[] = [];
  if (manifoldScore < 0.995) warnings.push("Open or non-manifold edges detected; repair may be required.");
  if (undercutRisk > 0.45) warnings.push("Potential undercuts along the recommended demold direction.");
  if (geometry.getAttribute("position").count / 3 > 250_000)
    warnings.push("High triangle count may increase boolean processing time.");

  return {
    bounds: {
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
      size: [size.x, size.y, size.z],
    },
    triangleCount: geometry.getAttribute("position").count / 3,
    vertexCount: geometry.getAttribute("position").count,
    watertight: manifoldScore > 0.995,
    manifoldScore,
    undercutRisk,
    trappedRegionRisk,
    orientation,
    orientationScores,
    estimatedGenerationSeconds: Math.max(
      2,
      Math.round(2 + geometry.getAttribute("position").count / 35_000),
    ),
    warnings,
    recommendations: {
      splitDirection: orientation,
      wallThickness: Math.max(6, Math.min(14, Math.round(Math.max(size.x, size.y, size.z) * 0.13))),
      clearance: manifoldScore > 0.995 ? 0.35 : 0.6,
      draftAngle: undercutRisk > 0.45 ? 3 : 2,
    },
  };
}
