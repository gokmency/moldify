import type { AnalysisResult, MoldParameters } from "@/lib/mold-types";

export const GENERATION_STAGES = [
  { id: "prepare", label: "Prepare solid", progress: 12 },
  { id: "cavity", label: "Carve mold cavity", progress: 38 },
  { id: "features", label: "Add mold features", progress: 66 },
  { id: "export", label: "Export STL files", progress: 88 },
  { id: "complete", label: "Ready to download", progress: 100 },
] as const;

export type GenerationStage = (typeof GENERATION_STAGES)[number]["id"];

export type GeometryWorkerRequest =
  | {
      type: "analyze";
      jobId: string;
      source:
        | {
            kind: "positions";
            positions: ArrayBuffer;
          }
        | {
            kind: "file";
            name: string;
            buffer: ArrayBuffer;
          };
    }
  | {
      type: "generate";
      jobId: string;
      positions: ArrayBuffer;
      parameters: MoldParameters;
    };

export type GeometryWorkerResponse =
  | {
      type: "analysis";
      jobId: string;
      result: AnalysisResult;
      positions: ArrayBuffer;
    }
  | {
      type: "progress";
      jobId: string;
      stage: GenerationStage;
      label: string;
      progress: number;
    }
  | {
      type: "generated";
      jobId: string;
      upper: ArrayBuffer;
      lower: ArrayBuffer;
      stats: {
        axis: "X" | "Y" | "Z";
        upperTriangles: number;
        lowerTriangles: number;
        watertight: boolean;
        moldSize: number[];
      };
    }
  | {
      type: "error";
      jobId: string;
      message: string;
    };
