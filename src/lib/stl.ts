import type { Mesh as ManifoldMesh } from "manifold-3d";

export function meshToBinaryStl(mesh: ManifoldMesh): Uint8Array {
  const triangleCount = mesh.triVerts.length / 3;
  const buffer = new ArrayBuffer(84 + triangleCount * 50);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const header = new TextEncoder().encode("Moldify manifold-3d export");
  bytes.set(header.subarray(0, 80), 0);
  view.setUint32(80, triangleCount, true);

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = 84 + triangle * 50;
    const ids = [
      mesh.triVerts[triangle * 3],
      mesh.triVerts[triangle * 3 + 1],
      mesh.triVerts[triangle * 3 + 2],
    ];
    const p = ids.map((id) => [
      mesh.vertProperties[id * mesh.numProp],
      mesh.vertProperties[id * mesh.numProp + 1],
      mesh.vertProperties[id * mesh.numProp + 2],
    ]);
    const ux = p[1][0] - p[0][0];
    const uy = p[1][1] - p[0][1];
    const uz = p[1][2] - p[0][2];
    const vx = p[2][0] - p[0][0];
    const vy = p[2][1] - p[0][1];
    const vz = p[2][2] - p[0][2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    view.setFloat32(offset, nx / length, true);
    view.setFloat32(offset + 4, ny / length, true);
    view.setFloat32(offset + 8, nz / length, true);
    p.forEach((vertex, index) => {
      const vertexOffset = offset + 12 + index * 12;
      view.setFloat32(vertexOffset, vertex[0], true);
      view.setFloat32(vertexOffset + 4, vertex[1], true);
      view.setFloat32(vertexOffset + 8, vertex[2], true);
    });
    view.setUint16(offset + 48, 0, true);
  }
  return bytes;
}

