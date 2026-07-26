import { z } from "zod";

export const moldParameterSchema = z.object({
  wallThickness: z.number().min(3).max(20),
  clearance: z.number().min(0.1).max(2),
  splitDirection: z.enum(["Auto", "X", "Y", "Z"]),
  pinCount: z.number().int().min(0).max(8),
  pinDiameter: z.number().min(2).max(12),
  pourDiameter: z.number().min(3).max(20),
  ventDiameter: z.number().min(0.5).max(5),
  draftAngle: z.number().min(0).max(8),
  shrinkCompensation: z.number().min(0).max(5),
  pinsEnabled: z.boolean(),
  ventsEnabled: z.boolean(),
  pourEnabled: z.boolean(),
});

export type MoldParameters = z.infer<typeof moldParameterSchema>;

export const DEFAULT_PARAMETERS: MoldParameters = {
  wallThickness: 8,
  clearance: 0.4,
  splitDirection: "Auto",
  pinCount: 4,
  pinDiameter: 6,
  pourDiameter: 10,
  ventDiameter: 1.5,
  draftAngle: 2,
  shrinkCompensation: 1.2,
  pinsEnabled: true,
  ventsEnabled: true,
  pourEnabled: true,
};

export const PARAMETER_RANGES = {
  wallThickness: { min: 3, max: 20, step: 0.5, unit: "mm" },
  clearance: { min: 0.1, max: 2, step: 0.1, unit: "mm" },
  pinCount: { min: 0, max: 8, step: 1, unit: "" },
  pinDiameter: { min: 2, max: 12, step: 0.5, unit: "mm" },
  pourDiameter: { min: 3, max: 20, step: 0.5, unit: "mm" },
  ventDiameter: { min: 0.5, max: 5, step: 0.25, unit: "mm" },
  draftAngle: { min: 0, max: 8, step: 0.5, unit: "°" },
  shrinkCompensation: { min: 0, max: 5, step: 0.1, unit: "%" },
} as const;

export type Bounds = {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
};

export type AnalysisResult = {
  bounds: Bounds;
  triangleCount: number;
  vertexCount: number;
  watertight: boolean;
  manifoldScore: number;
  undercutRisk: number;
  trappedRegionRisk: number;
  orientation: "X" | "Y" | "Z";
  orientationScores: Record<"X" | "Y" | "Z", number>;
  estimatedGenerationSeconds: number;
  warnings: string[];
  recommendations: Partial<MoldParameters>;
};

export const SUPPORTED_EXTENSIONS = ["stl", "obj", "glb", "3mf"] as const;

