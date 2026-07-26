import {
  BufferGeometry,
  ExtrudeGeometry,
  Matrix4,
  Shape,
} from "three";
import type { ManifoldToplevel } from "manifold-3d";

const DEMO_OUTLINE: Array<[number, number]> = [
  [-18, -10],
  [7, -10],
  [7, -14],
  [18, -14],
  [22, -8],
  [22, 8],
  [18, 14],
  [7, 14],
  [7, 10],
  [-18, 10],
  [-22, 6],
  [-22, -6],
];

export function createDemoBufferGeometry() {
  const shape = new Shape();
  shape.moveTo(...DEMO_OUTLINE[0]);
  for (const point of DEMO_OUTLINE.slice(1)) shape.lineTo(...point);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    depth: 14,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 1.2,
    bevelThickness: 1.2,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -7);
  geometry.computeVertexNormals();
  return geometry;
}

export function createDemoManifold(module: ManifoldToplevel) {
  return new module.CrossSection([DEMO_OUTLINE]).extrude(14, 0, 0, [1, 1], true);
}

export function rotateGeometryForAxis(
  geometry: BufferGeometry,
  axis: "X" | "Y" | "Z",
) {
  if (axis === "X") geometry.applyMatrix4(new Matrix4().makeRotationY(Math.PI / 2));
  if (axis === "Y") geometry.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2));
  return geometry;
}
