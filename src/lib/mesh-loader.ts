import JSZip from "jszip";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  Object3D,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { SUPPORTED_EXTENSIONS } from "@/lib/mold-types";

export const MAX_LOCAL_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_FUNCTION_PAYLOAD_BYTES = 4 * 1024 * 1024;

export function extensionOf(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

export function validateMeshFile(
  file: { name: string; size: number },
  maxBytes = MAX_LOCAL_FILE_BYTES,
) {
  const extension = extensionOf(file.name);
  if (!SUPPORTED_EXTENSIONS.includes(extension as (typeof SUPPORTED_EXTENSIONS)[number])) {
    throw new Error(`Unsupported file type .${extension || "unknown"}. Use STL, OBJ, GLB, or 3MF.`);
  }
  if (file.size <= 0) throw new Error("The selected file is empty.");
  if (file.size > maxBytes) {
    const limitMb = Math.floor(maxBytes / 1024 / 1024);
    throw new Error(`Mesh is larger than the ${limitMb} MB processing limit.`);
  }
  return extension;
}

export async function parseMeshBuffer(
  name: string,
  buffer: ArrayBuffer,
): Promise<BufferGeometry> {
  const extension = validateMeshFile({ name, size: buffer.byteLength });
  if (extension === "stl") return normalizeGeometry(new STLLoader().parse(buffer));
  if (extension === "obj") {
    const text = new TextDecoder().decode(buffer);
    return geometryFromObject(new OBJLoader().parse(text));
  }
  if (extension === "glb") {
    const gltf = await new Promise<{ scene: Object3D }>((resolve, reject) => {
      new GLTFLoader().parse(buffer, "", resolve, reject);
    });
    return geometryFromObject(gltf.scene);
  }
  return parse3mf(buffer);
}

function geometryFromObject(root: Object3D) {
  root.updateMatrixWorld(true);
  const geometries: BufferGeometry[] = [];
  root.traverse((object) => {
    if (!(object instanceof Mesh) || !object.geometry) return;
    const clone = object.geometry.clone();
    clone.applyMatrix4(object.matrixWorld);
    geometries.push(clone);
  });
  if (!geometries.length) throw new Error("No triangle mesh was found in the model.");
  return mergeNonIndexed(geometries);
}

function mergeNonIndexed(geometries: BufferGeometry[]) {
  const positions: number[] = [];
  for (const geometry of geometries) {
    const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
    const position = nonIndexed.getAttribute("position");
    if (!position) continue;
    for (let i = 0; i < position.count; i += 1) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
    }
  }
  if (positions.length < 9) throw new Error("Mesh does not contain complete triangles.");
  const output = new BufferGeometry();
  output.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return normalizeGeometry(output);
}

function normalizeGeometry(geometry: BufferGeometry) {
  const output = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  output.computeBoundingBox();
  output.computeVertexNormals();
  if (!output.boundingBox) throw new Error("Unable to calculate model bounds.");
  const center = output.boundingBox.getCenter(new Vector3());
  output.applyMatrix4(new Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  output.computeBoundingBox();
  output.computeVertexNormals();
  return output;
}

async function parse3mf(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer);
  const modelPath = Object.keys(zip.files).find((path) => path.toLowerCase().endsWith(".model"));
  if (!modelPath) throw new Error("3MF archive has no model XML.");
  const xml = await zip.file(modelPath)?.async("text");
  if (!xml) throw new Error("3MF model XML is empty.");
  const vertices: Array<[number, number, number]> = [];
  const attribute = (source: string, name: string) => {
    const found = source.match(new RegExp(`\\b${name}="([^"]+)"`, "i"));
    return found?.[1];
  };
  const vertexPattern = /<vertex\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = vertexPattern.exec(xml))) {
    const x = attribute(match[1], "x");
    const y = attribute(match[1], "y");
    const z = attribute(match[1], "z");
    if (x !== undefined && y !== undefined && z !== undefined) {
      vertices.push([Number(x), Number(y), Number(z)]);
    }
  }
  const positions: number[] = [];
  const trianglePattern = /<triangle\b([^>]*)\/?>/gi;
  while ((match = trianglePattern.exec(xml))) {
    const indices = ["v1", "v2", "v3"].map((name) => Number(attribute(match![1], name)));
    for (const index of indices) {
      const vertex = vertices[index];
      if (!vertex) throw new Error("3MF contains an invalid triangle index.");
      positions.push(...vertex);
    }
  }
  if (positions.length < 9) throw new Error("3MF contains no usable triangles.");
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return normalizeGeometry(geometry);
}
