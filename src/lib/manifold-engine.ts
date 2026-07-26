import type {
  Manifold as ManifoldSolid,
  ManifoldToplevel,
  Mesh as ManifoldMesh,
} from "manifold-3d";
import { BufferGeometry } from "three";
import type { MoldParameters } from "@/lib/mold-types";
import type { GenerationStage } from "@/lib/geometry-worker-protocol";
import { createDemoManifold } from "@/lib/demo-geometry";
import { meshToBinaryStl } from "@/lib/stl";

let modulePromise: Promise<ManifoldToplevel> | null = null;

async function getModule(wasmUrl?: string) {
  if (!modulePromise) {
    modulePromise = import("manifold-3d").then(async ({ default: factory }) => {
      const kernel = await factory(
        wasmUrl ? { locateFile: () => wasmUrl } : undefined,
      );
      kernel.setup();
      kernel.setCircularSegments(48);
      return kernel;
    });
  }
  return modulePromise;
}

function geometryToManifold(kernel: ManifoldToplevel, geometry: BufferGeometry) {
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = nonIndexed.getAttribute("position");
  if (!position) throw new Error("Mesh has no vertex positions.");
  const vertices = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    vertices[i * 3] = position.getX(i);
    vertices[i * 3 + 1] = position.getY(i);
    vertices[i * 3 + 2] = position.getZ(i);
  }
  const triangles = new Uint32Array(position.count);
  for (let i = 0; i < triangles.length; i += 1) triangles[i] = i;
  const mesh = new kernel.Mesh({
    numProp: 3,
    vertProperties: vertices,
    triVerts: triangles,
  });
  mesh.merge();
  return kernel.Manifold.ofMesh(mesh);
}

function cylinderAlongAxis(
  kernel: ManifoldToplevel,
  height: number,
  radius: number,
  axis: "X" | "Y" | "Z",
) {
  let cylinder = kernel.Manifold.cylinder(height, radius, radius, 40, true);
  if (axis === "X") cylinder = cylinder.rotate([0, 90, 0]);
  if (axis === "Y") cylinder = cylinder.rotate([90, 0, 0]);
  return cylinder;
}

function axisIndex(axis: "X" | "Y" | "Z") {
  return axis === "X" ? 0 : axis === "Y" ? 1 : 2;
}

function createHalfBox(
  kernel: ManifoldToplevel,
  fullSize: [number, number, number],
  axis: "X" | "Y" | "Z",
  positive: boolean,
) {
  const index = axisIndex(axis);
  const size = [...fullSize] as [number, number, number];
  size[index] /= 2;
  const translation: [number, number, number] = [0, 0, 0];
  translation[index] = (positive ? 1 : -1) * size[index] * 0.5;
  return kernel.Manifold.cube(size, true).translate(translation);
}

function pinPositions(
  size: [number, number, number],
  axis: "X" | "Y" | "Z",
  count: number,
) {
  const cross = [0, 1, 2].filter((i) => i !== axisIndex(axis));
  const a = size[cross[0]] * 0.36;
  const b = size[cross[1]] * 0.36;
  const candidates = [
    [-a, -b],
    [a, -b],
    [a, b],
    [-a, b],
    [0, -b],
    [a, 0],
    [0, b],
    [-a, 0],
  ];
  return candidates.slice(0, count).map(([u, v]) => {
    const point: [number, number, number] = [0, 0, 0];
    point[cross[0]] = u;
    point[cross[1]] = v;
    return point;
  });
}

function subtractAndDelete(base: ManifoldSolid, tool: ManifoldSolid) {
  const result = base.subtract(tool);
  base.delete();
  tool.delete();
  return result;
}

function addAndDelete(base: ManifoldSolid, tool: ManifoldSolid) {
  const result = base.add(tool);
  base.delete();
  tool.delete();
  return result;
}

export async function generateMold(
  geometry: BufferGeometry | null,
  parameters: MoldParameters,
  onProgress?: (stage: GenerationStage) => void,
  wasmUrl?: string,
) {
  onProgress?.("prepare");
  const kernel = await getModule(wasmUrl);
  let model: ManifoldSolid;
  try {
    model = geometry ? geometryToManifold(kernel, geometry) : createDemoManifold(kernel);
  } catch {
    throw new Error(
      "The mesh could not be repaired into a watertight solid. Close holes and remove self-intersections, then try again.",
    );
  }

  const bounds = model.boundingBox();
  const rawSize = bounds.max.map((value, i) => value - bounds.min[i]) as [
    number,
    number,
    number,
  ];
  const center = bounds.max.map((value, i) => (value + bounds.min[i]) / 2) as [
    number,
    number,
    number,
  ];
  const centered = model.translate(center.map((value) => -value) as [number, number, number]);
  model.delete();
  const maxDimension = Math.max(...rawSize);
  const scale =
    1 + parameters.shrinkCompensation / 100 + parameters.clearance / Math.max(1, maxDimension);
  model = centered.scale(scale);
  centered.delete();

  const axis =
    parameters.splitDirection === "Auto" ? "Z" : parameters.splitDirection;
  const fullSize = rawSize.map(
    (value) => value * scale + parameters.wallThickness * 2,
  ) as [number, number, number];
  const axisId = axisIndex(axis);
  fullSize[axisId] += parameters.wallThickness;

  let lower = createHalfBox(kernel, fullSize, axis, false);
  let upper = createHalfBox(kernel, fullSize, axis, true);
  onProgress?.("cavity");
  const lowerCavity = lower.subtract(model);
  const upperCavity = upper.subtract(model);
  lower.delete();
  upper.delete();
  lower = lowerCavity;
  upper = upperCavity;

  onProgress?.("features");
  if (parameters.pinsEnabled && parameters.pinCount > 0) {
    for (const point of pinPositions(fullSize, axis, parameters.pinCount)) {
      const pinHeight = Math.max(3, parameters.pinDiameter * 0.9);
      const pinCenter = [...point] as [number, number, number];
      pinCenter[axisId] = -pinHeight * 0.18;
      const pin = cylinderAlongAxis(
        kernel,
        pinHeight,
        parameters.pinDiameter / 2,
        axis,
      ).translate(pinCenter);
      lower = addAndDelete(lower, pin);
      const hole = cylinderAlongAxis(
        kernel,
        pinHeight * 1.3,
        parameters.pinDiameter / 2 + parameters.clearance,
        axis,
      ).translate(point);
      upper = subtractAndDelete(upper, hole);
    }
  }

  const channelHeight = fullSize[axisId] * 0.7;
  if (parameters.pourEnabled) {
    const pourPosition: [number, number, number] = [0, 0, 0];
    pourPosition[axisId] = fullSize[axisId] * 0.25;
    const pour = cylinderAlongAxis(
      kernel,
      channelHeight,
      parameters.pourDiameter / 2,
      axis,
    ).translate(pourPosition);
    upper = subtractAndDelete(upper, pour);
  }

  if (parameters.ventsEnabled) {
    const cross = [0, 1, 2].filter((i) => i !== axisId);
    for (const sign of [-1, 1]) {
      const ventPosition: [number, number, number] = [0, 0, 0];
      ventPosition[axisId] = fullSize[axisId] * 0.25;
      ventPosition[cross[0]] = sign * rawSize[cross[0]] * 0.28;
      const vent = cylinderAlongAxis(
        kernel,
        channelHeight,
        parameters.ventDiameter / 2,
        axis,
      ).translate(ventPosition);
      upper = subtractAndDelete(upper, vent);
    }
  }

  onProgress?.("export");
  const upperMesh = upper.getMesh() as ManifoldMesh;
  const lowerMesh = lower.getMesh() as ManifoldMesh;
  const result = {
    upper: meshToBinaryStl(upperMesh),
    lower: meshToBinaryStl(lowerMesh),
    stats: {
      axis,
      upperTriangles: upperMesh.triVerts.length / 3,
      lowerTriangles: lowerMesh.triVerts.length / 3,
      watertight: true,
      moldSize: fullSize.map((value) => Math.round(value * 100) / 100),
    },
  };
  model.delete();
  upper.delete();
  lower.delete();
  onProgress?.("complete");
  return result;
}
